import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus,
    Search,
    RefreshCw,
    X,
    ArrowLeft,
    ArrowRight,
    ChevronsLeft,
    ChevronsRight,
    Filter,
    RotateCcw,
    Cpu,
    Scale,
    Radio,
    Zap,
    Edit2,
    Trash2,
    AlertCircle,
    ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ScrollableTable from '../../../components/common/ScrollableTable';
import CustomSelect from '../../../components/common/CustomSelect';
import {
    getWeighingDevices,
    createWeighingDevice,
    updateWeighingDevice,
    deleteWeighingDevice,
} from '../../../services/manufacturerService';
import { weighingService } from '../../../services/hardware/weighing/weighingService';

const DEFAULT_MANUFACTURERS = [
    'Essae-Teraoka',
    'Mettler Toledo',
    'Avery Weigh-Tronix',
    'Sansui',
    'Contech Instruments',
    'Citizen Scale',
    'CAS Scale',
    'Sartorius',
    'WeighPro Virtual',
    'Other / Generic',
];

const BAUD_RATES = [2400, 4800, 9600, 19200, 38400, 57600, 115200];
const PROTOCOLS = [
    { value: 'GENERIC_ASCII', label: 'Generic Continuous ASCII Stream (Standard)' },
    { value: 'METTLER_TOLEDO_SICS', label: 'Mettler Toledo SICS Command Protocol' },
    { value: 'SIMPLE_DECIMAL', label: 'Simple Float / Clean Decimal Protocol' },
    { value: 'SIMULATOR', label: 'Virtual Platform Simulator Protocol' },
];

const INITIAL_FORM = {
    id: '',
    deviceName: '',
    stationId: 'M01',
    plantCode: 'AB',
    location: 'Packaging Station Bay 1',
    manufacturer: 'Essae-Teraoka',
    modelNumber: 'DS-215',
    connectionType: 'USB_SERIAL',
    serialPort: 'COM3',
    baudRate: 9600,
    protocol: 'GENERIC_ASCII',
    defaultUnit: 'kg',
    maxCapacity: 150,
    minDivision: 0.005,
    isOnline: true,
};

