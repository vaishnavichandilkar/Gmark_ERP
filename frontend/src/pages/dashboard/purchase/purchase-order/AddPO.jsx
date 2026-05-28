import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
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
    ChevronsUpDown,
    AlertCircle
} from 'lucide-react';
import purchaseOrderService from '@/services/purchaseOrderService';
import axiosInstance from '../../../../services/axiosInstance';
import { getStandardGstUom } from '@/utils/uomUtils';
import accountService from '@/services/accountService';
import productService from '@/services/productService';

// Mock data removed in favor of API calls

const AddPO = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);
    const creationDateRef = useRef(null);
    const expiryDateRef = useRef(null);

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

    const [formData, setFormData] = useState({
        supplier_id: '',
        supplier_name: '',
        address: '',
        po_number: '',
        gst_number: '',
        credit_days: '',
        creation_date: getLocalToday(),
        expiry_date: '',
    });

    const [errors, setErrors] = useState({});
    const [isRestoringDraft, setIsRestoringDraft] = useState(false);
    const [businessProfile, setBusinessProfile] = useState(null);

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

    // Fetch Suppliers and Handle Draft Recovery
    useEffect(() => {
        const fetchInitialLists = async () => {
            try {
                // Fetch Business Profile
                try {
                    const profile = await accountService.getBusinessProfile();
                    setBusinessProfile(profile);
                } catch (e) {
                    console.error("Error fetching business profile:", e);
                }

                const response = await accountService.getAllAccounts({
                    groupName: 'SUNDRY_CREDITORS',
                    limit: 1000,
                    status: 'ACTIVE'
                });
                const fetchedSuppliers = response.data || [];
                setSuppliers(fetchedSuppliers);

                // 🛠️ Selective Draft Recovery: Only restore if explicitly requested via URL
                const urlParams = new URLSearchParams(window.location.search);
                const newCustomerId = urlParams.get('newCustomerId');
                const isExplicitRestore = urlParams.get('restore') === 'true' || !!newCustomerId;

                const draftStr = sessionStorage.getItem('add_po_draft');
                if (draftStr && isExplicitRestore) {
                    try {
                        const draft = JSON.parse(draftStr);
                        let restoredFormData = draft.formData;
                        let restoredItems = draft.items;

                        // 1. Detect New Supplier
                        const oldSupplierIdsStr = sessionStorage.getItem('add_po_supplier_ids');
                        let newSupplier = null;
                        
                        if (newCustomerId) {
                            newSupplier = fetchedSuppliers.find(s => s.id === parseInt(newCustomerId));
                        } else if (oldSupplierIdsStr) {
                            const oldIds = JSON.parse(oldSupplierIdsStr);
                            newSupplier = fetchedSuppliers.find(s => !oldIds.includes(s.id));
                        }
                        
                        if (newSupplier) {
                                restoredFormData = {
                                    ...restoredFormData,
                                    supplier_id: newSupplier.id,
                                    supplier_name: newSupplier.accountName,
                                    address: newSupplier.addressLine1 || '',
                                    credit_days: newSupplier.supplierCreditDays !== undefined && newSupplier.supplierCreditDays !== null ? newSupplier.supplierCreditDays : '',
                                    gst_number: newSupplier.gstNo || '',
                                    pan_number: newSupplier.panNo || ''
                                };
                                setSupplierSearch(newSupplier.accountName);
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
                                    uom: newProduct.uom?.gst_uom || newProduct.uom?.unit_name || 'NOS',
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
                        setSupplierSearch(restoredFormData.supplier_name || '');
                        setIsRestoringDraft(true);
                    } catch (e) {
                        console.error('Draft parsing failed', e);
                    } finally {
                        sessionStorage.removeItem('add_po_supplier_ids');
                        sessionStorage.removeItem('add_po_product_ids');
                    }
                } else if (draftStr && !isExplicitRestore && !isEditMode) {
                    // If we found a draft but we're starting fresh, clear it to avoid confusion
                    sessionStorage.removeItem('add_po_draft');
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
            try {
                // If tableSearch is empty, fetch a default list of 20 products
                const response = await productService.getProducts({
                    search: tableSearch.trim() || '',
                    limit: tableSearch.trim() ? 50 : 20
                });
                setProducts(response.products || []);
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        const timer = setTimeout(fetchProducts, 150); // Faster response for better UX
        return () => clearTimeout(timer);
    }, [tableSearch]);

    // Initial load for Edit Mode or PO Number generation
    useEffect(() => {
        const loadInitialData = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const isRestoring = isRestoringDraft || urlParams.get('restore') === 'true';

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
                                description: item.printDescription || item.description || ''
                            })));
                        }
                    }
                } catch (error) {
                    toast.error("Purchase Order not found");
                    navigate(ROUTES.PURCHASE_ORDER);
                }
            } else {
                // If not in edit mode, fetch next number if not already present (even if restoring draft)
                if (!formData.po_number) {
                    try {
                        const response = await purchaseOrderService.getNextNumber();
                        setFormData(prev => ({ ...prev, po_number: response.poNumber }));
                    } catch (error) {
                        console.error("Error fetching next PO number:", error);
                    }
                }
            }
        };
        loadInitialData();
    }, [id, isEditMode, isRestoringDraft]);

    // BEST PRACTICE: Auto-save draft as user types (Requirement 6)
    useEffect(() => {
        const hasData = formData.supplier_id || items.some(i => i.product_name);
        if (hasData) {
            sessionStorage.setItem('add_po_draft', JSON.stringify({ formData, items }));
        }
    }, [formData, items]);

    // Helper: Smart Date Formatter
    const toDisplayDate = (dateStr) => {
        if (!dateStr) return "";
        // If it's in ISO format YYYY-MM-DD
        if (dateStr.length === 10 && dateStr.charAt(4) === '-') {
            const [y, m, d] = dateStr.split("-");
            return `${d}/${m}/${y.slice(-2)}`;
        }
        // If already DD-MM-YYYY or DD/MM/YYYY
        const parts = dateStr.includes("-") ? dateStr.split("-") : dateStr.split("/");
        if (parts.length === 3 && parts[2].length === 4) {
            return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
        }
        return dateStr;
    };

    // Helper: DD-MM-YYYY to YYYY-MM-DD
    const toIsoDate = (displayDate) => {
        if (!displayDate || !displayDate.includes("-")) return displayDate;
        const parts = displayDate.split("-");
        // Only convert if it looks like DD-MM-YYYY
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return displayDate;
    };



    const handleDateTextChange = (e, field) => {
        const inputVal = e.target.value;
        const digits = inputVal.replace(/\D/g, "").substring(0, 8);

        // Auto-format as they type
        let formatted = digits;
        if (digits.length >= 3) formatted = digits.substring(0, 2) + "-" + digits.substring(2);
        if (digits.length >= 5) formatted = formatted.substring(0, 5) + "-" + digits.substring(5);

        // Update formData immediately with the formatted string to allow typing
        setFormData(prev => ({ ...prev, [field]: formatted }));
    };

    // Filtered suppliers for dropdown
    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s =>
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase())
        );
    }, [supplierSearch, suppliers]);

    // Filter products for the main search bar - remove already added products
    // Filter products for the search suggestions - remove already added products and filter by search term
    const filteredProducts = useMemo(() => {
        const addedProductIds = items.map(item => item.product_id).filter(id => id);
        const searchLower = tableSearch.toLowerCase();

        return (products || []).filter(p => {
            // Already added products should NOT be visible
            if (addedProductIds.includes(p.id)) return false;

            // If search is empty, show all available (max 50)
            if (!tableSearch) return true;

            // Search across multiple fields
            return (
                p.product_name?.toLowerCase().includes(searchLower) ||
                p.product_code?.toLowerCase().includes(searchLower) ||
                p.hsn_code?.toLowerCase().includes(searchLower) ||
                p.category?.name?.toLowerCase().includes(searchLower)
            );
        });
    }, [products, items, tableSearch]);

    const isGstApplicable = useMemo(() => {
        return Boolean(formData.gst_number);
    }, [formData.gst_number]);

    const isIntraState = useMemo(() => {
        const sellerGst = businessProfile?.gstNumber || businessProfile?.shopDetail?.gstNumber || "";
        const supplierGst = formData.gst_number || "";
        if (!sellerGst || !supplierGst) return true; // Default to true (CGST/SGST)
        return sellerGst.substring(0, 2) === supplierGst.substring(0, 2);
    }, [businessProfile, formData.gst_number]);

    const handleSelectSupplier = async (supplier) => {
        try {
            // Requirement 1: Optionally fetch fresh details for PO creation
            const details = await purchaseOrderService.getSupplierDetails(supplier.id);
            setFormData(prev => ({
                ...prev,
                supplier_id: supplier.id,
                supplier_name: details.supplierName,
                address: details.address,
                gst_number: details.gstNumber || '',
                credit_days: details.creditDays || 0, // Default to 0 instead of empty string if needed
            }));
            setSupplierSearch(details.supplierName);
        } catch (error) {
            console.error("Error fetching supplier details:", error);
            // Fallback to local data if fresh fetch fails
            setFormData(prev => ({
                ...prev,
                supplier_id: supplier.id,
                supplier_name: supplier.accountName,
                address: supplier.addressLine1 + (supplier.addressLine2 ? ', ' + supplier.addressLine2 : ''),
                gst_number: supplier.gstNo || '',
                credit_days: supplier.supplierCreditDays || supplier.creditDays || 0,
            }));
            setSupplierSearch(supplier.accountName);
        }
        setIsSupplierDropdownOpen(false);
        // Clear restore param once actioned
        if (window.location.search.includes('restore=true')) {
            navigate(window.location.pathname, { replace: true });
        }
    };

    const handleQuickAddProduct = (product, targetIndex = null) => {
        const printDesc = product.print_description || product.description || product.printDescription || product.product_name || '';
        const newItem = {
            id: Date.now(),
            product_id: product.id,
            product_code: product.product_code || product.productCode || '',
            product_name: product.product_name || product.productName || '',
            quantity: 1,
            rate: product.purchaseRate || product.purchase_rate || product.rate || 0,
            uom: getStandardGstUom(product.uom),
            discount_amount: 0,
            discount_percent: 0,
            hsn: product.hsn_code || product.hsn || '',
            tax_percent: product.tax_rate || product.tax || 0,
            before_tax: (product.purchaseRate || 0).toFixed(2),
            tax_amount: isGstApplicable ? ((product.purchaseRate || 0) * (product.tax_rate || 0) / 100).toFixed(2) : "0.00",
            total_amount: isGstApplicable ? ((product.purchaseRate || 0) * (1 + (product.tax_rate || 0) / 100)).toFixed(2) : (product.purchaseRate || 0).toFixed(2),
            description: printDesc,
            original_description: printDesc
        };

        let updatedItems = [...items];
        const finalTargetIndex = targetIndex !== null ? targetIndex : updatedItems.findIndex(i => !i.product_name);

        if (finalTargetIndex !== -1) {
            updatedItems[finalTargetIndex] = newItem;
        } else {
            updatedItems = [...updatedItems, newItem];
        }

        // AUTO-CREATE EMPTY ROW: Ensure there is always exactly one empty row at the end
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

        // Move focus to Quantity field
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
                setSelectedSuggestionIndex(prev =>
                    prev < filteredProducts.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredProducts[selectedSuggestionIndex]) {
                    handleQuickAddProduct(filteredProducts[selectedSuggestionIndex], index);
                }
                break;
            case 'Tab':
                if (filteredProducts[selectedSuggestionIndex]) {
                    handleQuickAddProduct(filteredProducts[selectedSuggestionIndex], index);
                }
                break;
            case 'Escape':
                setIsProductSearchOpen(false);
                break;
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        // Update with decimal limit for discounts
        let finalValue = value;
        if (field === 'description') {
            const originalPrefix = item.original_description || '';
            if (originalPrefix && !value.startsWith(originalPrefix)) {
                if (value.length < originalPrefix.length) {
                    finalValue = originalPrefix;
                } else {
                    finalValue = originalPrefix + value.substring(originalPrefix.length);
                }
            }
        }
        if (['discount_amount', 'discount_percent'].includes(field)) {
            if (value.includes('.') && value.split('.')[1].length > 2) {
                const [int, dec] = value.split('.');
                finalValue = `${int}.${dec.slice(0, 2)}`;
            }
        }
        item[field] = finalValue;

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
            if (field !== 'discount_amount')  item.discount_amount = 0;
            if (field !== 'discount_percent') item.discount_percent = 0;
        } else {
            if (field === 'discount_percent') {
                // If user enters Discount %: Auto-calculate Discount Amount
                if (discPct > 100) discPct = 100;
                discAmt = (baseAmount * discPct) / 100;
                // item.discount_percent is already finalValue
                item.discount_amount = parseFloat(discAmt.toFixed(2));
            } else if (field === 'discount_amount') {
                // If user enters Discount Amount: Auto-calculate Discount %
                if (discAmt > baseAmount) discAmt = baseAmount;
                discPct = (discAmt / baseAmount) * 100;
                // item.discount_amount is already finalValue
                item.discount_percent = parseFloat(discPct.toFixed(2));
            } else {
                // For changes in Quantity or Rate: Keep % constant and sync Amount
                discAmt = (baseAmount * discPct) / 100;
                item.discount_amount = parseFloat(discAmt.toFixed(2));
                item.discount_percent = parseFloat(discPct.toFixed(2));
            }
        }

        // 🔴 4. ROW CALCULATION LOGIC
        // Step 1: Before Tax Amount = (Quantity × Rate) - Discount Amount
        const beforeTaxAmount = baseAmount - discAmt;
        item.before_tax = parseFloat(beforeTaxAmount.toFixed(2));

        // Step 2: Tax Amount = (Before Tax Amount × Tax %) / 100
        const taxAmount = isGstApplicable ? ((beforeTaxAmount * taxPct) / 100) : 0;
        item.tax_amount = parseFloat(taxAmount.toFixed(2));

        // Step 3: Total Amount = Before Tax Amount + Tax Amount
        item.total_amount = parseFloat((beforeTaxAmount + taxAmount).toFixed(2));

        // Ensure numeric fields (other than the one being edited) are correctly typed but not overwriting active typing
        if (field !== 'quantity')    item.quantity    = qty;
        if (field !== 'rate')        item.rate        = rate;
        if (field !== 'tax_percent') item.tax_percent = taxPct;

        newItems[index] = item;
        setItems(newItems);
    };

    // Extracted navigation logic for adding new products while preserving PO draft
    const handleAddNewProduct = async () => {
        sessionStorage.setItem('add_po_draft', JSON.stringify({ formData, items }));
        try {
            const res = await productService.getProducts({ limit: 100 });
            sessionStorage.setItem('add_po_product_ids', JSON.stringify((res.products || []).map(p => p.id)));
        } catch (e) {
            sessionStorage.setItem('add_po_product_ids', '[]');
        }
        navigate(`/seller/masters/product-master/add?redirect=${ROUTES.PURCHASE_ORDER_ADD}`);
    };

    // Validation Function
    const validateForm = () => {
        const newErrors = {};

        if (!formData.supplier_name) newErrors.supplier_name = "Supplier name is required";
        if (!formData.address) newErrors.address = "Address is required";
        if (!formData.credit_days && formData.credit_days !== 0) {
            // Optional but recommended, let's keep it non-blocking if user cleared it but maybe set a default or just allow it.
            // Requirement says fetched and editable. If they clear it, we might want to warn or just allow.
        }
        const isValidIso = (d) => d && d.length === 10 && d.split("-").length === 3 && d.split("-")[0].length === 4;

        if (!formData.creation_date) {
            newErrors.creation_date = "Required";
        } else if (!isValidIso(toIsoDate(formData.creation_date))) {
            newErrors.creation_date = "Enter valid date (DD-MM-YYYY)";
        }

        if (!formData.po_number) newErrors.po_number = "PO number is required";

        if (!formData.expiry_date) {
            newErrors.expiry_date = "Required";
        } else {
            const isoExpiry = toIsoDate(formData.expiry_date);
            if (!isValidIso(isoExpiry)) {
                newErrors.expiry_date = "Enter valid date (DD-MM-YYYY)";
            } else {
                const expiryDate = new Date(isoExpiry);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiryDate < today) {
                    newErrors.expiry_date = "Expiry date cannot be in the past";
                }
            }
        }

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
            poNumber: formData.po_number,
            poCreationDate: toIsoDate(formData.creation_date),
            expiryDate: toIsoDate(formData.expiry_date),
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
                sessionStorage.removeItem('add_po_draft');
                navigate(ROUTES.PURCHASE_ORDER);
            } else {
                const response = await purchaseOrderService.createPurchaseOrder(poPayload);
                toast.success(`Purchase Order ${response.poNumber} saved successfully`);
                sessionStorage.removeItem('add_po_draft');
                navigate(ROUTES.PURCHASE_ORDER);
            }
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
        } else {
            // Reset the only row if deleted
            setItems([{
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
                before_tax: 0.00,
                tax_amount: 0.00,
                total_amount: 0.00,
                description: ''
            }]);
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
        // Save draft to session storage before navigating to preview
        sessionStorage.setItem('add_po_draft', JSON.stringify({ formData, items }));
        navigate(ROUTES.PURCHASE_ORDER_PRINT, {
            state: {
                poData: {
                    ...fullPOData,
                    items: fullPOData.items.map(it => ({
                        ...it,
                        printDescription: it.description || it.printDescription || it.productName || it.product_name || '',
                        description: it.description || it.printDescription || it.productName || it.product_name || ''
                    }))
                },
                from: isEditMode ? ROUTES.PURCHASE_ORDER_EDIT.replace(':id', id) : ROUTES.PURCHASE_ORDER_ADD
            }
        });
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
                        onClick={() => navigate(ROUTES.PURCHASE_ORDER)}
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
                                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 pr-14 text-[14px] outline-none transition-all ${errors.supplier_name ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                                />
                                {formData.supplier_id && !isSupplierDropdownOpen && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFormData(prev => ({
                                                ...prev,
                                                supplier_id: '',
                                                supplier_name: '',
                                                address: '',
                                                gst_number: '',
                                                credit_days: ''
                                            }));
                                            setSupplierSearch('');
                                        }}
                                        className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                {errors.supplier_name && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.supplier_name}</p>}

                                {isSupplierDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[65]" onClick={() => setIsSupplierDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[16px] shadow-2xl z-[70] overflow-hidden font-outfit">
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {filteredSuppliers.length > 0 ? (
                                                    filteredSuppliers.map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => handleSelectSupplier(s)}
                                                            className="w-full text-left px-5 py-3.5 hover:bg-emerald-50 transition-all border-b border-[#F3F4F6] last:border-0 group"
                                                        >
                                                            <div className="font-bold text-[#111827] text-[15px] group-hover:text-emerald-900 transition-colors">{s.accountName}</div>
                                                            <div className="text-[12px] text-gray-400 mt-0.5">{s.gstNo || 'No GST Number'}</div>
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
                                                        navigate(`/seller/masters/account-master/add?redirect=${ROUTES.PURCHASE_ORDER_ADD}`);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all shadow-md group font-outfit"
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

                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">Credit Days <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Auto-filled from supplier"
                                value={formData.credit_days !== undefined && formData.credit_days !== null && formData.credit_days !== '' ? formData.credit_days : ''}
                                onChange={(e) => setFormData({ ...formData, credit_days: e.target.value })}
                                className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none transition-all ${errors.credit_days ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                            />
                            {errors.credit_days && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.credit_days}</p>}
                        </div>

                        {/* Row 2 */}
                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">Address</label>
                            <input
                                type="text"
                                placeholder="Enter address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318] transition-all ${errors.address ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                            />
                            {errors.address && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.address}</p>}
                        </div>

                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">PO Creation Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    ref={creationDateRef}
                                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                                    value={formData.creation_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, creation_date: e.target.value }))}
                                />
                                <input
                                    type="text"
                                    placeholder="DD-MM-YYYY"
                                    value={toDisplayDate(formData.creation_date)}
                                    // Change to read/write if they want to type, but the previous instruction said "directly"
                                    // Let's keep it readOnly for now as per previous session, 
                                    // but allow the calendar icon to trigger the picker.
                                    readOnly
                                    className={`w-full h-[48px] bg-[#F9FAFB] border rounded-[10px] px-4 pr-11 text-[14px] outline-none cursor-not-allowed ${errors.creation_date ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                                />
                                <Calendar
                                    size={18}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
                                />
                            </div>
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
                            <div className="relative">
                                <input
                                    type="date"
                                    ref={expiryDateRef}
                                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                                    value={formData.expiry_date}
                                    min={formData.creation_date || new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                                />
                                <input
                                    type="text"
                                    placeholder="DD-MM-YYYY"
                                    value={toDisplayDate(formData.expiry_date)}
                                    readOnly
                                    onClick={() => expiryDateRef.current?.showPicker?.() || expiryDateRef.current?.focus()}
                                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 pr-11 text-[14px] outline-none cursor-pointer transition-all ${errors.expiry_date ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                                />
                                <Calendar
                                    size={18}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer pointer-events-auto shadow-sm hover:text-[#073318]"
                                    onClick={() => expiryDateRef.current?.showPicker?.() || expiryDateRef.current?.focus()}
                                />
                            </div>
                            {errors.expiry_date && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.expiry_date}</p>}
                        </div>

                        {/* Row 4 */}
                        <div className="space-y-2 font-outfit">
                            <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                            <input
                                type="text"
                                placeholder="Optional"
                                value={formData.gst_number}
                                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                                className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] outline-none transition-all ${errors.gst_number ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                            />
                            {errors.gst_number && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.gst_number}</p>}
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="p-4 sm:p-6 md:p-8 border-b border-[#F3F4F6] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
                        <div className="relative flex-1 max-w-full md:max-w-[550px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                            <input
                                type="text"
                                placeholder="Search By Anything..."
                                value={tableSearch}
                                onFocus={() => {
                                    setActiveRowIndex(null); // Ensure top search is active
                                    setIsProductSearchOpen(true);
                                }}
                                onChange={(e) => {
                                    setTableSearch(e.target.value);
                                    setActiveRowIndex(null);
                                    setIsProductSearchOpen(true);
                                }}
                                className={`w-full h-[44px] bg-white border rounded-[12px] pl-11 pr-4 text-[14px] outline-none focus:ring-1 transition-all placeholder:text-[#9CA3AF] shadow-sm font-outfit ${errors.items ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-[#073318]/10'}`}
                            />
                            {errors.items && <p className="text-red-500 text-[12px] mt-1 font-medium italic font-outfit">*Please add at least one product</p>}

                            {/* Global Product Search Suggestions Dropdown - Only when NOT editing a specific row */}
                            {isProductSearchOpen && activeRowIndex === null && (
                                <div className="absolute top-full left-0 w-full sm:w-[550px] mt-2 bg-white border border-gray-100 rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[60] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 font-outfit border-t-4 border-t-emerald-800">
                                    {/* Scrollable Results Area */}
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {filteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleQuickAddProduct(p)}
                                                className="w-full px-5 py-4 flex items-center justify-between hover:bg-emerald-50/80 transition-all text-left outline-none border-b border-gray-50 last:border-0 group"
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[#111827] text-[15px] group-hover:text-emerald-900 transition-colors">{p.product_name}</span>
                                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-extrabold text-gray-500 tracking-wider">#{p.product_code}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-400">
                                                        <span className="flex items-center gap-1">HSN: <span className="text-gray-700 font-bold">{p.hsn_code || p.hsn || 'N/A'}</span></span>
                                                        <span className="flex items-center gap-1">Tax: <span className="text-gray-700 font-bold">{p.tax_rate || p.tax || 0}%</span></span>
                                                        <span className="flex items-center gap-1">Price: <span className="text-emerald-700 font-black">₹{p.purchaseRate || p.rate || 0}</span></span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">{p.category?.name || p.category || 'NO CATEGORY'}</span>
                                                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                                                        <Plus size={18} />
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                        {filteredProducts.length === 0 && (
                                            <div className="px-5 py-10 text-center text-[13px] text-gray-400 italic">No products found for "{tableSearch}"</div>
                                        )}
                                    </div>

                                    {/* Fixed Footer for Action Button */}
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

                            {/* Overlay */}
                            {isProductSearchOpen && (
                                <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsProductSearchOpen(false)}></div>
                            )}
                        </div>
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

                <div className="overflow-x-auto custom-po-scrollbar min-h-[500px] bg-white pb-[300px]">
                    <table className="w-full min-w-[1800px] border-collapse bg-white">
                        <thead>
                            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">
                                    #
                                </th>
                                {[
                                    { label: "Product Code", width: "160px" },
                                    { label: "Product Name", width: "350px" },
                                    { label: "Print Description", width: "300px" },
                                    { label: "Quantity", width: "120px" },
                                    { label: "Rate", width: "120px" },
                                    { label: "UOM", width: "140px" },
                                    { label: "Discount Amount", width: "160px" },
                                    { label: "Discount (%)", width: "140px" },
                                    { label: "HSN Code", width: "140px" },
                                    { label: "Tax (%)", width: "120px" },
                                    { label: "Bef. Tax Amount", width: "160px" },
                                    { label: "Tax Amount", width: "140px" },
                                    { label: "Amount", width: "160px" }
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
                                <React.Fragment key={item.id}>
                                    <tr className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
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
                                                }}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
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
                                                }}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                }}
                                                placeholder={item.product_name ? "" : "Select product..."}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-[#111827] outline-none hover:bg-gray-50 rounded-md transition-all cursor-pointer ${!item.product_name ? 'italic text-gray-400 font-normal' : ''}`}
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
                                                value={item.uom}
                                                readOnly={!!item.product_name}
                                                onKeyDown={(e) => handleSearchKeyDown(e, index)}
                                                onFocus={() => {
                                                    setActiveRowIndex(index);
                                                    setIsProductSearchOpen(true);
                                                }}
                                                className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] text-[#6B7280] outline-none font-medium ${!item.product_name ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'}`}
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
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>

                                    {/* 🔥 ERP-Style Inline Product Selection */}
                                    {isProductSearchOpen && activeRowIndex === index && (
                                        <>
                                            {filteredProducts.slice(0, 10).map((p, pIndex) => (
                                                <tr
                                                    key={p.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickAddProduct(p, index);
                                                    }}
                                                    onMouseEnter={() => setSelectedSuggestionIndex(pIndex)}
                                                    className={`border-b border-emerald-50 cursor-pointer transition-all duration-200 relative z-[100] ${selectedSuggestionIndex === pIndex ? 'bg-emerald-600 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)]' : 'bg-emerald-50/40 hover:bg-emerald-100/60'}`}
                                                >
                                                    <td className="px-4 py-3 text-center">
                                                        {selectedSuggestionIndex === pIndex ? (
                                                            <div className="flex items-center justify-center">
                                                                <div className="w-2.5 h-2.5 bg-white rounded-full ring-4 ring-white/20"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-1.5 h-1.5 bg-emerald-200 rounded-full mx-auto"></div>
                                                        )}
                                                    </td>
                                                    <td className={`px-4 py-3 border-l border-emerald-100 ${selectedSuggestionIndex === pIndex ? 'text-white' : 'text-emerald-800'}`}>
                                                        <span className="font-mono text-[13px] font-black">{p.product_code}</span>
                                                    </td>
                                                    <td className={`px-4 py-3 border-l border-emerald-100 ${selectedSuggestionIndex === pIndex ? 'text-white' : 'text-emerald-900 font-bold'}`}>
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-black tracking-tight uppercase">{p.product_name}</span>
                                                            <span className={`text-[10px] font-bold ${selectedSuggestionIndex === pIndex ? 'text-emerald-100' : 'text-emerald-600/70'}`}>{p.category?.name || 'STOCK ITEM'}</span>
                                                        </div>
                                                    </td>
                                                    <td colSpan={1} className="px-4 py-3 border-l border-emerald-100 text-center">
                                                        <div className={`text-[11px] font-black italic uppercase tracking-tighter ${selectedSuggestionIndex === pIndex ? 'text-white' : 'text-emerald-600/50'}`}>
                                                            {selectedSuggestionIndex === pIndex ? 'Hit Enter' : '---'}
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-3 border-l border-emerald-100 text-right ${selectedSuggestionIndex === pIndex ? 'text-white' : 'text-emerald-900 font-black'}`}>
                                                        ₹{p.purchaseRate || p.rate || 0}
                                                    </td>
                                                    <td className={`px-4 py-3 border-l border-emerald-100 text-center whitespace-nowrap ${selectedSuggestionIndex === pIndex ? 'text-white' : 'text-emerald-800 font-bold'}`}>
                                                        {getStandardGstUom(p.uom)}
                                                    </td>
                                                    <td colSpan={2} className={`px-4 py-3 border-l border-emerald-100 text-center italic text-[11px] font-bold ${selectedSuggestionIndex === pIndex ? 'text-emerald-100' : 'text-emerald-400'}`}>
                                                        Select this item to continue
                                                    </td>
                                                    <td className={`px-4 py-3 border-l border-emerald-100 text-center ${selectedSuggestionIndex === pIndex ? 'text-white font-black' : 'text-emerald-900 font-bold'}`}>
                                                        {p.hsn_code || p.hsn || 'N/A'}
                                                    </td>
                                                    <td className={`px-4 py-3 border-l border-emerald-100 text-center ${selectedSuggestionIndex === pIndex ? 'text-white font-black' : 'text-emerald-900 font-bold'}`}>
                                                        {p.tax_rate || p.tax || 0}%
                                                    </td>
                                                    <td colSpan={5} className="px-4 py-8 border-l border-emerald-100">
                                                        {/* Action cell empty - selection handled by row click */}
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Standardized Add New Product Button */}
                                            <tr className="bg-white border-t border-gray-100">
                                                <td colSpan={15} className="px-4 py-5 bg-emerald-50/10">
                                                    <div className="flex justify-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddNewProduct();
                                                            }}
                                                            className="h-[42px] px-10 bg-[#073318] text-white text-[13px] font-bold rounded-[10px] hover:bg-[#052611] transition-all flex items-center justify-center gap-3 group shadow-lg shadow-emerald-900/10 font-outfit relative z-[101]"
                                                        >
                                                            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" strokeWidth={3} />
                                                            Add New Product
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                                <td className="px-4 py-4 text-[13px] font-bold text-[#111827]">Total</td>
                                <td className="border-l border-[#F3F4F6]"></td>
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
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Tax Summary Section */}
                <div className="flex justify-end p-4 sm:p-8 bg-gray-50/30 border-t border-[#F3F4F6]">
                    <div className="w-full max-w-[400px] space-y-3 font-outfit">
                        <div className="flex justify-between text-[14px]">
                            <span className="text-[#6B7280] font-medium">Material Sub Total</span>
                            <span className="text-[#111827] font-bold">₹ {items.reduce((sum, item) => sum + (parseFloat(item.before_tax) || 0), 0).toFixed(2)}</span>
                        </div>
                        {isIntraState ? (
                            <>
                                <div className="flex justify-between text-[14px]">
                                    <span className="text-[#6B7280] font-medium">CGST</span>
                                    <span className="text-[#111827] font-bold">₹ {(items.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0) / 2).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[14px]">
                                    <span className="text-[#6B7280] font-medium">SGST</span>
                                    <span className="text-[#111827] font-bold">₹ {(items.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0) / 2).toFixed(2)}</span>
                                </div>
                            </>
                        ) : (
                            <div className="flex justify-between text-[14px]">
                                <span className="text-[#6B7280] font-medium">IGST</span>
                                <span className="text-[#111827] font-bold">₹ {items.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-[18px] pt-4 border-t border-[#E5E7EB] mt-2">
                            <span className="text-[#111827] font-black uppercase tracking-tight">Grand Total</span>
                            <span className="text-[#073318] font-black">₹ {totalBillAmount.toFixed(2)}</span>
                        </div>
                    </div>
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
                        onClick={() => navigate(ROUTES.PURCHASE_ORDER)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 md:px-10 h-[48px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all shadow-sm order-3"
                    >
                        Cancel
                    </button>
                </div>
            </div>

            {/* Validation Popup Modal - Error Format */}
            {showValidationPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => setShowValidationPopup(false)} />
                    <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[400px] overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200 font-outfit">
                        <div className="px-8 py-5 flex items-center justify-between bg-red-600 text-white">
                            <div className="flex items-center gap-3">
                                <AlertCircle size={22} className="text-white" />
                                <h3 className="text-[18px] font-bold tracking-tight">Missing Required Fields</h3>
                            </div>
                            <button onClick={() => setShowValidationPopup(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8">
                            <p className="text-[15px] text-[#4B5563] font-medium leading-relaxed">
                                Please ensure all mandatory fields (marked with <span className="text-red-500 font-bold">*</span>) are filled correctly before proceeding to preview.
                            </p>
                        </div>
                        <div className="px-8 py-5 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowValidationPopup(false)}
                                className="px-8 h-[48px] bg-red-600 text-white rounded-[12px] text-[15px] font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddPO;
