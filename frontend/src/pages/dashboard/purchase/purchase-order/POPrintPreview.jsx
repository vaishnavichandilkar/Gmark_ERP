import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import html2pdf from "html2pdf.js";
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { determinePurchaseGst } from '@/utils/gstUtils';
import axiosInstance from '../../../../services/axiosInstance';
import { getStandardGstUom } from '../../../../utils/uomUtils';
import { formatDate } from '@/utils/dateUtils';

const POPrintPreview = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const poData = location.state?.poData;
    const printRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [sellerInfo, setSellerInfo] = useState(null);
    const [supplierDetails, setSupplierDetails] = useState(null);

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

    const getStateCodeFromName = (stateName) => {
        if (!stateName) return t('common:not_available', "Not Available");
        const cleanName = stateName.trim().toLowerCase();
        
        const codeMap = {
            "01": "JK", "02": "HP", "03": "PB", "04": "CH", "05": "UK",
            "06": "HR", "07": "DL", "08": "RJ", "09": "UP", "10": "BR",
            "11": "SK", "12": "AR", "13": "NL", "14": "MN", "15": "MZ",
            "16": "TR", "17": "ML", "18": "AS", "19": "WB", "20": "JH",
            "21": "OR", "22": "CG", "23": "MP", "24": "GJ", "25": "DD",
            "26": "DN", "27": "MH", "28": "AP", "29": "KA", "30": "GA",
            "31": "LD", "32": "KL", "33": "TN", "34": "PY", "35": "AN",
            "36": "TS", "37": "AD", "38": "LA"
        };

        const upperName = stateName.trim().toUpperCase();
        if (Object.values(codeMap).includes(upperName)) {
            const numCode = Object.keys(codeMap).find(key => codeMap[key] === upperName) || "";
            return numCode ? `${numCode} - ${upperName}` : upperName;
        }

        const gstStateCodes = {
            '01': 'Jammu And Kashmir',
            '02': 'Himachal Pradesh',
            '03': 'Punjab',
            '04': 'Chandigarh',
            '05': 'Uttarakhand',
            '06': 'Haryana',
            '07': 'Delhi',
            '08': 'Rajasthan',
            '09': 'Uttar Pradesh',
            '10': 'Bihar',
            '11': 'Sikkim',
            '12': 'Arunachal Pradesh',
            '13': 'Nagaland',
            '14': 'Manipur',
            '15': 'Mizoram',
            '16': 'Tripura',
            '17': 'Meghalaya',
            '18': 'Assam',
            '19': 'West Bengal',
            '20': 'Jharkhand',
            '21': 'Odisha',
            '22': 'Chattisgarh',
            '23': 'Madhya Pradesh',
            '24': 'Gujarat',
            '25': 'Daman And Diu',
            '26': 'Dadra And Nagar Haveli And Daman And Diu',
            '27': 'Maharashtra',
            '28': 'Andhra Pradesh',
            '29': 'Karnataka',
            '30': 'Goa',
            '31': 'Lakshadweep',
            '32': 'Kerala',
            '33': 'Tamil Nadu',
            '34': 'Puducherry',
            '35': 'Andaman And Nicobar Islands',
            '36': 'Telangana',
            '37': 'Andhra Pradesh (New)',
            '38': 'Ladakh'
        };

        const foundNum = Object.keys(gstStateCodes).find(
            key => gstStateCodes[key].toLowerCase() === cleanName
        );

        if (foundNum) {
            const abbrev = codeMap[foundNum] || "";
            return `${foundNum} - ${abbrev}`;
        }

        return stateName;
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

    useEffect(() => {
        const fetchSupplierDetails = async () => {
            const name = poData?.supplierName || poData?.supplier_name || poData?.supplier_name_sn;
            if (!name || name === "N/A") return;
            try {
                const response = await axiosInstance.get('/account-master', {
                    params: { search: name }
                });
                const accounts = response.data?.data || response.data || [];
                const matched = accounts.find(
                    acc => acc.accountName?.toLowerCase() === name.toLowerCase()
                );
                if (matched) {
                    setSupplierDetails(matched);
                }
            } catch (error) {
                console.error("Error fetching supplier details:", error);
            }
        };
        fetchSupplierDetails();
    }, [poData]);

    const isGstApplicable = useMemo(() => {
        const gst = poData?.gstNumber || poData?.gst_number;
        return Boolean(
            gst && 
            gst.trim() !== '-' && 
            gst.trim() !== '' && 
            gst.trim().toUpperCase() !== 'N/A' &&
            gst.trim().toUpperCase() !== 'NOT AVAILABLE' &&
            gst.trim().length >= 10
        );
    }, [poData]);

    const supplier_pan = useMemo(() => {
        const gst = poData?.gstNumber || poData?.gst_number || poData?.gstNo || "";
        const pan = poData?.pan_number || poData?.panNo || poData?.panNumber || supplierDetails?.panNo || "";
        if (pan && pan.trim() !== "" && pan !== "-") return pan.toUpperCase();
        if (gst && gst.length >= 12 && gst !== "-") {
            return gst.substring(2, 12).toUpperCase();
        }
        return "-";
    }, [poData, supplierDetails]);

    const supplier_state_info = useMemo(() => {
        const state = poData?.supplier_state || poData?.supplierState || poData?.state || supplierDetails?.state || "";
        if (state && state.trim() !== "" && state !== "-") {
            return getStateCodeFromName(state);
        }
        return t('common:not_available', "Not Available");
    }, [poData, supplierDetails, t]);

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

    if (!sellerInfo) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="animate-spin text-[#073318]" size={40} />
                <p className="text-gray-500 font-outfit text-[14px] font-bold uppercase tracking-widest">Loading Seller Information...</p>
            </div>
        );
    }



    const {
        poNumber, po_number,
        supplierName, supplier_name: supplier_name_sn,
        address,
        poCreationDate, creation_date,
        expiryDate, expiry_date: expiry_date_sn,
        gstNumber, gst_number: gst_number_sn,
        panNumber, pan_number: pan_number_sn, panNo,
        creditDays, credit_days: credit_days_sn,
        items: rawItems = []
    } = poData;

    const items = rawItems.filter(item => {
        const name = (item.productName || item.product_name || "").trim();
        const code = (item.productCode || item.product_code || "").trim();
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        return name !== "" || code !== "" || qty > 0 || rate > 0;
    });

    const po_no = poNumber || po_number || "N/A";
    const supplier_name = supplierName || supplier_name_sn || "N/A";
    const po_creation_date = poCreationDate || creation_date || "N/A";
    const expiry_date = expiryDate || expiry_date_sn || "N/A";
    const gst_number = gstNumber || gst_number_sn || "-";
    const pan_number = panNumber || pan_number_sn || panNo || "-";
    const credit_days = creditDays || credit_days_sn || "0";



    const subTotal = items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discAmt = parseFloat(item.discountAmount || item.discount_amount || 0);
        const beforeTax = parseFloat(item.before_tax || item.beforeTaxAmount || (qty * rate - discAmt));
        return sum + (beforeTax || 0);
    }, 0);

    const materialTax = isGstApplicable ? items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discAmt = parseFloat(item.discountAmount || item.discount_amount || 0);
        const taxPct = parseFloat(item.taxPercent ?? item.tax_percent ?? 0);
        const beforeTax = parseFloat(item.before_tax || item.beforeTaxAmount || (qty * rate - discAmt));
        const rawTaxAmt = item.tax_amount ?? item.taxAmount;
        const taxAmt = (rawTaxAmt !== undefined && rawTaxAmt !== null && rawTaxAmt !== '') 
            ? parseFloat(rawTaxAmt) 
            : (beforeTax * taxPct / 100);
        return sum + (taxAmt || 0);
    }, 0) : 0;
    
    // Read directly from the saved purchase order if available
    const savedCgst = parseFloat(poData.cgstAmount || poData.cgst_amount || poData.cgst || poData.accountSummary?.cgst || 0);
    const savedSgst = parseFloat(poData.sgstAmount || poData.sgst_amount || poData.sgst || poData.accountSummary?.sgst || 0);
    const savedIgst = parseFloat(poData.igstAmount || poData.igst_amount || poData.igst || poData.accountSummary?.igst || 0);

    let isIntraState = true;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTaxOnCombined = 0;

    if (!isGstApplicable) {
        isIntraState = true;
        cgst = 0;
        sgst = 0;
        igst = 0;
        totalTaxOnCombined = 0;
    } else if (savedCgst > 0 || savedSgst > 0 || savedIgst > 0) {
        if (savedIgst > 0) {
            isIntraState = false;
            igst = savedIgst;
        } else {
            isIntraState = true;
            cgst = savedCgst;
            sgst = savedSgst;
        }
        totalTaxOnCombined = cgst + sgst + igst;
    } else {
        // Fallback to calculation
        const totalTaxOnCombinedCalculated = materialTax;
        const gstResult = determinePurchaseGst(
            gst_number || "",
            sellerInfo?.gstNumber || "",
            sellerInfo?.state || "",
            poData?.state || poData?.supplierState || poData?.supplier_state || "",
            0, 0, totalTaxOnCombinedCalculated
        );

        isIntraState = gstResult.gstType === 'CGST_SGST';
        totalTaxOnCombined = totalTaxOnCombinedCalculated;
        cgst = gstResult.cgstAmount;
        sgst = gstResult.sgstAmount;
        igst = gstResult.igstAmount;
    }

    if (totalTaxOnCombined === 0) {
        isIntraState = true;
        cgst = 0;
        sgst = 0;
        igst = 0;
    }

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
        const ROW_LIMIT = 310; // Safer row limit to prevent page overflow and layout splitting

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
                linesRemaining = wrapText(currentCombinedText, 35);
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
                    discountPercent: isCont ? "" : (currentItem.discountPercent || currentItem.discount_percent || 0),
                    totalAmount: isCont ? 0 : parseFloat(currentItem.before_tax || currentItem.beforeTaxAmount || (currentItem.quantity * currentItem.rate - (currentItem.discountAmount || currentItem.discount_amount || 0))),
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
                        discountPercent: isCont ? "" : (currentItem.discountPercent || currentItem.discount_percent || 0),
                        totalAmount: isCont ? 0 : parseFloat(currentItem.before_tax || currentItem.beforeTaxAmount || (currentItem.quantity * currentItem.rate - (currentItem.discountAmount || currentItem.discount_amount || 0))),
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
                    showSupplierInfo: true,
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
                showSupplierInfo: true,
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
                    <span onClick={() => navigate('/seller/purchase/order')} className="cursor-pointer hover:text-black">PURCHASE</span>
                    <span>&gt;</span>
                    <span onClick={() => navigate('/seller/purchase/order')} className="cursor-pointer hover:text-black">{t('modules:purchase_order', 'PURCHASE ORDER')}</span>
                    <span>&gt;</span>
                    <span className="text-[#073318]">PRINT</span>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleDownloadPDF} disabled={isDownloading} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                        {isDownloading ? t('modules:downloading', 'Downloading...') : t('modules:download_pdf', 'Download PDF')}
                    </button>
                    <button onClick={() => window.print()} className="px-6 h-[40px] bg-[#073318] text-white rounded-[10px] font-bold text-[14px] flex items-center justify-center">
                        {t('modules:print_po', 'Print PO')}
                    </button>
                    <button 
                         onClick={() => {
                            const fromPath = location.state?.from || '/seller/purchase/order/add';
                            const target = fromPath.includes('?') ? `${fromPath}&restore=true` : `${fromPath}?restore=true`;
                            navigate(target);
                        }} 
                        className="px-6 h-[40px] border border-gray-300 rounded-[10px] font-bold text-[14px] flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={16} /> Back
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
                                            {t('modules:phone_no', 'Phone No.')}: {sellerInfo?.phone || "+91 2855943035"} &nbsp; {t('modules:email_id', 'Email Id')}: {sellerInfo?.email || "ardhya123@gmail.com"} {sellerInfo?.website && ` &nbsp; ${t('modules:website', 'Website')}: ${sellerInfo.website}`}
                                        </div>
                                        <div className="border-b border-black py-3 text-center font-black text-[15px] uppercase tracking-[3px]">
                                            {t('modules:purchase_order', 'PURCHASE ORDER')}
                                        </div>

                                        <div className="flex border-b border-black text-[12px] font-black uppercase">
                                            <div className="w-[38%] py-3 px-4">{t('modules:gstin', 'GSTIN')} : {sellerInfo?.gstNumber}</div>
                                            <div className="w-[30%] py-3 px-4 text-center">{t('modules:state_code', 'State Code')} : {sellerInfo?.stateInfo}</div>
                                            <div className="flex-1 py-3 px-4 text-right pr-6 whitespace-nowrap">{t('modules:pan_no', 'PAN No')} : {sellerInfo?.panNumber}</div>
                                        </div>
                                    </>
                                )}

                                {page.showSupplierInfo && (
                                    <div className="flex border-b border-black min-h-[160px] page-break-avoid">
                                        <div className="w-1/2 flex flex-col flex-1 border-r border-black">
                                            <div className="border-b border-black flex items-center px-4 h-[44px] gap-4">
                                                <span className="font-black text-[12px] min-w-[30px]">{t('modules:ms', 'M/S.')}</span>
                                                <span className="font-black text-[12px] uppercase">{supplier_name}</span>
                                            </div>
                                            <div className="flex-1 px-4 py-3 text-[11.5px] leading-relaxed font-semibold overflow-hidden">{address}</div>
                                            <div className="border-t border-black flex items-center px-4 h-[44px] gap-4">
                                                <span className="font-black text-[12px] min-w-[70px]">{t('modules:supplier_code', 'Supplier Code')}</span>
                                                <span className="font-black text-[12px]">{poData?.supplierCode || poData?.supplier_code || "SP00001"}</span>
                                            </div>
                                        </div>
                                        <div className="w-1/2 flex flex-col flex-1">
                                            <div className="flex border-b border-black h-[44px] w-full">
                                                <div className="w-[45%] shrink-0 flex items-center px-4 gap-2">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:po_no_colon', 'PO No.')} :</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{po_no}</span>
                                                </div>
                                                <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:po_creation_date', 'PO Creation Date')} :</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(po_creation_date)}</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 border-b border-black flex min-h-[44px] w-full">
                                                <div className="w-[45%] shrink-0 flex items-center px-4 gap-2">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:pay_terms', 'Pay. Terms')} :</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{credit_days} {t('modules:days', 'Days')}</span>
                                                </div>
                                                <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                    <span className="font-black text-[11px] whitespace-nowrap">{t('modules:expiry_date', 'Expiry Date')} :</span>
                                                    <span className="font-semibold text-[11px] whitespace-nowrap">{formatDate(expiry_date)}</span>
                                                </div>
                                            </div>
                                            {isGstApplicable ? (
                                                <div className="flex h-[44px] w-full">
                                                    <div className="w-[45%] shrink-0 flex items-center px-4 gap-2">
                                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:gst_no', 'GST No')} :</span>
                                                        <span className="font-semibold text-[11px] uppercase">{gst_number || "N/A"}</span>
                                                    </div>
                                                    <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:pan_no', 'PAN No')} :</span>
                                                        <span className="font-semibold text-[11px] uppercase">{supplier_pan}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex h-[44px] w-full">
                                                    <div className="w-[45%] shrink-0 flex items-center px-4 gap-2">
                                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:pan_no', 'PAN No')} :</span>
                                                        <span className="font-semibold text-[11px] uppercase">{supplier_pan}</span>
                                                    </div>
                                                    <div className="flex-1 flex items-center px-4 gap-2 border-l border-black">
                                                        <span className="font-black text-[11px] whitespace-nowrap">{t('modules:state_code', 'State Code')} :</span>
                                                        <span className="font-semibold text-[11px] uppercase">{supplier_state_info}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {(page.items.length > 0 || page.showTotals) && (
                                    <table className="w-full border-none m-0">
                                        <thead>
                                            <tr className="text-[9px] font-black h-[32px] uppercase tracking-tight">
                                                <th className="w-[32px] border-b border-r border-black text-center px-0.5">{t('modules:sn', 'SN.')}</th>
                                                <th className="border-b border-r border-black px-3 text-left">{t('modules:description', 'DESCRIPTION')}</th>
                                                <th className="w-[68px] border-b border-r border-black text-center px-0.5">{t('modules:hsn_sac', 'HSN/SAC')}</th>
                                                <th className="w-[46px] border-b border-r border-black text-center px-0.5">{t('modules:tax_percent', 'TAX %')}</th>
                                                <th className="w-[66px] border-b border-r border-black text-center px-0.5">{t('modules:quantity', 'QUANTITY')}</th>
                                                <th className="w-[72px] border-b border-r border-black text-center px-0.5">{t('modules:units', 'UNITS')}</th>
                                                <th className="w-[58px] border-b border-r border-black text-center px-0.5">{t('modules:rate', 'RATE')}</th>
                                                <th className="w-[44px] border-b border-r border-black text-center px-0.5">{t('modules:dis_percent', 'DIS %')}</th>
                                                <th className="w-[78px] border-b border-black text-right px-2">{t('modules:amount', 'AMOUNT')}</th>
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
                                                     <td className="text-center py-[4px] px-0.5 text-[9.5px] whitespace-nowrap">{item.discountPercent !== "" ? item.discountPercent : ""}</td>
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
                                                <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{Number(subTotal || 0).toFixed(2)}</div>
                                            </div>
                                            {isIntraState ? (
                                                <>
                                                    <div className="flex border-b border-black h-[30px]">
                                                        <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">CGST</div>
                                                        <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{Number(cgst || 0).toFixed(2)}</div>
                                                    </div>
                                                    <div className="flex border-b border-black h-[30px]">
                                                        <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">SGST</div>
                                                        <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{Number(sgst || 0).toFixed(2)}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex border-b border-black h-[30px]">
                                                    <div className="flex-1 flex justify-end items-center pr-4 font-black text-[11px]">IGST</div>
                                                    <div className="w-[80px] border-l border-black flex items-center justify-end pr-4 pl-1 font-black text-[11px] whitespace-nowrap">{Number(igst || 0).toFixed(2)}</div>
                                                </div>
                                            )}
                                            <div className="flex h-[45px]">
                                                <div className="flex-1 border-r border-black p-4 py-2 font-black text-[10px] flex items-center">
                                                    <span className="mr-2">{t('modules:amount_in_words', 'Amount In Words')} :</span>
                                                    <span className="uppercase underline leading-none">{numberToWords(totalAmount)}</span>
                                                </div>
                                                <div className="w-[100px] border-r border-black flex items-center justify-center font-black text-[11px] uppercase">{t('modules:grand_total', 'Grand Total')}</div>
                                                <div className="w-[80px] flex items-center justify-end pr-4 pl-1 font-black text-[13px] whitespace-nowrap">₹{Number(totalAmount || 0).toFixed(2)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {page.showSignatory && (
                                        <div className="w-full border-t border-black p-4 py-3 bg-white text-right page-break-avoid block">
                                            <p className="font-black text-[11px]" style={{ marginBottom: '50px' }}>{t('modules:for', 'For')} <span className="uppercase">{sellerInfo?.shopName || "ARDHYA AGRO SERVICE"}</span></p>
                                            <p className="font-black text-[10px] uppercase underline underline-offset-4">{t('modules:authorised_signatory', 'authorised Signatory')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="absolute bottom-[4mm] left-0 right-0 text-center text-[10px] font-semibold text-gray-500">
                            Page {page.pageNumber} of {pages.length}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default POPrintPreview;
