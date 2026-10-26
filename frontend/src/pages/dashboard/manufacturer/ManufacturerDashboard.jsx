import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    Search,
    Download,
    Plus,
    X,
    FileText,
    FileSpreadsheet,
    Eye,
    RefreshCw,
    Scale,
    Package,
    AlertCircle,
    Printer,
    FileCheck,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Info,
    Lock,
    Filter,
    Calendar,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Cpu,
    Clock,
    ScanLine,
    ArrowUpRight,
    Upload,
    MoreVertical,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ScrollableTable from '../../../components/common/ScrollableTable';
import CustomSelect from '../../../components/common/CustomSelect';
import toast from 'react-hot-toast';
import { getProducts } from '../../../services/productService';
import {
    previewLabelsPdf,
    getPackageHistory,
    createPackage,
    reprintPackage,
    scanOutPackage,
    lookupPackage,
} from '../../../services/manufacturerService';
import LiveWeightCapture from '../../../components/manufacturer/LiveWeightCapture';
import MachineDetailsSection from '../../../components/manufacturer/MachineDetailsSection';
import PackageRegistrationForm from './components/PackageRegistrationForm';

const ManufacturerDashboard = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const { id } = useParams();

    // Toolbar states
    const [searchQuery, setSearchQuery] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRefs = useRef({});
    const [refreshing, setRefreshing] = useState(false);
    const [generatingPreview, setGeneratingPreview] = useState(false);
    const [submittingPackage, setSubmittingPackage] = useState(false);

    // Filters State
    const [filterProduct, setFilterProduct] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterLabelStatus, setFilterLabelStatus] = useState('');
    const [filterPrintStatus, setFilterPrintStatus] = useState('');
    const [showFilterBar, setShowFilterBar] = useState(false);
    const [columnFilters, setColumnFilters] = useState({
        serialNumber: '',
        productName: '',
        productCode: '',
        plantCode: '',
        machineId: '',
        netWeight: '',
        createdAt: '',
        labelStatus: '',
        printStatus: '',
        inventoryStatus: '',
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Table Data (Packages / Label History)
    const [packages, setPackages] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    const [packageError, setPackageError] = useState(null);
    const [summary, setSummary] = useState({ totalPackages: 0, totalNetWeight: 0, activePackages: 0, avgNetWeight: 0 });
    const [reprintModalPkg, setReprintModalPkg] = useState(null);
    const [reprintReason, setReprintReason] = useState('Damaged barcode label');
    const [isReprinting, setIsReprinting] = useState(false);
    const [scannedPackage, setScannedPackage] = useState(null);
    const [scanMode, setScanMode] = useState('LOOKUP'); // 'LOOKUP' | 'INVENTORY_OUT'
    const [dispatchingPackageId, setDispatchingPackageId] = useState(null);

    // Active products loaded from existing verified ProductMaster API
    const [productsList, setProductsList] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productError, setProductError] = useState(null);
    const isFetchingProductsRef = useRef(false);

    // Add Package Form State (Manual Package Entry)
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [manualNetWeight, setManualNetWeight] = useState('');
    const [weightUnit, setWeightUnit] = useState('kg');
    const [weightSource, setWeightSource] = useState('MANUAL_ENTRY'); // 'HARDWARE_SCALE' | 'SCALE_SIMULATOR' | 'MANUAL_ENTRY'
    const [machineId, setMachineId] = useState('M01');
    const [plantCode, setPlantCode] = useState('AB');
    const [labelSize, setLabelSize] = useState(() => localStorage.getItem('gmark_selected_label_size') || '150x100');
    const [formErrors, setFormErrors] = useState({});
    const [formStep, setFormStep] = useState('entry'); // 'entry' | 'review'

    const handleWeightCaptured = (data) => {
        setManualNetWeight(String(Number(data.weight).toFixed(3)));
        setWeightUnit((data.unit || 'kg').toLowerCase());
        setWeightSource(data.source);
        if (formErrors.weight) {
            setFormErrors((prev) => ({ ...prev, weight: undefined }));
        }
    };

    const exportRef = useRef(null);

    // Fetch packages history from backend
    const fetchPackages = useCallback(async () => {
        setLoadingPackages(true);
        setPackageError(null);
        try {
            const response = await getPackageHistory();
            const list = Array.isArray(response)
                ? response
                : response?.packages || response?.data || [];
            setPackages(list);
            if (response?.summary) {
                setSummary(response.summary);
            }
        } catch (err) {
            console.error('Failed to load label history', err);
            const errMsg =
                err?.response?.data?.message ||
                err?.message ||
                t('modules:failed_to_load_packages', 'Failed to load label history');
            setPackageError(errMsg);
        } finally {
            setLoadingPackages(false);
        }
    }, [t]);

    useEffect(() => {
        fetchPackages();
    }, [fetchPackages]);

    // Load active products from verified existing endpoint
    const fetchActiveProducts = useCallback(async () => {
        if (isFetchingProductsRef.current) return;
        isFetchingProductsRef.current = true;
        setLoadingProducts(true);
        setProductError(null);
        try {
            const response = await getProducts({ status: 'ACTIVE', limit: 100 });
            const list = response?.data?.products || response?.products || [];
            setProductsList(list);
        } catch (err) {
            console.error('Failed to load active products', err);
            const errMsg =
                err?.response?.data?.message ||
                err?.message ||
                t('modules:failed_to_load_products', 'Failed to load active products from Product Master');
            setProductError(errMsg);
            toast.error(errMsg);
        } finally {
            setLoadingProducts(false);
            isFetchingProductsRef.current = false;
        }
    }, [t]);

    useEffect(() => {
        fetchActiveProducts();
    }, [fetchActiveProducts]);

    // Derive currentView directly from URL location
    const currentView = useMemo(() => {
        if (location.pathname.endsWith('/add')) {
            return { type: 'add', data: null };
        }
        if (location.pathname.includes('/view/')) {
            const found = packages.find((p) => String(p.id) === String(id));
            return { type: 'view', data: found || { id } };
        }
        return { type: 'list', data: null };
    }, [location.pathname, id, packages]);

    // Close export dropdown and row action dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportRef.current && !exportRef.current.contains(event.target)) {
                setIsExportOpen(false);
            }
            if (activeDropdown !== null) {
                const ref = dropdownRefs.current[activeDropdown];
                if (ref && !ref.contains(event.target)) {
                    setActiveDropdown(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([fetchActiveProducts(), fetchPackages()]);
            toast.success(t('common:data_refreshed', 'Data refreshed successfully'));
        } catch (err) {
            console.error('Refresh failed', err);
        } finally {
            setRefreshing(false);
        }
    };

    const handleExecuteReprint = async () => {
        if (!reprintModalPkg) return;
        setIsReprinting(true);
        try {
            const res = await reprintPackage(reprintModalPkg.id, reprintReason);
            toast.success(`Label reprinted! Count: ${res.reprintCount || res.package?.reprint_count}`);
            if (res.labelPdfBase64) {
                const byteCharacters = atob(res.labelPdfBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
            }
            setReprintModalPkg(null);
            fetchPackages();
        } catch (err) {
            console.error('Reprint failed:', err);
            toast.error(err?.response?.data?.message || 'Failed to reprint label');
        } finally {
            setIsReprinting(false);
        }
    };

    // Barcode Lookup Handler (supports 5-field complete payload, 3-field, or direct serial)
    const handleBarcodeLookup = useCallback(async (rawInput) => {
        if (!rawInput || !rawInput.trim()) return;
        const raw = rawInput.trim();
        let targetSerial = raw;

        // 1. Direct parsing: if barcode payload contains all fields right inside it
        if (raw.includes('|')) {
            const parts = raw.split('|').map((s) => s.trim());
            // 5-field payload: Product Name | Product Code | Net Weight | Serial Number | Packaging Timing
            if (parts.length >= 5) {
                const prodName = parts[0];
                const prodCode = parts[1];
                const weightParts = parts[2].split(' ');
                const netWeightVal = parseFloat(weightParts[0]) || 0;
                const weightUnitVal = (weightParts[1] || 'KG').toUpperCase();
                const serialNum = parts[3];
                const timingStr = parts[4];

                const matchedPkg = packages.find((p) => {
                    const s = (p.serial_number || p.package_number || '').trim().toLowerCase();
                    return s === serialNum.toLowerCase();
                });

                setScannedPackage({
                    product_name: prodName,
                    product_code: prodCode,
                    net_weight: netWeightVal,
                    weight_unit: weightUnitVal,
                    serial_number: serialNum,
                    package_number: matchedPkg?.package_number || serialNum,
                    machine_id: matchedPkg?.machine_id || (serialNum.split('-')[2] || 'M01'),
                    plant_code: matchedPkg?.plant_code || (serialNum.split('-')[1] || 'AB'),
                    created_at: matchedPkg?.created_at || timingStr,
                    raw_timing: timingStr,
                    barcode_data: raw,
                    id: matchedPkg?.id,
                });
                toast.success(`Scanned: ${serialNum}`);
                return;
            } else if (parts.length >= 2) {
                targetSerial = parts[parts.length - 1];
            }
        }

        // 2. Try local packages array first
        const found = packages.find((p) => {
            const serial = (p.serial_number || p.package_number || '').trim().toLowerCase();
            const target = targetSerial.toLowerCase();
            const rawLower = raw.toLowerCase();
            const barcode = (p.barcode_data || '').toLowerCase();
            return (
                serial === target ||
                serial === rawLower ||
                barcode === rawLower ||
                (barcode && barcode.includes(target))
            );
        });

        if (found) {
            setScannedPackage(found);
            toast.success(`Scanned: ${found.serial_number}`);
            return;
        }

        // 3. Query backend if not loaded in current page
        try {
            const res = await getPackageHistory({ search: targetSerial });
            const list = Array.isArray(res) ? res : res?.packages || res?.data || [];
            if (list.length > 0) {
                setScannedPackage(list[0]);
                toast.success(`Scanned: ${list[0].serial_number}`);
            } else {
                toast.error(`No package found for scanned code: ${targetSerial}`);
            }
        } catch (err) {
            console.error('Barcode lookup error:', err);
            toast.error('Failed to lookup scanned barcode');
        }
    }, [packages]);

    // Explicit Inventory Out Barcode Scan Handler
    const handleScanOut = useCallback(async (rawInput) => {
        if (!rawInput || !rawInput.trim()) return;
        const raw = rawInput.trim();
        try {
            const res = await scanOutPackage(raw);
            toast.success(
                res.message || `Package ${res.package?.serial_number} Dispatched — Inventory Out recorded!`,
                { duration: 4500, icon: '📦' }
            );
            setSearchQuery('');
            fetchPackages();
        } catch (err) {
            console.error('Scan out failed:', err);
            const msg = err.response?.data?.message || err.message || 'Failed to dispatch package';
            toast.error(msg, { duration: 6000 });
        }
    }, [fetchPackages]);

    // Quick Dispatch action button for a table row or modal
    const handleQuickDispatch = async (pkg) => {
        if (!pkg || pkg.inventory_status === 'INVENTORY_OUT') return;
        setDispatchingPackageId(pkg.id);
        try {
            const res = await scanOutPackage(pkg.serial_number);
            toast.success(res.message || `Package ${pkg.serial_number} Dispatched!`);
            fetchPackages();
            if (scannedPackage && scannedPackage.id === pkg.id) {
                setScannedPackage({
                    ...scannedPackage,
                    inventory_status: 'INVENTORY_OUT',
                    dispatched_at: new Date().toISOString(),
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Dispatch failed');
        } finally {
            setDispatchingPackageId(null);
        }
    };

    // Global Hardware Barcode Scanner Listener (captures rapid keyboard-wedge scanner bursts ending in Enter)
    useEffect(() => {
        let buffer = '';
        let lastKeyTime = Date.now();

        const handleKeyDown = (e) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTime;
            lastKeyTime = now;

            if (e.key === 'Enter') {
                if (buffer.length > 5) {
                    if (scanMode === 'INVENTORY_OUT') {
                        handleScanOut(buffer.trim());
                    } else {
                        handleBarcodeLookup(buffer.trim());
                    }
                    buffer = '';
                }
                return;
            }

            if (timeDiff > 70) {
                buffer = '';
            }

            if (e.key && e.key.length === 1) {
                buffer += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleBarcodeLookup, handleScanOut, scanMode]);

    // Filter packages across search query and dedicated filters
    const filteredPackages = useMemo(() => {
        let result = packages || [];

        // Search query across all supported table fields
        if (searchQuery.trim()) {
            const raw = searchQuery.trim();
            let extractedSerial = raw;
            if (raw.includes('|')) {
                const parts = raw.split('|').map((s) => s.trim());
                if (parts.length >= 2) extractedSerial = parts[parts.length - 1];
            }
            const q = raw.toLowerCase();
            const qSerial = extractedSerial.toLowerCase();

            result = result.filter((p) => {
                const serial = (p.serial_number || p.package_number || '').replace(/[-—\s]+\(\)/g, '-M01').replace(/—/g, '-').toLowerCase();
                const prodName = (p.product_name || p.product?.product_name || p.product?.name || '').toLowerCase();
                const prodCode = (p.product_code || p.product?.product_code || '').toLowerCase();
                const plant = (p.plant_code || '').toLowerCase();
                const machine = (p.machine_id || '').toLowerCase();
                const barcode = (p.barcode_data || '').toLowerCase();
                const labelStatus = (p.label_status || p.status || '').toLowerCase();
                const printStatus = (p.print_status || '').toLowerCase();
                const invStatus = (p.inventory_status === 'INVENTORY_OUT' ? 'dispatched out inventory out' : 'in stock inventory in').toLowerCase();
                const netWeight = p.net_weight != null ? `${Number(p.net_weight).toFixed(2)} ${p.weight_unit || 'kg'}`.toLowerCase() : '';
                let dateFormatted = '';
                try {
                    const d = new Date(p.created_at);
                    dateFormatted = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase();
                } catch {}
                const dateIso = String(p.created_at || '').toLowerCase();

                return (
                    serial.includes(q) ||
                    serial.includes(qSerial) ||
                    q.includes(serial) ||
                    barcode.includes(q) ||
                    prodName.includes(q) ||
                    prodCode.includes(q) ||
                    plant.includes(q) ||
                    machine.includes(q) ||
                    labelStatus.includes(q) ||
                    printStatus.includes(q) ||
                    invStatus.includes(q) ||
                    netWeight.includes(q) ||
                    dateFormatted.includes(q) ||
                    dateIso.includes(q)
                );
            });
        }

        // Filter by Product
        if (filterProduct) {
            result = result.filter(
                (p) =>
                    String(p.product_id) === String(filterProduct) ||
                    p.product_name === filterProduct ||
                    p.product_code === filterProduct
            );
        }

        // Filter by Date From
        if (filterDateFrom) {
            const fromTime = new Date(filterDateFrom).setHours(0, 0, 0, 0);
            result = result.filter((p) => {
                if (!p.created_at) return false;
                return new Date(p.created_at).getTime() >= fromTime;
            });
        }

        // Filter by Date To
        if (filterDateTo) {
            const toTime = new Date(filterDateTo).setHours(23, 59, 59, 999);
            result = result.filter((p) => {
                if (!p.created_at) return false;
                return new Date(p.created_at).getTime() <= toTime;
            });
        }

        // Filter by Label Status
        if (filterLabelStatus) {
            result = result.filter((p) => {
                const s = (p.label_status || p.status || '').toUpperCase();
                return s === filterLabelStatus.toUpperCase();
            });
        }

        // Filter by Print Status
        if (filterPrintStatus) {
            result = result.filter((p) => {
                const s = (p.print_status || '').toUpperCase();
                return s === filterPrintStatus.toUpperCase();
            });
        }

        // Apply Column-wise Filters (Matching Purchase Order column search)
        Object.keys(columnFilters).forEach((key) => {
            const val = (columnFilters[key] || '').toLowerCase().trim();
            if (val) {
                result = result.filter((p) => {
                    let fieldVal = '';
                    if (key === 'serialNumber') fieldVal = (p.serial_number || p.package_number || '').replace(/[-—\s]+\(\)/g, '-M01').replace(/—/g, '-');
                    else if (key === 'productName') fieldVal = p.product_name || p.product?.product_name || p.product?.name || '';
                    else if (key === 'productCode') fieldVal = p.product_code || p.product?.product_code || '';
                    else if (key === 'plantCode') fieldVal = p.plant_code || '';
                    else if (key === 'machineId') fieldVal = p.machine_id || '';
                    else if (key === 'netWeight') fieldVal = p.net_weight != null ? `${Number(p.net_weight).toFixed(2)} ${p.weight_unit || 'kg'}` : '';
                    else if (key === 'createdAt') {
                        if (p.created_at) {
                            try {
                                const d = new Date(p.created_at);
                                fieldVal = isNaN(d.getTime()) ? String(p.created_at) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                            } catch {
                                fieldVal = String(p.created_at);
                            }
                        }
                    }
                    else if (key === 'labelStatus') fieldVal = p.label_status || p.status || '';
                    else if (key === 'printStatus') fieldVal = p.print_status || '';
                    else if (key === 'inventoryStatus') fieldVal = p.inventory_status === 'INVENTORY_OUT' ? 'Dispatched Out' : 'In Stock';

                    if (key === 'createdAt') {
                        const isoVal = String(p.created_at || '');
                        return fieldVal.toLowerCase().includes(val) || isoVal.toLowerCase().includes(val);
                    }
                    return fieldVal.toLowerCase().includes(val);
                });
            }
        });

        return result;
    }, [packages, searchQuery, filterProduct, filterDateFrom, filterDateTo, filterLabelStatus, filterPrintStatus, columnFilters]);

    const hasActiveColumnFilters = Object.values(columnFilters).some((v) => (v || '').trim().length > 0);
    const hasActiveFilters = Boolean(
        searchQuery.trim() ||
        filterProduct ||
        filterDateFrom ||
        filterDateTo ||
        filterLabelStatus ||
        filterPrintStatus ||
        hasActiveColumnFilters
    );

    const handleResetFilters = () => {
        setSearchQuery('');
        setFilterProduct('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterLabelStatus('');
        setFilterPrintStatus('');
        setColumnFilters({
            serialNumber: '',
            productName: '',
            productCode: '',
            plantCode: '',
            machineId: '',
            netWeight: '',
            createdAt: '',
            labelStatus: '',
            printStatus: '',
            inventoryStatus: '',
        });
        setCurrentPage(1);
    };

    // Pagination calculations
    const totalPages = Math.ceil(filteredPackages.length / itemsPerPage) || 1;
    const paginatedPackages = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredPackages.slice(start, start + itemsPerPage);
    }, [filteredPackages, currentPage, itemsPerPage]);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            return d.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return String(dateStr);
        }
    };

    // Production Summary Calculation (Today's Production / Today's Inventory, or Filtered Date's Total)
    const productionSummary = useMemo(() => {
        const today = new Date();
        const isSameDay = (d1, d2) => {
            if (!d1 || !d2) return false;
            const date1 = new Date(d1);
            const date2 = new Date(d2);
            if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
            return (
                date1.getFullYear() === date2.getFullYear() &&
                date1.getMonth() === date2.getMonth() &&
                date1.getDate() === date2.getDate()
            );
        };

        const hasDateRangeFilter = Boolean(filterDateFrom || filterDateTo);
        const hasCreatedAtColFilter = Boolean(columnFilters.createdAt && columnFilters.createdAt.trim());
        const sq = (searchQuery || '').trim().toLowerCase();
        const isSearchQueryDate = sq.length >= 2 && (
            /^\d{4}-\d{2}(-\d{2})?$/.test(sq) ||
            /^\d{1,2}[-\/]\d{1,2}([-\/]\d{2,4})?$/.test(sq) ||
            /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(sq) ||
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(sq)
        );

        const hasDateFilter = hasDateRangeFilter || hasCreatedAtColFilter || isSearchQueryDate;

        let targetPackages = [];
        let label = "Today's Inventory";

        if (hasDateFilter) {
            targetPackages = (packages || []).filter((p) => {
                if (!p.created_at) return false;
                if (filterDateFrom) {
                    const fromTime = new Date(filterDateFrom).setHours(0, 0, 0, 0);
                    if (new Date(p.created_at).getTime() < fromTime) return false;
                }
                if (filterDateTo) {
                    const toTime = new Date(filterDateTo).setHours(23, 59, 59, 999);
                    if (new Date(p.created_at).getTime() > toTime) return false;
                }
                if (hasCreatedAtColFilter) {
                    const q = columnFilters.createdAt.trim().toLowerCase();
                    let fieldVal = '';
                    try {
                        const d = new Date(p.created_at);
                        fieldVal = isNaN(d.getTime())
                            ? String(p.created_at)
                            : d.toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                              });
                    } catch {
                        fieldVal = String(p.created_at);
                    }
                    const isoVal = String(p.created_at || '');
                    if (!fieldVal.toLowerCase().includes(q) && !isoVal.toLowerCase().includes(q)) {
                        return false;
                    }
                }
                if (isSearchQueryDate) {
                    let fieldVal = '';
                    try {
                        const d = new Date(p.created_at);
                        fieldVal = isNaN(d.getTime())
                            ? String(p.created_at)
                            : d.toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                              });
                    } catch {
                        fieldVal = String(p.created_at);
                    }
                    const isoVal = String(p.created_at || '');
                    if (!fieldVal.toLowerCase().includes(sq) && !isoVal.toLowerCase().includes(sq)) {
                        return false;
                    }
                }
                return true;
            });

            const hasNonToday = targetPackages.some((p) => !isSameDay(p.created_at, today));
            const todayIso = today.toISOString().split('T')[0];
            const todayFormatted = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const filterIsToday = (
                (filterDateFrom === todayIso && (!filterDateTo || filterDateTo === todayIso)) ||
                (hasCreatedAtColFilter && (
                    columnFilters.createdAt.trim() === todayIso ||
                    todayFormatted.toLowerCase().includes(columnFilters.createdAt.trim().toLowerCase())
                )) ||
                (isSearchQueryDate && (sq === todayIso || todayFormatted.toLowerCase().includes(sq)))
            );

            if (!filterIsToday && (hasNonToday || targetPackages.length === 0)) {
                let dateText = '';
                if (hasCreatedAtColFilter) {
                    dateText = columnFilters.createdAt.trim();
                } else if (filterDateFrom && filterDateTo && filterDateFrom === filterDateTo) {
                    dateText = filterDateFrom;
                } else if (filterDateFrom && filterDateTo) {
                    dateText = `${filterDateFrom} to ${filterDateTo}`;
                } else if (filterDateFrom || filterDateTo) {
                    dateText = filterDateFrom || filterDateTo;
                } else if (isSearchQueryDate) {
                    dateText = searchQuery.trim();
                }
                label = `Today's Inventory (${dateText})`;
            } else {
                label = "Today's Inventory";
            }
        } else {
            // Default: today's registered packages (including subsequently dispatched)
            targetPackages = (packages || []).filter((p) => {
                if (!p.created_at) return false;
                return isSameDay(p.created_at, today);
            });
            label = "Today's Inventory";
        }

        // Sum net weights, normalizing units to kg
        let totalWeightKg = 0;
        targetPackages.forEach((p) => {
            const rawWt = parseFloat(p.net_weight ?? p.netWeight ?? 0) || 0;
            const unit = String(p.weight_unit || p.weightUnit || 'kg').toLowerCase().trim();
            let wtInKg = rawWt;
            if (unit === 'g' || unit === 'gm' || unit === 'grams') {
                wtInKg = rawWt / 1000;
            } else if (unit === 't' || unit === 'ton' || unit === 'tonne' || unit === 'tonnes') {
                wtInKg = rawWt * 1000;
            }
            totalWeightKg += wtInKg;
        });

        return {
            count: targetPackages.length,
            totalWeightKg: Number(totalWeightKg.toFixed(2)),
            label,
        };
    }, [packages, filterDateFrom, filterDateTo, columnFilters.createdAt, searchQuery]);

    // Grand Total (Till Date) Calculation across all saved packages
    const grandTotalSummary = useMemo(() => {
        let list = packages || [];
        if (filterDateTo) {
            const toTime = new Date(filterDateTo).setHours(23, 59, 59, 999);
            list = list.filter((p) => {
                const dateVal = p.created_at || p.createdAt;
                if (!dateVal) return false;
                return new Date(dateVal).getTime() <= toTime;
            });
        }

        let totalWeightKg = 0;
        list.forEach((p) => {
            const rawWt = parseFloat(p.net_weight ?? p.netWeight ?? 0) || 0;
            const unit = String(p.weight_unit || p.weightUnit || 'kg').toLowerCase().trim();
            let wtInKg = rawWt;
            if (unit === 'g' || unit === 'gm' || unit === 'grams') {
                wtInKg = rawWt / 1000;
            } else if (unit === 't' || unit === 'ton' || unit === 'tonne' || unit === 'tonnes') {
                wtInKg = rawWt * 1000;
            }
            totalWeightKg += wtInKg;
        });

        const label = filterDateTo ? `Grand Total (Till ${filterDateTo})` : 'Grand Total';

        return {
            count: list.length,
            totalWeightKg: Number(totalWeightKg.toFixed(2)),
            label,
        };
    }, [packages, filterDateTo]);

    const samplePackageFormat = useMemo(() => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const cleanPlant = (plantCode || 'AB').trim().toUpperCase() || 'AB';
        return `${yy}${mm}${dd}0001-${cleanPlant}`;
    }, [plantCode]);

    // Full provisional serial appending the entered Machine ID
    const sampleFullSerial = useMemo(() => {
        const cleanMachine = (machineId || 'M01').trim().toUpperCase() || 'M01';
        return `${samplePackageFormat}-${cleanMachine}`;
    }, [samplePackageFormat, machineId]);

    // Handle product selection & auto-populate default unit
    const handleProductSelect = (productId) => {
        const prod = productsList.find((p) => String(p.id) === String(productId));
        setSelectedProduct(prod || null);
        if (prod?.uom?.unit_name) {
            setWeightUnit(prod.uom.unit_name.toLowerCase());
        } else if (prod?.unit) {
            setWeightUnit(prod.unit.toLowerCase());
        }
        if (formErrors.product) {
            setFormErrors((prev) => ({ ...prev, product: undefined }));
        }
    };

    // Client-side validation for manual package entry
    const validateEntryForm = () => {
        const errors = {};
        if (!selectedProduct) {
            errors.product = t('modules:select_product_required', 'Please select an active product from Product Master');
        }

        const trimmedWeight = manualNetWeight.trim();
        if (!trimmedWeight) {
            errors.weight = t('modules:weight_required', 'Net weight is required');
        } else {
            const numWeight = parseFloat(trimmedWeight);
            if (isNaN(numWeight) || numWeight <= 0) {
                errors.weight = t('modules:weight_must_be_positive', 'Net weight must be a positive number greater than 0');
            } else if (!/^\d+(\.\d{1,3})?$/.test(trimmedWeight)) {
                errors.weight = t('modules:weight_decimal_limit', 'Net weight may have at most 3 decimal places');
            } else if (numWeight > 100000) {
                errors.weight = t('modules:weight_exceeds_limit', 'Net weight cannot exceed 100,000 kg');
            }
        }

        const cleanPlant = plantCode.trim().toUpperCase();
        if (!cleanPlant) {
            errors.plantCode = t('modules:plant_code_required', 'Plant code is required');
        } else if (!/^[A-Z0-9]{2}$/.test(cleanPlant)) {
            errors.plantCode = t('modules:plant_code_invalid', 'Plant code must be exactly 2 alphanumeric characters (e.g. AB, P1)');
        }

        const cleanMachine = machineId.trim().toUpperCase();
        if (!cleanMachine) {
            errors.machineId = t('modules:machine_id_required', 'Machine ID is required');
        } else if (!/^[A-Z0-9_-]{1,10}$/.test(cleanMachine)) {
            errors.machineId = t('modules:machine_id_invalid', 'Machine ID must be 1 to 10 alphanumeric characters, hyphens, or underscores (e.g. M01, LINE-02)');
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleProceedToReview = (e) => {
        e?.preventDefault();
        if (validateEntryForm()) {
            setFormStep('review');
        } else {
            toast.error(t('modules:fix_validation_errors', 'Please correct the validation errors before reviewing'));
        }
    };

    const handleBackToEntry = () => {
        setFormStep('entry');
    };

    const handleCloseAddView = () => {
        setSelectedProduct(null);
        setManualNetWeight('');
        setWeightSource('MANUAL_ENTRY');
        setMachineId('M01');
        setPlantCode('AB');
        setFormErrors({});
        setFormStep('entry');
        navigate('/seller/inventory/packaging');
    };

    // Trigger synthetic label preview via dedicated Manufacturer backend API
    const handleGeneratePreview = async () => {
        if (!validateEntryForm()) {
            toast.error(t('modules:fix_validation_errors', 'Please correct the validation errors before previewing'));
            return;
        }

        setGeneratingPreview(true);
        try {
            const productName = selectedProduct
                ? (selectedProduct.name || selectedProduct.product_name || 'Industrial Grade Polymer 50kg')
                : 'Industrial Grade Polymer 50kg';

            const numWeight = parseFloat(manualNetWeight);

            const dto = {
                labelSize: labelSize || '150x100',
                items: [
                    {
                        companyName: 'GMARK MANUFACTURING PVT LTD',
                        productName: productName,
                        netWeight: numWeight,
                        serialNumber: sampleFullSerial,
                    },
                ],
            };

            const blob = await previewLabelsPdf(dto);
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            toast.success(t('modules:preview_generated', 'Generated thermal label preview PDF'));
        } catch (err) {
            console.error('Failed to preview thermal label', err);
            toast.error(t('modules:preview_failed', 'Failed to generate preview PDF from server'));
        } finally {
            setGeneratingPreview(false);
        }
    };

    // Confirm and register weighed package in the backend
    const handleRegisterPackage = async () => {
        if (!selectedProduct) {
            toast.error('Please select a product first');
            return;
        }

        const numWeight = parseFloat(manualNetWeight);
        if (isNaN(numWeight) || numWeight <= 0) {
            toast.error('Please enter or capture a valid weight');
            return;
        }

        setSubmittingPackage(true);
        try {
            const payload = {
                productId: Number(selectedProduct.id),
                netWeight: numWeight,
                weightUnit: (weightUnit || 'kg').toLowerCase(),
                weightSource: weightSource || 'HARDWARE_SCALE',
                plantCode: (plantCode || 'AB').trim().toUpperCase(),
                machineId: (machineId || 'M01').trim().toUpperCase(),
                labelSize: labelSize || '150x100',
            };

            const result = await createPackage(payload);

            toast.success(`Package Registered! Serial: ${result.package.serial_number}`);

            // Automatically open generated label PDF if returned
            if (result.labelPdfBase64) {
                const byteCharacters = atob(result.labelPdfBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
            }

            // Refresh table and reset form view
            await fetchPackages();
            handleCloseAddView();
        } catch (err) {
            console.error('Failed to register package:', err);
            toast.error(err?.response?.data?.message || 'Failed to register package');
        } finally {
            setSubmittingPackage(false);
        }
    };

    if (currentView.type === 'add') {
        return (
            <PackageRegistrationForm
                products={productsList}
                loadingProducts={loadingProducts}
                onBack={handleCloseAddView}
                onSuccess={async () => {
                    await fetchPackages();
                    handleCloseAddView();
                }}
            />
        );
    }

    return (
        <div className="flex flex-col relative w-full h-full font-['Plus_Jakarta_Sans'] pb-10">
            {/* Action Bar */}
            <div className="flex flex-row items-center justify-between gap-4 mb-4 md:mb-6">
                <div>
                    <h2 className="text-[20px] md:text-[22px] font-bold text-[#111827] tracking-tight">
                        {t('modules:packaging_station', 'Packaging Station')}
                    </h2>
                    <p className="text-[#6B7280] text-[13px] md:text-[14px] font-medium mt-0.5">
                        {t(
                            'modules:packaging_station_desc',
                            'Capture scale weights, register production packages, and generate barcode labels.'
                        )}
                    </p>
                </div>

                <button
                    onClick={() => navigate('/seller/inventory/packaging/add')}
                    className="flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-5 h-[42px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0"
                >
                    <Plus size={18} />
                    <span>{t('modules:inventory', 'Inventory')}</span>
                </button>
            </div>

            {/* Desktop Action Toolbar & Filter Toggle */}
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 md:p-6 mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] font-outfit">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Search Bar, Filter, Refresh */}
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-[320px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder={t('common:search_by_anything', 'Search by anything...')}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10"
                            />
                            {searchQuery && (
                                <X
                                    size={16}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer hover:text-gray-600"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setCurrentPage(1);
                                    }}
                                />
                            )}
                        </div>

                        {/* Filter / Clear Toggle (Matching Purchase Order) */}
                        <button
                            onClick={() => {
                                if (hasActiveFilters) {
                                    handleResetFilters();
                                } else {
                                    setShowFilterBar(!showFilterBar);
                                }
                            }}
                            className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all shadow-sm ${
                                hasActiveFilters
                                    ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                    : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                            }`}
                        >
                            <Filter size={18} className={hasActiveFilters ? 'text-red-500' : 'text-gray-400'} />
                            <span>{hasActiveFilters ? t('common:clear', 'Clear') : t('common:filter', 'Filter')}</span>
                        </button>

                        {/* Refresh */}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loadingProducts || loadingPackages}
                            className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 bg-white disabled:opacity-50 transition-colors"
                            title={t('common:refresh', 'Refresh Data')}
                        >
                            <RefreshCw size={18} className={`text-gray-400 ${refreshing || loadingPackages ? 'animate-spin border-[#073318]' : ''}`} />
                        </button>
                    </div>

                    {/* Right: Export Menu */}
                    <div className="flex items-center gap-3">
                        <div className="relative" ref={exportRef}>
                            <button
                                onClick={() => {
                                    if (filteredPackages.length > 0) {
                                        setIsExportOpen(!isExportOpen);
                                    }
                                }}
                                disabled={filteredPackages.length === 0}
                                className={`flex items-center gap-2 px-6 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all bg-white ${
                                    filteredPackages.length === 0
                                        ? 'border-gray-200 text-gray-400 cursor-not-allowed opacity-70'
                                        : isExportOpen
                                        ? 'border-[#073318] text-[#073318]'
                                        : 'border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                                }`}
                            >
                                <Upload size={18} /> {t('common:export', 'Export')}
                            </button>
                            {isExportOpen && filteredPackages.length > 0 && (
                                <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button
                                        onClick={() => {
                                            setIsExportOpen(false);
                                            handleExportExcel();
                                        }}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700"
                                    >
                                        <FileSpreadsheet size={18} className="text-green-600" />
                                        <span>{t('common:excel', 'Excel')}</span>
                                    </button>
                                    <button
                                        onClick={() => setIsExportOpen(false)}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700 border-t border-gray-50"
                                    >
                                        <FileText size={18} className="text-rose-500" />
                                        <span>{t('common:pdf', 'PDF')}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Collapsible Filter Panel */}
                {showFilterBar && (
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200">
                        {/* Product Filter */}
                        <div>
                            <label className="block text-[12px] font-bold text-gray-600 mb-1">
                                {t('modules:product', 'Product')}
                            </label>
                            <select
                                value={filterProduct}
                                onChange={(e) => {
                                    setFilterProduct(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2.5 text-[13px] outline-none focus:border-[#073318]"
                            >
                                <option value="">All Products</option>
                                {productsList.map((p) => (
                                    <option key={p.id} value={p.product_name || p.name}>
                                        {p.product_name || p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range: From */}
                        <div>
                            <label className="block text-[12px] font-bold text-gray-600 mb-1">
                                {t('common:date_from', 'Created From')}
                            </label>
                            <input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) => {
                                    setFilterDateFrom(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2.5 text-[13px] outline-none focus:border-[#073318]"
                            />
                        </div>

                        {/* Date Range: To */}
                        <div>
                            <label className="block text-[12px] font-bold text-gray-600 mb-1">
                                {t('common:date_to', 'Created To')}
                            </label>
                            <input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) => {
                                    setFilterDateTo(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2.5 text-[13px] outline-none focus:border-[#073318]"
                            />
                        </div>

                        {/* Label Status */}
                        <div>
                            <label className="block text-[12px] font-bold text-gray-600 mb-1">
                                {t('modules:label_status', 'Label Status')}
                            </label>
                            <select
                                value={filterLabelStatus}
                                onChange={(e) => {
                                    setFilterLabelStatus(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2.5 text-[13px] outline-none focus:border-[#073318]"
                            >
                                <option value="">All Statuses</option>
                                <option value="CREATED">Created</option>
                                <option value="PREVIEWED">Previewed</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content Area: Single Table */}
            {currentView.type === 'list' ? (
                <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm">

                    {/* Table States */}
                    {loadingPackages ? (
                        /* 1. Loading State */
                        <div className="py-16 text-center flex flex-col items-center justify-center">
                            <RefreshCw size={28} className="animate-spin text-[#073318] mb-3" />
                            <p className="text-[14px] text-gray-600 font-medium">
                                Loading label and package records...
                            </p>
                        </div>
                    ) : packageError ? (
                        /* 2. API Failure State */
                        <div className="p-8 text-center flex flex-col items-center justify-center bg-rose-50/50 border border-rose-200 rounded-xl m-4">
                            <AlertCircle size={32} className="text-rose-600 mb-2" />
                            <h4 className="text-[15px] font-bold text-rose-900 mb-1">
                                Failed to Load Label History
                            </h4>
                            <p className="text-[13px] text-rose-700 max-w-md mb-4 leading-relaxed">
                                {packageError}
                            </p>
                            <button
                                onClick={fetchPackages}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[13px] font-semibold transition-all shadow-sm"
                            >
                                <RefreshCw size={14} />
                                <span>Retry</span>
                            </button>
                        </div>
                    ) : packages.length === 0 ? (
                        /* 3. Empty State: No records available in the database */
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-2xl bg-[#073318]/5 flex items-center justify-center text-[#073318] mb-4">
                                <Package size={32} />
                            </div>
                            <h3 className="text-[18px] font-bold text-gray-900 mb-1">
                                No Created Labels Found
                            </h3>
                            <p className="text-[14px] text-gray-500 max-w-md mb-6 leading-relaxed">
                                Packages and created labels will be listed here once recorded at the station. Use the Weigh & Register action to select products and generate thermal barcode label previews.
                            </p>
                            <button
                                onClick={() => navigate('/seller/inventory/packaging/add')}
                                className="inline-flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-5 h-[42px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm"
                            >
                                <Plus size={18} />
                                <span>{t('modules:inventory', 'Inventory')}</span>
                            </button>
                        </div>
                    ) : (
                        /* 5. Populated Table State */
                        <div>
                            {/* Column Definitions */}
                            {(() => {
                                const packagingColumns = [
                                    { key: 'srNo', label: t('common:sr_no', 'SR NO'), noSearch: true, align: 'center', minWidth: '70px' },
                                    { key: 'serialNumber', label: t('modules:serial_number', 'SERIAL NUMBER'), placeholder: 'Serial No', minWidth: '170px' },
                                    { key: 'productName', label: t('modules:product_name', 'PRODUCT NAME'), placeholder: 'Product', minWidth: '170px' },
                                    { key: 'productCode', label: t('modules:product_code', 'PRODUCT CODE'), placeholder: 'Code', minWidth: '120px' },
                                    { key: 'plantCode', label: t('modules:plant_code', 'PLANT CODE'), placeholder: 'Plant', minWidth: '110px' },
                                    { key: 'machineId', label: t('modules:machine_id', 'MACHINE ID'), placeholder: 'Machine', minWidth: '120px' },
                                    { key: 'createdAt', label: t('modules:created_at', 'CREATED AT'), placeholder: 'Date/Time', minWidth: '160px' },
                                    { key: 'netWeight', label: t('modules:net_weight', 'NET WEIGHT'), placeholder: 'Weight', minWidth: '120px' },
                                    { key: 'labelStatus', label: t('modules:label_status', 'LABEL STATUS'), placeholder: 'Label', minWidth: '120px' },
                                    { key: 'printStatus', label: t('modules:print_status', 'PRINT STATUS'), placeholder: 'Print', minWidth: '120px' },
                                    { key: 'inventoryStatus', label: t('modules:inventory_status', 'INVENTORY STATUS'), placeholder: 'Inventory', minWidth: '140px' },
                                    { key: 'actions', label: t('common:actions', 'ACTIONS'), noSearch: true, align: 'center', minWidth: '120px' },
                                ];

                                return (
                                    <>
                                        <ScrollableTable>
                                            <table className="w-full min-w-[1500px] border-collapse text-left font-outfit">
                                                <thead>
                                                    {/* Row 1: Green Header */}
                                                    <tr className="bg-emerald-900 text-white font-bold text-[15px]">
                                                        {packagingColumns.map((col) => (
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
                                                        {packagingColumns.map((col, i) => (
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
                                                <tbody className={`text-[14px] text-[#111827] ${refreshing || loadingPackages ? 'opacity-40' : 'opacity-100'}`}>
                                                    {/* Row 1: Today's Inventory / Production Summary (Matching Sales Module Page Total UI) */}
                                                    <tr className="border-b border-[#E2E8F0] bg-gray-50/90 font-bold text-[13px] text-[#334155]">
                                                        {/* Cols 0-6 (SR NO, SERIAL NUMBER, PRODUCT NAME, PRODUCT CODE, PLANT CODE, MACHINE ID, CREATED AT) */}
                                                        <td
                                                            colSpan="7"
                                                            className="sticky top-0 z-20 bg-gray-50 px-6 py-3.5 text-right font-extrabold text-[#111827] border-r border-[#E2E8F0] whitespace-nowrap text-[13px]"
                                                        >
                                                            {productionSummary.label}: {productionSummary.count} {productionSummary.count === 1 ? 'package' : 'packages'}
                                                        </td>

                                                        {/* Col 7 (NET WEIGHT: Aligned directly under NET WEIGHT column) */}
                                                        <td
                                                            className="sticky top-0 z-20 bg-gray-50 px-6 py-3.5 text-left font-extrabold text-[#073318] border-r border-[#E2E8F0] whitespace-nowrap text-[14px]"
                                                        >
                                                            {productionSummary.totalWeightKg.toLocaleString('en-IN', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            })}{' '}
                                                            kg
                                                        </td>

                                                        {/* Cols 8-11 (LABEL STATUS, PRINT STATUS, INVENTORY STATUS, ACTIONS) */}
                                                        <td
                                                            colSpan="4"
                                                            className="sticky top-0 z-20 bg-gray-50 px-6 py-3.5 text-center font-bold text-gray-500 text-[12px]"
                                                        >
                                                            -
                                                        </td>
                                                    </tr>

                                                    {/* Row 2: Grand Total Till Date (Matching Sales Module Grand Total UI) */}
                                                    <tr className="bg-[#E6F4EA] font-extrabold text-[#064E3B] border-b border-[#A7F3D0] text-[13px]">
                                                        {/* Cols 0-6 (SR NO, SERIAL NUMBER, PRODUCT NAME, PRODUCT CODE, PLANT CODE, MACHINE ID, CREATED AT) */}
                                                        <td
                                                            colSpan="7"
                                                            className="sticky top-[42px] z-20 bg-[#E6F4EA] px-6 py-3.5 text-right font-black text-emerald-950 border-r border-[#A7F3D0]/60 whitespace-nowrap text-[13px]"
                                                        >
                                                            {grandTotalSummary.label}: {grandTotalSummary.count} {grandTotalSummary.count === 1 ? 'package' : 'packages'} in total
                                                        </td>

                                                        {/* Col 7 (NET WEIGHT: Aligned directly under NET WEIGHT column) */}
                                                        <td
                                                            className="sticky top-[42px] z-20 bg-[#E6F4EA] px-6 py-3.5 text-left font-black text-emerald-950 border-r border-[#A7F3D0]/60 whitespace-nowrap text-[14px]"
                                                        >
                                                            {grandTotalSummary.totalWeightKg.toLocaleString('en-IN', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            })}{' '}
                                                            kg
                                                        </td>

                                                        {/* Cols 8-11 (LABEL STATUS, PRINT STATUS, INVENTORY STATUS, ACTIONS) */}
                                                        <td
                                                            colSpan="4"
                                                            className="sticky top-[42px] z-20 bg-[#E6F4EA] px-6 py-3.5 text-center font-bold text-emerald-800 text-[12px]"
                                                        >
                                                            -
                                                        </td>
                                                    </tr>

                                                    {paginatedPackages.length > 0 ? (
                                                        paginatedPackages.map((pkg, idx) => (
                                                            <tr
                                                                key={pkg.id || idx}
                                                                className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all"
                                                            >
                                                                {/* 1. SR NO */}
                                                                <td className="px-6 py-5 text-center font-bold text-gray-500">
                                                                    {(currentPage - 1) * itemsPerPage + idx + 1}
                                                                </td>

                                                                {/* 2. Serial Number */}
                                                                <td className="px-6 py-5 font-mono font-bold text-[#073318]">
                                                                    {(pkg.serial_number || pkg.package_number || '—').replace(/[-—\s]+\(\)/g, '-M01').replace(/—/g, '-')}
                                                                </td>

                                                                {/* 3. Product Name */}
                                                                <td className="px-6 py-5 font-bold text-gray-900 max-w-[200px] truncate">
                                                                    {pkg.product_name || pkg.product?.product_name || pkg.product?.name || '—'}
                                                                </td>

                                                                {/* 4. Product Code */}
                                                                <td className="px-6 py-5 font-mono text-gray-600">
                                                                    {pkg.product_code || pkg.product?.product_code || '—'}
                                                                </td>

                                                                {/* 5. Plant Code */}
                                                                <td className="px-6 py-5 font-mono font-semibold text-gray-700">
                                                                    {pkg.plant_code || '—'}
                                                                </td>

                                                                {/* 6. Machine ID */}
                                                                <td className="px-6 py-5 font-mono text-gray-700">
                                                                    {pkg.machine_id && !pkg.machine_id.includes('()') && pkg.machine_id !== '—' && pkg.machine_id !== '-' ? (
                                                                        <span className="font-semibold text-gray-800">{pkg.machine_id}</span>
                                                                    ) : (
                                                                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                                                                            M01
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                {/* 7. Created At */}
                                                                <td className="px-6 py-5 text-[#4B5563] text-[13px] whitespace-nowrap">
                                                                    {formatDate(pkg.created_at)}
                                                                </td>

                                                                {/* 8. Net Weight */}
                                                                <td className="px-6 py-5 font-bold text-emerald-700 whitespace-nowrap">
                                                                    {pkg.net_weight !== undefined && pkg.net_weight !== null
                                                                        ? `${Number(pkg.net_weight).toFixed(2)} ${pkg.weight_unit || 'kg'}`
                                                                        : '—'}
                                                                </td>

                                                                {/* 9. Label Status */}
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    {pkg.label_status === 'CREATED' ? (
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                            Created
                                                                        </span>
                                                                    ) : pkg.label_status === 'PREVIEWED' ? (
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                            Previewed
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                                            {pkg.label_status || 'Draft'}
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                {/* 10. Print Status */}
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    {pkg.print_status === 'PRINTED' ? (
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                            Printed
                                                                        </span>
                                                                    ) : pkg.print_status === 'PENDING' ? (
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                            Pending
                                                                        </span>
                                                                    ) : pkg.print_status === 'NOT_PRINTED' ? (
                                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                                            Not Printed
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[12px] text-gray-400 italic">
                                                                            Not Tracked
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                {/* 11. Inventory Status */}
                                                                <td className="px-6 py-5 whitespace-nowrap">
                                                                    {pkg.inventory_status === 'INVENTORY_OUT' ? (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-bold bg-purple-50 text-purple-700 border border-purple-200"
                                                                            title={pkg.dispatched_at ? `Dispatched on ${new Date(pkg.dispatched_at).toLocaleString()}` : 'Dispatched'}
                                                                        >
                                                                            <ArrowUpRight size={13} />
                                                                            Dispatched (Out)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                            <Package size={13} />
                                                                            In Stock
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                {/* 12. Actions */}
                                                                <td
                                                                    className="px-6 py-5 text-center whitespace-nowrap relative"
                                                                    ref={(el) => (dropdownRefs.current[pkg.id] = el)}
                                                                >
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {pkg.inventory_status !== 'INVENTORY_OUT' && (
                                                                            <button
                                                                                onClick={() => handleQuickDispatch(pkg)}
                                                                                disabled={dispatchingPackageId === pkg.id}
                                                                                className="p-2 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                                title="Dispatch Package (Record Inventory Out)"
                                                                            >
                                                                                <ArrowUpRight size={18} />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={() => setActiveDropdown(activeDropdown === pkg.id ? null : pkg.id)}
                                                                            className={`p-2 rounded-lg transition-colors ${
                                                                                activeDropdown === pkg.id
                                                                                    ? 'bg-[#073318] text-white'
                                                                                    : 'text-[#4B5563] hover:bg-gray-100'
                                                                            }`}
                                                                            title="Actions"
                                                                        >
                                                                            <MoreVertical size={18} />
                                                                        </button>
                                                                    </div>

                                                                    {activeDropdown === pkg.id && (
                                                                        <div
                                                                            className={`absolute right-full mr-2 w-max min-w-[160px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[110] py-2 animate-in zoom-in-95 duration-200 text-left font-bold ${
                                                                                idx >= paginatedPackages.length - 2 ? 'bottom-0' : 'top-0'
                                                                            }`}
                                                                        >
                                                                            {/* VIEW */}
                                                                            <button
                                                                                onClick={() => {
                                                                                    setActiveDropdown(null);
                                                                                    setScannedPackage(pkg);
                                                                                }}
                                                                                className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50 text-[14px] transition-colors"
                                                                            >
                                                                                <Eye size={18} className="text-gray-500" />
                                                                                <span>{t('common:view', 'View')}</span>
                                                                            </button>

                                                                            {/* PRINT */}
                                                                            <button
                                                                                onClick={() => {
                                                                                    setActiveDropdown(null);
                                                                                    setReprintModalPkg(pkg);
                                                                                }}
                                                                                className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] text-[14px] transition-colors"
                                                                            >
                                                                                <Printer size={18} className="text-gray-500" />
                                                                                <span>{t('common:print', 'Print')}</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="12" className="px-6 py-20 text-center text-gray-400 font-bold font-outfit">
                                                                <div className="flex flex-col items-center justify-center gap-2">
                                                                    <span className="uppercase tracking-widest text-[14px]">
                                                                        {t('common:no_results_found', 'No Records Found')}
                                                                    </span>
                                                                    {hasActiveFilters && (
                                                                        <button
                                                                            onClick={handleResetFilters}
                                                                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-[12px] font-semibold transition-all shadow-sm"
                                                                        >
                                                                            <RotateCcw size={13} />
                                                                            <span>Reset All Filters</span>
                                                                        </button>
                                                                    )}
                                                                </div>
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
                                                    {filteredPackages.length > 0
                                                        ? `${((currentPage - 1) * itemsPerPage) + 1}–${Math.min(currentPage * itemsPerPage, filteredPackages.length)} of ${filteredPackages.length}`
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
            ) : currentView.type === 'view' ? (
                /* Real Package Details View */
                <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-6 md:p-8 shadow-sm max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
                    {(() => {
                        const targetPkg = packages.find(
                            (p) => String(p.id) === String(id) || p.serial_number === id
                        );
                        if (!targetPkg) {
                            return (
                                <div className="text-center py-8">
                                    <AlertCircle className="mx-auto text-amber-500 mb-3" size={32} />
                                    <h3 className="text-[17px] font-bold text-gray-900 mb-1">Package Not Found</h3>
                                    <p className="text-[13px] text-gray-500 mb-4">No package matching ID #{id}</p>
                                    <button
                                        onClick={() => navigate('/seller/inventory/packaging')}
                                        className="px-4 py-2 bg-[#073318] text-white rounded-[10px] text-[13px] font-bold"
                                    >
                                        Back to Packaging Station
                                    </button>
                                </div>
                            );
                        }
                        return (
                            <div>
                                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                                    <div>
                                        <span className="text-[11px] font-bold text-[#073318] uppercase tracking-wider bg-[#073318]/10 px-2 py-0.5 rounded">
                                            Inventory Package
                                        </span>
                                        <h3 className="text-[20px] font-extrabold text-gray-900 mt-1 font-mono">
                                            {targetPkg.serial_number}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => setReprintModalPkg(targetPkg)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#073318] hover:bg-[#04200f] text-white rounded-[10px] text-[13px] font-bold transition-all"
                                    >
                                        <Printer size={16} />
                                        <span>Reprint Label</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-[13px] mb-6">
                                    <div className="p-3 bg-gray-50 rounded-[10px]">
                                        <span className="text-gray-500 block text-[11px]">Product</span>
                                        <span className="font-bold text-gray-900">{targetPkg.product_name}</span>
                                        <span className="text-gray-400 block text-[11px] font-mono">#{targetPkg.product_code}</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-[10px]">
                                        <span className="text-gray-500 block text-[11px]">Net Weight</span>
                                        <span className="font-extrabold text-[17px] text-[#073318]">
                                            {targetPkg.net_weight} <span className="text-[12px] font-medium text-gray-500">kg</span>
                                        </span>
                                        {targetPkg.tare_weight > 0 && (
                                            <span className="text-gray-400 block text-[11px]">Tare: {targetPkg.tare_weight} kg</span>
                                        )}
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-[10px]">
                                        <span className="text-gray-500 block text-[11px]">Station / Plant</span>
                                        <span className="font-bold text-gray-800">{targetPkg.machine_id}</span>
                                        <span className="text-gray-400 ml-2">Plant {targetPkg.plant_code}</span>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-[10px]">
                                        <span className="text-gray-500 block text-[11px]">Reprint Count</span>
                                        <span className="font-bold text-gray-900">{targetPkg.reprint_count || 0} times</span>
                                    </div>
                                </div>

                                {targetPkg.barcode_data && (
                                    <div className="mb-6 p-3 bg-gray-50 rounded-[10px] border border-gray-100">
                                        <span className="text-gray-500 block text-[11px] font-semibold mb-1">Encoded Barcode Payload</span>
                                        <pre className="text-[11px] font-mono text-gray-700 whitespace-pre-wrap break-all bg-white p-2 rounded border border-gray-200">
                                            {targetPkg.barcode_data}
                                        </pre>
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/seller/inventory/packaging')}
                                        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 h-[38px] rounded-[10px] text-[13px] font-bold transition-all"
                                    >
                                        Back to Packaging Station
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            ) : null}

            {/* Scanned Package Well-Formatted Details Modal */}
            {scannedPackage && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[18px] shadow-2xl p-6 md:p-8 max-w-lg w-full border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-50 text-[#073318] rounded-lg">
                                    <CheckCircle2 size={22} className="text-[#16A34A]" />
                                </div>
                                <div>
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                                        Scanned Package Verified
                                    </span>
                                    <h3 className="text-[18px] font-extrabold text-gray-900 mt-0.5">
                                        Package Details
                                    </h3>
                                </div>
                            </div>
                            <button
                                onClick={() => setScannedPackage(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* One by One Stacked Cards as Requested */}
                        <div className="space-y-3 mb-6">
                            {/* 1. Product Name */}
                            <div className="p-3.5 bg-gray-50/80 border border-gray-200/80 rounded-[12px]">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                    Product Name
                                </span>
                                <span className="text-[16px] font-extrabold text-gray-900 block mt-0.5">
                                    {scannedPackage.product_name || scannedPackage.product?.product_name || 'N/A'}
                                </span>
                            </div>

                            {/* 2. Serial Number (Sr No) — large, bold mono font */}
                            <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-[12px]">
                                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                                    Serial Number (Sr No)
                                </span>
                                <span className="font-mono text-[24px] font-black text-[#073318] tracking-tight block mt-1">
                                    {scannedPackage.serial_number}
                                </span>
                            </div>

                            {/* 3. Product Code */}
                            <div className="p-3.5 bg-gray-50/80 border border-gray-200/80 rounded-[12px]">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                    Product Code
                                </span>
                                <span className="font-mono font-extrabold text-[15px] text-gray-900 block mt-0.5">
                                    {scannedPackage.product_code?.startsWith('#')
                                        ? scannedPackage.product_code
                                        : `#${scannedPackage.product_code || scannedPackage.product?.product_code || 'PD00001'}`}
                                </span>
                            </div>

                            {/* 4. Net Weight — prominent emerald digits */}
                            <div className="p-4 bg-emerald-500/10 border border-emerald-300 rounded-[12px]">
                                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                                    Net Weight
                                </span>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className="font-mono text-[28px] font-black text-emerald-800">
                                        {Number(scannedPackage.net_weight || 0).toFixed(2)}
                                    </span>
                                    <span className="text-[16px] font-black text-emerald-700 font-mono uppercase">
                                        {scannedPackage.weight_unit || 'KG'}
                                    </span>
                                </div>
                            </div>

                            {/* 5. Packaging Timing */}
                            <div className="p-3.5 bg-gray-50/80 border border-gray-200/80 rounded-[12px]">
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                    Packaging Timing
                                </span>
                                <span className="text-[14px] font-bold text-gray-800 block mt-0.5">
                                    {scannedPackage.raw_timing ||
                                        (scannedPackage.created_at
                                            ? new Date(scannedPackage.created_at).toLocaleString('en-IN', {
                                                  day: '2-digit',
                                                  month: 'short',
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                  second: '2-digit',
                                                  hour12: true,
                                              })
                                            : 'N/A')}
                                </span>
                            </div>

                            {/* 6. Inventory Stock Status & Movement */}
                            <div className="p-3.5 bg-gray-50/80 border border-gray-200/80 rounded-[12px] flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                                        Inventory Stock Status
                                    </span>
                                    <span className="text-[14px] font-extrabold mt-0.5 block">
                                        {scannedPackage.inventory_status === 'INVENTORY_OUT' ? (
                                            <span className="text-purple-700">Dispatched (Inventory Out)</span>
                                        ) : (
                                            <span className="text-emerald-700">In Stock (Warehouse Inventory)</span>
                                        )}
                                    </span>
                                    {scannedPackage.dispatched_at && (
                                        <span className="text-[11px] text-gray-500 block">
                                            Dispatched on: {new Date(scannedPackage.dispatched_at).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                {scannedPackage.inventory_status !== 'INVENTORY_OUT' && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleQuickDispatch(scannedPackage);
                                        }}
                                        disabled={dispatchingPackageId === scannedPackage.id}
                                        className="px-3.5 py-1.5 bg-[#073318] hover:bg-[#04200f] text-white rounded-[8px] text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                                    >
                                        <ArrowUpRight size={14} />
                                        <span>Dispatch Out</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setScannedPackage(null)}
                                className="px-5 h-[42px] border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-[10px] text-[13px] transition-colors"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setReprintModalPkg(scannedPackage);
                                }}
                                className="px-5 h-[42px] bg-[#073318] hover:bg-[#04200f] text-white font-bold rounded-[10px] text-[13px] flex items-center gap-2 shadow-sm transition-all"
                            >
                                <Printer size={16} />
                                <span>Reprint Label</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reprint Modal */}
            {reprintModalPkg && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[16px] shadow-2xl p-6 max-w-md w-full border border-gray-100 animate-in fade-in zoom-in-95">
                        <h3 className="text-[17px] font-bold text-gray-900 mb-2">Reprint Thermal Label</h3>
                        <p className="text-[13px] text-gray-600 mb-4">
                            Reprinting label for serial: <span className="font-mono font-bold text-[#073318]">{reprintModalPkg.serial_number}</span>
                        </p>
                        <label className="block text-[12px] font-semibold text-gray-700 mb-1">Reason for Reprint</label>
                        <select
                            value={reprintReason}
                            onChange={(e) => setReprintReason(e.target.value)}
                            className="w-full h-[40px] border border-gray-300 rounded-[10px] px-3 text-[13px] outline-none focus:border-[#073318] mb-5"
                        >
                            <option value="Damaged barcode label">Damaged barcode label</option>
                            <option value="Printer ribbon/roll jammed">Printer ribbon/roll jammed</option>
                            <option value="Mislabeled container replacement">Mislabeled container replacement</option>
                            <option value="Audited quality inspection reprint">Audited quality inspection reprint</option>
                        </select>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setReprintModalPkg(null)}
                                className="px-4 h-[38px] rounded-[10px] text-[13px] font-semibold text-gray-600 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecuteReprint}
                                disabled={isReprinting}
                                className="px-4 h-[38px] rounded-[10px] text-[13px] font-bold bg-[#073318] text-white hover:bg-[#04200f] disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <Printer size={16} />
                                <span>{isReprinting ? 'Printing...' : 'Confirm Reprint'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManufacturerDashboard;
