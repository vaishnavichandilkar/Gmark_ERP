import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import html2pdf from "html2pdf.js";
import { toast } from 'react-hot-toast';
import axiosInstance from '@/services/axiosInstance';
import { getStandardGstUom } from '@/utils/uomUtils';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/dateUtils';

const SIPrintPreview = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const invoiceData = location.state?.invoiceData;
    const printRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [sellerInfo, setSellerInfo] = useState(null);

    const getStateName = (gstin) => {
        if (!gstin || gstin.length < 2) return t('common:not_available', "Not Available");
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
        return states[code] || t('common:not_available', "Not Available");
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
                        gstNumber: fullGst || t('common:not_available', "Not Available"),
                        panNumber: fullGst.length >= 12 ? fullGst.substring(2, 12) : t('common:not_available', "Not Available"),
                        stateInfo: fullGst.length >= 2 ? `${fullGst.substring(0, 2)} - ${getStateName(fullGst)}` : t('common:not_available', "Not Available")
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
                <p className="text-gray-500 font-outfit text-[13px]">{t('modules:no_invoice_data', 'No Invoice data found for preview.')}</p>
                <button
                    onClick={() => navigate('/seller/sales/invoice/add?restore=true')}
                    className="px-6 py-2 bg-[#073318] text-white rounded-[10px] font-bold text-[13px]"
                >
                    {t('common:go_back', 'Go Back')}
                </button>
            </div>
        );
    }

    if (!sellerInfo) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="animate-spin text-[#073318]" size={40} />
                <p className="text-gray-500 font-outfit text-[14px] font-bold uppercase tracking-widest">{t('modules:loading_seller_info', 'Loading Seller Information...')}</p>
            </div>
        );
    }



    const {
        invoiceNumber, customerInvoiceNumber, invoice_number,
        customerName, customer_name,
        address,
        invoiceDate, customerInvoiceDate, invoice_date,
        soNumber, so_number,
        soDate, so_date,
        gstNumber, gstNo, gst_number,
        creditDays, credit_days,
        items: rawItems = [],
        expenses = [],
        panNo, pan_number
    } = invoiceData;

    const items = rawItems.filter(item => {
        const name = (item.productName || item.product_name || "").trim();
        const code = (item.productCode || item.product_code || "").trim();
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        return name !== "" || code !== "" || qty > 0 || rate > 0;
    });

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
        const isApplicable = invoiceData.gstType?.applicable !== false && 
                             gstTypeStr !== 'NONE' &&
                             final_gst_number &&
                             final_gst_number.trim() !== '-' &&
                             final_gst_number.trim() !== '' &&
                             final_gst_number.trim().toUpperCase() !== 'N/A' &&
                             final_gst_number.trim().toUpperCase() !== 'NOT AVAILABLE' &&
                             final_gst_number.trim().length >= 10;
        
        totalTaxOnCombined = !isApplicable ? 0 : (materialTax + (directExpenses * effectiveTaxRate));

        if (!isApplicable) {
            isInterState = false;
            cgst = 0;
            sgst = 0;
            igst = 0;
        } else {
            const sellerStateCode = sellerInfo?.gstNumber && /^\d{2}$/.test(sellerInfo.gstNumber.substring(0, 2)) ? sellerInfo.gstNumber.substring(0, 2) : "";
            const customerStateCode = final_gst_number && /^\d{2}$/.test(final_gst_number.substring(0, 2)) ? final_gst_number.substring(0, 2) : "";
            isInterState = gstTypeStr === 'INTER' || (sellerStateCode && customerStateCode && sellerStateCode !== customerStateCode);

            cgst = !isInterState ? totalTaxOnCombined / 2 : 0;
            sgst = !isInterState ? totalTaxOnCombined / 2 : 0;
            igst = isInterState ? totalTaxOnCombined : 0;
        }
    }

    if (totalTaxOnCombined === 0) {
        isInterState = false;
        cgst = 0;
        sgst = 0;
        igst = 0;
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

    const wrapText = (text, limit = 35) => {
        if (!text) return [];
        const lines = text.split('\n');
        const wrapped = [];
        for (const line of lines) {
            if (line.length <= limit) {
                wrapped.push(line);
            } else {
                let current = line;
                while (current.length > 0) {
                    let cutIndex = limit;
                    if (current.length > limit) {
                        const lastSpace = current.lastIndexOf(' ', limit);
                        if (lastSpace > 5) {
                            cutIndex = lastSpace;
                        }
                    }
                    wrapped.push(current.substring(0, cutIndex).trim());
                    current = current.substring(cutIndex).trim();
                }
            }
        }
        while (wrapped.length > 0 && wrapped[wrapped.length - 1] === "") {
            wrapped.pop();
        }
        return wrapped;
    };

    const getPageSchema = () => {
        const ROW_LIMIT = 270; // Safer row limit to prevent page overflow and layout splitting

        const pages = [];
        let pageItems = [];
        let currentRowsHeight = 0;

        let i = 0;
        let linesRemaining = null;
        let currentItem = null;
        let isCont = false;
        let currentCombinedText = "";

        while (i < items.length || linesRemaining !== null) {
            // Load next item if no lines remaining from a split
            if (linesRemaining === null) {
                currentItem = items[i];
                const prodName = (currentItem.productName || currentItem.product_name || "").trim();
                const desc = (currentItem.printDescription || currentItem.print_description || currentItem.description || currentItem.product_description || "").trim();
                currentCombinedText = (prodName + (desc ? ` (${desc})` : "")).trim();
                linesRemaining = wrapText(currentCombinedText, 40);
                if (linesRemaining.length === 0) {
                    linesRemaining = [""];
                }
                isCont = false;
            }

            const lineCount = linesRemaining.length;
            const rowHeight = lineCount * 16 + 12;

            const remainingSpace = ROW_LIMIT - currentRowsHeight;

            if (rowHeight <= remainingSpace) {
                // Fits completely on the current page
                pageItems.push({
                    isContinuation: isCont,
                    sn: isCont ? "" : i + 1,
                    productName: isCont ? "" : (currentItem.productName || currentItem.product_name || "N/A"),
                    printDescription: isCont ? linesRemaining.join(' ') : currentCombinedText,
                    hsnCode: isCont ? "" : (currentItem.hsnCode || currentItem.hsn_code || currentItem.hsn || ""),
                    taxPercent: isCont ? "" : (currentItem.taxPercent ?? currentItem.tax_percent ?? 0),
                    quantity: isCont ? "" : currentItem.quantity,
                    uom: isCont ? "" : currentItem.uom,
                    rate: isCont ? "" : currentItem.rate,
                    totalAmount: isCont ? 0 : parseFloat(currentItem.totalAmount || currentItem.total_amount || 0),
                    rowHeight: rowHeight
                });
                currentRowsHeight += rowHeight;
                linesRemaining = null;
                i++;
            } else {
                // Does not fit completely. Try to fit at least 1 line.
                const maxLines = Math.floor((remainingSpace - 12) / 16);

                if (maxLines >= 1) {
                    // Split the lines
                    const linesToFit = linesRemaining.slice(0, maxLines);
                    const linesForNext = linesRemaining.slice(maxLines);
                    const fitRowHeight = linesToFit.length * 16 + 12;

                    pageItems.push({
                        isContinuation: isCont,
                        sn: isCont ? "" : i + 1,
                        productName: isCont ? "" : (currentItem.productName || currentItem.product_name || "N/A"),
                        printDescription: linesToFit.join(' '),
                        hsnCode: isCont ? "" : (currentItem.hsnCode || currentItem.hsn_code || currentItem.hsn || ""),
                        taxPercent: isCont ? "" : (currentItem.taxPercent ?? currentItem.tax_percent ?? 0),
                        quantity: isCont ? "" : currentItem.quantity,
                        uom: isCont ? "" : currentItem.uom,
                        rate: isCont ? "" : currentItem.rate,
                        totalAmount: isCont ? 0 : parseFloat(currentItem.totalAmount || currentItem.total_amount || 0),
                        rowHeight: fitRowHeight
                    });
                    currentRowsHeight += fitRowHeight;
                    linesRemaining = linesForNext;
                    isCont = true;
                }

                // Current page is full, push it and start a new one
                pages.push({
                    pageNumber: pages.length + 1,
                    showHeader: true,
                    showCustomerInfo: true,
                    items: pageItems,
                    showTotals: true,
                    showSignatory: true
                });
                pageItems = [];
                currentRowsHeight = 0;

                if (maxLines < 1) {
                    // If we couldn't even fit 1 line, we do NOT change linesRemaining.
                    // It will be processed on the fresh page in the next iteration.
                }
            }
        }

        // Push the last page if there are leftover items
        if (pageItems.length > 0) {
            pages.push({
                pageNumber: pages.length + 1,
                showHeader: true,
                showCustomerInfo: true,
                items: pageItems,
                showTotals: true,
                showSignatory: true
            });
        }

        return pages;
    };

    const pages = getPageSchema();

    const handleDownloadPDF = async () => {
        try {
            setIsDownloading(true);
            const loadToastId = toast.loading('Generating Pixel-Perfect PDF...');

            // Defer execution to allow React state updates and browser rendering
            await new Promise((resolve) => setTimeout(resolve, 300));

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
                },
                pagebreak: { mode: ['css', 'legacy'] }
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
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    aside, nav, header, footer, .no-print, [role="navigation"], .sidebar-container, .top-navigation { 
                        display: none !important; width: 0 !important; height: 0 !important; overflow: hidden !important;
                    }
                    html, body, #root, #root > div, div:has(.print-container) { margin: 0 !important; padding: 0 !important; width: 100% !important; height: auto !important; min-height: 0 !important; display: block !important; overflow: visible !important; background: transparent !important; }
                    main, .main-content { margin: 0 !important; padding: 0 !important; display: block !important; }
                    .print-container { width: 210mm !important; height: 296mm !important; max-height: 296mm !important; padding: 10mm !important; margin: 0 auto !important; border: none !important; background: white !important; position: relative !important; z-index: 9999; box-sizing: border-box !important; overflow: hidden !important; }
                    body > *:not(.print-container) { display: none !important; }
                    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
                    .page-break-avoid { page-break-inside: avoid !important; break-inside: avoid !important; }
                }
                /* Hide scrollbars globally on this page (both screen and print) */
                ::-webkit-scrollbar {
                    display: none !important;
                }
                * {
                    scrollbar-width: none !important;
                    -ms-overflow-style: none !important;
                }
                .black-border { border: 1.5px solid black; }
                .border-b-black { border-bottom: 1px solid black; }
                .border-r-black { border-right: 1px solid black; }
                .border-t-black { border-top: 1px solid black; }
                .border-l-black { border-left: 1px solid black; }
                table { border-collapse: collapse; width: 100%; table-layout: fixed; }
                div.no-print-bg .print-container table th {
                    background-color: #014A36 !important;
                    color: white !important;
                    border-bottom: 1px solid black !important;
                    border-right: 1px solid rgba(255, 255, 255, 0.4) !important;
                    border-top: none !important;
                    border-left: none !important;
                    vertical-align: middle !important;
                    height: 40px;
                }
                div.no-print-bg .print-container table td {
                    border-bottom: 1px solid black !important;
                    border-right: 1px solid black !important;
                    border-top: none !important;
                    border-left: none !important;
                    vertical-align: top !important;
                }
                div.no-print-bg .print-container table th:last-child,
                div.no-print-bg .print-container table td:last-child {
                    border-right: none !important;
                }
                tr { page-break-inside: avoid; break-inside: avoid; }
                .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
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
                        <ArrowLeft size={16} />
                        {t('common:back', 'Back')}
                    </button>
                </div>
            </div>

            <div 
                ref={printRef} 
                className={`no-print-bg flex flex-col items-center min-h-screen ${
                    isDownloading ? 'p-0 gap-0 bg-white' : 'p-6 gap-6 bg-gray-50/50'
                }`}
            >
                {pages.map((page, pageIdx) => (
                    <div 
                        key={pageIdx} 
                        className={`print-container w-[210mm] h-[296mm] max-h-[296mm] bg-white flex flex-col font-outfit text-black leading-tight p-[10mm] box-border relative ${
                            isDownloading ? 'border-none shadow-none' : 'black-border shadow-md'
                        }`}
                        style={{ 
                            pageBreakAfter: pageIdx === pages.length - 1 ? 'avoid' : 'always',
                            breakAfter: pageIdx === pages.length - 1 ? 'avoid' : 'page'
                        }}
                    >
                        <div className="flex flex-col h-full w-full relative">
                            <div className="w-full border-black border h-full relative">
                                {page.showHeader && (
                                    <>
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
                                    </>
                                )}

                                {page.showCustomerInfo && (
                                    <div className="flex border-b border-black min-h-[160px] page-break-avoid">
                                        <div className="w-1/2 flex flex-col border-r border-black">
                                            <div className="border-b border-black flex items-center px-4 h-[44px] gap-4">
                                                <span className="font-black text-[12px] min-w-[30px]">{t('modules:ms', 'M/S.')}</span>
                                                <span className="font-black text-[12px] uppercase">{final_customer_name}</span>
                                            </div>
                                            <div className="flex-1 px-4 py-3 text-[11.5px] leading-relaxed font-semibold overflow-hidden">{address}</div>
                                            <div className="border-t border-black flex items-center px-4 h-[44px] gap-4">
                                                <span className="font-black text-[12px] min-w-[70px]">{t('modules:customer_code', 'Customer Code')}</span>
                                                <span className="font-black text-[12px]">{invoiceData?.customerCode || invoiceData?.customer_code || "CU00001"}</span>
                                            </div>
                                        </div>
                                        <div className="w-1/2 flex flex-col">
                                            <div className="flex border-b border-black h-[44px]">
                                                <div className="w-[45%] flex items-center px-4 gap-2">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:invoice_no', 'Invoice No')}:</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{final_invoice_no}</span>
                                                </div>
                                                <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:invoice_date', 'Invoice Date')}:</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(final_invoice_date)}</span>
                                                </div>
                                            </div>
                                            <div className="flex border-b border-black h-[44px]">
                                                <div className="w-[45%] flex items-center px-4 gap-2">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:so_no', 'SO No.')} :</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{soNumber || t('common:n_a', 'N/A')}</span>
                                                </div>
                                                <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:so_date', 'SO Date')} :</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(soDate)}</span>
                                                </div>
                                            </div>
                                            <div className="flex border-b border-black h-[44px]">
                                                <div className="w-[45%] flex items-center px-4 gap-2">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:pay_terms', 'Pay. Terms')} :</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{creditDays || credit_days || "0"} {t('common:days', 'Days')}</span>
                                                </div>
                                                <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                    <span className="font-black text-[11px] whitespace-nowrap"></span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap"></span>
                                                </div>
                                            </div>
                                            <div className="flex h-[44px]">
                                                <div className="w-[45%] flex items-center px-4 gap-2">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('common:gst_no', 'GST No')} :</span>
                                                    <span className="font-semibold text-[11px] uppercase">{final_gst_number || "N/A"}</span>
                                                </div>
                                                <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('common:pan_no', 'PAN No')} :</span>
                                                    <span className="font-semibold text-[11px] uppercase">{panNo || pan_number || (final_gst_number?.length >= 12 ? final_gst_number.substring(2, 12).toUpperCase() : "-")}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {page.items.length > 0 && (
                                    <table className="w-full border-none m-0">
                                        <thead>
                                            <tr className="text-[9px] font-black h-[32px] uppercase tracking-tight">
                                                <th className="w-[32px] border-b border-r border-black text-center px-0.5">{t('common:sn', 'SN.')}</th>
                                                <th className="border-b border-r border-black px-3 text-left">{t('common:description', 'DESCRIPTION')}</th>
                                                <th className="w-[68px] border-b border-r border-black text-center px-0.5">{t('common:hsn_sac', 'HSN/SAC')}</th>
                                                <th className="w-[46px] border-b border-r border-black text-center px-0.5">{t('common:tax_percent', 'TAX %')}</th>
                                                <th className="w-[66px] border-b border-r border-black text-center px-0.5">{t('common:quantity', 'QUANTITY')}</th>
                                                <th className="w-[72px] border-b border-r border-black text-center px-0.5">{t('common:units', 'UNITS')}</th>
                                                <th className="w-[58px] border-b border-r border-black text-center px-0.5">{t('common:rate', 'RATE')}</th>
                                                <th className="w-[78px] border-b border-black text-right px-2">{t('common:amount', 'AMOUNT')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                             {page.items.map((item, idx) => (
                                                 <tr key={idx} className="text-[10px] font-medium">
                                                     <td className="text-center py-[4px] px-0.5 text-[9.5px]">{item.sn}</td>
                                                     <td className="px-2 py-[4px]">
                                                         <div className="font-semibold text-[10.5px] whitespace-pre-wrap text-left" style={{ lineHeight: '13px' }}>
                                                             {item.printDescription}
                                                         </div>
                                                     </td>
                                                     <td className="text-center py-[4px] px-0.5 text-[9.5px] whitespace-nowrap">{item.hsnCode}</td>
                                                     <td className="text-center py-[4px] px-0.5 text-[9.5px] whitespace-nowrap">{item.taxPercent !== "" ? item.taxPercent : ""}</td>
                                                     <td className="text-center py-[4px] px-0.5 text-[9.5px] font-medium whitespace-nowrap">{item.quantity}</td>
                                                     <td className="text-center uppercase py-[4px] px-0.5 text-[8.5px] font-bold whitespace-nowrap">{item.uom ? getStandardGstUom(item.uom) : ""}</td>
                                                     <td className="text-center py-[4px] px-0.5 text-[9.5px] font-medium whitespace-nowrap">{item.rate}</td>
                                                     <td className="text-right px-2 py-[4px] text-[10px] font-bold whitespace-nowrap">
                                                         {item.isContinuation ? "" : (parseFloat(item.totalAmount) || 0).toFixed(2)}
                                                     </td>
                                                 </tr>
                                             ))}
                                        </tbody>
                                    </table>
                                )}

                                <div className="w-full flex flex-col bg-white">
                                    {page.showTotals && (
                                        <div className="w-full bg-white page-break-avoid">
                                            <div className="flex border-b border-black h-[30px]">
                                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('modules:material_sub_total', 'Material Sub Total')}</div>
                                                <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{subTotal.toFixed(2)}</div>
                                            </div>
                                            
                                            {expenses.filter(e => !e.isPostGst).map((exp, idx) => (
                                                <div key={idx} className="flex border-b border-black h-[30px]">
                                                    <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px] italic">{exp.groupName}</div>
                                                    <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{parseFloat(exp.amount).toFixed(2)}</div>
                                                </div>
                                            ))}

                                            <div className="flex border-b border-black h-[40px] bg-gray-50/50">
                                                <div className="flex-1 flex justify-end items-center pr-4 font-black text-[12px] uppercase tracking-wide">{t('modules:taxable_sub_total', 'Taxable Sub Total')}</div>
                                                <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[12px] whitespace-nowrap">{subtotalWithBeforeGstExpenses.toFixed(2)}</div>
                                            </div>

                                            {!isInterState ? (
                                                <>
                                                    <div className="flex border-b border-black h-[30px]">
                                                        <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('common:cgst', 'CGST')}</div>
                                                        <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{cgst.toFixed(2)}</div>
                                                    </div>
                                                    <div className="flex border-b border-black h-[30px]">
                                                        <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('common:sgst', 'SGST')}</div>
                                                        <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{sgst.toFixed(2)}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex border-b border-black h-[30px]">
                                                    <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">{t('common:igst', 'IGST')}</div>
                                                    <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{igst.toFixed(2)}</div>
                                                </div>
                                            )}

                                            {expenses.filter(e => e.isPostGst).map((exp, idx) => (
                                                <div key={idx} className="flex border-b border-black h-[30px]">
                                                    <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px] italic">{exp.groupName}</div>
                                                    <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{parseFloat(exp.amount).toFixed(2)}</div>
                                                </div>
                                            ))}

                                            <div className="flex h-[45px]">
                                                <div className="flex-1 border-r border-black p-4 py-2 font-black text-[10px] flex items-center">
                                                    <span className="mr-2">{t('common:amount_in_words', 'Amount In Words')} :</span>
                                                    <span className="uppercase underline leading-none">{numberToWords(grandTotal)}</span>
                                                </div>
                                                <div className="w-[100px] border-r border-black flex items-center justify-center font-black text-[11px] uppercase">{t('common:grand_total', 'Grand Total')}</div>
                                                <div className="w-[80px] flex items-center justify-end pr-4 pl-1 font-black text-[13px] whitespace-nowrap">₹{grandTotal.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {page.showSignatory && (
                                        <div className="w-full border-t border-black p-4 py-3 bg-white text-right page-break-avoid block">
                                            <p className="font-black text-[11px]" style={{ marginBottom: '50px' }}>{t('common:for', 'For')} <span className="uppercase">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</span></p>
                                            <p className="font-black text-[10px] uppercase underline underline-offset-4">{t('common:authorised_signatory', 'Authorised Signatory')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="absolute bottom-[4mm] left-0 right-0 text-center text-[10px] font-semibold text-gray-500">
                                Page {page.pageNumber} of {pages.length}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SIPrintPreview;
