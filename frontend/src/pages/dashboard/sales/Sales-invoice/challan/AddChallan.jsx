import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { ArrowLeft, RefreshCw, Save, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { determineSalesGst } from '@/utils/gstUtils';

import salesOrderService from '@/services/salesOrderService';
import challanService from '@/services/challanService';
import accountService from '@/services/accountService';
import productService from '@/services/productService';
import { getProfileApi } from '@/services/authService';

import ChallanForm from './components/ChallanForm';
import ChallanTable from './components/ChallanTable';
import AccountTable from './components/AccountTable';

const AddChallan = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [sos, setSos] = useState([]);
    const [challans, setChallans] = useState([]);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [gstType, setGstType] = useState({ type: 'INTRA', applicable: true, isRcm: false });
    const [businessProfile, setBusinessProfile] = useState(null);

    // Refs for date pickers
    const bookingDateRef = useRef(null);
    const challanDateRef = useRef(null);

    const [formData, setFormData] = useState({
        customerId: '',
        customerName: '',
        address: '',
        gstNo: '',
        creditDays: 0,
        soId: '',
        soNumber: '',
        challanIds: [],
        customerChallanNumber: '',
        customerChallanDate: new Date().toISOString().split('T')[0],
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
                const [custRes, prodRes, profileRes, bizProfileRes] = await Promise.all([
                    accountService.getAllAccounts({ limit: 1000, groupName: 'SUNDRY_DEBTORS', status: 'ACTIVE' }),
                    productService.getProducts({ limit: 1000 }),
                    getProfileApi(),
                    accountService.getBusinessProfile().catch(e => {
                        console.error("Error fetching business profile:", e);
                        return null;
                    })
                ]);

                const custData = custRes.data || [];
                setCustomers(custData);
                setProducts(prodRes.products || []);
                setCompanyInfo({
                    ...profileRes?.shopDetail,
                    gstNumber: profileRes?.gstNumber
                });
                setBusinessProfile(bizProfileRes);

                if (isEditMode) {
                    const challanRecord = await challanService.getChallanById(id);
                    const invoice = challanRecord.data ? challanRecord.data : challanRecord;
                    
                    // Find customer in loaded data to get ID and type
                    const foundCustomer = custData.find(c => c.accountName === invoice.customerName);

                    setFormData({
                        customerId: foundCustomer?.id || invoice.customerId || '',
                        customerName: invoice.customerName,
                        customerType: foundCustomer?.customerType || foundCustomer?.accountType || '',
                        address: invoice.address,
                        gstNo: invoice.gstNumber || '',
                        creditDays: invoice.creditDays || 0,
                        soId: invoice.soId || '',
                        soNumber: invoice.soNumber || '',
                        challanIds: invoice.items.map(item => item.challanId).filter(Boolean),
                        customerChallanNumber: invoice.challanNumber,
                        customerChallanDate: invoice.challanDate?.split('T')[0],
                        bookingDate: invoice.bookingDate?.split('T')[0],
                    });

                    setGstType(determineSalesGst(companyInfo?.gstNumber, invoice.gstNumber || '', companyInfo?.state || "", foundCustomer?.state || '', 0, 0, 0));

                    setItems(invoice.items.map(item => ({
                        ...item,
                        quantity: item.challanQty || item.quantity || 0,
                        totalSoQty: item.totalSoQty || 0,
                        remainingQty: item.remainingQty || 0,
                        id: item.id || Date.now() + Math.random(),
                        originalPrintDescription: item.printDescription || item.productName || ''
                    })));

                    setExpenses(invoice.expenses?.map(e => ({
                        id: e.id || Date.now() + Math.random(),
                        groupName: e.groupName,
                        amount: e.amount,
                        isGstApplicable: e.isGstApplicable,
                        taxRate: e.taxRate,
                        isPostGst: !e.isGstApplicable
                    })) || []);

                    // Fetch customer-specific data for dropdowns
                    try {
                        const [soData, challanData] = await Promise.all([
                            challanService.getCustomerSOs(invoice.customerName),
                            challanService.getCustomerChallans(invoice.customerName)
                        ]);
                        setSos(soData || []);
                        setChallans(challanData?.data || challanData || []);
                    } catch (e) {
                        console.error("Error fetching edit mode dropdown data:", e);
                    }
                } else {
                    // Check for Draft Restore
                    const draftStr = sessionStorage.getItem('add_challan_draft');
                    if (draftStr) {
                         const draft = JSON.parse(draftStr);
                         setFormData(draft.formData);
                         setItems(draft.items);
                         setExpenses(draft.expenses);
                    } else {
                        // Auto-generate Challan Number
                        try {
                            const nextRes = await challanService.getNextNumber();
                            setFormData(prev => ({
                                ...prev,
                                customerChallanNumber: nextRes.challanNumber
                            }));
                        } catch (error) {
                            console.error("Error fetching next challan number:", error);
                        }
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

    const isSellerMsme = useMemo(() => {
        if (!businessProfile) return false;
        const isSellerMsmeActive = (businessProfile.sellerDocuments || []).some(
            doc => doc.category === 'UDYOG_AADHAR' && doc.name && doc.name.trim() !== '' && doc.name.trim().toUpperCase() !== 'N/A'
        );
        const isSellerMsmeType = businessProfile.regType === "Manufacturing" || businessProfile.regType === "Service";
        return Boolean(isSellerMsmeActive && isSellerMsmeType);
    }, [businessProfile]);

    useEffect(() => {
        if (!formData.customerId) return;
        const customer = customers.find(c => String(c.id) === String(formData.customerId));
        if (!customer) return;

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
    }, [formData.customerId, formData.creditDays, customers, isSellerMsme]);

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

    const handleCustomerChange = async (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const type = determineSalesGst(companyInfo?.gstNumber, customer.gstNo || "", companyInfo?.state || "", customer.state || "", 0, 0, 0);
        setGstType(type);

        setFormData(prev => ({
            ...prev,
            customerId: customer.id,
            customerName: customer.customerName || customer.accountName,
            customerType: customer.customerType || customer.accountType || '',
            address: [customer.addressLine1, customer.addressLine2].filter(Boolean).join(', '),
            gstNo: customer.gstNo || '',
            creditDays: customer.customerCreditDays || customer.creditDays || 0,
            customerState: customer.state || '',
            soId: '',
            soNumber: '',
            challanIds: []
        }));

        // Reset items & SO list when customer changes
        setItems([{
            id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
            uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0,
            beforeTaxAmount: 0, taxAmount: 0, totalAmount: 0, printDescription: '',
            totalSoQty: 0, givenSoQty: 0, remainingQty: 0
        }]);

        try {
            const customerNameKey = customer.customerName || customer.accountName;
            const [soData, challanData] = await Promise.all([
                challanService.getCustomerSOs(customerNameKey),
                challanService.getCustomerChallans(customerNameKey)
            ]);
            setSos(soData || []);
            setChallans(challanData?.data || challanData || []);
        } catch (error) {
            console.error("Error fetching customer data:", error);
        }
    };

    const handleSOChange = async (soId) => {
        if (!soId) {
            // Clear SO selection
            const customer = customers.find(c => c.id === parseInt(formData.customerId));
            const defaultCreditDays = customer ? (customer.customerCreditDays || customer.creditDays || 0) : 0;
            setFormData(prev => ({ ...prev, soId: '', soNumber: '', creditDays: defaultCreditDays }));
            setItems([{
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0,
                beforeTaxAmount: 0, taxAmount: 0, totalAmount: 0, printDescription: '',
                totalSoQty: 0, givenSoQty: 0, remainingQty: 0
            }]);
            return;
        }

        const selectedSO = sos.find(s => s.id === parseInt(soId));
        if (!selectedSO) return;

        let soCreditDays = selectedSO.creditDays;
        if (soCreditDays === undefined || soCreditDays === null) {
            try {
                const soDetails = await salesOrderService.getSalesOrderById(soId);
                soCreditDays = soDetails.creditDays;
            } catch (e) {
                console.error("Error fetching SO details:", e);
            }
        }

        setFormData(prev => ({
            ...prev,
            soId: selectedSO.id,
            soNumber: selectedSO.soNumber,
            soCreationDate: selectedSO.soCreationDate,
            creditDays: soCreditDays !== undefined && soCreditDays !== null ? soCreditDays : prev.creditDays
        }));

        // Build items with totalSoQty from SO, then fetch givenSoQty for each product
        const customerName = formData.customerName;
        const soNumber = selectedSO.soNumber;

        const mappedItems = await Promise.all((selectedSO.items || []).map(async (item) => {
            let givenSoQty = 0;
            try {
                // getReceivedQty returns how much has already been delivered via previous challans
                const hist = await challanService.getReceivedQty(customerName, (item.productCode || item.product_code), soNumber);
                givenSoQty = parseFloat(hist?.givenSoQty || hist?.totalQty || 0);
            } catch (e) {
                console.error("Error fetching givenSoQty for product:", item.productCode, e);
            }

            const totalSoQty = parseFloat(item.quantity || 0);
            const remainingQty = Math.max(0, totalSoQty - givenSoQty);

            // Important: Use multiple identifiers to find the product in local master list
            const product = products.find(p => 
                (p.id === item.productId) || 
                (p.product_code && item.productCode && p.product_code === item.productCode) ||
                (p.id === parseInt(item.productId))
            );

            const rate = parseFloat(item.rate || product?.sale_rate || product?.saleRate || 0);
            const rawTaxPercent = item.taxPercent ?? item.tax_percent;
            const taxPercent = (rawTaxPercent !== undefined && rawTaxPercent !== null && rawTaxPercent !== '')
                ? parseFloat(rawTaxPercent)
                : parseFloat(product?.tax_rate || product?.taxRate || 0);
            const discAmt = parseFloat(item.discountAmount || 0);
            const discPct = parseFloat(item.discountPercent || 0);
            const baseAmount = remainingQty * rate;

            // Recalculate discount amount based on percentage or proportionally
            let currentDiscAmt = 0;
            if (discPct > 0) {
                currentDiscAmt = parseFloat(((baseAmount * discPct) / 100).toFixed(2));
            } else if (totalSoQty > 0 && discAmt > 0) {
                // Proportional scaling if only amount is provided
                currentDiscAmt = parseFloat(((discAmt / totalSoQty) * remainingQty).toFixed(2));
            }

            const befTax = Math.max(0, baseAmount - currentDiscAmt);
            const isApplicable = gstType?.applicable !== false;
            const taxAmount = isApplicable ? (befTax * taxPercent) / 100 : 0;
            const totalAmount = befTax + taxAmount;

            return {
                id: Date.now() + Math.random(),
                productId: String(item.productId || product?.id || ''), 
                productCode: item.productCode || product?.product_code || '',
                productName: item.productName || product?.product_name || '',
                rate,
                uom: item.uom || product?.uom?.gst_uom || product?.uom?.unit_name || '',
                hsnCode: item.hsnCode || product?.hsn_code || product?.hsnCode || '',
                taxPercent,
                discountAmount: currentDiscAmt,
                discountPercent: discPct,
                totalSoQty,
                givenSoQty,
                quantity: remainingQty,
                remainingQty: 0, // Since we set quantity to remainingQty, the new remaining would be 0
                beforeTaxAmount: parseFloat(befTax.toFixed(2)),
                taxAmount: parseFloat(taxAmount.toFixed(2)),
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                printDescription: item.printDescription || item.productName || '',
                originalPrintDescription: item.printDescription || item.productName || '',
            };
        }));

        setItems(mappedItems.length > 0 ? mappedItems : [{
            id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
            uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0,
            beforeTaxAmount: 0, taxAmount: 0, totalAmount: 0, printDescription: '',
            totalSoQty: 0, givenSoQty: 0, remainingQty: 0
        }]);
    };

    const handleChallanChange = async (selectedIds) => {
        setFormData(prev => ({ ...prev, challanIds: selectedIds }));
        
        if (selectedIds.length === 0) return;

        try {
            const allItems = [];
            for (const cid of selectedIds) {
                const challan = await challanService.getChallanById(cid);
                if (challan && challan.items) {
                    challan.items.forEach(item => {
                        allItems.push({
                            ...item,
                            id: Date.now() + Math.random(),
                            challanId: cid,
                            challanNumber: challan.challanNumber
                        });
                    });
                }
            }
            // Merge items with same productId? Usually yes for invoice.
            setItems(allItems);
        } catch (error) {
            console.error("Error fetching challan items:", error);
        }
    };

    const handleSaveDraft = () => {
        const draft = { formData, items, expenses };
        sessionStorage.setItem('add_challan_draft', JSON.stringify(draft));
    };

    const handleAddNewCustomer = () => {
        handleSaveDraft();
        navigate(`/seller/masters/account-master/add?redirect=${ROUTES.SALES_CHALLAN_ADD}`);
    };

    const handleAddNewProduct = () => {
        handleSaveDraft();
        navigate(`/seller/masters/product-master/add?redirect=${ROUTES.SALES_CHALLAN_ADD}`);
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.customerId && !formData.customerName) newErrors.customerName = "Customer is required";
        if (!formData.customerChallanNumber) newErrors.customerChallanNumber = "Challan Number is required";
        
        if (!formData.customerChallanDate) {
            newErrors.customerChallanDate = "Challan Date is required";
        } else {
            const challanDate = new Date(formData.customerChallanDate);
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            if (formData.soId) {
                const soDate = new Date(formData.soCreationDate);
                soDate.setHours(0, 0, 0, 0);
                const challanOnlyDate = new Date(challanDate);
                challanOnlyDate.setHours(0, 0, 0, 0);

                if (challanOnlyDate < soDate || challanDate > today) {
                    newErrors.customerChallanDate = "Challan Date must be between SO Date and Current Date.";
                }
            } else {
                const now = new Date();
                const fyStart = new Date(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(), 3, 1);
                fyStart.setHours(0, 0, 0, 0);
                const challanOnlyDate = new Date(challanDate);
                challanOnlyDate.setHours(0, 0, 0, 0);

                if (challanOnlyDate < fyStart || challanDate > today) {
                    newErrors.customerChallanDate = "Challan Date must be within current financial year.";
                }
            }
        }

        const validItems = items.filter(item => item.productId && parseFloat(item.quantity) > 0);
        if (validItems.length === 0) {
            newErrors.items = "at least one product with quantity";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        const isValid = validateForm();
        if (!isValid) {
            toast.error("Please correct the errors in the form before saving.");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                customerId: parseInt(formData.customerId),
                customerName: formData.customerName,
                address: formData.address || '',
                gstNumber: formData.gstNo || '',
                creditDays: parseInt(formData.creditDays) || 0,
                bookingDate: formData.bookingDate,
                soId: formData.soId ? parseInt(formData.soId) : null,
                soNumber: formData.soNumber || '',
                // Map frontend field names → backend field names
                challanNumber: formData.customerChallanNumber,
                challanDate: formData.customerChallanDate,
                items: items
                    .filter(item => item.productId)
                    .map(item => ({
                        productId: parseInt(item.productId),
                        productCode: item.productCode,
                        productName: item.productName,
                        quantity: parseFloat(item.quantity) || 0,
                        rate: parseFloat(item.rate) || 0,
                        uom: item.uom || '',
                        hsnCode: item.hsnCode || '',
                        taxPercent: gstType.gstType !== 'NONE' ? (parseFloat(item.taxPercent) || 0) : 0,
                        discountAmt: parseFloat(item.discountAmount) || 0,
                        discountPercent: parseFloat(item.discountPercent) || 0,
                        beforeTaxAmount: parseFloat(item.beforeTaxAmount) || 0,
                        taxAmount: gstType.gstType !== 'NONE' ? (parseFloat(item.taxAmount) || 0) : 0,
                        amount: parseFloat(item.totalAmount) || 0,
                        totalSoQty: parseFloat(item.totalSoQty) || 0,
                        printDescription: item.printDescription || item.productName || '',
                    })),
                expenses: expenses.map(e => ({
                    groupName: e.groupName,
                    amount: parseFloat(e.amount) || 0,
                    isGstApplicable: !!e.isGstApplicable,
                    isPostGst: !!e.isPostGst,
                    taxRate: parseFloat(e.taxRate) || 0
                }))
            };

            if (isEditMode) {
                await challanService.updateChallan(id, payload);
                toast.success("Sales Challan updated successfully!");
            } else {
                await challanService.createChallan(payload);
                toast.success("Sales Challan created successfully!");
            }
            sessionStorage.removeItem('add_challan_draft');
            navigate(ROUTES.SALES_CHALLAN);
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.message || "Failed to save challan");
        } finally {
            setIsSaving(false);
        }
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
                        {isEditMode ? 'Edit Sales Challan' : 'Add Sales Challan'}
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
                            {t('modules:basic_details', 'Basic Details')}
                        </h2>
                    <ChallanForm
                        formData={formData}
                        setFormData={setFormData}
                        handleCustomerChange={handleCustomerChange}
                        handleSOChange={handleSOChange}
                        handleChallanChange={handleChallanChange}
                        customers={customers}
                        sos={sos}
                        challans={challans}
                        errors={errors}
                        challanDateRef={challanDateRef}
                        onAddCustomer={handleAddNewCustomer}
                    />
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                            <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                            {t('modules:product_details', 'Product Details')}
                        </h2>
                    <ChallanTable
                        items={items}
                        setItems={setItems}
                        products={products}
                        errors={errors}
                        handleAddNewProduct={handleAddNewProduct}
                        gstType={gstType}
                        isSoSelected={!!formData.soId}
                        soNumber={formData.soNumber}
                        linkedSoItems={sos.find(s => s.id === parseInt(formData.soId))?.items}
                        customerName={formData.customerName}
                    />
                </div>

                <div className="p-8">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                            <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                            {t('modules:account_summary', 'Account Summary')}
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
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] shadow-[0_4px_15px_rgba(7,51,24,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        {isSaving ? <RefreshCw className="animate-spin" size={18} /> : (isEditMode ? t('modules:update_challan', 'Update Challan') : t('modules:save_challan', 'Save Challan'))}
                    </button>
                    <button 
                        onClick={() => navigate(ROUTES.SALES_CHALLAN)}
                        className="px-8 h-[48px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[15px] font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        {t('common:cancel', 'Cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddChallan;
