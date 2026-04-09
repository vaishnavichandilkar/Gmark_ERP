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

import salesOrderService from '../../../services/salesOrderService';

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

const ViewSO = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = false;
    
    const [isLoading, setIsLoading] = useState(true);
    const [salesOrder, setSalesOrder] = useState(null);
    const [formData, setFormData] = useState({
        customer_name: '',
        credit_days: '',
        address: '',
        creation_date: '',
        expiry_date: '',
        so_number: '',
        gst_number: '',
        pan_number: '',
        status: '',
        customer_type: ''
    });
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchSO = async () => {
            setIsLoading(true);
            try {
                const response = await salesOrderService.getSalesOrderById(id);
                const so = response.data || response;
                setSalesOrder(so);
                setFormData({
                    customer_name: so.customerName,
                    credit_days: so.creditDays,
                    address: so.address,
                    creation_date: so.soCreationDate,
                    expiry_date: so.expiryDate,
                    so_number: so.soNumber,
                    gst_number: so.gstNumber,
                    pan_number: so.panNumber,
                    status: so.status,
                    customer_type: so.customerType
                });
                setItems(so.items || []);
            } catch (error) {
                console.error("Error fetching SO details:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (id) fetchSO();
    }, [id]);

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const date = new Date(dateStr);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 font-outfit">
            <style>{`
                .custom-so-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-so-scrollbar::-webkit-scrollbar-track { background: #E5E7EB; }
                .custom-so-scrollbar::-webkit-scrollbar-thumb { background: #A7C0B8; border-radius: 4px; }
                .custom-so-scrollbar::-webkit-scrollbar-thumb:hover { background: #014A36; }
            `}</style>

            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-b border-[#F3F4F6] gap-4">
                    <h2 className="text-[18px] md:text-[20px] font-bold text-[#111827]">
                        View Sales Order
                    </h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {!isLoading && (
                            <button 
                                onClick={() => navigate(ROUTES.SALES_ORDER_EDIT.replace(':id', id))}
                                className="flex-1 sm:flex-none px-6 md:px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[14px] md:text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-md flex items-center justify-center gap-2"
                            >
                                Edit SO
                            </button>
                        )}
                        <button 
                            onClick={() => navigate(-1)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 h-[44px] border border-[#E5E7EB] rounded-[10px] text-[14px] md:text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all font-outfit"
                        >
                            <ArrowLeft size={18} /> Back
                        </button>
                    </div>
                </div>

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
                                {formData.so_number ? `#${formData.so_number}` : '-'}
                            </h1>
                            <div className="flex gap-2">
                                <div className="inline-flex items-center px-4 py-1.5 bg-[#4B5563] text-white rounded-[100px] text-[14px] font-medium">
                                    Sales Order
                                </div>
                                {formData.status && (
                                    <div className={`inline-flex items-center px-4 py-1.5 rounded-[100px] text-[14px] font-bold shadow-sm border ${
                                        formData.status === 'completed' ? 'bg-[#D1FAE5] text-[#059669] border-[#A7F3D0]' :
                                        'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
                                    }`}>
                                        {formData.status}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-sm">
                            <InfoTableRow label1="Customer Name:" value1={formData.customer_name} label2="Credit Days:" value2={formData.credit_days} />
                            <InfoTableRow label1="Address:" value1={formData.address} label2="SO Creation Date:" value2={formatDate(formData.creation_date)} />
                            <InfoTableRow label1="Expiry Date:" value1={formatDate(formData.expiry_date)} label2="GST Number:" value2={formData.gst_number} />
                            <InfoTableRow label1="PAN Number:" value1={formData.pan_number} label2="Customer Type:" value2={formData.customer_type ? formData.customer_type.toUpperCase() : '-'} />
                        </div>
                    </div>
                )}

                <div className="p-8">
                    <div className="overflow-x-auto custom-so-scrollbar border border-[#E5E7EB] rounded-[12px]">
                        <table className="w-full min-w-[1200px] border-collapse bg-white">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">#</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-left">Product</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right">Qty</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right">Rate</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right">Tax %</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right">Total Amt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                                {items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors h-[60px]">
                                        <td className="px-4 py-4 text-center text-[13px] text-[#6B7280]">{index + 1}</td>
                                        <td className="px-4 py-4 text-[13px] font-bold text-[#111827]">{item.productName}</td>
                                        <td className="px-4 py-4 text-right text-[13px] text-[#6B7280]">{item.quantity}</td>
                                        <td className="px-4 py-4 text-right text-[13px] text-[#6B7280]">{item.rate}</td>
                                        <td className="px-4 py-4 text-right text-[13px] text-[#6B7280]">{item.taxPercent}%</td>
                                        <td className="px-4 py-4 text-right text-[13px] font-bold text-[#073318]">₹ {item.totalAmount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewSO;
