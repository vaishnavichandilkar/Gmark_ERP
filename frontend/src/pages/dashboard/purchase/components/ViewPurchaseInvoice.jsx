import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit3, Trash2, FileText, Download, Printer } from 'lucide-react';
import { exportToPDF } from '../../../../utils/exportUtils';
import { ROUTES } from '../../../../constants/routes';

const InfoTableRow = ({ label1, value1, label2, value2, noBorder }) => (
    <div className={`flex flex-col lg:flex-row border-[#E5E7EB] ${noBorder ? '' : 'border-b'}`}>
        <div className="lg:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#6B7280] border-r border-b lg:border-b-0 border-[#E5E7EB] bg-white font-medium uppercase tracking-wider">
            {label1}
        </div>
        <div className="lg:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#111827] border-r border-b lg:border-b-0 border-[#E5E7EB] bg-white font-bold">
            {value1 || '-'}
        </div>
        <div className="lg:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#6B7280] border-r border-b lg:border-b-0 border-[#E5E7EB] bg-white font-medium uppercase tracking-wider">
            {label2}
        </div>
        <div className="lg:w-1/4 py-3.5 px-4 md:px-6 text-[13px] text-[#111827] bg-white font-bold">
            {value2 || '-'}
        </div>
    </div>
);

const SectionHeading = ({ title }) => (
    <div className="py-4 px-4 md:px-6 border-b border-[#E5E7EB] bg-[#F9FAFB]/50">
        <h3 className="text-[16px] font-bold text-[#111827]">{title}</h3>
    </div>
);

