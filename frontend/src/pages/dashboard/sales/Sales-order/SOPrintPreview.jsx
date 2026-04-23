import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import html2pdf from "html2pdf.js";
import { toast } from 'react-hot-toast';
import axiosInstance from '@/services/axiosInstance';

const SOPrintPreview = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const soData = location.state?.soData;
    const printRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [sellerInfo, setSellerInfo] = useState(null);

    const getStateName = (gstin) => {
        if (!gstin || gstin.length < 2) return "Not Available";
        const code = gstin.substring(0, 2);
        const states = {
            "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
            "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
            "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
            "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
            "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "25": "Daman & Diu",
            "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa",
            "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
            "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
        };
        return states[code] || "Not Available";
    };

    useEffect(() => {
        const fetchSellerInfo = async () => {
            try {
                const response = await axiosInstance.get('/business/profile');
                if (response.data) {
                    const { shopDetail, phone, email, websiteUrl, gstNumber } = response.data;
                    const fullGst = gstNumber || shopDetail?.gstNumber || "";
                    setSellerInfo({
                        shopName: shopDetail?.shopName || "ARDHYA AGRO SERVICE",
                        address: shopDetail ? `${shopDetail.address}, ${shopDetail.village || ''}, ${shopDetail.district}, ${shopDetail.state} - ${shopDetail.pinCode}` : "Near Mahalaxmi Temple, Hitani",
                        phone: phone || "+91 2855943035",
                        email: email || "ardhya123@gmail.com",
                        website: websiteUrl || "",
                        gstNumber: fullGst || "Not Available",
                        panNumber: fullGst.length >= 12 ? fullGst.substring(2, 12) : "Not Available",
                        stateInfo: fullGst.length >= 2 ? `${fullGst.substring(0, 2)} - ${getStateName(fullGst)}` : "Not Available"
                    });
                }
            } catch (error) {
                console.error("Error fetching seller profile:", error);
            }
        };
        fetchSellerInfo();
    }, []);

    if (!soData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-gray-500 font-outfit text-[13px]">No SO data found for preview.</p>
                <button
                    onClick={() => {
                        const fromPath = location.state?.from || '/seller/sales/order/add';
                        const target = fromPath.includes('?') ? `${fromPath}&restore=true` : `${fromPath}?restore=true`;
                        navigate(target);
                    }}
                    className="px-6 py-2 bg-[#073318] text-white rounded-[10px] font-bold text-[13px]"
                >
                    Go Back
                </button>
            </div>
        );
    }

    if (!sellerInfo) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="animate-spin text-[#073318]" size={40} />
                <p className="text-gray-500 font-outfit text-[14px] font-bold uppercase tracking-widest">Loading Seller Information...</p>
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
        soNumber, so_number,
        customerName, customer_name,
        address,
        soCreationDate, creation_date,
        expiryDate, expiry_date,
        gstNumber, gst_number,
        panNumber, pan_number,
        creditDays, credit_days,
        items = []
    } = soData;

    const final_so_no = soNumber || so_number || "N/A";
    const final_customer_name = customerName || customer_name || "N/A";
    const final_so_creation_date = soCreationDate || creation_date || "N/A";
    const final_expiryDate = expiryDate || expiry_date || "N/A";
    const final_gst_number = gstNumber || gst_number || "-";
    const final_pan_number = panNumber || pan_number || "-";
    const final_credit_days = creditDays || credit_days || "0";

    const subTotal = items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discAmt = parseFloat(item.discountAmount || item.discount_amount || 0);
        const beforeTax = parseFloat(item.before_tax || item.beforeTaxAmount || (qty * rate - discAmt));
        return sum + (beforeTax || 0);
    }, 0);

    const materialTax = items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discAmt = parseFloat(item.discountAmount || item.discount_amount || 0);
        const taxPct = parseFloat(item.taxPercent || item.tax_percent || 0);
        const beforeTax = parseFloat(item.before_tax || item.beforeTaxAmount || (qty * rate - discAmt));
        const taxAmt = parseFloat(item.tax_amount || item.taxAmount || (beforeTax * taxPct / 100));
        return sum + (taxAmt || 0);
    }, 0);
    
    const totalTaxOnCombined = materialTax;
    const cgst = totalTaxOnCombined / 2;
    const sgst = totalTaxOnCombined / 2;
    const totalAmount = subTotal + totalTaxOnCombined;

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
                filename: `SO_${final_so_no}.pdf`,
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
                    aside, nav, header, footer, .no-print, [role="navigation"], .sidebar-container, .top-navigation { 
                        display: none !important; width: 0 !important; height: 0 !important; overflow: hidden !important;
                    }
                    body, #root, #root > div { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; display: block !important; overflow: visible !important; }
                    main, .main-content { margin: 0 !important; padding: 0 !important; display: block !important; }
                    .print-container { width: 210mm; height: 297mm; padding: 10mm; margin: 0 !important; border: none !important; background: white !important; position: absolute; left: 0; top: 0; z-index: 9999; }
                    body > *:not(.print-container) { display: none !important; }
                }
                .black-border { border: 1.5px solid black; }
                .border-b-black { border-bottom: 1px solid black; }
                .border-r-black { border-right: 1px solid black; }
                .border-t-black { border-top: 1px solid black; }
                .border-l-black { border-left: 1px solid black; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid black; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>

            <div className="no-print flex items-center justify-between px-6 pt-4">
                <div className="flex items-center gap-2 text-[12px] font-bold text-gray-400">
                    <span onClick={() => navigate('/seller/sales/order')} className="cursor-pointer hover:text-black">SALES</span>
                    <span>&gt;</span>
                    <span onClick={() => navigate('/seller/sales/order')} className="cursor-pointer hover:text-black">SALES ORDER</span>
                    <span>&gt;</span>
                    <span className="text-[#073318]">PRINT</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDownloadPDF} disabled={isDownloading} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                        {isDownloading ? 'Downloading...' : 'Download PDF'}
                    </button>
                    <button onClick={() => window.print()} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center">
                        Print SO
                    </button>
                    <button 
                        onClick={() => {
                            const fromPath = location.state?.from || '/seller/sales/order/add';
                            const target = fromPath.includes('?') ? `${fromPath}&restore=true` : `${fromPath}?restore=true`;
                            navigate(target);
                        }} 
                        className="px-6 h-[40px] border border-gray-300 rounded-[10px] font-bold text-[14px] flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
            </div>

            <div className="no-print-bg flex justify-center p-6 bg-gray-50/50 min-h-screen">
                <div ref={printRef} className="print-container w-[210mm] h-[296mm] max-h-[296mm] bg-white black-border flex flex-col font-outfit text-black leading-tight overflow-hidden p-[10mm] box-border">
                    <div className="w-full border-black border flex flex-col">
                        <div className="border-b border-black p-4 py-3 flex items-center justify-center relative min-h-[85px]">
                            <div className="absolute left-6 w-14 h-14 bg-[#014A36] rounded-full"></div>
                            <h1 className="text-[26px] font-black uppercase text-center">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</h1>
                        </div>
                        <div className="border-b border-black py-2.5 text-center text-[12.5px] font-semibold">
                            {sellerInfo?.address || "Near Mahalaxmi Temple, Hitani"}
                        </div>
                        <div className="border-b border-black py-2.5 text-center text-[11px] font-semibold tracking-wide">
                            Phone No.: {sellerInfo?.phone || "+91 2855943035"} &nbsp; Email Id: {sellerInfo?.email || "ardhya123@gmail.com"} {sellerInfo?.website && ` &nbsp; Website: ${sellerInfo.website}`}
                        </div>
                        <div className="border-b border-black py-3 text-center font-black text-[15px] uppercase tracking-[3px]">
                            SALES ORDER
                        </div>

                        <div className="flex border-b border-black text-[12px] font-black uppercase">
                            <div className="w-[38%] py-3 px-4">GSTIN : {sellerInfo?.gstNumber}</div>
                            <div className="w-[30%] py-3 px-4 text-center">State Code : {sellerInfo?.stateInfo}</div>
                            <div className="flex-1 py-3 px-4 text-right pr-6 whitespace-nowrap">PAN No : {sellerInfo?.panNumber}</div>
                        </div>

                        <div className="flex border-b border-black min-h-[160px]">
                            <div className="w-1/2 flex flex-col border-r border-black">
                                <div className="border-b border-black flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[30px]">M/S.</span>
                                    <span className="font-black text-[12px] uppercase">{final_customer_name}</span>
                                </div>
                                <div className="flex-1 px-4 py-3 text-[11.5px] leading-relaxed font-semibold overflow-hidden">{address}</div>
                                <div className="border-t border-black flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[70px]">Customer Code</span>
                                    <span className="font-black text-[12px]">CU00001</span>
                                </div>
                            </div>
                            <div className="w-1/2 flex flex-col">
                                <div className="flex border-b border-black h-[44px]">
                                    <div className="w-[43%] flex items-center px-4 gap-4">
                                        <span className="font-black text-[11px] whitespace-nowrap">SO No. :</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{final_so_no}</span>
                                    </div>
                                    <div className="flex-1 flex items-center px-4 gap-4 border-l" style={{ borderColor: 'rgba(0, 0, 0, 0.1)' }}>
                                        <span className="font-black text-[11px] whitespace-nowrap">SO Creation Date :</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(final_so_creation_date)}</span>
                                    </div>
                                </div>
                                <div className="flex-1 border-b border-black flex items-center px-4 py-2.5 gap-4">
                                    <span className="font-black text-[12px] min-w-[80px]">Pay. Terms</span>
                                    <span className="font-semibold text-[12px]">{final_credit_days} Days</span>
                                </div>
                                <div className="flex items-center px-4 h-[44px] gap-4 border-b border-black">
                                    <span className="font-black text-[12px] min-w-[80px]">Expiry Date:</span>
                                    <span className="font-semibold text-[12px]">{formatDate(final_expiryDate)}</span>
                                </div>
                                <div className="flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[80px]">GST No:</span>
                                    <span className="font-semibold text-[12px] uppercase">{final_gst_number || "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        <table className="w-full border-none m-0">
                            <thead>
                                <tr className="text-[11px] font-black h-[40px]">
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
                                            <div className="font-bold text-[13px] transition-all">
                                                {item.productName || item.product_name || "N/A"}
                                                {(() => {
                                                    const desc = item.printDescription || item.print_description || item.description || item.product_description;
                                                    return desc ? ` (${desc})` : '';
                                                })()}
                                            </div>
                                        </td>
                                        <td className="border-b border-r border-black text-center">{item.hsnCode || item.hsn}</td>
                                        <td className="border-b border-r border-black text-center">{item.taxPercent || item.tax_percent}</td>
                                        <td className="border-b border-r border-black text-center">{item.quantity}</td>
                                        <td className="border-b border-r border-black text-center uppercase">{item.uom}</td>
                                        <td className="border-b border-r border-black text-center">{item.rate}</td>
                                        <td className="border-b border-r border-black text-center">{item.discountPercent || item.discount_percent || 0}</td>
                                        <td className="border-b border-black text-right px-4 font-black">{(Number(item.totalAmount || item.total_amount) || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="w-full border-t border-black bg-white">
                            <div className="flex border-b border-black h-[30px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">Material Sub Total</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{Number(subTotal || 0).toFixed(2)}</div>
                            </div>
                            <div className="flex border-b border-black h-[30px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">CGST</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{Number(cgst || 0).toFixed(2)}</div>
                            </div>
                            <div className="flex border-b border-black h-[30px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">SGST</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{Number(sgst || 0).toFixed(2)}</div>
                            </div>
                            <div className="flex h-[45px]">
                                <div className="flex-1 border-r border-black p-4 py-2 font-black text-[10px] flex items-center">
                                    <span className="mr-2">Amount In Words :</span>
                                    <span className="uppercase underline leading-none">{numberToWords(totalAmount)}</span>
                                </div>
                                <div className="w-[100px] border-r border-black flex items-center justify-center font-black text-[11px] uppercase">Grand Total</div>
                                <div className="w-[110px] flex items-center justify-end px-4 font-black text-[14px]">₹ {Number(totalAmount || 0).toFixed(2)}</div>
                            </div>
                        </div>

                        <div className="w-full border-t border-black p-6 flex flex-col justify-between min-h-[140px] bg-white text-right">
                            <p className="font-black text-[11px]">For <span className="uppercase">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</span></p>
                            <p className="font-black text-[10px] uppercase underline underline-offset-4">authorised Signatory</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SOPrintPreview;
