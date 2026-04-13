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

import GRNForm from './components/GRNForm';
import GRNTable from './components/GRNTable';
import AccountTable from './components/AccountTable';

const AddGRN = () => {
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

    const [errors, setErrors] = useState({});
    const [companyInfo, setCompanyInfo] = useState(null);
    const [gstType, setGstType] = useState({ type: 'NONE' });

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
                setCompanyInfo(profileRes?.shopDetail || null);

                if (isEditMode) {
                    const grn = await grnService.getGRNById(id);
                    const suppState = grn.supplierState || ""; // Might need to fetch from supplier list if not in GRN object
                    
                    const poList = await grnService.getSupplierPOs(grn.supplierName);
                    setPos(poList || []);

                    setFormData({
                        supplier_id: grn.supplierId?.toString() || '',
                        supplier_name: grn.supplierName,
                        address: grn.address,
                        document_number: grn.grnNumber,
                        supplier_challan_number: grn.challanNumber,
                        booking_date: grn.bookingDate?.split('T')[0] || grn.grnDate?.split('T')[0],
                        document_date: grn.grnDate?.split('T')[0],
                        credit_days: grn.creditDays,
                        po_id: grn.poId || '',
                        po_number: grn.poNumber || '',
                        gst_no: grn.gstNumber || grn.gstNo || "",
                        supplier_state: suppState
                    });

                    const type = calculateGST(grn.gstNumber || grn.gstNo || "", suppState);
                    setGstType(type);

                    setItems(grn.items.map(item => {
                        const qty = item.quantity || 0;
                        const rate = item.rate || 0;
                        const taxPct = item.taxPercent || 18;
                        const discAmt = item.discountAmount || 0;
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
                            printDescription: item.printDescription || item.productName,
                            totalPoQty: item.totalPoQty || 0,
                            receivedPoQty: item.receivedPoQty || 0,
                            remainingQty: (item.totalPoQty || 0) - (item.receivedPoQty || 0) - qty
                        };
                    }));
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
            const poData = await grnService.getSupplierPOs(supplier.accountName);
            setPos(poData || []);
        } catch (error) {
            console.error("Error fetching supplier POs:", error);
        }
    };

    const calculateGST = (supplierGST, supplierState) => {
        if (!supplierGST) {
            return { type: 'NONE' };
        }
        if (supplierState === companyInfo?.state) {
            return { type: 'INTRA' };
        } else {
            return { type: 'INTER' };
        }
    };

    const handlePOChange = async (poId) => {
        if (!poId) {
            setFormData(prev => ({ ...prev, po_id: '', po_number: '' }));
            return;
        }

        const selectedPO = pos.find(p => p.id === parseInt(poId));
        if (!selectedPO) return;

        try {
            const poDetails = await purchaseOrderService.getPurchaseOrderById(poId);
            setFormData(prev => ({ ...prev, po_id: poDetails.id, po_number: poDetails.poNumber }));

            const gstType = calculateGST(formData.gst_no || poDetails.gstNumber, formData.supplier_state);

            const poItems = poDetails.items.map(item => {
                const qty = item.quantity || 0;
                const rate = item.rate || 0;
                const taxPct = item.taxPercent || 0;
                const remaining = (item.quantity || 0) - (item.receivedQty || 0);
                const discAmt = item.discountAmount || 0;
                const discPct = item.discountPercent || 0;
                const baseAmount = remaining * rate;
                const befTax = baseAmount - discAmt;
                
                let taxAmt = 0;
                if (gstType.type !== 'NONE') {
                    taxAmt = (befTax * taxPct) / 100;
                }

                return {
                    id: Date.now() + Math.random(),
                    productId: item.productId || item.product_id,
                    productCode: item.productCode || item.product_code,
                    productName: item.productName || item.product_name,
                    quantity: remaining, 
                    rate: rate,
                    uom: item.uom,
                    discountAmount: discAmt,
                    discountPercent: discPct,
                    hsnCode: item.hsnCode || item.hsn_code || '',
                    taxPercent: taxPct,
                    beforeTaxAmount: befTax,
                    taxAmount: taxAmt,
                    totalAmount: befTax + taxAmt,
                    printDescription: item.printDescription || item.productName,
                    totalPoQty: item.quantity,
                    receivedPoQty: item.receivedQty || 0,
                    remainingQty: 0
                };
            });
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
        if (!formData.document_date) newErrors.document_date = "Challan date is required";

        const validItems = items.filter(item => item.productCode);
        if (validItems.length === 0) {
            newErrors.items = true;
        } else {
            const itemErrors = [];
            items.forEach((item, index) => {
                if (item.productCode) {
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
            const validItems = items.filter(i => i.productCode);
            const gstType = calculateGST(formData.gst_no, formData.supplier_state);
            
            let materialTotal = 0;
            let cgst = 0, sgst = 0, igst = 0;

            validItems.forEach(p => {
                const base = (parseFloat(p.quantity) || 0) * (parseFloat(p.rate) || 0);
                const discount = (parseFloat(p.discountAmount) || 0);
                const befTax = base - discount;
                materialTotal += befTax;

                if (gstType.type === 'INTRA') {
                    cgst += befTax * (parseFloat(p.taxPercent) || 0) / 200;
                    sgst += befTax * (parseFloat(p.taxPercent) || 0) / 200;
                } else if (gstType.type === 'INTER') {
                    igst += befTax * (parseFloat(p.taxPercent) || 0) / 100;
                }
            });

            const payload = {
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
                    taxPercent: parseFloat(i.taxPercent) || 0,
                    taxAmount: parseFloat(i.taxAmount) || 0,
                    beforeTaxAmount: parseFloat(i.beforeTaxAmount) || 0,
                    hsnCode: i.hsnCode,
                    amount: (parseFloat(i.totalAmount) || 0),
                    printDescription: i.printDescription
                })),
                accounts: [
                    { accountName: 'Material Purchase', amount: materialTotal },
                    { accountName: 'CGST', amount: cgst },
                    { accountName: 'SGST', amount: sgst },
                    { accountName: 'IGST', amount: igst }
                ],
                accountSummary: {
                    material: materialTotal,
                    cgst: cgst,
                    sgst: sgst,
                    igst: igst,
                    grandTotal: materialTotal + cgst + sgst + igst
                },
                grandTotal: materialTotal + cgst + sgst + igst
            };

            if (isEditMode) {
                await grnService.updateGRN(id, payload);
                toast.success("GRN updated successfully");
            } else {
                await grnService.createGRN(payload);
                toast.success("GRN created successfully");
            }
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
        navigate(`/seller/masters/product-master/add?redirect=${redirect}`);
    };

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
                    <h2 className="text-[20px] font-bold text-[#111827]">Add GRN</h2>
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
                        suppliers={suppliers}
                        pos={pos}
                        errors={errors}
                        challanDateRef={challanDateRef}
                    />
                </div>

                <div className="p-8 border-b border-[#F3F4F6]">
                    <GRNTable 
                        items={items}
                        setItems={setItems}
                        products={products}
                        errors={errors}
                        handleAddNewProduct={handleAddNewProduct}
                        gstType={gstType}
                    />
                </div>

                <div className="p-8">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                         <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        Account Summary
                    </h2>
                    <AccountTable items={items} gstType={gstType} />
                </div>

                <div className="px-8 py-6 border-t border-[#F3F4F6] bg-gray-50 flex justify-end gap-4">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] shadow-[0_4px_15px_rgba(7,51,24,0.15)] transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70"
                    >
                        Save GRN
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

export default AddGRN;
