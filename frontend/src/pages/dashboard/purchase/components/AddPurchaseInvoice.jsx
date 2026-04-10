import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
    ArrowLeft, Search, Trash2, Plus, Save, Printer, X,
    ChevronDown, Calendar, FileText, Percent, Hash,
    ChevronsUpDown, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '../../../../constants/routes';

import accountService from '../../../../services/accountService';
import productService from '../../../../services/productService';
import purchaseInvoiceService from '../../../../services/purchaseInvoiceService';
import grnService from '../../../../services/grnService';

const AddPurchaseInvoice = ({ onBack, initialData: propsInitialData, onSave, type = 'Invoice' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { t } = useTranslation(['modules', 'common']);
    const isEditMode = !!propsInitialData || !!id;
    const documentLabel = type === 'GRN' ? 'GRN' : 'Invoice';

    // Refs for date pickers
    const documentDateRef = useRef(null);
    const bookingDateRef = useRef(null);

    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    
    // Helper: Get Local Today String
    const getLocalToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Basic Form State
    const [formData, setFormData] = useState({
        supplier_id: '',
        supplier_name: '',
        address: '',
        document_number: '', // Invoice or GRN No
        gst_no: '',
        credit_days: '',
        document_date: getLocalToday(),
        booking_date: getLocalToday(),
        po_number: '',
        attachment: null
    });

    // Items Table State
    const [items, setItems] = useState([
        { 
            id: Date.now(), 
            product_id: null,
            product_code: '', 
            product_name: '', 
            quantity: 0, 
            rate: 0, 
            uom: '', 
            discount_amount: 0, 
            discount_percent: 0, 
            hsn: '', 
            tax_percent: 0, 
            before_tax: 0, 
            tax_amount: 0, 
            total_amount: 0, 
            description: '' 
        }
    ]);

    // UI States
    const [errors, setErrors] = useState({});
    const [showValidationPopup, setShowValidationPopup] = useState(false);
    const [tableSearch, setTableSearch] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState(null);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [products, setProducts] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch Suppliers
    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const response = await accountService.getAllAccounts({ 
                    groupName: 'SUNDRY_CREDITORS',
                    limit: 1000 
                });
                setSuppliers(response.data || []);
            } catch (error) {
                console.error("Error fetching suppliers:", error);
            }
        };
        fetchSuppliers();
    }, []);

    // Fetch Products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await productService.getProducts({ 
                    search: tableSearch.trim() || '',
                    limit: tableSearch.trim() ? 50 : 20 
                });
                setProducts(response.products || []);
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        const timer = setTimeout(fetchProducts, 150);
        return () => clearTimeout(timer);
    }, [tableSearch]);

    // Initialize Edit Mode / Initial Data
    useEffect(() => {
        if (propsInitialData) {
            setFormData({
                supplier_id: propsInitialData.supplier_id || '',
                supplier_name: propsInitialData.supplierName || '',
                credit_days: propsInitialData.cred || '',
                address: propsInitialData.address || '',
                document_date: propsInitialData.invoiceDate ? propsInitialData.invoiceDate.split('-').reverse().join('-') : getLocalToday(),
                booking_date: propsInitialData.bookingDate ? propsInitialData.bookingDate.split('-').reverse().join('-') : getLocalToday(),
                document_number: propsInitialData.invoiceNo || '',
                po_number: propsInitialData.poNo || '',
                gst_no: propsInitialData.gstNo || '',
                attachment: propsInitialData.attachment || null
            });
            setSupplierSearch(propsInitialData.supplierName || '');
            
            if (propsInitialData.items) {
                setItems(propsInitialData.items);
            }
        }
    }, [propsInitialData]);

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s => 
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase())
        );
    }, [supplierSearch, suppliers]);

    const filteredProducts = useMemo(() => {
        const addedProductIds = items.map(item => item.product_id).filter(id => id);
        const searchLower = tableSearch.toLowerCase();
        
        return (products || []).filter(p => {
            if (addedProductIds.includes(p.id)) return false;
            if (!tableSearch) return true;
            return (
                p.product_name?.toLowerCase().includes(searchLower) ||
                p.product_code?.toLowerCase().includes(searchLower) ||
                p.hsn_code?.toLowerCase().includes(searchLower)
            );
        });
    }, [products, items, tableSearch]);

    const handleSelectSupplier = (supplier) => {
        setFormData(prev => ({
            ...prev,
            supplier_id: supplier.id,
            supplier_name: supplier.accountName,
            address: (supplier.addressLine1 || '') + (supplier.addressLine2 ? ', ' + supplier.addressLine2 : ''),
            gst_no: supplier.gstNo || '',
            credit_days: supplier.supplierCreditDays || 0
        }));
        setSupplierSearch(supplier.accountName);
        setIsSupplierDropdownOpen(false);
        setErrors(prev => ({ ...prev, supplier_name: null }));
    };

    const handleQuickAddProduct = (product, targetIndex = null) => {
        const newItem = {
            id: Date.now(),
            product_id: product.id,
            product_code: product.product_code || '',
            product_name: product.product_name || '',
            rate: product.purchaseRate || 0,
            uom: product.uom?.unit_name || product.uom?.gst_uom || 'Nos',
            hsn: product.hsn_code || '',
            tax_percent: product.tax_rate || 0,
            quantity: 1,
            discount_amount: 0,
            discount_percent: 0,
            before_tax: (product.purchaseRate || 0).toFixed(2),
            tax_amount: ((product.purchaseRate || 0) * (product.tax_rate || 0) / 100).toFixed(2),
            total_amount: ((product.purchaseRate || 0) * (1 + (product.tax_rate || 0) / 100)).toFixed(2),
            description: product.description || ''
        };

        let updatedItems = [...items];
        const finalTargetIndex = targetIndex !== null ? targetIndex : updatedItems.findIndex(i => !i.product_name);
        
        if (finalTargetIndex !== -1) {
            updatedItems[finalTargetIndex] = newItem;
        } else {
            updatedItems = [...updatedItems, newItem];
        }

        const hasEmptyRow = updatedItems.some(i => !i.product_name);
        if (!hasEmptyRow) {
            updatedItems.push({
                id: Date.now() + 1,
                product_id: null,
                product_code: '',
                product_name: '',
                quantity: 0,
                rate: 0,
                uom: '',
                discount_amount: 0,
                discount_percent: 0,
                hsn: '',
                tax_percent: 0,
                before_tax: 0,
                tax_amount: 0,
                total_amount: 0,
                description: ''
            });
        }

        setItems(updatedItems);
        setTableSearch('');
        setIsProductSearchOpen(false);
        setActiveRowIndex(null);
        setSelectedSuggestionIndex(0);

        setTimeout(() => {
            const qtyInput = document.getElementById(`qty-${finalTargetIndex}`);
            if (qtyInput) qtyInput.focus();
        }, 100);
    };

    const handleSearchKeyDown = (e, index) => {
        if (!isProductSearchOpen || activeRowIndex !== index) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => prev < filteredProducts.length - 1 ? prev + 1 : prev);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredProducts[selectedSuggestionIndex]) handleQuickAddProduct(filteredProducts[selectedSuggestionIndex], index);
                break;
            case 'Escape':
                setIsProductSearchOpen(false);
                break;
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };
        item[field] = value;

        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const taxPct = parseFloat(item.tax_percent) || 0;
        let discAmt = parseFloat(item.discount_amount) || 0;
        let discPct = parseFloat(item.discount_percent) || 0;
        const baseAmount = qty * rate;

        if (baseAmount > 0) {
            if (field === 'discount_percent') {
                if (discPct > 100) discPct = 100;
                discAmt = (baseAmount * discPct) / 100;
                item.discount_percent = discPct;
                item.discount_amount = parseFloat(discAmt.toFixed(2));
            } else if (field === 'discount_amount') {
                if (discAmt > baseAmount) discAmt = baseAmount;
                discPct = (discAmt / baseAmount) * 100;
                item.discount_amount = discAmt;
                item.discount_percent = parseFloat(discPct.toFixed(2));
            } else {
                discAmt = (baseAmount * discPct) / 100;
                item.discount_amount = parseFloat(discAmt.toFixed(2));
            }
        } else {
            item.discount_amount = 0;
            item.discount_percent = 0;
        }

        const beforeTax = baseAmount - item.discount_amount;
        item.before_tax = parseFloat(beforeTax.toFixed(2));
        item.tax_amount = parseFloat(((beforeTax * taxPct) / 100).toFixed(2));
        item.total_amount = parseFloat((beforeTax + item.tax_amount).toFixed(2));

        newItems[index] = item;
        setItems(newItems);
    };

    const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    const totalBefTax = items.reduce((sum, item) => sum + (parseFloat(item.before_tax) || 0), 0);
    const totalTaxAmt = items.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0);
    const totalBillAmount = items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.supplier_name) newErrors.supplier_name = "Supplier name is required";
        if (!formData.document_number) newErrors.document_number = `${documentLabel} number is required`;
        if (!formData.document_date) newErrors.document_date = "Date is required";

        const validItems = items.filter(item => item.product_name);
        if (validItems.length === 0) newErrors.items = true;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveInternal = async () => {
        if (!validateForm()) {
            setShowValidationPopup(true);
            return;
        }

        setIsRefreshing(true);
        try {
            const finalItems = items.filter(i => i.product_id && i.product_name);
            const payload = { ...formData, items: finalItems };
            
            if (type === 'Invoice') {
                await purchaseInvoiceService.createInvoice(payload, formData.attachment);
                toast.success('Purchase invoice created successfully');
            } else {
                await grnService.createGrn(payload, formData.attachment);
                toast.success('GRN record created successfully');
            }
            
            if (onSave) onSave(payload);
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.response?.data?.message || `Failed to save ${documentLabel}`);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handlePrint = () => {
        if (!validateForm()) {
            setShowValidationPopup(true);
            return;
        }
        const finalItems = items.filter(i => i.product_id && i.product_name);
        const payload = { ...formData, items: finalItems };
        navigate(ROUTES.PURCHASE_INVOICE_PRINT, { 
            state: { 
                invoiceData: payload, 
                type,
                from: location.pathname
            } 
        });
    };

    const toDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        if (dateStr.length === 10 && dateStr.charAt(4) === '-') {
            const [y, m, d] = dateStr.split('-');
            return `${d}-${m}-${y}`;
        }
        return dateStr;
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 font-outfit">
            {/* Main Integrated Form Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                {/* Header Section */}
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-[18px] md:text-[20px] font-bold text-[#111827]">Add {documentLabel}</h2>
                    </div>
                    
                    <button 
                        onClick={onBack}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 h-[40px] sm:h-[44px] border border-[#E5E7EB] rounded-[10px] text-[14px] md:text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} strokeWidth={2.5} /> 
                        <span>Back</span>
                    </button>
                </div>

                {/* Form Fields Section matching Add PO exactly */}
                <div className="p-4 sm:p-8 border-b border-[#F3F4F6]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Row 1 */}
                        <div className="space-y-2 relative">
                            <label className="text-[14px] font-semibold text-[#374151]">Supplier Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Select supplier name"
                                    value={supplierSearch}
                                    onFocus={() => setIsSupplierDropdownOpen(true)}
                                    onChange={(e) => {
                                        setSupplierSearch(e.target.value);
                                        setIsSupplierDropdownOpen(true);
                                    }}
                                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none transition-all ${errors.supplier_name ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                                />
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                
                                {isSupplierDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[65]" onClick={() => setIsSupplierDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[16px] shadow-2xl z-[70] overflow-hidden">
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {filteredSuppliers.length > 0 ? (
                                                    filteredSuppliers.map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => handleSelectSupplier(s)}
                                                            className="w-full text-left px-5 py-3.5 hover:bg-emerald-50 transition-all border-b border-[#F3F4F6] last:border-0 group"
                                                        >
                                                            <div className="font-bold text-[#111827] text-[15px] group-hover:text-emerald-900">{s.accountName}</div>
                                                            <div className="text-[12px] text-gray-400 mt-0.5">{s.gstNo || 'No GST Number'}</div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-8 text-[13px] text-gray-400 italic text-center">No results for "{supplierSearch}"</div>
                                                )}
                                            </div>
                                            <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                                                <button 
                                                    onClick={() => navigate('/seller/masters/account-master/add')}
                                                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all shadow-md group"
                                                >
                                                    <Plus size={16} className="group-hover:scale-125 transition-all" />
                                                    Add new supplier
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Credit Days <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                placeholder="Auto-filled from supplier"
                                value={formData.credit_days}
                                onChange={(e) => setFormData({ ...formData, credit_days: e.target.value })}
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                            />
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Address</label>
                            <input
                                type="text"
                                placeholder="Auto-filled from supplier"
                                value={formData.address}
                                readOnly
                                className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151] font-outfit">{documentLabel} Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    ref={documentDateRef}
                                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                                    value={formData.document_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, document_date: e.target.value }))}
                                />
                                <input
                                    type="text"
                                    placeholder="DD-MM-YYYY"
                                    value={toDisplayDate(formData.document_date)}
                                    readOnly
                                    className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 pr-11 text-[14px] outline-none cursor-not-allowed"
                                />
                                <Calendar 
                                    size={18} 
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" 
                                    onClick={() => documentDateRef.current?.showPicker?.()}
                                />
                            </div>
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">{documentLabel} Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder={`Enter ${documentLabel.toLowerCase()} number`}
                                value={formData.document_number}
                                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                                className={`w-full h-[48px] border rounded-[10px] px-4 text-[14px] outline-none ${errors.document_number ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Booking Date <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="date"
                                    ref={bookingDateRef}
                                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                                    value={formData.booking_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, booking_date: e.target.value }))}
                                />
                                <input
                                    type="text"
                                    placeholder="DD-MM-YYYY"
                                    value={toDisplayDate(formData.booking_date)}
                                    readOnly
                                    className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 pr-11 text-[14px] outline-none cursor-not-allowed"
                                />
                                <Calendar 
                                    size={18} 
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" 
                                    onClick={() => bookingDateRef.current?.showPicker?.()}
                                />
                            </div>
                        </div>

                        {/* Row 4 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                            <input
                                type="text"
                                placeholder="Optional"
                                value={formData.gst_no}
                                readOnly
                                className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Linked PO (Optional)</label>
                            <input
                                type="text"
                                placeholder="PO Number"
                                value={formData.po_number}
                                onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                                className="w-full h-[48px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                            />
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="p-4 sm:p-6 md:p-8 border-b border-[#F3F4F6]">
                    <div className="relative max-w-[550px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                        <input
                            type="text"
                            placeholder="Search By Anything..."
                            value={tableSearch}
                            onFocus={() => { setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                            onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                            className={`w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[12px] pl-11 pr-4 text-[14px] outline-none focus:border-[#073318] placeholder:text-[#9CA3AF] shadow-sm font-outfit ${errors.items ? 'border-red-500 font-bold' : ''}`}
                        />
                        
                        {isProductSearchOpen && activeRowIndex === null && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-[20px] shadow-2xl z-[80] overflow-hidden border-t-4 border-emerald-800 animate-in slide-in-from-top-2 duration-300">
                                <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                                    {filteredProducts.map((p, pIdx) => (
                                        <button 
                                            key={p.id} 
                                            onClick={() => handleQuickAddProduct(p)} 
                                            className="w-full px-6 py-5 flex items-center justify-between hover:bg-emerald-50 transition-all text-left border-b border-gray-100 last:border-0 group relative overflow-hidden"
                                        >
                                            <div className="flex flex-col gap-2 relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-extrabold text-[#111827] text-[16px] group-hover:text-emerald-950">{p.product_name}</span>
                                                    <span className="px-2.5 py-0.5 bg-gray-100 rounded-[6px] text-[11px] font-black text-gray-500 uppercase tracking-tighter shadow-sm">#{p.product_code}</span>
                                                </div>
                                                <div className="flex text-[13px] text-gray-400 gap-x-6">
                                                    <span className="flex items-center gap-1.5"><span className="text-gray-300 font-medium">HSN:</span> <span className="text-gray-700 font-bold">{p.hsn_code || '---'}</span></span>
                                                    <span className="flex items-center gap-1.5"><span className="text-gray-300 font-medium">Tax:</span> <span className="text-emerald-700 font-black">{p.tax_rate}%</span></span>
                                                    <span className="flex items-center gap-1.5"><span className="text-gray-300 font-medium">Price:</span> <span className="text-[#073318] font-black">₹{p.purchaseRate || 0}</span></span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 relative z-10">
                                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Seed</span>
                                                <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 transition-all group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-90 group-hover:shadow-lg"><Plus size={20} strokeWidth={3} /></div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="py-12 text-center text-gray-400 italic">No products found for "{tableSearch}"</div>
                                    )}
                                </div>
                                <div className="p-4 bg-gray-50 border-t border-gray-100">
                                    <button 
                                        onClick={() => navigate('/seller/masters/product-master/add')}
                                        className="w-full h-[52px] bg-[#073318] text-white rounded-[14px] text-[15px] font-black flex items-center justify-center gap-3 hover:bg-[#052611] transition-all shadow-lg active:scale-95 group"
                                    >
                                        <Plus size={20} className="group-hover:rotate-90 transition-all duration-300" />
                                        Add new product
                                    </button>
                                </div>
                            </div>
                        )}
                        {isProductSearchOpen && <div className="fixed inset-0 z-50 cursor-pointer" onClick={() => setIsProductSearchOpen(false)}></div>}
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px] bg-white pb-[100px] custom-scrollbar">
                    <table className="w-full min-w-[1800px] border-collapse bg-white">
                        <thead>
                            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">#</th>
                                {[
                                    { label: "Product Code", width: "160px" },
                                    { label: "Product Name", width: "350px" },
                                    { label: "Quantity", width: "120px" },
                                    { label: "Rate", width: "120px" },
                                    { label: "UOM", width: "140px" },
                                    { label: "Discount Amount", width: "160px" },
                                    { label: "Discount (%)", width: "140px" },
                                    { label: "HSN Code", width: "140px" },
                                    { label: "Tax (%)", width: "120px" },
                                    { label: "Bef. Tax Amount", width: "160px" },
                                    { label: "Tax Amount", width: "140px" },
                                    { label: "Amount", width: "160px" },
                                    { label: "Description", width: "300px" },
                                    { label: "Action", width: "80px" }
                                ].map((col, i) => (
                                    <th key={i} className="px-4 py-4 text-left text-[13px] font-medium text-[#6B7280] border-l border-[#F3F4F6]" style={{ width: col.width }}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <React.Fragment key={item.id}>
                                    <tr className={`border-b border-[#F3F4F6] transition-all duration-200 ${activeRowIndex === index ? 'bg-emerald-50/20' : 'hover:bg-[#F9FAFB]'}`}>
                                        <td className="px-4 py-3 text-center text-[#6B7280] text-[13px]">{index + 1}</td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input 
                                                type="text" 
                                                value={item.product_code} 
                                                placeholder="Code" 
                                                onFocus={() => { setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                                onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none font-bold transition-all ${activeRowIndex === index ? 'bg-white shadow-sm ring-1 ring-emerald-500 rounded-md' : 'hover:bg-gray-50'}`} 
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input 
                                                type="text" 
                                                value={item.product_name} 
                                                placeholder="Select product..." 
                                                onFocus={() => { setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                                onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-[#111827] outline-none cursor-pointer transition-all ${activeRowIndex === index ? 'bg-white shadow-sm ring-1 ring-emerald-500 rounded-md' : 'hover:bg-gray-50'}`} 
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input id={`qty-${index}`} type="number" value={item.quantity || ''} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] outline-none focus:border-[#073318] text-right shadow-sm" />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input type="number" value={item.rate || ''} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] outline-none focus:border-[#073318] text-right shadow-sm" />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input 
                                                type="text" 
                                                value={item.uom} 
                                                readOnly 
                                                onFocus={() => { setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none font-medium transition-all ${activeRowIndex === index ? 'bg-white shadow-sm ring-1 ring-emerald-500 rounded-md' : 'hover:bg-gray-50'}`}
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-bold">₹</span>
                                                <input type="number" value={item.discount_amount || ''} onChange={(e) => handleItemChange(index, 'discount_amount', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] pl-5 pr-2 text-[13px] outline-none focus:border-[#073318] text-right transition-all shadow-sm" />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="relative">
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[#073318] font-bold">%</span>
                                                <input type="number" value={item.discount_percent || ''} onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] pl-2 pr-5 text-[13px] outline-none focus:border-[#073318] text-right font-medium text-[#073318] transition-all shadow-sm" />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input 
                                                type="text" 
                                                value={item.hsn}
                                                onFocus={() => { setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                                readOnly={!!item.product_name}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none font-medium transition-all ${activeRowIndex === index && !item.product_name ? 'bg-white shadow-sm ring-1 ring-emerald-500 rounded-md' : 'hover:bg-gray-50'}`} 
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input 
                                                type="text" 
                                                value={item.tax_percent ? `${item.tax_percent}%` : ''}
                                                onFocus={() => { setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                                readOnly={!!item.product_name}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-center outline-none font-bold text-[#073318] transition-all ${activeRowIndex === index && !item.product_name ? 'bg-white shadow-sm ring-1 ring-emerald-500 rounded-md' : 'hover:bg-gray-50'}`} 
                                            />
                                        </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={item.before_tax || '0.00'}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-right text-[#6B7280] outline-none cursor-not-allowed" 
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={item.tax_amount || '0.00'}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-right text-[#6B7280] outline-none cursor-not-allowed" 
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={item.total_amount || '0.00'}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-right font-bold text-[#073318] outline-none cursor-not-allowed" 
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="text" 
                                            value={item.description || ''}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            placeholder="Brief details..."
                                            className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all shadow-sm" 
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-center">
                                        <button onClick={() => setItems(items.filter((_, i) => i !== index))} className="p-2 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                                    </td>
                                </tr>

                                {/* 🔥 Inline Table Suggestions mirroring Screenshot 3 */}
                                {isProductSearchOpen && activeRowIndex === index && filteredProducts.length > 0 && (
                                    <React.Fragment>
                                        {filteredProducts.slice(0, 8).map((p, pIdx) => (
                                            <tr 
                                                key={`suggest-${p.id}`} 
                                                onClick={() => handleQuickAddProduct(p, index)}
                                                className="bg-[#059669] text-white cursor-pointer hover:bg-[#047857] transition-all border-b border-white/20 group animate-in slide-in-from-left duration-200"
                                            >
                                                <td className="px-4 py-3 text-center">
                                                    <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-left font-bold text-[13px] tracking-tight">{p.product_code}</td>
                                                <td className="px-4 py-3 text-left">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-[14px] leading-tight group-hover:underline decoration-white/30 underline-offset-4">{p.product_name}</span>
                                                        <span className="text-[10px] opacity-70 font-black uppercase tracking-widest mt-0.5 italic">Seed</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-[11px] font-black opacity-80 bg-white/10 px-2 py-0.5 rounded italic">HITENTER</span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-[14px] font-black">₹{p.purchaseRate || 0}</td>
                                                <td className="px-4 py-3 text-left">
                                                    <span className="font-bold text-[13px] whitespace-nowrap">Quantity - {p.uom?.unit_name || 'BOTTLES'}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center italic text-[12px] opacity-80 font-medium" colSpan={2}>Select this item to continue</td>
                                                <td className="px-4 py-3 text-center font-bold text-[13px]">{p.hsn_code || '1001'}</td>
                                                <td className="px-4 py-3 text-center font-bold text-[13px]">{p.tax_rate}%</td>
                                                <td colSpan={5} className="bg-[#047857]/30"></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-emerald-950/90 hover:bg-emerald-950 transition-colors">
                                            <td colSpan={15} className="px-6 py-4">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); navigate('/seller/masters/product-master/add'); }}
                                                    className="w-full h-[52px] bg-emerald-900 border border-emerald-700/50 text-white rounded-[14px] flex items-center justify-center gap-3 font-black text-[15px] hover:bg-emerald-800 transition-all shadow-xl active:scale-[0.98] group"
                                                >
                                                    <Plus size={20} className="group-hover:rotate-90 transition-all" />
                                                    Add New Product
                                                </button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                )}
                            </React.Fragment>
                        ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB] font-bold h-[60px]">
                                <td className="px-4 text-[13px] text-[#111827]">Total</td>
                                <td colSpan={2} className="border-l border-[#F3F4F6]"></td>
                                <td className="px-4 text-right text-[13px] text-[#111827] border-l border-[#F3F4F6] font-bold">{totalQty}</td>
                                <td colSpan={6} className="border-l border-[#F3F4F6]"></td>
                                <td className="px-4 text-right text-[13px] text-[#111827] border-l border-[#F3F4F6] pr-4 font-bold">{totalBefTax.toFixed(2)}</td>
                                <td className="px-4 text-right text-[13px] text-[#111827] border-l border-[#F3F4F6] pr-4 font-bold">{totalTaxAmt.toFixed(2)}</td>
                                <td className="px-4 text-right text-[13px] text-[#073318] border-l border-[#F3F4F6] pr-4 font-black">₹ {totalBillAmount.toFixed(2)}</td>
                                <td colSpan={2} className="border-l border-[#F3F4F6]"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Footer Section matching Add PO exactly */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 px-4 sm:px-8 py-6 border-t border-[#F3F4F6] bg-gray-50/10">
                    <button 
                        onClick={handlePrint}
                        className="w-full sm:w-auto px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#052611] transition-all shadow-md flex items-center justify-center gap-2"
                    >
                        <Printer size={18} />
                        Preview & Print
                    </button>
                    <button 
                        onClick={handleSaveInternal}
                        disabled={isRefreshing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 md:px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all shadow-md disabled:opacity-70"
                    >
                        {isRefreshing ? 'Saving...' : `Save ${documentLabel}`}
                    </button>
                    <button 
                        onClick={onBack}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 md:px-10 h-[48px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all shadow-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            {showValidationPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setShowValidationPopup(false)} />
                    <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-5 flex items-center justify-between bg-emerald-800 text-white">
                            <div className="flex items-center gap-3">
                                <AlertCircle size={22} className="text-white" />
                                <h3 className="text-[18px] font-bold">Attention Required</h3>
                            </div>
                            <X size={20} className="cursor-pointer" onClick={() => setShowValidationPopup(false)} />
                        </div>
                        <div className="p-8 font-medium">
                            <p className="text-[15px] text-[#4B5563] leading-relaxed">Please ensure all mandatory fields (marked with <span className="text-red-500 font-bold">*</span>) are filled correctly before proceeding.</p>
                        </div>
                        <div className="px-8 py-5 bg-gray-50 flex justify-end">
                            <button onClick={() => setShowValidationPopup(false)} className="px-8 h-[48px] bg-emerald-800 text-white rounded-[12px] text-[15px] font-bold hover:bg-emerald-900 transition-all shadow-lg active:scale-95">Understood</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddPurchaseInvoice;
