import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../../../constants/routes';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Search,
    Trash2,
    Plus,
    Save,
    X,
    Edit3,
    Printer,
    ChevronsUpDown,
    FileText
} from 'lucide-react';

import salesOrderService from '../../../../services/salesOrderService';
import { getStandardGstUom } from '@/utils/uomUtils';
import { getImageUrl, getCleanFileName } from '@/utils/url';
import { formatDate } from '@/utils/dateUtils';

const InfoTableRow = ({ label1, value1, label2, value2, isEditMode, renderEdit1, renderEdit2 }) => (
    <div className={`flex flex-col sm:flex-row border-[#E5E7EB] border-b last:border-0 font-outfit`}>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label1}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-white flex items-center">
            {isEditMode && renderEdit1 ? renderEdit1() : (value1 !== null && value1 !== undefined && value1 !== '' ? value1 : '-')}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#6B7280] border-r border-b sm:border-b-0 border-[#E5E7EB] bg-gray-50/10 font-semibold flex items-center">
            {label2}
        </div>
        <div className="sm:w-1/4 py-3.5 px-6 text-[13px] text-[#111827] bg-white flex items-center">
            {isEditMode && renderEdit2 ? renderEdit2() : (value2 !== null && value2 !== undefined && value2 !== '' ? value2 : '-')}
        </div>
    </div>
);

