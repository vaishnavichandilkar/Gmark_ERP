// Updated at: 2026-04-17T13:48:00
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ArrowLeft, RefreshCw, Save, CheckCircle2, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

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
                const [custRes, prodRes, profileRes, nextNumRes] = await Promise.all([
                    salesInvoiceService.getCustomers(),
                    productService.getProducts({ limit: 1000 }),
                    getProfileApi(),
                    !isEditMode ? salesInvoiceService.getNextNumber() : Promise.resolve(null)
                ]);

                const custData = custRes || [];
                setCustomers(custData);
                setProducts(prodRes.products || []);
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
                        setGstType(calculateGST(invoice.gstNumber || '', foundCustomer?.state || ''));
                    }

                    setItems(invoice.items.map(item => ({
                        ...item,
                        id: item.id || Date.now() + Math.random(),
                        printDescription: item.printDescription || item.productName || ""
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

    const calculateGST = (custGST, custState) => {
        if (!companyInfo) return { type: 'INTRA', applicable: true, isRcm: false };
        
        const companyGST = companyInfo?.gstNumber || "";
        const companyState = (companyInfo?.state || "").trim().toLowerCase();
        
        const customerGST = custGST || "";
        const customerState = (custState || "").trim().toLowerCase();

        // Step 1 & 2: Extract State Codes from GST if available
        const companyStateCode = companyGST.substring(0, 2);
        const customerStateCode = customerGST.substring(0, 2);

        let isInterState = false;

        // Requirement: If GST present, use GST state code. If not, use address state.
        if (companyGST && customerGST && /^\d{2}$/.test(companyStateCode) && /^\d{2}$/.test(customerStateCode)) {
            // Step 3: Compare GST State Codes
            isInterState = companyStateCode !== customerStateCode;
        } else {
            // Step 3 (B2C Fallback): Use Address States
            isInterState = companyState !== customerState;
        }

        return { 
            type: isInterState ? 'INTER' : 'INTRA', 
            applicable: true, 
            isRcm: false 
        };
    };

    // Auto-update GST Type whenever customer or company info changes
    useEffect(() => {
        if (formData.customerId && companyInfo) {
            const customer = customers.find(c => c.id === formData.customerId);
            if (customer) {
                setGstType(calculateGST(customer.gstNo || "", customer.state || ""));
            }
        } else if (!formData.customerId && companyInfo) {
            setGstType({ type: 'INTRA', applicable: true, isRcm: false });
        }
    }, [formData.customerId, companyInfo, customers]);

    const handleCustomerChange = async (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const type = calculateGST(customer.gstNo || "", customer.state || "");
        setGstType(type);

        const mappedAddress = [customer.addressLine1, customer.addressLine2, customer.city, customer.state].filter(Boolean).join(', ');

        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            customerName: customer.accountName,
            customerType: customer.customerType || customer.accountType || 'industrial',
            address: mappedAddress || customer.address || '',
            gstNo: customer.gstNo || '',
            creditDays: customer.customerCreditDays || 0,
            customerState: customer.state || '',
            challanIds: []
        }));

        try {
            // Fix: Use accountName instead of id because backend getCustomerSOs expects a name string
            const [soData, challanData] = await Promise.all([
                salesInvoiceService.getCustomerSOs(customer.accountName, id),
                challanService.getCustomerChallans(customer.accountName, '', id)
            ]);
            setSos(soData || []);
            setChallans(challanData || []);
        } catch (error) {
            console.error("Error fetching customer data:", error);
        }
    };

    const handleSOChange = async (soId) => {
        const selectedSO = sos.find(s => s.id === parseInt(soId));
        if (!selectedSO) return;

        setFormData(prev => ({
            ...prev,
            soId: selectedSO.id,
            soNumber: selectedSO.soNumber,
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
                printDescription: item.printDescription || item.productName || '',
            };
        });

        setItems(mappedItems);

    };

    const handleChallanChange = async (selectedIds) => {
        setFormData(prev => ({ ...prev, challanIds: selectedIds }));
        
        if (selectedIds.length === 0) {
            setItems([{
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0,
                taxAmount: 0, totalAmount: 0, printDescription: ''
            }]);
            setExpenses([]);
            return;
        }

        try {
            const allItems = [];
            const allExpenses = [];

            let latestChallanDate = null;

            for (const cid of selectedIds) {
                const challanResponse = await challanService.getChallanById(cid);
                const challan = challanResponse.data ? challanResponse.data : challanResponse;

                if (challan) {
                    const cDate = new Date(challan.challanDate);
                    if (!latestChallanDate || cDate > latestChallanDate) {
                        latestChallanDate = cDate;
                    }
                    if (challan.items) {
                        for (const item of challan.items) {
                            // Find product in master for fallback HSN/Tax
                            const product = products.find(p => p.id === item.productId || p.product_code === item.productCode);
                            
                            allItems.push({
                                ...item,
                                id: Date.now() + Math.random(),
                                quantity: item.challanQty || item.quantity || 0,
                                totalSoQty: item.challanQty || item.quantity || 0, // Set limit for Invoice based on Challan Qty
                                hsnCode: item.hsnCode || product?.hsn_code || product?.hsnCode || '',
                                taxPercent: item.taxPercent || product?.tax_rate || product?.taxRate || 0,
                                challanId: cid,
                                challanNumber: challan.challanNumber
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

    const validateForm = () => {
        const newErrors = {};
        if (!formData.customerId) newErrors.customerName = "Customer is required";
        if (!formData.customerInvoiceNumber) newErrors.customerInvoiceNumber = "Invoice Number is required";
        const isoDocDate = toIsoDate(formData.customerInvoiceDate);
        if (!isoDocDate) {
            newErrors.customerInvoiceDate = "Invoice Date is required";
        }

        if (!items || items.length === 0 || (items.length === 1 && !items[0].productId)) {
            newErrors.items = "At least one product is required";
        } else {
            const itemErrors = items.map((item, idx) => {
                const errors = {};
                if (item.productId) {
                    if (!item.quantity || parseFloat(item.quantity) <= 0) errors.quantity = "Qty > 0";
                    if (!item.rate || parseFloat(item.rate) <= 0) errors.rate = "Rate > 0";
                }
                return Object.keys(errors).length > 0 ? errors : null;
            });
            if (itemErrors.some(e => e)) {
                newErrors.itemErrors = itemErrors;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
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
        if (!validateForm()) {
            toast.error("Please fill all required fields correctly");
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
                    taxPercent: parseFloat(item.taxPercent) || 0,
                    discountAmount: parseFloat(item.discountAmount) || 0,
                    discountPercent: parseFloat(item.discountPercent) || 0,
                    beforeTaxAmount: parseFloat(item.beforeTaxAmount) || 0,
                    taxAmount: parseFloat(item.taxAmount) || 0,
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
                navigate(ROUTES.SALES_INVOICE_VIEW.replace(':id', id));
            } else {
                const response = await salesInvoiceService.createInvoice(payload);
                toast.success("Sales Invoice created successfully!");
                navigate(ROUTES.SALES_INVOICE_VIEW.replace(':id', response.id));
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
        if (!validateForm()) {
            toast.error("Please fill all required fields before previewing");
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
            items: items.map(item => ({
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
                    <p className="text-[14px] font-bold text-gray-500 animate-pulse uppercase tracking-[2px]">Loading Invoice Module...</p>
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
                        {isEditMode ? 'Edit Sales Invoice' : 'Add Sales Invoice'}
                    </h2>
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft size={18} /> Back
                    </button>
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                         <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        Basic Details
                    </h2>
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
                    />
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                         <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        Product Details
                    </h2>
                    <InvoiceTable
                        items={items}
                        setItems={setItems}
                        products={products}
                        errors={errors}
                        handleAddNewProduct={handleAddNewProduct}
                        gstType={gstType}
                        isLinked={!!formData.soId || formData.challanIds.length > 0}
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
                        mainAccountLabel="Sales Account"
                    />
                </div>

                <div className="px-8 py-6 border-t border-[#F3F4F6] bg-gray-50 flex justify-end gap-4">
                    <button 
                        onClick={handlePrintPreview}
                        className="px-6 h-[48px] border border-[#073318] text-[#073318] bg-white rounded-[10px] text-[15px] font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Printer size={18} /> Preview & Print
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] shadow-[0_4px_15px_rgba(7,51,24,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {isSaving ? <RefreshCw className="animate-spin" size={18} /> : (isEditMode ? 'Update Invoice' : 'Generate Invoice')}
                    </button>
                    <button 
                        onClick={() => navigate(ROUTES.SALES_INVOICE)}
                        className="px-8 h-[48px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[15px] font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddSalesInvoice;
