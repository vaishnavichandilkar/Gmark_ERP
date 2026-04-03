import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';
import { 
    ArrowLeft, 
    Search, 
    Trash2, 
    Plus, 
    Save, 
    X,
    Edit3,
    Printer,
    ChevronsUpDown
} from 'lucide-react';

import purchaseOrderService from '../../../services/purchaseOrderService';

const InfoTableRow = ({ label1, value1, label2, value2, isEditMode, renderEdit1, renderEdit2 }) => (
    <div className={`flex flex-col sm:flex-row border-[#E5E7EB] border-b last:border-0 font-outfit`}>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label1}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white flex items-center">
            {isEditMode && renderEdit1 ? renderEdit1() : (value1 || '-')}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label2}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] bg-white flex items-center">
            {isEditMode && renderEdit2 ? renderEdit2() : (value2 || '-')}
        </div>
    </div>
);

const ViewPO = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = false;
    
    const [isLoading, setIsLoading] = useState(true);
    const [purchaseOrder, setPurchaseOrder] = useState(null);
    const [formData, setFormData] = useState({
        supplier_name: '',
        credit_days: '',
        address: '',
        creation_date: '',
        expiry_date: '',
        po_number: '',
        gst_number: '',
        pan_number: '',
        status: ''
    });
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchPO = async () => {
            setIsLoading(true);
            try {
                const response = await purchaseOrderService.getPurchaseOrderById(id);
                const po = response.data || response;
                setPurchaseOrder(po);
                setFormData({
                    supplier_name: po.supplierName,
                    credit_days: po.creditDays,
                    address: po.address,
                    creation_date: po.poCreationDate,
                    expiry_date: po.expiryDate,
                    po_number: po.poNumber,
                    gst_number: po.gstNumber,
                    pan_number: po.panNumber,
                    status: po.status
                });
                setItems(po.items || []);
            } catch (error) {
                console.error("Error fetching PO details:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (id) fetchPO();
    }, [id]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const filteredSuppliers = []; 
    const filteredProducts = [];  
    const isSupplierDropdownOpen = false;
    const isProductSearchOpen = false;
    const supplierSearch = "";
    const tableSearch = "";

    const handleSelectSupplier = (supplier) => {
        // Placeholder for future edit mode
    };

    const handleQuickAddProduct = (product) => {
        // Placeholder for future edit mode
    };

    const handleItemChange = () => {
        // Placeholder for future edit mode
    };

    const handlePrintPreview = () => {
        const fullPOData = {
            ...formData,
            items: items
        };
        navigate(ROUTES.PURCHASE_ORDER_PRINT, { state: { poData: fullPOData } });
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 font-outfit">
            <style>{`
                .custom-po-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-po-scrollbar::-webkit-scrollbar-track { background: #E5E7EB; }
                .custom-po-scrollbar::-webkit-scrollbar-thumb { background: #A7C0B8; border-radius: 4px; }
                .custom-po-scrollbar::-webkit-scrollbar-thumb:hover { background: #014A36; }
            `}</style>

            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                {/* Card Header Section */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-[#F3F4F6] gap-4">
                    <h2 className="text-[18px] md:text-[20px] font-bold text-[#111827]">
                        View PO
                    </h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {(() => {
                            if (isLoading || (formData.status !== 'PENDING' && formData.status !== 'Approved')) return null;
                            
                            const parseDate = (d) => {
                                if (!d) return new Date();
                                if (d.includes && d.includes("T")) return new Date(d);
                                const parts = String(d).split('-');
                                if (parts.length === 3) {
                                    const [p1, p2, p3] = parts;
                                    if (p1.length === 4) return new Date(d);
                                    return new Date(Number(p3), Number(p2) - 1, Number(p1));
                                }
                                return new Date(d);
                            };
                            
                            const expDate = parseDate(formData.expiry_date);
                            const expiryEndOfDay = new Date(expDate);
                            expiryEndOfDay.setHours(23, 59, 59, 999);
                            if (expiryEndOfDay < new Date()) return null;

                            return (
                                <button 
                                    onClick={() => navigate(ROUTES.PURCHASE_ORDER_EDIT.replace(':id', id))}
                                    className="flex-1 sm:flex-none px-6 md:px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[14px] md:text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    Edit PO
                                </button>
                            );
                        })()}

                        <button 
                            onClick={() => navigate(-1)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 h-[44px] border border-[#E5E7EB] rounded-[10px] text-[14px] md:text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all font-outfit"
                        >
                            <ArrowLeft size={18} /> 
                            <span className="hidden sm:inline">Back</span>
                            <span className="sm:hidden text-gray-500">Back</span>
                        </button>
                    </div>
                </div>

                {/* Information Section */}
                {isLoading ? (
                    <div className="p-8 space-y-4 animate-pulse">
                        <div className="h-4 bg-gray-100 rounded w-1/4"></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-10 bg-gray-50 rounded"></div>
                            <div className="h-10 bg-gray-50 rounded"></div>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 md:p-8 border-b border-[#F3F4F6] flex flex-col">
                        <div className="mb-6">
                            <h1 className="text-[28px] md:text-[32px] font-bold text-[#111827] mb-2 uppercase">
                                {formData.po_number ? `#${formData.po_number}` : '-'}
                            </h1>
                            <div className="flex gap-2">
                                <div className="inline-flex items-center px-4 py-1.5 bg-[#4B5563] text-white rounded-[100px] text-[14px] font-medium">
                                    Purchase Order
                                </div>
                                {formData.status && (
                                    <div className={`inline-flex items-center px-4 py-1.5 rounded-[100px] text-[14px] font-bold shadow-sm border ${
                                        formData.status === 'Approved' ? 'bg-[#D1FAE5] text-[#059669] border-[#A7F3D0]' :
                                        'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
                                    }`}>
                                        {formData.status}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-sm">
                            <InfoTableRow label1="Supplier Name:" value1={formData.supplier_name} label2="Credit Days:" value2={formData.credit_days} />
                            <InfoTableRow label1="Address:" value1={formData.address} label2="PO Creation Date:" value2={formatDate(formData.creation_date)} />
                            <InfoTableRow label1="Expiry Date:" value1={formatDate(formData.expiry_date)} label2="GST Number:" value2={formData.gst_number} />
                            <div className="flex border-b border-[#E5E7EB] last:border-0 font-outfit">
                                <div className="w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-[#E5E7EB] bg-gray-50/10 font-semibold">PAN Number:</div>
                                <div className="flex-1 py-3.5 px-6 text-[13px] text-[#111827] bg-white">{formData.pan_number || '-'}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table Section */}
                <div className="p-8">
                    {isEditMode && (
                        <div className="relative w-full max-w-[400px] mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                            <input
                                type="text"
                                placeholder="Search By Anything..."
                                value={tableSearch}
                                onFocus={() => setIsProductSearchOpen(true)}
                                onChange={(e) => {
                                    setTableSearch(e.target.value);
                                    setIsProductSearchOpen(true);
                                }}
                                className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[12px] pl-12 pr-4 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all font-outfit"
                            />
                            {isProductSearchOpen && filteredProducts.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[60] overflow-hidden py-1">
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {filteredProducts.map(p => (
                                            <button 
                                                key={p.id} 
                                                onClick={() => handleQuickAddProduct(p)} 
                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-all text-left border-b border-[#F3F4F6] last:border-0"
                                            >
                                                <div>
                                                    <div className="font-bold text-[#111827] text-[14px]">{p.name}</div>
                                                    <div className="text-[12px] text-gray-400">Rate: ₹{p.rate} | UOM: {p.uom}</div>
                                                </div>
                                                <Plus size={16} className="text-[#073318]" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="overflow-x-auto custom-po-scrollbar border border-[#E5E7EB] rounded-[12px]">
                        <table className="w-full min-w-[2000px] border-collapse bg-white">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">#</th>
                                    {[
                                        {label: "Product Code", width: "160px"},
                                        {label: "Product", width: "350px"},
                                        {label: "Qty", width: "120px", align: "right"},
                                        {label: "UOM", width: "100px"},
                                        {label: "Rate", width: "140px", align: "right"},
                                        {label: "Disc Amt", width: "130px", align: "right"},
                                        {label: "Disc %", width: "120px", align: "right"},
                                        {label: "HSN", width: "130px"},
                                        {label: "Tax %", width: "100px", align: "right"},
                                        {label: "Before Tax", width: "150px", align: "right"},
                                        {label: "Tax Amt", width: "140px", align: "right"},
                                        {label: "Total Amt", width: "160px", align: "right"},
                                        {label: "Description", width: "250px"},
                                        {label: "Action", width: "80px", align: "center"}
                                    ].map((col, idx) => (
                                        <th 
                                            key={idx} 
                                            className={`px-4 py-4 text-[13px] font-bold text-[#4B5563] text-${col.align || 'left'} border-l border-[#F3F4F6]`}
                                            style={{ width: col.width }}
                                        >
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                                {isLoading ? Array(2).fill({}).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={14} className="px-4 py-6 border-b border-gray-100"><div className="h-4 bg-gray-50 rounded w-full"></div></td>
                                    </tr>
                                )) : items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group h-[60px]">
                                        <td className="px-4 py-4 text-center text-[13px] text-[#6B7280]">{index + 1}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-[#111827]">{item.productCode}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] font-bold text-[#111827]">{item.productName}</td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="px-2 text-right text-[13px] font-medium">{parseFloat(item.quantity).toFixed(2)}</div>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{item.uom}</td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="px-2 text-right text-[13px]">{parseFloat(item.rate).toFixed(2)}</div>
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="px-2 text-right text-[13px]">{parseFloat(item.discountAmount).toFixed(2)}</div>
                                        </td>
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <div className="px-2 text-right text-[13px]">{parseFloat(item.discountPercent).toFixed(2)}%</div>
                                        </td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{item.hsnCode}</td>
                                        <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{item.taxPercent}%</td>
                                        <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{(item.quantity * item.rate - item.discountAmount).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{parseFloat(((item.quantity * item.rate - item.discountAmount) * item.taxPercent / 100)).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] font-bold text-[#073318]">₹ {(((item.quantity * item.rate - item.discountAmount) * (1 + item.taxPercent / 100))).toFixed(2)}</td>
                                        <td className="px-4 py-4 border-l border-[#F3F4F6]">
                                            <div className="text-[12px] text-[#6B7280] truncate max-w-[200px]" title={item.printDescription}>{item.description || item.printDescription || '-'}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-[#F9FAFB] border-t-2 border-[#E5E7EB] font-bold">
                                <tr>
                                    <td colSpan={3} className="px-4 py-5 text-[14px]">Total Summary</td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        {isLoading ? <div className="h-4 bg-gray-100 rounded w-12 ml-auto"></div> : items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        {isLoading ? <div className="h-4 bg-gray-100 rounded w-16 ml-auto"></div> : items.reduce((s, i) => s + (parseFloat(i.quantity * i.rate - i.discountAmount) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        {isLoading ? <div className="h-4 bg-gray-100 rounded w-16 ml-auto"></div> : items.reduce((s, i) => s + (parseFloat((i.quantity * i.rate - i.discountAmount) * i.taxPercent / 100) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right text-[#073318]">
                                        {isLoading ? <div className="h-5 bg-[#073318]/10 rounded w-24 ml-auto"></div> : `₹ ${items.reduce((s, i) => s + (parseFloat((i.quantity * i.rate - i.discountAmount) * (1 + i.taxPercent / 100)) || 0), 0).toFixed(2)}`}
                                    </td>
                                    <td colSpan={2} className="border-l border-[#F3F4F6]"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Card Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 px-4 sm:px-8 py-6 border-t border-[#F3F4F6] bg-gray-50/10">
                    <button 
                        onClick={handlePrintPreview}
                        className="w-full sm:w-auto px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#052611] transition-all shadow-md flex items-center justify-center gap-2"
                    >
                        <Printer size={18} />
                        Preview & Print
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ViewPO;
