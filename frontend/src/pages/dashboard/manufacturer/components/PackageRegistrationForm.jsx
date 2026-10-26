import React, { useState, useEffect, useRef } from 'react';
import {
    ArrowLeft,
    X,
    ChevronDown,
    Printer,
    RefreshCw,
    Scale,
    Cpu,
    Usb,
    CheckCircle2,
    Lock,
    Unlock,
    RotateCcw,
    Sliders,
    Search,
    Zap,
    Radio,
    AlertTriangle,
    Activity,
    Edit3,
    Download,
    Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
    createPackage,
    previewLabelsPdf,
    getWeighingDevices,
} from '../../../../services/manufacturerService';
import { weighingService } from '../../../../services/hardware/weighing/weighingService';
import { ConnectionStatus } from '../../../../services/hardware/weighing/WeighingDeviceTypes';

const PackageRegistrationForm = ({
    products = [],
    loadingProducts = false,
    onBack,
    onSuccess,
}) => {
    const { t } = useTranslation(['modules', 'common']);

    // Form inputs
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [productSearch, setProductSearch] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const productDropdownRef = useRef(null);

    // Selected machine & station state
    const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem('gmark_selected_device_id') || '');
    const [machineId, setMachineId] = useState('M01');
    const [plantCode, setPlantCode] = useState('AB');
    const [labelSize, setLabelSize] = useState(() => localStorage.getItem('gmark_selected_label_size') || '150x100');
    const [isCustomLabelSize, setIsCustomLabelSize] = useState(() => {
        const saved = localStorage.getItem('gmark_selected_label_size');
        const presets = ['150x100', '200x100', '250x100', '100x50', '75x50'];
        return saved ? !presets.includes(saved) : false;
    });
    const [customLabelSizeText, setCustomLabelSizeText] = useState(() => {
        const saved = localStorage.getItem('gmark_selected_label_size');
        const presets = ['150x100', '200x100', '250x100', '100x50', '75x50'];
        return saved && !presets.includes(saved) ? saved : '';
    });
    const [netWeight, setNetWeight] = useState('');
    const [weightUnit, setWeightUnit] = useState('kg');
    const [weightSource, setWeightSource] = useState('MANUAL_ENTRY'); // 'HARDWARE_SCALE' | 'SCALE_SIMULATOR' | 'MANUAL_ENTRY'

    // Weighing devices from Machine Management
    const [devices, setDevices] = useState([]);

    // Live Scale connection states
    const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.DISCONNECTED);
    const [activeMode, setActiveMode] = useState('NONE');
    const [currentReading, setCurrentReading] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isWeightLocked, setIsWeightLocked] = useState(false);
    const [showScaleTerminal, setShowScaleTerminal] = useState(true);

    // Auto-Weigh & Label Printing States
    const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(() => {
        const saved = localStorage.getItem('gmark_auto_weigh_print');
        return saved !== null ? saved === 'true' : false;
    });
    const [autoPrintStatus, setAutoPrintStatus] = useState('STANDBY'); // 'STANDBY' | 'READY' | 'STABILIZING' | 'REGISTERING' | 'WAITING_FOR_REMOVAL'
    const [lastRegisteredSerial, setLastRegisteredSerial] = useState(null);
    const [lastRegisteredPdfBase64, setLastRegisteredPdfBase64] = useState(null);
    const stableCounterRef = useRef(0);
    const isAutoSubmittingRef = useRef(false);

    // Form submission & preview states
    const [errors, setErrors] = useState({});
    const [submittingPackage, setSubmittingPackage] = useState(false);
    const [generatingPreview, setGeneratingPreview] = useState(false);

    // Simulator presets
    const simulatorPresets = [5.0, 10.0, 25.0, 50.0];

    // Fetch registered weighing machines & link selected device
    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const res = await getWeighingDevices();
                const list = Array.isArray(res) ? res : res?.data || [];
                setDevices(list);

                if (list.length > 0) {
                    const savedId = localStorage.getItem('gmark_selected_device_id');
                    const matched = list.find((d) => d.id === savedId) || list[0];
                    setSelectedDeviceId(matched.id);
                    const cleanStation = (matched.stationId || matched.station_id || '').trim();
                    setMachineId(cleanStation && !cleanStation.includes('()') && cleanStation !== '—' ? cleanStation : 'M01');
                    if (matched.plantCode || matched.plant_code) {
                        setPlantCode(matched.plantCode || matched.plant_code);
                    }
                    if (matched.defaultUnit || matched.default_unit) {
                        setWeightUnit((matched.defaultUnit || matched.default_unit).toLowerCase());
                    }
                }
            } catch (err) {
                console.error('Failed to fetch devices', err);
            }
        };
        fetchDevices();
    }, []);

    // Derive active device record
    const activeDevice = devices.find((d) => d.id === selectedDeviceId || (d.stationId && d.stationId === machineId)) || devices[0];

    // Handle switching between registered machines
    const handleMachineChange = (devId) => {
        setSelectedDeviceId(devId);
        localStorage.setItem('gmark_selected_device_id', devId);
        const dev = devices.find((d) => d.id === devId);
        if (dev) {
            const cleanStation = (dev.stationId || dev.station_id || '').trim();
            setMachineId(cleanStation && !cleanStation.includes('()') && cleanStation !== '—' ? cleanStation : 'M01');
            if (dev.plantCode || dev.plant_code) {
                setPlantCode(dev.plantCode || dev.plant_code);
            }
            if (dev.defaultUnit || dev.default_unit) {
                setWeightUnit((dev.defaultUnit || dev.default_unit).toLowerCase());
            }
        }
        if (errors.machine_id) {
            setErrors((prev) => ({ ...prev, machine_id: '' }));
        }
    };

    // Subscribe to live scale hardware stream
    useEffect(() => {
        const unsubReading = weighingService.onReading((reading) => {
            setCurrentReading(reading);
        });

        const unsubStatus = weighingService.onStatusChange((status, mode) => {
            setConnectionStatus(status);
            setActiveMode(mode);
        });

        return () => {
            unsubReading();
            unsubStatus();
        };
    }, []);

    // Close product dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
                setIsProductDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter products by search
    const filteredProducts = products.filter((p) => {
        const name = (p.name || p.product_name || '').toLowerCase();
        const code = (p.product_code || p.sku || '').toLowerCase();
        const q = productSearch.toLowerCase().trim();
        return name.includes(q) || code.includes(q);
    });

    // Audio chime upon successful package registration
    const playSuccessChime = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (_) {}
    };

    // Direct thermal print trigger via hidden iframe with memory cleanup and PDFium timeout safety
    const triggerThermalPrint = (base64Pdf) => {
        if (!base64Pdf) return;
        try {
            const byteCharacters = atob(base64Pdf);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);

            // Clean up any previously created print iframe to prevent memory/DOM leaks
            const oldFrame = document.getElementById('gmark-thermal-print-frame');
            if (oldFrame) {
                try {
                    oldFrame.remove();
                } catch (_) {}
            }

            const printFrame = document.createElement('iframe');
            printFrame.id = 'gmark-thermal-print-frame';
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            printFrame.style.visibility = 'hidden';
            printFrame.src = blobUrl;
            document.body.appendChild(printFrame);

            let hasPrinted = false;
            const executePrint = () => {
                if (hasPrinted) return;
                hasPrinted = true;
                try {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.print();
                    // Schedule cleanup of the blob URL after 30 seconds
                    setTimeout(() => {
                        URL.revokeObjectURL(blobUrl);
                    }, 30000);
                } catch (e) {
                    console.warn('Iframe print failed, opening in new tab:', e);
                    window.open(blobUrl, '_blank');
                }
            };

            printFrame.onload = () => {
                // Short 200ms delay ensures Chromium PDFium plugin has initialized
                setTimeout(executePrint, 200);
            };

            // Safety fallback timeout in case onload event is suppressed by browser PDF viewer
            setTimeout(() => {
                if (!hasPrinted && document.getElementById('gmark-thermal-print-frame')) {
                    executePrint();
                }
            }, 1200);
        } catch (err) {
            console.error('Failed to trigger thermal print dialog:', err);
            toast.error('Failed to trigger thermal printer');
        }
    };

    // Scale Controls
    const handleConnectSerial = async () => {
        if (!weighingService.isWebSerialSupported()) {
            toast.error('Web Serial requires Google Chrome or Microsoft Edge. Starting simulator instead.');
            handleConnectSimulator();
            return;
        }

        setIsConnecting(true);
        try {
            const baud = activeDevice?.baudRate ? Number(activeDevice.baudRate) : 9600;
            await weighingService.connectSerial({ baudRate: baud });
            toast.success(`Connected to scale via serial port (${baud} baud)`);
            setIsWeightLocked(false);
        } catch (err) {
            if (err.name !== 'NotFoundError') {
                console.error('Serial connect error:', err);
                toast.error(`Failed to open serial port: ${err.message || 'Check COM cable'}`);
            }
        } finally {
            setIsConnecting(false);
        }
    };

    const handleConnectSimulator = async (initialWeight = 25.5) => {
        setIsConnecting(true);
        try {
            await weighingService.connectSimulator(initialWeight);
            toast.success('Connected to Virtual Scale Simulator');
            setIsWeightLocked(false);
        } catch (err) {
            console.error('Simulator error:', err);
            toast.error('Failed to start scale simulator.');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        await weighingService.disconnect();
        setCurrentReading(null);
        toast('Scale disconnected', { icon: '⚪' });
    };

    const handleTare = async () => {
        await weighingService.tare();
        toast('Scale tared to 0.000 KG', { icon: '⚖️' });
    };

    const handleZero = async () => {
        await weighingService.zero();
        toast('Scale zeroed', { icon: '0️⃣' });
    };

    const handleCaptureWeight = () => {
        if (!currentReading) {
            toast.error('No live weight reading available.');
            return;
        }
        if (!currentReading.isStable) {
            toast.error('Scale reading is not stable yet. Wait for stability indicator.');
            return;
        }
        const net = currentReading.netWeight;
        if (net <= 0) {
            toast.error('Cannot capture zero or negative weight.');
            return;
        }

        const formatted = Number(net).toFixed(3);
        setNetWeight(formatted);
        setWeightUnit((currentReading.unit || 'kg').toLowerCase());
        setWeightSource(activeMode === 'SIMULATOR' ? 'SCALE_SIMULATOR' : 'HARDWARE_SCALE');
        setIsWeightLocked(true);
        if (errors.net_weight) {
            setErrors((prev) => ({ ...prev, net_weight: '' }));
        }
        toast.success(`Weight captured: ${formatted} ${currentReading.unit || 'KG'}`);
    };

    const handleUnlockWeight = () => {
        setIsWeightLocked(false);
        toast('Weight reading unlocked for recapture', { icon: '🔓' });
    };

    // Sequential code 128 preview
    const cleanDisplayMachine = (machineId && !machineId.includes('()') && machineId !== '—' && machineId !== '-') ? machineId.trim().toUpperCase() : 'M01';
    const sampleFullSerial = `${(plantCode || 'AB').trim().toUpperCase()}-${cleanDisplayMachine}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`;

    // Preview Label PDF
    const handleGeneratePreview = async () => {
        if (!selectedProduct) {
            toast.error('Please select a product first');
            setErrors((prev) => ({ ...prev, product_id: 'Product selection is required' }));
            return;
        }
        const numWeight = parseFloat(netWeight);
        if (isNaN(numWeight) || numWeight <= 0) {
            toast.error('Please enter or capture a valid positive weight');
            setErrors((prev) => ({ ...prev, net_weight: 'Valid weight is required' }));
            return;
        }

        setGeneratingPreview(true);
        try {
            const previewDto = {
                productId: Number(selectedProduct.id),
                packages: [
                    {
                        netWeight: numWeight,
                        plantCode: (plantCode || 'AB').trim().toUpperCase(),
                        machineId: cleanDisplayMachine,
                    },
                ],
                labelFormat: labelSize || '150x100',
            };

            const pdfBlob = await previewLabelsPdf(previewDto);
            const blobUrl = URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');
            toast.success('Label preview generated successfully');
        } catch (err) {
            console.error('Failed to generate label preview:', err);
            toast.error(err?.response?.data?.message || 'Failed to generate preview label');
        } finally {
            setGeneratingPreview(false);
        }
    };

    // Download Label PDF for direct software inspection without a printer
    const handleDownloadPreviewPdf = async () => {
        if (!selectedProduct) {
            toast.error('Please select a product first');
            setErrors((prev) => ({ ...prev, product_id: 'Product selection is required' }));
            return;
        }
        const numWeight = parseFloat(netWeight);
        if (isNaN(numWeight) || numWeight <= 0) {
            toast.error('Please enter or capture a valid positive weight');
            setErrors((prev) => ({ ...prev, net_weight: 'Valid weight is required' }));
            return;
        }

        setGeneratingPreview(true);
        try {
            const previewDto = {
                productId: Number(selectedProduct.id),
                packages: [
                    {
                        netWeight: numWeight,
                        plantCode: (plantCode || 'AB').trim().toUpperCase(),
                        machineId: cleanDisplayMachine,
                    },
                ],
                labelFormat: labelSize || '150x100',
            };

            const pdfBlob = await previewLabelsPdf(previewDto);
            const downloadUrl = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `label_preview_${(labelSize || '150x100').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
            toast.success('Label PDF downloaded for software inspection');
        } catch (err) {
            console.error('Failed to download label preview:', err);
            toast.error(err?.response?.data?.message || 'Failed to download preview label');
        } finally {
            setGeneratingPreview(false);
        }
    };

    // Download registered package label PDF
    const handleDownloadRegisteredPdf = () => {
        if (!lastRegisteredPdfBase64) return;
        try {
            const byteCharacters = atob(lastRegisteredPdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `package_${lastRegisteredSerial || 'label'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
            toast.success(`Downloaded label PDF for ${lastRegisteredSerial}`);
        } catch (err) {
            console.error('Failed to download registered PDF:', err);
            toast.error('Failed to download PDF');
        }
    };

    // Core Package Registration Function (shared by manual Save and Auto-Weigh engine)
    const executePackageRegistration = async (customWeight = null, isAuto = false) => {
        const numWeight = customWeight !== null ? parseFloat(customWeight) : parseFloat(netWeight);
        if (isNaN(numWeight) || numWeight <= 0) {
            if (!isAuto) toast.error('Valid net weight greater than 0 is required');
            return null;
        }
        if (!selectedProduct) {
            if (!isAuto) toast.error('Product is required');
            return null;
        }

        const effectivePlant = (plantCode || 'AB').trim().toUpperCase();
        const effectiveMachine = cleanDisplayMachine;

        const payload = {
            productId: Number(selectedProduct.id),
            netWeight: numWeight,
            grossWeight: currentReading?.grossWeight != null ? parseFloat(currentReading.grossWeight) : numWeight,
            tareWeight: currentReading?.tareWeight != null ? parseFloat(currentReading.tareWeight) : 0,
            weightUnit: (weightUnit || 'kg').toLowerCase(),
            weightSource: activeMode === 'SIMULATOR' ? 'SCALE_SIMULATOR' : (connectionStatus === ConnectionStatus.CONNECTED ? 'HARDWARE_SCALE' : 'MANUAL_ENTRY'),
            plantCode: effectivePlant,
            machineId: effectiveMachine,
            labelSize: labelSize || '150x100',
            rawPayload: currentReading?.rawPayload || undefined,
        };

        const result = await createPackage(payload);
        playSuccessChime();

        if (result.labelPdfBase64) {
            setLastRegisteredPdfBase64(result.labelPdfBase64);
            triggerThermalPrint(result.labelPdfBase64);
        }

        return result;
    };

    // Manual Save & Register Package
    const handleSave = async (e) => {
        if (e) e.preventDefault();

        const newErrors = {};
        if (!selectedProduct) {
            newErrors.product_id = 'Product is required';
        }
        if (!plantCode.trim()) {
            newErrors.plant_code = 'Plant code is required';
        }
        if (!machineId.trim() || machineId.includes('()')) {
            newErrors.machine_id = 'Machine station is required';
        }
        const numWeight = parseFloat(netWeight);
        if (isNaN(numWeight) || numWeight <= 0) {
            newErrors.net_weight = 'Valid net weight greater than 0 is required';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Please resolve the highlighted form errors');
            return;
        }

        setSubmittingPackage(true);
        setErrors({});

        try {
            const result = await executePackageRegistration(numWeight, false);
            if (result?.package) {
                toast.success(`Package Registered! Serial: ${result.package.serial_number}`);
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Failed to register package:', err);
            const msg = err?.response?.data?.message || 'Failed to register package';
            setErrors({ general: msg });
            toast.error(msg);
        } finally {
            setSubmittingPackage(false);
        }
    };

    // Automatic Weighing & Thermal Label Printing Engine
    useEffect(() => {
        const isConnected = connectionStatus === ConnectionStatus.CONNECTED;

        if (!isAutoPrintEnabled || !isConnected || !selectedProduct) {
            if (autoPrintStatus !== 'STANDBY') {
                setAutoPrintStatus('STANDBY');
            }
            return;
        }

        const reading = currentReading;
        if (!reading) return;

        const currentNet = Number(reading.netWeight || 0);

        // Anti-duplicate gate: wait until scale is cleared (< 0.020 kg)
        if (autoPrintStatus === 'WAITING_FOR_REMOVAL') {
            if (currentNet < 0.020) {
                setAutoPrintStatus('READY');
                setIsWeightLocked(false);
                setNetWeight('');
                stableCounterRef.current = 0;
            }
            return;
        }

        // Ready state: Waiting for package placement on platform
        if (autoPrintStatus === 'READY' || autoPrintStatus === 'STANDBY') {
            if (currentNet >= 0.050) {
                setAutoPrintStatus('STABILIZING');
                stableCounterRef.current = 0;
            }
            return;
        }

        // Stabilizing state: Checking stability
        if (autoPrintStatus === 'STABILIZING') {
            if (currentNet < 0.050) {
                setAutoPrintStatus('READY');
                stableCounterRef.current = 0;
                return;
            }

            if (reading.isStable && !reading.isOverload) {
                stableCounterRef.current += 1;
                // Once stable for 3 consecutive checks (~600-800ms)
                if (stableCounterRef.current >= 3 && !isAutoSubmittingRef.current) {
                    isAutoSubmittingRef.current = true;
                    setAutoPrintStatus('REGISTERING');
                    setIsWeightLocked(true);
                    setNetWeight(currentNet.toFixed(3));

                    executePackageRegistration(currentNet, true)
                        .then((res) => {
                            if (res?.package) {
                                setLastRegisteredSerial(res.package.serial_number);
                                toast.success(
                                    `⚡ Auto-Registered Package: ${res.package.serial_number} (${currentNet.toFixed(2)} ${weightUnit.toUpperCase()})! Remove package to weigh next.`,
                                    { duration: 4000 }
                                );
                                setAutoPrintStatus('WAITING_FOR_REMOVAL');
                            } else {
                                setAutoPrintStatus('READY');
                                setIsWeightLocked(false);
                            }
                        })
                        .catch((err) => {
                            console.error('Auto-registration error:', err);
                            toast.error(err?.response?.data?.message || 'Auto-registration failed');
                            setAutoPrintStatus('READY');
                            setIsWeightLocked(false);
                        })
                        .finally(() => {
                            isAutoSubmittingRef.current = false;
                        });
                }
            } else {
                stableCounterRef.current = 0;
            }
        }
    }, [currentReading, isAutoPrintEnabled, connectionStatus, selectedProduct, autoPrintStatus, weightUnit]);

    const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
    const isStable = currentReading?.isStable || false;
    const liveNet = currentReading?.netWeight || 0;
    const liveGross = currentReading?.grossWeight || liveNet;
    const liveTare = currentReading?.tareWeight || 0;

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300 p-2 font-['Plus_Jakarta_Sans']">
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col w-full mb-12 transform-gpu overflow-hidden">
                {/* Header - Exactly Matching GroupForm */}
                <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                            {t('modules:weigh_and_register', 'Weigh & Register Package')}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="group flex items-center justify-center w-10 h-10 md:w-auto md:h-[44px] md:px-6 border border-[#E5E7EB] text-[#4B5563] rounded-[12px] md:rounded-[10px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm active:scale-95"
                        title={t('common:back', 'Back')}
                    >
                        <X size={22} className="md:hidden text-gray-500" />
                        <ArrowLeft size={18} className="hidden md:block" />
                        <span className="hidden md:inline ml-2">{t('common:back', 'Back')}</span>
                    </button>
                </div>

                {/* Form Body - Exactly Matching GroupForm Spacing */}
                <form onSubmit={handleSave} className="p-8 md:p-10 flex flex-col gap-8 w-full">
                    {errors.general && (
                        <div className="p-4 bg-red-50 text-red-600 text-[14px] rounded-[10px] border border-red-100 font-medium">
                            {errors.general}
                        </div>
                    )}

                    {/* Row 1: Product Selection (Full Width with Searchable Dropdown) */}
                    <div className="flex flex-col gap-2 relative" ref={productDropdownRef}>
                        <label className="text-[14px] font-bold text-[#374151]">
                            {t('modules:product', 'Product Name')} <span className="text-red-500">*</span>
                        </label>
                        <div
                            onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                            className={`w-full h-[46px] border ${
                                isProductDropdownOpen
                                    ? 'border-[#073318] ring-1 ring-[#073318]/10'
                                    : 'border-[#E5E7EB] hover:border-gray-300'
                            } ${
                                errors.product_id ? 'border-red-300 ring-1 ring-red-50' : ''
                            } rounded-[10px] px-4 flex items-center justify-between cursor-pointer transition-all bg-white`}
                        >
                            <div className="flex items-center flex-1 overflow-hidden">
                                {isProductDropdownOpen ? (
                                    <input
                                        type="text"
                                        autoFocus
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder={
                                            selectedProduct
                                                ? `${selectedProduct.name || selectedProduct.product_name} (${selectedProduct.product_code || ''})`
                                                : 'Search product by name or code...'
                                        }
                                        className="w-full h-full bg-transparent outline-none text-[14px] text-[#111827] placeholder:text-gray-400 font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="flex items-center overflow-hidden">
                                        {selectedProduct ? (
                                            <span className="text-[14px] truncate font-medium text-[#111827]">
                                                {selectedProduct.name || selectedProduct.product_name}{' '}
                                                <span className="text-gray-400 text-[13px] font-mono">
                                                    ({selectedProduct.product_code || selectedProduct.sku || 'No Code'})
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-[14px] text-gray-400 font-medium">
                                                {loadingProducts ? 'Loading active products...' : 'Select Product'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <ChevronDown size={18} className="text-gray-400 shrink-0 ml-2" />
                        </div>
                        {errors.product_id && (
                            <span className="text-red-500 text-[11px] mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200 font-medium">
                                *{errors.product_id}
                            </span>
                        )}

                        {/* Dropdown Options */}
                        {isProductDropdownOpen && (
                            <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="max-h-[260px] overflow-y-auto py-2 px-1">
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map((prod) => (
                                            <div
                                                key={prod.id}
                                                onClick={() => {
                                                    setSelectedProduct(prod);
                                                    setIsProductDropdownOpen(false);
                                                    setProductSearch('');
                                                    if (errors.product_id) {
                                                        setErrors((prev) => ({ ...prev, product_id: '' }));
                                                    }
                                                }}
                                                className={`px-4 py-3 rounded-[8px] hover:bg-gray-50 cursor-pointer text-[14px] transition-all mb-0.5 flex items-center justify-between ${
                                                    selectedProduct?.id === prod.id
                                                        ? 'bg-[#F9FAFB] text-[#073318] font-bold'
                                                        : 'text-[#4B5563] font-medium'
                                                }`}
                                            >
                                                <span className="truncate">
                                                    {prod.name || prod.product_name}
                                                </span>
                                                <span className="text-[12px] font-mono text-gray-400 ml-3 shrink-0">
                                                    #{prod.product_code || prod.sku || 'N/A'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-6 text-[14px] text-gray-500 text-center font-medium">
                                            No products found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Row 2: Weighing Machine Station (Full Width Dropdown) */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[14px] font-bold text-[#374151]">
                                {t('modules:weighing_machine', 'Weighing Machine')} <span className="text-red-500">*</span>
                            </label>
                            {activeDevice && (
                                <span className="text-[12px] text-gray-500 font-mono">
                                    {activeDevice.stationId && !activeDevice.stationId.includes('()') && activeDevice.stationId !== '—'
                                        ? `Assigned: ${activeDevice.stationId}`
                                        : 'Machine ID not configured'} • {activeDevice.connectionType || 'SERIAL'}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <select
                                value={selectedDeviceId || (activeDevice ? activeDevice.id : '')}
                                onChange={(e) => handleMachineChange(e.target.value)}
                                className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 pr-10 outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all text-[14px] text-[#111827] bg-white appearance-none cursor-pointer font-medium"
                            >
                                {devices.length > 0 ? (
                                    devices.map((d) => {
                                        const hasStationId = Boolean(d.stationId && !d.stationId.includes('()') && d.stationId !== '—' && d.stationId !== '-');
                                        const stId = hasStationId ? d.stationId.trim() : null;
                                        const devName = d.deviceName || d.device_name || 'Packaging Scale';
                                        const port = d.serialPort || d.serial_port || d.connectionType || d.connection_type || 'COM';
                                        const baud = d.baudRate || d.baud_rate ? `@ ${d.baudRate || d.baud_rate} baud` : '';
                                        const labelText = stId
                                            ? `${stId} - ${devName} (${port} ${baud})`
                                            : `[Machine ID not configured] - ${devName} (${port} ${baud})`;
                                        return (
                                            <option key={d.id} value={d.id}>
                                                {labelText}
                                            </option>
                                        );
                                    })
                                ) : (
                                    <>
                                        <option value="SCALE-01">M01 - Packaging Bench Scale #1 (COM3 @ 9600 baud)</option>
                                        <option value="SIMULATOR-01">M02 - Virtual Platform Scale Simulator (Virtual)</option>
                                        <option value="SCALE-03">M03 - Heavy Platform Scale #2 (COM4 @ 9600 baud)</option>
                                    </>
                                )}
                            </select>
                            <ChevronDown
                                size={18}
                                className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                        </div>
                        {errors.machine_id && (
                            <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                *{errors.machine_id}
                            </span>
                        )}
                    </div>

                    {/* Row 3: Plant Code & Thermal Label Format (2-Column Grid matching Opening Balance & Balance Type) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                        {/* Plant Code */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[14px] font-bold text-[#374151]">
                                {t('modules:plant_code', 'Plant Code')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={plantCode}
                                onChange={(e) => {
                                    setPlantCode(e.target.value.toUpperCase());
                                    if (errors.plant_code) {
                                        setErrors((prev) => ({ ...prev, plant_code: '' }));
                                    }
                                }}
                                placeholder="Enter plant code (e.g. AB)"
                                maxLength={5}
                                className={`w-full h-[46px] border rounded-[10px] px-4 font-mono uppercase outline-none transition-all placeholder:text-gray-400 text-[14px] text-[#111827] bg-white ${
                                    errors.plant_code
                                        ? 'border-red-300 ring-1 ring-red-50'
                                        : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'
                                }`}
                            />
                            {errors.plant_code && (
                                <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                    *{errors.plant_code}
                                </span>
                            )}
                        </div>

                        {/* Thermal Label Format with Writing / Custom Option */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[14px] font-bold text-[#374151]">
                                    {t('modules:label_size', 'Label Size')} <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isCustomLabelSize) {
                                            setIsCustomLabelSize(true);
                                            if (!customLabelSizeText) {
                                                setCustomLabelSizeText(labelSize && labelSize !== '__CUSTOM__' ? labelSize : '150x100');
                                            }
                                        } else {
                                            setIsCustomLabelSize(false);
                                            setLabelSize('150x100');
                                        }
                                    }}
                                    className="text-[12px] font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <Edit3 size={12} />
                                    <span>{isCustomLabelSize ? 'Select from Presets' : 'Write Custom Size'}</span>
                                </button>
                            </div>

                            {isCustomLabelSize ? (
                                <div className="flex flex-col gap-1.5">
                                    <div className="relative flex items-center">
                                        <input
                                            type="text"
                                            value={customLabelSizeText}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCustomLabelSizeText(val);
                                                setLabelSize(val);
                                                if (val) localStorage.setItem('gmark_selected_label_size', val);
                                            }}
                                            placeholder="Enter size (e.g. 120x80 mm, 100x75, 4x6 in)"
                                            className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 pr-20 outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all text-[14px] text-[#111827] bg-white font-medium"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsCustomLabelSize(false);
                                                setLabelSize('150x100');
                                                localStorage.setItem('gmark_selected_label_size', '150x100');
                                            }}
                                            className="absolute right-2 px-2.5 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                        >
                                            Presets
                                        </button>
                                    </div>
                                    <span className="text-[11px] text-gray-400">
                                        Write any required dimensions in mm or inches (e.g. 120x80 mm, 100x75, 250x100, 4x6 in)
                                    </span>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={labelSize}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '__CUSTOM__') {
                                                setIsCustomLabelSize(true);
                                                if (!customLabelSizeText) {
                                                    setCustomLabelSizeText('150x100');
                                                    localStorage.setItem('gmark_selected_label_size', '150x100');
                                                }
                                            } else {
                                                setLabelSize(val);
                                                localStorage.setItem('gmark_selected_label_size', val);
                                            }
                                        }}
                                        className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 pr-10 outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all text-[14px] text-[#111827] bg-white appearance-none cursor-pointer font-medium"
                                    >
                                        <option value="150x100">150 × 100 mm (Single Code 128 Bulk Label — 6 × 4 in)</option>
                                        <option value="200x100">200 × 100 mm (Single Code 128 Extended Pallet Label — 8 × 4 in)</option>
                                        <option value="250x100">250 × 100 mm (Single Code 128 Ultra-Wide Pallet Label — 10 × 4 in)</option>
                                        <option value="100x50">100 × 50 mm (Industrial Standard Label — 4 × 2 in)</option>
                                        <option value="75x50">75 × 50 mm (Compact Bag / Drum Label — 3 × 2 in)</option>
                                        <option value="__CUSTOM__">✏️ Custom / Write Custom Size...</option>
                                    </select>
                                    <ChevronDown
                                        size={18}
                                        className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                    />
                                </div>
                            )}
                            <div className="text-[11px] text-gray-500 leading-snug">
                                <span className="font-semibold text-emerald-900">Printer Tip:</span> In Windows <em>Printers &amp; Scanners &gt; Printing Preferences</em>, set the thermal printer stock to match this size ({labelSize}). For zero-touch silent printing, run Chrome with <code>--kiosk-printing</code>.
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Net Weight & Weight Unit (2-Column Grid matching Opening Balance & Balance Type) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                        {/* Net Weight */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[14px] font-bold text-[#374151]">
                                {t('modules:net_weight', 'Net Weight')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={netWeight}
                                onChange={(e) => {
                                    setNetWeight(e.target.value);
                                    if (errors.net_weight) {
                                        setErrors((prev) => ({ ...prev, net_weight: '' }));
                                    }
                                }}
                                placeholder="Enter or capture net weight (e.g. 25.500)"
                                className={`w-full h-[46px] border rounded-[10px] px-4 font-semibold outline-none transition-all placeholder:text-gray-400 text-[14px] text-[#111827] bg-white ${
                                    errors.net_weight
                                        ? 'border-red-300 ring-1 ring-red-50'
                                        : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'
                                }`}
                            />
                            {errors.net_weight && (
                                <span className="text-red-500 text-[11px] mt-0.5 ml-1 font-medium">
                                    *{errors.net_weight}
                                </span>
                            )}
                        </div>

                        {/* Weight Unit */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[14px] font-bold text-[#374151]">
                                {t('modules:weight_unit', 'Weight Unit')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={weightUnit}
                                    onChange={(e) => setWeightUnit(e.target.value)}
                                    className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 pr-10 outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all text-[14px] text-[#111827] bg-white appearance-none cursor-pointer font-medium"
                                >
                                    <option value="kg">kg (Kilograms)</option>
                                    <option value="g">g (Grams)</option>
                                    <option value="lbs">lbs (Pounds)</option>
                                </select>
                                <ChevronDown
                                    size={18}
                                    className="text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Automatic Weighing & Label Printing Bar */}
                    <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[12px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-full bg-[#16A34A]/10 text-[#16A34A]">
                                <Zap size={20} className={isAutoPrintEnabled ? 'fill-current animate-pulse' : ''} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[14px] font-bold text-[#073318]">
                                        Automatic Weighing & Label Printing
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tracking-wide uppercase ${
                                        !isAutoPrintEnabled
                                            ? 'bg-gray-200 text-gray-700'
                                            : autoPrintStatus === 'REGISTERING'
                                            ? 'bg-purple-100 text-purple-800 border border-purple-300 animate-pulse'
                                            : autoPrintStatus === 'WAITING_FOR_REMOVAL'
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                            : autoPrintStatus === 'STABILIZING'
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse'
                                            : autoPrintStatus === 'READY'
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}>
                                        {!isAutoPrintEnabled
                                            ? 'Manual Mode'
                                            : autoPrintStatus === 'STANDBY'
                                            ? 'Auto Standby'
                                            : autoPrintStatus === 'READY'
                                            ? 'Ready (0.000 KG)'
                                            : autoPrintStatus === 'STABILIZING'
                                            ? 'Stabilizing...'
                                            : autoPrintStatus === 'REGISTERING'
                                            ? 'Registering & Printing...'
                                            : 'Waiting for Removal'}
                                    </span>
                                </div>
                                <p className="text-[12px] text-[#166534] mt-0.5">
                                    {!isAutoPrintEnabled
                                        ? 'Manual capture: Press "Capture Stable Weight" to record and preview labels manually.'
                                        : autoPrintStatus === 'WAITING_FOR_REMOVAL'
                                        ? `✓ Package ${lastRegisteredSerial || ''} registered & sent to thermal printer. Remove package (< 0.020 KG) to weigh next.`
                                        : autoPrintStatus === 'STABILIZING'
                                        ? 'Weight detected. Validating scale stability rules...'
                                        : autoPrintStatus === 'REGISTERING'
                                        ? 'Saving to database and triggering thermal printer dialog...'
                                        : 'Place package on scale platform. System will automatically register package & trigger thermal printing on weight stability.'}
                                </p>
                                {lastRegisteredPdfBase64 && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => triggerThermalPrint(lastRegisteredPdfBase64)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[12px] font-bold shadow-sm transition-all cursor-pointer"
                                            title="Reprint label without re-registering or creating duplicate package"
                                        >
                                            <Printer size={13} />
                                            <span>Reprint Last Label ({lastRegisteredSerial})</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDownloadRegisteredPdf}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[12px] font-bold shadow-sm transition-all cursor-pointer"
                                            title="Download generated package PDF to inspect without printer"
                                        >
                                            <Download size={13} />
                                            <span>Download PDF</span>
                                        </button>
                                        <span className="text-[11px] text-[#166534]">
                                            (Inspect PDF file without a printer)
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Toggle switch */}
                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                            <span className="text-[12px] font-bold text-gray-600">
                                {isAutoPrintEnabled ? 'Auto Mode Active' : 'Auto Mode Inactive'}
                            </span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isAutoPrintEnabled}
                                onClick={() => {
                                    const nextState = !isAutoPrintEnabled;
                                    setIsAutoPrintEnabled(nextState);
                                    localStorage.setItem('gmark_auto_weigh_print', nextState.toString());
                                    if (nextState) {
                                        toast.success('Automatic Weigh & Print Enabled! Place package on scale.');
                                    } else {
                                        toast('Automatic Weigh & Print Disabled (Manual Mode)');
                                    }
                                }}
                                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                                    isAutoPrintEnabled ? 'bg-[#16A34A]' : 'bg-gray-300'
                                }`}
                            >
                                <div
                                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                                        isAutoPrintEnabled ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Integrated Digital Scale Indicator Card */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[14px] font-bold text-[#374151] flex items-center gap-2">
                                <Scale size={16} className="text-[#073318]" />
                                Hardware Scale Terminal & Stability Indicator
                            </span>
                            <div className="flex items-center gap-2">
                                {!isConnected ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleConnectSerial}
                                            disabled={isConnecting}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#073318] hover:bg-[#04200f] text-white text-[12px] font-bold rounded-[8px] shadow-xs transition-all disabled:opacity-50"
                                        >
                                            <Usb size={13} />
                                            <span>Connect USB Scale</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleConnectSimulator(25.5)}
                                            disabled={isConnecting}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-bold rounded-[8px] transition-all"
                                        >
                                            <Cpu size={13} className="text-emerald-700" />
                                            <span>Start Simulator</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleDisconnect}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-[12px] font-bold rounded-[8px] transition-all"
                                    >
                                        Disconnect Scale
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Digital Terminal Readout */}
                        <div className="relative bg-[#09150E] border-2 border-[#163821] rounded-[14px] p-6 text-white shadow-inner overflow-hidden">
                            {/* Terminal Header: Machine Identity & Live Connection Status */}
                            <div className="mb-4 pb-3 border-b border-[#1C3E27] flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 font-medium">Machine Station:</span>
                                    <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 bg-[#122A1A] border border-[#1C3E27] rounded">
                                        {activeDevice?.stationId && !activeDevice.stationId.includes('()') && activeDevice.stationId !== '—'
                                            ? activeDevice.stationId
                                            : 'Machine ID not configured'}
                                    </span>
                                    <span className="text-gray-300 font-medium">
                                        {activeDevice?.deviceName || 'Packaging Bench Scale'}
                                    </span>
                                    <span className="text-gray-500 hidden sm:inline">
                                        ({activeDevice?.serialPort || 'COM'} @ {activeDevice?.baudRate || 9600} baud)
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Physical vs Simulated indicator */}
                                    {isConnected && (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide border ${
                                            activeMode === 'SIMULATOR'
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        }`}>
                                            {activeMode === 'SIMULATOR' ? 'Virtual Simulator' : 'Physical Scale (COM)'}
                                        </span>
                                    )}

                                    {/* Connection State (separate from identity) */}
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        isConnected
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : connectionStatus === ConnectionStatus.CONNECTING
                                            ? 'bg-amber-500/20 text-amber-300'
                                            : 'bg-gray-800 text-gray-400'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
                                        }`} />
                                        {isConnected ? 'Connected' : connectionStatus === ConnectionStatus.CONNECTING ? 'Connecting...' : 'Disconnected (Standby)'}
                                    </span>
                                </div>
                            </div>

                            {/* Overload Alert */}
                            {currentReading?.isOverload && (
                                <div className="mb-4 p-2.5 bg-red-950/80 border border-red-500/60 rounded-[8px] flex items-center gap-2 text-red-200 text-xs font-bold animate-pulse">
                                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                                    <span>SCALE OVERLOAD: Measured load exceeds rated capacity! Remove excess weight from platform.</span>
                                </div>
                            )}

                            <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
                                {/* Left: Weight Readout */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-400">
                                            LIVE SCALE INDICATOR
                                        </span>
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
                                                STANDBY
                                            </span>
                                        )}
                                    </div>

                                    {/* Numeric display */}
                                    <div className="flex items-baseline gap-3">
                                        <div className="font-mono text-[42px] md:text-[50px] font-black tracking-tight text-emerald-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.3)]">
                                            {isConnected
                                                ? liveNet.toFixed(3).padStart(6, '0')
                                                : isWeightLocked && netWeight
                                                ? Number(netWeight).toFixed(3).padStart(6, '0')
                                                : '00.000'}
                                        </div>
                                        <span className="text-[20px] font-black text-emerald-300 font-mono">
                                            {weightUnit.toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Sub-readouts */}
                                    <div className="mt-3 pt-3 border-t border-[#1C3E27] flex items-center gap-6 text-[12px] text-gray-400 font-mono">
                                        <div>
                                            <span>GROSS: </span>
                                            <strong className="text-gray-200">
                                                {isConnected ? liveGross.toFixed(3) : '0.000'} {weightUnit}
                                            </strong>
                                        </div>
                                        <div>
                                            <span>TARE: </span>
                                            <strong className="text-gray-200">
                                                {isConnected ? liveTare.toFixed(3) : '0.000'} {weightUnit}
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Scale Action Buttons */}
                                <div className="flex flex-col gap-2 shrink-0 md:border-l md:border-[#1C3E27] md:pl-6 justify-center">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={handleTare}
                                            disabled={!isConnected}
                                            className="px-3.5 py-2 bg-[#122A1A] hover:bg-[#1A3A25] border border-[#1C3E27] rounded-[8px] text-[12px] font-bold text-gray-200 disabled:opacity-40 transition-colors"
                                        >
                                            TARE
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleZero}
                                            disabled={!isConnected}
                                            className="px-3.5 py-2 bg-[#122A1A] hover:bg-[#1A3A25] border border-[#1C3E27] rounded-[8px] text-[12px] font-bold text-gray-200 disabled:opacity-40 transition-colors"
                                        >
                                            ZERO
                                        </button>
                                    </div>

                                    {!isWeightLocked ? (
                                        <button
                                            type="button"
                                            onClick={handleCaptureWeight}
                                            disabled={!isConnected || !isStable || liveNet <= 0}
                                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] rounded-[10px] font-black text-[13px] shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Scale size={16} />
                                            <span>Capture Stable Weight</span>
                                        </button>
                                    ) : (
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-[8px] text-emerald-300 text-[12px] font-bold">
                                                <Lock size={13} />
                                                <span>Weight Locked ({Number(netWeight).toFixed(3)} {weightUnit})</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleUnlockWeight}
                                                className="flex items-center justify-center gap-1.5 px-3 py-1 bg-[#122A1A] hover:bg-[#1A3A25] text-gray-300 rounded-[6px] text-[11px] font-semibold transition-colors"
                                            >
                                                <Unlock size={11} />
                                                <span>Re-weigh / Unlock</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Simulator Preset Buttons */}
                        {activeMode === 'SIMULATOR' && isConnected && (
                            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-[10px] flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-200">
                                <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-900">
                                    <Sliders size={14} className="text-emerald-700" />
                                    <span>Simulate Platform Load:</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {simulatorPresets.map((val) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => weighingService.setSimulatorLoad(val)}
                                            className="px-2.5 py-1 bg-white hover:bg-emerald-600 hover:text-white border border-emerald-300 rounded-[6px] text-[12px] font-bold text-emerald-800 transition-all"
                                        >
                                            {val.toFixed(1)} KG
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => weighingService.setSimulatorLoad(0)}
                                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-[6px] text-[12px] font-bold transition-all"
                                    >
                                        Empty
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sequential Code 128 Preview Card */}
                    <div className="p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                Sequential Code 128 Package Identifier
                            </span>
                            <span className="text-[18px] font-mono font-bold text-[#073318] mt-0.5 block">
                                {sampleFullSerial}
                            </span>
                        </div>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                            Auto Allocated Sequence
                        </span>
                    </div>

                    {/* Footer Buttons - Exactly Matching GroupForm */}
                    <div className="px-8 py-6 bg-[#F9FAFB]/50 flex items-center justify-end gap-3 border-t border-[#F3F4F6] -mx-8 -mb-8 md:-mx-10 md:-mb-10 rounded-b-[16px]">
                        <button
                            type="button"
                            className="px-8 h-[46px] border border-[#E5E7EB] text-[#4B5563] font-bold rounded-[10px] hover:bg-white hover:text-[#111827] transition-all text-[14px] bg-white shadow-sm shadow-black/5"
                            onClick={onBack}
                        >
                            {t('common:cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleGeneratePreview}
                            disabled={generatingPreview}
                            className="px-5 h-[46px] border border-[#073318] text-[#073318] hover:bg-[#073318]/5 font-bold rounded-[10px] transition-all text-[14px] flex items-center justify-center gap-2 bg-white shadow-sm disabled:opacity-50"
                            title="Open label preview in browser tab"
                        >
                            {generatingPreview ? (
                                <RefreshCw size={16} className="animate-spin text-[#073318]" />
                            ) : (
                                <Eye size={16} />
                            )}
                            <span>{generatingPreview ? 'Generating...' : 'Preview Label'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadPreviewPdf}
                            disabled={generatingPreview}
                            className="px-5 h-[46px] border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold rounded-[10px] transition-all text-[14px] flex items-center justify-center gap-2 bg-white shadow-sm disabled:opacity-50"
                            title="Download label PDF file for software inspection without a printer"
                        >
                            <Download size={16} />
                            <span>Download PDF</span>
                        </button>
                        <button
                            type="submit"
                            className="px-10 h-[46px] bg-[#073318] text-white font-bold rounded-[10px] hover:bg-[#04200f] transition-all text-[14px] disabled:opacity-50 shadow-md shadow-[#073318]/10 min-w-[140px] whitespace-nowrap flex items-center justify-center gap-2"
                            disabled={submittingPackage}
                        >
                            {submittingPackage ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                            ) : (
                                t('modules:save_package', 'Save Package')
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PackageRegistrationForm;
