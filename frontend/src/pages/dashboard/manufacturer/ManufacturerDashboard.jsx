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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ScrollableTable from '../../../components/common/ScrollableTable';
import toast from 'react-hot-toast';
import { getProducts } from '../../../services/productService';
import { previewLabelsPdf, getPackageHistory } from '../../../services/manufacturerService';

const ManufacturerDashboard = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const { id } = useParams();

    // Toolbar states
    const [searchQuery, setSearchQuery] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [generatingPreview, setGeneratingPreview] = useState(false);

    // Filters State
    const [filterProduct, setFilterProduct] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterLabelStatus, setFilterLabelStatus] = useState('');
    const [filterPrintStatus, setFilterPrintStatus] = useState('');
    const [showFilterBar, setShowFilterBar] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Table Data (Packages / Label History)
    const [packages, setPackages] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(false);
    const [packageError, setPackageError] = useState(null);

    // Active products loaded from existing verified ProductMaster API
    const [productsList, setProductsList] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productError, setProductError] = useState(null);
    const isFetchingProductsRef = useRef(false);

    // Add Package Form State (Manual Package Entry)
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [manualNetWeight, setManualNetWeight] = useState('');
    const [weightUnit, setWeightUnit] = useState('kg');
    const [machineId, setMachineId] = useState('M01');
    const [plantCode, setPlantCode] = useState('AB');
    const [labelSize, setLabelSize] = useState('100x50');
    const [formErrors, setFormErrors] = useState({});
    const [formStep, setFormStep] = useState('entry'); // 'entry' | 'review'

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

    // Close export dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportRef.current && !exportRef.current.contains(event.target)) {
                setIsExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // Filter packages across search query and dedicated filters
    const filteredPackages = useMemo(() => {
        let result = packages || [];

        // Search query across all supported table fields
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((p) => {
                const serial = (p.serial_number || p.package_number || '').toLowerCase();
                const prodName = (p.product_name || p.product?.product_name || p.product?.name || '').toLowerCase();
                const prodCode = (p.product_code || p.product?.product_code || '').toLowerCase();
                const plant = (p.plant_code || '').toLowerCase();
                const machine = (p.machine_id || '').toLowerCase();
                const labelStatus = (p.label_status || p.status || '').toLowerCase();
                const printStatus = (p.print_status || '').toLowerCase();
                return (
                    serial.includes(q) ||
                    prodName.includes(q) ||
                    prodCode.includes(q) ||
                    plant.includes(q) ||
                    machine.includes(q) ||
                    labelStatus.includes(q) ||
                    printStatus.includes(q)
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

        return result;
    }, [packages, searchQuery, filterProduct, filterDateFrom, filterDateTo, filterLabelStatus, filterPrintStatus]);

    const hasActiveFilters = Boolean(
        searchQuery.trim() ||
        filterProduct ||
        filterDateFrom ||
        filterDateTo ||
        filterLabelStatus ||
        filterPrintStatus
    );

    const handleResetFilters = () => {
        setSearchQuery('');
        setFilterProduct('');
        setFilterDateFrom('');
        setFilterDateTo('');
        setFilterLabelStatus('');
        setFilterPrintStatus('');
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


    // Sample format generator for illustrative display only (not an allocated sequence)
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
        setMachineId('M01');
        setPlantCode('AB');
        setLabelSize('100x50');
        setFormErrors({});
        setFormStep('entry');
        navigate('/seller/manufacturer');
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
                labelSize: labelSize === '75x50' ? '75x50' : '100x50',
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

    return (
        <div className="flex flex-col relative w-full h-full font-['Plus_Jakarta_Sans'] pb-10">
            {/* Header & Primary Action Button */}
            <div className="flex flex-col gap-1 mb-4 md:mb-6">
                <div className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
                            {t('modules:manufacturer', 'Manufacturer')}
                        </h2>
                        <p className="text-[#6B7280] text-[13px] md:text-[14px] font-medium mt-1">
                            {t(
                                'modules:manufacturer_master_desc',
                                'Weigh packages, generate thermal barcode labels, and monitor plant output.'
                            )}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/seller/manufacturer/add')}
                        className="flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-5 h-[42px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0"
                    >
                        <Plus size={18} />
                        <span>{t('modules:weigh_and_register', 'Weigh & Register')}</span>
                    </button>
                </div>
            </div>

            {/* Desktop Action Toolbar & Filter Toggle */}
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 mb-4 shadow-sm">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('common:search_packages', 'Search by serial, product, code, machine, status...')}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full h-[40px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] focus:bg-white transition-all placeholder:text-gray-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setCurrentPage(1);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Right Tool Buttons */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                        {/* Filter Toggle */}
                        <button
                            onClick={() => setShowFilterBar(!showFilterBar)}
                            className={`h-[40px] px-3.5 flex items-center gap-2 border rounded-[10px] text-[13px] font-semibold transition-all ${
                                showFilterBar || hasActiveFilters
                                    ? 'bg-[#073318]/10 border-[#073318] text-[#073318]'
                                    : 'border-[#E5E7EB] hover:bg-gray-50 text-gray-700'
                            }`}
                            title="Toggle Filters"
                        >
                            <Filter size={16} />
                            <span>{t('common:filters', 'Filters')}</span>
                            {hasActiveFilters && (
                                <span className="w-2 h-2 rounded-full bg-[#073318]"></span>
                            )}
                        </button>

                        {/* Reset Filters (Only if active) */}
                        {hasActiveFilters && (
                            <button
                                onClick={handleResetFilters}
                                className="h-[40px] px-3 flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 rounded-[10px] text-[12px] font-semibold text-gray-600 transition-colors"
                                title="Reset all filters"
                            >
                                <RotateCcw size={14} />
                                <span className="hidden sm:inline">Reset</span>
                            </button>
                        )}

                        {/* Refresh */}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loadingProducts || loadingPackages}
                            className="h-[40px] w-[40px] flex items-center justify-center border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50"
                            title={t('common:refresh', 'Refresh Data')}
                        >
                            <RefreshCw size={17} className={refreshing || loadingPackages ? 'animate-spin text-[#073318]' : ''} />
                        </button>

                        {/* Export Menu */}
                        <div className="relative" ref={exportRef}>
                            <button
                                onClick={() => {
                                    if (filteredPackages.length > 0) {
                                        setIsExportOpen(!isExportOpen);
                                    }
                                }}
                                disabled={filteredPackages.length === 0}
                                title={
                                    filteredPackages.length === 0
                                        ? t('common:export_unavailable_empty', 'Export unavailable (No records)')
                                        : t('common:export', 'Export')
                                }
                                className={`h-[40px] px-3.5 flex items-center gap-2 border rounded-[10px] text-[13px] font-semibold transition-colors ${
                                    filteredPackages.length === 0
                                        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-70'
                                        : 'border-[#E5E7EB] hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <Download size={16} />
                                <span>{t('common:export', 'Export')}</span>
                            </button>
                            {isExportOpen && filteredPackages.length > 0 && (
                                <div className="absolute right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button
                                        onClick={() => setIsExportOpen(false)}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[13px] font-medium text-gray-700"
                                    >
                                        <FileSpreadsheet size={16} className="text-emerald-600" />
                                        <span>Excel (.xlsx)</span>
                                    </button>
                                    <button
                                        onClick={() => setIsExportOpen(false)}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[13px] font-medium text-gray-700 border-t border-gray-50"
                                    >
                                        <FileText size={16} className="text-rose-500" />
                                        <span>PDF Document</span>
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
                    {/* Notice Banner */}
                    <div className="bg-[#F8FAF0] border-b border-[#E5E7EB] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Scale size={18} className="text-[#073318] shrink-0" />
                            <span className="text-[13px] font-semibold text-[#073318]">
                                Manufacturer Packaging Station — Created Labels & Packages
                            </span>
                        </div>
                        <span className="text-[12px] text-gray-500 font-medium">
                            {filteredPackages.length} {filteredPackages.length === 1 ? 'record' : 'records'}
                        </span>
                    </div>

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
                                onClick={() => navigate('/seller/manufacturer/add')}
                                className="inline-flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-5 h-[42px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm"
                            >
                                <Plus size={18} />
                                <span>Weigh & Register Package</span>
                            </button>
                        </div>
                    ) : filteredPackages.length === 0 ? (
                        /* 4. Filter Empty State: Search or filter returned 0 matches */
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
                                <Search size={26} />
                            </div>
                            <h3 className="text-[16px] font-bold text-gray-900 mb-1">
                                No Matching Records Found
                            </h3>
                            <p className="text-[13px] text-gray-500 max-w-md mb-4">
                                No label records match your search query or applied filters. Try adjusting your parameters.
                            </p>
                            <button
                                onClick={handleResetFilters}
                                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-[13px] font-semibold transition-all shadow-sm"
                            >
                                <RotateCcw size={14} />
                                <span>Reset All Filters</span>
                            </button>
                        </div>
                    ) : (
                        /* 5. Populated Table State */
                        <div>
                            <ScrollableTable maxHeight="calc(100vh - 350px)">
                                <table className="w-full text-left border-collapse min-w-[900px]">
                                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] sticky top-0 z-10">
                                        <tr>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Serial Number
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Product Name
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Product Code
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Plant Code
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Machine ID
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Net Weight
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Created At
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Label Status
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                                Print Status
                                            </th>
                                            <th className="py-3 px-4 text-[12px] font-bold text-gray-600 uppercase tracking-wider text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPackages.map((pkg, idx) => (
                                            <tr
                                                key={pkg.id || idx}
                                                className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors"
                                            >
                                                {/* 1. Serial Number */}
                                                <td className="py-3.5 px-4 font-mono font-bold text-[13px] text-[#073318]">
                                                    {pkg.serial_number || pkg.package_number || '—'}
                                                </td>

                                                {/* 2. Product Name */}
                                                <td className="py-3.5 px-4 text-[14px] text-gray-900 font-medium max-w-[200px] truncate">
                                                    {pkg.product_name || pkg.product?.product_name || pkg.product?.name || '—'}
                                                </td>

                                                {/* 3. Product Code */}
                                                <td className="py-3.5 px-4 font-mono text-[12px] text-gray-600">
                                                    {pkg.product_code || pkg.product?.product_code || '—'}
                                                </td>

                                                {/* 4. Plant Code */}
                                                <td className="py-3.5 px-4 text-[13px] font-mono font-semibold text-gray-700">
                                                    {pkg.plant_code || '—'}
                                                </td>

                                                {/* 5. Machine ID */}
                                                <td className="py-3.5 px-4 text-[13px] font-mono text-gray-700">
                                                    {pkg.machine_id || '—'}
                                                </td>

                                                {/* 6. Net Weight */}
                                                <td className="py-3.5 px-4 text-[14px] text-gray-900 font-semibold whitespace-nowrap">
                                                    {pkg.net_weight !== undefined && pkg.net_weight !== null
                                                        ? `${Number(pkg.net_weight).toFixed(2)} ${pkg.weight_unit || 'kg'}`
                                                        : '—'}
                                                </td>

                                                {/* 7. Created At */}
                                                <td className="py-3.5 px-4 text-[12px] text-gray-500 whitespace-nowrap">
                                                    {formatDate(pkg.created_at)}
                                                </td>

                                                {/* 8. Label Status */}
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {pkg.label_status === 'CREATED' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Created
                                                        </span>
                                                    ) : pkg.label_status === 'PREVIEWED' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                            Previewed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                            {pkg.label_status || 'Draft'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 9. Print Status */}
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {pkg.print_status === 'PRINTED' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Printed
                                                        </span>
                                                    ) : pkg.print_status === 'PENDING' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                            Pending
                                                        </span>
                                                    ) : pkg.print_status === 'NOT_PRINTED' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                            Not Printed
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-gray-400 italic">
                                                            Not Tracked
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 10. Actions */}
                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <button
                                                        onClick={() => navigate(`/seller/manufacturer/view/${pkg.id || pkg.serial_number}`)}
                                                        className="p-1.5 text-gray-500 hover:text-[#073318] hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={17} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ScrollableTable>

                            {/* Pagination Controls */}
                            <div className="px-4 py-3 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
                                <div className="text-[13px] text-gray-500">
                                    Showing{' '}
                                    <span className="font-semibold text-gray-700">
                                        {(currentPage - 1) * itemsPerPage + 1}
                                    </span>{' '}
                                    to{' '}
                                    <span className="font-semibold text-gray-700">
                                        {Math.min(currentPage * itemsPerPage, filteredPackages.length)}
                                    </span>{' '}
                                    of{' '}
                                    <span className="font-semibold text-gray-700">
                                        {filteredPackages.length}
                                    </span>{' '}
                                    records
                                </div>

                                <div className="flex items-center gap-2">
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="h-[32px] bg-white border border-[#E5E7EB] rounded-[6px] px-2 text-[12px] font-medium outline-none text-gray-700"
                                    >
                                        <option value={10}>10 / page</option>
                                        <option value={25}>25 / page</option>
                                        <option value={50}>50 / page</option>
                                    </select>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            className="h-[32px] w-[32px] flex items-center justify-center border border-[#E5E7EB] rounded-[6px] hover:bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-[12px] font-semibold text-gray-700 px-2">
                                            {currentPage} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage >= totalPages}
                                            className="h-[32px] w-[32px] flex items-center justify-center border border-[#E5E7EB] rounded-[6px] hover:bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : currentView.type === 'add' ? (
                /* Add / Weigh Package Modal View (Manual Package Entry) */
                <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-6 shadow-sm max-w-3xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* Modal Header & Step Indicator */}
                    <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#073318]/10 flex items-center justify-center text-[#073318]">
                                <Scale size={20} />
                            </div>
                            <div>
                                <h3 className="text-[18px] font-bold text-[#111827]">
                                    {formStep === 'entry'
                                        ? t('modules:manual_package_entry', 'Manual Package Entry')
                                        : t('modules:review_and_preview', 'Review Package & Label Preview')}
                                </h3>
                                <p className="text-[13px] text-[#6B7280]">
                                    {formStep === 'entry'
                                        ? t('modules:manual_package_entry_desc', 'Enter measured package details manually without physical hardware')
                                        : t('modules:review_package_desc', 'Verify entered values and generate thermal label preview')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCloseAddView}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                            title={t('common:close', 'Close')}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Step Navigation Pills */}
                    <div className="flex items-center gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
                        <button
                            type="button"
                            onClick={handleBackToEntry}
                            className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                                formStep === 'entry'
                                    ? 'bg-white text-[#073318] shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full bg-[#073318]/10 text-[#073318] text-[11px] flex items-center justify-center font-bold">1</span>
                            <span>{t('modules:step_manual_entry', '1. Manual Entry')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleProceedToReview}
                            className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                                formStep === 'review'
                                    ? 'bg-white text-[#073318] shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full bg-[#073318]/10 text-[#073318] text-[11px] flex items-center justify-center font-bold">2</span>
                            <span>{t('modules:step_review_preview', '2. Review & Preview')}</span>
                        </button>
                    </div>

                    {formStep === 'entry' ? (
                        /* STEP 1: FORM ENTRY */
                        <form onSubmit={handleProceedToReview} className="space-y-5">
                            {/* Manual Entry Notice Banner */}
                            <div className="bg-amber-50/80 border border-amber-200 rounded-[12px] p-3.5 flex items-start gap-3">
                                <Info size={18} className="text-amber-700 shrink-0 mt-0.5" />
                                <div className="text-[12px] text-amber-900 leading-relaxed">
                                    <strong>{t('modules:manual_mode_notice_title', 'Manual Packaging Station:')}</strong>{' '}
                                    {t(
                                        'modules:manual_mode_notice_body',
                                        'Physical weighing scale, hardware button, and direct thermal printer are not connected. All weights and machine identifiers must be verified and entered manually by the operator.'
                                    )}
                                </div>
                            </div>

                            {/* 1. Real Product Selection from Product Master */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[13px] font-bold text-gray-700">
                                        {t('modules:select_product', 'Select Product (From Product Master)')} *
                                    </label>
                                    {loadingProducts && (
                                        <span className="flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
                                            <RefreshCw size={12} className="animate-spin text-[#073318]" />
                                            {t('modules:loading_products', 'Loading active products...')}
                                        </span>
                                    )}
                                </div>

                                <select
                                    value={selectedProduct ? selectedProduct.id : ''}
                                    onChange={(e) => handleProductSelect(e.target.value)}
                                    disabled={loadingProducts || productsList.length === 0}
                                    className={`w-full h-[44px] bg-white border rounded-[10px] px-3.5 text-[14px] outline-none shadow-sm font-medium transition-all ${
                                        formErrors.product
                                            ? 'border-rose-400 focus:border-rose-600 bg-rose-50/30'
                                            : 'border-[#E5E7EB] focus:border-[#073318]'
                                    } disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`}
                                >
                                    {loadingProducts ? (
                                        <option value="">Loading active products from Product Master...</option>
                                    ) : productsList.length === 0 ? (
                                        <option value="">No active products found in Product Master</option>
                                    ) : (
                                        <>
                                            <option value="">-- Select Active Product --</option>
                                            {productsList.map((prod) => (
                                                <option key={prod.id} value={prod.id}>
                                                    {prod.name || prod.product_name} ({prod.product_code || prod.sku || 'No Code'})
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>

                                {formErrors.product && (
                                    <p className="text-[12px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                                        <AlertCircle size={14} />
                                        {formErrors.product}
                                    </p>
                                )}

                                {productError && (
                                    <p className="text-[12px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                                        <AlertCircle size={14} />
                                        {productError}
                                    </p>
                                )}

                                {selectedProduct && (
                                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-[10px] text-[13px] text-gray-700 space-y-1">
                                        <div><strong>Product Name:</strong> {selectedProduct.name || selectedProduct.product_name}</div>
                                        <div><strong>Product Code:</strong> {selectedProduct.product_code || selectedProduct.sku || '—'}</div>
                                        <div><strong>UOM:</strong> {selectedProduct.uom?.unit_name || selectedProduct.unit || 'KG'}</div>
                                    </div>
                                )}
                            </div>

                            {/* 2. Manual Net Weight Entry & Unit */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[13px] font-bold text-gray-700">
                                        {t('modules:net_weight', 'Net Weight')} *
                                    </label>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md">
                                        <Scale size={11} />
                                        <span>Source: Manual Entry</span>
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            placeholder="e.g. 5.09"
                                            value={manualNetWeight}
                                            onChange={(e) => {
                                                setManualNetWeight(e.target.value);
                                                if (formErrors.weight) {
                                                    setFormErrors((prev) => ({ ...prev, weight: undefined }));
                                                }
                                            }}
                                            className={`w-full h-[44px] bg-white border rounded-[10px] px-3.5 text-[14px] outline-none shadow-sm font-semibold transition-all ${
                                                formErrors.weight
                                                    ? 'border-rose-400 focus:border-rose-600 bg-rose-50/30'
                                                    : 'border-[#E5E7EB] focus:border-[#073318]'
                                            }`}
                                        />
                                    </div>
                                    <select
                                        value={weightUnit}
                                        onChange={(e) => setWeightUnit(e.target.value)}
                                        className="w-[100px] h-[44px] bg-white border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] font-bold uppercase outline-none focus:border-[#073318] shadow-sm"
                                    >
                                        <option value="kg">KG</option>
                                        <option value="g">G</option>
                                        <option value="ton">TON</option>
                                    </select>
                                </div>
                                {formErrors.weight ? (
                                    <p className="text-[12px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                                        <AlertCircle size={14} />
                                        {formErrors.weight}
                                    </p>
                                ) : (
                                    <p className="text-[12px] text-gray-500 mt-1">
                                        Enter the verified measured weight from the station scale.
                                    </p>
                                )}
                            </div>

                            {/* 3. Machine ID & Plant Code */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-[13px] font-bold text-gray-700">
                                            {t('modules:machine_id', 'Machine / Station ID')} *
                                        </label>
                                        <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                            Manual
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={10}
                                        value={machineId}
                                        onChange={(e) => {
                                            setMachineId(e.target.value.toUpperCase());
                                            if (formErrors.machineId) {
                                                setFormErrors((prev) => ({ ...prev, machineId: undefined }));
                                            }
                                        }}
                                        placeholder="M01"
                                        className={`w-full h-[44px] bg-white border rounded-[10px] px-3.5 text-[14px] font-mono uppercase outline-none shadow-sm transition-all ${
                                            formErrors.machineId
                                                ? 'border-rose-400 focus:border-rose-600 bg-rose-50/30'
                                                : 'border-[#E5E7EB] focus:border-[#073318]'
                                        }`}
                                    />
                                    {formErrors.machineId ? (
                                        <p className="text-[12px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                                            <AlertCircle size={14} />
                                            {formErrors.machineId}
                                        </p>
                                    ) : (
                                        <p className="text-[12px] text-gray-500 mt-1">
                                            Packaging station or machine identifier (e.g. M01, LINE-02).
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-[13px] font-bold text-gray-700">
                                            {t('modules:plant_code', 'Plant Code (2 Characters)')} *
                                        </label>
                                        <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                            2 Chars
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={2}
                                        value={plantCode}
                                        onChange={(e) => {
                                            setPlantCode(e.target.value.toUpperCase());
                                            if (formErrors.plantCode) {
                                                setFormErrors((prev) => ({ ...prev, plantCode: undefined }));
                                            }
                                        }}
                                        placeholder="AB"
                                        className={`w-full h-[44px] bg-white border rounded-[10px] px-3.5 text-[14px] font-mono uppercase outline-none shadow-sm transition-all ${
                                            formErrors.plantCode
                                                ? 'border-rose-400 focus:border-rose-600 bg-rose-50/30'
                                                : 'border-[#E5E7EB] focus:border-[#073318]'
                                        }`}
                                    />
                                    {formErrors.plantCode ? (
                                        <p className="text-[12px] text-rose-600 mt-1.5 font-medium flex items-center gap-1">
                                            <AlertCircle size={14} />
                                            {formErrors.plantCode}
                                        </p>
                                    ) : (
                                        <p className="text-[12px] text-gray-500 mt-1">
                                            Manufacturing plant code (e.g. AB, P1).
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* 4. Label Size Selection */}
                            <div>
                                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                                    {t('modules:label_size', 'Thermal Label Size')} *
                                </label>
                                <select
                                    value={labelSize}
                                    onChange={(e) => setLabelSize(e.target.value)}
                                    className="w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[10px] px-3.5 text-[14px] outline-none focus:border-[#073318] shadow-sm font-medium"
                                >
                                    <option value="100x50">100 × 50 mm (Standard Bag Label — 4 × 2 in)</option>
                                    <option value="75x50">75 × 50 mm (Compact Bag / Drum Label — 3 × 2 in)</option>
                                </select>
                            </div>

                            {/* 5. Sample Format Live Calculation */}
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-[12px]">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                        Provisional Serial Format Preview
                                    </span>
                                    <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                        Not Allocated in Database
                                    </span>
                                </div>
                                <div className="text-[20px] font-mono font-bold text-[#073318]">
                                    {sampleFullSerial}
                                </div>
                                <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">
                                    <strong>Notice:</strong> This format demonstrates the complete Code 128 serial string including the entered Machine ID ({machineId || 'M01'}). The actual sequence number will be sequentially allocated by the server during database registration.
                                </p>
                            </div>

                            {/* Form Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={handleCloseAddView}
                                    className="w-full sm:w-auto px-5 h-[42px] rounded-[10px] text-[14px] font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    {t('common:cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[42px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98]"
                                >
                                    <span>{t('modules:proceed_to_review', 'Proceed to Review')}</span>
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* STEP 2: REVIEW & LABEL PREVIEW */
                        <div className="space-y-5">
                            {/* Review Step Card */}
                            <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                    <div className="flex items-center gap-2 text-[#073318]">
                                        <CheckCircle2 size={18} />
                                        <h4 className="text-[15px] font-bold text-gray-900">
                                            {t('modules:package_review_summary', 'Package Configuration Summary')}
                                        </h4>
                                    </div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                                        Manual Review
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
                                    <div className="p-3 bg-gray-50 rounded-[10px] space-y-1">
                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                            Product Details
                                        </div>
                                        <div className="font-bold text-gray-900 text-[14px]">
                                            {selectedProduct ? (selectedProduct.name || selectedProduct.product_name) : '—'}
                                        </div>
                                        <div className="text-gray-600 font-mono text-[12px]">
                                            Code: {selectedProduct ? (selectedProduct.product_code || selectedProduct.sku || '—') : '—'}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gray-50 rounded-[10px] space-y-1">
                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                            Net Weight (Manual Entry)
                                        </div>
                                        <div className="font-bold text-gray-900 text-[16px]">
                                            {parseFloat(manualNetWeight || '0').toFixed(2)} {weightUnit.toUpperCase()}
                                        </div>
                                        <div className="text-amber-800 text-[11px] font-semibold">
                                            Reading Source: MANUAL (Scale disconnected)
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gray-50 rounded-[10px] space-y-1">
                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                            Station & Plant
                                        </div>
                                        <div className="font-medium text-gray-900">
                                            Machine ID: <span className="font-mono font-bold text-[#073318]">{machineId.toUpperCase()}</span> (Manual)
                                        </div>
                                        <div className="text-gray-600">
                                            Plant Code: <span className="font-mono font-bold">{plantCode.toUpperCase()}</span>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gray-50 rounded-[10px] space-y-1">
                                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                            Label Dimensions
                                        </div>
                                        <div className="font-bold text-gray-900">
                                            {labelSize === '75x50' ? '75 × 50 mm (Compact)' : '100 × 50 mm (Standard)'}
                                        </div>
                                        <div className="text-gray-600 text-[12px]">
                                            Barcode: Code 128 Vector
                                        </div>
                                    </div>
                                </div>

                                {/* Provisional Serial Display */}
                                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-[10px]">
                                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                                        Provisional Barcode Content
                                    </div>
                                    <div className="font-mono font-bold text-[18px] text-[#073318]">
                                        {sampleFullSerial}
                                    </div>
                                    <div className="text-[11px] text-emerald-700 mt-1">
                                        Will be rendered as vector Code 128 barcode directly in the preview label PDF.
                                    </div>
                                </div>
                            </div>

                            {/* Informative Warning Card */}
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-[12px] flex items-start gap-3">
                                <AlertCircle size={20} className="text-amber-700 shrink-0 mt-0.5" />
                                <div className="text-[12px] text-amber-900 leading-relaxed space-y-1">
                                    <div><strong>Notice: Preview Document Only.</strong></div>
                                    <div>
                                        Generating this preview creates a thermal label PDF with a synthetic watermark for layout and barcode verification. It does <em>not</em> reserve a serial number in the database, register a production package, or send commands to any physical printer.
                                    </div>
                                    <div>
                                        <strong>Register & Print</strong> is locked pending database schema approval and print-job service integration.
                                    </div>
                                </div>
                            </div>

                            {/* Review Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={handleBackToEntry}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-[42px] rounded-[10px] text-[14px] font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <ArrowLeft size={16} />
                                    <span>{t('modules:back_to_edit', 'Back to Edit')}</span>
                                </button>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    {/* Preview Thermal Label PDF */}
                                    <button
                                        type="button"
                                        onClick={handleGeneratePreview}
                                        disabled={generatingPreview}
                                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 h-[42px] rounded-[10px] text-[14px] font-bold border-2 border-[#073318] text-[#073318] hover:bg-[#073318]/5 transition-all shadow-sm disabled:opacity-50"
                                    >
                                        {generatingPreview ? (
                                            <RefreshCw size={16} className="animate-spin text-[#073318]" />
                                        ) : (
                                            <Printer size={16} />
                                        )}
                                        <span>{generatingPreview ? t('modules:generating', 'Generating...') : t('modules:preview_label_pdf', 'Preview Label PDF')}</span>
                                    </button>

                                    {/* Locked Register & Print Button */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            toast.error(
                                                'Package registration and printing are disabled pending database schema approval and print-job handling.'
                                            );
                                        }}
                                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 h-[42px] rounded-[10px] text-[14px] font-bold bg-gray-200 text-gray-500 cursor-not-allowed hover:bg-gray-300/80 transition-all shadow-sm"
                                        title="Locked pending database approval"
                                    >
                                        <Lock size={15} />
                                        <span>Register & Print (Awaiting DB)</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : currentView.type === 'view' ? (
                /* Package View Unavailable State */
                <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-8 shadow-sm max-w-xl mx-auto text-center animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h3 className="text-[18px] font-bold text-gray-900 mb-2">
                        Package Record Unavailable
                    </h3>
                    <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
                        Package details for{' '}
                        <span className="font-mono font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded">
                            #{id || 'Unknown'}
                        </span>{' '}
                        cannot be displayed because package persistence is not yet implemented.
                    </p>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-[10px] text-left text-[12px] text-gray-600 mb-6">
                        <strong>Status:</strong> Storing and viewing historical packages requires backend schema approval and database persistence. No fake package records or mock details are generated.
                    </div>
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => navigate('/seller/manufacturer')}
                            className="inline-flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-5 h-[40px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm hover:shadow"
                        >
                            Back to Manufacturer
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ManufacturerDashboard;
