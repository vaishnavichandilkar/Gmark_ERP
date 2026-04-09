import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { toast } from 'react-hot-toast';
import {
    ArrowLeft,
    Search,
    Trash2,
    Plus,
    Printer,
    X,
    ChevronDown,
    Calendar,
    FileText,
    Percent,
    Hash,
    ChevronsUpDown,
    AlertCircle
} from 'lucide-react';
import salesOrderService from '../../../services/salesOrderService';
import accountService from '../../../services/accountService';
import productService from '../../../services/productService';

const AddSO = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [isCustomerTypeDropdownOpen, setIsCustomerTypeDropdownOpen] = useState(false);
    const dummyCustomers = ['Dummy Customer A', 'Dummy Customer B'];
    const customerTypes = ['Industrial', 'Institutional', 'Dealer', 'Retailer', 'Wholesaler'];
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [formData, setFormData] = useState({
        customer_id: '',
        customer_name: '',
        address: '',
        so_number: '',
        gst_number: '',
        credit_days: '',
        creation_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        pan_number: '',
        customer_type: ''
    });

    const [errors, setErrors] = useState({});
    const [isRestoringDraft, setIsRestoringDraft] = useState(false);

    const [items, setItems] = useState([
        {
            id: Date.now(),
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

    const [tableSearch, setTableSearch] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState(null);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [products, setProducts] = useState([]);

    const [showValidationPopup, setShowValidationPopup] = useState(false);

    // Fetch Customers and Handle Draft Recovery
    useEffect(() => {
        const fetchInitialLists = async () => {
            try {
                const response = await accountService.getAllAccounts({ groupName: 'SUNDRY_DEBTORS' });
                const fetchedCustomers = response.data || [];
                setCustomers(fetchedCustomers);

                // Recover Draft if exists
                const draftStr = sessionStorage.getItem('add_so_draft');
                if (draftStr) {
                    try {
                        const draft = JSON.parse(draftStr);
                        setFormData(draft.formData);
                        setItems(draft.items);
                        setCustomerSearch(draft.formData.customer_name || '');
                        setIsRestoringDraft(true);
                    } catch (e) {
                        console.error('Draft parsing failed', e);
                    }
                }
            } catch (error) {
                console.error("Error fetching customers:", error);
            }
        };
        fetchInitialLists();
    }, [isEditMode]);

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

    // Initial load for Edit Mode or SO Number generation
    useEffect(() => {
        const loadInitialData = async () => {
            if (isRestoringDraft) return;

            if (isEditMode) {
                try {
                    const soToEdit = await salesOrderService.getSalesOrderById(id);
                    if (soToEdit) {
                        setFormData({
                            customer_id: soToEdit.customerId,
                            customer_name: soToEdit.customerName,
                            address: soToEdit.address,
                            so_number: soToEdit.soNumber,
                            gst_number: soToEdit.gstNumber,
                            credit_days: soToEdit.creditDays,
                            creation_date: soToEdit.soCreationDate ? soToEdit.soCreationDate.split('T')[0] : formData.creation_date,
                            expiry_date: soToEdit.expiryDate ? soToEdit.expiryDate.split('T')[0] : '',
                            pan_number: soToEdit.panNumber || ''
                        });
                        setCustomerSearch(soToEdit.customerName);
                        if (soToEdit.items) {
                            setItems(soToEdit.items.map(item => ({
                                id: item.id,
                                product_id: item.productId,
                                product_code: item.productCode,
                                product_name: item.productName,
                                quantity: item.quantity,
                                rate: item.rate,
                                uom: item.uom,
                                discount_amount: item.discountAmount,
                                discount_percent: item.discountPercent,
                                hsn: item.hsnCode,
                                tax_percent: item.taxPercent,
                                before_tax: (item.quantity * item.rate - item.discountAmount).toFixed(2),
                                tax_amount: item.taxAmount.toFixed(2),
                                total_amount: item.totalAmount.toFixed(2),
                                description: item.printDescription || ''
                            })));
                        }
                    }
                } catch (error) {
                    toast.error("Sales Order not found");
                    navigate(ROUTES.SALES_ORDER);
                }
            } else {
                try {
                    const response = await salesOrderService.getNextNumber();
                    setFormData(prev => ({ ...prev, so_number: response.soNumber || response.salesNumber }));
                } catch (error) {
                    console.error("Error fetching next SO number:", error);
                }
            }
        };
        loadInitialData();
    }, [id, isEditMode, isRestoringDraft]);

    // Auto-save draft
    useEffect(() => {
        const hasData = formData.customer_id || items.some(i => i.product_name);
        if (hasData) {
            sessionStorage.setItem('add_so_draft', JSON.stringify({ formData, items }));
        }
    }, [formData, items]);

    const filteredCustomers = useMemo(() => {
        return (customers || []).filter(c =>
            c.accountName?.toLowerCase().includes(customerSearch.toLowerCase())
        );
    }, [customerSearch, customers]);

    const filteredProducts = useMemo(() => {
        const searchLower = tableSearch.toLowerCase();
        return (products || []).filter(p =>
            p.product_name?.toLowerCase().includes(searchLower) ||
            p.product_code?.toLowerCase().includes(searchLower)
        );
    }, [products, tableSearch]);

    const handleSelectCustomer = async (customer) => {
        setFormData({
            ...formData,
            customer_id: customer.id,
            customer_name: customer.accountName,
            address: customer.addressLine1 + (customer.addressLine2 ? ', ' + customer.addressLine2 : ''),
            gst_number: customer.gstNo || '',
            credit_days: customer.creditDays || '',
            pan_number: customer.panNo || '',
            customer_type: customer.customerType || ''
        });
        setCustomerSearch(customer.accountName);
        setIsCustomerDropdownOpen(false);
    };

    const handleQuickAddProduct = (product, targetIndex = null) => {
        const newItem = {
            id: Date.now(),
            product_id: product.id,
            product_code: product.product_code || '',
            product_name: product.product_name || '',
            quantity: 1,
            rate: product.sellingRate || product.rate || 0,
            uom: product.uom?.unit_name || 'NOS',
            discount_amount: 0,
            discount_percent: 0,
            hsn: product.hsn_code || '',
            tax_percent: product.tax_rate || 0,
            before_tax: (product.sellingRate || 0).toFixed(2),
            tax_amount: ((product.sellingRate || 0) * (product.tax_rate || 0) / 100).toFixed(2),
            total_amount: ((product.sellingRate || 0) * (1 + (product.tax_rate || 0) / 100)).toFixed(2),
            description: product.description || ''
        };

        let updatedItems = [...items];
        const finalTargetIndex = targetIndex !== null ? targetIndex : updatedItems.findIndex(i => !i.product_name);

        if (finalTargetIndex !== -1) {
            updatedItems[finalTargetIndex] = newItem;
        } else {
            updatedItems = [...updatedItems, newItem];
        }

        setItems(updatedItems);
        setTableSearch('');
        setIsProductSearchOpen(false);
        setActiveRowIndex(null);
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

        // If discount percent changed, update discount amount
        if (field === 'discount_percent') {
            discAmt = (qty * rate * discPct) / 100;
            item.discount_amount = parseFloat(discAmt.toFixed(2));
        } 
        // If discount amount changed, update discount percent
        else if (field === 'discount_amount') {
            if (qty * rate > 0) {
                discPct = (discAmt / (qty * rate)) * 100;
                item.discount_percent = parseFloat(discPct.toFixed(2));
            }
        }

        const baseAmount = qty * rate;
        const beforeTaxAmount = baseAmount - discAmt;
        item.before_tax = parseFloat(beforeTaxAmount.toFixed(2));
        
        const taxAmount = (beforeTaxAmount * taxPct) / 100;
        item.tax_amount = parseFloat(taxAmount.toFixed(2));
        item.total_amount = parseFloat((beforeTaxAmount + taxAmount).toFixed(2));

        newItems[index] = item;
        setItems(newItems);
    };

    const tableTotals = useMemo(() => {
        return items.reduce((acc, item) => ({
            quantity: acc.quantity + (parseFloat(item.quantity) || 0),
            beforeTax: acc.beforeTax + (parseFloat(item.before_tax) || 0),
            taxAmount: acc.taxAmount + (parseFloat(item.tax_amount) || 0),
            total: acc.total + (parseFloat(item.total_amount) || 0)
        }), { quantity: 0, beforeTax: 0, taxAmount: 0, total: 0 });
    }, [items]);

    const [tableItemsSearch, setTableItemsSearch] = useState('');
    const filteredTableItems = useMemo(() => {
        if (!tableItemsSearch.trim()) return items;
        return items.filter(item => 
            item.product_name?.toLowerCase().includes(tableItemsSearch.toLowerCase()) ||
            item.product_code?.toLowerCase().includes(tableItemsSearch.toLowerCase()) ||
            item.hsn?.toLowerCase().includes(tableItemsSearch.toLowerCase())
        );
    }, [items, tableItemsSearch]);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.customer_name) newErrors.customer_name = "Customer name is required";
        if (!formData.so_number) newErrors.so_number = "SO number is required";
        if (!formData.expiry_date) newErrors.expiry_date = "Expiry date is required";
        const validItems = items.filter(item => item.product_name);
        if (validItems.length === 0) newErrors.items = true;
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        const payload = {
            customerId: Number(formData.customer_id),
            soNumber: formData.so_number,
            soCreationDate: formData.creation_date,
            expiryDate: formData.expiry_date,
            items: items.filter(item => item.product_name).map(item => ({
                productId: item.product_id,
                productName: item.product_name,
                quantity: parseFloat(item.quantity),
                rate: parseFloat(item.rate),
                taxPercent: parseFloat(item.tax_percent),
                discountAmount: parseFloat(item.discount_amount)
            }))
        };

        try {
            if (isEditMode) {
                await salesOrderService.updateSalesOrder(id, payload);
            } else {
                await salesOrderService.createSalesOrder(payload);
            }
            sessionStorage.removeItem('add_so_draft');
            navigate(ROUTES.SALES_ORDER);
            toast.success("Sales Order saved successfully");
        } catch (error) {
            toast.error("Failed to save Sales Order");
        }
    };

    const totalBillAmount = items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="px-8 py-6 border-b border-[#F3F4F6] flex items-center justify-between">
                    <h2 className="text-[20px] font-bold text-[#111827]">{isEditMode ? 'Edit SO' : 'Add SO'}</h2>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-6 h-[44px] border border-[#E5E7EB] rounded-[10px] text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all font-outfit shadow-sm">
                            <ArrowLeft size={18} /> Back
                        </button>
                    </div>
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 font-outfit">
                        {/* Row 1 */}
                        <div className="space-y-2 relative">
                            <label className="text-[14px] font-semibold text-[#374151]">Customer Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div 
                                    onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 flex items-center justify-between cursor-pointer group transition-all ${errors.customer_name ? 'border-red-500' : 'border-[#E5E7EB] hover:border-[#073318]'}`}
                                >
                                    <span className={`text-[14px] ${formData.customer_name ? 'text-[#111827]' : 'text-gray-400'}`}>
                                        {formData.customer_name || 'Select customer name'}
                                    </span>
                                    <ChevronDown className={`text-gray-400 transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} size={18} />
                                </div>
                                {isCustomerDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-[70] py-1">
                                        {dummyCustomers.map(name => (
                                            <button 
                                                key={name} 
                                                onClick={() => {
                                                    setFormData({ ...formData, customer_name: name, customer_id: 'dummy-id' });
                                                    setCustomerSearch(name);
                                                    setIsCustomerDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-[14px] text-[#374151]"
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {errors.customer_name && <p className="text-red-500 text-[12px]">{errors.customer_name}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Customer Type <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <div 
                                    onClick={() => setIsCustomerTypeDropdownOpen(!isCustomerTypeDropdownOpen)}
                                    className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 flex items-center justify-between cursor-pointer group hover:border-[#073318] transition-all"
                                >
                                    <span className={`text-[14px] ${formData.customer_type ? 'text-[#111827]' : 'text-gray-400'}`}>
                                        {formData.customer_type || 'Select customer type'}
                                    </span>
                                    <ChevronDown className={`text-gray-400 transition-transform duration-200 ${isCustomerTypeDropdownOpen ? 'rotate-180' : ''}`} size={18} />
                                </div>
                                {isCustomerTypeDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-[70] py-1">
                                        {customerTypes.map(type => (
                                            <button 
                                                key={type} 
                                                onClick={() => {
                                                    setFormData({ ...formData, customer_type: type });
                                                    setIsCustomerTypeDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-[14px] text-[#374151]"
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Credit Days <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.credit_days}
                                readOnly
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px]"
                                placeholder="Auto filled form customer"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Address</label>
                            <input
                                type="text"
                                value={formData.address}
                                readOnly
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px]"
                                placeholder="Auto filled form customer"
                            />
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">PO Creation Date</label>
                            <input
                                type="text"
                                value={formData.creation_date}
                                readOnly
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px]"
                                placeholder="Present date will come automatic"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">SO Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.so_number}
                                readOnly
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px]"
                                placeholder="It will be auto generated"
                            />
                        </div>

                        {/* Row 4 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Expiry Date <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={formData.expiry_date}
                                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                    className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-12 text-[14px] outline-none"
                                />
                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                            <input
                                type="text"
                                value={formData.gst_number}
                                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none"
                                placeholder="Enter GST number"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-[#111827]">Order Items</h3>
                        <button onClick={() => setItems([...items, { id: Date.now(), product_name: '', quantity: 0, rate: 0, tax_percent: 0, total_amount: 0, discount_amount: 0, discount_percent: 0, before_tax: 0, tax_amount: 0, uom: '', hsn: '', product_code: '', description: '' }])} className="text-[#073318] font-bold text-[14px] flex items-center gap-2 hover:underline">
                            <Plus size={16} /> Add Row
                        </button>
                    </div>

                    {/* Table Search Bar */}
                    <div className="mb-6 relative max-w-md">
                        <input
                            type="text"
                            placeholder="Search By Anything..."
                            value={tableItemsSearch}
                            onChange={(e) => setTableItemsSearch(e.target.value)}
                            className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[12px] pl-12 pr-4 text-[14px] outline-none focus:border-[#073318] transition-all font-outfit shadow-sm"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    </div>

                    <div className="overflow-x-auto border border-[#E5E7EB] rounded-[16px] shadow-sm bg-white scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        <table className="w-full border-collapse font-outfit min-w-[1400px]">
                            <thead>
                                <tr className="bg-[#F9FAFB] text-[#6B7280] text-[12px] uppercase font-bold text-left">
                                    <th className="px-4 py-4 border-b w-[50px]">#</th>
                                    <th className="px-4 py-4 border-b w-[120px]">Product Code</th>
                                    <th className="px-4 py-4 border-b w-[250px]">Product</th>
                                    <th className="px-4 py-4 border-b w-[100px] text-center">Quantity</th>
                                    <th className="px-4 py-4 border-b w-[120px] text-center">Rate</th>
                                    <th className="px-4 py-4 border-b w-[100px] text-center">UOM</th>
                                    <th className="px-4 py-4 border-b w-[120px] text-center">Discount (₹)</th>
                                    <th className="px-4 py-4 border-b w-[120px] text-center">Discount (%)</th>
                                    <th className="px-4 py-4 border-b w-[120px] text-center">HSN Code</th>
                                    <th className="px-4 py-4 border-b w-[100px] text-center">Tax (%)</th>
                                    <th className="px-4 py-4 border-b w-[120px] text-center">Bef. Tax</th>
                                    <th className="px-4 py-4 border-b w-[120px] text-center">Tax Amt</th>
                                    <th className="px-4 py-4 border-b w-[120px] text-center">Amount</th>
                                    <th className="px-4 py-4 border-b w-[200px]">Print Description</th>
                                    <th className="px-4 py-4 border-b w-[60px] text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTableItems.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors border-b last:border-0 h-[64px]">
                                        <td className="px-4 py-2 text-[14px] text-gray-500 font-medium text-center">{index + 1}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={item.product_code}
                                                readOnly
                                                placeholder="Code"
                                                className="w-full h-[40px] border border-[#E5E7EB] rounded-[8px] px-3 text-[13px] bg-gray-50 text-gray-500 outline-none"
                                            />
                                        </td>
                                        <td className="px-4 py-2 relative">
                                            <input
                                                type="text"
                                                placeholder="Select product..."
                                                value={item.product_name}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    newItems[index].product_name = e.target.value;
                                                    setItems(newItems);
                                                    setTableSearch(e.target.value);
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                }}
                                                className="w-full h-[40px] border border-[#E5E7EB] rounded-[8px] px-3 text-[14px] focus:border-[#073318] outline-none transition-all placeholder:text-gray-300"
                                            />
                                            {isProductSearchOpen && activeRowIndex === index && (
                                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-xl z-50 max-h-[200px] overflow-y-auto">
                                                    {filteredProducts.map(p => (
                                                        <button key={p.id} onClick={() => handleQuickAddProduct(p, index)} className="w-full text-left px-4 py-3 hover:bg-[#073318]/5 border-b border-[#F3F4F6] last:border-0 group transition-all">
                                                            <div className="font-bold text-[#111827] group-hover:text-[#073318]">{p.product_name}</div>
                                                            <div className="text-[12px] text-gray-400 font-medium">{p.product_code} • {p.hsn_code}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-full h-[40px] border border-[#E5E7EB] rounded-[8px] px-3 text-[14px] text-center focus:border-[#073318] outline-none shadow-sm transition-all" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} className="w-full h-[40px] border border-[#E5E7EB] rounded-[8px] px-3 text-[14px] text-center focus:border-[#073318] outline-none shadow-sm transition-all" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="text" value={item.uom} readOnly className="w-full h-[40px] border-transparent rounded-[8px] px-2 text-[13px] text-center text-gray-500 bg-transparent outline-none" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[12px]">₹</span>
                                                <input type="number" value={item.discount_amount} onChange={(e) => handleItemChange(index, 'discount_amount', e.target.value)} className="w-full h-[40px] border border-[#E5E7EB] rounded-[8px] pl-6 pr-2 text-[14px] text-center focus:border-[#073318] outline-none shadow-sm transition-all" />
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="relative">
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[12px]">%</span>
                                                <input type="number" value={item.discount_percent} onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)} className="w-full h-[40px] border border-[#E5E7EB] rounded-[8px] pl-2 pr-6 text-[14px] text-center focus:border-[#073318] outline-none shadow-sm transition-all" />
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="text" value={item.hsn} readOnly placeholder="HSN" className="w-full h-[40px] border-transparent rounded-[8px] px-2 text-[13px] text-center text-gray-400 bg-transparent outline-none" />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={item.tax_percent} readOnly className="w-full h-[40px] border-transparent rounded-[8px] px-2 text-[13px] text-center text-gray-500 bg-transparent outline-none" />
                                        </td>
                                        <td className="px-4 py-2 text-[14px] text-gray-400 text-center font-medium">
                                            {item.before_tax || '0.00'}
                                        </td>
                                        <td className="px-4 py-2 text-[14px] text-gray-400 text-center font-medium">
                                            {item.tax_amount || '0.00'}
                                        </td>
                                        <td className="px-4 py-2 w-[120px] font-bold text-[#111827] text-center text-[15px]">
                                            {item.total_amount || '0.00'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <input 
                                                type="text" 
                                                value={item.description} 
                                                onChange={(e) => handleItemChange(index, 'description', e.target.value)} 
                                                placeholder="Description"
                                                className="w-full h-[40px] border border-[#E5E7EB] rounded-[8px] px-3 text-[13px] focus:border-[#073318] outline-none shadow-sm transition-all" 
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => setItems(items.filter((_, i) => i !== index))} className="w-[32px] h-[32px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-[#F9FAFB] border-t-2 border-[#E5E7EB]">
                                <tr className="h-[52px] font-bold text-[#111827]">
                                    <td colSpan={3} className="px-4 py-2 text-[14px] text-left">Total</td>
                                    <td className="px-4 py-2 text-center text-[15px]">{tableTotals.quantity}</td>
                                    <td colSpan={6} className="px-4 py-2"></td>
                                    <td className="px-4 py-2 text-center text-[15px]">{tableTotals.beforeTax.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-center text-[15px]">{tableTotals.taxAmount.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-center text-[16px] text-[#073318]">₹ {tableTotals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td colSpan={2} className="px-4 py-2"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Gap Spacing */}
                <div className="h-40 bg-white" />

                {/* Footer Actions */}
                <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-5 flex justify-end gap-3 z-[100] shadow-[0_-8px_30px_rgba(0,0,0,0.04)] font-outfit">
                    <button className="flex items-center gap-2 px-7 h-[48px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all active:scale-95 shadow-sm">
                        <Printer size={18} /> Preview & Print
                    </button>
                    <button onClick={handleSave} className="px-9 h-[48px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all active:scale-95 shadow-sm">
                        Save PO
                    </button>
                    <button onClick={() => navigate(-1)} className="px-9 h-[48px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all active:scale-95 shadow-sm">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddSO;
