/**
 * Web Serial API Adapter for Physical Weighing Scales
 * Directly interfaces with USB-Serial (RS-232 / FTDI / CH340 / CP2102) digital weighing indicators
 * through the native browser navigator.serial driver without external software.
 */

import { asciiParser } from '../parsers/asciiProtocolParser';
import { DefaultSerialConfig } from '../WeighingDeviceTypes';

export class WebSerialAdapter {
    constructor() {
        this.port = null;
        this.reader = null;
        this.readableStreamClosed = null;
        this.isConnected = false;
        this.listener = null;
        this.buffer = '';
        this.keepReading = false;
    }

    /**
     * Check if the host browser supports the Web Serial API
     * @returns {boolean}
     */
    static isSupported() {
        return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    /**
     * Connect to physical serial port selected by operator
     * @param {object} config - Serial communication configuration
     */
    async connect(config = {}) {
        if (!WebSerialAdapter.isSupported()) {
            throw new Error('Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
        }

        const serialConfig = {
            baudRate: config.baudRate || DefaultSerialConfig.baudRate,
            dataBits: config.dataBits || DefaultSerialConfig.dataBits,
            stopBits: config.stopBits || DefaultSerialConfig.stopBits,
            parity: config.parity || DefaultSerialConfig.parity,
            flowControl: config.flowControl || DefaultSerialConfig.flowControl,
        };

        try {
            // Request user to select hardware COM / USB port via browser dialog
            this.port = await navigator.serial.requestPort();
            await this.port.open(serialConfig);

            this.isConnected = true;
            this.keepReading = true;

            // Start background reader loop
            this.readLoop();

            return true;
        } catch (err) {
            this.isConnected = false;
            if (this.port) {
                try { await this.port.close(); } catch (_) { }
                this.port = null;
            }
            throw err;
        }
    }

    /**
     * Continuously read and decode incoming byte stream from weighing machine
     */
    async readLoop() {
        while (this.port && this.port.readable && this.keepReading) {
            const textDecoder = new TextDecoderStream();
            this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
            this.reader = textDecoder.readable.getReader();

            try {
                while (this.keepReading) {
                    const { value, done } = await this.reader.read();
                    if (done) {
                        break;
                    }
                    if (value) {
                        this.processChunk(value);
                    }
                }
            } catch (err) {
                console.warn('Serial read error:', err);
            } finally {
                if (this.reader) {
                    try { this.reader.releaseLock(); } catch (_) { }
                }
            }
        }
    }

    /**
     * Process incoming string chunks, split by newline/CR, and parse protocol
     * @param {string} chunk
     */
    processChunk(chunk) {
        this.buffer += chunk;
        const lines = this.buffer.split(/[\r\n]+/);

        // Keep the last partial fragment in the buffer
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine) {
                const reading = asciiParser.parse(cleanLine);
                if (reading && this.listener) {
                    this.listener(reading);
                }
            }
        }
    }

    startStreaming(callback) {
        this.listener = callback;
    }

    stopStreaming() {
        this.listener = null;
    }

    async disconnect() {
        this.keepReading = false;
        this.stopStreaming();

        try {
            if (this.reader) {
                await this.reader.cancel();
            }
            if (this.readableStreamClosed) {
                await this.readableStreamClosed.catch(() => { });
            }
            if (this.port) {
                await this.port.close();
            }
        } catch (err) {
            console.error('Error during serial port close:', err);
        } finally {
            this.port = null;
            this.reader = null;
            this.readableStreamClosed = null;
            this.isConnected = false;
            this.buffer = '';
        }

        return true;
    }

    async tare() {
        // Physical tare command on RS-232 if bidirectional
        if (this.port && this.port.writable) {
            try {
                const encoder = new TextEncoder();
                const writer = this.port.writable.getWriter();
                await writer.write(encoder.encode('T\r\n'));
                writer.releaseLock();
            } catch (err) {
                console.warn('Could not send tare command to scale:', err);
            }
        }
    }

    async zero() {
        if (this.port && this.port.writable) {
            try {
                const encoder = new TextEncoder();
                const writer = this.port.writable.getWriter();
                await writer.write(encoder.encode('Z\r\n'));
                writer.releaseLock();
            } catch (err) {
                console.warn('Could not send zero command to scale:', err);
            }
        }
    }
}
