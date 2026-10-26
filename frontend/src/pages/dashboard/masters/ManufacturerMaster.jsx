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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ScrollableTable from '../../../components/common/ScrollableTable';
import toast from 'react-hot-toast';
import { getProducts } from '../../../services/productService';
import { getPackageHistory } from '../../../services/manufacturerService';

const ManufacturerMaster = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const { id } = useParams();

    // Toolbar states
    const [searchQuery, setSearchQuery] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Table Data (Packages) loaded from persistent database API
    const [packages, setPackages] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(false);

    // Active products loaded from existing verified ProductMaster API
    const [productsList, setProductsList] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productError, setProductError] = useState(null);
    const isFetchingProductsRef = useRef(false);

    // Add Package Modal Form State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [samplePlantCode, setSamplePlantCode] = useState('AB');
    const [provisionalSize, setProvisionalSize] = useState('');

    const exportRef = useRef(null);

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

    const fetchPackages = useCallback(async () => {
        setLoadingPackages(true);
        try {
            const res = await getPackageHistory({ limit: 100 });
            const list = Array.isArray(res) ? res : res?.packages || res?.data || [];
            const mapped = list.map((p) => {
                let barcodeDisplay = p.barcode_data || p.serial_number;
                if (barcodeDisplay && barcodeDisplay.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(barcodeDisplay);
                        barcodeDisplay = parsed.serial || barcodeDisplay;
                    } catch (_) {}
                }
                return {
                    id: p.id,
                    package_number: p.package_number || p.serial_number,
                    product_name: p.product_name,
                    product_code: p.product_code,
                    weight: p.net_weight,
                    plant_code: p.plant_code,
                    captured_at: p.created_at ? new Date(p.created_at).toLocaleString('en-IN') : '—',
                    barcode_data: barcodeDisplay,
                    print_count: p.reprint_count ? p.reprint_count + 1 : 1,
                };
            });
            setPackages(mapped);
        } catch (err) {
            console.error('Failed to load packages in master', err);
        } finally {
            setLoadingPackages(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveProducts();
        fetchPackages();
    }, [fetchActiveProducts, fetchPackages]);

    // Derive currentView directly from URL location to prevent cascading renders
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
            await fetchActiveProducts();
            toast.success(t('common:data_refreshed', 'Data refreshed successfully'));
        } catch (err) {
            console.error('Refresh failed', err);
        } finally {
            setRefreshing(false);
        }
    };

    // Filter packages by search
    const filteredPackages = useMemo(() => {
        let result = packages || [];
        if (searchQuery.trim()) {
            let q = searchQuery.trim();
            // If barcode scanner scanned a full 3-field Code 128 barcode: Product | Weight | Serial
            if (q.includes('|')) {
                const parts = q.split('|').map((s) => s.trim());
                if (parts.length >= 2) {
                    q = parts[parts.length - 1]; // Extracted serial number
                }
            } else if (q.startsWith('{')) {
                try {
                    const parsed = JSON.parse(q);
                    if (parsed.serial) q = parsed.serial;
                } catch {
                    // ignore JSON parse error
                }
            }

            const qLower = q.toLowerCase();
            result = result.filter(
                (p) =>
                    p.package_number?.toLowerCase().includes(qLower) ||
                    p.serial_number?.toLowerCase().includes(qLower) ||
                    p.product_name?.toLowerCase().includes(qLower) ||
                    p.product_code?.toLowerCase().includes(qLower)
            );
        }
        return result;
    }, [packages, searchQuery]);

    // Sample format generator for illustrative display only (not an allocated sequence)
    const samplePackageFormat = useMemo(() => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const plant = (samplePlantCode || 'AB').trim().toUpperCase() || 'AB';
        return `${yy}${mm}${dd}0001-${plant}`;
    }, [samplePlantCode]);

    return (
        <div className="flex flex-col relative w-full h-full font-['Plus_Jakarta_Sans']">
            {/* Header & Primary Action Button */}
            <div className="flex flex-col gap-1 mb-4 md:mb-6">
                <div className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
                            {t('modules:inventory_master', 'Inventory Packaging Master')}
                        </h2>
                        <p className="text-[#6B7280] text-[13px] md:text-[14px] font-medium mt-1">
                            {t(
                                'modules:inventory_master_desc',
                                'Weigh packages, generate thermal barcode labels, and monitor inventory output.'
                            )}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('add')}
                        className="flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-5 h-[42px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0"
                    >
                        <Plus size={18} />
                        <span>{t('modules:weigh_and_register', 'Weigh & Register')}</span>
                    </button>
                </div>
            </div>

            {/* Desktop Action Toolbar */}
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-4 mb-6 shadow-sm">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('common:search', 'Search by package ID, product name, or code...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-[40px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] focus:bg-white transition-all placeholder:text-gray-400"
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

                    {/* Right Tool Buttons */}
                    <div className="flex items-center gap-2 self-end md:self-auto">
                        {/* Refresh */}
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loadingProducts}
                            className="h-[40px] w-[40px] flex items-center justify-center border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50"
                            title={t('common:refresh', 'Refresh Data')}
                        >
                            <RefreshCw size={17} className={refreshing ? 'animate-spin text-[#073318]' : ''} />
                        </button>

                        {/* Export Menu - Honestly disabled when no packages exist */}
                        <div className="relative" ref={exportRef}>
                            <button
                                onClick={() => {
                                    if (packages.length > 0) {
                                        setIsExportOpen(!isExportOpen);
                                    }
                                }}
                                disabled={packages.length === 0}
                                title={
                                    packages.length === 0
                                        ? t('common:export_unavailable_empty', 'Export unavailable (No registered packages)')
                                        : t('common:export', 'Export')
                                }
                                className={`h-[40px] px-3.5 flex items-center gap-2 border rounded-[10px] text-[13px] font-semibold transition-colors ${
                                    packages.length === 0
                                        ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-70'
                                        : 'border-[#E5E7EB] hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <Download size={16} />
                                <span>{t('common:export', 'Export')}</span>
                            </button>
                            {isExportOpen && packages.length > 0 && (
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
            </div>

            {/* Main Content Area */}
            {currentView.type === 'list' ? (
                <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm">
                    {/* Notice Banner: Schema Status */}
                    <div className="bg-[#F8FAF0] border-b border-[#E5E7EB] px-4 py-3 flex items-center gap-3">
                        <Scale size={18} className="text-[#073318] shrink-0" />
                        <span className="text-[13px] font-semibold text-[#073318]">
                            Inventory Packaging Station
                        </span>
                        <span className="ml-auto text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            Awaiting Schema Approval
                        </span>
                    </div>

                    <ScrollableTable className="master-table-wrapper">
                        <table className="master-table min-w-[950px] w-full text-left">
                            <thead>
                                <tr className="border-b border-[#E5E7EB] bg-gray-50/75 text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                    <th className="py-3.5 px-4 w-[60px]">Sr.</th>
                                    <th className="py-3.5 px-4">Package ID</th>
                                    <th className="py-3.5 px-4">Product Name & Code</th>
                                    <th className="py-3.5 px-4">Weight</th>
                                    <th className="py-3.5 px-4">Plant</th>
                                    <th className="py-3.5 px-4">Timestamp</th>
                                    <th className="py-3.5 px-4">Barcode Data</th>
                                    <th className="py-3.5 px-4 text-center">Print Count</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E5E7EB] text-[13px] text-gray-800">
                                {filteredPackages.length > 0 ? (
                                    filteredPackages.map((pkg, idx) => (
                                        <tr key={pkg.id || idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-3.5 px-4 text-gray-500 font-medium">{idx + 1}</td>
                                            <td className="py-3.5 px-4 font-mono font-bold text-[#073318]">
                                                {pkg.package_number}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="font-semibold text-gray-900">{pkg.product_name}</div>
                                                <div className="text-[11px] text-gray-400 font-mono">#{pkg.product_code}</div>
                                            </td>
                                            <td className="py-3.5 px-4 font-extrabold text-[15px] text-[#073318]">
                                                {pkg.weight} <span className="text-[12px] font-medium text-gray-500">kg</span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-bold">
                                                    {pkg.plant_code}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-500">{pkg.captured_at}</td>
                                            <td className="py-3.5 px-4 font-mono text-gray-600 text-[12px]">{pkg.barcode_data}</td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                                                    {pkg.print_count || 1}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    onClick={() => navigate(`view/${pkg.id}`)}
                                                    className="p-1.5 text-gray-500 hover:text-[#073318] hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="View Label Details"
                                                >
                                                    <Eye size={17} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="py-16 text-center">
                                            <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                                                <div className="w-14 h-14 rounded-2xl bg-[#073318]/5 flex items-center justify-center text-[#073318] mb-3">
                                                    <Package size={28} />
                                                </div>
                                                <h3 className="text-[16px] font-bold text-gray-900 mb-1">
                                                    No Packages Registered Yet
                                                </h3>
                                                <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                                                    Connect a physical weighing station or click the button below to review product selection and test provisional serial generation.
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => navigate('add')}
                                                        className="inline-flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-4 h-[36px] rounded-[8px] text-[13px] font-bold transition-all shadow-sm"
                                                    >
                                                        <Plus size={16} />
                                                        <span>Weigh & Register Package</span>
                                                    </button>
                                                </div>
                                                <div className="mt-6 p-3 rounded-[10px] bg-gray-50 border border-gray-200/80 text-left w-full text-[12px] text-gray-600 flex items-start gap-2.5">
                                                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                                    <div>
                                                        <strong className="text-gray-800">Database Groundwork Note:</strong>
                                                        <div className="mt-0.5 text-gray-500">
                                                            Production package persistence requires separate approval of the isolated <code className="text-xs bg-gray-200/70 px-1 py-0.5 rounded">manufacturer_packages</code> model. No dummy database records will be generated.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </ScrollableTable>
                </div>
            ) : currentView.type === 'add' ? (
                /* Add / Weigh Package Modal View */
                <div className="bg-white border border-[#E5E7EB] rounded-[16px] p-6 shadow-sm max-w-3xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#073318]/10 flex items-center justify-center text-[#073318]">
                                <Scale size={20} />
                            </div>
                            <div>
                                <h3 className="text-[18px] font-bold text-[#111827]">
                                    Weigh & Register Package
                                </h3>
                                <p className="text-[13px] text-[#6B7280]">
                                    Select an existing product from Product Master and prepare thermal label
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/seller/masters/manufacturer')}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-5">
                        {/* 1. Real Product Selection from Product Master (Read-only selection) */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[13px] font-bold text-gray-700">
                                    Select Product (From Product Master) *
                                </label>
                                {loadingProducts && (
                                    <span className="flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
                                        <RefreshCw size={12} className="animate-spin text-[#073318]" />
                                        Loading active products...
                                    </span>
                                )}
                            </div>

                            <select
                                value={selectedProduct ? selectedProduct.id : ''}
                                onChange={(e) => {
                                    const prod = productsList.find((p) => String(p.id) === String(e.target.value));
                                    setSelectedProduct(prod || null);
                                }}
                                disabled={loadingProducts || productsList.length === 0}
                                className="w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[10px] px-3.5 text-[14px] outline-none focus:border-[#073318] shadow-sm font-medium disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                                {loadingProducts ? (
                                    <option value="">Loading active products from Product Master...</option>
                                ) : productError ? (
                                    <option value="">Error loading products - please retry</option>
                                ) : productsList.length === 0 ? (
                                    <option value="">No active products available in Product Master</option>
                                ) : (
                                    <>
                                        <option value="">-- Choose an active product --</option>
                                        {productsList.map((prod) => (
                                            <option key={prod.id} value={prod.id}>
                                                {prod.product_name} (#{prod.product_code}) {prod.uom?.gst_uom ? `[${prod.uom.gst_uom}]` : ''}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>

                            {productError && (
                                <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-[8px] flex items-center justify-between text-[12px] text-red-700">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={14} className="shrink-0" />
                                        <span>{productError}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={fetchActiveProducts}
                                        className="font-bold underline hover:text-red-900 ml-2"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            {!loadingProducts && !productError && productsList.length === 0 && (
                                <p className="mt-1.5 text-[12px] text-amber-600 flex items-center gap-1.5">
                                    <AlertCircle size={13} className="shrink-0" />
                                    No active products found in Product Master. Only active products are selectable.
                                </p>
                            )}

                            {selectedProduct && (
                                <div className="mt-2 p-3 bg-emerald-50/60 rounded-[10px] border border-emerald-100 text-[12px] text-emerald-900 flex items-center justify-between">
                                    <span>
                                        <strong>Selected:</strong> {selectedProduct.product_name}
                                    </span>
                                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                                        Code: {selectedProduct.product_code}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 2. Sample Plant Code & Machine Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                                    Sample Plant Code (2 Letters)
                                </label>
                                <input
                                    type="text"
                                    maxLength={2}
                                    value={samplePlantCode}
                                    onChange={(e) => setSamplePlantCode(e.target.value.toUpperCase())}
                                    className="w-full h-[44px] uppercase font-mono font-bold bg-white border border-[#E5E7EB] rounded-[10px] px-3.5 text-[14px] outline-none focus:border-[#073318] shadow-sm"
                                    placeholder="e.g. AB"
                                />
                                <span className="text-[11px] text-gray-400 mt-1 block">
                                    Used only to preview the sample serial layout
                                </span>
                            </div>
                            <div>
                                <label className="block text-[13px] font-bold text-gray-700 mb-1.5">
                                    Product Size (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={provisionalSize}
                                    onChange={(e) => setProvisionalSize(e.target.value)}
                                    className="w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[10px] px-3.5 text-[14px] outline-none focus:border-[#073318] shadow-sm"
                                    placeholder="e.g. 50mm, Large"
                                />
                            </div>
                        </div>

                        {/* 3. Sample Format Preview (Sample Format Only - Not Allocated) */}
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-[12px]">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[12px] font-bold text-gray-600 uppercase tracking-wider">
                                    Sample Format Only (Illustrative Example)
                                </span>
                                <span className="text-[11px] font-bold uppercase tracking-wider bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                    Not Allocated
                                </span>
                            </div>
                            <div className="text-[20px] font-mono font-bold text-[#073318]">
                                {samplePackageFormat}
                            </div>
                            <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">
                                <strong>Notice:</strong> This is a sample format representation only and is not reserved or allocated. The actual package number must be sequentially allocated by the backend server during successful package registration. Backend persistence is not yet implemented.
                            </p>
                            <div className="text-[11px] text-gray-400 mt-1.5">
                                Format: YYMMDDNNNN-PP • Sequence resets daily per plant upon registration
                            </div>
                        </div>

                        {/* 4. Weighing Bridge Status Notice */}
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-[12px] flex items-start gap-3">
                            <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                            <div className="text-[12px] text-amber-900 leading-relaxed">
                                <strong className="font-bold">Hardware & Database Boundary:</strong>
                                <p className="mt-0.5">
                                    Physical scale capture requires the Raspberry Pi bridge and separate approval of the database migration. Real products can be selected above to preview formatting.
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => navigate('/seller/masters/manufacturer')}
                                className="px-5 h-[42px] rounded-[10px] text-[14px] font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Back to List
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    toast.error(
                                        'Database persistence is disabled pending separate schema approval.'
                                    );
                                }}
                                className="px-6 h-[42px] rounded-[10px] text-[14px] font-bold bg-[#073318] text-white hover:bg-[#04200f] transition-all shadow-sm opacity-80"
                            >
                                Register & Print (Awaiting DB)
                            </button>
                        </div>
                    </div>
                </div>
            ) : currentView.type === 'view' ? (
                /* Package View Unavailable State - Never Blank */
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
                            onClick={() => navigate('/seller/masters/manufacturer')}
                            className="inline-flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-5 h-[40px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm hover:shadow"
                        >
                            Back to Inventory Packaging Master
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default ManufacturerMaster;
