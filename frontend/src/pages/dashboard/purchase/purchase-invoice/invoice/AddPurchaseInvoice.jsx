import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
    ArrowLeft, Search, Trash2, Plus, Save, Printer, X,
    ChevronDown, Calendar, FileText, Percent, Hash,
    ChevronsUpDown, AlertCircle, IndianRupee, Package,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '../../../../../constants/routes';

import accountService from '../../../../../services/accountService';
import productService from '../../../../../services/productService';
import purchaseInvoiceService from '../../../../../services/purchaseInvoiceService';
import purchaseOrderService from '../../../../../services/purchaseOrderService';

const AddPurchaseInvoice = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const { t } = useTranslation(['modules', 'common']);
    
    // Determine if we are in GRN mode based on path
    const isGRN = location.pathname.includes('/grn/');
    const documentLabel = isGRN ? 'GRN' : 'Purchase Invoice';
    const isEditMode = Boolean(id);

    // Refs for date pickers
    const documentDateRef = useRef(null);
    const bookingDateRef = useRef(null);

    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [pos, setPos] = useState([]);
    const [isPODropdownOpen, setIsPODropdownOpen] = useState(false);
    
    // Helper: Get Local Today String
    const getLocalToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const toDisplayDate = (dateStr) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}-${month}-${year}`;
    };

    // Basic Form State
    const [formData, setFormData] = useState({
        supplier_id: '',
        supplier_name: '',
        address: '',
        document_number: '', 
        gst_no: '',
        credit_days: '',
        document_date: getLocalToday(),
        booking_date: getLocalToday(),
        po_id: '',
        po_number: '',
        attachment: null
    });

    // Items Table State - matching Add PO columns exactly
    const [items, setItems] = useState([
        { 
            id: Date.now(), 
            product_id: null,
            product_code: '', 
            product_name: '', 
            quantity: 1, 
            rate: 0, 
            uom: 'Nos', 
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
    const [tableSearch, setTableSearch] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState(null);
    const [products, setProducts] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Initial Lists
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [accResponse, prodResponse] = await Promise.all([
                    accountService.getAllAccounts({ groupName: 'SUNDRY_CREDITORS', limit: 1000 }),
                    productService.getProducts({ limit: 1000 })
                ]);
                setSuppliers(accResponse.data || []);
                setProducts(prodResponse.products || []);
            } catch (error) {
                console.error("Error fetching setup data:", error);
                toast.error("Failed to load setup data");
            }
        };
        fetchInitialData();
    }, []);

    // Filtered lists
    const filteredSuppliers = useMemo(() => {
        if (!supplierSearch) return suppliers;
        return suppliers.filter(s => 
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase()) ||
            s.id?.toString().includes(supplierSearch)
        );
    }, [supplierSearch, suppliers]);

    const filteredProducts = useMemo(() => {
        const search = tableSearch.toLowerCase();
        return products.filter(p => 
            p.product_name?.toLowerCase().includes(search) ||
            p.product_code?.toLowerCase().includes(search)
        );
    }, [tableSearch, products]);

    const handleSelectSupplier = async (supplier) => {
        setFormData(prev => ({
            ...prev,
            supplier_id: supplier.id,
            supplier_name: supplier.accountName,
            address: (supplier.addressLine1 || "") + (supplier.addressLine2 ? ", " + supplier.addressLine2 : ""),
            gst_no: supplier.gstNo || "",
            credit_days: supplier.supplierCreditDays || 30
        }));
        setSupplierSearch(supplier.accountName);
        setIsSupplierDropdownOpen(false);

        // Fetch POs for this supplier
        try {
            const poResponse = await purchaseOrderService.getPurchaseOrders({ 
                filter: 'pending', 
                search: supplier.accountName 
            });
            setPos(Array.isArray(poResponse) ? poResponse : (poResponse.data || []));
        } catch (error) {
            console.error("Error fetching supplier POs:", error);
        }
    };

    const handleQuickAddProduct = (product) => {
        const newItem = {
            id: Date.now(),
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.product_name,
            quantity: 1,
            rate: product.purchaseRate || 0,
            uom: product.unit_name || 'Nos',
            discount_amount: 0,
            discount_percent: 0,
            hsn: product.hsn_code || '',
            tax_percent: product.tax_rate || 0,
            before_tax: product.purchaseRate || 0,
            tax_amount: (product.purchaseRate || 0) * ((product.tax_rate || 0) / 100),
            total_amount: (product.purchaseRate || 0) * (1 + (product.tax_rate || 0)/100),
            description: ''
        };

        if (activeRowIndex !== null) {
            const newItems = [...items];
            newItems[activeRowIndex] = newItem;
            setItems(newItems);
        } else {
            // If the first row is empty, replace it
            if (items.length === 1 && !items[0].product_id) {
                setItems([newItem]);
            } else {
                setItems([...items, newItem]);
            }
        }
        setIsProductSearchOpen(false);
        setTableSearch('');
        setActiveRowIndex(null);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'quantity' || field === 'rate' || field === 'discount_amount' || field === 'discount_percent' || field === 'tax_percent') {
            const val = parseFloat(value) || 0;
            item[field] = val;
            
            // Recalculate logic matching Add PO
            const base = item.quantity * item.rate;
            let discount = item.discount_amount;
            if (field === 'discount_percent') {
                discount = (base * val) / 100;
                item.discount_amount = discount.toFixed(2);
            } else if (field === 'discount_amount') {
                item.discount_percent = base > 0 ? ((val / base) * 100).toFixed(2) : 0;
            }

            item.before_tax = base - discount;
            item.tax_amount = item.before_tax * (item.tax_percent / 100);
            item.total_amount = item.before_tax + item.tax_amount;
        } else {
            item[field] = value;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { 
            id: Date.now(), product_id: null, product_code: '', product_name: '', quantity: 1, rate: 0, uom: 'Nos', 
            discount_amount: 0, discount_percent: 0, hsn: '', tax_percent: 0, before_tax: 0, tax_amount: 0, total_amount: 0, description: '' 
        }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) {
            setItems([{ 
                id: Date.now(), product_id: null, product_code: '', product_name: '', quantity: 1, rate: 0, uom: 'Nos', 
                discount_amount: 0, discount_percent: 0, hsn: '', tax_percent: 0, before_tax: 0, tax_amount: 0, total_amount: 0, description: '' 
            }]);
        } else {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const subtotal = items.reduce((sum, item) => sum + (Number(item.before_tax) || 0), 0);
    const totalTax = items.reduce((sum, item) => sum + (Number(item.tax_amount) || 0), 0);
    const grandTotal = items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

    const validate = () => {
        const newErrors = {};
        if (!formData.supplier_id) newErrors.supplier_name = "Supplier is required";
        if (!formData.document_number) newErrors.document_number = `${documentLabel} number is required`;
        if (items.some(i => !i.product_id)) newErrors.items = "All rows must have a product selected";
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                items: items.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity,
                    rate: i.rate,
                    discount_amount: i.discount_amount,
                    tax_percent: i.tax_percent,
                    description: i.description
                })),
                subtotal,
                total_tax: totalTax,
                grand_total: grandTotal
            };

            if (isEditMode) {
                // Update logic
                toast.success(`${documentLabel} updated successfully`);
            } else {
                await purchaseInvoiceService.createInvoice(payload);
                toast.success(`${documentLabel} created successfully`);
            }
            navigate(isGRN ? ROUTES.GRN : ROUTES.PURCHASE_INVOICE);
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.response?.data?.message || "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 font-outfit">
            {/* Header section matching Add PO exactly */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-[18px] md:text-[20px] font-bold text-[#111827]">{isEditMode ? 'Edit' : 'Create'} {documentLabel}</h2>
                        <p className="text-[12px] text-gray-400 mt-1 uppercase tracking-wider font-bold">Purchase &gt; {documentLabel} &gt; {isEditMode ? 'Edit' : 'Add'}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={() => navigate(-1)}
                            className="flex items-center justify-center gap-2 px-6 h-[44px] border border-[#E5E7EB] rounded-[10px] text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all font-outfit shadow-sm"
                        >
                            <span>Cancel</span>
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center justify-center gap-2 px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                            <span>Save {documentLabel}</span>
                        </button>
                    </div>
                </div>

                {/* Form Fields Section */}
                <div className="p-4 sm:p-8 border-b border-[#F3F4F6]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Supplier Section */}
                        <div className="space-y-2 relative">
                            <label className="text-[14px] font-semibold text-[#374151]">Supplier Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Select Supplier"
                                    value={supplierSearch}
                                    onFocus={() => setIsSupplierDropdownOpen(true)}
                                    onChange={(e) => { setSupplierSearch(e.target.value); setIsSupplierDropdownOpen(true); }}
                                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none transition-all ${errors.supplier_name ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                                />
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                
                                {isSupplierDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[65]" onClick={() => setIsSupplierDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[14px] shadow-2xl z-[70] overflow-hidden">
                                            <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                                {filteredSuppliers.map(s => (
                                                    <button key={s.id} onClick={() => handleSelectSupplier(s)} className="w-full text-left px-5 py-3 hover:bg-emerald-50 transition-all border-b border-gray-50 last:border-0 group">
                                                        <div className="font-bold text-[#111827] group-hover:text-emerald-900 transition-colors">{s.accountName}</div>
                                                        <div className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">{s.gstNo || 'No GST'}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* PO Link Section */}
                        <div className="space-y-2 relative">
                            <label className="text-[14px] font-semibold text-[#374151]">Link Purchase Order</label>
                            <div className="relative">
                                <button
                                    onClick={() => setIsPODropdownOpen(!isPODropdownOpen)}
                                    className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] flex items-center justify-between outline-none"
                                >
                                    <span className={formData.po_number ? 'text-[#111827] font-bold' : 'text-gray-400'}>{formData.po_number || "Create from scratch (Auto PO)"}</span>
                                    <ChevronDown size={18} className="text-gray-400" />
                                </button>
                                {isPODropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[65]" onClick={() => setIsPODropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[14px] shadow-2xl z-[70] overflow-hidden">
                                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                <button onClick={() => { setFormData(prev => ({ ...prev, po_id: '', po_number: '' })); setIsPODropdownOpen(false); }} className="w-full text-left px-5 py-3 hover:bg-emerald-50 border-b border-gray-50 italic text-gray-500 font-bold">Create from scratch</button>
                                                {pos.map(po => (
                                                    <button key={po.id} onClick={() => { setFormData(prev => ({ ...prev, po_id: po.id, po_number: po.poNumber })); setIsPODropdownOpen(false); }} className="w-full text-left px-5 py-3 hover:bg-emerald-50 transition-all border-b border-gray-50 last:border-0 font-bold text-gray-700">
                                                        {po.poNumber} ({toDisplayDate(po.poCreationDate)})
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Document No */}
                        <div className="space-y-2">
                             <label className="text-[14px] font-semibold text-[#374151]"># Supplier {documentLabel} No. <span className="text-red-500">*</span></label>
                             <input
                                type="text"
                                placeholder={`Enter ${documentLabel.toLowerCase()} no`}
                                value={formData.document_number}
                                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                                className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none transition-all ${errors.document_number ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                            />
                        </div>

                        {/* Document Date */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Supplier {documentLabel} Date <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input type="date" ref={documentDateRef} className="absolute opacity-0 pointer-events-none w-0 h-0" value={formData.document_date} onChange={(e) => setFormData({ ...formData, document_date: e.target.value })} />
                                <input type="text" value={toDisplayDate(formData.document_date)} readOnly className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] cursor-pointer" onClick={() => documentDateRef.current?.showPicker()} />
                                <Calendar size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Booking Date */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Record/Booking Date</label>
                            <div className="relative">
                                <input type="date" ref={bookingDateRef} className="absolute opacity-0 pointer-events-none w-0 h-0" value={formData.booking_date} onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })} />
                                <input type="text" value={toDisplayDate(formData.booking_date)} readOnly className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] cursor-pointer" onClick={() => bookingDateRef.current?.showPicker()} />
                                <Calendar size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        {/* Credit Days */}
                        <div className="space-y-2">
                             <label className="text-[14px] font-semibold text-[#374151]">Credit Days</label>
                             <input
                                type="number"
                                placeholder="30"
                                value={formData.credit_days}
                                onChange={(e) => setFormData({ ...formData, credit_days: e.target.value })}
                                className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Table Section matching Add PO exactly */}
                <div className="p-4 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-[#073318] rounded-full" />
                            <h2 className="text-[18px] font-bold text-[#111827]">Items List</h2>
                        </div>
                        <button onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-[#073318] rounded-[10px] text-[14px] font-bold hover:bg-emerald-100 transition-all"><Plus size={16} /> Add Row</button>
                    </div>

                    <div className="relative mb-6 max-w-[550px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Quick Search Products..."
                            value={tableSearch}
                            onFocus={() => { setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                            onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                            className="w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[12px] pl-11 pr-4 text-[14px] outline-none focus:border-[#073318] shadow-sm"
                        />
                         {isProductSearchOpen && activeRowIndex === null && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-[20px] shadow-2xl z-[80] overflow-hidden border-t-4 border-emerald-800 animate-in slide-in-from-top-2 duration-300">
                                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                    {filteredProducts.map(p => (
                                        <button key={p.id} onClick={() => handleQuickAddProduct(p)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-emerald-50 transition-all border-b border-gray-100 last:border-0 group">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#111827]">{p.product_name}</span>
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-black uppercase">#{p.product_code}</span>
                                                </div>
                                                <div className="flex gap-4 text-[12px] text-gray-400 font-bold uppercase tracking-tighter">
                                                     <span>HSN: <span className="text-gray-600">{p.hsn_code || '---'}</span></span>
                                                     <span>Tax: <span className="text-emerald-700">{p.tax_rate}%</span></span>
                                                     <span>Rate: <span className="text-[#073318] font-black">₹{p.purchaseRate || 0}</span></span>
                                                </div>
                                            </div>
                                            <Plus size={18} className="text-gray-300 group-hover:text-emerald-600 transition-all group-hover:scale-125" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto custom-po-scrollbar min-h-[400px] border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm">
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
                                        { label: "Discount", width: "160px" },
                                        { label: "Disc (%)", width: "140px" },
                                        { label: "HSN", width: "140px" },
                                        { label: "Tax (%)", width: "120px" },
                                        { label: "Bef. Tax", width: "160px" },
                                        { label: "Tax Amt", width: "140px" },
                                        { label: "Amount", width: "160px" },
                                        { label: "Description", width: "300px" },
                                        { label: "Action", width: "80px" }
                                    ].map((col, i) => (
                                        <th key={i} className="px-4 py-4 text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]" style={{ width: col.width }}>{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={index} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all group font-bold">
                                        <td className="px-4 py-3 text-center text-[#6B7280] text-[13px]">{index + 1}</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-gray-400 font-bold uppercase">{item.product_code || '---'}</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] relative">
                                            <div className="flex flex-col">
                                                <input type="text" readOnly value={item.product_name} placeholder="Select Product" className="bg-transparent border-none outline-none text-[#111827]" />
                                                <span className="text-[10px] text-gray-400 font-black">HSN: {item.hsn || '---'} | TAX: {item.tax_percent}%</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6]">
                                            <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] text-right outline-none focus:ring-1 focus:ring-emerald-500" />
                                        </td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6]">
                                            <input type="number" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] text-right outline-none focus:ring-1 focus:ring-emerald-500" />
                                        </td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-gray-500 text-[13px]">{item.uom}</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6]">
                                            <input type="number" value={item.discount_amount} onChange={(e) => handleItemChange(index, 'discount_amount', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] text-right outline-none" />
                                        </td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6]">
                                            <input type="number" value={item.discount_percent} onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)} className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] text-right outline-none" />
                                        </td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-gray-500 text-[13px]">{item.hsn}</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-gray-500 text-[13px]">{item.tax_percent}%</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-[#073318] text-right font-black">₹{Number(item.before_tax).toFixed(2)}</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-emerald-700 text-right">₹{Number(item.tax_amount).toFixed(2)}</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-[#073318] text-right font-black">₹{Number(item.total_amount).toFixed(2)}</td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6]">
                                            <input type="text" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} placeholder="Notes..." className="w-full h-[36px] bg-transparent outline-none text-[12px] font-normal italic" />
                                        </td>
                                        <td className="px-3 py-2 border-l border-[#F3F4F6] text-center">
                                            <button onClick={() => removeItem(index)} className="p-2 text-red-400 hover:text-red-700 transition-all hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Sums matching Add PO exactly */}
                <div className="p-8 bg-[#F9FAFB] flex flex-col md:flex-row items-start justify-between gap-8 border-t border-[#F3F4F6]">
                     <div className="w-full md:max-w-[400px] flex flex-col gap-6">
                        <div className="space-y-4">
                            <label className="text-[14px] font-bold text-[#374151] flex items-center gap-2 uppercase tracking-widest"><Package size={16} className="text-emerald-600" /> Attachment (Image/PDF)</label>
                            <div className="relative group cursor-pointer h-[120px] bg-white border-2 border-dashed border-[#E5E7EB] rounded-[24px] flex flex-col items-center justify-center gap-2 hover:border-emerald-500 hover:bg-emerald-50/20 transition-all">
                                 <IndianRupee size={24} className="text-gray-300 group-hover:text-emerald-500 transition-all" />
                                 <span className="text-[12px] text-gray-400 font-bold group-hover:text-emerald-600">Click to upload physical copy</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-[450px] space-y-3">
                         <div className="flex justify-between items-center py-2 px-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[14px] font-bold text-gray-400 uppercase tracking-widest">Subtotal</span>
                            <span className="text-[16px] font-black text-[#111827]">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 px-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <span className="text-[14px] font-bold text-gray-400 uppercase tracking-widest">Total Tax (GST)</span>
                            <span className="text-[16px] font-black text-emerald-700">₹{totalTax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-5 px-6 bg-emerald-900 rounded-[20px] shadow-xl shadow-emerald-900/10">
                            <span className="text-[15px] font-black text-white uppercase tracking-[0.2em]">Grand Total</span>
                            <span className="text-[24px] font-black text-white drop-shadow-md">₹{grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddPurchaseInvoice;
