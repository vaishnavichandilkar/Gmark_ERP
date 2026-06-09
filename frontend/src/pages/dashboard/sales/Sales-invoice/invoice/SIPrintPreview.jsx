import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import html2pdf from "html2pdf.js";
import { toast } from 'react-hot-toast';
import axiosInstance from '@/services/axiosInstance';
import { getStandardGstUom } from '@/utils/uomUtils';
import { useTranslation } from 'react-i18next';

const SIPrintPreview = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const invoiceData = location.state?.invoiceData;
    const printRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [sellerInfo, setSellerInfo] = useState(null);

    const getStateName = (gstin) => {
        if (!gstin || gstin.length < 2) return "Not Available";
        const code = gstin.substring(0, 2);
        const states = {
            "01": "JK", "02": "HP", "03": "PB", "04": "CH", "05": "UK",
            "06": "HR", "07": "DL", "08": "RJ", "09": "UP", "10": "BR",
            "11": "SK", "12": "AR", "13": "NL", "14": "MN", "15": "MZ",
            "16": "TR", "17": "ML", "18": "AS", "19": "WB", "20": "JH",
            "21": "OR", "22": "CG", "23": "MP", "24": "GJ", "25": "DD",
            "26": "DN", "27": "MH", "28": "AP", "29": "KA", "30": "GA",
            "31": "LD", "32": "KL", "33": "TN", "34": "PY", "35": "AN",
            "36": "TS", "37": "AD", "38": "LA"
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

    if (!invoiceData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-gray-500 font-outfit text-[13px]">No Invoice data found for preview.</p>
                <button
                    onClick={() => navigate('/seller/sales/invoice/add?restore=true')}
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
            const y = String(date.getFullYear()).slice(-2);
            return `${d}/${m}/${y}`;
        } catch (e) {
            return dateStr;
        }
    };

    const {
        invoiceNumber, customerInvoiceNumber, invoice_number,
        customerName, customer_name,
        address,
        invoiceDate, customerInvoiceDate, invoice_date,
        soNumber, so_number,
        soDate, so_date,
        gstNumber, gstNo, gst_number,
        creditDays, credit_days,
        items = [],
        expenses = [],
        panNo, pan_number
    } = invoiceData;

    const final_invoice_no = invoiceNumber || customerInvoiceNumber || invoice_number || "N/A";
    const final_invoice_date = invoiceDate || customerInvoiceDate || invoice_date || "N/A";
    const final_customer_name = customerName || customer_name || "N/A";
    const final_gst_number = gstNumber || gstNo || gst_number || "-";

    const subTotal = items.reduce((sum, item) => sum + (parseFloat(item.beforeTaxAmount || item.before_tax || (item.quantity * item.rate - (item.discountAmount || item.discount_amount || 0))) || 0), 0);
    const materialTax = items.reduce((sum, item) => sum + (parseFloat(item.taxAmount || item.tax_amount || ((item.quantity * item.rate - (item.discountAmount || item.discount_amount || 0)) * (item.taxPercent || item.tax_percent || 0) / 100)) || 0), 0);
    
    // Taxable base for GST = material cost + direct expenses (not post-gst)
    const directExpenses = expenses.filter(e => !e.isPostGst).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const subtotalWithBeforeGstExpenses = subTotal + directExpenses;

    const effectiveTaxRate = subTotal > 0 ? (materialTax / subTotal) : 0;
    // Read directly from the saved invoice if available
    const savedCgst = parseFloat(invoiceData.cgstAmount || invoiceData.cgst_amount || invoiceData.accountSummary?.cgst || 0);
    const savedSgst = parseFloat(invoiceData.sgstAmount || invoiceData.sgst_amount || invoiceData.accountSummary?.sgst || 0);
    const savedIgst = parseFloat(invoiceData.igstAmount || invoiceData.igst_amount || invoiceData.accountSummary?.igst || 0);

    let isInterState = false;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTaxOnCombined = 0;

    if (savedCgst > 0 || savedSgst > 0 || savedIgst > 0) {
        if (savedIgst > 0) {
            isInterState = true;
            igst = savedIgst;
        } else {
            isInterState = false;
            cgst = savedCgst;
            sgst = savedSgst;
        }
        totalTaxOnCombined = cgst + sgst + igst;
    } else {
        // Fallback to calculation
        const gstTypeStr = typeof invoiceData.gstType === 'string' ? invoiceData.gstType : (invoiceData.gstType?.type || '');
        const isApplicable = invoiceData.gstType?.applicable !== false && gstTypeStr !== 'NONE';
        totalTaxOnCombined = !isApplicable ? 0 : (materialTax + (directExpenses * effectiveTaxRate));

        const sellerStateCode = sellerInfo?.gstNumber && /^\d{2}$/.test(sellerInfo.gstNumber.substring(0, 2)) ? sellerInfo.gstNumber.substring(0, 2) : "";
        const customerStateCode = final_gst_number && /^\d{2}$/.test(final_gst_number.substring(0, 2)) ? final_gst_number.substring(0, 2) : "";
        isInterState = gstTypeStr === 'INTER' || (sellerStateCode && customerStateCode && sellerStateCode !== customerStateCode);

        cgst = !isInterState ? totalTaxOnCombined / 2 : 0;
        sgst = !isInterState ? totalTaxOnCombined / 2 : 0;
        igst = isInterState ? totalTaxOnCombined : 0;
    }

    const postGstExpenses = expenses.filter(e => e.isPostGst).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const grandTotal = subtotalWithBeforeGstExpenses + totalTaxOnCombined + postGstExpenses;

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
                filename: `Invoice_${final_invoice_no}.pdf`,
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
                    <span onClick={() => navigate('/seller/sales/invoice')} className="cursor-pointer hover:text-black uppercase">{t('modules:sales', 'SALES')}</span>
                    <span>&gt;</span>
                    <span onClick={() => navigate('/seller/sales/invoice')} className="cursor-pointer hover:text-black uppercase">{t('modules:sales_invoice', 'SALES INVOICE')}</span>
                    <span>&gt;</span>
                    <span className="text-[#073318] uppercase">{t('common:preview', 'PREVIEW')}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDownloadPDF} disabled={isDownloading} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                        {isDownloading ? t('modules:downloading', 'Downloading...') : t('modules:download_pdf', 'Download PDF')}
                    </button>
                    <button onClick={() => window.print()} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center">
                        {t('modules:print_invoice', 'Print Invoice')}
                    </button>
                    <button onClick={() => {
                        const targetUrl = location.state?.from || '/seller/sales/invoice/add';
                        const needsRestore = targetUrl.includes('/add') || targetUrl.includes('/edit');
                        navigate(targetUrl + (needsRestore ? (targetUrl.includes('?') ? '&' : '?') + 'restore=true' : ''));
                    }} className="px-6 h-[40px] border border-gray-300 rounded-[10px] font-bold text-[14px] flex items-center justify-center gap-2">
                        <ArrowLeft size={16} /> {t('common:back', 'Back')}
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
                            {t('common:phone', 'Phone No.')}: {sellerInfo?.phone || "+91 2855943035"} &nbsp; {t('common:email', 'Email Id')}: {sellerInfo?.email || "ardhya123@gmail.com"} {sellerInfo?.website && ` &nbsp; ${t('common:website', 'Website')}: ${sellerInfo.website}`}
                        </div>
                        <div className="border-b border-black py-3 text-center font-black text-[15px] uppercase tracking-[3px]">
                            {t('modules:sales_invoice', 'SALES INVOICE')}
                        </div>

                        <div className="flex border-b border-black text-[12px] font-black uppercase">
                            <div className="w-[38%] py-3 px-4">{t('common:gstin', 'GSTIN')} : {sellerInfo?.gstNumber}</div>
                            <div className="w-[30%] py-3 px-4 text-center">{t('common:state_code', 'State Code')} : {sellerInfo?.stateInfo}</div>
                            <div className="flex-1 py-3 px-4 text-right pr-6 whitespace-nowrap">{t('common:pan_no', 'PAN No')} : {sellerInfo?.panNumber}</div>
                        </div>

                        <div className="flex border-b border-black min-h-[160px]">
                            <div className="w-1/2 flex flex-col border-r border-black">
                                <div className="border-b border-black flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[30px]">M/S.</span>
                                    <span className="font-black text-[12px] uppercase">{final_customer_name}</span>
                                </div>
                                <div className="flex-1 px-4 py-3 text-[11.5px] leading-relaxed font-semibold overflow-hidden">{address}</div>
                            </div>
                            <div className="w-1/2 flex flex-col">
                                <div className="flex border-b border-black h-[44px]">
                                    <div className="flex-1 flex items-center px-4 gap-4 border-r border-black">
                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:invoice_no', 'Invoice No')}:</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{final_invoice_no}</span>
                                    </div>
                                    <div className="w-[48%] flex items-center px-4 gap-4">
                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:invoice_date', 'Invoice Date')}:</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(final_invoice_date)}</span>
                                    </div>
                                </div>
                                <div className="flex border-b border-black h-[44px]">
                                    <div className="flex-1 flex items-center px-4 gap-4 border-r border-black">
                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:so_no', 'SO No.')} :</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{soNumber || t('common:n_a', 'N/A')}</span>
                                    </div>
                                    <div className="w-[48%] flex items-center px-4 gap-4">
                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:so_date', 'SO Date')} :</span>
                                        <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(soDate)}</span>
                                    </div>
                                </div>
                                <div className="flex-1 border-b border-black flex items-center px-4 py-2.5 gap-4">
                                    <span className="font-black text-[12px] min-w-[80px]">{t('modules:pay_terms', 'Pay. Terms')}:</span>
                                    <span className="font-semibold text-[12px]">{creditDays} {t('common:days', 'Days')}</span>
                                </div>
                                <div className="flex items-center px-4 h-[44px] gap-4">
                                    <span className="font-black text-[12px] min-w-[80px]">{t('common:gst_no', 'GST No')}:</span>
                                    <span className="font-semibold text-[12px] uppercase">{final_gst_number}</span>
                                </div>
                            </div>
                        </div>

                        <table className="w-full border-none m-0">
                            <thead>
                                <tr className="text-[11px] font-black h-[40px]">
                                    <th className="w-[45px] border-b border-r border-black">{t('common:sn', 'Sn.')}</th>
                                    <th className="border-b border-r border-black px-4 text-left">{t('common:description', 'Description')}</th>
                                    <th className="w-[85px] border-b border-r border-black">{t('common:hsn_sac', 'HSN/SAC')}</th>
                                    <th className="w-[50px] border-b border-r border-black text-center">{t('common:tax_percent', 'Tax%')}</th>
                                    <th className="w-[65px] border-b border-r border-black text-center">{t('common:quantity', 'Quantity')}</th>
                                    <th className="w-[65px] border-b border-r border-black text-center">{t('common:units', 'Units')}</th>
                                    <th className="w-[85px] border-b border-r border-black text-center">{t('common:rate', 'Rate')}</th>
                                    <th className="w-[110px] border-b border-black text-right px-4">{t('common:amount', 'Amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                 {items.map((item, idx) => (
                                     <tr key={item.id || idx} className="text-[12px] font-semibold min-h-[40px]">
                                         <td className="border-b border-r border-black text-center">{idx + 1}</td>
                                         <td className="border-b border-r border-black px-4 py-2 leading-tight">
                                             <div className="font-bold text-[13px]">
                                                 {item.productName || item.product_name || t('common:n_a', 'N/A')}
                                                 {(() => {
                                                     const desc = item.printDescription || item.print_description || item.description || item.product_description;
                                                     return desc ? ` (${desc})` : '';
                                                 })()}
                                             </div>
                                         </td>
                                         <td className="border-b border-r border-black text-center">{item.hsnCode || item.hsn_code || item.hsn}</td>
                                         <td className="border-b border-r border-black text-center">{item.taxPercent || item.tax_percent}</td>
                                         <td className="border-b border-r border-black text-center">{item.quantity}</td>
                                         <td className="border-b border-r border-black text-center uppercase">{getStandardGstUom(item.uom)}</td>
                                         <td className="border-b border-r border-black text-center">{item.rate}</td>
                                         <td className="border-b border-black text-right px-4 font-black">{(parseFloat(item.totalAmount || item.total_amount) || 0).toFixed(2)}</td>
                                     </tr>
                                 ))}
                            </tbody>
                        </table>

                        <div className="w-full border-t border-black bg-white">
                            <div className="flex border-b border-black h-[30px]">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('modules:material_sub_total', 'Material Sub Total')}</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{subTotal.toFixed(2)}</div>
                            </div>
                            
                            {expenses.filter(e => !e.isPostGst).map((exp, idx) => (
                                <div key={idx} className="flex border-b border-black h-[30px]">
                                    <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px] italic">{exp.groupName}</div>
                                    <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{parseFloat(exp.amount).toFixed(2)}</div>
                                </div>
                            ))}

                            <div className="flex border-b border-black h-[40px] bg-gray-50/50">
                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[12px] uppercase tracking-wide">{t('modules:taxable_sub_total', 'Taxable Sub Total')}</div>
                                <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[12px]">{subtotalWithBeforeGstExpenses.toFixed(2)}</div>
                            </div>

                            {!isInterState ? (
                                <>
                                    <div className="flex border-b border-black h-[30px]">
                                        <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('common:cgst', 'CGST')}</div>
                                        <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{cgst.toFixed(2)}</div>
                                    </div>
                                    <div className="flex border-b border-black h-[30px]">
                                        <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('common:sgst', 'SGST')}</div>
                                        <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{sgst.toFixed(2)}</div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex border-b border-black h-[30px]">
                                    <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('common:igst', 'IGST')}</div>
                                    <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{igst.toFixed(2)}</div>
                                </div>
                            )}

                            {expenses.filter(e => e.isPostGst).map((exp, idx) => (
                                <div key={idx} className="flex border-b border-black h-[30px]">
                                    <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px] italic">{exp.groupName}</div>
                                    <div className="w-[110px] border-l border-black flex items-center justify-end px-4 font-black text-[11px]">{parseFloat(exp.amount).toFixed(2)}</div>
                                </div>
                            ))}

                            <div className="flex h-[45px]">
                                <div className="flex-1 border-r border-black p-4 py-2 font-black text-[10px] flex items-center">
                                    <span className="mr-2">{t('common:amount_in_words', 'Amount In Words')} :</span>
                                    <span className="uppercase underline">{numberToWords(grandTotal)}</span>
                                </div>
                                <div className="w-[100px] border-r border-black flex items-center justify-center font-black text-[11px] uppercase">{t('common:grand_total', 'Grand Total')}</div>
                                <div className="w-[110px] flex items-center justify-end px-4 font-black text-[14px]">₹ {grandTotal.toFixed(2)}</div>
                            </div>
                        </div>

                        <div className="w-full border-t border-black p-6 flex flex-col justify-between min-h-[140px] bg-white text-right">
                            <p className="font-black text-[11px]">{t('common:for', 'For')} <span className="uppercase">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</span></p>
                            <p className="font-black text-[10px] uppercase underline underline-offset-4">{t('common:authorised_signatory', 'authorised Signatory')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SIPrintPreview;
