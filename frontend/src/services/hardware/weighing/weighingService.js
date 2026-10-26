/**
 * Universal Weighing Integration Service
 * Manages active hardware adapters (Web Serial or Simulated Scale),
 * dispatches real-time normalized readings, and ensures stability validation.
 */

import { WebSerialAdapter } from './adapters/webSerialAdapter';
import { SimulatedScaleAdapter } from './adapters/simulatedScaleAdapter';
import { ConnectionStatus } from './WeighingDeviceTypes';

class WeighingService {
    constructor() {
        this.activeAdapter = null;
        this.currentStatus = ConnectionStatus.DISCONNECTED;
        this.readingListeners = new Set();
        this.statusListeners = new Set();
        this.lastReading = null;
        this.activeMode = 'NONE'; // 'SERIAL' | 'SIMULATOR' | 'NONE'

        this.simulatedAdapter = new SimulatedScaleAdapter();
        this.webSerialAdapter = new WebSerialAdapter();
    }

    /**
     * Check if Web Serial API is supported in this browser
     */
    isWebSerialSupported() {
        return WebSerialAdapter.isSupported();
    }

    /**
     * Subscribe to incoming live weight readings
     */
    onReading(callback) {
        this.readingListeners.add(callback);
        if (this.lastReading) callback(this.lastReading);
        return () => this.readingListeners.delete(callback);
    }

    /**
     * Subscribe to device connection status changes
     */
    onStatusChange(callback) {
        this.statusListeners.add(callback);
        callback(this.currentStatus, this.activeMode);
        return () => this.statusListeners.delete(callback);
    }

    setStatus(status) {
        this.currentStatus = status;
        this.statusListeners.forEach(cb => cb(status, this.activeMode));
    }

    broadcastReading(reading) {
        this.lastReading = reading;
        this.readingListeners.forEach(cb => cb(reading));
    }

    /**
     * Connect to physical scale via USB / RS-232 serial port
     */
    async connectSerial(config = {}) {
        await this.disconnect();

        this.setStatus(ConnectionStatus.CONNECTING);
        this.activeMode = 'SERIAL';
        this.activeAdapter = this.webSerialAdapter;

        try {
            await this.webSerialAdapter.connect(config);
            this.webSerialAdapter.startStreaming((reading) => {
                this.broadcastReading(reading);
            });
            this.setStatus(ConnectionStatus.CONNECTED);
            return true;
        } catch (err) {
            console.error('Serial scale connection failed:', err);
            this.setStatus(ConnectionStatus.ERROR);
            this.activeAdapter = null;
            this.activeMode = 'NONE';
            throw err;
        }
    }

    /**
     * Connect to software scale simulator for testing
     */
    async connectSimulator(initialWeight = 12.500) {
        await this.disconnect();

        this.setStatus(ConnectionStatus.CONNECTING);
        this.activeMode = 'SIMULATOR';
        this.activeAdapter = this.simulatedAdapter;

        try {
            await this.simulatedAdapter.connect({ initialWeight });
            this.simulatedAdapter.startStreaming((reading) => {
                this.broadcastReading(reading);
            });
            this.setStatus(ConnectionStatus.CONNECTED);
            return true;
        } catch (err) {
            this.setStatus(ConnectionStatus.ERROR);
            throw err;
        }
    }

    /**
     * Disconnect active scale
     */
    async disconnect() {
        if (this.activeAdapter) {
            try {
                await this.activeAdapter.disconnect();
            } catch (err) {
                console.warn('Disconnect error:', err);
            }
            this.activeAdapter = null;
        }
        this.activeMode = 'NONE';
        this.setStatus(ConnectionStatus.DISCONNECTED);
        this.lastReading = null;
    }

    /**
     * Perform Tare (zero net weight)
     */
    async tare() {
        if (this.activeAdapter && typeof this.activeAdapter.tare === 'function') {
            await this.activeAdapter.tare();
        }
    }

    /**
     * Perform Zero
     */
    async zero() {
        if (this.activeAdapter && typeof this.activeAdapter.zero === 'function') {
            await this.activeAdapter.zero();
        }
    }

    /**
     * Adjust load on simulator (for interactive testing)
     */
    setSimulatorLoad(weight) {
        if (this.activeMode === 'SIMULATOR' && this.simulatedAdapter) {
            this.simulatedAdapter.setLoad(weight);
        }
    }
}

export const weighingService = new WeighingService();
export default weighingService;