const ViewSO = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = false;

    const [isLoading, setIsLoading] = useState(true);
    const [salesOrder, setSalesOrder] = useState(null);

    const [hoveredDoc, setHoveredDoc] = useState(null);

    const handleMouseEnter = (e, url) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredDoc({ url, rect });
    };

    const handleMouseLeave = () => {
        setHoveredDoc(null);
    };
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
        customer_type: '',
        customer_po_number: '',
        po_date: '',
        po_expiry_date: '',
        customer_amt: '',
        customer_po_file: ''
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
                    customer_type: so.customerType,
                    customer_po_number: so.customerPoNumber,
                    po_date: so.poDate,
                    po_expiry_date: so.poExpiryDate,
                    customer_amt: so.customerAmt,
                    customer_amt_excl_tax: so.customerAmtExclTax,
                    customer_amt_incl_tax: so.customerAmtInclTax,
                    customer_po_file: so.customerPoFile || ''
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
                        {t('modules:view_so')}
                    </h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {!isLoading && salesOrder && salesOrder.status === 'PENDING' && !(salesOrder.salesChallans?.length > 0 || salesOrder.salesInvoices?.length > 0) && (
                            <button
                                onClick={() => navigate(ROUTES.SALES_ORDER_EDIT.replace(':id', id))}
                                className="flex-1 sm:flex-none px-6 md:px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[14px] md:text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-md flex items-center justify-center gap-2"
                            >
                                {t('modules:edit_so')}
                            </button>
                        )}
                        <button
                            onClick={() => navigate(-1)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 h-[44px] border border-[#E5E7EB] rounded-[10px] text-[14px] md:text-[15px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all font-outfit"
                        >
                            <ArrowLeft size={18} /> {t('common:back')}
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
                                    {t('modules:sales_order')}
                                </div>
                                {formData.status && (
                                    <div className={`inline-flex items-center px-4 py-1.5 rounded-[100px] text-[14px] font-bold shadow-sm border ${formData.status === 'completed' ? 'bg-[#D1FAE5] text-[#059669] border-[#A7F3D0]' :
                                        'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
                                        }`}>
                                        {t(`common:status_${formData.status.toLowerCase()}`, formData.status)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-sm">
                            <InfoTableRow label1={t('modules:customerName') + ":"} value1={formData.customer_name} label2={t('modules:credit_days') + ":"} value2={formData.credit_days} />
                            <InfoTableRow label1={t('common:address') + ":"} value1={formData.address} label2={t('modules:creation_date') + ":"} value2={formatDate(formData.creation_date)} />
                            <InfoTableRow label1={t('modules:so_expiry_date', 'SO Expiry Date') + ":"} value1={formatDate(formData.expiry_date)} label2={t('modules:gst_no') + ":"} value2={formData.gst_number} />
                            <InfoTableRow label1={t('modules:pan_no') + ":"} value1={formData.pan_number} label2={t('modules:customer_type') + ":"} value2={formData.customer_type ? formData.customer_type.toUpperCase() : '-'} />
                            {formData.customer_po_number === 'verbal' ? (
                                <InfoTableRow label1={t('modules:customerPoNumber') + ":"} value1={t('common:status_verbal', 'Verbal')} label2="" value2="" />
                            ) : (
                                <>
                                    <InfoTableRow 
                                        label1={t('modules:customerPoNumber') + ":"} 
                                        value1={formData.customer_po_number} 
                                        label2={t('modules:customerPoDate') + ":"} 
                                        value2={formatDate(formData.po_date)} 
                                    />
                                    <InfoTableRow 
                                        label1={t('modules:customerPoExpDate') + ":"} 
                                        value1={formatDate(formData.po_expiry_date)} 
                                        label2={t('modules:customerPoAmountExcl', 'Customer PO Amt (Excl. Tax)') + ":"} 
                                        value2={formData.customer_amt_excl_tax !== null && formData.customer_amt_excl_tax !== undefined && formData.customer_amt_excl_tax !== '' ? `₹ ${parseFloat(formData.customer_amt_excl_tax).toFixed(2)}` : '-'} 
                                    />
                                    <InfoTableRow 
                                        label1={t('modules:customerPoAmountIncl', 'Customer PO Amt (Incl. Tax)') + ":"} 
                                        value1={formData.customer_amt_incl_tax !== null && formData.customer_amt_incl_tax !== undefined && formData.customer_amt_incl_tax !== '' ? `₹ ${parseFloat(formData.customer_amt_incl_tax).toFixed(2)}` : '-'} 
                                        label2="" 
                                        value2="" 
                                    />
                                    <InfoTableRow 
                                        label1={t('modules:customerPoDocument', 'Customer PO Document') + ":"} 
                                        value1={formData.customer_po_file ? (
                                            <button
                                                onClick={() => {
                                                    const normalizedPath = formData.customer_po_file.replace(/\\/g, '/');
                                                    window.open(getImageUrl(normalizedPath), '_blank');
                                                }}
                                                onMouseEnter={(e) => handleMouseEnter(e, formData.customer_po_file)}
                                                onMouseLeave={handleMouseLeave}
                                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-md font-bold text-[12px] hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer shadow-sm active:scale-95 shrink-0 max-w-[250px] truncate"
                                                title={getCleanFileName(formData.customer_po_file)}
                                            >
                                                <FileText size={14} className="shrink-0" /> {getCleanFileName(formData.customer_po_file)}
                                            </button>
                                        ) : '-'} 
                                        label2="" 
                                        value2="" 
                                    />
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-8">
                    <div className="overflow-x-auto custom-so-scrollbar border border-[#E5E7EB] rounded-[12px]">
                        <table className="w-full min-w-[2000px] border-collapse bg-white">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                                    <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">{t('common:sr_no_short', '#')}</th>
                                    {[
                                        { label: t('modules:product_code'), width: "160px" },
                                        { label: t('modules:product_name'), width: "350px" },
                                        { label: t('common:quantity', 'Qty'), width: "120px", align: "right" },
                                        { label: t('modules:uom'), width: "100px" },
                                        { label: t('common:rate', 'Rate'), width: "140px", align: "right" },
                                        { label: t('modules:discount_amount', 'Disc Amt'), width: "130px", align: "right" },
                                        { label: t('modules:discount_percent', 'Disc %'), width: "120px", align: "right" },
                                        { label: t('modules:hsn_code'), width: "130px" },
                                        { label: t('modules:tax_percent'), width: "100px", align: "right" },
                                        { label: t('modules:beforeTaxAmount', 'Before Tax'), width: "150px", align: "right" },
                                        { label: t('modules:taxAmount'), width: "140px", align: "right" },
                                        { label: t('modules:total_amount_col'), width: "160px", align: "right" },
                                        { label: t('common:description'), width: "250px" },
                                        { label: t('common:action'), width: "80px", align: "center" }
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
                                        <td colSpan={15} className="px-4 py-6 border-b border-gray-100"><div className="h-4 bg-gray-50 rounded w-full"></div></td>
                                    </tr>
                                )) : items.map((item, index) => {
                                    const qty = parseFloat(item.quantity) || 0;
                                    const rate = parseFloat(item.rate) || 0;
                                    const discAmt = parseFloat(item.discountAmount) || 0;
                                    const taxPct = parseFloat(item.taxPercent) || 0;
                                    const beforeTax = (qty * rate) - discAmt;
                                    const taxAmt = (beforeTax * taxPct) / 100;
                                    const total = beforeTax + taxAmt;

                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group h-[60px]">
                                            <td className="px-4 py-4 text-center text-[13px] text-[#6B7280]">{index + 1}</td>
                                            <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-[#111827]">{item.productCode}</td>
                                            <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] font-bold text-[#111827]">{item.productName}</td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <div className="px-2 text-right text-[13px] font-medium">{qty.toFixed(2)}</div>
                                            </td>
                                            <td className="px-4 py-4 text-center text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{getStandardGstUom(item.uom)}</td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <div className="px-2 text-right text-[13px]">{rate.toFixed(2)}</div>
                                            </td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <div className="px-2 text-right text-[13px]">{discAmt.toFixed(2)}</div>
                                            </td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <div className="px-2 text-right text-[13px]">{parseFloat(item.discountPercent || 0).toFixed(2)}%</div>
                                            </td>
                                            <td className="px-4 py-4 text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{item.hsnCode}</td>
                                            <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{taxPct}%</td>
                                            <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{beforeTax.toFixed(2)}</td>
                                            <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] text-[#6B7280]">{taxAmt.toFixed(2)}</td>
                                            <td className="px-4 py-4 text-right text-[13px] border-l border-[#F3F4F6] font-bold text-[#073318]">₹ {total.toFixed(2)}</td>
                                            <td className="px-4 py-4 border-l border-[#F3F4F6]">
                                                <div className="text-[12px] text-[#6B7280] truncate max-w-[200px]" title={item.printDescription}>{item.description || item.printDescription || '-'}</div>
                                            </td>
                                            <td className="px-4 py-4 border-l border-[#F3F4F6]"></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-[#F9FAFB] border-t-2 border-[#E5E7EB] font-bold">
                                <tr>
                                    <td colSpan={3} className="px-4 py-5 text-[14px]">{t('common:total_summary', 'Total Summary')}</td>
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
                                        {isLoading ? <div className="h-4 bg-gray-100 rounded w-16 ml-auto"></div> : items.reduce((s, i) => s + ((parseFloat(i.quantity) * parseFloat(i.rate)) - (parseFloat(i.discountAmount) || 0)), 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right">
                                        {isLoading ? <div className="h-4 bg-gray-100 rounded w-16 ml-auto"></div> : items.reduce((s, i) => s + (((parseFloat(i.quantity) * parseFloat(i.rate)) - (parseFloat(i.discountAmount) || 0)) * (parseFloat(i.taxPercent) || 0) / 100), 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 border-l border-[#F3F4F6] text-right text-[#073318]">
                                        {isLoading ? <div className="h-5 bg-[#073318]/10 rounded w-24 ml-auto"></div> : `₹ ${items.reduce((s, i) => {
                                            const bt = (parseFloat(i.quantity) * parseFloat(i.rate)) - (parseFloat(i.discountAmount) || 0);
                                            return s + (bt + (bt * (parseFloat(i.taxPercent) || 0) / 100));
                                        }, 0).toFixed(2)}`}
                                    </td>
                                    <td colSpan={2} className="border-l border-[#F3F4F6]"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Footer Actions */}
                {!isLoading && (
                    <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] p-5 flex justify-end z-[100] shadow-[0_-8px_30px_rgba(0,0,0,0.04)] font-outfit">
                        <button
                            onClick={() => {
                                navigate(ROUTES.SALES_ORDER_PRINT, {
                                    state: {
                                        soData: salesOrder,
                                        from: `/seller/sales/order/view/${id}`
                                    }
                                });
                            }}
                            className="flex items-center gap-2 px-10 h-[48px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all active:scale-95 shadow-sm"
                        >
                            <Printer size={18} /> {t('modules:preview_print_so', 'Preview & Print SO')}
                        </button>
                    </div>
                )}
                {hoveredDoc && createPortal(
                    <div 
                        className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.15)] p-2 w-[320px] h-[220px] pointer-events-none flex items-center justify-center overflow-hidden animate-in zoom-in-95 duration-150"
                        style={{
                            top: `${hoveredDoc.rect.top - 235 < 10 ? hoveredDoc.rect.bottom + 10 : hoveredDoc.rect.top - 235}px`,
                            left: `${Math.max(10, Math.min(window.innerWidth - 330, hoveredDoc.rect.left + (hoveredDoc.rect.width / 2) - 160))}px`,
                        }}
                    >
                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(hoveredDoc.url) ? (
                            <img 
                                src={getImageUrl(hoveredDoc.url)} 
                                alt="Preview" 
                                className="w-full h-full object-contain rounded-lg"
                            />
                        ) : /\.pdf$/i.test(hoveredDoc.url) ? (
                            <iframe 
                                src={`${getImageUrl(hoveredDoc.url)}#toolbar=0&navpanes=0&scrollbar=0`} 
                                title="PDF Preview" 
                                className="w-full h-full border-0 rounded-lg pointer-events-none"
                                scrolling="no"
                            />
                        ) : (
                            <div className="text-[12px] text-gray-500 font-medium flex flex-col items-center gap-2">
                                <FileText size={32} className="text-gray-400" />
                                <span>Preview not available</span>
                            </div>
                        )}
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
};

export default ViewSO;
