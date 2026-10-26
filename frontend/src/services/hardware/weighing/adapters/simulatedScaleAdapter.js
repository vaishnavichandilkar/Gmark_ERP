/**
 * Simulated Weighing Device Adapter
 * Generates realistic platform scale load curves with stability settling,
 * tare calculations, and noise flutter for development and hardware-free testing.
 */

import { WeightStability } from '../WeighingDeviceTypes';

export class SimulatedScaleAdapter {
    constructor() {
        this.isConnected = false;
        this.intervalId = null;
        this.listener = null;

        // Scale physics state
        this.targetWeight = 12.500; // Default simulated package weight in kg
        this.currentWeight = 0;
        this.tareWeight = 0;
        this.unit = 'kg';
        this.isStable = true;
        this.settleCounter = 0;
        this.flutterMagnitude = 0.04;
    }

    async connect(config = {}) {
        this.isConnected = true;
        this.currentWeight = 0;
        this.tareWeight = 0;
        this.targetWeight = config.initialWeight || 12.500;
        this.settleCounter = 0;
        this.isStable = false;

        this.startStreaming();
        return true;
    }

    async disconnect() {
        this.stopStreaming();
        this.isConnected = false;
        return true;
    }

    startStreaming(callback) {
        if (callback) this.listener = callback;
        if (this.intervalId) clearInterval(this.intervalId);

        this.intervalId = setInterval(() => {
            this.tick();
        }, 200); // 5Hz stream
    }

    stopStreaming() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    tick() {
        if (!this.isConnected || !this.listener) return;

        this.settleCounter++;

        // Approach target weight with slight vibration flutter
        if (this.settleCounter < 10) {
            // Unstable measuring phase (operator just placed package onto platform)
            const noise = (Math.random() - 0.5) * this.flutterMagnitude;
            const progress = this.settleCounter / 10;
            this.currentWeight = (this.targetWeight * progress) + noise;
            this.isStable = false;
        } else {
            // Settled stable phase
            this.currentWeight = this.targetWeight;
            this.isStable = true;
        }

        const gross = Math.max(0, parseFloat(this.currentWeight.toFixed(3)));
        const net = Math.max(0, parseFloat((gross - this.tareWeight).toFixed(3)));
        const isZero = gross < 0.002;

        const reading = {
            deviceId: 'SIMULATOR-01',
            grossWeight: gross,
            tareWeight: this.tareWeight,
            netWeight: net,
            unit: this.unit,
            isStable: this.isStable,
            isZero,
            isOverload: gross > 150.0,
            stability: this.isStable ? WeightStability.STABLE : WeightStability.UNSTABLE,
            rawPayload: `ST,GS,+${gross.toFixed(3)}${this.unit}`,
            timestamp: new Date(),
        };

        this.listener(reading);
    }

    /**
     * Operator places a new package onto the simulated platform
     * @param {number} weight - Target weight in kg
     */
    setLoad(weight) {
        this.targetWeight = Math.max(0, parseFloat(weight));
        this.settleCounter = 0; // Trigger new unstable settling phase
        this.isStable = false;
    }

    /**
     * Tare current weight
     */
    async tare() {
        this.tareWeight = Math.max(0, parseFloat(this.currentWeight.toFixed(3)));
        this.settleCounter = 0;
        this.isStable = false;
    }

    /**
     * Zero the scale
     */
    async zero() {
        this.tareWeight = 0;
        this.targetWeight = 0;
        this.currentWeight = 0;
        this.settleCounter = 10;
        this.isStable = true;
    }
}
