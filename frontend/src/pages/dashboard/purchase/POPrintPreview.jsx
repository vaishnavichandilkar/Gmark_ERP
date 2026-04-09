import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import html2pdf from "html2pdf.js";
import { toast } from 'react-hot-toast';
import axiosInstance from '../../../services/axiosInstance';

const POPrintPreview = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const poData = location.state?.poData;
    const printRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [sellerInfo, setSellerInfo] = useState(null);

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
                        website: "ardhyaagro.in", // Default since not in current schema but requested
                        gstNumber: shopDetail?.gstNumber || "27ABCDE1234F1Z5"
                    });
                }
            } catch (error) {
                console.error("Error fetching seller profile:", error);
            }
        };
        fetchSellerInfo();
    }, []);

    if (!poData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-gray-500 font-outfit text-[13px]">No PO data found for preview.</p>
                <button
                    onClick={() => navigate('/seller/purchase/order/add?restore=true')}
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
        po_number: po_no = "N/A",
        supplier_name = "N/A",
        address = "",
        creation_date: po_creation_date = "N/A",
        expiry_date = "N/A",
        gst_number = "27ABCDE1234F1Z5",
        pan_number = "ABCDE1235F",
        credit_days = "0",
        items = []
    } = poData;

    const subTotal = items.reduce((sum, item) => sum + (parseFloat(item.before_tax || (item.quantity * item.rate - (item.discountAmount || 0))) || 0), 0);
    const totalTax = items.reduce((sum, item) => sum + (parseFloat(item.tax_amount || ((item.quantity * item.rate - (item.discountAmount || 0)) * (item.taxPercent || 0) / 100)) || 0), 0);
    const cgst = totalTax / 2;
    const sgst = totalTax / 2;
    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total_amount || ((item.quantity * item.rate - (item.discountAmount || 0)) * (1 + (item.taxPercent || 0) / 100))) || 0), 0);

    const numberToWords = (num) => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        const inWords = (n) => {
            if (n < 20) return a[n];
            const d = Math.floor(n / 10);
            const m = n % 10;
            return b[d] + (m !== 0 ? ' ' + a[m] : '');
        };

        const convert = (n) => {
            if (n === 0) return '';
            let res = '';
            if (n >= 10000000) {
                res += convert(Math.floor(n / 10000000)) + 'Crore ';
                n %= 10000000;
            }
            if (n >= 100000) {
                res += convert(Math.floor(n / 100000)) + 'Lakh ';
                n %= 100000;
            }
            if (n >= 1000) {
                res += convert(Math.floor(n / 1000)) + 'Thousand ';
                n %= 1000;
            }
            if (n >= 100) {
                res += inWords(Math.floor(n / 100)) + ' Hundred ';
                n %= 100;
            }
            if (n > 0) {
                if (res !== '') res += ' ';
                res += inWords(n);
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
                filename: `PO_${po_no}.pdf`,
                image: { type: 'jpeg', quality: 1 },
                html2canvas: {
                    scale: 3,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    windowWidth: 794,
                    backgroundColor: '#ffffff'
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait'
                }
            };

            await html2pdf().set(opt).from(element).save();

            toast.success('PDF Downloaded successfully!', { id: loadToastId });
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error(`Download Failed: ${error.message}`, { id: 'pdf-toast' });
        } finally {
            setIsDownloading(false);
        }
    };


    return (
        <div className="flex flex-col gap-6 font-outfit pb-20 no-scrollbar">
            <style>{`
                @media print {
                    @page { size: A4; margin: 0; }
                    
                    /* Aggressively hide all layout elements */
                    aside, nav, header, footer, 
                    .no-print, 
                    [role="navigation"],
                    .sidebar-container,
                    .top-navigation { 
                        display: none !important; 
                        width: 0 !important;
                        height: 0 !important;
                        overflow: hidden !important;
                    }

                    /* Reset body and root containers */
                    body, #root, #root > div {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        overflow: visible !important;
                    }

                    /* Main content area reset */
                    main, .main-content {
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                    }

                    .print-container { 
                        width: 210mm; 
                        height: 297mm; 
                        padding: 10mm;
                        margin: 0 !important;
                        border: none !important;
                        background: white !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        z-index: 9999;
                    }
                    
                    /* Hide everything except our print container when printing */
                    body > *:not(.print-container) {
                        display: none !important;
                    }
                }
                .black-border { border: 1.5px solid black; }
                .border-b-black { border-bottom: 1px solid black; }
                .border-r-black { border-right: 1px solid black; }
                .border-t-black { border-top: 1px solid black; }
                .border-l-black { border-left: 1px solid black; }
                
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid black; }
                .table-no-top-border th { border-top: none; }
                .table-no-bottom-border td { border-bottom: none; }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>

            <div className="no-print flex items-center justify-between px-6 pt-4">
                <div className="flex items-center gap-2 text-[12px] font-bold text-gray-400">
                    <span onClick={() => navigate('/seller/purchase/order')} className="cursor-pointer hover:text-black">PURCHASE</span>
                    <span>&gt;</span>
                    <span onClick={() => navigate('/seller/purchase/order')} className="cursor-pointer hover:text-black">PURCHASE ORDER</span>
                    <span>&gt;</span>
                    <span className="text-[#073318]">PRINT</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isDownloading}
                        className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isDownloading ? 'Downloading...' : 'Download PDF'}
                    </button>
                    <button onClick={() => window.print()} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center">
                        Print PO
                    </button>
                    <button 
                        onClick={() => {
                            if (location.state?.from) {
                                // Add restore=true if we're going back to Add or Edit page
                                const targetUrl = location.state.from;
                                const needsRestore = targetUrl.includes('/add') || targetUrl.includes('/edit');
                                navigate(targetUrl + (needsRestore ? (targetUrl.includes('?') ? '&' : '?') + 'restore=true' : ''));
                            } else {
                                const url = poData?.id ? `/seller/purchase/order/add/${poData.id}` : '/seller/purchase/order/add';
                                navigate(`${url}?restore=true`);
                            }
                        }} 
                        className="px-6 h-[40px] border border-gray-300 rounded-[10px] font-bold text-[14px] flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
            </div>

            <div className="no-print-bg flex justify-center p-6 bg-gray-50/50 min-h-screen">
                <div ref={printRef} className="print-container w-[210mm] h-[296mm] max-h-[296mm] bg-white black-border flex flex-col font-outfit text-black leading-tight overflow-hidden p-[10mm] box-border">

                    {/* Brand Header */}
                    <div className="w-full border-black border flex flex-col">
                        <div className="border-b border-black p-4 py-3 flex items-center justify-center relative min-h-[85px]">
                            <div className="absolute left-6 w-14 h-14 bg-[#014A36] rounded-full"></div>
                            <h1 className="text-[26px] font-black uppercase text-center">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</h1>
                        </div>
                        <div className="border-b border-black py-2.5 text-center text-[12.5px] font-semibold">
                            {sellerInfo?.address || "Near Mahalaxmi Temple, Hitani"}
                        </div>
                        <div className="border-b border-black py-2.5 text-center text-[11px] font-semibold tracking-wide">
                            Phone No.: {sellerInfo?.phone || "+91 2855943035"} &nbsp; Email Id: {sellerInfo?.email || "ardhya123@gmail.com"} &nbsp; Website: {sellerInfo?.website || "ardhyaagro.in"}
                        </div>
                        <div className="border-b border-black py-3 text-center font-black text-[15px] uppercase tracking-[3px]" style={{ backgroundColor: 'rgba(249, 250, 251, 0.1)' }}>
                            PURCHASE ORDER
                        </div>

                        {/* GST Row */}
                        <div className="flex border-b border-black text-[12px] font-black">
                            <div className="w-[38%] py-3 px-4">GSTIN : {sellerInfo?.gstNumber || "27ABCDE1234F1Z5"}</div>
                            <div className="w-[30%] py-3 px-4 text-center">State Code : 27 Maharashtra</div>
                            <div className="flex-1 py-3 px-4 text-right pr-6 uppercase whitespace-nowrap">PAN No : ABCDE1235F</div>
                        </div>

                        <div className="flex border-b border-black min-h-[160px]">
                            {/* Left Half: Supplier */}
                            <div className="w-1/2 flex flex-col border-r border-black">
                                <div className="border-b border-black flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[30px]">M/S.</span>
                                    <span className="font-black text-[12px] uppercase">{supplier_name}</span>
                                </div>
                                <div className="flex-1 px-4 py-3 text-[11.5px] leading-relaxed font-semibold overflow-hidden">
                                    {address}
                                </div>
                                <div className="border-t border-black flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[70px]">Supplier Code</span>
                                    <span className="font-black text-[12px]">SP00001</span>
                                </div>
                            </div>

                            {/* Right Half: PO Details */}
                            <div className="w-1/2 flex flex-col">
                                <div className="flex border-b border-black h-[44px]">
                                    <div className="w-[40%] flex items-center px-4 gap-4">
                                        <span className="font-black text-[11px] whitespace-nowrap">PO No. :</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{po_no}</span>
                                    </div>
                                    <div className="flex-1 flex items-center px-4 gap-4 border-l" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                                        <span className="font-black text-[11px] whitespace-nowrap">PO Creation Date :</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(po_creation_date)}</span>
                                    </div>
                                </div>
                                <div className="flex-1 border-b border-black flex items-center px-4 py-2.5 gap-4">
                                    <span className="font-black text-[12px] min-w-[80px]">Pay. Terms</span>
                                    <span className="font-semibold text-[12px]">{credit_days} Days</span>
                                </div>
                                <div className="flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[80px]">Expiry Date:</span>
                                    <span className="font-semibold text-[12px]">{formatDate(expiry_date)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Products Table */}
                        <div className="w-full h-full flex flex-col">
                            <table className="w-full border-none m-0">
                                <thead>
                                    <tr className="text-[11px] font-black h-[40px]" style={{ backgroundColor: 'rgba(249, 250, 251, 0.1)' }}>
                                        <th className="w-[45px] border-b border-r border-black">Sn.</th>
                                        <th className="border-b border-r border-black px-4 text-left">Description</th>
                                        <th className="w-[85px] border-b border-r border-black">HSN/SAC</th>
                                        <th className="w-[50px] border-b border-r border-black text-center">Tax%</th>
                                        <th className="w-[65px] border-b border-r border-black text-center">Quantity</th>
                                        <th className="w-[65px] border-b border-r border-black text-center">Units</th>
                                        <th className="w-[85px] border-b border-r border-black text-center">Rate</th>
                                        <th className="w-[55px] border-b border-r border-black text-center">Dis%</th>
                                        <th className="w-[110px] border-b border-black text-right px-4">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={item.id || idx} className="text-[12px] font-semibold min-h-[40px]">
                                            <td className="border-b border-r border-black text-center">{idx + 1}</td>
                                            <td className="border-b border-r border-black px-4 py-2 leading-tight">
                                                <div className="font-bold text-[13px]">{item.productName || item.product_name}</div>
                                                {(item.description || item.printDescription) && (
                                                    <div className="font-normal text-[11px] mt-1 text-gray-700 whitespace-pre-wrap">{item.description || item.printDescription}</div>
                                                )}
                                            </td>
                                            <td className="border-b border-r border-black text-center">{item.hsnCode || item.hsn}</td>
                                            <td className="border-b border-r border-black text-center">{item.taxPercent || item.tax_percent}</td>
                                            <td className="border-b border-r border-black text-center">{item.quantity}</td>
                                            <td className="border-b border-r border-black text-center uppercase">{item.uom}</td>
                                            <td className="border-b border-r border-black text-center">{item.rate}</td>
                                            <td className="border-b border-r border-black text-center">{item.discountPercent || item.discount_percent || 0}</td>
                                            <td className="border-b border-black text-right px-4 font-black">
                                                {(parseFloat(item.before_tax || (item.quantity * item.rate - (item.discountAmount || 0)))).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Calculation Footer */}
                        <div className="w-full border-t border-black bg-white">
                            <div className="flex border-b border-black h-[35px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[12.5px]">Sub Total</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[12.5px]">{subTotal.toFixed(2)}</div>
                            </div>
                            <div className="flex border-b border-black h-[35px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[12.5px] uppercase tracking-widest">SGST</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[12.5px]">{sgst.toFixed(2)}</div>
                            </div>
                            <div className="flex border-b border-black h-[35px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[12.5px] uppercase tracking-widest">CGST</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[12.5px]">{cgst.toFixed(2)}</div>
                            </div>
                            <div className="flex border-b border-black h-[35px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[12.5px] uppercase tracking-widest" style={{ color: '#9ca3af' }}>IGST</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[12.5px]" style={{ color: '#9ca3af' }}>--</div>
                            </div>

                            <div className="flex h-[55px]">
                                <div className="flex-1 border-r border-black p-4 py-2 font-black text-[10.5px] flex items-center">
                                    <span className="mr-2">Amount In Words :</span>
                                    <span className="uppercase underline decoration-1 underline-offset-4">{numberToWords(totalAmount)}</span>
                                </div>
                                <div className="w-[100px] border-r border-black flex items-center justify-center font-black text-[13px] uppercase">Total</div>
                                <div className="w-[110px] flex items-center justify-end px-4 font-black text-[16px]">
                                    {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Signature Section */}
                        <div className="w-full border-t border-black p-6 flex flex-col justify-between min-h-[160px] bg-white">
                            <div className="text-right pr-4">
                                <p className="font-black text-[12px]">For <span className="uppercase italic tracking-[2px]">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</span></p>
                            </div>
                            <div className="text-right pr-4">
                                <p className="font-black text-[11px] uppercase tracking-widest underline underline-offset-8" style={{ textDecorationColor: '#d1d5db' }}>authorised Signatory</p>
                            </div>
                        </div>

                        <div className="w-full border-t py-5 text-center text-[10px] font-bold bg-white" style={{ borderColor: 'rgba(0, 0, 0, 0.1)', color: '#9ca3af' }}>
                            <p className="mb-0.5">{sellerInfo?.shopName || "Ardhya Agro Service"} Purchase Order #{po_no}</p>
                            <p>Page 1 of 1</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default POPrintPreview;
