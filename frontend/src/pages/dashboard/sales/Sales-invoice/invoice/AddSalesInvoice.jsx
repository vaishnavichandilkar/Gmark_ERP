// Updated at: 2026-04-17T13:48:00
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ArrowLeft, RefreshCw, Save, CheckCircle2, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { determineSalesGst } from '@/utils/gstUtils';

import salesInvoiceService from '@/services/salesInvoiceService';
import salesOrderService from '@/services/salesOrderService';
import challanService from '@/services/challanService';
import accountService from '@/services/accountService';
import productService from '@/services/productService';
import { getProfileApi } from '@/services/authService';

import InvoiceForm from './components/InvoiceForm';
import InvoiceTable from './components/InvoiceTable';
import AccountTable from '../challan/components/AccountTable';

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

const AddSalesInvoice = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const shouldRestore = queryParams.get('restore') === 'true';
    const isEditMode = Boolean(id);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sos, setSos] = useState([]);
    const [challans, setChallans] = useState([]);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [businessProfile, setBusinessProfile] = useState(null);
    const [gstType, setGstType] = useState({ type: 'INTRA', applicable: true, isRcm: false });

    // Refs for date pickers
    const bookingDateRef = useRef(null);
    const invoiceDateRef = useRef(null);

    const [formData, setFormData] = useState({
        customerId: '',
        customerName: '',
        address: '',
        gstNo: '',
        creditDays: 0,
        soId: '',
        soNumber: '',
        challanIds: [],
        customerInvoiceNumber: '',
        customerInvoiceDate: '',
        bookingDate: new Date().toISOString().split('T')[0],
    });

    const [items, setItems] = useState([{
        id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
        uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0,
        taxAmount: 0, totalAmount: 0, printDescription: ''
    }]);

    const [expenses, setExpenses] = useState([]);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [custRes, prodRes, profileRes, nextNumRes, bizProfileRes] = await Promise.all([
                    salesInvoiceService.getCustomers(),
                    productService.getProducts({ limit: 1000 }),
                    getProfileApi(),
                    !isEditMode ? salesInvoiceService.getNextNumber() : Promise.resolve(null),
                    accountService.getBusinessProfile().catch(e => {
                        console.error("Error fetching business profile:", e);
                        return null;
                    })
                ]);

                const custData = custRes || [];
                setCustomers(custData);
                setProducts(prodRes.products || []);
                setBusinessProfile(bizProfileRes);
                setCompanyInfo({
                    ...profileRes?.shopDetail,
                    gstNumber: profileRes?.gstNumber
                });

                if (nextNumRes && !isEditMode) {
                    setFormData(prev => ({
                        ...prev,
                        customerInvoiceNumber: nextNumRes.nextCustomerInvoiceNumber || prev.customerInvoiceNumber
                    }));
                }

                if (isEditMode) {
                    const invoice = await salesInvoiceService.getInvoiceById(id);
                    const soNum = invoice.soNumber || (invoice.soNumbers && Array.isArray(invoice.soNumbers) ? invoice.soNumbers[0] : null);

                    // Fetch SOs and Challans for the customer (Strictly filter challans by SO if present)
                    const [soData, challanList] = await Promise.all([
                        salesInvoiceService.getCustomerSOs(invoice.customerName, id),
                        challanService.getCustomerChallans(invoice.customerName, soNum, id)
                    ]);

                    // Robust SO restoration: prioritizes backend-provided soNumber/soId
                    let finalSos = [...(soData || [])];
                    let restoredSoId = invoice.soId;
                    
                    const isSoInList = finalSos.find(s => 
                        (restoredSoId && String(s.id) === String(restoredSoId)) || 
                        (soNum && String(s.soNumber).trim() === String(soNum).trim())
                    );

                    if (!isSoInList && (restoredSoId || soNum)) {
                        const tempId = restoredSoId || (soNum ? `temp-so-${soNum}` : `temp-so-${Date.now()}`);
                        finalSos.push({ 
                            id: tempId, 
                            soNumber: soNum || 'Current SO',
                            items: invoice.items || []
                        });
                        if (!restoredSoId) restoredSoId = tempId;
                    }

                    // Robust Challan restoration: Use backend-resolved customerChallanIds if available
                    let finalChallans = [...(challanList || [])];
                    let matchedChallanIds = invoice.customerChallanIds || [];

                    // Fallback reconstruction if backend IDs are missing but numbers exist
                    const savedChallanNumbers = (invoice.challanNumber || "")
                        .split(',').map(n => String(n).trim()).filter(Boolean);
                    
                    if (matchedChallanIds.length === 0 && savedChallanNumbers.length > 0) {
                        savedChallanNumbers.forEach(num => {
                            const existing = finalChallans.find(c => String(c.challanNumber).trim().toLowerCase() === num.toLowerCase());
                            if (existing) {
                                matchedChallanIds.push(existing.id);
                            } else {
                                const tempId = `temp-ch-${num}`;
                                finalChallans.push({ id: tempId, challanNumber: num, bookingDate: new Date().toISOString(), grandTotal: 0 });
                                matchedChallanIds.push(tempId);
                            }
                        });
                    }

                    setSos(finalSos);
                    setChallans(finalChallans);

                    // Find customer in loaded data to get type
                    const foundCustomer = (custData || []).find(c => String(c.id) === String(invoice.customerId) || c.accountName === invoice.customerName);

                    setFormData({
                        customerId: invoice.customerId,
                        customerName: invoice.customerName,
                        customerType: invoice.customerType || foundCustomer?.customerType || foundCustomer?.accountType || '',
                        address: invoice.address,
                        gstNo: invoice.gstNumber || '',
                        creditDays: invoice.creditDays || 0,
                        soId: restoredSoId || '',
                        soNumber: soNum || '',
                        challanIds: matchedChallanIds,
                        customerInvoiceNumber: invoice.customerInvoiceNumber,
                        customerInvoiceDate: invoice.customerInvoiceDate?.split('T')[0],
                        bookingDate: invoice.bookingDate?.split('T')[0] || new Date().toISOString().split('T')[0],
                    });

                    // MODULE: Load existing GST Type from saved data if available
                    if (invoice.igstAmount > 0) {
                        setGstType({ type: 'INTER', applicable: true, isRcm: invoice.isRcm });
                    } else if (invoice.cgstAmount > 0 || invoice.sgstAmount > 0) {
                        setGstType({ type: 'INTRA', applicable: true, isRcm: invoice.isRcm });
                    } else {
                        // Fallback to calculation if amounts are zero or not set
                        setGstType(determineSalesGst(companyInfo?.gstNumber, invoice.gstNumber || '', companyInfo?.state || "", foundCustomer?.state || '', 0, 0, 0));
                    }

                    setItems(invoice.items.map(item => ({
                        ...item,
                        id: item.id || Date.now() + Math.random(),
                        printDescription: item.printDescription || item.productName || "",
                        originalPrintDescription: item.printDescription || item.productName || ""
                    })));

                    setExpenses(invoice.expenses?.map(e => ({
                        id: e.id || Date.now() + Math.random(),
                        groupName: e.groupName,
                        amount: e.amount,
                        isGstApplicable: e.isGstApplicable,
                        taxRate: e.taxRate,
                        isPostGst: e.isPostGst !== undefined ? e.isPostGst : !e.isGstApplicable
                    })) || []);

                    // Fetch customer-specific data for dropdowns
                    try {
                        const [soData, challanData] = await Promise.all([
                            salesInvoiceService.getCustomerSOs(invoice.customerName, id),
                            challanService.getCustomerChallans(invoice.customerName, '', id)
                        ]);
                        setSos(soData || []);
                        setChallans(challanData || []);
                    } catch (e) {
                        console.error("Error fetching edit mode dropdown data:", e);
                    }
                }

                // Global Restore (for both Add and Edit when coming back from preview)
                if (shouldRestore || (!isEditMode && sessionStorage.getItem('add_si_draft'))) {
                    const draftStr = sessionStorage.getItem('add_si_draft');
                    if (draftStr) {
                         const draft = JSON.parse(draftStr);
                         setFormData(prev => ({ ...prev, ...draft.formData }));
                         setItems(draft.items);
                         setExpenses(draft.expenses);
                         if (shouldRestore) toast.success("Form data restored from preview");
                    }
                }
            } catch (error) {
                console.error("Error fetching setup data:", error);
                toast.error("Failed to load initial data");
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [id, isEditMode]);

    // Auto-update GST Type whenever customer or company info changes
    useEffect(() => {
        if (formData.customerId && companyInfo) {
            const customer = customers.find(c => c.id === formData.customerId);
            if (customer) {
                setGstType(determineSalesGst(companyInfo?.gstNumber, customer.gstNo || "", companyInfo?.state || "", customer.state || "", 0, 0, 0));
            }
        } else if (!formData.customerId && companyInfo) {
            setGstType({ type: 'INTRA', applicable: true, isRcm: false });
        }
    }, [formData.customerId, companyInfo, customers]);

    const isSellerMsme = useMemo(() => {
        if (!businessProfile) return false;
        const isSellerMsmeActive = (businessProfile.sellerDocuments || []).some(
            d => d.category === 'UDYOG_AADHAR' && d.name && d.name.trim() !== '' && d.name.trim().toUpperCase() !== 'N/A'
        );
        const isSellerMsmeType = businessProfile.regType === "Manufacturing" || businessProfile.regType === "Service";
        return Boolean(isSellerMsmeActive && isSellerMsmeType);
    }, [businessProfile]);

    const [isCustomerMsmeUser, setIsCustomerMsmeUser] = useState(false);

    useEffect(() => {
        if (formData.customerId && customers.length > 0) {
            const currentCustomer = customers.find(c => String(c.id) === String(formData.customerId));
            if (currentCustomer) {
                setIsCustomerMsmeUser(Boolean(currentCustomer.isMsmeUser));
            } else {
                setIsCustomerMsmeUser(false);
            }
        } else {
            setIsCustomerMsmeUser(false);
        }
    }, [formData.customerId, customers]);

    useEffect(() => {
        if (isSellerMsme && formData.creditDays) {
            const val = parseInt(formData.creditDays, 10);
            if (!isNaN(val) && val > 45) {
                setFormData(prev => ({ ...prev, creditDays: 45 }));
                toast.error(
                    "As you are registered under MSME (Manufacturing/Service), maximum credit period allowed for customers is 45 days. Credit Days has been adjusted to 45.",
                    { id: "msme-customer-warning", duration: 6000 }
                );
            }
        }
    }, [formData.creditDays, isSellerMsme]);

    const handleCustomerChange = async (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const type = determineSalesGst(companyInfo?.gstNumber, customer.gstNo || "", companyInfo?.state || "", customer.state || "", 0, 0, 0);
        setGstType(type);

        const mappedAddress = [customer.addressLine1, customer.addressLine2, customer.city, customer.state].filter(Boolean).join(', ');

        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            customerName: customer.customerName || customer.accountName,
            customerType: customer.customerType || customer.accountType || 'industrial',
            address: mappedAddress || customer.address || '',
            gstNo: customer.gstNo || '',
            creditDays: customer.customerCreditDays || 0,
            customerState: customer.state || '',
            challanIds: []
        }));
        setIsCustomerMsmeUser(Boolean(customer.isMsmeUser));

        try {
            // Fix: Use accountName instead of id because backend getCustomerSOs expects a name string
            const customerNameKey = customer.customerName || customer.accountName;
            const [soData, challanData] = await Promise.all([
                salesInvoiceService.getCustomerSOs(customerNameKey, id),
                challanService.getCustomerChallans(customerNameKey, '', id)
            ]);
            setSos(soData || []);
            setChallans(challanData || []);
        } catch (error) {
            console.error("Error fetching customer data:", error);
        }
    };
    const handleSOChange = async (soId) => {
        if (!soId) {
            const customer = customers.find(c => c.id === parseInt(formData.customerId));
            const defaultCreditDays = customer ? (customer.customerCreditDays || customer.creditDays || 0) : 0;
            setFormData(prev => ({
                ...prev,
                soId: '',
                soNumber: '',
                challanIds: [],
                creditDays: defaultCreditDays
            }));
            setItems([{
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0,
                taxAmount: 0, totalAmount: 0, printDescription: ''
            }]);
            setExpenses([]);
            return;
        }

        const selectedSO = sos.find(s => s.id === parseInt(soId));
        if (!selectedSO) return;

        // Find matching challans from challans list
        const matchingChallans = (challans || []).filter(c => 
            (c.soId && String(c.soId) === String(selectedSO.id)) ||
            (c.soNumber && String(c.soNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === String(selectedSO.soNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
        );

        if (matchingChallans.length > 0) {
            const matchingChallanIds = matchingChallans.map(c => c.id);
            try {
                const allItems = [];
                const allExpenses = [];

                for (const cid of matchingChallanIds) {
                    const challanResponse = await challanService.getChallanById(cid);
                    const challan = challanResponse.data ? challanResponse.data : challanResponse;

                    if (challan) {
                        if (challan.items) {
                            for (const item of challan.items) {
                                const product = products.find(p => p.id === item.productId || p.product_code === item.productCode);
                                const printDesc = item.printDescription || item.print_description || item.description || item.productName || '';
                                allItems.push({
                                    ...item,
                                    id: Date.now() + Math.random(),
                                    quantity: item.challanQty || item.quantity || 0,
                                    totalSoQty: item.challanQty || item.quantity || 0,
                                    hsnCode: item.hsnCode || product?.hsn_code || product?.hsnCode || '',
                                    taxPercent: (item.taxPercent !== undefined && item.taxPercent !== null && item.taxPercent !== '') 
                                        ? parseFloat(item.taxPercent) 
                                        : parseFloat(product?.tax_rate || product?.taxRate || 0),
                                    challanId: cid,
                                    challanNumber: challan.challanNumber,
                                    printDescription: printDesc,
                                    originalPrintDescription: printDesc,
                                });
                            }
                        }

                        if (challan.expenses) {
                            for (const exp of challan.expenses) {
                                allExpenses.push({
                                    id: Date.now() + Math.random(),
                                    groupName: exp.groupName,
                                    amount: exp.amount,
                                    isGstApplicable: exp.isGstApplicable,
                                    taxRate: exp.taxRate,
                                    isPostGst: exp.isPostGst,
                                    challanId: cid
                                });
                            }
                        }
                    }
                }

                setItems(allItems.length > 0 ? allItems : [{
                    id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
                    uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0,
                    taxAmount: 0, totalAmount: 0, printDescription: ''
                }]);
                setExpenses(allExpenses);

                setFormData(prev => ({
                    ...prev,
                    soId: selectedSO.id,
                    soNumber: selectedSO.soNumber,
                    creditDays: selectedSO.creditDays !== undefined && selectedSO.creditDays !== null ? selectedSO.creditDays : prev.creditDays,
                    challanIds: matchingChallanIds
                }));
            } catch (error) {
                console.error("Error loading matching challan details:", error);
                toast.error("Failed to load challan details");
            }
        } else {
            setFormData(prev => ({
                ...prev,
                soId: selectedSO.id,
                soNumber: selectedSO.soNumber,
                creditDays: selectedSO.creditDays !== undefined && selectedSO.creditDays !== null ? selectedSO.creditDays : prev.creditDays,
                challanIds: [] // Clear previously selected challans when SO changes
            }));

            const mappedItems = selectedSO.items.map(item => {
                const qty = item.remainingQty || item.quantity;
                const rate = item.rate || 0;
                const discAmt = item.discountAmount || 0;
                const taxPct = item.taxPercent || 0;
                
                const baseAmt = qty * rate;
                const befTax = Math.max(0, baseAmt - discAmt);
                const taxAmt = (befTax * taxPct) / 100;
                const totalAmt = befTax + taxAmt;

                const printDesc = item.printDescription || item.print_description || item.description || item.productName || '';
                return {
                    id: Date.now() + Math.random(),
                    productId: item.productId,
                    productCode: item.productCode,
                    productName: item.productName,
                    quantity: qty, 
                    totalSoQty: qty, 
                    rate: rate,
                    uom: item.uom,
                    hsnCode: item.hsnCode || '',
                    taxPercent: taxPct,
                    discountAmount: discAmt,
                    discountPercent: item.discountPercent || 0,
                    beforeTaxAmount: parseFloat(befTax.toFixed(2)),
                    taxAmount: parseFloat(taxAmt.toFixed(2)),
                    totalAmount: parseFloat(totalAmt.toFixed(2)),
                    printDescription: printDesc,
                    originalPrintDescription: printDesc,
                };
            });

            setItems(mappedItems);
            setExpenses([]);
        }
    };

    const handleChallanChange = async (selectedIds) => {
        if (!selectedIds || selectedIds.length === 0) {
            const customer = customers.find(c => c.id === parseInt(formData.customerId));
            const defaultCreditDays = customer ? (customer.customerCreditDays || customer.creditDays || 0) : 0;
            setFormData(prev => ({ 
                ...prev, 
                challanIds: [],
                soId: '',
                soNumber: '',
                creditDays: defaultCreditDays
            }));
            setItems([{
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0,
                taxAmount: 0, totalAmount: 0, printDescription: ''
            }]);
            setExpenses([]);
            return;
        }

        try {
            // Auto-select SO if any of the selected challans have an associated SO
            let soFields = {};
            const selectedChallanObjects = (challans || []).filter(c => selectedIds.map(String).includes(String(c.id)));
            const firstWithSo = selectedChallanObjects.find(c => c.soId || c.soNumber);
            if (firstWithSo) {
                const matchedSO = (sos || []).find(s => 
                    (firstWithSo.soId && String(s.id) === String(firstWithSo.soId)) ||
                    (firstWithSo.soNumber && String(s.soNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === String(firstWithSo.soNumber).replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
                );
                if (matchedSO) {
                    try {
                        const soDetails = await salesOrderService.getSalesOrderById(matchedSO.id);
                        soFields = {
                            soId: soDetails.id,
                            soNumber: soDetails.soNumber,
                            creditDays: soDetails.creditDays !== undefined && soDetails.creditDays !== null ? soDetails.creditDays : undefined
                        };
                    } catch (e) {
                        console.error("Error fetching matching SO details:", e);
                        soFields = {
                            soId: matchedSO.id,
                            soNumber: matchedSO.soNumber,
                            creditDays: matchedSO.creditDays !== undefined && matchedSO.creditDays !== null ? matchedSO.creditDays : undefined
                        };
                    }
                }
            }

            const allItems = [];
            const allExpenses = [];

            for (const cid of selectedIds) {
                const challanResponse = await challanService.getChallanById(cid);
                const challan = challanResponse.data ? challanResponse.data : challanResponse;

                if (challan) {
                    if (challan.items) {
                        for (const item of challan.items) {
                            // Find product in master for fallback HSN/Tax
                            const product = products.find(p => p.id === item.productId || p.product_code === item.productCode);
                            
                            const printDesc = item.printDescription || item.print_description || item.description || item.productName || '';
                            allItems.push({
                                ...item,
                                id: Date.now() + Math.random(),
                                quantity: item.challanQty || item.quantity || 0,
                                totalSoQty: item.challanQty || item.quantity || 0, // Set limit for Invoice based on Challan Qty
                                hsnCode: item.hsnCode || product?.hsn_code || product?.hsnCode || '',
                                taxPercent: (item.taxPercent !== undefined && item.taxPercent !== null && item.taxPercent !== '') 
                                    ? parseFloat(item.taxPercent) 
                                    : parseFloat(product?.tax_rate || product?.taxRate || 0),
                                challanId: cid,
                                challanNumber: challan.challanNumber,
                                printDescription: printDesc,
                                originalPrintDescription: printDesc,
                            });
                        }
                    }

                    if (challan.expenses) {
                        for (const exp of challan.expenses) {
                            allExpenses.push({
                                id: Date.now() + Math.random(),
                                groupName: exp.groupName,
                                amount: exp.amount,
                                isGstApplicable: exp.isGstApplicable,
                                taxRate: exp.taxRate,
                                isPostGst: exp.isPostGst,
                                challanId: cid
                            });
                        }
                    }
                }
            }
            setItems(allItems.length > 0 ? allItems : [{
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0,
                taxAmount: 0, totalAmount: 0, printDescription: ''
            }]);
            setExpenses(allExpenses);

            setFormData(prev => {
                let mergedCreditDays = prev.creditDays;
                if (soFields.creditDays !== undefined) {
                    mergedCreditDays = soFields.creditDays;
                } else {
                    // Try to get creditDays from the first valid challan
                    for (const cid of selectedIds) {
                        const challanResponse = challans.find(c => String(c.id) === String(cid));
                        if (challanResponse && challanResponse.creditDays !== undefined && challanResponse.creditDays !== null) {
                            mergedCreditDays = challanResponse.creditDays;
                            break;
                        }
                    }
                }
                
                return { 
                    ...prev, 
                    ...soFields,
                    creditDays: mergedCreditDays,
                    challanIds: selectedIds 
                };
            });
        } catch (error) {
            console.error("Error fetching challan details:", error);
            toast.error("Failed to load challan details");
        }
    };

    const handleSaveDraft = () => {
        const draft = { formData, items, expenses };
        sessionStorage.setItem('add_si_draft', JSON.stringify(draft));
    };

    const handleAddNewCustomer = () => {
        handleSaveDraft();
        navigate(`/seller/masters/account-master/add?redirect=${ROUTES.SALES_INVOICE_ADD}`);
    };

    const handleAddNewProduct = () => {
        handleSaveDraft();
        navigate(`/seller/masters/product-master/add?redirect=${ROUTES.SALES_INVOICE_ADD}`);
    };

    const validateForm = (currentItems) => {
        const itemsToValidate = currentItems || items;
        const newErrors = {};
        if (!formData.customerId) newErrors.customerName = "Customer is required";
        if (!formData.customerInvoiceNumber) newErrors.customerInvoiceNumber = "Invoice Number is required";
        const isoDocDate = toIsoDate(formData.customerInvoiceDate);
        if (!isoDocDate) {
            newErrors.customerInvoiceDate = "Invoice Date is required";
        } else {
            const invoiceDate = new Date(isoDocDate);
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            const hasChallan = formData.challanIds && formData.challanIds.length > 0;
            const hasSo = !!formData.soId;

            if (hasSo && hasChallan) {
                let latestChallanDate = null;
                const selectedChallans = challans.filter(c => formData.challanIds.includes(c.id));
                if (selectedChallans.length > 0) {
                    latestChallanDate = selectedChallans.reduce((latest, c) => {
                        const cDate = c.challanDate?.split('T')[0] || c.bookingDate?.split('T')[0];
                        return (!latest || cDate > latest) ? cDate : latest;
                    }, '');
                }

                if (latestChallanDate) {
                    const minDate = new Date(latestChallanDate);
                    minDate.setHours(0, 0, 0, 0);
                    const invOnlyDate = new Date(invoiceDate);
                    invOnlyDate.setHours(0, 0, 0, 0);

                    if (invOnlyDate < minDate || invoiceDate > today) {
                        newErrors.customerInvoiceDate = "Customer Invoice Date must be between Latest Challan Date and Current Date.";
                    }
                } else {
                    if (invoiceDate > today) {
                        newErrors.customerInvoiceDate = "Customer Invoice Date must be between Latest Challan Date and Current Date.";
                    }
                }
            } else if (hasSo && !hasChallan) {
                const selectedSO = sos.find(s => s.id === parseInt(formData.soId));
                if (selectedSO?.soCreationDate) {
                    const soDate = new Date(selectedSO.soCreationDate);
                    soDate.setHours(0, 0, 0, 0);
                    const invOnlyDate = new Date(invoiceDate);
                    invOnlyDate.setHours(0, 0, 0, 0);

                    if (invOnlyDate < soDate || invoiceDate > today) {
                        newErrors.customerInvoiceDate = "Customer Invoice Date must be between SO Date and Current Date.";
                    }
                } else {
                    if (invoiceDate > today) {
                        newErrors.customerInvoiceDate = "Customer Invoice Date must be between SO Date and Current Date.";
                    }
                }
            } else if (!hasSo && hasChallan) {
                let latestChallanDate = null;
                const selectedChallans = challans.filter(c => formData.challanIds.includes(c.id));
                if (selectedChallans.length > 0) {
                    latestChallanDate = selectedChallans.reduce((latest, c) => {
                        const cDate = c.challanDate?.split('T')[0] || c.bookingDate?.split('T')[0];
                        return (!latest || cDate > latest) ? cDate : latest;
                    }, '');
                }

                if (latestChallanDate) {
                    const minDate = new Date(latestChallanDate);
                    minDate.setHours(0, 0, 0, 0);
                    const invOnlyDate = new Date(invoiceDate);
                    invOnlyDate.setHours(0, 0, 0, 0);

                    if (invOnlyDate < minDate || invoiceDate > today) {
                        newErrors.customerInvoiceDate = "Customer Invoice Date must be between Challan Date and Current Date.";
                    }
                } else {
                    if (invoiceDate > today) {
                        newErrors.customerInvoiceDate = "Customer Invoice Date must be between Challan Date and Current Date.";
                    }
                }
            } else {
                const now = new Date();
                const fyStart = new Date(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(), 3, 1);
                fyStart.setHours(0, 0, 0, 0);
                const invOnlyDate = new Date(invoiceDate);
                invOnlyDate.setHours(0, 0, 0, 0);

                if (invOnlyDate < fyStart || invoiceDate > today) {
                    newErrors.customerInvoiceDate = "Customer Invoice Date must be within current financial year.";
                }
            }
        }

        if (!itemsToValidate || itemsToValidate.length === 0) {
            newErrors.items = "At least one product is required";
        } else {
            const hasValidProduct = itemsToValidate.some(item => item.productId);
            if (!hasValidProduct) {
                newErrors.items = "Please select at least one product from the dropdown list";
            }

            const itemErrors = itemsToValidate.map((item, idx) => {
                const errors = {};
                if (item.productId) {
                    if (!item.quantity || parseFloat(item.quantity) <= 0) errors.quantity = "Quantity must be greater than 0";
                    if (!item.rate || parseFloat(item.rate) <= 0) errors.rate = "Rate must be greater than 0";
                } else if (item.productName || item.productCode) {
                    errors.productId = "Please select this product from the search results";
                }
                return Object.keys(errors).length > 0 ? errors : null;
            });
            if (itemErrors.some(e => e)) {
                newErrors.itemErrors = itemErrors;
            }
        }

        setErrors(newErrors);
        return {
            isValid: Object.keys(newErrors).length === 0,
            errors: newErrors
        };
    };

    const filteredChallans = React.useMemo(() => {
        const baseChallans = Array.isArray(challans) ? challans : [];
        const selectedIdsStr = (formData.challanIds || []).map(id => id.toString());

        if (!formData.soNumber && !formData.soId) return baseChallans;

        const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const searchSONumber = normalize(formData.soNumber);

        return baseChallans.filter(c => {
            const challanSONumber = normalize(c.soNumber);
            const isMatch = (searchSONumber && challanSONumber === searchSONumber) ||
                           (formData.soId && parseInt(c.soId) === parseInt(formData.soId)) ||
                           selectedIdsStr.includes(String(c.id));
            return isMatch;
        });
    }, [challans, formData.soNumber, formData.soId, formData.challanIds]);

    const handleSave = async () => {
        // Attempt to auto-match any products that were typed but not selected
        const updatedItems = items.map((item, index) => {
            if (!item.productId && (item.productCode || item.productName)) {
                const match = products.find(p => 
                    (item.productCode && String(p.product_code).toLowerCase() === String(item.productCode).trim().toLowerCase()) || 
                    (item.productName && String(p.product_name).toLowerCase() === String(item.productName).trim().toLowerCase())
                );
                if (match) {
                    const rate = parseFloat(match.saleRate) || 0;
                    const taxPct = (parseFloat(match.tax_rate) || (match.hsn?.gst_rate ? parseFloat(match.hsn.gst_rate) : 0));
                    return {
                        ...item,
                        productId: match.id,
                        productCode: match.product_code,
                        productName: match.product_name,
                        hsnCode: match.hsn_code || match.hsn?.hsn_code || item.hsnCode,
                        taxPercent: taxPct,
                        rate: item.rate || rate,
                        printDescription: item.printDescription || match.product_name || "",
                        originalPrintDescription: item.printDescription || match.product_name || ""
                    };
                }
            }
            return item;
        });
        
        const hasChanges = JSON.stringify(updatedItems) !== JSON.stringify(items);
        if (hasChanges) {
            setItems(updatedItems);
            // We return and wait for the re-render or just use updatedItems for validation
        }

        const validation = validateForm(updatedItems);
        if (!validation.isValid) {
            if (validation.errors.customerInvoiceDate) {
                toast.error(validation.errors.customerInvoiceDate);
            } else {
                toast.error("Please fill all required fields correctly");
            }
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                invoiceDate: toIsoDate(formData.customerInvoiceDate), 
                customerInvoiceDate: toIsoDate(formData.customerInvoiceDate),
                bookingDate: toIsoDate(formData.bookingDate),
                invoiceNumber: formData.customerInvoiceNumber,
                customerId: parseInt(formData.customerId) || 0,
                soId: (formData.soId && formData.soId !== '') ? parseInt(formData.soId) : null,
                soNumbers: formData.soNumber ? [formData.soNumber] : [],
                challanNumbers: formData.challanIds ? formData.challanIds.map(id => id.toString()) : [],
                items: items.map(item => ({
                    productId: parseInt(item.productId) || 0,
                    productCode: item.productCode || '',
                    productName: item.productName || '',
                    quantity: parseFloat(item.quantity) || 0,
                    rate: parseFloat(item.rate) || 0,
                    uom: item.uom || 'Nos',
                    hsnCode: item.hsnCode || '',
                    taxPercent: gstType.applicable ? (parseFloat(item.taxPercent) || 0) : 0,
                    discountAmount: parseFloat(item.discountAmount) || 0,
                    discountPercent: parseFloat(item.discountPercent) || 0,
                    beforeTaxAmount: parseFloat(item.beforeTaxAmount) || 0,
                    taxAmount: gstType.applicable ? (parseFloat(item.taxAmount) || 0) : 0,
                    totalAmount: parseFloat(item.totalAmount) || 0,
                    printDescription: item.printDescription || '',
                    challanId: item.challanId ? parseInt(item.challanId) : null
                })),
                expenses: expenses.map(e => ({
                    groupName: e.groupName || 'Expense',
                    amount: parseFloat(e.amount) || 0,
                    isGstApplicable: !!e.isGstApplicable,
                    taxRate: parseFloat(e.taxRate) || 0,
                    isPostGst: !!e.isPostGst
                }))
            };

            if (isEditMode) {
                await salesInvoiceService.updateInvoice(id, payload);
                toast.success("Sales Invoice updated successfully!");
                navigate(ROUTES.SALES_INVOICE);
            } else {
                const response = await salesInvoiceService.createInvoice(payload);
                toast.success("Sales Invoice created successfully!");
                navigate(ROUTES.SALES_INVOICE);
            }
            sessionStorage.removeItem('add_si_draft');
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.message || "Failed to save invoice");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrintPreview = () => {
        // Attempt to auto-match any products that were typed but not selected
        const updatedItems = items.map((item, index) => {
            if (!item.productId && (item.productCode || item.productName)) {
                const match = products.find(p => 
                    (item.productCode && String(p.product_code).toLowerCase() === String(item.productCode).trim().toLowerCase()) || 
                    (item.productName && String(p.product_name).toLowerCase() === String(item.productName).trim().toLowerCase())
                );
                if (match) {
                    const rate = parseFloat(match.saleRate) || 0;
                    const taxPct = (parseFloat(match.tax_rate) || (match.hsn?.gst_rate ? parseFloat(match.hsn.gst_rate) : 0));
                    return {
                        ...item,
                        productId: match.id,
                        productCode: match.product_code,
                        productName: match.product_name,
                        hsnCode: match.hsn_code || match.hsn?.hsn_code || item.hsnCode,
                        taxPercent: taxPct,
                        rate: item.rate || rate,
                        printDescription: item.printDescription || match.product_name || "",
                        originalPrintDescription: item.printDescription || match.product_name || ""
                    };
                }
            }
            return item;
        });

        const hasChanges = JSON.stringify(updatedItems) !== JSON.stringify(items);
        if (hasChanges) {
            setItems(updatedItems);
        }

        const validation = validateForm(updatedItems);
        if (!validation.isValid) {
            if (validation.errors.customerInvoiceDate) {
                toast.error(validation.errors.customerInvoiceDate);
            } else {
                toast.error("Please fill all required fields before previewing");
            }
            return;
        }

        handleSaveDraft();
        const invoiceData = {
            ...formData,
            invoiceDate: toIsoDate(formData.customerInvoiceDate),
            customerInvoiceDate: toIsoDate(formData.customerInvoiceDate),
            bookingDate: toIsoDate(formData.bookingDate),
            invoiceNumber: formData.customerInvoiceNumber,
            customerId: parseInt(formData.customerId) || 0,
            items: updatedItems.map(item => ({
                ...item,
                quantity: parseFloat(item.quantity) || 0,
                rate: parseFloat(item.rate) || 0,
                taxPercent: parseFloat(item.taxPercent) || 0,
                discountAmount: parseFloat(item.discountAmount) || 0,
                totalAmount: parseFloat(item.totalAmount) || 0,
            })),
            expenses: expenses.map(e => ({
                ...e,
                amount: parseFloat(e.amount) || 0,
                taxRate: parseFloat(e.taxRate) || 0,
            })),
            gstType
        };

        navigate(ROUTES.SALES_INVOICE_PRINT, { 
            state: { 
                invoiceData: {
                    ...invoiceData,
                    items: invoiceData.items.map(it => ({
                        ...it,
                        printDescription: it.printDescription || it.description || '',
                        description: it.printDescription || it.description || ''
                    }))
                },
                from: window.location.pathname 
            } 
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-[#073318]" size={40} />
                    <p className="text-[14px] font-bold text-gray-500 animate-pulse uppercase tracking-[2px]">{t('modules:loading_invoice_module')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 pb-20 font-outfit">
            <style>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                    display: none !important;
                    -webkit-appearance: none;
                }
            `}</style>
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <h2 className="text-[20px] font-bold text-[#111827]">
                        {isEditMode ? t('modules:edit_sales_invoice_title') : t('modules:add_sales_invoice_title')}
                    </h2>
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} /> {t('modules:back')}
                    </button>
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                         <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        {t('modules:basic_details')}
                    </h2>
                    {(() => {
                        const today = new Date().toISOString().split('T')[0];
                        const hasLink = !!(formData.soId || (formData.challanIds && formData.challanIds.length > 0));
                        
                        let minDate = '';
                        let isLocked = false;

                        if (!hasLink) {
                            const todayDate = new Date();
                            const currentMonth = todayDate.getMonth();
                            const startYear = currentMonth < 3 ? todayDate.getFullYear() - 1 : todayDate.getFullYear();
                            minDate = `${startYear}-04-01`;
                            isLocked = false;
                        } else {
                            const hasChallan = formData.challanIds && formData.challanIds.length > 0;
                            const hasSo = !!formData.soId;

                            if (hasSo && hasChallan) {
                                const selectedChallans = challans.filter(c => formData.challanIds.includes(c.id));
                                if (selectedChallans.length > 0) {
                                    minDate = selectedChallans.reduce((latest, c) => {
                                        const cDate = c.challanDate?.split('T')[0] || c.bookingDate?.split('T')[0];
                                        return (!latest || cDate > latest) ? cDate : latest;
                                    }, '');
                                }
                            } else if (hasSo && !hasChallan) {
                                const selectedSO = sos.find(s => s.id === parseInt(formData.soId));
                                minDate = selectedSO?.soCreationDate?.split('T')[0] || '';
                            } else if (!hasSo && hasChallan) {
                                const selectedChallans = challans.filter(c => formData.challanIds.includes(c.id));
                                if (selectedChallans.length > 0) {
                                    minDate = selectedChallans.reduce((latest, c) => {
                                        const cDate = c.challanDate?.split('T')[0] || c.bookingDate?.split('T')[0];
                                        return (!latest || cDate > latest) ? cDate : latest;
                                    }, '');
                                }
                            }
                        }

                        return (
                            <InvoiceForm
                                formData={formData}
                                setFormData={setFormData}
                                handleCustomerChange={handleCustomerChange}
                                handleSOChange={handleSOChange}
                                handleChallanChange={handleChallanChange}
                                customers={customers}
                                sos={sos}
                                challans={filteredChallans}
                                errors={errors}
                                invoiceDateRef={invoiceDateRef}
                                onAddCustomer={handleAddNewCustomer}
                                minDate={minDate}
                                maxDate={today}
                                isLocked={isLocked}
                            />
                        );
                    })()}
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                         <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        {t('modules:product_details')}
                    </h2>
                    <InvoiceTable
                        items={items}
                        setItems={setItems}
                        products={products}
                        errors={errors}
                        handleAddNewProduct={handleAddNewProduct}
                        gstType={gstType}
                        isLinked={!!formData.soId || formData.challanIds.length > 0}
                        isChallanSelected={formData.challanIds && formData.challanIds.length > 0}
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
                        mainAccountLabel="Sales Account"
                    />
                </div>

                <div className="px-8 py-6 border-t border-[#F3F4F6] bg-gray-50 flex justify-end gap-4">
                    <button 
                        onClick={handlePrintPreview}
                        className="px-6 h-[48px] border border-[#073318] text-[#073318] bg-white rounded-[10px] text-[15px] font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Printer size={18} /> {t('modules:preview_print')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] shadow-[0_4px_15px_rgba(7,51,24,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {isSaving ? <RefreshCw className="animate-spin" size={18} /> : (isEditMode ? t('modules:update_invoice') : t('modules:generate_invoice'))}
                    </button>
                    <button 
                        onClick={() => navigate(ROUTES.SALES_INVOICE)}
                        className="px-8 h-[48px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[15px] font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        {t('modules:cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddSalesInvoice;
