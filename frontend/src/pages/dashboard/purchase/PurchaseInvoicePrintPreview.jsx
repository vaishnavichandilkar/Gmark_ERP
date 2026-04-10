import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import html2pdf from "html2pdf.js";
import { toast } from 'react-hot-toast';
import axiosInstance from '../../../services/axiosInstance';

const PurchaseInvoicePrintPreview = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const invoiceData = location.state?.invoiceData;
    const type = location.state?.type || 'Invoice';
    const printRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [sellerInfo, setSellerInfo] = useState(null);

    const documentLabel = type === 'GRN' ? 'GRN' : 'TAX INVOICE';

    useEffect(() => {
        const fetchSellerInfo = async () => {
            try {
                const response = await axiosInstance.get('/business/profile');
                if (response.data) {
                    const { shopDetail, phone, email } = response.data;
                    setSellerInfo({
                        shopName: shopDetail?.shopName || "ARDHYA AGRO SERVICE",
                        address: shopDetail ? `${shopDetail.address}, ${shopDetail.village || ''}, ${shopDetail.district}, ${shopDetail.state} - ${shopDetail.pinCode}` : "Near Mahalaxmi Temple, Hitani",
                        phone: phone || "+91 2855943035",
                        email: email || "ardhya123@gmail.com",
                        website: "ardhyaagro.in",
                        gstNumber: shopDetail?.gstNumber || "27ABCDE1234F1Z5"
                    });
                }
            } catch (error) {
                console.error("Error fetching seller profile:", error);
            }
        };
        fetchSellerInfo();
    }, []);

    if (!invoiceData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-gray-500 font-outfit text-[13px]">No data found for preview.</p>
                <button
                    onClick={() => {
                         if (location.state?.from) {
                             navigate(location.state.from + '?restore=true');
                         } else {
                             navigate(-1);
                         }
                    }}
                    className="px-6 py-2 bg-[#073318] text-white rounded-[10px] font-bold text-[13px]"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === "N/A") return "-";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}-${m}-${y}`;
        } catch (e) {
            return dateStr;
        }
    };

    const {
        document_number = invoiceData.document_number || invoiceData.invoiceNo || "N/A",
        supplier_name = invoiceData.supplier_name || invoiceData.supplierName || "N/A",
        address = invoiceData.address || "",
        supplier_document_date = invoiceData.supplier_document_date || invoiceData.invoiceDate || "N/A",
        booking_date = invoiceData.booking_date || invoiceData.bookingDate || "N/A",
        gst_no = invoiceData.gst_no || invoiceData.gstNo || "27ABCDE1234F1Z5",
        credit_days = invoiceData.credit_days || invoiceData.cred || "0",
        items = []
    } = invoiceData;

    const subTotal = items.reduce((sum, item) => sum + (parseFloat(item.before_tax || (item.quantity * item.rate - (item.discount_amount || 0))) || 0), 0);
    const totalTax = items.reduce((sum, item) => sum + (parseFloat(item.tax_amount || ((item.quantity * item.rate - (item.discount_amount || 0)) * (item.tax_percent || 0) / 100)) || 0), 0);
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;
    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total_amount || ((item.quantity * item.rate - (item.discount_amount || 0)) * (1 + (item.tax_percent || 0) / 100))) || 0), 0);

    const numberToWords = (num) => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const convert = (n) => {
            if (n === 0) return '';
            let res = '';
            if (n >= 10000000) { res += convert(Math.floor(n / 10000000)) + 'Crore '; n %= 10000000; }
            if (n >= 100000) { res += convert(Math.floor(n / 100000)) + 'Lakh '; n %= 100000; }
            if (n >= 1000) { res += convert(Math.floor(n / 1000)) + 'Thousand '; n %= 1000; }
            if (n >= 100) { res += a[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
            if (n > 0) {
                if (n < 20) res += a[n];
                else res += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
            }
            return res;
        };
        const total = Math.floor(num);
        return (convert(total) + 'Rupees Only').toUpperCase();
    };

    const handleDownloadPDF = async () => {
        try {
            setIsDownloading(true);
            const loadToastId = toast.loading('Generating Pixel-Perfect PDF...');
            const element = printRef.current;
            const opt = {
                margin: 0,
                filename: `${documentLabel}_${document_number}.pdf`,
                image: { type: 'jpeg', quality: 1 },
                html2canvas: { scale: 3, useCORS: true, logging: false, windowWidth: 794, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            await html2pdf().set(opt).from(element).save();
            toast.success('PDF Downloaded successfully!', { id: loadToastId });
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error(`Download Failed: ${error.message}`);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 font-outfit pb-20 no-scrollbar">
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    aside, nav, header, footer, .no-print { display: none !important; }
                    body, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; display: block !important; }
                    .print-container { width: 210mm; padding: 10mm; margin: 0 !important; border: none !important; position: absolute; left: 0; top: 0; z-index: 9999; }
                }
                .black-border { border: 1.5px solid black; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid black; }
            `}</style>

            <div className="no-print flex items-center justify-between px-6 pt-4">
                <div className="flex items-center gap-2 text-[12px] font-bold text-gray-400">
                    <span onClick={() => navigate('/seller/purchase/grn')} className="cursor-pointer hover:text-black">PURCHASE</span>
                    <span>&gt;</span>
                    <span onClick={() => navigate('/seller/purchase/grn')} className="cursor-pointer hover:text-black uppercase">{documentLabel}</span>
                    <span>&gt;</span>
                    <span className="text-[#073318]">PRINT</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDownloadPDF} disabled={isDownloading} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px]">
                        {isDownloading ? 'Downloading...' : 'Download PDF'}
                    </button>
                    <button onClick={() => window.print()} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px]">Print</button>
                    <button 
                        onClick={() => {
                            if (location.state?.from) {
                                const targetUrl = location.state.from;
                                const needsRestore = targetUrl.includes('/add') || targetUrl.includes('/edit');
                                navigate(targetUrl + (needsRestore ? (targetUrl.includes('?') ? '&' : '?') + 'restore=true' : ''));
                            } else {
                                navigate('/seller/purchase/grn');
                            }
                        }} 
                        className="px-6 h-[40px] border border-gray-300 rounded-[10px] font-bold text-[14px] flex items-center gap-2"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
            </div>

            <div className="flex justify-center p-6 bg-gray-50/50 min-h-screen">
                <div ref={printRef} className="print-container w-[210mm] bg-white black-border flex flex-col font-outfit text-black leading-tight overflow-hidden p-[10mm] box-border">
                    <div className="w-full border-black border flex flex-col">
                        <div className="border-b border-black p-4 py-3 flex items-center justify-center relative min-h-[85px]">
                            <div className="absolute left-6 w-14 h-14 bg-[#014A36] rounded-full"></div>
                            <h1 className="text-[26px] font-black uppercase text-center">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</h1>
                        </div>
                        <div className="border-b border-black py-2.5 text-center text-[12.5px] font-semibold">{sellerInfo?.address}</div>
                        <div className="border-b border-black py-2.5 text-center text-[11px] font-semibold mx-4">
                            Phone: {sellerInfo?.phone} | Email: {sellerInfo?.email}
                        </div>
                        <div className="border-b border-black py-3 text-center font-black text-[15px] uppercase tracking-[3px] bg-gray-50/10">
                            {documentLabel}
                        </div>

                        <div className="flex border-b border-black font-black text-[12px]">
                            <div className="w-[38%] py-3 px-4 outline-none">GSTIN : {sellerInfo?.gstNumber}</div>
                            <div className="w-[30%] py-3 px-4 text-center border-l border-black">State Code : 27 Maharashtra</div>
                            <div className="flex-1 py-3 px-4 text-right border-l border-black uppercase pr-6">PAN No : ABCDE1235F</div>
                        </div>

                        <div className="flex border-b border-black min-h-[140px]">
                            <div className="w-1/2 flex flex-col border-r border-black">
                                <div className="border-b border-black px-4 py-2 font-black text-[12px]">BILL TO:</div>
                                <div className="flex-1 px-4 py-2 text-[12px] font-bold uppercase">{supplier_name}</div>
                                <div className="px-4 py-2 text-[11px] font-semibold flex-1 leading-relaxed">{address}</div>
                                <div className="border-t border-black px-4 py-2 text-[11px] font-black">GSTIN: {gst_no}</div>
                            </div>
                            <div className="w-1/2 flex flex-col text-[11px] font-bold">
                                <div className="flex border-b border-black p-2 h-[35px] items-center"><span className="w-[120px] font-black">{type === 'GRN' ? 'GRN No:' : 'Invoice No:'}</span><span>{document_number}</span></div>
                                <div className="flex border-b border-black p-2 h-[35px] items-center"><span className="w-[120px] font-black">Date:</span><span>{formatDate(supplier_document_date)}</span></div>
                                <div className="flex border-b border-black p-2 h-[35px] items-center"><span className="w-[120px] font-black">Booking Date:</span><span>{formatDate(booking_date)}</span></div>
                                <div className="flex p-2 items-center"><span className="w-[120px] font-black">Terms:</span><span className="uppercase">{credit_days} Days</span></div>
                            </div>
                        </div>

                        <table className="w-full">
                            <thead>
                                <tr className="text-[11px] font-black bg-gray-50/10 h-[40px]">
                                    <th className="w-[45px]">Sn.</th>
                                    <th className="px-4 text-left">Product Description</th>
                                    <th className="w-[85px]">HSN/SAC</th>
                                    <th className="w-[50px]">Tax%</th>
                                    <th className="w-[65px]">Quantity</th>
                                    <th className="w-[65px]">Units</th>
                                    <th className="w-[85px]">Rate</th>
                                    <th className="w-[110px] text-right px-4">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx} className="text-[12px] font-semibold min-h-[40px]">
                                        <td className="text-center">{idx + 1}</td>
                                        <td className="px-4 py-2 font-bold leading-tight">
                                            <div className="text-[13px]">{item.product_name || item.productName}</div>
                                            {item.description && <div className="text-[10px] font-normal text-gray-600 mt-1">{item.description}</div>}
                                        </td>
                                        <td className="text-center">{item.hsn}</td>
                                        <td className="text-center">{item.tax_percent}</td>
                                        <td className="text-center">{item.quantity}</td>
                                        <td className="text-center uppercase">{item.uom}</td>
                                        <td className="text-center">{item.rate}</td>
                                        <td className="text-right px-4 font-black">{(parseFloat(item.before_tax) || (item.quantity * item.rate - (item.discount_amount || 0))).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="w-full flex flex-col font-black text-[12px] bg-white border-t border-black">
                            <div className="flex border-b border-black h-[35px] items-center">
                                <div className="flex-1 text-right pr-4 font-black text-[12.5px]">Sub Total</div>
                                <div className="w-[110px] border-l border-black text-right px-4 font-black text-[12.5px]">{subTotal.toFixed(2)}</div>
                            </div>
                            <div className="flex border-b border-black h-[35px] items-center">
                                <div className="flex-1 text-right pr-4 font-black text-[12.5px] uppercase tracking-widest">SGST</div>
                                <div className="w-[110px] border-l border-black text-right px-4 font-black text-[12.5px]">{sgst.toFixed(2)}</div>
                            </div>
                            <div className="flex border-b border-black h-[35px] items-center">
                                <div className="flex-1 text-right pr-4 font-black text-[12.5px] uppercase tracking-widest">CGST</div>
                                <div className="w-[110px] border-l border-black text-right px-4 font-black text-[12.5px]">{cgst.toFixed(2)}</div>
                            </div>
                            <div className="flex h-[55px] items-center">
                                <div className="flex-1 p-4 py-2 font-black text-[10.5px] flex items-center border-r border-black">
                                    <span className="mr-2">Amount In Words :</span>
                                    <span className="uppercase underline decoration-1 underline-offset-4 leading-none">{numberToWords(totalAmount)}</span>
                                </div>
                                <div className="w-[100px] flex items-center justify-center font-black text-[13px] uppercase border-r border-black">Grand Total</div>
                                <div className="w-[110px] flex items-center justify-end px-4 font-black text-[16px]">
                                    {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 flex flex-col min-h-[160px] justify-between border-t border-black">
                             <div className="flex justify-between items-start">
                                <div className="text-[11px] font-black italic">Note: Goods once sold will not be taken back.</div>
                                <div className="text-right">
                                    <p className="font-black text-[12px] uppercase">For <span className="italic tracking-[1px]">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</span></p>
                                </div>
                            </div>
                            <div className="text-right w-full flex justify-end pb-2">
                                <p className="font-black text-[11px] uppercase tracking-widest underline underline-offset-8 decoration-gray-300">authorised Signatory</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseInvoicePrintPreview;
