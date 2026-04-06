import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { toast } from 'react-hot-toast';
import { 
    ArrowLeft, 
    Search, 
    Trash2, 
    Plus, 
    Save, 
    Printer, 
    X,
    ChevronDown,
    Calendar,
    FileText,
    Percent,
    Hash,
    ChevronsUpDown
} from 'lucide-react';
import purchaseOrderService from '../../../services/purchaseOrderService';
import accountService from '../../../services/accountService';
import productService from '../../../services/productService';

// Mock data removed in favor of API calls

const AddPO = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [suppliers, setSuppliers] = useState([]);
    const [formData, setFormData] = useState({
        supplier_id: '',
        supplier_name: '',
        address: '',
        po_number: '', 
        gst_number: '',
        credit_days: '',
        creation_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        pan_number: ''
    });

    const [errors, setErrors] = useState({});

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
    const [products, setProducts] = useState([]);
    
    const [showValidationPopup, setShowValidationPopup] = useState(false);

    // Fetch Suppliers and Handle Draft Recovery
    useEffect(() => {
        const fetchInitialLists = async () => {
            try {
                const response = await accountService.getAllAccounts({ groupName: 'SUNDRY_CREDITORS' });
                const fetchedSuppliers = response.data || [];
                setSuppliers(fetchedSuppliers);

                // Recover Draft if exists
                const draftStr = sessionStorage.getItem('add_po_draft');
                if (draftStr && !isEditMode) {
                    try {
                        const draft = JSON.parse(draftStr);
                        let restoredFormData = draft.formData;
                        let restoredItems = draft.items;
                        
                        // 1. Detect New Supplier
                        const oldSupplierIdsStr = sessionStorage.getItem('add_po_supplier_ids');
                        if (oldSupplierIdsStr) {
                            const oldIds = JSON.parse(oldSupplierIdsStr);
                            const newSupplier = fetchedSuppliers.find(s => !oldIds.includes(s.id));
                            if (newSupplier) {
                                restoredFormData = {
                                    ...restoredFormData,
                                    supplier_id: newSupplier.id,
                                    supplier_name: newSupplier.accountName,
                                    address: newSupplier.addressLine1 || '',
                                    credit_days: newSupplier.supplierCreditDays || '',
                                    gst_number: newSupplier.gstNo || '',
                                    pan_number: newSupplier.panNo || ''
                                };
                                setSupplierSearch(newSupplier.accountName);
                            }
                        }

                        // 2. Detect New Product
                        const oldProductIdsStr = sessionStorage.getItem('add_po_product_ids');
                        if (oldProductIdsStr) {
                            const oldIds = JSON.parse(oldProductIdsStr);
                            // Fetch products to find the new one (limit 50 to cover most cases)
                            const productRes = await productService.getProducts({ limit: 50 });
                            const newProduct = (productRes.products || []).find(p => !oldIds.includes(p.id));
                            if (newProduct) {
                                // Auto-generate the row but avoid duplicates if already present
                                const newItem = {
                                    id: Date.now(), 
                                    product_id: newProduct.id,
                                    product_code: newProduct.product_code, 
                                    product_name: newProduct.product_name, 
                                    quantity: 1, 
                                    rate: newProduct.purchaseRate || 0, 
                                    uom: newProduct.uom?.unit_name || newProduct.uom?.gst_uom || 'NOS', 
                                    discount_amount: 0, 
                                    discount_percent: 0, 
                                    hsn: newProduct.hsn_code || '', 
                                    tax_percent: newProduct.tax_rate || 0, 
                                    before_tax: (newProduct.purchaseRate || 0).toFixed(2), 
                                    tax_amount: ((newProduct.purchaseRate || 0) * (newProduct.tax_rate || 0) / 100).toFixed(2), 
                                    total_amount: ((newProduct.purchaseRate || 0) * (1 + (newProduct.tax_rate || 0) / 100)).toFixed(2),
                                    description: newProduct.description || '' 
                                };
                                
                                // Replace an empty row or append
                                if (restoredItems.length === 1 && !restoredItems[0].product_name) {
                                    restoredItems = [newItem];
                                } else if (!restoredItems.some(i => i.product_id === newProduct.id)) {
                                    restoredItems = [...restoredItems, newItem];
                                }
                                toast.success(`New product "${newProduct.product_name}" added!`);
                            }
                        }
                        
                        setFormData(restoredFormData);
                        setItems(restoredItems);
                    } catch (e) {
                        console.error('Draft parsing failed', e);
                    } finally {
                        sessionStorage.removeItem('add_po_draft');
                        sessionStorage.removeItem('add_po_supplier_ids');
                        sessionStorage.removeItem('add_po_product_ids');
                    }
                }
            } catch (error) {
                console.error("Error fetching suppliers:", error);
            }
        };
        fetchInitialLists();
    }, [isEditMode]);

    // Fetch Products (Requirement 6: Search from Product Master)
    useEffect(() => {
        const fetchProducts = async () => {
            if (!tableSearch.trim()) {
                setProducts([]);
                return;
            }
            try {
                const response = await productService.getProducts({ search: tableSearch });
                // Product API returns: { products: [...], total: ... }
                setProducts(response.products || []); 
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        const timer = setTimeout(fetchProducts, 300);
        return () => clearTimeout(timer);
    }, [tableSearch]);

    // Initial load for Edit Mode or PO Number generation
    useEffect(() => {
        const loadInitialData = async () => {
            if (isEditMode) {
                try {
                    const poToEdit = await purchaseOrderService.getPurchaseOrderById(id);
                    if (poToEdit) {
                        setFormData({
                            supplier_id: poToEdit.supplierId,
                            supplier_name: poToEdit.supplierName,
                            address: poToEdit.address,
                            po_number: poToEdit.poNumber,
                            gst_number: poToEdit.gstNumber,
                            credit_days: poToEdit.creditDays,
                            creation_date: poToEdit.poCreationDate ? poToEdit.poCreationDate.split('T')[0] : formData.creation_date,
                            expiry_date: poToEdit.expiryDate ? poToEdit.expiryDate.split('T')[0] : '',
                            pan_number: poToEdit.panNumber || ''
                        });
                        setSupplierSearch(poToEdit.supplierName);
                        if (poToEdit.items) {
                            setItems(poToEdit.items.map(item => ({
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
                    toast.error("Purchase Order not found");
                    navigate(ROUTES.PURCHASE_ORDER);
                }
            } else {
                try {
                    const response = await purchaseOrderService.getNextNumber();
                    setFormData(prev => ({ ...prev, po_number: response.poNumber }));
                } catch (error) {
                    console.error("Error fetching next PO number:", error);
                }
            }
        };
        loadInitialData();
    }, [id, isEditMode]);

    // Filtered suppliers for dropdown
    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s => 
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase())
        );
    }, [supplierSearch, suppliers]);

    // Filter products for the main search bar
    const filteredProducts = useMemo(() => {
        return products; // Now fetched via API based on search term directly
    }, [products]);

    const handleSelectSupplier = async (supplier) => {
        try {
            // Requirement 1: Optionally fetch fresh details for PO creation
            const details = await purchaseOrderService.getSupplierDetails(supplier.id);
            setFormData({
                ...formData,
                supplier_id: supplier.id,
                supplier_name: details.supplierName,
                address: details.address,
                gst_number: details.gstNumber || '',
                credit_days: details.creditDays || '',
                pan_number: details.panNumber || ''
            });
            setSupplierSearch(details.supplierName);
        } catch (error) {
            // Fallback to local data if fresh fetch fails
            setFormData({
                ...formData,
                supplier_id: supplier.id,
                supplier_name: supplier.accountName,
                address: supplier.addressLine1 + (supplier.addressLine2 ? ', ' + supplier.addressLine2 : ''),
                gst_number: supplier.gstNo || '',
                credit_days: supplier.supplierCreditDays || supplier.creditDays || '',
                pan_number: supplier.panNo || ''
            });
            setSupplierSearch(supplier.accountName);
        }
        setIsSupplierDropdownOpen(false);
    };

    const handleQuickAddProduct = (product) => {
        // Requirement 7: Product Code, Product, UOM, hsn code auto field
        const newItem = {
            id: Date.now(), 
            product_id: product.id,
            product_code: product.product_code || product.productCode || '', 
            product_name: product.product_name || product.productName || '', 
            quantity: 1, 
            rate: product.purchaseRate || product.purchase_rate || product.rate || 0, 
            uom: product.uom?.unit_name || product.uom?.gst_uom || product.uom || 'NOS', 
            discount_amount: 0, 
            discount_percent: 0, 
            hsn: product.hsn_code || product.hsn || '', 
            tax_percent: product.tax_rate || product.tax || 0, 
            before_tax: (product.purchaseRate || 0).toFixed(2), 
            tax_amount: ((product.purchaseRate || 0) * (product.tax_rate || 0) / 100).toFixed(2), 
            total_amount: ((product.purchaseRate || 0) * (1 + (product.tax_rate || 0) / 100)).toFixed(2),
            description: product.description || product.printDescription || '' 
        };
        
        // Remove empty row if it's the only one
        if (items.length === 1 && !items[0].product_name) {
            setItems([newItem]);
        } else {
            setItems([...items, newItem]);
        }
        
        setTableSearch('');
        setIsProductSearchOpen(false);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };
        
        // Update the direct field value from input
        item[field] = value;

        // Perform numerical conversions for computation
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const taxPct = parseFloat(item.tax_percent) || 0;
        let discAmt = parseFloat(item.discount_amount) || 0;
        let discPct = parseFloat(item.discount_percent) || 0;

        const baseAmount = qty * rate;

        // 🔴 1. DISCOUNT AUTO-CONVERSION (CRITICAL)
        if (baseAmount === 0) {
            discAmt = 0;
            discPct = 0;
            item.discount_amount = 0;
            item.discount_percent = 0;
        } else {
            if (field === 'discount_percent') {
                // If user enters Discount %: Auto-calculate Discount Amount
                if (discPct > 100) discPct = 100;
                discAmt = (baseAmount * discPct) / 100;
                item.discount_percent = discPct;
                item.discount_amount = parseFloat(discAmt.toFixed(2));
            } else if (field === 'discount_amount') {
                // If user enters Discount Amount: Auto-calculate Discount %
                if (discAmt > baseAmount) discAmt = baseAmount;
                discPct = (discAmt / baseAmount) * 100;
                item.discount_amount = discAmt;
                item.discount_percent = parseFloat(discPct.toFixed(2));
            } else {
                // For changes in Quantity or Rate: Keep % constant and sync Amount
                discAmt = (baseAmount * discPct) / 100;
                item.discount_amount = parseFloat(discAmt.toFixed(2));
            }
        }

        // 🔴 4. ROW CALCULATION LOGIC
        // Step 1: Before Tax Amount = (Quantity × Rate) - Discount Amount
        const beforeTaxAmount = baseAmount - discAmt;
        item.before_tax = parseFloat(beforeTaxAmount.toFixed(2));

        // Step 2: Tax Amount = (Before Tax Amount × Tax %) / 100
        const taxAmount = (beforeTaxAmount * taxPct) / 100;
        item.tax_amount = parseFloat(taxAmount.toFixed(2));

        // Step 3: Final Amount (Per Row)
        const totalAmount = beforeTaxAmount + taxAmount;
        item.total_amount = parseFloat(totalAmount.toFixed(2));

        newItems[index] = item;
        setItems(newItems);
    };

    // Validation Function
    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.supplier_name) newErrors.supplier_name = "Supplier name is required";
        if (!formData.address) newErrors.address = "Address is required";
        if (!formData.credit_days && formData.credit_days !== 0) newErrors.credit_days = "Credit days are required";
        if (!formData.creation_date) newErrors.creation_date = "Creation date is required";
        if (!formData.po_number) newErrors.po_number = "PO number is required";
        if (!formData.expiry_date) newErrors.expiry_date = "Expiry date is required";
        if (!formData.gst_number) newErrors.gst_number = "GST number is required";

        // Validate items
        const validItems = items.filter(item => item.product_name);
        if (validItems.length === 0) {
            newErrors.items = true;
        } else {
            const itemErrors = [];
            items.forEach((item, index) => {
                if (item.product_name) {
                    if (!item.quantity || item.quantity <= 0) {
                        if (!itemErrors[index]) itemErrors[index] = {};
                        itemErrors[index].quantity = "Required";
                    }
                    if (!item.rate || item.rate <= 0) {
                        if (!itemErrors[index]) itemErrors[index] = {};
                        itemErrors[index].rate = "Required";
                    }
                }
            });
            if (itemErrors.length > 0) newErrors.itemErrors = itemErrors;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save functionality
    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        const poPayload = {
            supplierId: Number(formData.supplier_id),
            creditDays: Number(formData.credit_days),
            address: formData.address,
            gstNo: formData.gst_number,
            panNo: formData.pan_number,
            poNumber: formData.po_number,
            poCreationDate: formData.creation_date,
            expiryDate: formData.expiry_date,
            items: items.filter(item => item.product_name).map(item => ({
                productId: item.product_id,
                productCode: item.product_code,
                productName: item.product_name,
                hsnCode: item.hsn,
                quantity: parseFloat(item.quantity),
                rate: parseFloat(item.rate),
                uom: item.uom,
                discount: parseFloat(item.discount_amount) || 0, // Mapping 'discount' from req 8 to discount_amount
                discountPercent: parseFloat(item.discount_percent) || 0,
                discountAmount: parseFloat(item.discount_amount) || 0,
                taxPercent: parseFloat(item.tax_percent) || 0,
                printDescription: item.description || ''
            }))
        };

        try {
            if (isEditMode) {
                await purchaseOrderService.updatePurchaseOrder(id, poPayload);
                toast.success("Purchase Order updated successfully");
            } else {
                await purchaseOrderService.createPurchaseOrder(poPayload);
                toast.success("Purchase Order saved successfully");
            }
            navigate(ROUTES.PURCHASE_ORDER);
        } catch (error) {
            console.error("Error saving PO:", error);
            toast.error(error.response?.data?.message || "Failed to save Purchase Order");
        }
    };

    const addNewRow = () => {
        setItems([...items, { 
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
        }]);
    };

    const removeItem = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handlePrintPreview = () => {
        if (!validateForm()) {
            setShowValidationPopup(true);
            return;
        }

        const fullPOData = {
            ...formData,
            items: items.map(item => {
                const qty = parseFloat(item.quantity) || 0;
                const rate = parseFloat(item.rate) || 0;
                const discAmt = parseFloat(item.discount_amount) || 0;
                const taxPct = parseFloat(item.tax_percent) || 0;
                const beforeTax = (qty * rate) - discAmt;
                const taxAmt = (beforeTax * taxPct) / 100;
                const total = beforeTax + taxAmt;
                
                return {
                    ...item,
                    before_tax: beforeTax.toFixed(2),
                    tax_amount: taxAmt.toFixed(2),
                    total_amount: total.toFixed(2)
                };
            })
        };
        navigate(ROUTES.PURCHASE_ORDER_PRINT, { state: { poData: fullPOData } });
    };

    const totalBillAmount = items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
            {/* Main Integrated Form Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                {/* Header Section */}
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <div>
                        <h2 className="hidden md:block text-[18px] md:text-[20px] font-bold text-[#111827]">{isEditMode ? 'Edit PO' : 'Add PO'}</h2>
                    </div>
                    
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 h-[40px] sm:h-[44px] border border-[#E5E7EB] rounded-[10px] text-[14px] md:text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all font-outfit shadow-sm"
                    >
                        <ArrowLeft size={18} /> 
                        <span className="hidden sm:inline">Back</span>
                        <span className="sm:hidden text-gray-500">Back</span>
                    </button>
                </div>

                {/* Form Fields Section */}
                <div className="p-4 sm:p-8 border-b border-[#F3F4F6]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Row 1 */}
                        <div className="space-y-2 relative">
                            <label className="text-[14px] font-semibold text-[#374151] font-outfit">Supplier Name <span className="text-red-500">*</span></label>
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
                                {errors.supplier_name && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.supplier_name}</p>}
                                
                                {isSupplierDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[65]" onClick={() => setIsSupplierDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-[70] overflow-hidden font-outfit">
                                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                {filteredSuppliers.length > 0 ? (
                                                    filteredSuppliers.map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => handleSelectSupplier(s)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 text-[14px] transition-colors border-b border-[#F3F4F6] last:border-0"
                                                        >
                                                            <div className="font-bold text-[#111827] font-outfit">{s.accountName}</div>
                                                            <div className="text-[12px] text-gray-400 font-outfit">{s.gstNo}</div>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-8 text-[13px] text-gray-400 italic text-center font-outfit">
                                                        No results for "{supplierSearch}"
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                                                <button 
                                                    onClick={() => {
                                                        sessionStorage.setItem('add_po_draft', JSON.stringify({ formData, items }));
                                                        sessionStorage.setItem('add_po_supplier_ids', JSON.stringify(suppliers.map(s => s.id)));
                                                        navigate(`/seller/masters/account-master?mode=add&redirect=${ROUTES.PURCHASE_ORDER_ADD}`);
                                                    }}
                                                    className="w-full h-[40px] bg-[#073318] text-white text-[13px] font-bold rounded-[8px] hover:bg-[#052611] transition-all flex items-center justify-center gap-2 group shadow-sm font-outfit"
                                                >
                                                    <Plus size={16} className="group-hover:scale-110 transition-transform" /> 
                                                    Add new supplier
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">Credit Days</label>
                            <input
                                type="number"
                                placeholder="Auto-filled from supplier"
                                value={formData.credit_days}
                                readOnly
                                className={`w-full h-[48px] bg-[#F9FAFB] border rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed ${errors.credit_days ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                            />
                            {errors.credit_days && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.credit_days}</p>}
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">Address</label>
                            <input
                                type="text"
                                placeholder="Auto-filled from supplier"
                                value={formData.address}
                                readOnly
                                className={`w-full h-[48px] bg-[#F9FAFB] border rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed ${errors.address ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                            />
                            {errors.address && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.address}</p>}
                        </div>

                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">PO Creation Date</label>
                            <input
                                type="date"
                                placeholder="Enter Date"
                                value={formData.creation_date}
                                readOnly
                                className={`w-full h-[48px] bg-[#F9FAFB] border rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed ${errors.creation_date ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                            />
                            {errors.creation_date && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.creation_date}</p>}
                        </div>

                        {/* Row 3 */}
                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">PO Number <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder="Purchase order will be autogenerated here"
                                value={formData.po_number}
                                readOnly
                                className={`w-full h-[48px] bg-[#F9FAFB] border rounded-[10px] px-4 text-[14px] text-[#6B7280] outline-none cursor-not-allowed ${errors.po_number ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                            />
                            {errors.po_number && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.po_number}</p>}
                        </div>

                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">Expiry Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                placeholder="Enter expire date"
                                value={formData.expiry_date}
                                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none transition-all ${errors.expiry_date ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                            />
                            {errors.expiry_date && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.expiry_date}</p>}
                        </div>

                        {/* Row 4 */}
                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                            <input
                                type="text"
                                placeholder="Auto-filled from supplier"
                                value={formData.gst_number}
                                readOnly
                                className={`w-full h-[48px] bg-[#F9FAFB] border rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed ${errors.gst_number ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                            />
                            {errors.gst_number && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.gst_number}</p>}
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="p-4 sm:p-6 md:p-8 border-b border-[#F3F4F6] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-full md:max-w-[320px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                            <input
                                type="text"
                                placeholder="Search By Anything..."
                                value={tableSearch}
                                onFocus={() => setIsProductSearchOpen(true)}
                                onChange={(e) => {
                                    setTableSearch(e.target.value);
                                    setIsProductSearchOpen(true);
                                }}
                                className={`w-full h-[44px] bg-white border rounded-[12px] pl-11 pr-4 text-[14px] outline-none focus:ring-1 transition-all placeholder:text-[#9CA3AF] shadow-sm font-outfit ${errors.items ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-[#073318]/10'}`}
                            />
                            {errors.items && <p className="text-red-500 text-[12px] mt-1 font-medium italic font-outfit">*Please add at least one product</p>}
                            
                            {/* Product Search Suggestions Dropdown */}
                            {isProductSearchOpen && filteredProducts.length > 0 && (
                                <div className="absolute top-full left-0 w-full sm:w-[500px] mt-2 bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] z-[60] overflow-hidden py-1">
                                    <div className="hidden sm:flex p-2 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider justify-between">
                                        <span>Product Details</span>
                                        <span>Category</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {filteredProducts.map(p => (
                                            <button 
                                                key={p.id}
                                                onClick={() => handleQuickAddProduct(p)}
                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#073318]/5 transition-all outline-none border-b border-gray-50 last:border-0"
                                            >
                                                <div className="flex flex-col items-start gap-0.5 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[#111827] text-[14px]">{p.product_name}</span>
                                                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-500 uppercase">{p.product_code}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-400">
                                                        <span>HSN: <span className="text-gray-600 font-medium">{p.hsn_code || p.hsn}</span></span>
                                                        <span>Tax: <span className="text-gray-600 font-medium">{p.tax_rate || p.tax}%</span></span>
                                                        <span>Rate: <span className="text-[#073318] font-bold">₹{p.purchaseRate || p.rate || 0}</span></span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 hidden sm:block">
                                                    <span className="text-[12px] font-semibold text-[#6B7280]">{p.category?.name || p.category}</span>
                                                    <div className="text-[10px] text-gray-400 font-medium">{p.sub_category?.name || p.sub_category}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Overlay */}
                            {isProductSearchOpen && (
                                <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsProductSearchOpen(false)}></div>
                            )}
                        </div>
                        <button
                            onClick={async () => {
                                sessionStorage.setItem('add_po_draft', JSON.stringify({ formData, items }));
                                // Get current products to track new ones
                                try {
                                    const res = await productService.getProducts({ limit: 100 });
                                    sessionStorage.setItem('add_po_product_ids', JSON.stringify((res.products || []).map(p => p.id)));
                                } catch (e) {
                                    sessionStorage.setItem('add_po_product_ids', '[]');
                                }
                                navigate(`/seller/masters/product-master?mode=add&redirect=${ROUTES.PURCHASE_ORDER_ADD}`);
                            }}
                            className="bg-[#073318] hover:bg-[#04200f] text-white px-8 h-[44px] rounded-[10px] text-[14px] font-semibold transition-all shadow-sm active:scale-[0.98] font-outfit whitespace-nowrap flex items-center justify-center gap-2"
                        >
                            <Plus size={18} />
                            Add Product
                        </button>
                    </div>
                </div>

                <style>{`
                    .custom-po-scrollbar::-webkit-scrollbar {
                        height: 6px;
                    }
                    .custom-po-scrollbar::-webkit-scrollbar-track {
                        background: #E5E7EB;
                    }
                    .custom-po-scrollbar::-webkit-scrollbar-thumb {
                        background: #A7C0B8;
                        border-radius: 4px;
                    }
                    .custom-po-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #014A36;
                    }
                `}</style>

                <div className="overflow-x-auto custom-po-scrollbar">
                    <table className="w-full min-w-[1800px] border-collapse bg-white">
                        <thead>
                            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">
                                    #
                                </th>
                                {[
                                    { label: "Product Code", width: "160px" },
                                    { label: "Product", width: "350px" },
                                    { label: "Quantity", width: "120px" },
                                    { label: "Rate", width: "120px" },
                                    { label: "UOM", width: "100px" },
                                    { label: "Discount Amount", width: "160px" },
                                    { label: "Discount (%)", width: "140px" },
                                    { label: "HSN Code", width: "140px" },
                                    { label: "Tax (%)", width: "120px" },
                                    { label: "Bef. Tax Amount", width: "160px" },
                                    { label: "Tax Amount", width: "140px" },
                                    { label: "Amount", width: "160px" },
                                    { label: "Print Description", width: "300px" }
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
                                            readOnly
                                            value={item.product_code}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="text" 
                                            readOnly
                                            value={item.product_name}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-[#111827] outline-none cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={item.quantity || ''}
                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                            className={`w-full h-[36px] bg-white border rounded-[8px] px-2 text-[13px] outline-none focus:ring-1 text-right transition-all shadow-sm ${errors.itemErrors?.[index]?.quantity ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-[#073318]/10'}`}
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
                                        <input 
                                            type="text" 
                                            readOnly
                                            value={item.uom}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] text-center outline-none cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
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
                                            readOnly
                                            value={item.hsn}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none cursor-not-allowed"
                                        />
                                    </td>
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="number" 
                                            readOnly
                                            value={item.tax_percent || ''}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-right text-[#6B7280] outline-none cursor-not-allowed"
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
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="text" 
                                            value={item.description}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm"
                                            placeholder="Description"
                                        />
                                    </td>
                                    <td className="px-2 py-2 text-center border-l border-[#F3F4F6]">
                                        <button 
                                            onClick={() => removeItem(index)}
                                            className="p-1.5 text-[#9CA3AF] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                                <td className="px-4 py-4 text-[13px] font-bold text-[#111827]">Total</td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="px-4 py-4 text-right text-[13px] font-bold text-[#111827] border-l border-[#F3F4F6]">
                                    {items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0)}
                                </td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="px-4 py-4 text-right text-[13px] font-bold text-[#111827] border-l border-[#F3F4F6]">
                                    {items.reduce((sum, item) => sum + (parseFloat(item.before_tax) || 0), 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-4 text-right text-[13px] font-bold text-[#111827] border-l border-[#F3F4F6]">
                                    {items.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-4 text-right text-[13px] font-bold text-[#073318] border-l border-[#F3F4F6]">
                                    ₹ {totalBillAmount.toFixed(2)}
                                </td>
                                <td className="border-l border-[#F3F4F6]"></td>
                                <td className="border-l border-[#F3F4F6]"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Card Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 px-4 sm:px-8 py-6 border-t border-[#F3F4F6] bg-gray-50/10">
                    <button 
                        onClick={handlePrintPreview}
                        className="w-full sm:w-auto px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#052611] transition-all shadow-md flex items-center justify-center gap-2"
                    >
                        <Printer size={18} />
                        Preview & Print
                    </button>
                    <button 
                        onClick={handleSave}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 md:px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all shadow-md"
                    >
                        Save PO
                    </button>
                    <button 
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 md:px-10 h-[48px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all shadow-sm order-3"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            {/* Validation Popup Modal */}
            {showValidationPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[16px] shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200 font-outfit">
                        <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between bg-white">
                            <h3 className="text-[18px] font-bold text-[#111827]">Missing Required Fields</h3>
                            <button onClick={() => setShowValidationPopup(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-[15px] text-[#4B5563]">Please fill all required fields before previewing.</p>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-[#F3F4F6] flex justify-end">
                            <button
                                onClick={() => setShowValidationPopup(false)}
                                className="px-6 h-[40px] bg-[#073318] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#052611] transition-all shadow-sm"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddPO;
