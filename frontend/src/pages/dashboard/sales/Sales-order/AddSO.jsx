import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ROUTES } from '../../../../constants/routes';
import { toast } from 'react-hot-toast';
import {
    ArrowLeft,
    Search,
    Trash2,
    Plus,
    Printer,
    X,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Calendar,
    FileText,
    Percent,
    Hash,
    ChevronsUpDown,
    AlertCircle
} from 'lucide-react';
import salesOrderService from '../../../../services/salesOrderService';
import accountService from '../../../../services/accountService';
import productService from '../../../../services/productService';

const AddSO = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { id } = useParams();
    const isEditMode = Boolean(id);
    const customerContainerRef = React.useRef(null);
    const tableContainerRef = React.useRef(null);
    const dropdownScrollRef = React.useRef(null);

    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [isCustomerTypeDropdownOpen, setIsCustomerTypeDropdownOpen] = useState(false);
    const customerTypes = ['industrial', 'institutional', 'dealer', 'retailer', 'wholesaler'];
    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [formData, setFormData] = useState({
        customer_id: '',
        customer_name: '',
        address: '',
        so_number: '',
        gst_number: '',
        credit_days: '',
        creation_date: new Date().toLocaleDateString('en-CA'),
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
    const [activeField, setActiveField] = useState('name'); // 'code' or 'name' 
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [products, setProducts] = useState([]);
    const [showDropdownLeft, setShowDropdownLeft] = useState(false);
    const [showDropdownRight, setShowDropdownRight] = useState(false);

    const [showValidationPopup, setShowValidationPopup] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Customers and Handle Draft Recovery
    useEffect(() => {
        const fetchInitialLists = async () => {
            setIsLoading(true);
            try {
                // Use the specific Sales Order customer endpoint
                const fetchedCustomers = await salesOrderService.getCustomers();
                setCustomers(fetchedCustomers || []);

                // Recover Draft if exists
                const draftStr = sessionStorage.getItem('add_so_draft');
                const shouldRestore = searchParams.get('restore') === 'true';

                if (draftStr && (!isEditMode || shouldRestore)) {
                    try {
                        const draft = JSON.parse(draftStr);
                        
                        if (shouldRestore) {
                            // Full restore for preview return
                            setFormData(draft.formData);
                            setItems(draft.items);
                            setCustomerSearch(draft.formData.customer_name || '');
                        } else if (!isEditMode) {
                            // Partial restore for general draft (existing behavior)
                            const {
                                customer_id,
                                customer_name,
                                address,
                                gst_number,
                                pan_number,
                                customer_type,
                                credit_days,
                                ...otherFormData
                            } = draft.formData;

                            setFormData(prev => ({
                                ...prev,
                                ...otherFormData,
                                customer_id: '',
                                customer_name: '',
                                address: '',
                                gst_number: '',
                                pan_number: '',
                                customer_type: '',
                                credit_days: '',
                                expiry_date: ''
                            }));
                            setItems(draft.items);
                            setCustomerSearch('');
                        }
                        setIsRestoringDraft(true);
                    } catch (e) {
                        console.error('Draft parsing failed', e);
                    }
                }
            } catch (error) {
                console.error("Error fetching customers:", error);
                toast.error("Failed to load customer list");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialLists();
    }, [isEditMode]);

    // Close customer dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerContainerRef.current && !customerContainerRef.current.contains(event.target)) {
                setIsCustomerDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle new customer return
    useEffect(() => {
        const newCustomerId = searchParams.get('newCustomerId');
        if (newCustomerId) {
            const selectCustomer = (customer) => {
                handleSelectCustomer(customer);
                // Clear param after selection to avoid re-triggering
                const newUrl = window.location.pathname + window.location.search.replace(/[?&]newCustomerId=[^&]*/, '').replace(/^&/, '?');
                window.history.replaceState({}, '', newUrl);
            };

            const existing = customers.find(c => String(c.id) === String(newCustomerId));
            if (existing) {
                selectCustomer(existing);
            } else {
                // Fetch explicitly if not in list
                accountService.getAccountById(newCustomerId).then(response => {
                    const customer = response.data || response;
                    if (customer && customer.id) {
                        setCustomers(prev => [...prev, customer]);
                        selectCustomer(customer);
                    }
                }).catch(err => console.error("Error fetching new customer:", err));
            }
        }
    }, [searchParams, customers]);

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
                            pan_number: soToEdit.panNumber || '',
                            customer_type: soToEdit.customerType || ''
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
                    setFormData(prev => ({
                        ...prev,
                        so_number: response.soNumber || response.salesNumber,
                        expiry_date: '' // Explicitly clear on fresh load
                    }));
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
            c.customerName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
            c.customerCode?.toLowerCase().includes(customerSearch.toLowerCase())
        );
    }, [customerSearch, customers]);

    const filteredProducts = useMemo(() => {
        const searchLower = tableSearch.toLowerCase();
        // Get IDs of all products already added to the order
        const usedProductIds = items
            .filter(item => item.product_id)
            .map(item => String(item.product_id));

        return (products || []).filter(p => {
            // Check if product is already in the table
            const isUsed = usedProductIds.includes(String(p.id));
            if (isUsed) return false;

            return (
                p.product_name?.toLowerCase().includes(searchLower) ||
                p.product_code?.toLowerCase().includes(searchLower) ||
                p.hsn_code?.toLowerCase().includes(searchLower) ||
                p.category?.name?.toLowerCase().includes(searchLower)
            );
        });
    }, [products, tableSearch, items]);

    const handleSelectCustomer = async (customer) => {
        setFormData(prev => ({
            ...prev,
            customer_id: customer.id,
            customer_name: customer.customerName,
            address: customer.address || '',
            gst_number: customer.gstNumber || '',
            credit_days: customer.creditDays || '',
            pan_number: customer.panNumber || '',
            customer_type: customer.customerType || ''
        }));
        setCustomerSearch(''); // Clear search after selection
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

        // Logic: Auto-create an empty row if all rows are filled
        const hasEmptyRow = updatedItems.some(item => !item.product_name);
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
    };

    const handleSearchKeyDown = (e, index = null) => {
        if (!isProductSearchOpen || filteredProducts.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSuggestionIndex(prev => (prev + 1) % filteredProducts.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSuggestionIndex(prev => (prev - 1 + filteredProducts.length) % filteredProducts.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const product = filteredProducts[selectedSuggestionIndex];
            if (product) {
                handleQuickAddProduct(product, index);
            }
        } else if (e.key === 'Escape') {
            setIsProductSearchOpen(false);
        } else if (e.key === 'Tab' && isProductSearchOpen) {
            // Optional: select first result on tab if no index is active
            if (filteredProducts.length > 0) {
                handleQuickAddProduct(filteredProducts[selectedSuggestionIndex], index);
            }
        }
    };

    const handleAddNewProduct = () => {
        const redirectPath = ROUTES.SALES_ORDER_ADD;
        navigate(`${ROUTES.PRODUCT_MASTER}/add?redirect=${redirectPath}${id ? `&id=${id}` : ''}`);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        // Update the specific field with decimal limit for discounts
        let finalValue = value;
        if (['discount_amount', 'discount_percent', 'discount_percentage', 'discount_amt'].includes(field)) {
            if (value.includes('.') && value.split('.')[1].length > 2) {
                const [int, dec] = value.split('.');
                finalValue = `${int}.${dec.slice(0, 2)}`;
            }
        }
        item[field] = finalValue;

        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const taxPct = parseFloat(item.tax_percent) || 0;
        let discAmt = parseFloat(item.discount_amount) || 0;
        let discPct = parseFloat(item.discount_percent) || 0;

        // If quantity or rate changed, always synchronize discount based on the percentage
        if (field === 'quantity' || field === 'rate') {
            discAmt = (qty * rate * discPct) / 100;
            item.discount_amount = parseFloat(discAmt.toFixed(2));
        }
        // If discount percent changed, update discount amount
        else if (field === 'discount_percent' || field === 'discount_percentage') {
            discAmt = (qty * rate * discPct) / 100;
            item.discount_amount = parseFloat(discAmt.toFixed(2));
        }
        // If discount amount changed, update discount percent
        else if (field === 'discount_amount' || field === 'discount_amt') {
            if (qty * rate > 0) {
                discPct = (discAmt / (qty * rate)) * 100;
                item.discount_percent = parseFloat(discPct.toFixed(2));
            } else {
                item.discount_percent = 0;
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
        if (!formData.expiry_date) {
            newErrors.expiry_date = "Expiry date is required";
        } else {
            const expiryDate = new Date(formData.expiry_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (expiryDate < today) {
                newErrors.expiry_date = "Expiry date cannot be in the past";
            }
        }

        const validItems = items.filter(item => item.product_name);
        if (validItems.length === 0) newErrors.items = true;
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;
        setIsSaving(true);
        const payload = {
            customerId: Number(formData.customer_id),
            customerType: formData.customer_type,
            soNumber: formData.so_number,
            soCreationDate: formData.creation_date,
            expiryDate: formData.expiry_date,
            creditDays: Number(formData.credit_days),
            items: items.filter(item => item.product_name).map(item => ({
                productId: item.product_id,
                productCode: item.product_code,
                productName: item.product_name,
                hsnCode: item.hsn,
                quantity: parseFloat(item.quantity),
                rate: parseFloat(item.rate),
                uom: item.uom,
                discountPercent: parseFloat(item.discount_percent) || 0,
                discountAmount: parseFloat(item.discount_amount) || 0,
                taxPercent: parseFloat(item.tax_percent) || 0,
                printDescription: item.description || item.printDescription || ''
            }))
        };

        try {
            if (isEditMode) {
                await salesOrderService.updateSalesOrder(id, payload);
                toast.success("Sales Order updated successfully");
            } else {
                await salesOrderService.createSalesOrder(payload);
                toast.success("Sales Order created successfully");
            }
            sessionStorage.removeItem('add_so_draft');
            navigate(ROUTES.SALES_ORDER);
        } catch (error) {
            console.error("Save Error:", error);
            const errorMsg = error.response?.data?.message || "Failed to save Sales Order";
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const totalBillAmount = items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

    const scrollTable = (direction, isDropdown = false) => {
        const ref = isDropdown ? dropdownScrollRef : tableContainerRef;
        if (ref.current) {
            const scrollAmount = 400;
            ref.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const checkDropdownScroll = () => {
        if (dropdownScrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = dropdownScrollRef.current;
            setShowDropdownLeft(scrollLeft > 5);
            setShowDropdownRight(scrollLeft < scrollWidth - clientWidth - 5);
        }
    };

    // Check scroll on open
    useEffect(() => {
        if (isProductSearchOpen) {
            setTimeout(checkDropdownScroll, 100);
        }
    }, [isProductSearchOpen, filteredProducts]);

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

                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-[100] flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[14px] font-bold text-emerald-900">Loading customers...</p>
                        </div>
                    </div>
                )}

                <div className="p-8 border-b border-[#F3F4F6]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 font-outfit">
                        {/* Row 1 */}
                        <div className="space-y-2 relative" ref={customerContainerRef}>
                            <label className="text-[14px] font-semibold text-[#374151]">Customer Name <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search or select customer..."
                                    value={isCustomerDropdownOpen ? customerSearch : (formData.customer_name || '')}
                                    onFocus={() => {
                                        setCustomerSearch(formData.customer_name || '');
                                        setIsCustomerDropdownOpen(true);
                                    }}
                                    onChange={(e) => {
                                        setCustomerSearch(e.target.value);
                                        setIsCustomerDropdownOpen(true);
                                    }}
                                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none transition-all ${errors.customer_name ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                                />
                                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-transform duration-200 pointer-events-none ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} size={18} />

                                {isCustomerDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-[70] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                                            {filteredCustomers.length > 0 ? (
                                                filteredCustomers.map(customer => (
                                                    <button
                                                        key={customer.id}
                                                        onClick={() => {
                                                            handleSelectCustomer(customer);
                                                            setIsCustomerDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 text-[14px] text-[#374151] font-medium transition-colors border-b border-[#F3F4F6] last:border-0 flex flex-col gap-0.5"
                                                    >
                                                        <span className="font-bold text-[#111827]">{customer.customerName}</span>
                                                        <span className="text-[11px] text-gray-400">{customer.customerCode || 'No Code'} • {customer.address?.split(',').pop()?.trim() || 'No City'}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-6 text-center text-gray-400 text-[13px] italic">
                                                    No customers found for "{customerSearch}"
                                                </div>
                                            )}
                                        </div>
                                        {/* Persistent Add Button at the bottom */}
                                        <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const nameParam = customerSearch ? `&name=${encodeURIComponent(customerSearch)}` : '';
                                                    navigate(`${ROUTES.ACCOUNT_MASTER}/add?type=debtor&redirect=${ROUTES.SALES_ORDER_ADD}${nameParam}`);
                                                }}
                                                className="w-full h-[40px] bg-[#073318] text-white rounded-[8px] text-[13px] font-bold hover:bg-[#052611] transition-all flex items-center justify-center gap-2 group shadow-sm font-outfit"
                                            >
                                                <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                                Add New Customer
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {errors.customer_name && <p className="text-red-500 text-[12px] mt-1 italic font-medium">*{errors.customer_name}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Customer Type</label>
                            <input
                                type="text"
                                value={formData.customer_type || ''}
                                readOnly
                                className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-gray-500 outline-none cursor-not-allowed font-medium"
                                placeholder="Auto-fetched from Account Master"
                            />
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Credit Days <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                min="0"
                                value={formData.credit_days}
                                onChange={(e) => setFormData({ ...formData, credit_days: e.target.value })}
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                                placeholder="Enter credit days"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Address</label>
                            <input
                                type="text"
                                value={formData.address || ''}
                                readOnly
                                className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-gray-500 outline-none cursor-not-allowed font-medium"
                                placeholder="Auto-fetched from Account Master"
                            />
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">SO Creation Date</label>
                            <input
                                type="text"
                                value={new Date().toLocaleDateString('en-CA')}
                                readOnly
                                className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-gray-500 outline-none cursor-not-allowed font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">SO Booking Date</label>
                            <input
                                type="text"
                                value={new Date().toLocaleDateString('en-CA')}
                                readOnly
                                className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-gray-500 outline-none cursor-not-allowed font-medium"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">SO Number</label>
                            <input
                                type="text"
                                value={formData.so_number}
                                readOnly
                                className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-gray-500 outline-none cursor-not-allowed font-medium"
                            />
                        </div>

                        {/* Row 4 */}
                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">Expiry Date <span className="text-red-500">*</span></label>
                            <div className="relative group/date">
                                <input
                                    type="date"
                                    value={formData.expiry_date}
                                    min={new Date().toISOString().split('T')[0]}
                                    onKeyDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        try {
                                            e.target.showPicker();
                                        } catch (err) {}
                                    }}
                                    onChange={(e) => {
                                        setFormData({ ...formData, expiry_date: e.target.value });
                                    }}
                                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 pr-12 text-[14px] outline-none transition-all placeholder:text-gray-400 custom-date-input cursor-pointer ${errors.expiry_date ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                                />
                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover/date:text-[#073318] transition-colors" size={20} />
                            </div>
                            {errors.expiry_date && <p className="text-red-500 text-[12px] mt-1 italic font-medium">*{errors.expiry_date}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                            <input
                                type="text"
                                value={formData.gst_number || ''}
                                readOnly
                                className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-gray-500 outline-none cursor-not-allowed font-medium"
                                placeholder="Auto-fetched from Account Master"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-8 pb-3 border-b border-gray-100 bg-white sticky top-0 z-40">
                    <div className="flex items-center gap-6">
                        <div className="relative flex-1 max-w-[550px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                            <input
                                type="text"
                                placeholder="Search By Anything..."
                                value={tableSearch}
                                onFocus={() => {
                                    setActiveRowIndex(null);
                                    setIsProductSearchOpen(true);
                                }}
                                onKeyDown={(e) => handleSearchKeyDown(e, null)}
                                onChange={(e) => {
                                    setTableSearch(e.target.value);
                                    setActiveRowIndex(null);
                                    setIsProductSearchOpen(true);
                                    setSelectedSuggestionIndex(0);
                                }}
                                className={`w-full h-[48px] bg-white border rounded-[12px] pl-11 pr-4 text-[14px] outline-none focus:ring-1 transition-all placeholder:text-[#9CA3AF] shadow-sm font-outfit ${errors.items ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-[#073318]/10'}`}
                            />
                            {errors.items && <p className="text-red-500 text-[12px] mt-1 font-medium italic font-outfit">*Please add at least one product</p>}

                            {/* Global Product Search Suggestions Dropdown */}
                            {isProductSearchOpen && activeRowIndex === null && (
                                <div className="absolute top-full left-0 w-full sm:w-[550px] mt-2 bg-white border border-gray-100 rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[60] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 font-outfit border-t-4 border-t-emerald-800">
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {filteredProducts.map((p, idx) => (
                                            <button
                                                key={p.id}
                                                onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                                                onClick={() => handleQuickAddProduct(p)}
                                                className={`w-full px-5 py-4 flex items-center justify-between transition-all text-left outline-none border-b border-gray-50 last:border-0 group ${selectedSuggestionIndex === idx ? 'bg-emerald-50/80 shadow-inner' : 'hover:bg-gray-50/50'}`}
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold text-[15px] transition-colors ${selectedSuggestionIndex === idx ? 'text-emerald-900' : 'text-[#111827]'}`}>{p.product_name}</span>
                                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-extrabold text-gray-500 tracking-wider">#{p.product_code}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-400">
                                                        <span className="flex items-center gap-1">HSN: <span className="text-gray-700 font-bold">{p.hsn_code || p.hsn || 'N/A'}</span></span>
                                                        <span className="flex items-center gap-1">Tax: <span className="text-gray-700 font-bold">{p.tax_rate || p.tax || 0}%</span></span>
                                                        <span className="flex items-center gap-1">Price: <span className="text-emerald-700 font-black">₹{p.sellingRate || p.rate || 0}</span></span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">{p.category?.name || p.category || 'GENERAL'}</span>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${selectedSuggestionIndex === idx ? 'bg-emerald-600 text-white translate-x-1' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        <Plus size={18} />
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <div className="px-5 py-10 text-center text-[13px] text-gray-400 italic">No products found for "{tableSearch}"</div>
                                        )}
                                    </div>

                                    {/* Action Button Footer */}
                                    <div className="p-3 bg-gray-50 border-t border-[#F3F4F6] mt-auto shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                                        <button
                                            onClick={handleAddNewProduct}
                                            className="w-full h-[44px] bg-[#073318] text-white text-[14px] font-bold rounded-[10px] hover:bg-[#052611] transition-all flex items-center justify-center gap-2 group shadow-md"
                                        >
                                            <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                            Add new product
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Dropdown Overlay */}
                            {isProductSearchOpen && (
                                <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsProductSearchOpen(false)}></div>
                            )}
                        </div>
                    </div>
                </div>

                <style>{`
                    .custom-so-scrollbar::-webkit-scrollbar {
                        height: 6px;
                    }
                    .custom-so-scrollbar::-webkit-scrollbar-track {
                        background: #F3F4F6;
                    }
                    .custom-so-scrollbar::-webkit-scrollbar-thumb {
                        background: #A7C0B8;
                        border-radius: 4px;
                    }
                    .custom-so-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #014A36;
                    }
                    
                    /* New Horizontal Search Suggestion Styles */
                    .suggestion-row {
                        display: flex;
                        align-items: center;
                        background: #07835B; /* Vibrant Green from reference */
                        color: white;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                        transition: all 0.15s ease;
                        cursor: pointer;
                        min-height: 64px;
                    }
                    .suggestion-row:hover, .suggestion-row.active {
                        background: #056d4b;
                    }
                    .suggestion-dot {
                        width: 14px;
                        height: 14px;
                        background: white;
                        border-radius: 50%;
                        opacity: 0.15;
                        transition: all 0.2s ease;
                    }
                    .suggestion-row.active .suggestion-dot {
                        opacity: 1;
                        box-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
                        transform: scale(1.1);
                    }
                    .suggestion-col-divider {
                        border-right: 1px solid rgba(255, 255, 255, 0.15);
                        height: 100%;
                        display: flex;
                        align-items: center;
                        flex-shrink: 0;
                    }

                    /* Hide native date icon but keep functionality */
                    .custom-date-input::-webkit-calendar-picker-indicator {
                        position: absolute;
                        right: 12px;
                        top: 0;
                        bottom: 0;
                        width: 30px;
                        height: auto;
                        background: transparent;
                        color: transparent;
                        cursor: pointer;
                        z-index: 10;
                    }
                    .custom-date-input {
                        position: relative;
                        appearance: none;
                        -webkit-appearance: none;
                    }
                `}</style>

                <div className="relative group/table container-full">
                    {/* Horizontal Scroll Arrows */}
                    <button
                        onClick={() => scrollTable('left')}
                        className={`absolute left-3 top-[160px] z-[50] w-[42px] h-[42px] bg-[#073318] text-white rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300 ${isProductSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover/table:opacity-100 hover:scale-110 active:scale-95'} border border-white/10`}
                        title="Scroll Left"
                    >
                        <ArrowLeft size={20} strokeWidth={2.5} />
                    </button>

                    <button
                        onClick={() => scrollTable('right')}
                        className={`absolute right-3 top-[160px] z-[50] w-[42px] h-[42px] bg-[#073318] text-white rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-all duration-300 ${isProductSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover/table:opacity-100 hover:scale-110 active:scale-95'} border border-white/10`}
                        title="Scroll Right"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                    </button>

                    <div
                        ref={tableContainerRef}
                        className="overflow-x-auto custom-so-scrollbar min-h-[500px] bg-white pb-[300px]"
                    >
                        <table className="w-full min-w-[2410px] border-collapse bg-white">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">
                                        #
                                    </th>
                                    {[
                                        { label: "Product Code", width: "160px" },
                                        { label: "Product", width: "350px" },
                                        { label: "Description", width: "300px" },
                                        { label: "Qty", width: "120px" },
                                        { label: "UOM", width: "100px" },
                                        { label: "Rate", width: "120px" },
                                        { label: "Disc Amt", width: "160px" },
                                        { label: "Disc %", width: "140px" },
                                        { label: "HSN", width: "140px" },
                                        { label: "Tax %", width: "120px" },
                                        { label: "Before Tax", width: "160px" },
                                        { label: "Tax Amt", width: "140px" },
                                        { label: "Total Amt", width: "160px" }
                                    ].map((col, i) => (
                                        <th key={i} className="px-4 py-4 text-left text-[13px] font-medium text-[#6B7280] border-l border-[#F3F4F6]" style={{ width: col.width }}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="px-4 py-4 w-[80px] text-center text-[13px] font-semibold text-[#4B5563] border-l border-[#F3F4F6]">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, index) => (
                                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                                        <td className="px-4 py-3 text-center text-[#6B7280] text-[13px]">{index + 1}</td>

                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                type="text"
                                                value={item.product_code}
                                                onKeyDown={(e) => handleSearchKeyDown(e, index)}
                                                onChange={(e) => {
                                                    setTableSearch(e.target.value);
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                    setSelectedSuggestionIndex(0);
                                                }}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
                                                    setActiveField('code');
                                                    setIsProductSearchOpen(true);
                                                }}
                                                placeholder="Code"
                                                className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none hover:bg-gray-50 rounded-md transition-all cursor-pointer font-bold"
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-l border-[#F3F4F6] relative">
                                            <input
                                                type="text"
                                                value={item.product_name || (activeRowIndex === index ? tableSearch : '')}
                                                onKeyDown={(e) => handleSearchKeyDown(e, index)}
                                                onChange={(e) => {
                                                    setTableSearch(e.target.value);
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                    setSelectedSuggestionIndex(0);
                                                }}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
                                                    setActiveField('name');
                                                    setIsProductSearchOpen(true);
                                                }}
                                                placeholder={item.product_name ? "" : "Select product..."}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-[#111827] outline-none hover:bg-gray-50 rounded-md transition-all cursor-pointer ${!item.product_name ? 'italic text-gray-400 font-normal' : ''}`}
                                            />

                                            {/* 🔥 ERP-Style Full-Width Horizontal Search Results */}
                                            {isProductSearchOpen && activeRowIndex === index && (
                                                <div
                                                    className="absolute top-full mt-1 bg-white border border-gray-100 rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 font-outfit pointer-events-none group/dropdown"
                                                    style={{
                                                        left: '-220px',
                                                        width: 'calc(100vw - 320px)', // Constrain visibility to viewport
                                                        maxWidth: '2410px'
                                                    }}
                                                >
                                                    {/* Dropdown Local Scroll Arrows - Smart Visibility */}
                                                    {showDropdownLeft && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); scrollTable('left', true); }}
                                                            className="absolute left-4 top-[140px] z-[120] w-[42px] h-[42px] bg-[#073318] text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 opacity-100 scale-100 hover:scale-110 active:scale-95 border border-white/20 pointer-events-auto"
                                                        >
                                                            <ArrowLeft size={20} strokeWidth={2.5} />
                                                        </button>
                                                    )}

                                                    {showDropdownRight && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); scrollTable('right', true); }}
                                                            className="absolute right-4 top-[140px] z-[120] w-[42px] h-[42px] bg-[#073318] text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 opacity-100 scale-100 hover:scale-110 active:scale-95 border border-white/20 pointer-events-auto"
                                                        >
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                                        </button>
                                                    )}

                                                    <div
                                                        ref={dropdownScrollRef}
                                                        onScroll={checkDropdownScroll}
                                                        className="max-h-[380px] overflow-y-auto overflow-x-auto custom-scrollbar bg-[#07835B] pointer-events-auto"
                                                    >
                                                        <div style={{ width: '2410px' }}> {/* Wide Content Wrapper */}
                                                            {filteredProducts.map((p, idx) => (
                                                                <button
                                                                    key={p.id}
                                                                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                                                                    onClick={() => handleQuickAddProduct(p, index)}
                                                                    className={`w-full suggestion-row ${selectedSuggestionIndex === idx ? 'active' : ''}`}
                                                                    style={{ width: '2410px' }}
                                                                >
                                                                    {/* # Col - Width: 60px */}
                                                                    <div className="w-[60px] flex items-center justify-center suggestion-col-divider shrink-0">
                                                                        <div className="suggestion-dot"></div>
                                                                    </div>

                                                                    {/* Code Col - Width: 160px */}
                                                                    <div className="w-[160px] px-5 flex items-center suggestion-col-divider font-bold text-[13px] uppercase tracking-wider shrink-0">
                                                                        {p.product_code}
                                                                    </div>

                                                                    {/* Product Col - Width: 350px */}
                                                                    <div className="w-[350px] px-6 flex flex-col justify-center suggestion-col-divider text-left shrink-0">
                                                                        <span className="font-bold text-[15px] leading-tight">{p.product_name}</span>
                                                                        <span className="text-[10px] text-white/70 font-bold uppercase tracking-tight">{p.category?.name || p.category || 'Fruit'}</span>
                                                                    </div>

                                                                    {/* Description Col - Width: 300px */}
                                                                    <div className="w-[300px] px-8 flex items-center justify-center suggestion-col-divider italic text-[12px] font-bold text-white/80 shrink-0">
                                                                        Select this item to continue
                                                                    </div>

                                                                    {/* Qty Col - Width: 120px */}
                                                                    <div className="w-[120px] flex items-center justify-center suggestion-col-divider shrink-0">
                                                                        <span className="italic text-[11px] font-black text-white/90 uppercase tracking-widest">QTY</span>
                                                                    </div>

                                                                    {/* UOM Col - Width: 100px */}
                                                                    <div className="w-[100px] flex items-center justify-center suggestion-col-divider font-bold text-[14px] shrink-0">
                                                                        {p.uom?.unit_name || 'Weight'}
                                                                    </div>

                                                                    {/* Rate Col - Width: 120px */}
                                                                    <div className="w-[120px] px-4 flex items-center justify-center suggestion-col-divider font-bold text-[16px] shrink-0">
                                                                        ₹{p.sellingRate || p.rate || 0}
                                                                    </div>

                                                                    {/* HSN Col - Width: 140px */}
                                                                    <div className="w-[140px] px-4 flex items-center justify-center suggestion-col-divider font-bold text-[15px] shrink-0">
                                                                        {p.hsn_code || '1001'}
                                                                    </div>

                                                                    {/* Tax Col - Width: 120px */}
                                                                    <div className="w-[120px] px-4 flex items-center justify-center suggestion-col-divider shrink-0 font-black text-[16px]">
                                                                        {p.tax_rate || 0}%
                                                                    </div>
                                                                    <div className="w-[160px] suggestion-col-divider shrink-0"></div>
                                                                    <div className="w-[140px] suggestion-col-divider shrink-0"></div>
                                                                    <div className="w-[160px] suggestion-col-divider shrink-0"></div>
                                                                    <div className="w-[160px] suggestion-col-divider shrink-0"></div>
                                                                    <div className="w-[80px] shrink-0"></div>
                                                                </button>
                                                            ))}
                                                            {filteredProducts.length === 0 && (
                                                                <div className="p-10 text-center text-gray-400 bg-gray-50 italic">No products found for "{tableSearch}"</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Dropdown Footer */}
                                                    <div className="p-6 flex justify-center bg-gray-50/80 pointer-events-auto">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddNewProduct();
                                                            }}
                                                            className="h-[48px] px-14 bg-[#06341B] text-white text-[15px] font-bold rounded-[12px] hover:bg-[#042412] hover:scale-[1.05] transition-all flex items-center gap-2 shadow-2xl border border-white/10"
                                                        >
                                                            <Plus size={22} className="text-white" />
                                                            Add New Product
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm"
                                                placeholder="Description"
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                id={`qty-${index}`}
                                                type="number"
                                                min="0"
                                                value={item.quantity || ''}
                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                className={`w-full h-[36px] bg-white border rounded-[8px] px-2 text-[13px] outline-none focus:ring-1 text-right transition-all shadow-sm ${errors.itemErrors?.[index]?.quantity ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-[#073318]/10'}`}
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                type="text"
                                                value={item.uom}
                                                readOnly={!!item.product_name}
                                                onKeyDown={(e) => handleSearchKeyDown(e, index)}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                }}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] text-center outline-none font-medium ${!item.product_name ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'}`}
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.rate || ''}
                                                onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                                className={`w-full h-[36px] bg-white border rounded-[8px] px-2 text-[13px] outline-none focus:ring-1 text-right transition-all shadow-sm ${errors.itemErrors?.[index]?.rate ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-[#073318]/10'}`}
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-bold">₹</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={item.discount_amount || ''}
                                                    onChange={(e) => handleItemChange(index, 'discount_amount', e.target.value)}
                                                    className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] pl-5 pr-2 text-[13px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 text-right transition-all shadow-sm"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="relative">
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[#073318] font-bold">%</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={item.discount_percent || ''}
                                                    onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                                                    className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] pl-2 pr-5 text-[13px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 text-right font-medium text-[#073318] transition-all shadow-sm"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                type="text"
                                                value={item.hsn}
                                                readOnly={!!item.product_name}
                                                onKeyDown={(e) => handleSearchKeyDown(e, index)}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                }}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none font-medium ${!item.product_name ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'}`}
                                                placeholder="HSN"
                                            />
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                type="text"
                                                value={item.tax_percent ? `${item.tax_percent}%` : ''}
                                                readOnly={!!item.product_name}
                                                onKeyDown={(e) => handleSearchKeyDown(e, index)}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                }}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-right outline-none font-bold text-[#073318] ${!item.product_name ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'}`}
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
                                                className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-[#073318] text-right outline-none cursor-not-allowed"
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-l border-[#F3F4F6] text-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newItems = items.filter((_, i) => i !== index);
                                                    if (newItems.length === 0) {
                                                        newItems.push({
                                                            id: Date.now(), product_id: null, product_code: '', product_name: '',
                                                            quantity: 0, rate: 0, uom: '', discount_amount: 0, discount_percent: 0,
                                                            hsn: '', tax_percent: 0, before_tax: 0, tax_amount: 0, total_amount: 0, description: ''
                                                        });
                                                    }
                                                    setItems(newItems);
                                                }}
                                                className="w-[32px] h-[32px] flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-[#F9FAFB] border-t-2 border-[#E5E7EB]">
                                <tr className="h-[52px] font-bold text-[#111827]">
                                    <td colSpan={3} className="px-4 py-2 text-[14px] text-left">Total</td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="px-4 py-2 text-right text-[15px] border-l border-[#F3F4F6]">{tableTotals.quantity}</td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="px-4 py-2 text-right text-[13px] font-bold text-[#111827] border-l border-[#F3F4F6]">
                                        {tableTotals.beforeTax.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-right text-[13px] font-bold text-[#111827] border-l border-[#F3F4F6]">
                                        {tableTotals.taxAmount.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-right text-[13px] font-bold text-[#073318] border-l border-[#F3F4F6]">
                                        ₹ {tableTotals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-5 flex justify-end gap-3 z-[100] shadow-[0_-8px_30px_rgba(0,0,0,0.04)] font-outfit">
                    <button
                        onClick={() => {
                            if (!validateForm()) {
                                setShowValidationPopup(true);
                                return;
                            }
                            
                            // Explicitly save the latest state before navigating
                            sessionStorage.setItem('add_so_draft', JSON.stringify({ formData, items }));

                            navigate(ROUTES.SALES_ORDER_PRINT, {
                                state: {
                                    soData: { 
                                        ...formData, 
                                        items: items.filter(it => it.product_name).map(it => ({
                                            ...it,
                                            // Ensure both are present for maximum compatibility with preview
                                            printDescription: it.description || it.printDescription || it.productName || it.product_name || '',
                                            description: it.description || it.printDescription || it.productName || it.product_name || ''
                                        }))
                                    },
                                    from: id ? `/seller/sales/order/edit/${id}` : ROUTES.SALES_ORDER_ADD
                                }
                            });
                        }}
                        className="flex items-center gap-2 px-7 h-[48px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSaving}
                    >
                        <Printer size={18} /> Preview & Print
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-9 h-[48px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : 'Save SO'}
                    </button>
                    <button onClick={() => navigate(-1)} disabled={isSaving} className="px-9 h-[48px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all active:scale-95 shadow-sm disabled:opacity-50">
                        Cancel
                    </button>
                </div>
            {/* Validation Popup */}
            {showValidationPopup && (
                <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[4px] z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[24px] w-full max-w-[420px] shadow-[0_25px_80px_rgba(0,0,0,0.18)] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-[#EF4444] px-7 py-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <AlertCircle className="text-white" size={19} />
                                </div>
                                <h3 className="text-[17px] font-bold text-white tracking-tight font-outfit">Missing Required Fields</h3>
                            </div>
                            <button 
                                onClick={() => setShowValidationPopup(false)} 
                                className="text-white/80 hover:text-white transition-colors p-1"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-7 font-outfit">
                            <div className="min-h-[60px] flex items-center">
                                <p className="text-[15px] text-[#475569] leading-[1.6] font-medium">
                                    Please ensure all mandatory fields (marked with <span className='text-red-600 font-bold'>*</span>) are filled correctly before proceeding to preview.
                                </p>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button 
                                    onClick={() => setShowValidationPopup(false)}
                                    className="h-[46px] px-8 bg-[#EF4444] text-white rounded-[12px] text-[15px] font-bold hover:bg-[#DC2626] transition-all active:scale-[0.96] shadow-[0_4px_15px_rgba(239,68,68,0.25)] flex items-center justify-center"
                                >
                                    Got it
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default AddSO;
