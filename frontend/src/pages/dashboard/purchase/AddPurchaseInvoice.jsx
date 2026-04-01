import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  FileText,
  Building2,
  Calendar,
  CreditCard,
  Package,
  Hash,
  IndianRupee,
  ChevronDown,
  X,
  CloudUpload,
  AlertCircle
} from "lucide-react";
import toast from 'react-hot-toast';
import purchaseInvoiceService from "../../../services/purchaseInvoiceService";
import purchaseOrderService from "../../../services/purchaseOrderService";
import productService from "../../../services/productService";
import accountService from "../../../services/accountService";

const AddPurchaseInvoice = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [pos, setPos] = useState([]);
    const [products, setProducts] = useState([]);
    
    const [formData, setFormData] = useState({
        supplierName: "",
        supplierInvoiceNumber: "",
        supplierInvoiceDate: new Date().toISOString().split('T')[0],
        bookingDate: new Date().toISOString().split('T')[0],
        address: "",
        creditDays: 30,
        poId: null,
        poNumber: "",
        challanNumber: "",
        items: [{ productCode: "", productName: "", quantity: 1, rate: 0, uom: "Nos" }]
    });

    const [uploadedFile, setUploadedFile] = useState(null);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const [suppResponse, prodResponse] = await Promise.all([
                    purchaseInvoiceService.getSuppliers(user.id),
                    productService.getProducts()
                ]);
                
                // Account Master structure fix
                const supplierData = Array.isArray(suppResponse) ? suppResponse : (suppResponse.data || []);
                setSuppliers(supplierData);
                
                // Product structure fix
                const productData = Array.isArray(prodResponse) ? prodResponse : (prodResponse.products || prodResponse.data || []);
                setProducts(productData);
            } catch (error) {
                console.error("Error loading form data:", error);
                toast.error("Failed to load setup data");
            }
        };
        loadInitialData();
    }, []);

    const handleSupplierChange = async (name) => {
        const supplier = suppliers.find(s => s.accountName === name);
        if (supplier) {
            setFormData(prev => ({
                ...prev,
                supplierName: name,
                address: (supplier.addressLine1 || "") + (supplier.addressLine2 ? ", " + supplier.addressLine2 : ""),
                creditDays: supplier.supplierCreditDays || 30,
                poId: null,
                poNumber: ""
            }));
            
            // Load POs for this supplier
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const poResponse = await purchaseInvoiceService.getSupplierPOs(name, user.id);
            setPos(poResponse.data || poResponse || []);
        } else {
            setFormData(prev => ({ ...prev, supplierName: name }));
        }
    };

    const handlePOChange = (id) => {
        const po = pos.find(p => p.id === parseInt(id));
        if (po) {
            setFormData(prev => ({ ...prev, poId: po.id, poNumber: po.poNumber }));
            toast.success(`Linked to PO: ${po.poNumber}`);
        } else {
            setFormData(prev => ({ ...prev, poId: null, poNumber: "" }));
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        
        // If product changed, auto-fill name/rate/uom
        if (field === 'productCode') {
            const prod = products.find(p => p.hsn_code === value || p.product_name === value);
            if (prod) {
                newItems[index].productName = prod.product_name;
                newItems[index].rate = prod.rate || 0;
                newItems[index].uom = prod.unit_name || "Nos";
            }
        }
        
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { productCode: "", productName: "", quantity: 1, rate: 0, uom: "Nos" }]
        }));
    };

    const removeItem = (index) => {
        if (formData.items.length === 1) {
            toast.error("At least one item is required");
            return;
        }
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const calculateTotal = () => {
        const taxable = formData.items.reduce((acc, curr) => acc + (curr.quantity * curr.rate), 0);
        const tax = (taxable * 18) / 100;
        return { taxable, tax, grand: taxable + tax };
    };

    const totals = calculateTotal();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.supplierName) return toast.error("Supplier is required");
        if (!formData.supplierInvoiceNumber) return toast.error("Invoice number is required");
        
        setIsLoading(true);
        try {
            await purchaseInvoiceService.createInvoice(formData, uploadedFile);
            toast.success("Purchase Invoice created successfully!");
            if (!formData.poId) {
                toast.success("A linked PO has been automatically generated.");
            }
            navigate('../');
        } catch (error) {
            console.error("Submission error:", error);
            toast.error(error.response?.data?.message || "Failed to create invoice");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20 font-['Plus_Jakarta_Sans']">
            <div className="max-w-5xl mx-auto px-4 pt-8">
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate(-1)}
                            className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-500 hover:text-[#073318] hover:bg-emerald-50 transition-all shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Purchase Invoice</h1>
                            <p className="text-gray-500 text-sm font-medium">Add a new invoice to your records</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {!formData.poId && (
                           <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-[#073318] rounded-lg border border-emerald-100 animate-pulse">
                               <AlertCircle className="w-4 h-4" />
                               <span className="text-xs font-bold uppercase tracking-tight">Automatic PO generation active</span>
                           </div>
                        )}
                        <button 
                            onClick={() => navigate(-1)}
                            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-8 py-2.5 bg-[#073318] text-white rounded-xl font-bold hover:bg-[#0a4d25] transition-all shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? <Plus className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>{isLoading ? "Saving..." : "Save Invoice"}</span>
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info Card */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
                        <div className="flex items-center gap-2 mb-6">
                           <div className="w-1.5 h-6 bg-[#073318] rounded-full" />
                           <h2 className="text-lg font-bold text-gray-800">General Information</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 ml-1">
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                    Supplier Name <span className="text-red-500">*</span>
                                </label>
                                <select 
                                    className="w-full px-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318]/30 transition-all font-medium text-gray-700 h-[52px]"
                                    value={formData.supplierName}
                                    onChange={(e) => handleSupplierChange(e.target.value)}
                                    required
                                >
                                    <option value="">Select Supplier</option>
                                    {suppliers.map(s => <option key={s.id} value={s.accountName}>{s.accountName}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2 text-sm font-bold text-gray-700 ml-1">
                                <label className="flex items-center gap-2 mb-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    Linked P.O.
                                </label>
                                <select 
                                    className="w-full px-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318]/30 transition-all font-medium text-gray-700 h-[52px]"
                                    value={formData.poId || ""}
                                    onChange={(e) => handlePOChange(e.target.value)}
                                >
                                    <option value="">Create from scratch (Auto PO)</option>
                                    {pos.map(p => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 ml-1">
                                    <Hash className="w-4 h-4 text-gray-400" />
                                    Supplier Invoice No. <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Enter physical invoice no" 
                                    className="w-full px-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318]/30 transition-all font-medium"
                                    value={formData.supplierInvoiceNumber}
                                    onChange={(e) => setFormData({...formData, supplierInvoiceNumber: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 ml-1">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    Supplier Invoice Date <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    type="date" 
                                    className="w-full px-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318]/30 transition-all font-medium"
                                    value={formData.supplierInvoiceDate}
                                    onChange={(e) => setFormData({...formData, supplierInvoiceDate: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 ml-1">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    Record/Booking Date
                                </label>
                                <input 
                                    type="date" 
                                    className="w-full px-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318]/30 transition-all font-medium"
                                    value={formData.bookingDate}
                                    onChange={(e) => setFormData({...formData, bookingDate: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 ml-1">
                                    <CreditCard className="w-4 h-4 text-gray-400" />
                                    Credit Days
                                </label>
                                <input 
                                    type="number" 
                                    className="w-full px-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318]/30 transition-all font-medium"
                                    value={formData.creditDays}
                                    onChange={(e) => setFormData({...formData, creditDays: parseInt(e.target.value)})}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Card */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-6 bg-[#073318] rounded-full" />
                               <h2 className="text-lg font-bold text-gray-800">Items List</h2>
                            </div>
                            <button 
                                type="button"
                                onClick={addItem}
                                className="flex items-center gap-2 px-4 py-2 text-[#073318] bg-emerald-50 rounded-xl font-bold hover:bg-emerald-100 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Row</span>
                            </button>
                        </div>
                        <div className="p-8 pb-4">
                            <div className="space-y-4">
                                {formData.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-wrap lg:flex-nowrap gap-4 items-end bg-gray-50/30 p-4 rounded-3xl relative animate-in fade-in slide-in-from-right-4 duration-300">
                                        <div className="flex-1 min-w-[200px] space-y-2">
                                            <label className="text-[11px] font-extrabold text-gray-500 uppercase ml-1">Product</label>
                                            <select 
                                                className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#073318]/10 font-bold text-gray-700"
                                                value={item.productCode}
                                                onChange={(e) => handleItemChange(idx, 'productCode', e.target.value)}
                                            >
                                                <option value="">Select Product</option>
                                                {products.map(p => <option key={p.id} value={p.product_name}>{p.product_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-24 space-y-2">
                                            <label className="text-[11px] font-extrabold text-gray-500 uppercase ml-1">Qty</label>
                                            <input 
                                                type="number" 
                                                className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#073318]/10 font-bold"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                                            />
                                        </div>
                                        <div className="w-24 space-y-2">
                                            <label className="text-[11px] font-extrabold text-gray-500 uppercase ml-1">UOM</label>
                                            <input 
                                                type="text" 
                                                className="w-full px-4 py-2.5 bg-gray-50/50 border-transparent rounded-xl font-bold text-gray-500 cursor-not-allowed"
                                                value={item.uom}
                                                readOnly
                                            />
                                        </div>
                                        <div className="w-32 space-y-2">
                                            <label className="text-[11px] font-extrabold text-gray-500 uppercase ml-1">Rate (₹)</label>
                                            <input 
                                                type="number" 
                                                className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#073318]/10 font-bold"
                                                value={item.rate}
                                                onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value))}
                                            />
                                        </div>
                                        <div className="w-32 space-y-2">
                                            <label className="text-[11px] font-extrabold text-gray-500 uppercase ml-1">Total</label>
                                            <div className="w-full px-4 py-2.5 bg-[#073318]/5 rounded-xl font-bold text-[#073318]">
                                                ₹{(item.quantity * item.rate).toLocaleString()}
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => removeItem(idx)}
                                            className="p-2.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all mb-0.5"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Totals Section */}
                        <div className="bg-gray-50/50 p-8 border-t border-gray-100">
                           <div className="flex flex-col md:flex-row gap-8">
                               <div className="flex-1 space-y-4">
                                   <div className="space-y-2">
                                       <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-2">
                                           <CloudUpload className="w-4 h-4 text-gray-400" />
                                           Attachment (Image/PDF)
                                       </label>
                                       <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-emerald-50/30 hover:border-emerald-200 transition-all group">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <CloudUpload className="w-8 h-8 text-gray-300 group-hover:text-emerald-500 transition-colors mb-2" />
                                                <p className="text-sm font-bold text-gray-500 group-hover:text-emerald-700">
                                                    {uploadedFile ? uploadedFile.name : "Click to upload physical copy"}
                                                </p>
                                            </div>
                                            <input type="file" className="hidden" onChange={(e) => setUploadedFile(e.target.files[0])} />
                                       </label>
                                   </div>
                               </div>
                               <div className="w-full md:w-80 space-y-3">
                                   <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
                                       <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Subtotal</span>
                                       <span className="text-lg font-bold text-gray-800 tracking-tight">₹{totals.taxable.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
                                       <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">GST (18%)</span>
                                       <span className="text-lg font-bold text-gray-800 tracking-tight">₹{totals.tax.toLocaleString()}</span>
                                   </div>
                                   <div className="flex justify-between items-center px-6 py-4 bg-[#073318] rounded-2xl shadow-xl shadow-emerald-900/10">
                                       <span className="text-sm font-extrabold text-emerald-100 uppercase tracking-widest">Grand Total</span>
                                       <span className="text-2xl font-black text-white tracking-tighter">₹{totals.grand.toLocaleString()}</span>
                                   </div>
                               </div>
                           </div>
                        </div>
                    </div>
                </form>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slide-in-from-right-4 { from { transform: translateX(1rem); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .animate-in { animation-duration: 400ms; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); animation-fill-mode: forwards; }
                .fade-in { animation-name: fade-in; }
                .slide-in-from-right-4 { animation-name: slide-in-from-right-4; }
            `}} />
        </div>
    );
};

export default AddPurchaseInvoice;
