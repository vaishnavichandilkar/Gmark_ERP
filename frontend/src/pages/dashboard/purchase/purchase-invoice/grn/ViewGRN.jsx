import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { 
    ArrowLeft, 
    Trash2, 
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

import grnService from '@/services/grnService';
import { getStandardGstUom } from '@/utils/uomUtils';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/dateUtils';

const InfoTableRow = ({ label1, value1, label2, value2 }) => (
    <div className="flex flex-col sm:flex-row border-[#E5E7EB] border-b last:border-0 font-outfit">
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label1}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white flex items-center">
            {value1 !== null && value1 !== undefined && value1 !== '' ? value1 : '-'}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label2}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] bg-white flex items-center">
            {value2 !== null && value2 !== undefined && value2 !== '' ? value2 : '-'}
        </div>
    </div>
);

const ViewGRN = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();
    const { id } = useParams();
    
    const [isLoading, setIsLoading] = useState(true);
    const [grn, setGrn] = useState(null);
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetchGRN = async () => {
            console.log("Fetching GRN with ID:", id);
            setIsLoading(true);
            try {
                const data = await grnService.getGRNById(id);
                console.log("Successfully loaded GRN data:", data);
                setGrn(data);
                setItems(data.items || []);
            } catch (error) {
                console.error("Error fetching GRN details:", error);
                const errorMsg = error.response?.data?.message || error.message || "Unknown error";
                toast.error(`Failed to load: ${errorMsg}`);
            } finally {
                setIsLoading(false);
            }
        };
        if (id) fetchGRN();
    }, [id]);



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
                    <h2 className="text-[20px] font-bold text-[#111827]">{t('modules:view_goods_receipt_note', 'View Goods Receipt Note')}</h2>
                    <div className="flex items-center gap-3">
                        {grn.status !== 'DELETED' && !grn.isInvoiced && (
                            <button 
                                onClick={() => navigate(`/seller/purchase/grn/edit/${id}`)}
                                className="px-6 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all flex items-center gap-2"
                            >
                                {t('common:edit')}
                            </button>
                        )}
                        <button 
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 px-6 h-[44px] border border-[#E5E7EB] rounded-[10px] text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all"
                        >
                            <ArrowLeft size={18} /> {t('common:back')}
                        </button>
                    </div>
                </div>

                {/* Information Section */}
                <div className="p-8 border-b border-[#F3F4F6]">
                    <div className="mb-6">
                        <h1 className="text-[32px] font-bold text-[#111827] mb-2 uppercase tracking-tight">#{grn.grnNumber}</h1>
                        <div className="flex gap-2">
                            <span className="px-4 py-1.5 bg-[#4B5563] text-white rounded-full text-[13px] font-bold">{t('modules:grn_details', 'GRN DETAILS')}</span>
                            <span className={`px-4 py-1.5 rounded-full text-[13px] font-bold border ${
                                grn.status === 'DELETED' ? 'bg-red-50 text-red-600 border-red-100' : (grn.isInvoiced ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100')
                            }`}>
                                {grn.status === 'DELETED' ? t('modules:deleted', 'DELETED') : (grn.isInvoiced ? t('modules:invoiced', 'INVOICED') : t('modules:generated', 'GENERATED'))}
                            </span>
                        </div>
                    </div>

                    <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-sm">
                        <InfoTableRow label1={t('modules:supplier_name') + ":"} value1={grn.supplierName} label2={t('modules:credit_days_col') + ":"} value2={grn.creditDays} />
                        <InfoTableRow label1={t('modules:supplier_address', 'Supplier Address') + ":"} value1={grn.address} label2={t('modules:po_number', 'PO Number') + ":"} value2={grn.poNumber} />
                        <InfoTableRow label1={t('modules:supplier_challan_no', 'Supplier Challan No') + ":"} value1={grn.challanNumber} label2={t('modules:booking_date', 'Booking Date') + ":"} value2={formatDate(grn.bookingDate)} />
                        <InfoTableRow label1={t('modules:challan_date', 'Challan Date') + ":"} value1={formatDate(grn.grnDate)} label2={t('modules:gst_number_col') + ":"} value2={grn.gstNumber} />
                    </div>
                </div>

                {/* Table Section */}
                <div className="p-8">
                    <div className="overflow-x-auto custom-grn-scrollbar border border-[#E5E7EB] rounded-[12px]">
                        <table className="w-full min-w-[1200px] border-collapse bg-white">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563]">#</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-left border-l border-[#F3F4F6]">{t('modules:product_code')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-left border-l border-[#F3F4F6]">{t('modules:product_name')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">{t('modules:quantity')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-left border-l border-[#F3F4F6]">{t('modules:uom')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">{t('modules:rate')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">{t('modules:tax_percent', 'Tax %')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">{t('modules:before_tax', 'Before Tax')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">{t('modules:tax_amount')}</th>
                                    <th className="px-4 py-4 text-[13px] font-bold text-[#4B5563] text-right border-l border-[#F3F4F6]">{t('modules:amount_col')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                                {items.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors h-[52px]">
                                        <td className="px-4 py-4 text-center text-[13px] text-[#6B7280]">{index + 1}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-[#111827]">{item.productCode}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] font-bold text-[#111827]">{item.productName}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right font-medium">{parseFloat(item.receivedQty !== undefined && item.receivedQty !== null ? item.receivedQty : (item.quantity || 0)).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-center text-gray-500 uppercase">{getStandardGstUom(item.uom)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right">₹{parseFloat(item.rate).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right font-bold text-emerald-800">
                                            {parseFloat((grn.gstNumber && grn.gstNumber.trim() !== '' && grn.gstNumber !== '-') ? (item.taxPercent || 0) : 0).toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right">₹{parseFloat(item.beforeTaxAmount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right">₹{parseFloat(item.taxAmount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-right font-bold text-[#073318]">₹{parseFloat(item.totalAmount || (parseFloat(item.beforeTaxAmount || 0) + parseFloat(item.taxAmount || 0))).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-[#F9FAFB] border-t-2 border-[#E5E7EB] font-bold">
                                <tr>
                                    <td colSpan={3} className="px-4 py-5 text-[14px]">{t('modules:total_summary', 'Total Summary')}</td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        {items.reduce((s, i) => s + (parseFloat(i.receivedQty !== undefined && i.receivedQty !== null ? i.receivedQty : (i.quantity || 0)) || 0), 0).toFixed(2)}
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

                {/* Account Summary Section */}
                <div className="p-8 border-t border-[#F3F4F6]">
                    <h3 className="text-[16px] font-bold text-gray-800 mb-4 uppercase tracking-wider">{t('modules:account_summary', 'Account Summary')}</h3>
                    <div className="border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm w-full">
                        <table className="w-full text-left font-outfit">
                            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                                <tr>
                                    <th className="px-6 py-4 text-[13px] font-bold text-[#64748B] uppercase tracking-wider">{t('modules:account_description', 'Account Description')}</th>
                                    <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">{t('modules:amount_col')}</th>
                                    <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">{t('modules:cum_balance')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F5F9]">
                                {/* Material Row */}
                                {(() => {
                                    const materialSubtotal = items.reduce((s, i) => s + (parseFloat(i.beforeTaxAmount) || 0), 0);
                                    let runningBalance = materialSubtotal;
                                    return (
                                        <tr>
                                            <td className="px-6 py-4 text-[14px] font-bold text-[#475569]">{t('modules:material_purchase_excl_gst', 'MATERIAL PURCHASE (EXCL. GST)')}</td>
                                            <td className="px-6 py-4 text-right font-bold text-[#1e293b] border-l border-[#F1F5F9]">₹{materialSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 text-right font-bold text-[#64748B] border-l border-[#F1F5F9]">₹{runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })()}
                                
                                {/* Direct Expenses (Taxable) */}
                                {(() => {
                                    const materialSubtotal = items.reduce((s, i) => s + (parseFloat(i.beforeTaxAmount) || 0), 0);
                                    let runningBalance = materialSubtotal;
                                    return (grn.expenses || []).filter(e => e.isGstApplicable).map(exp => {
                                        runningBalance += parseFloat(exp.amount) || 0;
                                        return (
                                            <tr key={exp.id}>
                                                <td className="px-6 py-4 text-[14px] font-medium text-[#64748B] italic">{exp.groupName || 'Direct Expense'}</td>
                                                <td className="px-6 py-4 text-right font-bold text-[#1e293b] border-l border-[#F1F5F9]">₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-4 text-right font-bold text-[#64748b] border-l border-[#F1F5F9]">₹{runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    });
                                })()}

                                {/* GST Rows */}
                                {(() => {
                                    const materialSubtotal = items.reduce((s, i) => s + (parseFloat(i.beforeTaxAmount) || 0), 0);
                                    const beforeGstTotal = materialSubtotal + (grn.expenses || []).filter(e => e.isGstApplicable).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                                    let currentWithGst = beforeGstTotal;
                                    const rows = [];
                                    
                                    const totalTax = parseFloat(grn.taxAmount || items.reduce((s, i) => s + (parseFloat(i.taxAmount) || 0), 0));
                                    const cgst = totalTax / 2;
                                    const sgst = totalTax / 2;

                                    if (cgst > 0) {
                                        currentWithGst += cgst;
                                        rows.push(
                                            <tr key="cgst" className="bg-emerald-50/20">
                                                <td className="px-6 py-3 text-[13px] font-bold text-emerald-800 uppercase">C-GST</td>
                                                <td className="px-6 py-3 text-right font-bold text-emerald-800 border-l border-[#F1F5F9]">₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-3 text-right font-bold text-[#64748b] border-l border-[#F1F5F9]">₹{currentWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    }
                                    if (sgst > 0) {
                                        currentWithGst += sgst;
                                        rows.push(
                                            <tr key="sgst" className="bg-emerald-50/20">
                                                <td className="px-6 py-3 text-[13px] font-bold text-emerald-800 uppercase">S-GST</td>
                                                <td className="px-6 py-3 text-right font-bold text-emerald-800 border-l border-[#F1F5F9]">₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-3 text-right font-bold text-[#64748b] border-l border-[#F1F5F9]">₹{currentWithGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    }
                                    return rows;
                                })()}

                                {/* Post-GST Charges */}
                                {(() => {
                                    const materialSubtotal = items.reduce((s, i) => s + (parseFloat(i.beforeTaxAmount) || 0), 0);
                                    const totalTax = parseFloat(grn.taxAmount || items.reduce((s, i) => s + (parseFloat(i.taxAmount) || 0), 0));
                                    const baseWithGst = materialSubtotal + 
                                                      (grn.expenses || []).filter(e => e.isGstApplicable).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) +
                                                      totalTax;
                                    let runningBalance = baseWithGst;
                                    return (grn.expenses || []).filter(e => !e.isGstApplicable).map(exp => {
                                        runningBalance += parseFloat(exp.amount) || 0;
                                        return (
                                            <tr key={exp.id}>
                                                <td className="px-6 py-4 text-[14px] font-medium text-[#64748B] italic">{exp.groupName || 'Post-GST Charge'}</td>
                                                <td className="px-6 py-4 text-right font-bold text-[#1e293b] border-l border-[#F1F5F9]">₹{parseFloat(exp.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-4 text-right font-bold text-[#64748b] border-l border-[#F1F5F9]">₹{runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    });
                                })()}

                                {/* Grand Total */}
                                <tr className="bg-[#073318] text-white">
                                    <td className="px-6 py-5 text-[16px] font-black uppercase tracking-widest">{t('modules:grand_total')}</td>
                                    <td className="px-6 py-5 text-right text-[20px] font-black border-l border-[#ffffff20]">₹{parseFloat(grn.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-5 border-l border-[#ffffff20]"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Section - Back Button only if needed, currently no footer content */}
            </div>
        </div>
    );
};

export default ViewGRN;
