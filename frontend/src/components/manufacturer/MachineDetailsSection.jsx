import React, { useState, useEffect } from 'react';
import {
    Cpu,
    Settings,
    Plus,
    X,
    CheckCircle2,
    Sliders,
    Usb,
    Scale,
    AlertCircle,
    Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWeighingDevices } from '../../services/manufacturerService';
import axiosInstance from '../../services/axiosInstance';

/**
 * MachineDetailsSection Component
 * Dedicated, separated configuration section for Machine ID, Plant Code,
 * scale make/model, communication baud rate, and registered device selection.
 */
const MachineDetailsSection = ({
    machineId,
    onMachineIdChange,
    plantCode,
    onPlantCodeChange,
    onDeviceSelect,
    errors = {},
}) => {
    const [devices, setDevices] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [selectedDeviceId, setSelectedDeviceId] = useState('SCALE-01');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // New device form state
    const [newDevice, setNewDevice] = useState({
        deviceName: '',
        manufacturer: 'Essae-Teraoka',
        modelNumber: '',
        serialPort: 'COM3',
        baudRate: 9600,
        maxCapacity: 150,
        minDivision: 0.005,
    });
    const [savingDevice, setSavingDevice] = useState(false);

    // Load registered devices from backend
    useEffect(() => {
        const fetchDevices = async () => {
            setLoadingDevices(true);
            try {
                const list = await getWeighingDevices();
                if (Array.isArray(list) && list.length > 0) {
                    setDevices(list);
                    setSelectedDeviceId(list[0].id);
                }
            } catch (err) {
                console.warn('Could not load device list from server, using defaults:', err);
                // Fallback default profiles
                setDevices([
                    {
                        id: 'SCALE-01',
                        deviceName: 'Packaging Line Scale #1 (Bench)',
                        manufacturer: 'Essae-Teraoka',
                        modelNumber: 'DS-215',
                        connectionType: 'USB_SERIAL',
                        serialPort: 'COM3',
                        baudRate: 9600,
                        maxCapacity: 150.0,
                        minDivision: 0.005,
                    },
                    {
                        id: 'SIMULATOR-01',
                        deviceName: 'Virtual Platform Scale Simulator',
                        manufacturer: 'WeighPro Virtual',
                        modelNumber: 'SIM-PRO-V2',
                        connectionType: 'SIMULATOR',
                        serialPort: 'VIRTUAL',
                        baudRate: 9600,
                        maxCapacity: 500.0,
                        minDivision: 0.001,
                    },
                ]);
            } finally {
                setLoadingDevices(false);
            }
        };

        fetchDevices();
    }, []);

    const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

    // Handle device change
    const handleDeviceChange = (devId) => {
        if (devId === 'NEW') {
            setIsAddModalOpen(true);
            return;
        }
        setSelectedDeviceId(devId);
        const dev = devices.find((d) => d.id === devId);
        if (dev && onDeviceSelect) {
            onDeviceSelect(dev);
        }
    };

    // Save new custom device
    const handleSaveNewDevice = async (e) => {
        e.preventDefault();
        if (!newDevice.deviceName.trim()) {
            toast.error('Device name is required');
            return;
        }

        setSavingDevice(true);
        try {
            const response = await axiosInstance.post('/manufacturer/devices', newDevice);
            const saved = response.data;
            toast.success(`Registered scale: ${saved.deviceName}`);
            setDevices((prev) => [...prev, saved]);
            setSelectedDeviceId(saved.id);
            setIsAddModalOpen(false);
            setNewDevice({
                deviceName: '',
                manufacturer: 'Essae-Teraoka',
                modelNumber: '',
                serialPort: 'COM3',
                baudRate: 9600,
                maxCapacity: 150,
                minDivision: 0.005,
            });
        } catch (err) {
            console.error('Failed to register device:', err);
            toast.error('Failed to save device configuration');
        } finally {
            setSavingDevice(false);
        }
    };

    return (
        <div className="w-full bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm transition-all">
            {/* Header: Distinct Separated Card Title */}
            <div className="px-5 py-3.5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cpu size={18} className="text-[#073318]" />
                    <span className="text-[14px] font-bold text-gray-800">
                        Packaging Machine & Station Details
                    </span>
                    <span className="text-[11px] font-bold text-[#073318] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Hardware Station
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#073318] hover:text-[#04200f] hover:underline"
                >
                    <Plus size={14} />
                    <span>Configure New Machine</span>
                </button>
            </div>

            <div className="p-5 space-y-4">
                {/* 1. Scale Selection Dropdown */}
                <div>
                    <label className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Assigned Weighing Scale / Indicator
                    </label>
                    <select
                        value={selectedDeviceId}
                        onChange={(e) => handleDeviceChange(e.target.value)}
                        className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] px-3.5 text-[13px] font-bold outline-none focus:border-[#073318] shadow-xs"
                    >
                        {devices.map((dev) => (
                            <option key={dev.id} value={dev.id}>
                                {dev.deviceName} — {dev.manufacturer} {dev.modelNumber} ({dev.serialPort} @ {dev.baudRate} baud)
                            </option>
                        ))}
                        <option value="NEW">+ Register New Machine Profile...</option>
                    </select>
                </div>

                {/* 2. Machine Specifications Grid */}
                {selectedDevice && (
                    <div className="p-4 bg-gray-50/80 border border-gray-200 rounded-[12px] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                        <div>
                            <span className="text-gray-500 block font-medium">Manufacturer / Model</span>
                            <strong className="text-gray-900 font-bold block mt-0.5">
                                {selectedDevice.manufacturer} {selectedDevice.modelNumber || 'Standard'}
                            </strong>
                        </div>

                        <div>
                            <span className="text-gray-500 block font-medium">Interface / Port</span>
                            <strong className="text-gray-900 font-bold block mt-0.5">
                                {selectedDevice.serialPort} ({selectedDevice.baudRate || 9600}-8-N-1)
                            </strong>
                        </div>

                        <div>
                            <span className="text-gray-500 block font-medium">Max Capacity</span>
                            <strong className="text-gray-900 font-bold block mt-0.5">
                                {selectedDevice.maxCapacity || 150} KG
                            </strong>
                        </div>

                        <div>
                            <span className="text-gray-500 block font-medium">Resolution / Division</span>
                            <strong className="text-gray-900 font-bold block mt-0.5">
                                {selectedDevice.minDivision || 0.001} KG
                            </strong>
                        </div>
                    </div>
                )}

                {/* 3. Station Code & Plant Code Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Machine ID */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[13px] font-bold text-gray-700">
                                Machine / Station Identifier *
                            </label>
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                Station Code
                            </span>
                        </div>
                        <input
                            type="text"
                            maxLength={10}
                            value={machineId}
                            onChange={(e) => onMachineIdChange(e.target.value.toUpperCase())}
                            placeholder="M01"
                            className={`w-full h-[42px] bg-white border rounded-[10px] px-3.5 text-[14px] font-mono font-bold uppercase outline-none shadow-xs transition-all ${
                                errors.machineId
                                    ? 'border-rose-400 focus:border-rose-600 bg-rose-50/30'
                                    : 'border-[#E5E7EB] focus:border-[#073318]'
                            }`}
                        />
                        {errors.machineId ? (
                            <p className="text-[12px] text-rose-600 mt-1 font-medium flex items-center gap-1">
                                <AlertCircle size={13} />
                                {errors.machineId}
                            </p>
                        ) : (
                            <p className="text-[11px] text-gray-500 mt-1">
                                Station identifier embedded into label serial (e.g. M01, LINE-02).
                            </p>
                        )}
                    </div>

                    {/* Plant Code */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[13px] font-bold text-gray-700">
                                Plant Code (2 Characters) *
                            </label>
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                2 Chars
                            </span>
                        </div>
                        <input
                            type="text"
                            maxLength={2}
                            value={plantCode}
                            onChange={(e) => onPlantCodeChange(e.target.value.toUpperCase())}
                            placeholder="AB"
                            className={`w-full h-[42px] bg-white border rounded-[10px] px-3.5 text-[14px] font-mono font-bold uppercase outline-none shadow-xs transition-all ${
                                errors.plantCode
                                    ? 'border-rose-400 focus:border-rose-600 bg-rose-50/30'
                                    : 'border-[#E5E7EB] focus:border-[#073318]'
                            }`}
                        />
                        {errors.plantCode ? (
                            <p className="text-[12px] text-rose-600 mt-1 font-medium flex items-center gap-1">
                                <AlertCircle size={13} />
                                {errors.plantCode}
                            </p>
                        ) : (
                            <p className="text-[11px] text-gray-500 mt-1">
                                2-letter factory or plant identifier (e.g. AB, P1).
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal: Register New Machine Profile */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-[#E5E7EB] rounded-[16px] max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-[#073318]/10 flex items-center justify-center text-[#073318]">
                                <Scale size={18} />
                            </div>
                            <div>
                                <h3 className="text-[16px] font-bold text-gray-900">
                                    Configure Weighing Machine
                                </h3>
                                <p className="text-[12px] text-gray-500">
                                    Register a physical scale connected via USB / RS-232
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveNewDevice} className="space-y-3.5">
                            <div>
                                <label className="block text-[12px] font-bold text-gray-700 mb-1">
                                    Device / Station Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Packaging Line #2 Scale"
                                    value={newDevice.deviceName}
                                    onChange={(e) => setNewDevice({ ...newDevice, deviceName: e.target.value })}
                                    className="w-full h-[38px] border border-gray-300 rounded-[8px] px-3 text-[13px] outline-none focus:border-[#073318]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[12px] font-bold text-gray-700 mb-1">
                                        Manufacturer
                                    </label>
                                    <select
                                        value={newDevice.manufacturer}
                                        onChange={(e) => setNewDevice({ ...newDevice, manufacturer: e.target.value })}
                                        className="w-full h-[38px] border border-gray-300 rounded-[8px] px-2.5 text-[13px] outline-none focus:border-[#073318]"
                                    >
                                        <option value="Essae-Teraoka">Essae-Teraoka</option>
                                        <option value="CAS">CAS Scale</option>
                                        <option value="Mettler Toledo">Mettler Toledo</option>
                                        <option value="Avery Weigh-Tronix">Avery Weigh-Tronix</option>
                                        <option value="Contech">Contech</option>
                                        <option value="Cardinal">Cardinal</option>
                                        <option value="Generic Scale">Generic RS-232</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[12px] font-bold text-gray-700 mb-1">
                                        Model Number
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. DS-215"
                                        value={newDevice.modelNumber}
                                        onChange={(e) => setNewDevice({ ...newDevice, modelNumber: e.target.value })}
                                        className="w-full h-[38px] border border-gray-300 rounded-[8px] px-3 text-[13px] outline-none focus:border-[#073318]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[12px] font-bold text-gray-700 mb-1">
                                        Port / Interface
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="COM3"
                                        value={newDevice.serialPort}
                                        onChange={(e) => setNewDevice({ ...newDevice, serialPort: e.target.value })}
                                        className="w-full h-[38px] border border-gray-300 rounded-[8px] px-3 text-[13px] font-mono outline-none focus:border-[#073318]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[12px] font-bold text-gray-700 mb-1">
                                        Baud Rate
                                    </label>
                                    <select
                                        value={newDevice.baudRate}
                                        onChange={(e) => setNewDevice({ ...newDevice, baudRate: Number(e.target.value) })}
                                        className="w-full h-[38px] border border-gray-300 rounded-[8px] px-2.5 text-[13px] font-mono outline-none focus:border-[#073318]"
                                    >
                                        <option value={9600}>9600 (Standard)</option>
                                        <option value={2400}>2400</option>
                                        <option value={4800}>4800</option>
                                        <option value={19200}>19200</option>
                                        <option value={115200}>115200</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[12px] font-bold text-gray-700 mb-1">
                                        Max Capacity (KG)
                                    </label>
                                    <input
                                        type="number"
                                        value={newDevice.maxCapacity}
                                        onChange={(e) => setNewDevice({ ...newDevice, maxCapacity: Number(e.target.value) })}
                                        className="w-full h-[38px] border border-gray-300 rounded-[8px] px-3 text-[13px] outline-none focus:border-[#073318]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[12px] font-bold text-gray-700 mb-1">
                                        Division (KG)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={newDevice.minDivision}
                                        onChange={(e) => setNewDevice({ ...newDevice, minDivision: Number(e.target.value) })}
                                        className="w-full h-[38px] border border-gray-300 rounded-[8px] px-3 text-[13px] outline-none focus:border-[#073318]"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-[13px] font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingDevice}
                                    className="px-5 py-2 bg-[#073318] hover:bg-[#04200f] text-white rounded-lg text-[13px] font-bold transition-all disabled:opacity-50"
                                >
                                    {savingDevice ? 'Saving...' : 'Save Machine Profile'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MachineDetailsSection;
