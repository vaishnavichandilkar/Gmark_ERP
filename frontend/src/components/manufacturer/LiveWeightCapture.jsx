import React, { useState, useEffect } from 'react';
import {
    Scale,
    Cpu,
    CheckCircle2,
    RotateCcw,
    AlertCircle,
    Sliders,
    Power,
    Usb,
    Lock,
    Unlock,
    HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { weighingService } from '../../services/hardware/weighing/weighingService';
import { ConnectionStatus, WeightStability } from '../../services/hardware/weighing/WeighingDeviceTypes';

/**
 * LiveWeightCapture Component
 * Interfaces with USB-Serial digital scales (Web Serial API) or the built-in
 * Scale Simulator to capture validated, stable net weights for packages.
 */
const LiveWeightCapture = ({
    capturedWeight,
    onWeightCaptured,
    unit = 'KG',
    onUnitChange,
    error,
}) => {
    // Mode: 'LIVE' | 'MANUAL'
    const [mode, setMode] = useState('LIVE');

    // Connection & stream state
    const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.DISCONNECTED);
    const [activeMode, setActiveMode] = useState('NONE'); // 'SERIAL' | 'SIMULATOR' | 'NONE'
    const [currentReading, setCurrentReading] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Manual input state (fallback)
    const [manualInput, setManualInput] = useState('');

    // Locked/captured state
    const [isLocked, setIsLocked] = useState(Boolean(capturedWeight));

    // Simulator quick weights
    const simulatorPresets = [5.0, 10.0, 25.0, 50.0];

    // Subscribe to weighing service stream and status
    useEffect(() => {
        const unsubReading = weighingService.onReading((reading) => {
            setCurrentReading(reading);
        });

        const unsubStatus = weighingService.onStatusChange((status, activeAdapterMode) => {
            setConnectionStatus(status);
            setActiveMode(activeAdapterMode);
        });

        return () => {
            unsubReading();
            unsubStatus();
        };
    }, []);

    // Sync if capturedWeight was pre-populated
    useEffect(() => {
        if (capturedWeight && !isLocked) {
            setIsLocked(true);
        }
    }, [capturedWeight]);

    // Connect to physical scale via Web Serial
    const handleConnectSerial = async () => {
        if (!weighingService.isWebSerialSupported()) {
            toast.error('Web Serial is only supported in Google Chrome and Microsoft Edge. Starting simulator instead.');
            handleConnectSimulator();
            return;
        }

        setIsConnecting(true);
        try {
            await weighingService.connectSerial();
            toast.success('Connected to physical weighing scale via COM Port');
            setIsLocked(false);
        } catch (err) {
            if (err.name !== 'NotFoundError') {
                console.error('Serial connection error:', err);
                toast.error('Failed to open serial port. Verify scale connection and baud rate.');
            }
        } finally {
            setIsConnecting(false);
        }
    };

    // Connect to Simulator
    const handleConnectSimulator = async (initialWeight = 12.5) => {
        setIsConnecting(true);
        try {
            await weighingService.connectSimulator(initialWeight);
            toast.success('Connected to Scale Simulator (Virtual Platform Scale)');
            setIsLocked(false);
        } catch (err) {
            console.error('Simulator start failed:', err);
            toast.error('Failed to start simulator.');
        } finally {
            setIsConnecting(false);
        }
    };

    // Disconnect
    const handleDisconnect = async () => {
        await weighingService.disconnect();
        setCurrentReading(null);
        toast('Weighing scale disconnected', { icon: '⚪' });
    };

    // Tare scale
    const handleTare = async () => {
        await weighingService.tare();
        toast('Scale tared to 0.000 KG', { icon: '⚖️' });
    };

    // Zero scale
    const handleZero = async () => {
        await weighingService.zero();
        toast('Scale zeroed', { icon: '0️⃣' });
    };

    // Capture the stable live weight
    const handleCaptureWeight = () => {
        if (!currentReading) {
            toast.error('No live weight reading available.');
            return;
        }

        if (!currentReading.isStable) {
            toast.error('Weight is not stable yet. Wait for the scale to settle.');
            return;
        }

        const net = currentReading.netWeight;
        if (net <= 0) {
            toast.error('Cannot capture zero or negative weight.');
            return;
        }

        setIsLocked(true);
        onWeightCaptured({
            weight: net,
            unit: (currentReading.unit || unit).toUpperCase(),
            source: activeMode === 'SERIAL' ? 'HARDWARE_SCALE' : 'SCALE_SIMULATOR',
            grossWeight: currentReading.grossWeight,
            tareWeight: currentReading.tareWeight,
            rawPayload: currentReading.rawPayload,
            isStable: true,
        });

        toast.success(`Weight Captured: ${net.toFixed(3)} ${unit}`);
    };

    // Manual fallback submit
    const handleManualSubmit = (e) => {
        const val = parseFloat(manualInput);
        if (isNaN(val) || val <= 0) {
            toast.error('Please enter a valid positive weight.');
            return;
        }
        setIsLocked(true);
        onWeightCaptured({
            weight: val,
            unit,
            source: 'MANUAL_ENTRY',
            grossWeight: val,
            tareWeight: 0,
            isStable: true,
        });
    };

    // Unlock to re-weigh
    const handleReWeigh = () => {
        setIsLocked(false);
    };

    const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
    const isStable = currentReading?.isStable;
    const liveNet = currentReading?.netWeight != null ? currentReading.netWeight : 0.0;
    const liveGross = currentReading?.grossWeight != null ? currentReading.grossWeight : 0.0;
    const liveTare = currentReading?.tareWeight != null ? currentReading.tareWeight : 0.0;

    return (
        <div className="w-full bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm transition-all">
            {/* Top Toolbar: Mode Switcher & Device Connection Status */}
            <div className="px-5 py-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Scale size={18} className="text-[#073318]" />
                    <span className="text-[14px] font-bold text-gray-800">
                        Weighing Station Integration
                    </span>

                    {/* Mode Tag */}
                    <div className="ml-2 flex items-center bg-gray-200 p-0.5 rounded-lg text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => setMode('LIVE')}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                                mode === 'LIVE'
                                    ? 'bg-[#073318] text-white shadow-xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Digital Scale Mode
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('MANUAL')}
                            className={`px-2.5 py-1 rounded-md transition-all ${
                                mode === 'MANUAL'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Manual Fallback
                        </button>
                    </div>
                </div>

                {/* Connection Controls (Only in LIVE mode) */}
                {mode === 'LIVE' && (
                    <div className="flex items-center gap-2">
                        {isConnected ? (
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {activeMode === 'SERIAL' ? 'USB Scale Online' : 'Simulator Online'}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleDisconnect}
                                    title="Disconnect Scale"
                                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <Power size={16} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleConnectSerial}
                                    disabled={isConnecting}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#073318] hover:bg-[#04200f] text-white text-[12px] font-bold rounded-lg shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    <Usb size={14} />
                                    <span>Connect USB Scale</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleConnectSimulator(12.5)}
                                    disabled={isConnecting}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-bold rounded-lg transition-all"
                                >
                                    <Cpu size={14} className="text-emerald-700" />
                                    <span>Start Simulator</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Weighing Area */}
            <div className="p-5">
                {mode === 'LIVE' ? (
                    <div>
                        {/* Digital Terminal Card */}
                        <div className="relative bg-[#09150E] border-2 border-[#163821] rounded-[16px] p-6 text-white shadow-inner overflow-hidden">
                            {/* Decorative background grid */}
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#22C55E_1px,transparent_1px)] [background-size:16px_16px]"></div>

                            <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
                                {/* Left: Digital Weight Display */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400">
                                            NET WEIGHT INDICATOR
                                        </span>

                                        {/* Live Stability Chip */}
                                        {isConnected ? (
                                            isStable ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                    <CheckCircle2 size={12} />
                                                    STABLE
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                                    <RotateCcw size={12} className="animate-spin" />
                                                    MEASURING...
                                                </span>
                                            )
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-700 text-gray-300">
                                                OFFLINE
                                            </span>
                                        )}
                                    </div>

                                    {/* Large Digital Numeric Readout */}
                                    <div className="flex items-baseline gap-3">
                                        <div className="font-mono text-[48px] md:text-[56px] font-black tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.3)]">
                                            {isConnected
                                                ? liveNet.toFixed(3).padStart(6, '0')
                                                : isLocked && capturedWeight
                                                ? Number(capturedWeight).toFixed(3).padStart(6, '0')
                                                : '00.000'}
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="text-[20px] font-black text-emerald-300 font-mono">
                                                {unit}
                                            </span>
                                            <span className="text-[10px] text-gray-400 uppercase font-medium">
                                                Division 0.001
                                            </span>
                                        </div>
                                    </div>

                                    {/* Sub-Readouts: Gross & Tare */}
                                    <div className="mt-4 pt-3 border-t border-[#1C3E27] flex items-center gap-6 text-[12px] text-gray-400 font-mono">
                                        <div>
                                            <span>GROSS: </span>
                                            <strong className="text-gray-200">
                                                {isConnected ? liveGross.toFixed(3) : '0.000'} {unit}
                                            </strong>
                                        </div>
                                        <div>
                                            <span>TARE: </span>
                                            <strong className="text-gray-200">
                                                {isConnected ? liveTare.toFixed(3) : '0.000'} {unit}
                                            </strong>
                                        </div>
                                        <div>
                                            <span>SOURCE: </span>
                                            <strong className="text-emerald-400">
                                                {activeMode === 'SERIAL'
                                                    ? 'COM Port (RS232)'
                                                    : activeMode === 'SIMULATOR'
                                                    ? 'Simulated Scale'
                                                    : 'Manual / Ready'}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Hardware Scale Action Controls */}
                                <div className="flex flex-col gap-2 shrink-0 md:border-l md:border-[#1C3E27] md:pl-6 justify-center">
                                    {/* Tare & Zero Buttons */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={handleTare}
                                            disabled={!isConnected}
                                            className="px-3.5 py-2 bg-[#122A1A] hover:bg-[#1A3A25] border border-[#1C3E27] rounded-[10px] text-[12px] font-bold text-gray-200 disabled:opacity-40 transition-colors"
                                        >
                                            TARE
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleZero}
                                            disabled={!isConnected}
                                            className="px-3.5 py-2 bg-[#122A1A] hover:bg-[#1A3A25] border border-[#1C3E27] rounded-[10px] text-[12px] font-bold text-gray-200 disabled:opacity-40 transition-colors"
                                        >
                                            ZERO
                                        </button>
                                    </div>

                                    {/* Primary Weight Capture Button */}
                                    {!isLocked ? (
                                        <button
                                            type="button"
                                            onClick={handleCaptureWeight}
                                            disabled={!isConnected || !isStable || liveNet <= 0}
                                            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] rounded-[12px] font-black text-[14px] shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Scale size={18} />
                                            <span>Capture Stable Weight</span>
                                        </button>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-[10px] text-emerald-300 text-[12px] font-bold">
                                                <Lock size={14} />
                                                <span>Weight Locked ({Number(capturedWeight).toFixed(3)} {unit})</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleReWeigh}
                                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#122A1A] hover:bg-[#1A3A25] text-gray-300 rounded-[8px] text-[11px] font-semibold transition-colors"
                                            >
                                                <Unlock size={12} />
                                                <span>Re-weigh / Unlock</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Interactive Scale Simulator Presets (When Simulator is active) */}
                        {activeMode === 'SIMULATOR' && isConnected && (
                            <div className="mt-4 p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-[12px] flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                                <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-900">
                                    <Sliders size={15} className="text-emerald-700" />
                                    <span>Simulate Placing Package on Scale:</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {simulatorPresets.map((weightVal) => (
                                        <button
                                            key={weightVal}
                                            type="button"
                                            onClick={() => weighingService.setSimulatorLoad(weightVal)}
                                            className="px-3 py-1 bg-white hover:bg-emerald-600 hover:text-white border border-emerald-300 rounded-lg text-[12px] font-bold text-emerald-800 transition-all shadow-2xs"
                                        >
                                            {weightVal.toFixed(1)} KG
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => weighingService.setSimulatorLoad(0)}
                                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-bold transition-all"
                                    >
                                        Empty Platform
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Hardware Helper Tips */}
                        {!isConnected && !capturedWeight && (
                            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-[10px] flex items-start gap-2.5 text-[12px] text-gray-600">
                                <HelpCircle size={16} className="text-gray-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Scale Connection:</strong> Plug your weighing indicator into your PC using a USB or USB-to-RS232 serial cable. Click <strong>Connect USB Scale</strong> to select your scale's COM port, or click <strong>Start Simulator</strong> to test with a simulated platform load.
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* MANUAL INPUT FALLBACK MODE */
                    <div className="space-y-3">
                        <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3 text-[12px] text-amber-900 flex items-start gap-2.5">
                            <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                            <div>
                                <strong>Manual Mode Active:</strong> Physical scale communication is bypassed. All entered weights must be manually read from the indicator display and confirmed.
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    placeholder="Enter net weight (e.g. 12.500)"
                                    value={manualInput}
                                    onChange={(e) => {
                                        setManualInput(e.target.value);
                                        setIsLocked(false);
                                    }}
                                    className="w-full h-[46px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[15px] font-mono font-bold outline-none focus:border-[#073318] focus:bg-white transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-500 text-[13px]">
                                    {unit}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleManualSubmit}
                                className="h-[46px] px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-[10px] font-bold text-[13px] transition-colors shadow-xs"
                            >
                                Confirm Manual Weight
                            </button>
                        </div>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-[8px] p-2.5">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveWeightCapture;
