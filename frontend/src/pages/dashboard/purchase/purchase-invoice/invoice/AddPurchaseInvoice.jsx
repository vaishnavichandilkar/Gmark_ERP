import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Eye, EyeOff, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';
import { getImageUrl } from '@/utils/url';

import purchaseInvoiceService from '@/services/purchaseInvoiceService';
import purchaseOrderService from '@/services/purchaseOrderService';
import accountService from '@/services/accountService';
import productService from '@/services/productService';
import grnService from '@/services/grnService';
import { getProfileApi } from '@/services/authService';
import { useTranslation } from 'react-i18next';
import { determinePurchaseGst } from '@/utils/gstUtils';

import GRNForm from '../grn/components/GRNForm';
import GRNTable from '../grn/components/GRNTable';
import AccountTable from '../grn/components/AccountTable';

const AddPurchaseInvoice = () => {
    const { t } = useTranslation(['modules', 'common']);
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
    const [previewUrl, setPreviewUrl] = useState('');

    const [formData, setFormData] = useState({
        supplier_id: '',
        supplier_name: '',
        address: '',
        document_number: '', 
        gst_no: '',
        credit_days: 0,
        booking_date: new Date().toISOString().split('T')[0],
        document_date: '', // Cleared default as per user request
        supplier_invoice_number: '',
        grn_ids: [],
        po_id: '',
        po_number: '',
        po_date: '', // Track PO date
        challan_date: '', // Track latest challan date
        attachment: null,
        supplier_state: ''
    });

    useEffect(() => {
        if (!formData.attachment) {
            setPreviewUrl('');
            return;
        }

        if (typeof formData.attachment === 'string') {
            setPreviewUrl(getImageUrl(formData.attachment));
            return;
        }

        try {
            const objectUrl = URL.createObjectURL(formData.attachment);
            setPreviewUrl(objectUrl);

            return () => URL.revokeObjectURL(objectUrl);
        } catch (e) {
            console.error("Error creating object URL:", e);
            setPreviewUrl('');
        }
    }, [formData.attachment]);

    const toIsoDate = (displayDate) => {
        if (!displayDate) return "";
        if (displayDate.includes("-") && displayDate.split("-")[0].length === 4) return displayDate; // Already ISO
        const separator = displayDate.includes("/") ? "/" : "-";
        const parts = displayDate.split(separator);
        if (parts.length === 3) {
            // Assume DD/MM/YYYY or DD-MM-YYYY
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            if (year.length === 4) return `${year}-${month}-${day}`;
        }
        return displayDate;
    };

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
    const [businessProfile, setBusinessProfile] = useState(null);
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
                const [accRes, prodRes, profileRes, bizProfileRes] = await Promise.all([
                    accountService.getAllAccounts({ groupName: 'SUNDRY_CREDITORS', limit: 1000, status: 'ACTIVE' }),
                    productService.getProducts({ limit: 1000 }),
                    getProfileApi(),
                    accountService.getBusinessProfile().catch(e => {
                        console.error("Error fetching business profile:", e);
                        return null;
                    })
                ]);
                
                setSuppliers(accRes.data || []);
                setProducts(prodRes.products || []);
                setBusinessProfile(bizProfileRes);
                const companyGst = profileRes?.gstNumber || profileRes?.data?.gstNumber || "";
                setCompanyInfo({
                    ...profileRes?.shopDetail,
                    ...profileRes?.data?.shopDetail,
                    gstNumber: companyGst
                });

                if (isEditMode) {
                    const invoice = await purchaseInvoiceService.getInvoice(id);
                    const currentSupplier = (accRes.data || []).find(s => s.id === invoice.supplierId);
                    
                    // Requirement: Fetch dropdown data for the supplier in edit mode
                    if (invoice.supplierId) {
                        try {
                            const [poResponse, grnResponse] = await Promise.all([
                                purchaseInvoiceService.getSupplierPOs(invoice.supplierId, id),
                                purchaseInvoiceService.getSupplierGRNs(invoice.supplierId, id)
                            ]);
                            const poList = Array.isArray(poResponse) ? poResponse : (poResponse.data || []);
                            setPos(poList.filter(p => p.status !== 'DELETED'));
                            const grnList = Array.isArray(grnResponse) ? grnResponse : (grnResponse.data || []);
                            setChallans(grnList);
                        } catch (e) {
                            console.error("Error fetching supplier associations in edit mode:", e);
                        }
                    }

                    const supplierGST = invoice.gstNumber || currentSupplier?.gstNo || "";
                    const supplierState = currentSupplier?.state || "";
                    
                    const numericGrnIds = invoice.challanNumber ? invoice.challanNumber.split(',').map(Number) : [];
                    
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
                        po_date: invoice.poDate?.split('T')[0] || '',
                        challan_date: invoice.latestChallanDate?.split('T')[0] || '',
                        gst_no: supplierGST,
                        grn_ids: numericGrnIds,
                        supplier_state: supplierState,
                        attachment: invoice.uploadedFilePath
                    });

                    // Trigger GST calculation with direct profile data
                    const type = determinePurchaseGst(supplierGST, companyGst, companyInfo?.state || "", supplierState, 0, 0, 0);
                    setGstType(type);

                    // Requirement: If challans are selected, re-sync the item table from GRN data
                    if (numericGrnIds.length > 0) {
                        await handleChallanChange(numericGrnIds);
                    } else {
                        // Fallback to saved invoice items if no challans linked
                        setItems(invoice.items.map(item => {
                            const quantity = item.quantity || 0;
                            const rate = item.rate || 0;
                            const taxPct = item.taxPercent !== undefined && item.taxPercent !== null ? item.taxPercent : 18;
                            const discAmt = item.discountAmount || 0;
                            const baseAmt = quantity * rate;
                            const befTax = baseAmt - discAmt;
                            const taxAmt = (befTax * taxPct) / 100;
                            
                            let hsn = item.hsnCode;
                            if (!hsn && item.productId) {
                                const prod = (prodRes.products || []).find(p => p.id === item.productId);
                                hsn = prod?.hsn_code || '';
                            }

                            return {
                                id: item.id,
                                productId: item.productId,
                                productCode: item.productCode,
                                productName: item.productName,
                                quantity: quantity,
                                rate: rate,
                                uom: item.uom,
                                taxPercent: taxPct,
                                discountAmount: discAmt,
                                discountPercent: item.discountPercent || 0,
                                hsnCode: hsn || '',
                                beforeTaxAmount: item.beforeTaxAmount || befTax,
                                taxAmount: item.taxAmount || taxAmt,
                                totalAmount: item.totalAmount || (befTax + taxAmt),
                                printDescription: item.printDescription || item.print_description || item.productName || '',
                                originalPrintDescription: item.printDescription || item.print_description || item.productName || '',
                                totalPoQty: item.totalPoQty || 0, 
                                receivedPoQty: item.receivedPoQty || 0,
                                remainingQty: (item.totalPoQty || 0) - (item.receivedPoQty || 0) - quantity
                            };
                        }));
                    }

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
                                        printDescription: newProduct.print_description || newProduct.description || newProduct.product_name || '',
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
                                setGstType(determinePurchaseGst(restoredFormData.gst_no, companyGst, companyInfo?.state || "", restoredFormData.supplier_state, 0, 0, 0));
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

        const type = determinePurchaseGst(supplier.gstNo || "", companyInfo?.gstNumber || "", companyInfo?.state || "", supplier.state || "", 0, 0, 0);
        setGstType(type);

        try {
            const [poResponse, grnResponse] = await Promise.all([
                purchaseInvoiceService.getSupplierPOs(supplier.id, id),
                purchaseInvoiceService.getSupplierGRNs(supplier.id, id)
            ]);
            
            const poList = Array.isArray(poResponse) ? poResponse : (poResponse.data || []);
            setPos(poList.filter(p => p.status !== 'DELETED'));
            
            const grnList = Array.isArray(grnResponse) ? grnResponse : (grnResponse.data || []);
            setChallans(grnList.filter(c => c.status !== 'DELETED'));
        } catch (error) {
            console.error("Error fetching supplier data:", error);
        }
    };

    const filteredChallans = React.useMemo(() => {
        const baseChallans = Array.isArray(challans) ? challans : [];
        const selectedGrnIds = (formData.grn_ids || []).map(id => id.toString());

        if (!formData.po_id && !formData.po_number) return baseChallans;
        
        const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const searchPONumber = normalize(formData.po_number);

        return baseChallans.filter(c => {
            const grnPoNumber = normalize(c.poNumber);
            return (searchPONumber && grnPoNumber === searchPONumber) || 
                   (formData.po_id && (String(c.poId) === String(formData.po_id))) ||
                   selectedGrnIds.includes(c.id.toString());
        });
    }, [challans, formData.po_id, formData.po_number, formData.grn_ids]);

    const handleChallanChange = async (selectedGrnIds) => {
        if (!selectedGrnIds || selectedGrnIds.length === 0) {
            const supplier = suppliers.find(s => s.id === parseInt(formData.supplier_id));
            const defaultCreditDays = supplier ? (supplier.supplierCreditDays || supplier.creditDays || 0) : 0;
            setFormData(prev => ({ 
                ...prev, 
                grn_ids: [],
                po_id: '',
                po_number: '',
                po_date: '',
                credit_days: defaultCreditDays
            }));
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
            
            // Auto-select PO if any of the selected GRNs have an associated PO
            let poFields = {};
            const selectedChallanObjects = (challans || []).filter(c => selectedGrnIds.map(String).includes(String(c.id)));
            const firstWithPo = selectedChallanObjects.find(c => c.poId || c.poNumber);
            if (firstWithPo) {
                const matchedPO = (pos || []).find(p => 
                    (firstWithPo.poId && String(p.id) === String(firstWithPo.poId)) ||
                    (firstWithPo.poNumber && String(p.poNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === String(firstWithPo.poNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
                );
                if (matchedPO) {
                    try {
                        const poDetails = await purchaseOrderService.getPurchaseOrderById(matchedPO.id);
                        poFields = {
                            po_id: poDetails.id,
                            po_number: poDetails.poNumber,
                            po_date: poDetails.poCreationDate?.split('T')[0] || '',
                            credit_days: poDetails.creditDays !== undefined && poDetails.creditDays !== null ? poDetails.creditDays : undefined
                        };
                    } catch (e) {
                        console.error("Error fetching matching PO details:", e);
                        poFields = {
                            po_id: matchedPO.id,
                            po_number: matchedPO.poNumber,
                            po_date: matchedPO.poCreationDate?.split('T')[0] || '',
                            credit_days: matchedPO.creditDays !== undefined && matchedPO.creditDays !== null ? matchedPO.creditDays : undefined
                        };
                    }
                }
            }

            // Merge logic
            const productMap = {};
            grns.forEach(grn => {
                if (grn && grn.items) {
                    grn.items.forEach(item => {
                        const pid = item.productId;
                        const itemDiscAmt = parseFloat(item.discountAmount || item.discountAmt) || 0;
                        const itemQty = parseFloat(item.receivedQty || item.quantity) || 0;
                        const itemRate = parseFloat(item.rate) || 0;
                        const itemGross = itemQty * itemRate;

                        if (!productMap[pid]) {
                            productMap[pid] = {
                                id: Date.now() + Math.random(),
                                productId: item.productId,
                                productCode: item.productCode,
                                productName: item.productName,
                                quantity: itemQty,
                                totalGross: itemGross, // Use this for weighted average rate
                                uom: item.uom,
                                hsnCode: item.hsnCode || '',
                                taxPercent: item.taxPercent !== undefined && item.taxPercent !== null ? item.taxPercent : 18,
                                totalPoQty: item.totalPoQty || 0,
                                discountAmount: itemDiscAmt,
                                beforeTaxAmount: 0, 
                                taxAmount: 0,
                                totalAmount: 0,
                                printDescription: item.printDescription || item.print_description || item.productName || '',
                                originalPrintDescription: item.printDescription || item.print_description || item.productName || ''
                            };
                        } else {
                            productMap[pid].quantity += itemQty;
                            productMap[pid].totalGross += itemGross;
                            productMap[pid].discountAmount += itemDiscAmt;
                        }
                    });
                }
            });

            const mergedItems = Object.values(productMap).map(item => {
                const quantity = item.quantity;
                const totalGross = item.totalGross;
                const discAmt = item.discountAmount;
                const taxPct = item.taxPercent;
                
                // Calculate weighted average rate and percent
                const rate = quantity > 0 ? (totalGross / quantity) : 0;
                const discPercent = totalGross > 0 ? (discAmt / totalGross) * 100 : 0;
                
                const beforeTax = totalGross - discAmt;
                const taxAmt = (beforeTax * taxPct) / 100;
                
                return {
                    ...item,
                    rate: parseFloat(rate.toFixed(2)),
                    discountPercent: parseFloat(discPercent.toFixed(2)),
                    beforeTaxAmount: parseFloat(beforeTax.toFixed(2)),
                    taxAmount: parseFloat(taxAmt.toFixed(2)),
                    totalAmount: parseFloat((beforeTax + taxAmt).toFixed(2))
                };
            });

            setItems(mergedItems.length > 0 ? mergedItems : [{ 
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0, 
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0, 
                taxAmount: 0, totalAmount: 0, printDescription: '', totalPoQty: 0, receivedPoQty: 0, remainingQty: 0 
            }]);

            setFormData(prev => {
                let mergedCreditDays = prev.credit_days;
                if (poFields.credit_days !== undefined) {
                    mergedCreditDays = poFields.credit_days;
                } else if (grns.length > 0 && grns[0].creditDays !== undefined && grns[0].creditDays !== null) {
                    mergedCreditDays = grns[0].creditDays;
                }
                
                return { 
                    ...prev, 
                    ...poFields,
                    credit_days: mergedCreditDays,
                    grn_ids: selectedGrnIds,
                    challan_date: grns.reduce((latest, g) => {
                        const gDate = g.grnDate || g.bookingDate;
                        if (!latest || (gDate && gDate > latest)) return gDate?.split('T')[0];
                        return latest;
                    }, '')
                };
            });
        } catch (error) {
            console.error("Error fetching GRN details:", error);
            toast.error("Failed to fetch challan details");
        }
    };

    const handlePOChange = async (poId) => {
        if (!poId) {
            const supplier = suppliers.find(s => s.id === parseInt(formData.supplier_id));
            const defaultCreditDays = supplier ? (supplier.supplierCreditDays || supplier.creditDays || 0) : 0;
            setFormData(prev => ({ 
                ...prev, 
                po_id: '', 
                po_number: '', 
                po_date: '',
                grn_ids: [],
                credit_days: defaultCreditDays
            }));
            const resetItems = items.map(p => ({
                ...p,
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
            const poDateVal = poDetails.poCreationDate?.split('T')[0] || '';

            // Find matching challans from challans list
            const matchingChallans = (challans || []).filter(c => 
                (c.poId && String(c.poId) === String(poDetails.id)) ||
                (c.poNumber && String(c.poNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === String(poDetails.poNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
            );

            if (matchingChallans.length > 0) {
                const matchingGrnIds = matchingChallans.map(c => c.id);
                // Fetch all matching GRNs
                const grns = await Promise.all(matchingGrnIds.map(id => grnService.getGRNById(id)));
                
                // Merge logic
                const productMap = {};
                grns.forEach(grn => {
                    if (grn && grn.items) {
                        grn.items.forEach(item => {
                            const pid = item.productId;
                            const itemDiscAmt = parseFloat(item.discountAmount || item.discountAmt) || 0;
                            const itemQty = parseFloat(item.receivedQty || item.quantity) || 0;
                            const itemRate = parseFloat(item.rate) || 0;
                            const itemGross = itemQty * itemRate;

                            if (!productMap[pid]) {
                                productMap[pid] = {
                                    id: Date.now() + Math.random(),
                                    productId: item.productId,
                                    productCode: item.productCode,
                                    productName: item.productName,
                                    quantity: itemQty,
                                    totalGross: itemGross, // Use this for weighted average rate
                                    uom: item.uom,
                                    hsnCode: item.hsnCode || '',
                                    taxPercent: item.taxPercent !== undefined && item.taxPercent !== null ? item.taxPercent : 18,
                                    totalPoQty: item.totalPoQty || 0,
                                    discountAmount: itemDiscAmt,
                                    beforeTaxAmount: 0, 
                                    taxAmount: 0,
                                    totalAmount: 0,
                                    printDescription: item.printDescription || item.print_description || item.productName || '',
                                    originalPrintDescription: item.printDescription || item.print_description || item.productName || ''
                                };
                            } else {
                                productMap[pid].quantity += itemQty;
                                productMap[pid].totalGross += itemGross;
                                productMap[pid].discountAmount += itemDiscAmt;
                            }
                        });
                    }
                });

                const mergedItems = Object.values(productMap).map(item => {
                    const quantity = item.quantity;
                    const totalGross = item.totalGross;
                    const discAmt = item.discountAmount;
                    const taxPct = item.taxPercent;
                    
                    const rate = quantity > 0 ? (totalGross / quantity) : 0;
                    const discPercent = totalGross > 0 ? (discAmt / totalGross) * 100 : 0;
                    
                    const beforeTax = totalGross - discAmt;
                    const taxAmt = (beforeTax * taxPct) / 100;
                    
                    return {
                        ...item,
                        rate: parseFloat(rate.toFixed(2)),
                        discountPercent: parseFloat(discPercent.toFixed(2)),
                        beforeTaxAmount: parseFloat(beforeTax.toFixed(2)),
                        taxAmount: parseFloat(taxAmt.toFixed(2)),
                        totalAmount: parseFloat((beforeTax + taxAmt).toFixed(2))
                    };
                });

                setItems(mergedItems.length > 0 ? mergedItems : [{ 
                    id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0, 
                    uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0, 
                    taxAmount: 0, totalAmount: 0, printDescription: '', totalPoQty: 0, receivedPoQty: 0, remainingQty: 0 
                }]);

                const latestChallanDate = grns.reduce((latest, g) => {
                    const gDate = g.grnDate || g.bookingDate;
                    if (!latest || (gDate && gDate > latest)) return gDate?.split('T')[0];
                    return latest;
                }, '');

                setFormData(prev => ({ 
                    ...prev, 
                    po_id: poDetails.id, 
                    po_number: poDetails.poNumber,
                    po_date: poDateVal,
                    credit_days: poDetails.creditDays !== undefined && poDetails.creditDays !== null ? poDetails.creditDays : prev.credit_days,
                    grn_ids: matchingGrnIds,
                    challan_date: latestChallanDate
                }));
            } else {
                setFormData(prev => ({ 
                    ...prev, 
                    po_id: poDetails.id, 
                    po_number: poDetails.poNumber,
                    po_date: poDateVal,
                    credit_days: poDetails.creditDays !== undefined && poDetails.creditDays !== null ? poDetails.creditDays : prev.credit_days,
                    grn_ids: [] // Clear previously selected GRNs when PO changes
                }));

                const poItems = await Promise.all(poDetails.items.map(async (item) => {
                    const quantity = item.quantity || 0;
                    const rate = item.rate || 0;
                    const discAmt = item.discountAmount || item.discountAmt || 0;
                    const taxPct = item.taxPercent || 0;
                    const discPct = item.discountPercent || 0;

                    // Fetch received count for this product & supplier from GRN history
                    let receivedCount = item.receivedQty || 0;
                    try {
                       const history = await grnService.getReceivedQty(formData.supplier_name, item.productCode || item.product_code, poDetails.poNumber);
                       receivedCount = history.receivedPoQty;
                    } catch (e) {
                       console.error("Failed to fetch received history", e);
                    }

                    const remainingInPO = quantity - receivedCount;
                    const effectiveQty = remainingInPO > 0 ? remainingInPO : 0;
                    const baseAmount = effectiveQty * rate;

                    // Recalculate discount amount based on percentage or proportionally
                    let currentDiscAmt = 0;
                    if (discPct > 0) {
                        currentDiscAmt = parseFloat(((baseAmount * discPct) / 100).toFixed(2));
                    } else if (quantity > 0 && discAmt > 0) {
                        // Proportional scaling if only amount is provided
                        currentDiscAmt = parseFloat(((discAmt / quantity) * effectiveQty).toFixed(2));
                    }

                    const befTax = baseAmount - currentDiscAmt;
                    const taxAmt = (befTax * taxPct) / 100;
                    return {
                        id: Date.now() + Math.random(),
                        productId: item.productId,
                        productCode: item.productCode,
                        productName: item.productName,
                        quantity: effectiveQty,
                        rate: Number(item.rate) || 0,
                        uom: item.uom,
                        discountAmount: currentDiscAmt,
                        discountPercent: item.discountPercent || 0,
                        hsnCode: item.hsnCode || '',
                        taxPercent: taxPct,
                        beforeTaxAmount: befTax,
                        taxAmount: taxAmt,
                        totalAmount: befTax + taxAmt,
                        printDescription: item.printDescription || item.print_description || item.productName || '',
                        originalPrintDescription: item.printDescription || item.print_description || item.productName || '',
                        totalPoQty: quantity,
                        receivedPoQty: receivedCount,
                        remainingQty: 0
                    };
                }));
                setItems(poItems);
            }
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

        const isoDocDate = toIsoDate(formData.document_date);
        if (!isoDocDate) {
            newErrors.document_date = "Invoice date is required";
        } else {
            const today = new Date().toISOString().split('T')[0];
            const hasPO = !!formData.po_id;
            const hasGRN = !!(formData.grn_ids && formData.grn_ids.length > 0);

            if (hasPO && hasGRN) {
                // Condition 1B: PO + GRN exists
                // Supplier Invoice Date allowed from: Last GRN Date for that Supplier → Till Today
                // Validation Message: Supplier Invoice Date must be between Last GRN Date and Current Date.
                const lastGrnDate = formData.challan_date;
                if (isoDocDate > today || (lastGrnDate && isoDocDate < lastGrnDate)) {
                    newErrors.document_date = "Supplier Invoice Date must be between Last GRN Date and Current Date.";
                }
            } else if (hasPO && !hasGRN) {
                // Condition 1C: Direct Invoice Against PO (Without GRN)
                // Supplier Invoice Date allowed from: PO Date → Till Today
                // Validation Message: Supplier Invoice Date must be between PO Date and Current Date.
                const poDate = formData.po_date;
                if (isoDocDate > today || (poDate && isoDocDate < poDate)) {
                    newErrors.document_date = "Supplier Invoice Date must be between PO Date and Current Date.";
                }
            } else if (!hasPO && hasGRN) {
                // Condition 2B: GRN Created Without PO
                // Supplier Invoice Date allowed from: GRN Date → Till Today
                // Validation Message: Supplier Invoice Date must be between GRN Date and Current Date.
                const grnDate = formData.challan_date;
                if (isoDocDate > today || (grnDate && isoDocDate < grnDate)) {
                    newErrors.document_date = "Supplier Invoice Date must be between GRN Date and Current Date.";
                }
            } else {
                // Condition 3: Direct Purchase Invoice Without PO and Without GRN
                // Supplier Invoice Date allowed from: Financial Year Start Date → Till Today
                // Validation Message: Supplier Invoice Date must be between Financial Year Start and Current Date.
                const fyStart = getFinancialYearStart();
                if (isoDocDate > today || isoDocDate < fyStart) {
                    newErrors.document_date = "Supplier Invoice Date must be between Financial Year Start and Current Date.";
                }
            }
        }

        const validItems = items.filter(item => item.productId || item.productCode);
        if (validItems.length === 0) {
            newErrors.items = "At least one product is required";
        } else {
            const itemErrors = [];
            items.forEach((item, index) => {
                if (item.productId || item.productCode) {
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

        if (Object.keys(newErrors).length > 0) {
            if (newErrors.document_date) {
                toast.error(newErrors.document_date);
            } else if (newErrors.supplier_name) {
                toast.error(newErrors.supplier_name);
            } else if (newErrors.supplier_invoice_number) {
                toast.error(newErrors.supplier_invoice_number);
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
            const validItems = items.filter(i => i.productId || i.productCode);
            const gstResult = determinePurchaseGst(formData.gst_no, companyInfo?.gstNumber || "", companyInfo?.state || "", formData.supplier_state, 0, 0, 0);
            
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
            // Material + Expenses + Tax
            const grandTotal = materialTotal + expenseTotal + taxInGrandTotal;

            const payload = {
                supplierId: formData.supplier_id ? formData.supplier_id.toString() : '0',
                supplierName: formData.supplier_name,
                address: formData.address,
                gstNumber: formData.gst_no,
                isRcm: false,
                creditDays: Number(formData.credit_days),
                poIds: formData.po_id ? [formData.po_id.toString()] : [],
                challanNumbers: formData.grn_ids.map(id => id.toString()),
                supplierInvoiceNumber: formData.supplier_invoice_number,
                invoiceNumber: formData.document_number,
                invoiceDate: toIsoDate(formData.document_date),
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
                    discount: Number(i.discountAmount) || 0,
                    taxPercent: gstResult.gstType !== 'NONE' ? (parseFloat(i.taxPercent) || 0) : 0,
                    taxAmount: gstResult.gstType !== 'NONE' ? (parseFloat(i.taxAmount) || 0) : 0,
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

            const finalPayload = {
                ...payload,
                removeAttachment: formData.removeAttachment
            };

            const fileToUpload = (formData.attachment instanceof File) ? formData.attachment : null;

            if (isEditMode) {
                await purchaseInvoiceService.updateInvoice(id, finalPayload, fileToUpload);
                toast.success("Purchase Invoice updated successfully");
            } else {
                await purchaseInvoiceService.createInvoice(finalPayload, fileToUpload);
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
        navigate(`/seller/masters/product-master/add?redirect=${encodeURIComponent(redirect + (redirect.includes('?') ? '&' : '?') + 'restore=true')}`);
    };

    const handleAddNewSupplier = () => {
        sessionStorage.setItem('add_pi_draft', JSON.stringify({ formData, items, expenses }));
        sessionStorage.setItem('add_pi_supplier_ids', JSON.stringify(suppliers.map(s => s.id)));
        navigate(`/seller/masters/account-master/add?redirect=${encodeURIComponent(ROUTES.PURCHASE_INVOICE_ADD + '?restore=true')}`);
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
                    <h2 className="text-[20px] font-bold text-[#111827]">{isEditMode ? t('common:edit_purchase_invoice', 'Edit Purchase Invoice') : t('common:add_purchase_invoice', 'Add Purchase Invoice')}</h2>
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} /> {t('common:back')}
                    </button>
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    {(() => {
                        const hasPO = !!formData.po_id;
                        const hasGRN = !!(formData.grn_ids && formData.grn_ids.length > 0);
                        const today = new Date().toISOString().split('T')[0];
                        
                        let minDate = getFinancialYearStart();
                        if (hasPO && hasGRN) {
                            minDate = formData.challan_date || getFinancialYearStart();
                        } else if (hasPO && !hasGRN) {
                            minDate = formData.po_date || getFinancialYearStart();
                        } else if (!hasPO && hasGRN) {
                            minDate = formData.challan_date || getFinancialYearStart();
                        }

                        return (
                            <GRNForm 
                                formData={formData}
                                setFormData={setFormData}
                                handleSupplierChange={handleSupplierChange}
                                handlePOChange={handlePOChange}
                                handleChallanChange={handleChallanChange}
                                suppliers={suppliers}
                                pos={pos}
                                challans={filteredChallans}
                                errors={errors}
                                challanDateRef={challanDateRef}
                                type="Invoice"
                                onAddSupplier={handleAddNewSupplier}
                                minDate={minDate}
                                maxDate={today}
                                isDocumentDateReadOnly={false}
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
                        type="Invoice"
                        isPoSelected={!!formData.po_id || (formData.grn_ids && formData.grn_ids.length > 0)}
                        poNumber={formData.po_number}
                        linkedPoItems={items}
                        gstType={gstType}
                        supplierName={formData.supplier_name}
                        isGrnSelected={formData.grn_ids && formData.grn_ids.length > 0}
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

                <div className="p-8 flex items-center gap-6 border-t border-[#F3F4F6]">
                    <span className="text-[15px] font-bold text-[#374151]">{t('modules:upload_purchase_invoice')} :</span>
                    <div className="flex items-center gap-3">
                        <label className="relative cursor-pointer px-6 h-[44px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all flex items-center justify-center gap-2 shadow-sm group active:scale-95">
                            {formData.attachment ? (
                                <span className="flex items-center gap-2">
                                    <FileText size={18} />
                                    <span className="max-w-[200px] truncate">
                                        {typeof formData.attachment === 'string' ? t('modules:existing_invoice', 'Existing Invoice') : formData.attachment.name}
                                    </span>
                                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-emerald-100">{t('common:change')}</span>
                                </span>
                            ) : (
                                <>
                                    <FileText size={18} />
                                    <span>{t('modules:upload_purchase_invoice')}</span>
                                </>
                            )}
                            <input 
                                type="file" 
                                className="hidden" 
                                onChange={(e) => setFormData({...formData, attachment: e.target.files[0], removeAttachment: false})} 
                                accept="application/pdf,image/jpeg,image/png" 
                            />
                        </label>

                        {formData.attachment && (
                            <div className="flex items-center gap-2">
                                <div className="relative group/preview">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (previewUrl) {
                                                window.open(previewUrl, '_blank');
                                            }
                                        }}
                                        className="p-2.5 bg-blue-50 text-blue-600 rounded-[10px] hover:bg-blue-100 transition-all shadow-sm border border-blue-100"
                                        title="View Invoice (Hover to preview, Click to open in new tab)"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    {previewUrl && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover/preview:flex flex-col w-[380px] h-[480px] bg-white border border-gray-200 rounded-[16px] shadow-[0_10px_30px_rgba(0,0,0,0.15)] z-[100] p-3 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none">
                                            <div className="text-[12px] font-bold text-gray-500 mb-2 border-b pb-1.5 flex items-center justify-between">
                                                <span>{t('modules:invoice_preview', 'Invoice Preview')}</span>
                                                <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-black uppercase">{t('modules:live_view', 'Live View')}</span>
                                            </div>
                                            <div className="flex-1 w-full bg-gray-50 rounded-[8px] overflow-hidden border border-gray-100">
                                                {typeof formData.attachment === 'string' || (formData.attachment instanceof File && formData.attachment.type?.includes('pdf')) ? (
                                                    <iframe
                                                        src={`${previewUrl}#toolbar=0&navpanes=0`}
                                                        className="w-full h-full border-none"
                                                        title="Invoice File Preview"
                                                    />
                                                ) : (
                                                    <img
                                                        src={previewUrl}
                                                        alt="Invoice Preview"
                                                        className="w-full h-full object-contain"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({...formData, attachment: null, removeAttachment: true})}
                                    className="p-2.5 bg-red-50 text-red-500 rounded-[10px] hover:bg-red-100 transition-all shadow-sm border border-red-100"
                                    title="Remove Invoice"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-8 py-6 border-t border-[#F3F4F6] bg-gray-50 flex justify-end gap-4">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] shadow-[0_4px_15px_rgba(7,51,24,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {t('modules:save_invoice', 'Save Invoice')}
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

export default AddPurchaseInvoice;
