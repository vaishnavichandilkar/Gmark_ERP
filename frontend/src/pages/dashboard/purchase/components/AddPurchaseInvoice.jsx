import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search, UploadCloud, ChevronDown, ChevronUp, X, FileText, Plus } from 'lucide-react';

const AddPurchaseInvoice = ({ onBack, initialData: propsInitialData, onSave, type = 'Invoice' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { t } = useTranslation(['modules', 'common']);
    const isEditMode = !!propsInitialData || !!id;
    const documentLabel = type === 'GRN' ? 'GRN' : 'Invoice';
    const supplierDropdownRef = useRef(null);
    const productDropdownRef = useRef(null);
    const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [errors, setErrors] = useState({});
    
    // Mini-database for product search
    const [dummyProducts] = useState([
        { code: '101', name: 'Premium Maize Silage', uom: 'Ton', hsnCode: '1234', taxPercent: 18 },
        { code: '102', name: 'Organic Fertilizer Mix', uom: 'Bag', hsnCode: '5678', taxPercent: 18 },
        { code: '103', name: 'Cattle Feed Elite', uom: 'Ton', hsnCode: '9012', taxPercent: 12 },
        { code: '104', name: 'Urea Premium', uom: 'Bag', hsnCode: '3456', taxPercent: 5 },
        { code: '105', name: 'Potash Fertilizer', uom: 'Bag', hsnCode: '7890', taxPercent: 12 }
    ]);
    
    // Manage dynamic supplier options with masters-style data and PO links
    const [supplierOptions, setSupplierOptions] = useState([
        { name: 'SilverPeak Traders', creditDays: '15', address: 'Plot 42, GIDC, Surat, Gujarat', poNumber: 'PO-2026-001', gstNo: '24AAAAA0000A1Z5' },
        { name: 'BlueStone Supplies', creditDays: '30', address: '24 Market Street, Mumbai, Maharashtra', poNumber: 'PO-2026-002', gstNo: '27BBBBB1111B1Z2' },
        { name: 'GreenLeaf Distributors', creditDays: '45', address: 'Sector 12, Industrial Hub, Gandhinagar', poNumber: 'PO-2026-003', gstNo: '24CCCCC2222C1Z9' },
        { name: 'Sunrise Global Vendors', creditDays: '60', address: 'Old Station Road, Rajkot, Gujarat', poNumber: 'PO-2026-004', gstNo: '24DDDDD3333D1Z1' }
    ]);
    const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');

    const handleAddNewSupplier = () => {
        if (newSupplierName.trim()) {
            const newSupp = { name: newSupplierName.trim(), creditDays: '0', address: 'New Supplier Address', poNumber: 'PO-NEW-001', gstNo: '' };
            setSupplierOptions([...supplierOptions, newSupp]);
            setFormData(prev => ({ 
                ...prev, 
                supplierName: newSupp.name,
                creditDays: newSupp.creditDays,
                address: newSupp.address,
                poNumber: newSupp.poNumber,
                gstNo: newSupp.gstNo
            }));
            setNewSupplierName('');
            setIsAddSupplierModalOpen(false);
            setSupplierDropdownOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
                setSupplierDropdownOpen(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
                setShowProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [formData, setFormData] = useState(propsInitialData ? {
        supplierName: propsInitialData.supplierName || '',
        creditDays: propsInitialData.cred || '',
        address: '24 Market Street, Gujarat', // Example address as mockData currently doesn't have it
        supplierInvoiceDate: propsInitialData.invoiceDate ? propsInitialData.invoiceDate.split('-').reverse().join('-') : '',
        poNumber: propsInitialData.poNo || '',
        bookingDate: propsInitialData.bookingDate ? propsInitialData.bookingDate.split('-').reverse().join('-') : '',
        supplierInvoiceNumber: propsInitialData.invoiceNo || '',
        supplierChallanNumber: '',
        gstNo: propsInitialData.gstNo || ''
    } : {
        supplierName: '',
        creditDays: '',
        address: '',
        supplierInvoiceDate: '',
        poNumber: '',
        bookingDate: new Date().toISOString().split('T')[0],
        supplierInvoiceNumber: '',
        supplierChallanNumber: '',
        gstNo: ''
    });

    const [products, setProducts] = useState([
        { 
            id: 1, 
            code: '101', 
            name: 'Premium Maize Silage', 
            quantity: 5, 
            rate: 200, 
            uom: 'Ton', 
            discountAmount: 0, 
            discountPercent: 0, 
            hsnCode: '1234', 
            taxPercent: 18, 
            beforeTaxAmount: 1000, 
            taxAmount: 180, 
            total: 1180 
        },
        { 
            id: 2, 
            code: '102', 
            name: 'Organic Fertilizer Mix', 
            quantity: 12, 
            rate: 250, 
            uom: 'Bag', 
            discountAmount: 0, 
            discountPercent: 0, 
            hsnCode: '5678', 
            taxPercent: 18, 
            beforeTaxAmount: 3000, 
            taxAmount: 540, 
            total: 3540 
        }
    ]);

    const [accounts, setAccounts] = useState([
        { id: 1, account: 'Material Purchase (G.S.T.)', amount: '4000.00', cumBalance: '4000.00' },
        { id: 2, account: 'c-gst 9%', amount: '360.00', cumBalance: '4360.00' },
        { id: 3, account: 's-gst 9%', amount: '360.00', cumBalance: '4720.00' }
    ]);

    const handleProductChange = (id, field, value) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                let updated = { ...p, [field]: value };
                const qty = parseFloat(updated.quantity) || 0;
                const rate = parseFloat(updated.rate) || 0;

                if (field === 'discountPercent') {
                    const percent = parseFloat(value) || 0;
                    updated.discountAmount = ((qty * rate * percent) / 100).toFixed(2);
                } else if (field === 'discountAmount') {
                    const amount = parseFloat(value) || 0;
                    if (qty * rate !== 0) {
                        updated.discountPercent = ((amount / (qty * rate)) * 100).toFixed(2);
                    } else {
                        updated.discountPercent = 0;
                    }
                } else if (field === 'quantity' || field === 'rate') {
                    const percent = parseFloat(updated.discountPercent) || 0;
                    updated.discountAmount = ((qty * rate * percent) / 100).toFixed(2);
                }

                // Recalculate totals
                const baseAmount = qty * rate;
                const discAmt = parseFloat(updated.discountAmount) || 0;
                const beforeTax = baseAmount - discAmt;
                const taxPercent = parseFloat(updated.taxPercent) || 0;
                const taxAmt = (beforeTax * taxPercent) / 100;
                const total = beforeTax + taxAmt;

                updated.beforeTaxAmount = beforeTax.toFixed(2);
                updated.taxAmount = taxAmt.toFixed(2);
                updated.total = total.toFixed(2);

                return updated;
            }
            return p;
        }));
    };

    const handleAddProductFromSearch = (product) => {
        const newProduct = {
            id: Date.now(),
            code: product.code,
            name: product.name,
            quantity: 1,
            rate: 100,
            uom: product.uom,
            discountAmount: 0,
            discountPercent: 0,
            hsnCode: product.hsnCode,
            taxPercent: product.taxPercent,
            beforeTaxAmount: 100,
            taxAmount: (100 * product.taxPercent) / 100,
            total: 100 + (100 * product.taxPercent) / 100
        };
        setProducts(prev => [...prev, newProduct]);
        setSearchTerm('');
        setShowProductDropdown(false);
    };

    useEffect(() => {
        const totalBeforeTax = products.reduce((sum, p) => sum + (parseFloat(p.beforeTaxAmount) || 0), 0);
        const totalTax = products.reduce((sum, p) => sum + (parseFloat(p.taxAmount) || 0), 0);
        const cgst = totalTax / 2;
        const sgst = totalTax / 2;

        setAccounts([
            { 
                id: 1, 
                account: 'Material Purchase (G.S.T.)', 
                amount: totalBeforeTax.toFixed(2), 
                cumBalance: totalBeforeTax.toFixed(2) 
            },
            { 
                id: 2, 
                account: 'c-gst 9%', 
                amount: cgst.toFixed(2), 
                cumBalance: (totalBeforeTax + cgst).toFixed(2) 
            },
            { 
                id: 3, 
                account: 's-gst 9%', 
                amount: sgst.toFixed(2), 
                cumBalance: (totalBeforeTax + cgst + sgst).toFixed(2) 
            }
        ]);
    }, [products]);

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const newState = { ...prev, [field]: value };
            // Auto-fill Challan Number from Invoice Number if that's what's changing
            if (field === 'supplierInvoiceNumber') {
                newState.supplierChallanNumber = value;
            }
            return newState;
        });
        // Clear error when user types
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.supplierName) newErrors.supplierName = 'Supplier Name is required';
        if (!formData.creditDays) newErrors.creditDays = 'Credit Days is required';
        if (!formData.address) newErrors.address = 'Address is required';
        if (!formData.supplierInvoiceDate) newErrors.supplierInvoiceDate = 'Supplier Invoice Date is required';
        if (!formData.bookingDate) newErrors.bookingDate = 'Booking Date is required';
        if (!formData.supplierInvoiceNumber) newErrors.supplierInvoiceNumber = 'Supplier Invoice Number is required';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveLocal = (e) => {
        e.preventDefault();
        if (validateForm()) {
            if (onSave) onSave(formData);
        }
    };

    const totalQuantity = products.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
    const totalBefTax = products.reduce((sum, p) => sum + (parseFloat(p.beforeTaxAmount) || 0), 0);
    const totalTaxAmt = products.reduce((sum, p) => sum + (parseFloat(p.taxAmount) || 0), 0);
    const totalInvoiceAmt = products.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);

    return (
        <div className="flex flex-col w-full animate-in fade-in duration-300 font-['Plus_Jakarta_Sans'] px-4 md:px-0">
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col w-full relative mb-8">
                <div className="flex flex-col sm:flex-row border-b border-[#E5E7EB] px-4 md:px-6 py-4 items-center justify-between bg-white rounded-t-[12px] gap-4">
                    <h2 className="hidden md:block text-[18px] font-bold text-[#111827]">{isEditMode ? `Edit ${documentLabel}` : `Add ${documentLabel}`}</h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={onBack}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 h-[40px] border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
                        >
                            <ArrowLeft size={16} />
                            {t('common:back')}
                        </button>
                    </div>
                </div>

                <div className="p-4 md:p-8 flex flex-col gap-10">
                    {/* Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                        <div className="flex flex-col gap-1.5 relative w-full" ref={supplierDropdownRef}>
                            <label className="text-[13px] font-semibold text-[#4B5563]">Supplier Name <span className="text-red-500">*</span></label>
                            <div
                                className={`w-full h-[44px] flex items-center justify-between px-4 border rounded-[8px] transition-colors bg-white cursor-pointer ${errors.supplierName ? 'border-red-500 bg-red-50/10' : supplierDropdownOpen ? 'border-[#014A36] ring-1 ring-[#014A36]/10' : 'border-[#E5E7EB] hover:border-gray-300'}`}
                                onClick={() => setSupplierDropdownOpen(!supplierDropdownOpen)}
                            >
                                <span className={`text-[14px] truncate ${formData.supplierName ? 'text-[#111827]' : 'text-gray-500'}`}>
                                    {formData.supplierName || 'Select supplier name'}
                                </span>
                                <div>
                                    {supplierDropdownOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                </div>
                            </div>
                            {errors.supplierName && <span className="text-red-500 text-[11px] mt-1 font-medium">{errors.supplierName}</span>}
                            {supplierDropdownOpen && (
                                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-gray-100 rounded-[8px] shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="max-h-[240px] overflow-y-auto w-full py-1 custom-scrollbar flex flex-col">
                                        {supplierOptions.map((opt, idx) => (
                                            <div
                                                key={idx}
                                                className={`px-4 py-2.5 text-[14px] cursor-pointer transition-colors ${formData.supplierName === opt.name ? 'bg-[#F9FAFB] text-[#014A36] font-medium' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        supplierName: opt.name,
                                                        creditDays: opt.creditDays,
                                                        address: opt.address,
                                                        poNumber: opt.poNumber,
                                                        gstNo: opt.gstNo
                                                    }));
                                                    setSupplierDropdownOpen(false);
                                                }}
                                            >
                                                {opt.name}
                                            </div>
                                        ))}
                                        {/* Add New Supplier Button placed inline like Screenshot */}
                                        <div className="px-3 py-2 border-t border-gray-50 mt-1">
                                            <button 
                                                onClick={() => navigate(`/seller/masters/account-master/add?redirect=${encodeURIComponent(location.pathname)}`)}
                                                className="bg-[#014A36] hover:bg-[#013b2b] text-white px-4 py-2 rounded-[6px] text-[13px] font-semibold transition-all shadow-sm w-max inline-block"
                                            >
                                                Add new supplier
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">Credit Days <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder="Enter credit days"
                                className={`w-full h-[44px] border rounded-[8px] px-4 text-[14px] outline-none transition-all ${errors.creditDays ? 'border-red-500 bg-red-50/10 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10'}`}
                                value={formData.creditDays}
                                onChange={(e) => handleInputChange('creditDays', e.target.value)}
                            />
                            {errors.creditDays && <span className="text-red-500 text-[11px] mt-1 font-medium">{errors.creditDays}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">Address <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder="Enter address"
                                className={`w-full h-[44px] border rounded-[8px] px-4 text-[14px] outline-none transition-all ${errors.address ? 'border-red-500 bg-red-50/10 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10'}`}
                                value={formData.address}
                                onChange={(e) => handleInputChange('address', e.target.value)}
                            />
                            {errors.address && <span className="text-red-500 text-[11px] mt-1 font-medium">{errors.address}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">Supplier {documentLabel} Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className={`w-full h-[44px] border rounded-[8px] px-4 text-[14px] outline-none transition-all text-gray-700 uppercase ${errors.supplierInvoiceDate ? 'border-red-500 bg-red-50/10 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10'}`}
                                value={formData.supplierInvoiceDate}
                                onChange={(e) => handleInputChange('supplierInvoiceDate', e.target.value)}
                            />
                            {errors.supplierInvoiceDate && <span className="text-red-500 text-[11px] mt-1 font-medium">{errors.supplierInvoiceDate}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">PO Number (Optional)</label>
                            <input
                                type="text"
                                placeholder="Enter PO number"
                                className="w-full h-[44px] border border-[#E5E7EB] rounded-[8px] px-4 text-[14px] outline-none focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10"
                                value={formData.poNumber}
                                onChange={(e) => handleInputChange('poNumber', e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">Booking Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                className={`w-full h-[44px] border rounded-[8px] px-4 text-[14px] outline-none transition-all text-gray-700 uppercase ${errors.bookingDate ? 'border-red-500 bg-red-50/10 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10'}`}
                                value={formData.bookingDate}
                                onChange={(e) => handleInputChange('bookingDate', e.target.value)}
                            />
                            {errors.bookingDate && <span className="text-red-500 text-[11px] mt-1 font-medium">{errors.bookingDate}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">Supplier {documentLabel} Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder={`Enter supplier ${documentLabel.toLowerCase()} number`}
                                className={`w-full h-[44px] border rounded-[8px] px-4 text-[14px] outline-none transition-all ${errors.supplierInvoiceNumber ? 'border-red-500 bg-red-50/10 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10'}`}
                                value={formData.supplierInvoiceNumber}
                                onChange={(e) => handleInputChange('supplierInvoiceNumber', e.target.value)}
                            />
                            {errors.supplierInvoiceNumber && <span className="text-red-500 text-[11px] mt-1 font-medium">{errors.supplierInvoiceNumber}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">Supplier Challan Number (Optional)</label>
                            <input
                                type="text"
                                placeholder="Enter supplier challan number"
                                className="w-full h-[44px] border border-[#E5E7EB] rounded-[8px] px-4 text-[14px] outline-none focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10"
                                value={formData.supplierChallanNumber}
                                onChange={(e) => handleInputChange('supplierChallanNumber', e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-semibold text-[#4B5563]">GST NO (Optional)</label>
                            <input
                                type="text"
                                placeholder="Enter GST number"
                                className="w-full h-[44px] border border-[#E5E7EB] rounded-[8px] px-4 text-[14px] outline-none focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10"
                                value={formData.gstNo}
                                onChange={(e) => handleInputChange('gstNo', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="h-[1px] bg-[#E5E7EB] w-full" />

                    {/* Product Table Area */}
                    <div className="flex flex-col">
                        <div className="border border-[#E5E7EB] rounded-t-[10px] overflow-hidden">
                            <div className="p-3 bg-white border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="relative w-full sm:w-[320px]" ref={productDropdownRef}>
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search by anything"
                                        className={`w-full h-[36px] bg-gray-50 border rounded-[8px] pl-10 pr-4 text-[13px] outline-none transition-all ${showProductDropdown ? 'border-[#014A36] ring-1 ring-[#014A36]/10' : 'border-[#E5E7EB]'}`}
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setShowProductDropdown(true);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                    />
                                    {showProductDropdown && (
                                        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.12)] z-[120] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            {/* Scrollable Results Area */}
                                            <div className="max-h-[260px] overflow-y-auto custom-scrollbar py-1">
                                                {dummyProducts
                                                    .filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.includes(searchTerm))
                                                    .map((product, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="px-5 py-3 hover:bg-gray-50 cursor-pointer flex flex-col gap-0.5 border-b border-gray-50 last:border-0 transition-colors"
                                                            onClick={() => handleAddProductFromSearch(product)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[14px] font-bold text-[#111827]">{product.name}</span>
                                                                <span className="text-[11px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400 font-bold uppercase">{product.code}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[12px] text-gray-400 font-medium">
                                                                <span>HSN: {product.hsnCode}</span>
                                                                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                                                <span>Tax: {product.taxPercent}%</span>
                                                                <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                                                                <span>UOM: {product.uom}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                                {dummyProducts.filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.includes(searchTerm)).length === 0 && (
                                                    <div className="px-5 py-8 text-center text-[13px] text-gray-400 italic">No products found for "{searchTerm}"</div>
                                                )}
                                            </div>

                                            {/* Fixed Footer for Action Button */}
                                            <div className="p-3 bg-gray-50 border-t border-gray-100 mt-auto shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                                                <button 
                                                    onClick={() => navigate(`/seller/masters/product-master/add?redirect=${encodeURIComponent(location.pathname)}`)}
                                                    className="w-full h-[40px] bg-[#014A36] hover:bg-[#013b2b] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm flex items-center justify-center gap-2 group"
                                                >
                                                    <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                                    Add new product
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="overflow-x-auto w-full custom-scrollbar">
                                <style>{`
                                    .custom-scrollbar::-webkit-scrollbar { height: 6px; }
                                    .custom-scrollbar::-webkit-scrollbar-track { background: #E5E7EB; }
                                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #A7C0B8; border-radius: 4px; }
                                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #014A36; }
                                `}</style>
                                <table className="w-full min-w-[1200px] text-left border-collapse">
                                    <thead className="bg-[#014A36] border-b border-[#013527]">
                                        <tr className="text-white text-[12px] font-bold uppercase tracking-wide">
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Product Code <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Product <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Quantity <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Rate <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">UMO <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Discount Amount <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Discount (%) <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">HSN Code <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Tax (%) <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Bef. Tax Amount <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Tax Amount <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-5 py-3 border-r border-white/10 whitespace-nowrap">Amount <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((row) => (
                                            <tr key={row.id} className="border-b border-[#E5E7EB] hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-4 border-r border-[#E5E7EB]">
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-transparent outline-none text-[13px] text-[#4B5563]" 
                                                        value={row.code}
                                                        onChange={(e) => handleProductChange(row.id, 'code', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB]">
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-transparent outline-none text-[13px] font-bold text-[#111827]" 
                                                        value={row.name}
                                                        onChange={(e) => handleProductChange(row.id, 'name', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB]">
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-transparent outline-none text-[13px] font-medium text-[#4B5563]" 
                                                        value={row.quantity}
                                                        onChange={(e) => handleProductChange(row.id, 'quantity', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB]">
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-transparent outline-none text-[13px] font-medium text-[#4B5563]" 
                                                        value={row.rate}
                                                        onChange={(e) => handleProductChange(row.id, 'rate', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB] text-[13px] text-[#4B5563] font-medium uppercase">{row.uom}</td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB]">
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-transparent outline-none text-[13px] font-medium text-[#4B5563]" 
                                                        value={row.discountAmount}
                                                        onChange={(e) => handleProductChange(row.id, 'discountAmount', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB]">
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-transparent outline-none text-[13px] font-medium text-[#4B5563]" 
                                                        value={row.discountPercent}
                                                        onChange={(e) => handleProductChange(row.id, 'discountPercent', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB] text-[13px] text-[#4B5563] font-medium">{row.hsnCode}</td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB] text-[13px] text-[#4B5563] font-bold">{row.taxPercent}%</td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB] text-[13px] text-[#4B5563] font-bold">{row.beforeTaxAmount}</td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB] text-[13px] text-[#4B5563] font-bold">{row.taxAmount}</td>
                                                <td className="px-5 py-4 border-r border-[#E5E7EB] text-[13px] text-[#111827] font-bold">{row.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50/50">
                                            <td colSpan={2} className="px-5 py-3 border-r border-b border-[#E5E7EB] font-bold text-[#111827] text-[14px]">Total</td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB] text-[13px] font-bold text-[#4B5563]">{totalQuantity.toFixed(2)}</td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB]"></td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB]"></td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB]"></td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB]"></td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB]"></td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB]"></td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB] text-[13px] font-bold text-[#4B5563]">{totalBefTax.toFixed(2)}</td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB] text-[13px] font-bold text-[#4B5563]">{totalTaxAmt.toFixed(2)}</td>
                                            <td className="px-5 py-3 border-r border-b border-[#E5E7EB] text-[13px] font-bold text-[#111827]">{totalInvoiceAmt.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        {/* Green accent line matching design */}
                        <div className="w-[150px] h-[4px] bg-[#A7C0B8] rounded-b-md mt-[-2px] ml-[2px]"></div>
                    </div>

                    {/* Account Grid */}
                    <div className="flex flex-col mt-2">
                        <div className="border border-[#E5E7EB] rounded-[10px] overflow-hidden">
                            <div className="overflow-x-auto w-full custom-scrollbar">
                                <table className="w-full min-w-[800px] text-center border-collapse">
                                    <thead className="bg-[#014A36] border-b border-[#013527]">
                                        <tr className="text-white text-[12px] font-bold uppercase tracking-wide">
                                            <th className="px-6 py-4 border-r border-white/10 w-1/3">Account <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-6 py-4 border-r border-white/10 w-1/3">Amount <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                            <th className="px-6 py-4 w-1/3">Cum. Balance <ChevronDown size={14} className="inline ml-1 text-[#8bb4a3]"/></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accounts.map((row) => (
                                            <tr key={row.id} className="border-b border-[#E5E7EB]">
                                                <td className="px-6 py-6 border-r border-[#E5E7EB] text-[14px] font-medium text-[#4B5563]">{row.account}</td>
                                                <td className="px-6 py-6 border-r border-[#E5E7EB] text-[14px] font-bold text-[#111827]">{row.amount}</td>
                                                <td className="px-6 py-6 text-[14px] font-bold text-[#111827]">{row.cumBalance}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50/80 border-t border-[#E5E7EB]">
                                            <td className="px-6 py-4 border-r border-[#E5E7EB] text-[13px] font-bold text-[#111827] uppercase tracking-wide">Grand Total</td>
                                            <td className="px-6 py-4 border-r border-[#E5E7EB] text-[15px] font-bold text-[#014A36]">{totalInvoiceAmt.toFixed(2)}</td>
                                            <td className="px-6 py-4"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* File Upload Section - Trigger Modal */}
                    <div className="flex flex-col gap-1.5 w-full mt-4 pb-4">
                        <label className="text-[13px] font-semibold text-[#4B5563]">{`Upload ${documentLabel}`}</label>
                        <div 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="border-2 border-dashed rounded-[10px] p-8 flex flex-col items-center justify-center cursor-pointer transition-all border-gray-300 hover:border-[#014A36] hover:bg-[#F9FAFB] group"
                        >
                            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3 group-hover:bg-[#E7F0EE] transition-colors">
                                <UploadCloud size={24} className="text-gray-400 group-hover:text-[#014A36] transition-colors" />
                            </div>
                            <p className="text-[15px] font-bold text-[#111827] mb-1">{t('common:click_to_upload', 'Click to upload')}</p>
                            <p className="text-[13px] text-[#6B7280]">{t('common:file_limit_info', 'PDF or JPG (max. 10MB)', { max: 10 })}</p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions matching design */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 px-4 md:px-8 py-6 border-t border-[#E5E7EB] bg-gray-50/30 rounded-b-[12px]">
                    <button
                        onClick={handleSaveLocal}
                        className="w-full sm:w-auto px-10 h-[44px] bg-[#014A36] hover:bg-[#013527] text-white font-bold rounded-[8px] transition-all shadow-md active:scale-[0.98] min-w-[160px]"
                    >
                        {isEditMode ? 'Save Changes' : `Save ${documentLabel}`}
                    </button>
                    <button
                        onClick={onBack}
                        className="w-full sm:w-auto px-10 h-[44px] bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#4B5563] font-bold rounded-[8px] transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            {/* Upload Modal matching Screenshot */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] w-full max-w-[500px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
                            <h3 className="text-[17px] font-bold text-[#111827]">{`Upload ${documentLabel}`}</h3>
                            <button 
                                onClick={() => setIsUploadModalOpen(false)}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8">
                            <div 
                                className="border-2 border-dashed border-[#E5E7EB] rounded-[12px] p-10 flex flex-col items-center justify-center bg-white hover:border-[#014A36] transition-colors cursor-pointer group"
                            >
                                <div className="mb-4">
                                    <FileText size={40} className="text-[#9CA3AF] group-hover:text-[#014A36] transition-colors" />
                                </div>
                                <p className="text-[14px] font-bold text-[#111827] mb-1">{t('common:click_to_upload', 'Click to upload')}</p>
                                <p className="text-[12px] text-[#9CA3AF]">PDF or JPG (max. 10MB)</p>
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="flex items-center justify-center gap-3 mt-8">
                                <button
                                    onClick={() => {
                                        // Handle upload logic here
                                        setIsUploadModalOpen(false);
                                    }}
                                    className="px-10 h-[44px] bg-[#A7C0B8] hover:bg-[#8eb0a4] text-white font-bold rounded-[8px] transition-all shadow-sm"
                                >
                                    {t('common:upload', 'Upload')}
                                </button>
                                <button
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="px-10 h-[44px] bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#111827] font-bold rounded-[8px] transition-all"
                                >
                                    {t('common:exit', 'Exit')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Supplier Modal */}
            {isAddSupplierModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[12px] w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-[18px] font-bold text-[#111827] mb-4">Add New Supplier</h3>
                        <div className="flex flex-col gap-1.5 mb-6">
                            <label className="text-[13px] font-semibold text-[#4B5563]">Supplier Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                autoFocus
                                placeholder="Enter supplier name"
                                className="w-full h-[40px] px-4 border border-[#E5E7EB] rounded-[8px] text-[14px] outline-none focus:border-[#014A36] focus:ring-1 focus:ring-[#014A36]/10"
                                value={newSupplierName}
                                onChange={(e) => setNewSupplierName(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => { setIsAddSupplierModalOpen(false); setNewSupplierName(''); }}
                                className="px-5 h-[38px] rounded-[6px] text-[#4B5563] font-bold bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[14px] transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddNewSupplier}
                                disabled={!newSupplierName.trim()}
                                className="px-5 h-[38px] rounded-[6px] text-white font-bold bg-[#014A36] hover:bg-[#013b2b] text-[14px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Add Supplier
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddPurchaseInvoice;
