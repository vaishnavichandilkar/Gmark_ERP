import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { 
    ArrowLeft, 
    Trash2, 
    Edit3,
    Printer,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

import grnService from '@/services/grnService';

const InfoTableRow = ({ label1, value1, label2, value2 }) => (
    <div className="flex flex-col sm:flex-row border-[#E5E7EB] border-b last:border-0 font-outfit">
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label1}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white flex items-center">
            {value1 || '-'}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label2}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] bg-white flex items-center">
            {value2 || '-'}
        </div>
    </div>
);

const ViewGRN = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    
    const [isLoading, setIsLoading] = useState(true);
    const [grn, setGrn] = useState(null);
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchGRN = async () => {
            setIsLoading(true);
            try {
                const data = await grnService.getGRNById(id);
                setGrn(data);
                setItems(data.items || []);
            } catch (error) {
                console.error("Error fetching GRN details:", error);
                toast.error("Failed to load GRN details");
            } finally {
                setIsLoading(false);
            }
        };
        if (id) fetchGRN();
    }, [id]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="animate-spin text-emerald-800" size={32} />
            </div>
        );
    }

    if (!grn) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl font-bold text-gray-600">GRN not found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-emerald-800 font-bold underline">Go Back</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 font-outfit">
            <style>{`
                .custom-grn-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-grn-scrollbar::-webkit-scrollbar-track { background: #E5E7EB; }
                .custom-grn-scrollbar::-webkit-scrollbar-thumb { background: #A7C0B8; border-radius: 4px; }
                .custom-grn-scrollbar::-webkit-scrollbar-thumb:hover { background: #014A36; }
            `}</style>

            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-6 border-b border-[#F3F4F6] gap-4">
                    <h2 className="text-[20px] font-bold text-[#111827]">View Goods Receipt Note</h2>
                    <div className="flex items-center gap-3">
                        {grn.status !== 'DELETED' && (
                            <button 
                                onClick={() => navigate(`/seller/purchase/grn/edit/${id}`)}
                                className="px-6 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all flex items-center gap-2"
                            >
                                <Edit3 size={18} /> Edit
                            </button>
                        )}
                        <button 
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 px-6 h-[44px] border border-[#E5E7EB] rounded-[10px] text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all"
                        >
                            <ArrowLeft size={18} /> Back
                        </button>
                    </div>
                </div>

                {/* Information Section */}
                <div className="p-8 border-b border-[#F3F4F6]">
                    <div className="mb-6">
                        <h1 className="text-[32px] font-bold text-[#111827] mb-2 uppercase tracking-tight">#{grn.grnNumber}</h1>
                        <div className="flex gap-2">
                            <span className="px-4 py-1.5 bg-[#4B5563] text-white rounded-full text-[13px] font-bold">GRN DETAILS</span>
                            <span className={`px-4 py-1.5 rounded-full text-[13px] font-bold border ${
                                grn.status === 'DELETED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                                {grn.status === 'DELETED' ? 'DELETED' : 'GENERATED'}
                            </span>
                        </div>
                    </div>

                    <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-sm">
                        <InfoTableRow label1="Supplier Name:" value1={grn.supplierName} label2="Credit Days:" value2={grn.creditDays} />
                        <InfoTableRow label1="Supplier Address:" value1={grn.address} label2="PO Number:" value2={grn.poNumber} />
                        <InfoTableRow label1="Supplier Challan No:" value1={grn.challanNumber} label2="Booking Date:" value2={formatDate(grn.bookingDate)} />
                        <InfoTableRow label1="Challan Date:" value1={formatDate(grn.grnDate)} label2="GST Number:" value2={grn.gstNumber} />
                    </div>
                </div>

                {/* Table Section */}
                <div className="p-8">
                    <div className="overflow-x-auto custom-grn-scrollbar border border-[#E5E7EB] rounded-[12px]">
                        <table className="w-full min-w-[1200px] border-collapse bg-white">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563]">#</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-left border-l border-[#F3F4F6]">Product Code</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-left border-l border-[#F3F4F6]">Product Name</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">Quantity</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-left border-l border-[#F3F4F6]">UOM</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">Rate</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">Tax %</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">Before Tax</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">Tax Amount</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">Total Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                                {items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors h-[52px]">
                                        <td className="px-4 py-4 text-center text-[13px] text-[#6B7280]">{index + 1}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-[#111827]">{item.productCode}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] font-bold text-[#111827]">{item.productName}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right font-medium">{parseFloat(item.quantity).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-center text-gray-500 uppercase">{item.uom}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right">₹{parseFloat(item.rate).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right font-bold text-emerald-800">{parseFloat(item.taxPercent).toFixed(2)}%</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right">₹{parseFloat(item.beforeTaxAmount).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right">₹{parseFloat(item.taxAmount).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right font-bold text-[#073318]">₹{parseFloat(item.totalAmount).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-[#F9FAFB] border-t-2 border-[#E5E7EB] font-bold">
                                <tr>
                                    <td colSpan={3} className="px-4 py-5 text-[14px]">Total Summary</td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        {items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0).toFixed(2)}
                                    </td>
                                    <td colSpan={3} className="border-l border-[#F3F4F6]"></td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        ₹{items.reduce((s, i) => s + (parseFloat(i.beforeTaxAmount) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        ₹{items.reduce((s, i) => s + (parseFloat(i.taxAmount) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right text-[#073318]">
                                        ₹{parseFloat(grn.grandTotal || items.reduce((s, i) => s + (parseFloat(i.totalAmount) || 0), 0)).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="flex justify-end px-8 py-6 border-t border-[#F3F4F6] bg-gray-50/10">
                    <button className="px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#052611] transition-all flex items-center gap-2 shadow-md">
                        <Printer size={18} /> Print Record
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ViewGRN;
