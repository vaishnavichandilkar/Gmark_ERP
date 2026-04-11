import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { ROUTES } from '@/constants/routes';

import purchaseInvoiceService from '@/services/purchaseInvoiceService';
import purchaseOrderService from '@/services/purchaseOrderService';
import accountService from '@/services/accountService';
import productService from '@/services/productService';

import GRNForm from '../../grn/components/GRNForm';
import GRNTable from '../../grn/components/GRNTable';
import AccountTable from '../../grn/components/AccountTable';

const AddPurchaseInvoice = () => {
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
            print_description: '',
            total_po_quantity: 0,
            received_po_qty: 0,
            remaining_quantity: 0
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
                        supplier_name: invoice.supplierName,
                        address: invoice.address,
                        document_number: invoice.invoiceNumber,
                        supplier_challan_number: invoice.supplierInvoiceNumber,
                        document_date: invoice.supplierInvoiceDate?.split('T')[0],
                        booking_date: invoice.bookingDate?.split('T')[0],
                        credit_days: invoice.creditDays,
                        po_id: invoice.poId || '',
                        po_number: invoice.poNumber || '',
                        gst_no: invoice.gstNumber || ""
                    });
                    setItems(invoice.items.map(item => {
                        const qty = item.quantity || 0;
                        const rate = item.rate || 0;
                        const taxPct = 18; // Defaulting to 18 if not available, usually should be from product
                        const baseAmt = qty * rate;
                        const taxAmt = (baseAmt * taxPct) / 100;
                        return {
                            id: item.id,
                            product_id: item.productId,
                            product_code: item.productCode,
                            product_name: item.productName,
                            quantity: qty,
                            rate: rate,
                            uom: item.uom,
                            tax_percent: taxPct,
                            discount_amount: 0,
                            discount_percent: 0,
                            before_tax: baseAmt,
                            tax_amount: taxAmt,
                            total_amount: baseAmt + taxAmt,
                            print_description: item.productName,
                            total_po_quantity: 0, 
                            received_po_qty: 0,
                            remaining_quantity: 0
                        };
                    }));
                } else {
                    const nextNo = await purchaseInvoiceService.getNextNumber();
                    setFormData(prev => ({ ...prev, document_number: nextNo.invoiceNumber }));
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
            credit_days: supplier.supplierCreditDays || 0
        }));

        try {
            const poResponse = await purchaseOrderService.getPurchaseOrders({ 
                search: supplier.accountName 
            });
            const poList = Array.isArray(poResponse) ? poResponse : (poResponse.data || []);
            setPos(poList.filter(p => (p.status !== 'DELETED' && p.supplierName === supplier.accountName)));
        } catch (error) {
            console.error("Error fetching supplier POs:", error);
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
                const qty = item.quantity || 0;
                const rate = item.rate || 0;
                const discAmt = item.discountAmount || 0;
                const taxPct = item.taxPercent || 0;
                const befTax = (qty * rate) - discAmt;
                const taxAmt = (befTax * taxPct) / 100;
                return {
                    id: Date.now() + Math.random(),
                    product_id: item.product_id,
                    product_code: item.productCode,
                    product_name: item.productName,
                    quantity: qty,
                    rate: rate,
                    uom: item.uom,
                    discount_amount: discAmt,
                    discount_percent: item.discountPercent || 0,
                    hsn: item.hsnCode || '',
                    tax_percent: taxPct,
                    before_tax: befTax,
                    tax_amount: taxAmt,
                    total_amount: befTax + taxAmt,
                    print_description: item.productName,
                    total_po_quantity: item.quantity,
                    received_po_qty: 0,
                    remaining_quantity: 0
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
        if (!formData.supplier_challan_number) newErrors.supplier_challan_number = "Invoice number is required";
        if (!formData.document_date) newErrors.document_date = "Invoice date is required";

        const validItems = items.filter(item => item.product_id);
        if (validItems.length === 0) {
            newErrors.items = true;
        } else {
            const itemErrors = [];
            items.forEach((item, index) => {
                if (item.product_id) {
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
                supplierName: formData.supplier_name,
                address: formData.address,
                gstNumber: formData.gst_no,
                supplierInvoiceNumber: formData.supplier_challan_number,
                supplierInvoiceDate: formData.document_date,
                bookingDate: formData.booking_date,
                creditDays: parseInt(formData.credit_days),
                poId: formData.po_id ? parseInt(formData.po_id) : undefined,
                poNumber: formData.po_number || undefined,
                items: items.filter(i => i.product_id).map(i => ({
                    productId: i.product_id,
                    productCode: i.product_code,
                    productName: i.product_name,
                    quantity: parseFloat(i.quantity),
                    rate: parseFloat(i.rate),
                    uom: i.uom,
                    printDescription: i.print_description
                }))
            };

            if (isEditMode) {
                await purchaseInvoiceService.updateInvoice(id, payload);
                toast.success("Purchase Invoice updated successfully");
            } else {
                await purchaseInvoiceService.createInvoice(payload);
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

    return (
        <div className="flex flex-col gap-8 pb-20 font-outfit">
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <h2 className="text-[20px] font-bold text-[#111827]">Add Purchase Invoice</h2>
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
                    />
                </div>

                <div className="p-8">
                    <h2 className="text-[18px] font-bold text-[#111827] mb-6 flex items-center gap-2 tracking-tight uppercase">
                        <div className="w-1.5 h-6 bg-emerald-800 rounded-full"></div>
                        Account Summary
                    </h2>
                    <AccountTable items={items} />
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