const MachineManagement = () => {
    const { t } = useTranslation(['modules', 'common']);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Column Filters State (Matching Purchase Order column search)
    const [columnFilters, setColumnFilters] = useState({
        stationId: '',
        deviceName: '',
        plantCode: '',
        manufacturer: '',
        serialPort: '',
        maxCapacity: '',
        status: '',
    });

    // Pagination State (Matching Purchase Order pagination)
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // View state: 'list' | 'add' | 'edit'
    const [currentView, setCurrentView] = useState('list');
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Live Test Modal state
    const [testingDevice, setTestingDevice] = useState(null);
    const [testWeight, setTestWeight] = useState(null);
    const [testLogs, setTestLogs] = useState([]);
    const testUnsubRef = useRef(null);

    // Load devices from backend
    const fetchDevices = async (showToast = false) => {
        setLoading(true);
        try {
            const list = await getWeighingDevices();
            if (Array.isArray(list) && list.length > 0) {
                setDevices(list);
            } else {
                setDevices([]);
            }
            if (showToast) toast.success('Machine registry updated');
        } catch (err) {
            console.warn('Could not load devices from API, using fallback list:', err);
            setDevices([
                {
                    id: 'SCALE-01',
                    stationId: 'M01',
                    plantCode: 'AB',
                    deviceName: 'Packaging Line Scale #1 (Bench)',
                    manufacturer: 'Essae-Teraoka',
                    modelNumber: 'DS-215',
                    connectionType: 'USB_SERIAL',
                    serialPort: 'COM3',
                    baudRate: 9600,
                    protocol: 'GENERIC_ASCII',
                    defaultUnit: 'kg',
                    maxCapacity: 150.0,
                    minDivision: 0.005,
                    isOnline: true,
                    lastConnectedAt: new Date().toISOString(),
                },
                {
                    id: 'SIMULATOR-01',
                    stationId: 'M02',
                    plantCode: 'AB',
                    deviceName: 'Virtual Platform Scale Simulator',
                    manufacturer: 'WeighPro Virtual',
                    modelNumber: 'SIM-PRO-V2',
                    connectionType: 'SIMULATOR',
                    serialPort: 'VIRTUAL',
                    baudRate: 9600,
                    protocol: 'SIMULATOR',
                    defaultUnit: 'kg',
                    maxCapacity: 500.0,
                    minDivision: 0.001,
                    isOnline: true,
                    lastConnectedAt: new Date().toISOString(),
                },
            ]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchDevices(true);
    };

    const filteredDevices = useMemo(() => {
        let result = [...devices];

        // Global search query
        const query = searchQuery.toLowerCase().trim();
        if (query) {
            result = result.filter(
                (d) =>
                    (d.deviceName && d.deviceName.toLowerCase().includes(query)) ||
                    (d.id && d.id.toLowerCase().includes(query)) ||
                    (d.stationId && d.stationId.toLowerCase().includes(query)) ||
                    (d.plantCode && d.plantCode.toLowerCase().includes(query)) ||
                    (d.manufacturer && d.manufacturer.toLowerCase().includes(query)) ||
                    (d.modelNumber && d.modelNumber.toLowerCase().includes(query)) ||
                    (d.serialPort && d.serialPort.toLowerCase().includes(query))
            );
        }

        // Apply Column-wise Filters
        Object.keys(columnFilters).forEach((key) => {
            const val = (columnFilters[key] || '').toLowerCase().trim();
            if (val) {
                result = result.filter((d) => {
                    let fieldVal = '';
                    if (key === 'stationId') fieldVal = d.stationId || d.id || '';
                    else if (key === 'deviceName') fieldVal = d.deviceName || '';
                    else if (key === 'plantCode') fieldVal = d.plantCode || 'AB';
                    else if (key === 'manufacturer') fieldVal = `${d.manufacturer || ''} ${d.modelNumber || ''}`;
                    else if (key === 'serialPort') fieldVal = d.connectionType === 'SIMULATOR' ? 'Virtual Sim' : `${d.serialPort || ''} ${d.baudRate || ''}`;
                    else if (key === 'maxCapacity') fieldVal = `${d.maxCapacity || ''} ${d.defaultUnit || 'kg'} ${d.minDivision || ''}`;
                    else if (key === 'status') fieldVal = d.isOnline ? 'Online' : 'Offline';

                    return fieldVal.toLowerCase().includes(val);
                });
            }
        });

        return result;
    }, [devices, searchQuery, columnFilters]);

    const hasActiveColumnFilters = Object.values(columnFilters).some((v) => (v || '').trim().length > 0);
    const hasActiveFilters = Boolean(searchQuery.trim() || hasActiveColumnFilters);

    const handleResetFilters = () => {
        setSearchQuery('');
        setColumnFilters({
            stationId: '',
            deviceName: '',
            plantCode: '',
            manufacturer: '',
            serialPort: '',
            maxCapacity: '',
            status: '',
        });
        setCurrentPage(1);
    };

    // Pagination calculations (Matching Purchase Order pagination)
    const totalPages = Math.ceil(filteredDevices.length / itemsPerPage) || 1;
    const paginatedDevices = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredDevices.slice(start, start + itemsPerPage);
    }, [filteredDevices, currentPage, itemsPerPage]);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Navigation into Add View
    const handleOpenAdd = () => {
        const nextNum = devices.length + 1;
        setFormData({
            ...INITIAL_FORM,
            id: `SCALE-0${nextNum}`,
            stationId: `M0${nextNum}`,
            deviceName: `Packaging Scale #${nextNum}`,
        });
        setFormErrors({});
        setCurrentView('add');
    };

    // Navigation into Edit View
    const handleOpenEdit = (device) => {
        setFormData({
            id: device.id,
            deviceName: device.deviceName || '',
            stationId: device.stationId || device.id || 'M01',
            plantCode: device.plantCode || 'AB',
            location: device.location || 'Packaging Station Bay 1',
            manufacturer: device.manufacturer || 'Essae-Teraoka',
            modelNumber: device.modelNumber || '',
            connectionType: device.connectionType || 'USB_SERIAL',
            serialPort: device.serialPort || 'COM3',
            baudRate: device.baudRate || 9600,
            protocol: device.protocol || 'GENERIC_ASCII',
            defaultUnit: device.defaultUnit || 'kg',
            maxCapacity: device.maxCapacity || 150,
            minDivision: device.minDivision || 0.005,
            isOnline: device.isOnline !== undefined ? device.isOnline : true,
        });
        setFormErrors({});
        setCurrentView('edit');
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.deviceName.trim()) errors.deviceName = 'Machine Name is required';
        if (!formData.stationId.trim()) errors.stationId = 'Machine / Station Code is required';
        if (!formData.manufacturer.trim()) errors.manufacturer = 'Manufacturer is required';
        if (!formData.serialPort.trim()) errors.serialPort = 'Port Identifier is required';
        if (!formData.maxCapacity || Number(formData.maxCapacity) <= 0) {
            errors.maxCapacity = 'Capacity must be greater than 0';
        }
        if (!formData.minDivision || Number(formData.minDivision) <= 0) {
            errors.minDivision = 'Min Division must be greater than 0';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Save machine (Add or Edit)
    const handleSaveDevice = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            toast.error('Please fix validation errors');
            return;
        }

        setSubmitting(true);
        try {
            if (currentView === 'edit') {
                await updateWeighingDevice(formData.id, formData);
                toast.success(`Machine ${formData.deviceName} updated successfully`);
            } else {
                await createWeighingDevice(formData);
                toast.success(`Machine ${formData.deviceName} registered successfully`);
            }
            setCurrentView('list');
            await fetchDevices();
        } catch (err) {
            console.warn('API save fallback to local state:', err);
            if (currentView === 'edit') {
                setDevices((prev) =>
                    prev.map((d) => (d.id === formData.id ? { ...formData } : d))
                );
                toast.success(`Machine ${formData.deviceName} updated`);
            } else {
                setDevices((prev) => [...prev, { ...formData, isOnline: true }]);
                toast.success(`Machine ${formData.deviceName} registered`);
            }
            setCurrentView('list');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete machine
    const handleDeleteDevice = async (id, name) => {
        if (!window.confirm(`Are you sure you want to remove "${name || id}"?`)) {
            return;
        }

        try {
            await deleteWeighingDevice(id);
            toast.success(`Machine "${name || id}" removed`);
            await fetchDevices();
        } catch (err) {
            console.warn('API delete fallback to local state:', err);
            setDevices((prev) => prev.filter((d) => d.id !== id));
            toast.success(`Machine "${name || id}" removed`);
        }
    };

    // Live Test Connection Handshake
    const handleStartTest = async (device) => {
        setTestingDevice(device);
        setTestWeight(null);
        setTestLogs([`Connecting to ${device.deviceName} (${device.serialPort})...`]);

        try {
            if (device.connectionType === 'SIMULATOR') {
                await weighingService.connectSimulator(15.250);
            } else {
                if (!weighingService.isWebSerialSupported()) {
                    throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
                }
                await weighingService.connectSerial({
                    baudRate: device.baudRate || 9600,
                });
            }

            const unsub = weighingService.onReading((reading) => {
                setTestWeight(reading);
                setTestLogs((prev) => [
                    `[${new Date().toLocaleTimeString()}] Weight: ${reading.netWeight?.toFixed(3)} ${reading.unit} | Stable: ${reading.isStable ? 'YES' : 'STABILIZING...'}`,
                    ...prev.slice(0, 8),
                ]);
            });

            testUnsubRef.current = unsub;
            setTestLogs((prev) => [`Connected to ${device.deviceName}! Streaming readings...`, ...prev]);
        } catch (err) {
            console.error('Test error:', err);
            setTestLogs((prev) => [`ERROR: ${err.message || 'Connection failed'}`, ...prev]);
            toast.error(err.message || 'Connection test failed');
        }
    };

    const handleStopTest = async () => {
        if (testUnsubRef.current) {
            testUnsubRef.current();
            testUnsubRef.current = null;
        }
        try {
            await weighingService.disconnect();
        } catch (e) {
            // ignore
        }
        setTestingDevice(null);
        setTestWeight(null);
    };

    // ==========================================
    // VIEW 1: ADD / EDIT MACHINE (Matching AddAccount UI)
    // ==========================================
    if (currentView === 'add' || currentView === 'edit') {
        const isEditMode = currentView === 'edit';

        return (
            <div className="flex flex-col w-full h-full animate-in fade-in duration-300 p-2 font-['Plus_Jakarta_Sans']">
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col w-full mb-12 transform-gpu overflow-hidden">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                        <div>
                            <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                                {isEditMode ? 'Edit Machine Details' : 'Add Machine'}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCurrentView('list')}
                            className="group flex items-center justify-center w-10 h-10 md:w-auto md:h-[44px] md:px-6 border border-[#E5E7EB] text-[#4B5563] rounded-[12px] md:rounded-[10px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm active:scale-95"
                            title={t('common:back', 'Back')}
                        >
                            <ArrowLeft size={18} className="hidden md:block" />
                            <span className="hidden md:inline ml-2">{t('common:back', 'Back')}</span>
                        </button>
                    </div>

                    {/* Form Body - Matching GroupForm layout */}
                    <form onSubmit={handleSaveDevice} className="p-8 md:p-10 flex flex-col gap-8 w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            {/* 1. Machine Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Machine Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter machine name (e.g. Packaging Scale #1)"
                                    value={formData.deviceName}
                                    onChange={(e) =>
                                        setFormData({ ...formData, deviceName: e.target.value })
                                    }
                                    className={`w-full h-[46px] border rounded-[10px] px-4 text-[14px] outline-none transition-all placeholder:text-gray-400 text-[#111827] bg-white ${
                                        formErrors.deviceName
                                            ? 'border-red-300 ring-1 ring-red-50'
                                            : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'
                                    }`}
                                />
                                {formErrors.deviceName && (
                                    <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                        *{formErrors.deviceName}
                                    </span>
                                )}
                            </div>

                            {/* 2. Machine / Station Code */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Machine / Station Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter station code (e.g. M01, M02, SCALE-01)"
                                    value={formData.stationId}
                                    onChange={(e) =>
                                        setFormData({ ...formData, stationId: e.target.value.toUpperCase() })
                                    }
                                    className={`w-full h-[46px] font-mono uppercase border rounded-[10px] px-4 text-[14px] outline-none transition-all placeholder:text-gray-400 text-[#111827] bg-white ${
                                        formErrors.stationId
                                            ? 'border-red-300 ring-1 ring-red-50'
                                            : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'
                                    }`}
                                />
                                {formErrors.stationId && (
                                    <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                        *{formErrors.stationId}
                                    </span>
                                )}
                            </div>

                            {/* 3. Plant Code (Optional) */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Plant Code (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter plant code (e.g. AB, PLANT-1)"
                                    maxLength={5}
                                    value={formData.plantCode}
                                    onChange={(e) =>
                                        setFormData({ ...formData, plantCode: e.target.value.toUpperCase() })
                                    }
                                    className="w-full h-[46px] font-mono uppercase border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all placeholder:text-gray-400 text-[#111827] bg-white"
                                />
                            </div>

                            {/* 4. Manufacturer / Brand */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Manufacturer / Brand <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.manufacturer}
                                        onChange={(e) =>
                                            setFormData({ ...formData, manufacturer: e.target.value })
                                        }
                                        className="w-full h-[46px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all appearance-none cursor-pointer font-medium text-[#111827]"
                                    >
                                        {DEFAULT_MANUFACTURERS.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown
                                        size={18}
                                        className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                    />
                                </div>
                            </div>

                            {/* 5. Model Number (Optional) */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Model Number (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter model number (e.g. DS-215, IND570)"
                                    value={formData.modelNumber}
                                    onChange={(e) =>
                                        setFormData({ ...formData, modelNumber: e.target.value })
                                    }
                                    className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all placeholder:text-gray-400 text-[#111827] bg-white"
                                />
                            </div>

                            {/* 6. Connection Interface */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Connection Interface <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.connectionType}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                connectionType: e.target.value,
                                                serialPort:
                                                    e.target.value === 'SIMULATOR'
                                                        ? 'VIRTUAL'
                                                        : formData.serialPort === 'VIRTUAL'
                                                        ? 'COM3'
                                                        : formData.serialPort,
                                                protocol:
                                                    e.target.value === 'SIMULATOR'
                                                        ? 'SIMULATOR'
                                                        : 'GENERIC_ASCII',
                                            })
                                        }
                                        className="w-full h-[46px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all appearance-none cursor-pointer font-medium text-[#111827]"
                                    >
                                        <option value="USB_SERIAL">USB / RS-232 Serial Port (Web Serial API)</option>
                                        <option value="SIMULATOR">Virtual Platform Scale Simulator</option>
                                        <option value="TCP_IP">Ethernet TCP/IP Socket</option>
                                        <option value="BLUETOOTH">Bluetooth Serial</option>
                                    </select>
                                    <ChevronDown
                                        size={18}
                                        className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                    />
                                </div>
                            </div>

                            {/* 7. Port Identifier */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Port Identifier <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter port (e.g. COM1, COM3, VIRTUAL)"
                                    value={formData.serialPort}
                                    onChange={(e) =>
                                        setFormData({ ...formData, serialPort: e.target.value })
                                    }
                                    className={`w-full h-[46px] font-mono border rounded-[10px] px-4 text-[14px] outline-none transition-all placeholder:text-gray-400 text-[#111827] bg-white ${
                                        formErrors.serialPort
                                            ? 'border-red-300 ring-1 ring-red-50'
                                            : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'
                                    }`}
                                />
                                {formErrors.serialPort && (
                                    <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                        *{formErrors.serialPort}
                                    </span>
                                )}
                            </div>

                            {/* 8. Baud Rate */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Baud Rate <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.baudRate}
                                        onChange={(e) =>
                                            setFormData({ ...formData, baudRate: Number(e.target.value) })
                                        }
                                        className="w-full h-[46px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all appearance-none cursor-pointer font-medium text-[#111827]"
                                    >
                                        {BAUD_RATES.map((rate) => (
                                            <option key={rate} value={rate}>
                                                {rate} bps
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown
                                        size={18}
                                        className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                    />
                                </div>
                            </div>

                            {/* 9. Communication Protocol */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Communication Protocol <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.protocol}
                                        onChange={(e) =>
                                            setFormData({ ...formData, protocol: e.target.value })
                                        }
                                        className="w-full h-[46px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all appearance-none cursor-pointer font-medium text-[#111827]"
                                    >
                                        {PROTOCOLS.map((p) => (
                                            <option key={p.value} value={p.value}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown
                                        size={18}
                                        className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                    />
                                </div>
                            </div>

                            {/* 10. Max Capacity */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Max Capacity <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Enter capacity (e.g. 150)"
                                    value={formData.maxCapacity}
                                    onChange={(e) =>
                                        setFormData({ ...formData, maxCapacity: e.target.value })
                                    }
                                    className={`w-full h-[46px] border rounded-[10px] px-4 text-[14px] outline-none transition-all placeholder:text-gray-400 text-[#111827] bg-white ${
                                        formErrors.maxCapacity
                                            ? 'border-red-300 ring-1 ring-red-50'
                                            : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'
                                    }`}
                                />
                                {formErrors.maxCapacity && (
                                    <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                        *{formErrors.maxCapacity}
                                    </span>
                                )}
                            </div>

                            {/* 11. Min Division */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Min Division (d) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    placeholder="Enter min division (e.g. 0.005)"
                                    value={formData.minDivision}
                                    onChange={(e) =>
                                        setFormData({ ...formData, minDivision: e.target.value })
                                    }
                                    className={`w-full h-[46px] border rounded-[10px] px-4 text-[14px] outline-none transition-all placeholder:text-gray-400 text-[#111827] bg-white ${
                                        formErrors.minDivision
                                            ? 'border-red-300 ring-1 ring-red-50'
                                            : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'
                                    }`}
                                />
                                {formErrors.minDivision && (
                                    <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                        *{formErrors.minDivision}
                                    </span>
                                )}
                            </div>

                            {/* 12. Weight Unit */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    Weight Unit <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        value={formData.defaultUnit}
                                        onChange={(e) =>
                                            setFormData({ ...formData, defaultUnit: e.target.value })
                                        }
                                        className="w-full h-[46px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all appearance-none cursor-pointer font-medium text-[#111827]"
                                    >
                                        <option value="kg">Kilograms (kg)</option>
                                        <option value="g">Grams (g)</option>
                                        <option value="lb">Pounds (lb)</option>
                                        <option value="ton">Metric Tons (ton)</option>
                                    </select>
                                    <ChevronDown
                                        size={18}
                                        className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bottom Actions - Matching GroupForm Footer */}
                        <div className="px-8 py-6 bg-[#F9FAFB]/50 flex items-center justify-end gap-3 border-t border-[#F3F4F6] -mx-8 -mb-8 md:-mx-10 md:-mb-10 rounded-b-[16px]">
                            <button
                                type="button"
                                onClick={() => setCurrentView('list')}
                                className="px-8 h-[46px] border border-[#E5E7EB] text-[#4B5563] font-bold rounded-[10px] hover:bg-white hover:text-[#111827] transition-all text-[14px] bg-white shadow-sm shadow-black/5"
                            >
                                {t('common:cancel', 'Cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-10 h-[46px] bg-[#073318] text-white font-bold rounded-[10px] hover:bg-[#04200f] transition-all text-[14px] disabled:opacity-50 shadow-md shadow-[#073318]/10 min-w-[140px] whitespace-nowrap flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                                ) : (
                                    <span>{isEditMode ? 'Update Machine' : 'Save Machine'}</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // ==========================================
    // VIEW 2: LIST VIEW (Matching AccountMaster List UI)
    // ==========================================
    return (
        <div className="flex flex-col font-['Plus_Jakarta_Sans'] w-full relative">
            {/* Desktop Header */}
            <div className="flex flex-col gap-1 mb-4 md:mb-8">
                <div className="flex flex-row items-center justify-between gap-4">
                    <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
                        {t('modules:machine_management', 'Machine Management')}
                    </h2>

                    <button
                        onClick={handleOpenAdd}
                        className="flex flex-row items-center justify-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[44px] rounded-[10px] text-[15px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0 whitespace-nowrap"
                    >
                        <Plus size={18} />
                        <span>Add Machine</span>
                    </button>
                </div>
            </div>

            {/* Content Container - Matching AccountMaster master-table-container */}
            <div className="master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8 rounded-[20px] overflow-hidden">
                {/* Desktop Action Bar */}
                <div className="flex items-center justify-between p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[20px]">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-[320px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder={t('common:search', 'Search machines...')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-[40px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Filter / Clear Toggle (Matching Purchase Order) */}
                        <button
                            onClick={() => {
                                if (hasActiveFilters) {
                                    handleResetFilters();
                                }
                            }}
                            className={`flex items-center gap-2 px-4 h-[40px] border rounded-[10px] text-[13px] font-bold transition-all shadow-sm ${
                                hasActiveFilters
                                    ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                    : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                            }`}
                        >
                            <Filter size={16} className={hasActiveFilters ? 'text-red-500' : 'text-gray-400'} />
                            <span>{hasActiveFilters ? t('common:clear', 'Clear') : t('common:filter', 'Filter')}</span>
                        </button>

                        <button
                            onClick={handleRefresh}
                            disabled={loading || refreshing}
                            className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-[8px] transition-colors border border-[#E5E7EB]"
                            title={t('common:refresh', 'Refresh')}
                        >
                            <RefreshCw size={18} className={loading || refreshing ? 'animate-spin text-[#073318]' : ''} />
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                {loading ? (
                    <div className="py-16 text-center flex flex-col items-center justify-center">
                        <RefreshCw size={28} className="animate-spin text-[#073318] mb-3" />
                        <p className="text-[14px] text-gray-600 font-medium">Loading machines registry...</p>
                    </div>
                ) : filteredDevices.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-2xl bg-[#073318]/5 flex items-center justify-center text-[#073318] mb-4">
                            <Cpu size={32} />
                        </div>
                        <h3 className="text-[18px] font-bold text-gray-900 mb-1">No Machines Found</h3>
                        <p className="text-[14px] text-gray-500 max-w-md mb-6 leading-relaxed">
                            No weighing machines or scales matched your search. Click "Add Machine" to register your weighing machine.
                        </p>
                        <button
                            onClick={handleOpenAdd}
                            className="inline-flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[42px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm"
                        >
                            <Plus size={18} />
                            <span>Add First Machine</span>
                        </button>
                    </div>
                ) : (
                    <div>
                        {(() => {
                            const machineColumns = [
                                { key: 'srNo', label: t('common:sr_no', 'SR NO'), noSearch: true, align: 'center', minWidth: '70px' },
                                { key: 'stationId', label: 'MACHINE CODE', placeholder: 'Machine', minWidth: '130px' },
                                { key: 'deviceName', label: 'DEVICE NAME', placeholder: 'Name', minWidth: '220px' },
                                { key: 'plantCode', label: 'PLANT CODE', placeholder: 'Plant', minWidth: '110px' },
                                { key: 'manufacturer', label: 'MAKE & MODEL', placeholder: 'Make/Model', minWidth: '180px' },
                                { key: 'serialPort', label: 'PORT & BAUD RATE', placeholder: 'Port', minWidth: '160px' },
                                { key: 'maxCapacity', label: 'CAPACITY / DIVISION', placeholder: 'Capacity', minWidth: '160px' },
                                { key: 'status', label: 'STATUS', placeholder: 'Status', minWidth: '120px' },
                                { key: 'actions', label: 'ACTIONS', noSearch: true, align: 'center', minWidth: '130px' },
                            ];

                            return (
                                <>
                                    <ScrollableTable>
                                        <table className="w-full min-w-[1300px] border-collapse text-left font-outfit">
                                            <thead>
                                                {/* Row 1: Green Header */}
                                                <tr className="bg-emerald-900 text-white font-bold text-[15px]">
                                                    {machineColumns.map((col) => (
                                                        <th
                                                            key={col.key}
                                                            className={`px-6 py-5 border-r border-white/10 whitespace-nowrap ${
                                                                col.align === 'center' ? 'text-center' : 'text-left'
                                                            }`}
                                                            style={{ minWidth: col.minWidth }}
                                                        >
                                                            {col.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                                {/* Row 2: Green Header Column Filter Inputs */}
                                                <tr className="bg-[#0b543f]">
                                                    {machineColumns.map((col, i) => (
                                                        <th key={i} className="px-2 py-2 border-r border-white/10 whitespace-nowrap align-middle">
                                                            {!col.noSearch && (
                                                                <input
                                                                    type="text"
                                                                    placeholder={`Search ${col.placeholder}...`}
                                                                    value={columnFilters[col.key] || ""}
                                                                    onChange={(e) => {
                                                                        setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }));
                                                                        setCurrentPage(1);
                                                                    }}
                                                                    className="w-full min-w-[85px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium font-outfit"
                                                                />
                                                            )}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className={`text-[14px] text-[#111827] ${loading || refreshing ? 'opacity-40' : 'opacity-100'}`}>
                                                {paginatedDevices.length > 0 ? (
                                                    paginatedDevices.map((dev, idx) => (
                                                        <tr
                                                            key={dev.id || idx}
                                                            className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all"
                                                        >
                                                            {/* 1. SR NO */}
                                                            <td className="px-6 py-5 text-center font-bold text-gray-500">
                                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                                            </td>

                                                            {/* 2. Machine Code */}
                                                            <td className="px-6 py-5 font-mono font-bold text-[#073318]">
                                                                {dev.stationId || dev.id}
                                                            </td>

                                                            {/* 3. Device Name */}
                                                            <td className="px-6 py-5 text-[14px] text-gray-900 font-medium">
                                                                <div className="flex items-center gap-2">
                                                                    {dev.connectionType === 'SIMULATOR' ? (
                                                                        <Radio size={16} className="text-amber-600 shrink-0" />
                                                                    ) : (
                                                                        <Scale size={16} className="text-[#073318] shrink-0" />
                                                                    )}
                                                                    <span>{dev.deviceName}</span>
                                                                </div>
                                                            </td>

                                                            {/* 4. Plant Code */}
                                                            <td className="px-6 py-5 font-mono font-semibold text-gray-700">
                                                                {dev.plantCode || 'AB'}
                                                            </td>

                                                            {/* 5. Make & Model */}
                                                            <td className="px-6 py-5 text-[13px] text-gray-800">
                                                                <span className="font-semibold">{dev.manufacturer}</span>
                                                                {dev.modelNumber && (
                                                                    <span className="text-gray-500 ml-1.5 font-mono text-xs">
                                                                        ({dev.modelNumber})
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* 6. Port & Baud */}
                                                            <td className="px-6 py-5 text-[12px] font-mono text-gray-600">
                                                                {dev.connectionType === 'SIMULATOR' ? (
                                                                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
                                                                        Virtual Sim
                                                                    </span>
                                                                ) : (
                                                                    <span>
                                                                        {dev.serialPort} @ {dev.baudRate} bps
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* 7. Capacity */}
                                                            <td className="px-6 py-5 font-mono text-[13px] text-gray-900 font-semibold whitespace-nowrap">
                                                                {dev.maxCapacity} {dev.defaultUnit || 'kg'}
                                                                <span className="text-gray-500 font-normal text-xs ml-1">
                                                                    (±{dev.minDivision} {dev.defaultUnit || 'kg'})
                                                                </span>
                                                            </td>

                                                            {/* 8. Status */}
                                                            <td className="px-6 py-5 whitespace-nowrap">
                                                                {dev.isOnline ? (
                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                        Online
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                                        Offline
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* 9. Actions */}
                                                            <td className="px-6 py-5 text-center whitespace-nowrap">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        onClick={() => handleStartTest(dev)}
                                                                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all"
                                                                        title="Test Live Connection"
                                                                    >
                                                                        <Zap size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleOpenEdit(dev)}
                                                                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                                                                        title="Edit Machine Details"
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteDevice(dev.id, dev.deviceName)}
                                                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                                                        title="Delete Machine"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="9" className="px-6 py-24 text-center text-gray-400 uppercase font-bold tracking-widest font-outfit">
                                                            {t('common:no_results_found', 'No Records Found')}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </ScrollableTable>

                                    {/* Pagination (Matching Purchase Order) */}
                                    <div className="px-8 py-5 border-t border-[#F3F4F6] bg-[#F9FAFB] flex flex-row items-center justify-between uppercase font-outfit">
                                        <div className="flex items-center gap-2 text-[14px] font-bold text-[#6B7280]">
                                            <span>{t('common:show', 'Show')}</span>
                                            <CustomSelect
                                                value={itemsPerPage}
                                                onChange={(val) => {
                                                    setItemsPerPage(Number(val));
                                                    setCurrentPage(1);
                                                }}
                                                options={[5, 10, 20, 50]}
                                                menuPlacement="top"
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[#6B7280] text-[14px] font-bold lowercase">
                                                {filteredDevices.length > 0
                                                    ? `${((currentPage - 1) * itemsPerPage) + 1}–${Math.min(currentPage * itemsPerPage, filteredDevices.length)} of ${filteredDevices.length}`
                                                    : '0-0 of 0'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    disabled={currentPage === 1}
                                                    onClick={() => handlePageChange(1)}
                                                    title="First Page"
                                                    className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all text-[#4B5563]"
                                                >
                                                    <ChevronsLeft size={18} />
                                                </button>
                                                <button
                                                    disabled={currentPage === 1}
                                                    onClick={() => handlePageChange(currentPage - 1)}
                                                    title="Previous Page"
                                                    className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all text-[#4B5563]"
                                                >
                                                    <ArrowLeft size={18} />
                                                </button>
                                                <button
                                                    disabled={currentPage === totalPages || totalPages === 0}
                                                    onClick={() => handlePageChange(currentPage + 1)}
                                                    title="Next Page"
                                                    className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all text-[#4B5563]"
                                                >
                                                    <ArrowRight size={18} />
                                                </button>
                                                <button
                                                    disabled={currentPage === totalPages || totalPages === 0}
                                                    onClick={() => handlePageChange(totalPages)}
                                                    title="Last Page"
                                                    className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all text-[#4B5563]"
                                                >
                                                    <ChevronsRight size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* LIVE TEST MODAL */}
            {testingDevice && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-[#0f172a] text-white rounded-[20px] max-w-lg w-full shadow-2xl overflow-hidden border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <Zap size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Live Scale Connection Test</h3>
                                    <p className="text-xs text-slate-400">
                                        {testingDevice.deviceName} ({testingDevice.serialPort} @ {testingDevice.baudRate} bps)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleStopTest}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 flex flex-col items-center">
                            <div className="w-full bg-[#020617] border border-slate-800 rounded-[16px] p-6 text-center shadow-inner relative overflow-hidden">
                                <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">
                                    <span className="flex items-center gap-1.5">
                                        <span
                                            className={`w-2 h-2 rounded-full ${
                                                testWeight?.isStable ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                                            }`}
                                        />
                                        {testWeight?.isStable ? 'STABLE' : 'STABILIZING...'}
                                    </span>
                                    <span>NET READOUT</span>
                                </div>

                                <div className="font-mono text-[46px] font-black tracking-tight text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                                    {testWeight ? testWeight.netWeight?.toFixed(3) : '0.000'}
                                    <span className="text-lg font-bold ml-2 text-slate-400">
                                        {testingDevice.defaultUnit || 'kg'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400">
                                    <div>
                                        GROSS: <span className="text-white font-bold">{testWeight ? testWeight.grossWeight?.toFixed(3) : '0.000'}</span>
                                    </div>
                                    <div>
                                        TARE: <span className="text-white font-bold">{testWeight ? testWeight.tareWeight?.toFixed(3) : '0.000'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full mt-4 bg-slate-900/80 rounded-[12px] p-3 text-[11px] font-mono text-slate-300 border border-slate-800 h-28 overflow-y-auto space-y-1">
                                {testLogs.map((log, idx) => (
                                    <div key={idx} className="truncate">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between">
                            <span className="text-xs text-slate-400">Web Serial API Active</span>
                            <button
                                onClick={handleStopTest}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-[8px] text-xs font-bold transition-all"
                            >
                                Close Test
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MachineManagement;