const ViewPurchaseInvoice = ({ initialData, onBack, onEdit, onDelete }) => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();
    const location = useLocation();
    const data = initialData || {};

    // Mock detailed data matching AddPurchaseInvoice logic
    const productDetails = [
        { id: '101', name: 'Premium Maize Silage', qty: 5, rate: 200.00, uom: 'Ton', discount: 0, hsn: '1234', taxPercent: 18, taxAmt: 180.00, total: 1180.00 },
        { id: '102', name: 'Organic Fertilizer Mix', qty: 12, rate: 250.00, uom: 'Bag', discount: 0, hsn: '5678', taxPercent: 18, taxAmt: 540.00, total: 3540.00 },
    ];

    const accountDetails = [
        { name: 'Material Purchase (G.S.T.)', amount: 4000.00, balance: 4000.00 },
        { name: 'c-gst 9%', amount: 360.00, balance: 4360.00 },
        { name: 's-gst 9%', amount: 360.00, balance: 4720.00 },
    ];

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300 font-['Plus_Jakarta_Sans']">
            {/* Masters-style View Container */}
            <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col w-full overflow-hidden">
                
                {/* Header matching Account Master */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center px-4 md:px-6 py-5 border-b border-[#E5E7EB] bg-white gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[18px] font-bold text-[#111827]">{t('view_purchase_invoice', 'View Purchase Invoice')}</h2>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {initialData?.status === 'Deleted' ? (
                            <button 
                                onClick={onBack}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-[#E5E7EB] hover:bg-gray-50 text-[#4B5563] px-6 h-[40px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98] bg-white"
                            >
                                <ArrowLeft size={18} />
                                {t('common:back', 'Back')}
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={() => {
                                        navigate(ROUTES.PURCHASE_INVOICE_PRINT, { 
                                            state: { 
                                                invoiceData: data, 
                                                type: data.type || 'Invoice',
                                                from: location.pathname
                                            } 
                                        });
                                    }}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[40px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98]"
                                >
                                    <Printer size={18} />
                                    Print
                                </button>
                                <button 
                                    onClick={onEdit}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-[#E5E7EB] hover:bg-gray-50 text-[#4B5563] px-6 h-[40px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98] bg-white"
                                >
                                    <Edit3 size={18} />
                                    {t('common:edit')}
                                </button>
                                <button 
                                    onClick={onBack}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-[#E5E7EB] hover:bg-gray-50 text-[#4B5563] px-6 h-[40px] rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-[0.98] bg-white"
                                >
                                    <ArrowLeft size={18} />
                                    {t('common:back')}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 md:p-8">
                    
                    {/* Record Title & Badges */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-2">
                            <h1 className="text-[28px] md:text-[32px] font-bold text-[#111827] tracking-tight">
                                {data.supplierName || 'Shree Agro Traders'}
                            </h1>
                            <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-[14px] font-bold border border-emerald-100">
                                {data.invoiceNo || 'INV-0001'}
                            </div>
                        </div>
                        <p className="text-[#6B7280] text-[15px]">Purchase invoice details and transaction summary</p>
                    </div>

                    {/* Data Display - Masters Table Style */}
                    <div className="border border-[#E5E7EB] rounded-[10px] overflow-hidden flex flex-col w-full shadow-sm mb-8">
                        <SectionHeading title="General Information" />
                        <InfoTableRow 
                            label1="Supplier Name:" value1={data.supplierName} 
                            label2="Invoice No:" value2={data.invoiceNo} 
                        />
                        <InfoTableRow 
                            label1="Booking Date:" value1={data.bookingDate} 
                            label2="Invoice Date:" value2={data.invoiceDate} 
                        />
                        <InfoTableRow 
                            label1="PO Number:" value2={data.poNo} 
                            label2="Credit Days:" value1={data.cred} 
                        />
                        <InfoTableRow 
                            label1="GST Number:" value1={data.gstNo} 
                            label2="Status:" value2={data.status} 
                        />

                        <SectionHeading title="Product Details" />
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[1000px] text-left">
                                <thead>
                                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                                        <th className="px-6 py-4">Product ID</th>
                                        <th className="px-6 py-4">Product Name</th>
                                        <th className="px-6 py-4">HSN Code</th>
                                        <th className="px-6 py-4 text-center">Tax (%)</th>
                                        <th className="px-6 py-4 text-center">Qty</th>
                                        <th className="px-6 py-4 text-right">Rate</th>
                                        <th className="px-6 py-4 text-right">Discount</th>
                                        <th className="px-6 py-4 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F3F4F6]">
                                    {productDetails.map((product) => (
                                        <tr key={product.id} className="text-[13px]">
                                            <td className="px-6 py-4 font-bold text-[#111827]">{product.id}</td>
                                            <td className="px-6 py-4 text-[#4B5563] font-medium">{product.name}</td>
                                            <td className="px-6 py-4 text-[#4B5563]">{product.hsn}</td>
                                            <td className="px-6 py-4 text-center text-[#4B5563] font-bold">{product.taxPercent}%</td>
                                            <td className="px-6 py-4 text-center text-[#111827] font-bold">{product.qty} {product.uom}</td>
                                            <td className="px-6 py-4 text-right text-[#4B5563]">₹ {product.rate.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right text-[#4B5563]">₹ {product.discount.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right text-[#111827] font-bold">₹ {product.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <SectionHeading title="Account Summary" />
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[800px] text-left">
                                <thead>
                                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                                        <th className="px-6 py-4">Account Name</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Running Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F3F4F6]">
                                    {accountDetails.map((acc, idx) => (
                                        <tr key={idx} className="text-[13px]">
                                            <td className="px-6 py-4 text-[#4B5563] font-medium">{acc.name}</td>
                                            <td className="px-6 py-4 text-right text-[#111827] font-bold">₹ {acc.amount.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right text-[#4B5563]">₹ {acc.balance.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <SectionHeading title="Grand Total Information" />
                        <InfoTableRow 
                            label1="Taxable Amount:" value1={`₹ ${data.taxableAmount || '0.00'}`} 
                            label2="Tax Amount:" value2={`₹ ${data.taxAmount || '0.00'}`} 
                        />
                        <div className="flex flex-col lg:flex-row bg-emerald-50/30">
                            <div className="lg:w-1/4 py-4 px-6 text-[14px] font-bold text-[#073318] border-r border-[#E5E7EB] uppercase tracking-wider bg-emerald-50/50">
                                Grand Total:
                            </div>
                            <div className="flex-1 py-4 px-6 text-[22px] font-bold text-[#073318] bg-white lg:bg-transparent">
                                ₹ {data.grossAmount || '0.00'}
                            </div>
                        </div>
                    </div>

                    {/* Attachments matching master style section */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-[16px] font-bold text-[#111827]">Attachments</h3>
                        <div className="flex flex-wrap gap-4">
                            <div 
                                onClick={() => {
                                    const columns = ["Field", "Value"];
                                    const pdfData = [
                                        ["Supplier Name", data.supplierName || "Shree Agro Traders"],
                                        ["Invoice No", data.invoiceNo || "INV-0001"],
                                        ["Booking Date", data.bookingDate || "02-03-2026"],
                                        ["Invoice Date", data.invoiceDate || "10-03-2026"],
                                        ["PO Number", (data.poNo ? data.poNo : "PO00001")],
                                        ["GST Number", data.gstNo || "27ABCDE1234F1Z5"],
                                        ["Taxable Amount", `₹ ${data.taxableAmount || "0.00"}`],
                                        ["Grand Total", `₹ ${data.grossAmount || "0.00"}`]
                                    ];
                                    exportToPDF("Purchase Invoice Details", columns, pdfData, `Purchase_Invoice_${data.invoiceNo || 'INV-0001'}.pdf`);
                                }}
                                className="flex items-center gap-3 p-3 bg-white border border-[#E5E7EB] rounded-[10px] hover:border-[#073318]/30 transition-all cursor-pointer shadow-sm min-w-[240px] group"
                            >
                                <div className="w-10 h-10 bg-red-50 rounded-[8px] flex items-center justify-center text-red-600 group-hover:bg-red-100 transition-colors">
                                    <FileText size={20} />
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className="text-[13px] font-bold text-[#111827]">Purchase_Invoice.pdf</span>
                                    <span className="text-[11px] text-[#6B7280]">2.4 MB</span>
                                </div>
                                <Download size={16} className="text-gray-400 group-hover:text-[#073318] transition-colors" />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer matched to master module (standard delete button) */}
                <div className="px-8 py-6 bg-[#F9FAFB] border-t border-[#E5E7EB] flex justify-end">
                        <button 
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this invoice permanently?')) {
                                    onDelete(initialData.id);
                                }
                            }}
                            className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors text-[14px] font-bold"
                        >
                            <Trash2 size={16} />
                            {t('common:delete_permanently', 'Delete Permanently')}
                        </button>
                </div>

            </div>
        </div>
    );
};

export default ViewPurchaseInvoice;
