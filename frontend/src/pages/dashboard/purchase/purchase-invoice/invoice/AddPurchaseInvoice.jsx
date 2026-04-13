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
            received_po_qty: 0,
            remainingQty: 0
        }
    ]);

    const [errors, setErrors] = useState({});

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [accRes, prodRes] = await Promise.all([
                    accountService.getAllAccounts({ groupName: 'SUNDRY_CREDITORS', limit: 1000 }),
                    productService.getProducts({ limit: 1000 })
                ]);
                
                setSuppliers(accRes.data || []);
                setProducts(prodRes.products || []);

                if (isEditMode) {
                    const invoice = await purchaseInvoiceService.getInvoice(id);
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
                        gst_no: invoice.gstNumber || ""
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
                            totalPoQty: 0, 
                            receivedPoQty: 0,
                            remainingQty: 0
                        };
                    }));
                } else {
                    const nextNo = await purchaseInvoiceService.getNextNumber();
                    if (nextNo) {
                        setFormData(prev => ({ ...prev, document_number: nextNo.invoiceNumber }));
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
            grn_ids: []
        }));

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
            return;
        }

        const selectedPO = pos.find(p => p.id === parseInt(poId));
        if (!selectedPO) return;

        try {
            const poDetails = await purchaseOrderService.getPurchaseOrderById(poId);
            setFormData(prev => ({ ...prev, po_id: poDetails.id, po_number: poDetails.poNumber }));

            const poItems = poDetails.items.map(item => {
                const quantity = item.quantity || 0;
                const rate = item.rate || 0;
                const discAmt = item.discountAmount || 0;
                const taxPct = item.taxPercent || 0;
                const befTax = (quantity * rate) - discAmt;
                const taxAmt = (befTax * taxPct) / 100;
                return {
                    id: Date.now() + Math.random(),
                    productId: item.productId,
                    productCode: item.productCode,
                    productName: item.productName,
                    quantity: Number(item.quantity) || 0,
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
                    totalPoQty: item.quantity,
                    receivedPoQty: 0,
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
        if (!formData.po_id) newErrors.po_id = "Purchase Order is required";
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
            const payload = {
                supplierId: formData.supplier_id ? formData.supplier_id.toString() : '0',
                supplierName: formData.supplier_name,
                address: formData.address,
                gstNumber: formData.gst_no,
                creditDays: Number(formData.credit_days),
                poIds: [formData.po_id.toString()],
                challanNumbers: formData.grn_ids.map(id => id.toString()),
                supplierInvoiceNumber: formData.supplier_invoice_number,
                invoiceNumber: formData.document_number,
                invoiceDate: formData.document_date,
                bookingDate: formData.booking_date,
                items: items.filter(i => i.productId).map(i => ({
                    productId: i.productId,
                    productCode: i.productCode,
                    productName: i.productName,
                    quantity: Number(i.quantity),
                    rate: Number(i.rate),
                    uom: i.uom,
                    hsnCode: i.hsnCode,
                    taxPercent: i.taxPercent,
                    taxAmount: i.taxAmount,
                    beforeTaxAmount: i.beforeTaxAmount,
                    totalAmount: i.totalAmount
                })),
                accountSummary: {
                    materialPurchase: items.reduce((sum, i) => sum + (parseFloat(i.beforeTaxAmount) || 0), 0),
                    cgst: items.reduce((sum, i) => sum + (parseFloat(i.taxAmount) || 0), 0) / 2, 
                    sgst: items.reduce((sum, i) => sum + (parseFloat(i.taxAmount) || 0), 0) / 2,
                    igst: 0,
                    grandTotal: items.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0)
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
            navigate(ROUTES.PURCHASE_INVOICE);
        } catch (error) {
            console.error("Error saving Invoice:", error);
            toast.error(error.response?.data?.message || "Failed to save Invoice");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddNewProduct = () => {
        const redirect = isEditMode ? `${ROUTES.PURCHASE_INVOICE_EDIT.replace(':id', id)}` : ROUTES.PURCHASE_INVOICE_ADD;
        navigate(`/seller/masters/product-master/add?redirect=${redirect}`);
    };

    if (isLoading && !isEditMode) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="animate-spin text-emerald-800" size={32} />
            </div>
        );
    }

    const calculateGST = (gstIn, supplierState) => {
        if (!gstIn || gstIn.length < 2) return { type: 'NONE' };
        const companyState = "MAHARASHTRA"; // Standard default for this app
        const stateCode = gstIn.substring(0, 2);
        const isIntra = supplierState?.toUpperCase() === companyState;
        return { type: isIntra ? 'INTRA' : 'INTER', stateCode };
    };

    const gstType = calculateGST(formData.gst_no, formData.address);

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
                    />
                </div>

    
    return (
...
                <div className="p-8">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                        <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        Account Summary
                    </h2>
                    <AccountTable items={items} gstType={gstType} />
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
