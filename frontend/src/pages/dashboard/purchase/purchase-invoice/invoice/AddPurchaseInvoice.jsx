import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';

import purchaseInvoiceService from '@/services/purchaseInvoiceService';
import purchaseOrderService from '@/services/purchaseOrderService';
import accountService from '@/services/accountService';
import productService from '@/services/productService';
import grnService from '@/services/grnService';
import { getProfileApi } from '@/services/authService';

import GRNForm from '../grn/components/GRNForm';
import GRNTable from '../grn/components/GRNTable';
import AccountTable from '../grn/components/AccountTable';

const AddPurchaseInvoice = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const challanDateRef = useRef(null);

    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [pos, setPos] = useState([]);
    const [challans, setChallans] = useState([]);
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
        supplier_invoice_number: '',
        grn_ids: [],
        po_id: '',
        po_number: '',
        attachment: null,
        supplier_state: ''
    });

    const [expenses, setExpenses] = useState([]);
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

    const [errors, setErrors] = useState({});
    const [companyInfo, setCompanyInfo] = useState(null);
    const [gstType, setGstType] = useState({ type: 'NONE' });

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [accRes, prodRes, profileRes] = await Promise.all([
                    accountService.getAllAccounts({ groupName: 'SUNDRY_CREDITORS', limit: 1000 }),
                    productService.getProducts({ limit: 1000 }),
                    getProfileApi()
                ]);
                
                setSuppliers(accRes.data || []);
                setProducts(prodRes.products || []);
                setCompanyInfo({
                    ...profileRes?.shopDetail,
                    gstNumber: profileRes?.gstNumber
                });

                if (isEditMode) {
                    const invoice = await purchaseInvoiceService.getInvoice(id);
                    const currentSupplier = (accRes.data || []).find(s => s.id === invoice.supplierId);
                    
                    setFormData({
                        supplier_id: invoice.supplierId || '',
                        supplier_name: invoice.supplierName,
                        address: invoice.address,
                        document_number: invoice.invoiceNumber,
                        supplier_invoice_number: invoice.supplierInvoiceNumber,
                        document_date: invoice.supplierInvoiceDate?.split('T')[0],
                        booking_date: invoice.bookingDate?.split('T')[0],
                        credit_days: invoice.creditDays,
                        po_id: invoice.poId || '',
                        po_number: invoice.poNumber || '',
                        gst_no: invoice.gstNumber || "",
                        grn_ids: invoice.challanNumber ? invoice.challanNumber.split(',') : [],
                        supplier_state: currentSupplier?.state || ""
                    });
                    setItems(invoice.items.map(item => {
                        const quantity = item.quantity || 0;
                        const rate = item.rate || 0;
                        const taxPct = item.taxPercent || 18;
                        const baseAmt = quantity * rate;
                        const taxAmt = (baseAmt * taxPct) / 100;
                        return {
                            id: item.id,
                            productId: item.productId,
                            productCode: item.productCode,
                            productName: item.productName,
                            quantity: quantity,
                            rate: rate,
                            uom: item.uom,
                            taxPercent: taxPct,
                            discountAmount: item.discountAmount || 0,
                            discountPercent: item.discountPercent || 0,
                            beforeTaxAmount: item.beforeTaxAmount || baseAmt,
                            taxAmount: item.taxAmount || taxAmt,
                            totalAmount: item.totalAmount || (baseAmt + taxAmt),
                            printDescription: item.productName,
                            totalPoQty: item.totalPoQty || 0, 
                            receivedPoQty: item.receivedPoQty || 0,
                            remainingQty: (item.totalPoQty || 0) - (item.receivedPoQty || 0) - quantity
                        };
                    }));

                    setExpenses(invoice.expenses?.map(e => ({
                        id: e.id,
                        groupName: e.groupName,
                        amount: e.amount,
                        isGstApplicable: e.isGstApplicable,
                        taxRate: e.taxRate
                    })) || []);
                } else {
                    const nextNo = await purchaseInvoiceService.getNextNumber();
                    let newDocNo = '';
                    if (nextNo) {
                        newDocNo = nextNo.invoiceNumber;
                        setFormData(prev => ({ ...prev, document_number: nextNo.invoiceNumber }));
                    }

                    // Check for Draft Restore
                    const urlParams = new URLSearchParams(window.location.search);
                    const newCustomerId = urlParams.get('newCustomerId');
                    const isExplicitRestore = urlParams.get('restore') === 'true' || !!newCustomerId;

                    const draftStr = sessionStorage.getItem('add_pi_draft');
                    if (draftStr && isExplicitRestore) {
                        try {
                            const draft = JSON.parse(draftStr);
                            let restoredFormData = draft.formData;
                            let restoredItems = draft.items;
                            let restoredExpenses = draft.expenses || [];

                            if (newDocNo && !restoredFormData.document_number) restoredFormData.document_number = newDocNo;

                            const oldSupplierIdsStr = sessionStorage.getItem('add_pi_supplier_ids');
                            const fetchedSuppliers = accRes.data || [];
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
                                }
                            
                            const oldProductIdsStr = sessionStorage.getItem('add_pi_product_ids');
                            if (oldProductIdsStr) {
                                const oldIds = JSON.parse(oldProductIdsStr);
                                const prodRes = await productService.getProducts({ limit: 50 }); // We have to fetch products since not stored here locally immediately
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
                                        printDescription: newProduct.description || newProduct.product_name,
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
                            
                            if (restoredFormData.gst_no || restoredFormData.supplier_state) {
                                setGstType(calculateGST(restoredFormData.gst_no, restoredFormData.supplier_state));
                            }
                        } catch (e) {
                            console.error('Draft parsing failed', e);
                        } finally {
                            sessionStorage.removeItem('add_pi_supplier_ids');
                            sessionStorage.removeItem('add_pi_product_ids');
                        }
                    } else if (draftStr) {
                        sessionStorage.removeItem('add_pi_draft');
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

        setFormData(prev => ({
            ...prev,
            supplier_id: supplier.id,
            supplier_name: supplier.accountName,
            address: (supplier.addressLine1 || "") + (supplier.addressLine2 ? ", " + supplier.addressLine2 : ""),
            gst_no: supplier.gstNo || "",
            credit_days: supplier.supplierCreditDays || 0,
            supplier_state: supplier.state,
            grn_ids: []
        }));

        const type = calculateGST(supplier.gstNo || "", supplier.state);
        setGstType(type);

        try {
            const [poResponse, grnResponse] = await Promise.all([
                purchaseInvoiceService.getSupplierPOs(supplier.id),
                purchaseInvoiceService.getSupplierGRNs(supplier.id)
            ]);
            
            const poList = Array.isArray(poResponse) ? poResponse : (poResponse.data || []);
            setPos(poList.filter(p => p.status !== 'DELETED'));
            
            const grnList = Array.isArray(grnResponse) ? grnResponse : (grnResponse.data || []);
            setChallans(grnList.filter(c => c.status !== 'DELETED' && (c.remainingQty === undefined || c.remainingQty > 0)));
        } catch (error) {
            console.error("Error fetching supplier data:", error);
        }
    };

    const calculateGST = (supplierGST, supplierState) => {
        const userGst = companyInfo?.gstNumber;
        const userState = (companyInfo?.state || "").trim().toLowerCase();
        const suppState = (supplierState || "").trim().toLowerCase();

        const userCode = userGst ? userGst.substring(0, 2) : null;
        const supplierCode = supplierGST ? supplierGST.substring(0, 2) : null;

        if (userGst && supplierGST) {
            // Case 1: Both have GST
            let isInterState = false;
            if (/^\d{2}$/.test(userCode) && /^\d{2}$/.test(supplierCode)) {
                isInterState = userCode !== supplierCode;
            } else {
                isInterState = userState !== suppState;
            }
            return { type: isInterState ? 'INTER' : 'INTRA', applicable: true, isRcm: false };
        } else if (userGst && !supplierGST) {
            // Case 2: Supplier NO, Buyer YES (RCM)
            return { type: 'NONE', applicable: true, isRcm: true };
        } else if (!userGst && supplierGST) {
            // Case 3: Buyer NO, Supplier YES (Normal GST)
            const isInterState = userState !== suppState;
            return { type: isInterState ? 'INTER' : 'INTRA', applicable: true, isRcm: false };
        } else {
            // Case 4: Both NO
            return { type: 'NONE', applicable: false, isRcm: false };
        }
    };

    const handleChallanChange = async (selectedGrnIds) => {
        if (!selectedGrnIds || selectedGrnIds.length === 0) {
            setFormData(prev => ({ ...prev, grn_ids: [] }));
            setItems([{ 
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0, 
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0, 
                taxAmount: 0, totalAmount: 0, printDescription: '', totalPoQty: 0, receivedPoQty: 0, remainingQty: 0 
            }]);
            return;
        }

        try {
            // Fetch all selected GRNs
            const grns = await Promise.all(selectedGrnIds.map(id => grnService.getGRNById(id)));
            
            // Merge logic
            const productMap = {};
            grns.forEach(grn => {
                if (grn && grn.items) {
                    grn.items.forEach(item => {
                        const pid = item.productId;
                        if (!productMap[pid]) {
                            productMap[pid] = {
                                id: Date.now() + Math.random(),
                                productId: item.productId,
                                productCode: item.productCode,
                                productName: item.productName,
                                quantity: parseFloat(item.quantity) || 0,
                                rate: parseFloat(item.rate) || 0,
                                uom: item.uom,
                                hsnCode: item.hsnCode || '',
                                taxPercent: item.taxPercent || 18,
                                totalPoQty: item.totalPoQty || 0,
                                discountAmount: 0,
                                discountPercent: 0,
                                beforeTaxAmount: 0, 
                                taxAmount: 0,
                                totalAmount: 0,
                                printDescription: item.productName
                            };
                        } else {
                            productMap[pid].quantity += parseFloat(item.quantity) || 0;
                        }
                    });
                }
            });

            const mergedItems = Object.values(productMap).map(item => {
                const quantity = item.quantity;
                const rate = item.rate;
                const taxPct = item.taxPercent;
                const baseAmt = quantity * rate;
                const taxAmt = (baseAmt * taxPct) / 100;
                return {
                    ...item,
                    beforeTaxAmount: parseFloat(baseAmt.toFixed(2)),
                    taxAmount: parseFloat(taxAmt.toFixed(2)),
                    totalAmount: parseFloat((baseAmt + taxAmt).toFixed(2))
                };
            });

            setItems(mergedItems.length > 0 ? mergedItems : [{ 
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0, 
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0, 
                taxAmount: 0, totalAmount: 0, printDescription: '', totalPoQty: 0, receivedPoQty: 0, remainingQty: 0 
            }]);

            setFormData(prev => ({ 
                ...prev, 
                grn_ids: selectedGrnIds
            }));
        } catch (error) {
            console.error("Error fetching GRN details:", error);
            toast.error("Failed to fetch challan details");
        }
    };

    const handlePOChange = async (poId) => {
        if (!poId) {
            setFormData(prev => ({ ...prev, po_id: '', po_number: '' }));
            const resetItems = items.map(p => ({
                ...p,
                totalPoQty: 0,
                received_po_qty: 0,
                remainingQty: 0
            }));
            setItems(resetItems);
            return;
        }

        const selectedPO = pos.find(p => p.id === parseInt(poId));
        if (!selectedPO) return;

        try {
            const poDetails = await purchaseOrderService.getPurchaseOrderById(poId);
            setFormData(prev => ({ ...prev, po_id: poDetails.id, po_number: poDetails.poNumber }));

            const poItems = await Promise.all(poDetails.items.map(async (item) => {
                const quantity = item.quantity || 0;
                const rate = item.rate || 0;
                const discAmt = item.discountAmount || 0;
                const taxPct = item.taxPercent || 0;

                // Fetch received count for this product & supplier from GRN history
                let receivedCount = item.receivedQty || 0;
                try {
                   const history = await grnService.getReceivedQty(formData.supplier_name, item.productCode || item.product_code);
                   receivedCount = history.receivedPoQty;
                } catch (e) {
                   console.error("Failed to fetch received history", e);
                }

                const remainingInPO = quantity - receivedCount;
                const effectiveQty = remainingInPO > 0 ? remainingInPO : 0;

                const befTax = (effectiveQty * rate) - discAmt;
                const taxAmt = (befTax * taxPct) / 100;
                return {
                    id: Date.now() + Math.random(),
                    productId: item.productId,
                    productCode: item.productCode,
                    productName: item.productName,
                    quantity: effectiveQty,
                    rate: Number(item.rate) || 0,
                    uom: item.uom,
                    discountAmount: discAmt,
                    discountPercent: item.discountPercent || 0,
                    hsnCode: item.hsnCode || '',
                    taxPercent: taxPct,
                    beforeTaxAmount: befTax,
                    taxAmount: taxAmt,
                    totalAmount: befTax + taxAmt,
                    printDescription: item.productName,
                    totalPoQty: quantity,
                    receivedPoQty: receivedCount,
                    remainingQty: 0
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
        // if (!formData.po_id) newErrors.po_id = "Purchase Order is required";
        if (!formData.address) newErrors.address = "Address is required";
        if (formData.credit_days === "" || formData.credit_days === undefined) newErrors.credit_days = "Credit days is required";
        if (!formData.supplier_invoice_number) newErrors.supplier_invoice_number = "Invoice number is required";
        if (!formData.document_date) newErrors.document_date = "Invoice date is required";

        const validItems = items.filter(item => item.productId);
        if (validItems.length === 0) {
            newErrors.items = true;
        } else {
            const itemErrors = [];
            items.forEach((item, index) => {
                if (item.productId) {
                    if (!item.quantity || item.quantity <= 0) {
                        if (!itemErrors[index]) itemErrors[index] = {};
                        itemErrors[index].quantity = true;
                    }
                    if (!item.rate || item.rate <= 0) {
                        if (!itemErrors[index]) itemErrors[index] = {};
                        itemErrors[index].rate = true;
                    }
                }
            });
            if (itemErrors.length > 0) newErrors.itemErrors = itemErrors;
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
            const validItems = items.filter(i => i.productId || i.productCode);
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

            const finalTaxTotal = gstResult.applicable ? (materialTax + expenseTax) : 0;
            let cgst = 0, sgst = 0, igst = 0;

            if (gstResult.applicable) {
                if (gstResult.type === 'INTRA') {
                    cgst = finalTaxTotal / 2;
                    sgst = finalTaxTotal / 2;
                } else if (gstResult.type === 'INTER') {
                    igst = finalTaxTotal;
                }
            }

            // Case 2 RCM: Tax is calculated but not added to grandTotal payable to supplier
            const taxInGrandTotal = gstResult.isRcm ? 0 : finalTaxTotal;
            // Material + Expenses + Tax
            const grandTotal = materialTotal + expenseTotal + taxInGrandTotal;

            const payload = {
                supplierId: formData.supplier_id ? formData.supplier_id.toString() : '0',
                supplierName: formData.supplier_name,
                address: formData.address,
                gstNumber: formData.gst_no,
                isRcm: gstResult.isRcm,
                creditDays: Number(formData.credit_days),
                poIds: formData.po_id ? [formData.po_id.toString()] : [],
                challanNumbers: formData.grn_ids.map(id => id.toString()),
                supplierInvoiceNumber: formData.supplier_invoice_number,
                invoiceNumber: formData.document_number,
                invoiceDate: formData.document_date,
                bookingDate: formData.booking_date,
                items: validItems.map(i => ({
                    productId: i.productId?.toString() || undefined,
                    productCode: i.productCode,
                    productName: i.productName,
                    quantity: Number(i.quantity),
                    totalPoQty: Number(i.totalPoQty) || 0,
                    rate: Number(i.rate),
                    uom: i.uom,
                    hsnCode: i.hsnCode,
                    taxPercent: parseFloat(i.taxPercent) || 0,
                    taxAmount: parseFloat(i.taxAmount) || 0,
                    beforeTaxAmount: parseFloat(i.beforeTaxAmount) || 0,
                    totalAmount: parseFloat(i.totalAmount) || 0
                })),
                expenses: expenseData,
                accountSummary: {
                    materialPurchase: materialTotal,
                    expense: expenseTotal,
                    cgst: cgst,
                    sgst: sgst,
                    igst: igst,
                    grandTotal: grandTotal
                }
            };
            
            console.log("FINAL PAYLOAD:", payload);

            if (isEditMode) {
                await purchaseInvoiceService.updateInvoice(id, payload, formData.attachment);
                toast.success("Purchase Invoice updated successfully");
            } else {
                await purchaseInvoiceService.createInvoice(payload, formData.attachment);
                toast.success("Purchase Invoice created successfully");
            }
            sessionStorage.removeItem('add_pi_draft');
            navigate(ROUTES.PURCHASE_INVOICE);
            } catch (error) {
                console.error("Error saving Purchase Invoice:", error);
                const errorMsg = error.response?.data?.message || error.message || "Unknown error";
                toast.error(`Failed to save: ${errorMsg}`);
            } finally {
                setIsSaving(false);
            }
    };

    const handleAddNewProduct = () => {
        const redirect = isEditMode ? `${ROUTES.PURCHASE_INVOICE_EDIT.replace(':id', id)}` : ROUTES.PURCHASE_INVOICE_ADD;
        sessionStorage.setItem('add_pi_draft', JSON.stringify({ formData, items, expenses }));
        sessionStorage.setItem('add_pi_product_ids', JSON.stringify(products.map(p => p.id)));
        navigate(`/seller/masters/product-master/add?redirect=${redirect}`);
    };

    const handleAddNewSupplier = () => {
        sessionStorage.setItem('add_pi_draft', JSON.stringify({ formData, items, expenses }));
        sessionStorage.setItem('add_pi_supplier_ids', JSON.stringify(suppliers.map(s => s.id)));
        navigate(`/seller/masters/account-master/add?redirect=${ROUTES.PURCHASE_INVOICE_ADD}`);
    };

    // Auto save draft on change
    useEffect(() => {
        if (!isEditMode) {
            const hasData = formData.supplier_id || items.some(i => i.productId);
            if (hasData) {
                sessionStorage.setItem('add_pi_draft', JSON.stringify({ formData, items, expenses }));
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
                    <h2 className="text-[20px] font-bold text-[#111827]">{isEditMode ? 'Edit' : 'Add'} Purchase Invoice</h2>
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} /> Back
                    </button>
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <GRNForm 
                        formData={formData}
                        setFormData={setFormData}
                        handleSupplierChange={handleSupplierChange}
                        handlePOChange={handlePOChange}
                        handleChallanChange={handleChallanChange}
                        suppliers={suppliers}
                        pos={pos}
                        challans={challans}
                        errors={errors}
                        challanDateRef={challanDateRef}
                        type="Invoice"
                        onAddSupplier={handleAddNewSupplier}
                    />
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <GRNTable 
                        items={items}
                        setItems={setItems}
                        products={products}
                        errors={errors}
                        handleAddNewProduct={handleAddNewProduct}
                        type="Invoice"
                        isPoSelected={!!formData.po_id}
                        gstType={gstType}
                        supplierName={formData.supplier_name}
                    />
                </div>


                <div className="p-8">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                        <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        Account Summary
                    </h2>
                    <AccountTable 
                        items={items} 
                        gstType={gstType} 
                        expenses={expenses}
                        setExpenses={setExpenses}
                    />
                </div>

                <div className="p-8 flex items-center gap-6 border-t border-[#F3F4F6]">
                    <span className="text-[15px] font-bold text-[#374151]">Upload Purchase Invoice :</span>
                    <label className="relative cursor-pointer px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all flex items-center justify-center gap-2 shadow-sm group active:scale-95">
                        {formData.attachment ? (
                            <span className="flex items-center gap-2">
                                <span className="max-w-[200px] truncate">{formData.attachment.name}</span>
                                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-emerald-100">Change</span>
                            </span>
                        ) : "Upload Purchase Invoice"}
                        <input type="file" className="hidden" onChange={(e) => setFormData({...formData, attachment: e.target.files[0]})} accept="application/pdf,image/jpeg,image/png" />
                    </label>
                </div>

                <div className="px-8 py-6 border-t border-[#F3F4F6] bg-gray-50 flex justify-end gap-4">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] shadow-[0_4px_15px_rgba(7,51,24,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        Save Invoice
                    </button>
                    <button 
                        onClick={() => navigate(-1)}
                        className="px-8 h-[48px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[15px] font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddPurchaseInvoice;
