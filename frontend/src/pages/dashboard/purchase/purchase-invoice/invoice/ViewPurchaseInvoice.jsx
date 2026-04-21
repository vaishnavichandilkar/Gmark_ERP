import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { 
    ArrowLeft, 
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

import purchaseInvoiceService from '@/services/purchaseInvoiceService';

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

const ViewPurchaseInvoice = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    
    const [isLoading, setIsLoading] = useState(true);
    const [invoice, setInvoice] = useState(null);
    const [items, setItems] = useState([]);
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        const fetchInvoice = async () => {
            console.log("Fetching invoice with ID:", id);
            setIsLoading(true);
            try {
                // Try both methods for robustness
                const service = purchaseInvoiceService;
                if (!service) throw new Error("purchaseInvoiceService is undefined");
                
                const data = await (service.getInvoiceById ? service.getInvoiceById(id) : service.getInvoice(id));
                console.log("Successfully loaded invoice data:", data);
                
                setInvoice(data);
                setItems(data.items || []);
                setExpenses(data.expenses || []);
            } catch (error) {
                console.error("Error fetching invoice details:", error);
                const errorMsg = error.response?.data?.message || error.message || "Unknown error";
                toast.error(`Failed to load: ${errorMsg}`);
            } finally {
                setIsLoading(false);
            }
        };
        if (id) fetchInvoice();
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

    if (!invoice) {
        return (
            <div className="text-center py-20">
                <h2 className="text-xl font-bold text-gray-600">Purchase Invoice not found</h2>
                <button onClick={() => navigate(-1)} className="mt-4 text-emerald-800 font-bold underline">Go Back</button>
            </div>
        );
    }

    const materialSubtotal = items.reduce((s, i) => s + (parseFloat(i.beforeTaxAmount) || 0), 0);
    const materialTax = items.reduce((s, i) => s + (parseFloat(i.taxAmount) || 0), 0);
    
    const taxableExpensesSubtotal = expenses.filter(e => e.isGstApplicable).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const nonTaxableExpensesSubtotal = expenses.filter(e => !e.isGstApplicable).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    
    // In many implementations, expense tax is stored or calculated. 
    // Usually, invoice record level grandTotal and tax fields are most reliable.
    const totalTax = invoice.taxAmount || (materialTax + expenses.reduce((s, e) => s + (parseFloat(e.taxAmount) || 0), 0));

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 font-outfit">
            <style>{`
                .custom-invoice-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-invoice-scrollbar::-webkit-scrollbar-track { background: #E5E7EB; }
                .custom-invoice-scrollbar::-webkit-scrollbar-thumb { background: #A7C0B8; border-radius: 4px; }
                .custom-invoice-scrollbar::-webkit-scrollbar-thumb:hover { background: #014A36; }
            `}</style>

            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-6 border-b border-[#F3F4F6] gap-4">
                    <h2 className="text-[20px] font-bold text-[#111827]">View Purchase Invoice</h2>
                    <div className="flex items-center gap-3">
                        {invoice.status !== 'DELETED' && (
                            <button 
                                onClick={() => navigate(`/seller/purchase/invoice/edit/${id}`)}
                                className="px-6 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all flex items-center gap-2"
                            >
                                Edit
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
                        <h1 className="text-[32px] font-bold text-[#111827] mb-2 uppercase tracking-tight">#{invoice.invoiceNumber}</h1>
                        <div className="flex gap-2">
                            <span className="px-4 py-1.5 bg-[#4B5563] text-white rounded-full text-[13px] font-bold">INVOICE DETAILS</span>
                            <span className={`px-4 py-1.5 rounded-full text-[13px] font-bold border ${
                                invoice.status === 'DELETED' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                                {invoice.status === 'DELETED' ? 'DELETED' : 'POSTED'}
                            </span>
                        </div>
                    </div>

                    <div className="border border-[#E5E7EB] rounded-[12px] overflow-hidden shadow-sm">
                        <InfoTableRow label1="Supplier Name:" value1={invoice.supplierName} label2="Credit Days:" value2={invoice.creditDays} />
                        <InfoTableRow label1="Supplier Address:" value1={invoice.address} label2="PO Number:" value2={invoice.poNumber} />
                        <InfoTableRow label1="Supplier Invoice No:" value1={invoice.supplierInvoiceNumber} label2="Booking Date:" value2={formatDate(invoice.bookingDate)} />
                        <InfoTableRow label1="Invoice Date:" value1={formatDate(invoice.supplierInvoiceDate)} label2="GST Number:" value2={invoice.gstNumber} />
                    </div>
                </div>

                {/* Table Section */}
                <div className="p-8">
                    <h3 className="text-[16px] font-bold text-gray-800 mb-4 uppercase tracking-wider">Item Details</h3>
                    <div className="overflow-x-auto custom-invoice-scrollbar border border-[#E5E7EB] rounded-[12px] mb-8">
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
                        </table>
                    </div>

                    {/* Account Summary */}
                    <h3 className="text-[16px] font-bold text-gray-800 mb-4 uppercase tracking-wider">Account Summary</h3>
                    <div className="border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm w-full">
                        <table className="w-full text-left">
                            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                                <tr>
                                    <th className="px-6 py-4 text-[13px] font-bold text-[#64748B] uppercase tracking-wider">Account Description</th>
                                    <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">Amount</th>
                                    <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">Cum. Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F5F9]">
                                {/* Material Row */}
                                {(() => {
                                    let runningBalance = materialSubtotal;
                                    return (
                                        <tr>
                                            <td className="px-6 py-4 text-[14px] font-bold text-[#475569]">MATERIAL PURCHASE (EXCL. GST)</td>
                                            <td className="px-6 py-4 text-right font-bold text-[#1e293b] border-l border-[#F1F5F9]">₹{materialSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 text-right font-bold text-[#64748B] border-l border-[#F1F5F9]">₹{runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })()}
                                
                                {/* Direct Expenses (Taxable) */}
                                {(() => {
                                    let runningBalance = materialSubtotal;
                                    return expenses.filter(e => e.isGstApplicable).map(exp => {
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
                                    const beforeGstTotal = materialSubtotal + expenses.filter(e => e.isGstApplicable).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                                    let currentWithGst = beforeGstTotal;
                                    const rows = [];
                                    
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
                                    const baseWithGst = materialSubtotal + 
                                                      expenses.filter(e => e.isGstApplicable).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) +
                                                      totalTax;
                                    let runningBalance = baseWithGst;
                                    return expenses.filter(e => !e.isGstApplicable).map(exp => {
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
                                    <td className="px-6 py-5 text-[16px] font-black uppercase tracking-widest">Grand Total</td>
                                    <td className="px-6 py-5 text-right text-[20px] font-black border-l border-[#ffffff20]">₹{parseFloat(invoice.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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

export default ViewPurchaseInvoice;
