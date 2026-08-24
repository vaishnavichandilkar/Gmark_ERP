import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';

import grnService from '@/services/grnService';
import purchaseOrderService from '@/services/purchaseOrderService';
import accountService from '@/services/accountService';
import productService from '@/services/productService';
import { getProfileApi } from '@/services/authService';
import { determinePurchaseGst } from '@/utils/gstUtils';
import { useTranslation } from 'react-i18next';

import GRNForm from './components/GRNForm';
import GRNTable from './components/GRNTable';
import AccountTable from './components/AccountTable';

const AddGRN = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const challanDateRef = useRef(null);

    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [pos, setPos] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [formData, setFormData] = useState({
        supplier_id: '',
        supplier_name: '',
        address: '',
        document_number: '', 
        gst_no: '',
        credit_days: 0,
        booking_date: new Date().toISOString().split('T')[0],
        document_date: new Date().toISOString().split('T')[0],
        supplier_challan_number: '',
        po_id: '',
        po_number: '',
        po_date: '', // Track PO date for constraints
        attachment: null
    });

    const [items, setItems] = useState([
        { 
            id: Date.now(), 
            productId: null,
            productCode: '', 
            productName: '', 
            quantity: 0, 
            rate: 0, 
            uom: '', 
            discountAmount: 0, 
            discountPercent: 0, 
            hsnCode: '', 
            taxPercent: 0, 
            beforeTaxAmount: 0, 
            taxAmount: 0, 
            totalAmount: 0,
            printDescription: '',
            totalPoQty: 0,
            receivedPoQty: 0,
            remainingQty: 0
        }
    ]);

    const [expenses, setExpenses] = useState([]);

    const [errors, setErrors] = useState({});
    const [companyInfo, setCompanyInfo] = useState(null);
    const [gstType, setGstType] = useState({ gstType: 'NONE' });
    const getFinancialYearStart = () => {
        const now = new Date();
        const year = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
        return `${year}-04-01`;
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [suppRes, prodRes, profileRes] = await Promise.all([
                    grnService.getSuppliers(),
                    productService.getProducts({ limit: 1000 }),
                    getProfileApi()
                ]);
                
                setSuppliers(suppRes || []);
                setProducts(prodRes.products || []);
                setCompanyInfo({
                    ...profileRes?.shopDetail,
                    gstNumber: profileRes?.gstNumber
                });

                if (isEditMode) {
                    const grn = await grnService.getGRNById(id);
                    const suppState = grn.supplierState || ""; // Might need to fetch from supplier list if not in GRN object
                    
                    const poList = await grnService.getSupplierPOs(grn.supplierName);
                    setPos(poList || []);

                    setFormData({
                        supplier_id: grn.supplierId?.toString() || '',
                        supplier_name: grn.supplierName,
                        address: grn.address,
                        document_number: grn.grnNumber || grn.grnNo || `GRN-${String(grn.id).padStart(4, '0')}`,
                        grn_number: grn.grnNumber || grn.grnNo || `GRN-${String(grn.id).padStart(4, '0')}`,
                        supplier_challan_number: grn.challanNumber,
                        booking_date: grn.bookingDate?.split('T')[0] || grn.grnDate?.split('T')[0],
                        document_date: grn.grnDate?.split('T')[0],
                        credit_days: grn.creditDays,
                        po_id: grn.poId || '',
                        po_number: grn.poNumber || '',
                        po_date: grn.poDate?.split('T')[0] || '', // Load PO date if exists
                        gst_no: grn.gstNumber || grn.gstNo || "",
                        supplier_state: suppState
                    });

                    const type = calculateGST(grn.gstNumber || grn.gstNo || "", suppState);
                    setGstType(type);

                    setItems(grn.items.map(item => {
                        const qty = item.receivedQty || item.quantity || 0;
                        const rate = item.rate || 0;
                        const taxPct = item.taxPercent !== undefined && item.taxPercent !== null ? item.taxPercent : 18;
                        const discAmt = item.discountAmount || item.discountAmt || 0;
                        const discPct = item.discountPercent || 0;
                        const befTax = (qty * rate) - discAmt;
                        const taxAmt = (befTax * taxPct) / 100;

                        return {
                            id: item.id,
                            productId: item.productId,
                            productCode: item.productCode,
                            productName: item.productName,
                            quantity: qty,
                            rate: rate,
                            uom: item.uom,
                            taxPercent: taxPct,
                            discountAmount: discAmt,
                            discountPercent: discPct,
                            beforeTaxAmount: befTax,
                            taxAmount: taxAmt,
                            totalAmount: befTax + taxAmt,
                            printDescription: item.printDescription || item.productName || '',
                            originalPrintDescription: item.printDescription || item.productName || '',
                            totalPoQty: item.totalPoQty || 0,
                            receivedPoQty: item.receivedPoQty || 0,
                            remainingQty: (item.totalPoQty || 0) - (item.receivedPoQty || 0) - qty
                        };
                    }));

                    setExpenses(grn.expenses?.map(e => ({
                        id: e.id,
                        groupName: e.groupName,
                        amount: e.amount,
                        isGstApplicable: e.isGstApplicable,
                        taxRate: e.taxRate
                    })) || []);
                } else {
                    try {
                        const numRes = await grnService.getNextNumber();
                        const nextNo = numRes?.grnNumber || 'GRN-0001';
                        setFormData(prev => ({
                            ...prev,
                            document_number: nextNo,
                            grn_number: nextNo
                        }));
                    } catch (e) {
                        console.error('Error fetching GRN next number', e);
                        setFormData(prev => ({
                            ...prev,
                            document_number: 'GRN-0001',
                            grn_number: 'GRN-0001'
                        }));
                    }

                    // Check for Draft Restore
                    const urlParams = new URLSearchParams(window.location.search);
                    const newCustomerId = urlParams.get('newCustomerId');
                    const isExplicitRestore = urlParams.get('restore') === 'true' || !!newCustomerId;

                    const draftStr = sessionStorage.getItem('add_grn_draft');
                    if (draftStr && isExplicitRestore) {
                        try {
                            const draft = JSON.parse(draftStr);
                            let restoredFormData = draft.formData;
                            let restoredItems = draft.items;
                            let restoredExpenses = draft.expenses || [];

                            const oldSupplierIdsStr = sessionStorage.getItem('add_grn_supplier_ids');
                            const fetchedSuppliers = suppRes || [];
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
                                        address: (newSupplier.addressLine1 || '') + (newSupplier.addressLine2 ? ', ' + newSupplier.addressLine2 : ''),
                                        credit_days: newSupplier.supplierCreditDays || newSupplier.creditDays || 0,
                                        gst_no: newSupplier.gstNo || '',
                                        supplier_state: newSupplier.state || ''
                                    };
                                    setGstType(calculateGST(newSupplier.gstNo || "", newSupplier.state));
                                }
                            const oldProductIdsStr = sessionStorage.getItem('add_grn_product_ids');
                            if (oldProductIdsStr) {
                                const oldIds = JSON.parse(oldProductIdsStr);
                                const newProduct = (prodRes.products || []).find(p => !oldIds.includes(p.id));
                                if (newProduct) {
                                    const newItem = {
                                        id: Date.now(),
                                        productId: newProduct.id,
                                        productCode: newProduct.product_code,
                                        productName: newProduct.product_name,
                                        quantity: 1,
                                        rate: newProduct.purchaseRate || 0,
                                        uom: newProduct.uom?.gst_uom || newProduct.uom?.unit_name || 'NOS',
                                        taxPercent: newProduct.tax_rate || 0,
                                        discountAmount: 0,
                                        discountPercent: 0,
                                        beforeTaxAmount: newProduct.purchaseRate || 0,
                                        taxAmount: ((newProduct.purchaseRate || 0) * (newProduct.tax_rate || 0)) / 100,
                                        totalAmount: (newProduct.purchaseRate || 0) * (1 + (newProduct.tax_rate || 0) / 100),
                                        printDescription: newProduct.description || newProduct.product_name || '',
                                        originalPrintDescription: newProduct.description || newProduct.product_name || '',
                                        totalPoQty: 0,
                                        receivedPoQty: 0,
                                        remainingQty: 0
                                    };

                                    if (restoredItems.length === 1 && !restoredItems[0].productCode) {
                                        restoredItems = [newItem];
                                    } else if (!restoredItems.some(i => i.productId === newProduct.id)) {
                                        restoredItems = [...restoredItems, newItem];
                                    }
                                }
                            }

                            setFormData(restoredFormData);
                            setItems(restoredItems);
                            setExpenses(restoredExpenses);
                        } catch (e) {
                            console.error('Draft parsing failed', e);
                        } finally {
                            sessionStorage.removeItem('add_grn_supplier_ids');
                            sessionStorage.removeItem('add_grn_product_ids');
                        }
                    } else if (draftStr) {
                        sessionStorage.removeItem('add_grn_draft');
                    }
                }
            } catch (error) {
                console.error("Error fetching setup data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [id, isEditMode]);

    const handleSupplierChange = async (supplierId) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (!supplier) return;

        const supplierState = supplier.state;
        const type = calculateGST(supplier.gstNo || "", supplierState);
        setGstType(type);

        setFormData(prev => ({
            ...prev,
            supplier_id: supplier.id,
            supplier_name: supplier.accountName,
            address: (supplier.addressLine1 || "") + (supplier.addressLine2 ? ", " + supplier.addressLine2 : ""),
            gst_no: supplier.gstNo || "",
            credit_days: supplier.supplierCreditDays || 0,
            supplier_state: supplierState
        }));

        try {
            const poResponse = await grnService.getSupplierPOs(supplier.accountName);
            const poList = Array.isArray(poResponse) ? poResponse : (poResponse.data || []);
            setPos(poList.filter(p => p.status !== 'DELETED'));
        } catch (error) {
            console.error("Error fetching supplier data:", error);
        }
    };

    useEffect(() => {
        if (!formData.supplier_id) return;
        const supplier = suppliers.find(s => String(s.id) === String(formData.supplier_id));
        if (!supplier) return;

        const isSupplierMsmeActive = supplier.msmeEnabled;
        const isSupplierMsmeType = supplier.regType === "Manufacturing" || supplier.regType === "Service";
        const hasSupplierMsmeId = supplier.msmeId && supplier.msmeId.trim() !== '' && supplier.msmeId.trim().toUpperCase() !== 'N/A';
        const isSupplierMsme = Boolean(isSupplierMsmeActive && isSupplierMsmeType && hasSupplierMsmeId);

        if (isSupplierMsme && formData.credit_days) {
            const val = parseInt(formData.credit_days, 10);
            if (!isNaN(val) && val > 45) {
                setFormData(prev => ({ ...prev, credit_days: 45 }));
                toast.error(
                    "For MSME Manufacturing/Service suppliers, maximum credit period allowed is 45 days. Credit Days has been adjusted to 45.",
                    { id: "msme-supplier-warning" }
                );
            }
        }
    }, [formData.supplier_id, formData.credit_days, suppliers]);

    const calculateGST = (supplierGST, supplierState) => {
        return determinePurchaseGst(
            supplierGST,
            companyInfo?.gstNumber,
            companyInfo?.state || "",
            supplierState,
            0, 0, 0
        );
    };

    const handlePOChange = async (poId) => {
        if (!poId) {
            const supplier = suppliers.find(s => s.id === parseInt(formData.supplier_id));
            const defaultCreditDays = supplier ? (supplier.supplierCreditDays || 0) : 0;
            setFormData(prev => ({ ...prev, po_id: '', po_number: '', credit_days: defaultCreditDays }));
            const resetItems = items.map(item => ({
                ...item,
                totalPoQty: 0,
                receivedPoQty: 0,
                remainingQty: 0
            }));
            setItems(resetItems);
            return;
        }

        const selectedPO = pos.find(p => p.id === parseInt(poId));
        if (!selectedPO) return;

        try {
            const poDetails = await purchaseOrderService.getPurchaseOrderById(poId);
            setFormData(prev => ({ 
                ...prev, 
                po_id: poDetails.id, 
                po_number: poDetails.poNumber,
                po_date: poDetails.poCreationDate?.split('T')[0] || '',
                credit_days: poDetails.creditDays !== undefined && poDetails.creditDays !== null ? poDetails.creditDays : (prev.credit_days || 0)
            }));

            const poItems = await Promise.all(poDetails.items.map(async (item) => {
                const qty = item.quantity || 0;
                const rate = item.rate || 0;
                const taxPct = item.taxPercent || 0;
                const discAmt = item.discountAmount || 0;
                const discPct = item.discountPercent || 0;
                
                // Fetch received count for this product & supplier from GRN history
                let receivedCount = item.receivedQty || 0;
                try {
                   const history = await grnService.getReceivedQty(formData.supplier_name, item.productCode || item.product_code, selectedPO.poNumber);
                   receivedCount = history.receivedPoQty;
                } catch (e) {
                   console.error("Failed to fetch received history", e);
                }

                const remainingInPO = Math.max(0, qty - receivedCount);

                return {
                    id: Date.now() + Math.random(),
                    productId: item.productId || item.product_id,
                    productCode: item.productCode || item.product_code,
                    productName: item.productName || item.product_name,
                    quantity: 0, 
                    rate: rate,
                    uom: item.uom,
                    discountAmount: 0,
                    discountPercent: discPct,
                    hsnCode: item.hsnCode || item.hsn_code || '',
                    taxPercent: taxPct,
                    beforeTaxAmount: 0,
                    taxAmount: 0,
                    totalAmount: 0,
                    printDescription: item.printDescription || item.productName || item.product_name || '',
                    originalPrintDescription: item.printDescription || item.productName || item.product_name || '',
                    totalPoQty: qty,
                    receivedPoQty: receivedCount,
                    remainingQty: remainingInPO
                };
            }));
            setItems(poItems);
        } catch (error) {
            console.error("Error fetching PO details:", error);
        }
    };
    const validateForm = () => {
        const newErrors = {};
        if (!formData.supplier_name) newErrors.supplier_name = "Supplier is required";
        if (!formData.address) newErrors.address = "Address is required";
        if (formData.credit_days === "" || formData.credit_days === undefined) newErrors.credit_days = "Credit days is required";
        if (!formData.supplier_challan_number) newErrors.supplier_challan_number = "Challan number is required";

        const supplier = suppliers.find(s => String(s.id) === String(formData.supplier_id));
        if (supplier) {
            const isSupplierMsmeActive = supplier.msmeEnabled;
            const isSupplierMsmeType = supplier.regType === "Manufacturing" || supplier.regType === "Service";
            const hasSupplierMsmeId = supplier.msmeId && supplier.msmeId.trim() !== '' && supplier.msmeId.trim().toUpperCase() !== 'N/A';
            const isSupplierMsme = Boolean(isSupplierMsmeActive && isSupplierMsmeType && hasSupplierMsmeId);

            if (isSupplierMsme && Number(formData.credit_days) > 45) {
                newErrors.credit_days = "MSME supplier payment terms cannot exceed 45 days as per MSME compliance rules.";
                toast.error("MSME supplier payment terms cannot exceed 45 days as per MSME compliance rules.", { id: "msme-supplier-error" });
            }
        }
        if (!formData.document_date) {
            newErrors.document_date = "Challan date is required";
        } else {
            const today = new Date().toISOString().split('T')[0];
            const hasPO = !!formData.po_id;
            
            if (hasPO) {
                // Condition 1A: Supplier Challan Date Validation
                // Allowed: PO Date to Today
                // Validation Message: Supplier Challan Date must be between PO Date and Current Date.
                const poDate = formData.po_date;
                if (formData.document_date > today || (poDate && formData.document_date < poDate)) {
                    newErrors.document_date = "Supplier Challan Date must be between PO Date and Current Date.";
                }
            } else {
                // Condition 2A: Supplier Challan Date Validation (Without PO)
                // Allowed: Financial Year Start Date to Today
                // Validation Message: Supplier Challan Date must be between Financial Year Start and Current Date.
                const fyStart = getFinancialYearStart();
                if (formData.document_date > today || formData.document_date < fyStart) {
                    newErrors.document_date = "Supplier Challan Date must be between Financial Year Start and Current Date.";
                }
            }
        }

        const validItems = items.filter(item => item.productCode);
        if (validItems.length === 0) {
            newErrors.items = "At least one product is required";
        } else {
            const itemErrors = [];
            items.forEach((item, index) => {
                if (item.productCode) {
                    const qtyVal = item.quantity !== undefined && item.quantity !== null && item.quantity !== '' ? Number(item.quantity) : NaN;
                    const rateVal = item.rate !== undefined && item.rate !== null && item.rate !== '' ? Number(item.rate) : NaN;

                    if (isNaN(qtyVal) || qtyVal < 0) {
                        if (!itemErrors[index]) itemErrors[index] = {};
                        itemErrors[index].quantity = true;
                    }
                    if (isNaN(rateVal) || rateVal < 0) {
                        if (!itemErrors[index]) itemErrors[index] = {};
                        itemErrors[index].rate = true;
                    }
                }
            });
            if (itemErrors.length > 0) newErrors.itemErrors = itemErrors;
        }

        if (Object.keys(newErrors).length > 0) {
            if (newErrors.document_date) {
                toast.error(newErrors.document_date);
            } else if (newErrors.supplier_name) {
                toast.error(newErrors.supplier_name);
            } else if (newErrors.supplier_challan_number) {
                toast.error(newErrors.supplier_challan_number);
            } else if (newErrors.credit_days) {
                toast.error(newErrors.credit_days);
            } else if (newErrors.items) {
                toast.error(newErrors.items);
            } else if (newErrors.itemErrors) {
                toast.error("Please fill all product details correctly");
            } else {
                toast.error("Please fill all required fields correctly");
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSaving(true);
        try {
            const validItems = items.filter(i => i.productCode);
            const gstResult = calculateGST(formData.gst_no, formData.supplier_state);
            
            let materialTotal = 0;
            let materialTax = 0;

            validItems.forEach(p => {
                const qty = parseFloat(p.quantity) || 0;
                const rate = parseFloat(p.rate) || 0;
                const discAmt = parseFloat(p.discountAmount) || 0;
                const befTax = (qty * rate) - discAmt;
                const taxPct = parseFloat(p.taxPercent) || 0;
                materialTotal += befTax;
                materialTax += (befTax * taxPct) / 100;
            });

            let expenseTotal = 0;
            let expenseTax = 0;
            const expenseData = expenses.filter(e => e.groupName && e.amount > 0).map(e => {
                const amt = parseFloat(e.amount) || 0;
                const taxRate = parseFloat(e.taxRate) || 0;
                let taxAmt = 0;
                if (e.isGstApplicable) {
                    taxAmt = (amt * taxRate) / 100;
                }
                expenseTotal += amt;
                expenseTax += taxAmt;
                return {
                    groupName: e.groupName,
                    amount: amt,
                    isGstApplicable: e.isGstApplicable,
                    taxRate: taxRate,
                    taxAmount: taxAmt
                };
            });

            const finalTaxTotal = gstResult.gstType !== 'NONE' ? (materialTax + expenseTax) : 0;
            let cgst = 0, sgst = 0, igst = 0;

            if (gstResult.gstType !== 'NONE') {
                if (gstResult.gstType === 'CGST_SGST') {
                    cgst = finalTaxTotal / 2;
                    sgst = finalTaxTotal / 2;
                } else if (gstResult.gstType === 'IGST') {
                    igst = finalTaxTotal;
                }
            }

            // Case 2 RCM: Tax is calculated but not added to grandTotal payable to supplier
            const taxInGrandTotal = finalTaxTotal;
            const grandTotal = materialTotal + expenseTotal + taxInGrandTotal;

            const payload = {
                grnNumber: formData.document_number || formData.grn_number,
                grnNo: formData.document_number || formData.grn_number,
                supplierId: formData.supplier_id,
                supplierName: formData.supplier_name,
                address: formData.address,
                challanNumber: formData.supplier_challan_number,
                grnDate: formData.document_date,
                bookingDate: formData.booking_date,
                creditDays: parseInt(formData.credit_days),
                poId: formData.po_id ? parseInt(formData.po_id) : undefined,
                poNumber: formData.po_number || undefined,
                gstNumber: formData.gst_no,
                isRcm: false,
                items: validItems.map(i => ({
                    productId: i.productId?.toString() || undefined,
                    productCode: i.productCode,
                    productName: i.productName,
                    totalPoQty: parseFloat(i.totalPoQty) || 0,
                    receivedPoQty: parseFloat(i.receivedPoQty) || 0,
                    quantity: parseFloat(i.quantity) || 0,
                    remainingQty: parseFloat(i.remainingQty) || 0,
                    rate: parseFloat(i.rate) || 0,
                    uom: i.uom,
                    discountAmt: parseFloat(i.discountAmount) || 0,
                    discountPercent: parseFloat(i.discountPercent) || 0,
                    taxPercent: gstResult.gstType !== 'NONE' ? (parseFloat(i.taxPercent) || 0) : 0,
                    taxAmount: gstResult.gstType !== 'NONE' ? (parseFloat(i.taxAmount) || 0) : 0,
                    beforeTaxAmount: parseFloat(i.beforeTaxAmount) || 0,
                    hsnCode: i.hsnCode,
                    amount: (parseFloat(i.totalAmount) || 0),
                    printDescription: i.printDescription
                })),
                expenses: expenseData,
                accountSummary: {
                    material: materialTotal,
                    expense: expenseTotal,
                    cgst: cgst,
                    sgst: sgst,
                    igst: igst,
                    grandTotal: grandTotal
                },
                grandTotal: grandTotal
            };

            if (isEditMode) {
                await grnService.updateGRN(id, payload);
                toast.success("GRN updated successfully");
            } else {
                await grnService.createGRN(payload);
                toast.success("GRN created successfully");
            }
            sessionStorage.removeItem('add_grn_draft');
            navigate(ROUTES.PURCHASE_GRN);
        } catch (error) {
            console.error("Error saving GRN:", error);
            toast.error(error.response?.data?.message || "Failed to save GRN");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddNewProduct = () => {
        const redirect = isEditMode ? `${ROUTES.GRN_EDIT.replace(':id', id)}` : ROUTES.GRN_ADD;
        sessionStorage.setItem('add_grn_draft', JSON.stringify({ formData, items, expenses }));
        sessionStorage.setItem('add_grn_product_ids', JSON.stringify(products.map(p => p.id)));
        navigate(`/seller/masters/product-master/add?redirect=${encodeURIComponent(redirect + (redirect.includes('?') ? '&' : '?') + 'restore=true')}`);
    };

    const handleAddNewSupplier = () => {
        sessionStorage.setItem('add_grn_draft', JSON.stringify({ formData, items, expenses }));
        sessionStorage.setItem('add_grn_supplier_ids', JSON.stringify(suppliers.map(s => s.id)));
        navigate(`/seller/masters/account-master/add?redirect=${encodeURIComponent(ROUTES.GRN_ADD + '?restore=true')}`);
    };

    // Auto save draft on change
    useEffect(() => {
        if (!isEditMode) {
            const hasData = formData.supplier_id || items.some(i => i.productCode);
            if (hasData) {
                sessionStorage.setItem('add_grn_draft', JSON.stringify({ formData, items, expenses }));
            }
        }
    }, [formData, items, expenses, isEditMode]);

    if (isLoading && !isEditMode) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="animate-spin text-emerald-800" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-20 font-outfit">
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <h2 className="text-[20px] font-bold text-[#111827]">{isEditMode ? t('common:edit_grn', 'Edit GRN') : t('common:add_grn', 'Add GRN')}</h2>
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} /> {t('common:back')}
                    </button>
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    {(() => {
                        const minDate = formData.po_id ? formData.po_date : getFinancialYearStart();
                        const today = new Date().toISOString().split('T')[0];

                        return (
                            <GRNForm 
                                formData={formData}
                                setFormData={setFormData}
                                handleSupplierChange={handleSupplierChange}
                                handlePOChange={handlePOChange}
                                suppliers={suppliers}
                                pos={pos}
                                errors={errors}
                                challanDateRef={challanDateRef}
                                onAddSupplier={handleAddNewSupplier}
                                minDate={minDate}
                                maxDate={today}
                            />
                        );
                    })()}
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <GRNTable 
                        items={items}
                        setItems={setItems}
                        products={products}
                        errors={errors}
                        handleAddNewProduct={handleAddNewProduct}
                        gstType={gstType}
                        isPoSelected={!!formData.po_id}
                        poNumber={formData.po_number || formData.poNumber}
                        linkedPoItems={pos.find(p => p.id === parseInt(formData.po_id))?.items}
                        supplierName={formData.supplier_name}
                    />
                </div>

                <div className="p-8">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                         <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        {t('modules:account_summary')}
                    </h2>
                    <AccountTable 
                        items={items} 
                        gstType={gstType} 
                        expenses={expenses}
                        setExpenses={setExpenses}
                    />
                </div>

                <div className="px-8 py-6 border-t border-[#F3F4F6] bg-gray-50 flex justify-end gap-4">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] shadow-[0_4px_15px_rgba(7,51,24,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {t('modules:save_grn', 'Save GRN')}
                    </button>
                    <button 
                        onClick={() => navigate(-1)}
                        className="px-8 h-[48px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[15px] font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        {t('common:cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddGRN;
