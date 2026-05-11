import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MoreVertical, X, Eye, Users, BookOpen, Download, Search, FileText, FileSpreadsheet, RotateCcw, ChevronLeft, ChevronRight, Plus, Landmark, Trash2, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import CustomSelect from '../../../components/common/CustomSelect';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from "xlsx";
import ScrollableTable from "@/components/common/ScrollableTable";
import toast from 'react-hot-toast';

const Finance = () => {
    const { t } = useTranslation(['modules', 'common']);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [activeMainTab, setActiveMainTab] = useState('Ledger');
    const [activeSubTab, setActiveSubTab] = useState('Sundry Creditors');
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [openActionMenuId, setOpenActionMenuId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeFiscalYear, setActiveFiscalYear] = useState('2024-2025');

    const fiscalYears = ['2024-2025', '2025-2026', '2026-2027'];

    const handleFiscalYearChange = (year) => {
        setActiveFiscalYear(year);
        const [startYear, endYear] = year.split('-');
        setStartDate(`${startYear}-04-01`);
        setEndDate(`${endYear}-03-31`);
    };

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        const subTabParam = searchParams.get('subTab');

        if (tabParam) {
            setActiveMainTab(tabParam);
            if (subTabParam) {
                setActiveSubTab(subTabParam);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        const handleVoucherAdded = (e) => {
            const { type, formData } = e.detail;
            
            // Map type to subTab
            let subTab = '';
            if (type === 'Receipt') subTab = 'Receipts';
            else if (type === 'Payment') subTab = 'Payments';
            else if (type === 'JV') subTab = 'JV';
            else if (type === 'Contra') subTab = 'Contra';

            if (subTab) {
                // Map months for display format
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const [y, m, d] = formData.date.split('-');
                const displayDate = `${d}-${monthNames[parseInt(m)-1]}-${y}`;

                // Prepare new entries (can be multiple rows in voucher)
                const newEntries = formData.entries.map((entry, index) => ({
                    id: `${formData.id}-${index}`,
                    date: displayDate,
                    vchNo: `${type.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                    account: entry.account || 'Unknown Account',
                    bank: formData.bankCash,
                    narration: formData.narration,
                    amount: entry.amount || '0',
                    status: 'Pending'
                }));

                setBankData(prev => ({
                    ...prev,
                    [subTab]: [...newEntries, ...prev[subTab]]
                }));

                toast.success(`${type} Voucher added to ${subTab}`);
                
                // Switch to the relevant tab to show the update
                setActiveMainTab('Bank Reconciliation');
                setActiveSubTab(subTab);
            }
        };

        window.addEventListener('voucherAdded', handleVoucherAdded);
        return () => window.removeEventListener('voucherAdded', handleVoucherAdded);
    }, []);

    const mainTabs = ['Ledger', 'Bank Reconciliation'];
    const getSubTabs = (mainTab) => {
        if (mainTab === 'Bank Reconciliation') return ['Receipts', 'Payments', 'JV', 'Contra'];
        return ['Sundry Creditors', 'Sundry Debtors', 'Bank', 'Cash'];
    };
    const subTabs = getSubTabs(activeMainTab);

    const dummyCreditors = [
        { id: 1, account: "TechCorp Industries", openingBalance: "5000", debit: "2000", credit: "-", closingBalance: "3000" },
        { id: 2, account: "Global Logistics", openingBalance: "1500", debit: "-", credit: "1000", closingBalance: "2500" },
        { id: 3, account: "Prime Suppliers", openingBalance: "10000", debit: "5000", credit: "2000", closingBalance: "7000" },
        { id: 4, account: "Alpha Electronics", openingBalance: "-", debit: "-", credit: "4500", closingBalance: "4500" },
        { id: 5, account: "Nexus Services", openingBalance: "3200", debit: "3200", credit: "-", closingBalance: "-" }
    ];

    const dummyDebtors = [
        { id: 1, account: "Retail Stores Inc", openingBalance: "1200", debit: "800", credit: "-", closingBalance: "2000" },
        { id: 2, account: "Mega Market", openingBalance: "4500", debit: "-", credit: "1500", closingBalance: "3000" },
        { id: 3, account: "City Wholesale", openingBalance: "8000", debit: "2000", credit: "-", closingBalance: "10000" },
        { id: 4, account: "Local Shop", openingBalance: "-", debit: "500", credit: "-", closingBalance: "500" },
        { id: 5, account: "Express Mart", openingBalance: "2500", debit: "-", credit: "2500", closingBalance: "-" }
    ];

    const dummyBankLedger = [
        { id: 1, account: "HDFC Current Account", openingBalance: "150000", debit: "25000", credit: "10000", closingBalance: "165000" },
        { id: 2, account: "SBI Savings Account", openingBalance: "75000", debit: "5000", credit: "20000", closingBalance: "60000" },
    ];

    const dummyCashLedger = [
        { id: 1, account: "Petty Cash", openingBalance: "5000", debit: "1000", credit: "2000", closingBalance: "4000" },
        { id: 2, account: "Main Cash Vault", openingBalance: "50000", debit: "0", credit: "5000", closingBalance: "45000" },
    ];

    const initialBankData = {
        'Receipts': [
            // 2024-2025
            { id: 11, date: "15-May-2024", vchNo: "REC-24-001", account: "Legacy Systems", bank: "SBI Bank", narration: "Service charges Q1", amount: "18000", status: "Reconciled" },
            { id: 12, date: "22-Sep-2024", vchNo: "REC-24-002", account: "Quantum Soft", bank: "HDFC Bank", narration: "Consulting fee Sept", amount: "4500", status: "Pending" },
            { id: 13, date: "10-Jan-2025", vchNo: "REC-24-003", account: "Alpha Tech", bank: "ICICI Bank", narration: "Annual maintenance", amount: "12500", status: "Reconciled" },
            // 2025-2026
            { id: 6, date: "15-May-2025", vchNo: "REC-25-001", account: "Future Tech Ltd", bank: "HDFC Bank", narration: "Project Phase 1", amount: "25000", status: "Reconciled" },
            { id: 7, date: "10-Dec-2025", vchNo: "REC-25-002", account: "New Age Retail", bank: "SBI Bank", narration: "Advance for inventory", amount: "8000", status: "Unreconciled" },
            { id: 8, date: "05-Feb-2026", vchNo: "REC-25-003", account: "Global Trade", bank: "HDFC Bank", narration: "Export settlement", amount: "45000", status: "Reconciled" },
            // 2026-2027
            { id: 21, date: "10-Jul-2026", vchNo: "REC-26-001", account: "Zenith Corp", bank: "ICICI Bank", narration: "Maintenance fee July", amount: "32000", status: "Pending" },
            { id: 22, date: "15-Nov-2026", vchNo: "REC-26-002", account: "Starlight Ind", bank: "SBI Bank", narration: "Material supply", amount: "15600", status: "Pending" },
            { id: 23, date: "20-Mar-2027", vchNo: "REC-26-003", account: "Apex Solutions", bank: "HDFC Bank", narration: "Year end settlement", amount: "22000", status: "Pending" }
        ],
        'Payments': [
            // 2024-2025
            { id: 11, date: "20-Nov-2024", vchNo: "PAY-24-001", account: "Office Supplies", bank: "HDFC Bank", narration: "Stationery and printing", amount: "3500", status: "Reconciled" },
            { id: 12, date: "05-Jan-2025", vchNo: "PAY-24-002", account: "Electricity Bill", bank: "ICICI Bank", narration: "Office utility bill Jan", amount: "1200", status: "Reconciled" },
            { id: 13, date: "15-Feb-2025", vchNo: "PAY-24-003", account: "Broadband Serv", bank: "SBI Bank", narration: "Internet charges", amount: "2500", status: "Reconciled" },
            // 2025-2026
            { id: 6, date: "20-Jun-2025", vchNo: "PAY-25-001", account: "Warehouse Rent", bank: "SBI Bank", narration: "Quarterly rent June", amount: "15000", status: "Reconciled" },
            { id: 7, date: "15-Sep-2025", vchNo: "PAY-25-002", account: "Petty Cash Refill", bank: "Cash", narration: "Cash box replenishment", amount: "2000", status: "Pending" },
            { id: 8, date: "25-Dec-2025", vchNo: "PAY-25-003", account: "Security Agency", bank: "HDFC Bank", narration: "Annual guard services", amount: "12000", status: "Reconciled" },
            // 2026-2027
            { id: 21, date: "05-Aug-2026", vchNo: "PAY-26-001", account: "Fuel Expenses", bank: "SBI Bank", narration: "Vehicle fuel Aug", amount: "1200", status: "Pending" },
            { id: 22, date: "12-Oct-2026", vchNo: "PAY-26-002", account: "Staff Bonus", bank: "HDFC Bank", narration: "Diwali bonus batch 1", amount: "55000", status: "Pending" },
            { id: 23, date: "28-Feb-2027", vchNo: "PAY-26-003", account: "Server Hosting", bank: "Online", narration: "Cloud infrastructure fee", amount: "8900", status: "Pending" }
        ],
        'JV': [
            // 2024-2025
            { id: 11, date: "31-Mar-2025", vchNo: "JV-24-001", account: "Audit Fees", bank: "-", narration: "Annual audit provision", amount: "7500", status: "Reconciled" },
            // 2025-2026
            { id: 6, date: "31-Mar-2026", vchNo: "JV-25-001", account: "Depreciation", bank: "-", narration: "Year end assets dep", amount: "5000", status: "Unreconciled" },
            // 2026-2027
            { id: 21, date: "31-Mar-2027", vchNo: "JV-26-001", account: "Tax Provision", bank: "-", narration: "Income tax adjustment", amount: "12000", status: "Pending" }
        ],
        'Contra': [
            // 2024-2025
            { id: 11, date: "12-Jan-2025", vchNo: "CON-24-001", account: "Vault Transfer", bank: "HDFC Bank", narration: "Cash deposit to bank", amount: "50000", status: "Reconciled" },
            // 2025-2026
            { id: 6, date: "12-Nov-2025", vchNo: "CON-25-001", account: "Bank Transfer", bank: "SBI Bank", narration: "Internal bank move", amount: "20000", status: "Reconciled" },
            // 2026-2027
            { id: 21, date: "15-Oct-2026", vchNo: "CON-26-001", account: "Atm Withdrawal", bank: "ICICI Bank", narration: "Cash for petty expenses", amount: "5000", status: "Pending" }
        ]
    };

    const [bankData, setBankData] = useState(() => {
        const savedData = localStorage.getItem('bankData');
        return savedData ? JSON.parse(savedData) : initialBankData;
    });

    useEffect(() => {
        localStorage.setItem('bankData', JSON.stringify(bankData));
    }, [bankData]);

    const dummyTransactions = [
        { id: 1, date: "01-Oct-2023", particulars: "Opening Balance", type: "-", voucherNo: "-", debit: "0", credit: "5000", balance: "5000 Cr", narration: "Opening balance" },
        { id: 5, date: "20-Oct-2023", particulars: "Bank Payment", type: "BP", voucherNo: "BP-002", debit: "500", credit: "0", balance: "3000 Cr", narration: "Quarterly maintenance charges" },
        
        // 2024-2025 Data
        { id: 11, date: "10-Apr-2024", particulars: "Opening Balance", type: "-", voucherNo: "-", debit: "0", credit: "8000", balance: "8000 Cr", narration: "Opening balance 2024" },
        { id: 12, date: "25-Jul-2024", particulars: "Software License", type: "BP", voucherNo: "BP-505", debit: "2500", credit: "0", balance: "5500 Cr", narration: "Annual ERP subscription" },
        { id: 13, date: "12-Dec-2024", particulars: "Sales Receipt", type: "RV", voucherNo: "RV-606", debit: "0", credit: "15000", balance: "20500 Cr", narration: "Bulk order payment" },
        
        // 2025-2026 Data
        { id: 6, date: "15-Apr-2025", particulars: "Opening Balance", type: "-", voucherNo: "-", debit: "0", credit: "3000", balance: "3000 Cr", narration: "Brought forward from previous year" },
        { id: 10, date: "28-Mar-2026", particulars: "Tax Payment", type: "JV", voucherNo: "JV-404", debit: "1500", credit: "0", balance: "4800 Cr", narration: "TDS adjustment for Q4" },

        // 2026-2027 Data
        { id: 21, date: "05-May-2026", particulars: "Opening Balance", type: "-", voucherNo: "-", debit: "0", credit: "12000", balance: "12000 Cr", narration: "Opening balance 2026" },
        { id: 22, date: "18-Sep-2026", particulars: "Machine Repair", type: "CP", voucherNo: "CP-707", debit: "1800", credit: "0", balance: "10200 Cr", narration: "Hydraulic pump servicing" },
        { id: 23, date: "15-Feb-2027", particulars: "Bonus Payout", type: "BP", voucherNo: "BP-808", debit: "5000", credit: "0", balance: "5200 Cr", narration: "Performance bonus batch #1" }
    ];

    // Helper to normalize dates for comparison (DD-MMM-YYYY to YYYY-MM-DD)
    const normalizeDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return null;
        if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) return dateStr;
        
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts;
        const months = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
        };
        return `${year}-${months[month]}-${day.padStart(2, '0')}`;
    };

    const currentData = activeMainTab === 'Ledger'
        ? (activeSubTab === 'Sundry Creditors' ? dummyCreditors 
           : activeSubTab === 'Sundry Debtors' ? dummyDebtors 
           : activeSubTab === 'Bank' ? dummyBankLedger
           : activeSubTab === 'Cash' ? dummyCashLedger : [])
        : bankData[activeSubTab] || [];

    const filteredMainData = useMemo(() => {
        if (!currentData) return [];
        
        const filtered = currentData.filter(item => {
            // Search match
            const searchStr = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || (
                (item.account && item.account.toLowerCase().includes(searchStr)) ||
                (item.vchNo && item.vchNo.toLowerCase().includes(searchStr)) ||
                (item.bank && item.bank.toLowerCase().includes(searchStr)) ||
                (item.amount && item.amount.toLowerCase().includes(searchStr)) ||
                (item.status && item.status.toLowerCase().includes(searchStr))
            );

            // Date match
            let matchesDate = true;
            if ((startDate || endDate) && item.date) {
                const itemDateStr = normalizeDate(item.date);
                if (startDate && itemDateStr < startDate) matchesDate = false;
                if (endDate && itemDateStr > endDate) matchesDate = false;
            }
            
            return matchesSearch && matchesDate;
        });

        // If it's the Ledger tab and a date filter is applied, simulate balance changes
        if (activeMainTab === 'Ledger' && (startDate || endDate)) {
            return filtered.map(item => {
                const dateHash = (startDate || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0) + 
                                (endDate || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                
                const factor = (dateHash % 50) / 100 + 0.5; // 0.5 to 1.0 factor
                const simulatedDebit = item.debit === '-' ? '-' : (parseFloat(item.debit) * factor).toFixed(0);
                const simulatedCredit = item.credit === '-' ? '-' : (parseFloat(item.credit) * (1.5 - factor)).toFixed(0);
                
                const op = parseFloat(item.openingBalance || 0);
                const dr = parseFloat(simulatedDebit === '-' ? 0 : simulatedDebit);
                const cr = parseFloat(simulatedCredit === '-' ? 0 : simulatedCredit);
                const closing = op + cr - dr;

                return {
                    ...item,
                    debit: simulatedDebit,
                    credit: simulatedCredit,
                    closingBalance: closing.toFixed(0)
                };
            });
        }

        return filtered;
    }, [currentData, searchQuery, startDate, endDate, activeMainTab]);

    // Pagination Logic
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredMainData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredMainData.length / rowsPerPage);

    const filteredTransactions = dummyTransactions.filter(tx => {
        let textMatch = true;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            textMatch = (
                tx.date.toLowerCase().includes(query) ||
                tx.particulars.toLowerCase().includes(query) ||
                tx.type.toLowerCase().includes(query) ||
                tx.voucherNo.toLowerCase().includes(query) ||
                tx.debit.toLowerCase().includes(query) ||
                tx.credit.toLowerCase().includes(query) ||
                tx.balance.toLowerCase().includes(query)
            );
        }

        let dateMatch = true;
        if (startDate || endDate) {
            const txDateStr = normalizeDate(tx.date);
            if (startDate && txDateStr < startDate) dateMatch = false;
            if (endDate && txDateStr > endDate) dateMatch = false;
        }

        return textMatch && dateMatch;
    });

    const totalDR = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0);
    const totalCR = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0);
    const finalBalance = filteredTransactions.length > 0 ? filteredTransactions[filteredTransactions.length - 1].balance : '0';

    const handleSearch = () => {
        if (!searchQuery) {
            toast.error("Please enter an account name to search");
            return;
        }

        // Try to find an exact match first
        const exactMatch = filteredMainData.find(item => 
            item.account.toLowerCase() === searchQuery.toLowerCase()
        );

        // If no exact match, but only one result, use that
        const match = exactMatch || (filteredMainData.length === 1 ? filteredMainData[0] : null);

        if (match) {
            if (startDate && endDate) {
                // Navigate to full ledger view with dates
                navigate(`/seller/finance/ledger/${match.id}?startDate=${startDate}&endDate=${endDate}&name=${match.account}`);
            } else {
                // Just open the modal if no dates set
                setSelectedAccount(match);
            }
        } else {
            if (filteredMainData.length === 0) {
                toast.error("No account found matching your search");
            } else {
                toast.error("Multiple matches found. Please select an account from the table.");
            }
        }
    };

    React.useEffect(() => {
        if (activeMainTab === 'Ledger' && searchQuery && startDate && endDate) {
            const exactMatch = filteredMainData.find(item => 
                item.account.toLowerCase() === searchQuery.toLowerCase()
            );
            const match = exactMatch || (filteredMainData.length === 1 ? filteredMainData[0] : null);

            if (match) {
                navigate(`/seller/finance/ledger/${match.id}?startDate=${startDate}&endDate=${endDate}&name=${match.account}`);
            }
        }
    }, [activeMainTab, searchQuery, startDate, endDate, filteredMainData, navigate]);



    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Ledger Account: ${selectedAccount?.account || 'Account'}`, 14, 20);
        
        const tableColumn = ["Sr.No", "Date", "Particular", "Narration", "DR", "CR", "Cum Balance"];
        const tableRows = filteredTransactions.map((tx, index) => [
            index + 1,
            tx.date,
            tx.particulars,
            (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
            tx.debit !== '0' ? tx.debit : '-',
            tx.credit !== '0' ? tx.credit : '-',
            tx.balance
        ]);

        const footerRows = [
            ['', '', '', 'Page Total', totalDR.toLocaleString('en-IN', { minimumFractionDigits: 2 }), totalCR.toLocaleString('en-IN', { minimumFractionDigits: 2 }), finalBalance],
            ['', '', '', 'Transactions (Ledger)', totalDR.toLocaleString('en-IN', { minimumFractionDigits: 2 }), totalCR.toLocaleString('en-IN', { minimumFractionDigits: 2 }), finalBalance],
            ['', '', '', 'Balance (Ledger)', '--', '--', finalBalance]
        ];

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            foot: footerRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255] },
            footStyles: { fillColor: [249, 250, 251], textColor: [17, 24, 39], fontStyle: 'bold' },
            styles: { fontSize: 8, font: 'helvetica' }
        });

        doc.save(`${selectedAccount?.account || 'Account'}_ledger.pdf`);
        setShowExportMenu(false);
    };

    const handleExportExcel = () => {
        const exportData = filteredTransactions.map((tx, index) => ({
            "Sr.No": index + 1,
            "Date": tx.date,
            "Particular": tx.particulars,
            "Narration": (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
            "DR": tx.debit,
            "CR": tx.credit,
            "Cum Balance": tx.balance
        }));

        // Add summary rows to Excel
        exportData.push({}); // Empty row for spacing
        exportData.push({ "Narration": "Page Total", "DR": totalDR, "CR": totalCR, "Cum Balance": finalBalance });
        exportData.push({ "Narration": "Transactions (Ledger)", "DR": totalDR, "CR": totalCR, "Cum Balance": finalBalance });
        exportData.push({ "Narration": "Balance (Ledger)", "DR": "--", "CR": "--", "Cum Balance": finalBalance });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");
        XLSX.writeFile(workbook, `${selectedAccount?.account || 'Account'}_ledger.xlsx`);
        setShowExportMenu(false);
    };

    return (
        <div className="flex flex-col w-full max-w-[1400px] mx-auto px-2 sm:px-4 md:px-8 py-6 pb-10 font-['Plus_Jakarta_Sans'] transition-all duration-300 relative h-full">
            {/* Title & Subtitle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 font-outfit">
                <div>
                    <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">{t('finance', 'Finance')}</h1>
                    <p className="text-[14px] md:text-[16px] text-[#6B7280] font-medium">Manage your financial operations and reporting</p>
                </div>
                <div className="flex items-center gap-3">
                </div>
            </div>

            {/* Main Tabs */}
            <div className="border-b border-[#E5E7EB] mb-6 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="flex items-center justify-center gap-2 md:gap-4 pb-2">
                    {mainTabs.map((tab) => {
                        const isActive = activeMainTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveMainTab(tab);
                                    setActiveSubTab(getSubTabs(tab)[0]);
                                }}
                                className={`relative text-[14px] md:text-[15px] font-bold transition-colors duration-300 ease-in-out whitespace-nowrap px-6 py-2.5 rounded-[12px]
                                    ${isActive
                                        ? 'text-[#111827]'
                                        : 'text-[#6B7280] hover:text-[#111827] hover:bg-gray-50'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabFinance"
                                        className="absolute inset-0 bg-[#073318]/5 border-2 border-[#073318]/20 rounded-[12px] shadow-[0_2px_10px_rgba(7,51,24,0.05)]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10">{tab}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex overflow-x-auto whitespace-nowrap gap-6 md:gap-16 border-b border-[#E5E7EB] w-full mb-8 font-outfit px-1 sm:justify-center scrollbar-hide scroll-smooth">
                {subTabs.map((tab) => {
                    const isActive = activeSubTab === tab;
                    return (
                        <button
                            key={tab}
                            onClick={(e) => {
                                setActiveSubTab(tab);
                                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                            }}
                            className={`relative pb-4 text-[16px] md:text-[18px] font-bold transition-colors whitespace-nowrap shrink-0 ${isActive ? 'text-[#111827]' : 'text-[#6B7280]'}`}
                        >
                            {tab}
                            {isActive && <motion.div layoutId="underlineSubTabFinance" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#073318]" />}
                        </button>
                    );
                })}
            </div>

            {/* Fiscal Year Switcher */}
            <div className="flex justify-start mb-8">
                <div className="inline-flex bg-white p-1 rounded-[16px] border border-[#E5E7EB] shadow-sm">
                    {fiscalYears.map((year) => {
                        const isActive = activeFiscalYear === year;
                        return (
                            <button
                                key={year}
                                onClick={() => handleFiscalYearChange(year)}
                                className={`px-6 py-2 rounded-[12px] text-[14px] font-bold transition-all duration-300 whitespace-nowrap
                                    ${isActive 
                                        ? 'bg-[#073318] text-white shadow-lg' 
                                        : 'text-[#6B7280] hover:text-[#111827]'
                                    }`}
                            >
                                {year}
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* Filter Bar */}
            <div className="bg-white p-6 rounded-[24px] border border-[#E5E7EB] shadow-sm mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left Side: Search */}
                    <div className="relative w-full lg:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder={activeMainTab === 'Ledger' ? "Search Account..." : "Search transactions..."}
                            className="h-[46px] pl-10 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all w-full sm:w-[320px] font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>

                    {/* Right Side: Custom Date Range */}
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">From</span>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-[44px] px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] outline-none text-[14px] font-bold text-[#111827] focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">To</span>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-[44px] px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] outline-none text-[14px] font-bold text-[#111827] focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all cursor-pointer"
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button 
                                    onClick={() => { setStartDate(''); setEndDate(''); setActiveFiscalYear(null); }}
                                    className="p-2.5 text-[#9CA3AF] hover:bg-gray-100 rounded-lg transition-all"
                                    title="Reset Dates"
                                >
                                    <RotateCcw size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {currentData ? (
                <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden mb-8 w-full">
                    <ScrollableTable>
                        <table className="w-full min-w-[800px] border-collapse text-left font-outfit">
                            <thead>
                                <tr className="bg-[#E5E7EB] text-[#4B5563] font-bold text-[14px]">
                                    {activeMainTab === 'Ledger' ? (
                                        <>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Account</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Opening Balance</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Debit</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Credit</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Closing Balance</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Date</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Vch No.</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Account</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Bank/Cash</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Narration</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Amount</th>
                                        </>
                                    )}
                                    <th className="px-6 py-4 whitespace-nowrap text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-[14px] text-[#111827]">
                                {currentRows.map((item, index) => (
                                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                        {activeMainTab === 'Ledger' ? (
                                            <>
                                                <td 
                                                    className="px-6 py-4 text-center font-bold text-[#111827] hover:underline cursor-pointer"
                                                    onClick={() => setSelectedAccount(item)}
                                                >
                                                    {item.account}
                                                </td>
                                                <td className="px-6 py-4 text-center">{item.openingBalance}</td>
                                                <td className="px-6 py-4 text-center">{item.debit}</td>
                                                <td className="px-6 py-4 text-center">{item.credit}</td>
                                                <td className="px-6 py-4 text-center text-[#111827] font-bold">{item.closingBalance}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 text-center">{item.date}</td>
                                                <td className="px-6 py-4 text-center font-bold">{item.vchNo}</td>
                                                <td className="px-6 py-4 text-center">{item.account}</td>
                                                <td className="px-6 py-4 text-center">{item.bank}</td>
                                                <td className="px-6 py-4 text-center max-w-[150px] truncate" title={item.narration}>{item.narration || '-'}</td>
                                                <td className="px-6 py-4 text-center font-bold text-[#111827]">₹ {item.amount}</td>
                                            </>
                                        )}
                                        <td className="px-6 py-4 text-center relative">
                                            <button 
                                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors inline-flex"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenActionMenuId(openActionMenuId === item.id ? null : item.id);
                                                }}
                                            >
                                                <MoreVertical size={20} />
                                            </button>

                                            {/* Dropdown Menu */}
                                            {openActionMenuId === item.id && (
                                                <>
                                                    <div className="fixed inset-0 z-[100]" onClick={() => setOpenActionMenuId(null)} />
                                                    <div className={`absolute right-0 ${index >= currentRows.length - 2 && currentRows.length > 2 ? 'bottom-full mb-2' : 'top-12'} w-48 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.15)] z-[101] flex flex-col py-2 font-outfit animate-in fade-in zoom-in-95 duration-200`}>
                                                        <button 
                                                            className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                            onClick={() => {
                                                                if (activeMainTab === 'Ledger') {
                                                                    const qs = `?name=${encodeURIComponent(item.account)}${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`;
                                                                    navigate(`/seller/finance/ledger/${item.id}${qs}`);
                                                                } else {
                                                                    setSelectedAccount(item);
                                                                }
                                                                setOpenActionMenuId(null);
                                                            }}
                                                        >
                                                            <Eye size={18} className="text-[#9CA3AF]" />
                                                            View & Edit
                                                        </button>
                                                        {activeSubTab !== 'Sundry Creditors' && activeSubTab !== 'Sundry Debtors' && activeSubTab !== 'Bank' && activeSubTab !== 'Cash' && (
                                                            <button 
                                                                className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                                                                onClick={() => setOpenActionMenuId(null)}
                                                            >
                                                                <Trash2 size={18} className="text-red-400" />
                                                                Delete
                                                            </button>
                                                        )}

                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </ScrollableTable>
                    {/* Pagination Footer */}
                    <div className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-t border-[#E5E7EB] bg-white rounded-b-[16px] font-outfit gap-2">
                        <div className="flex items-center gap-3">
                            <span className="text-[13px] text-[#6B7280] font-bold tracking-wider">SHOW</span>
                            <CustomSelect 
                                value={rowsPerPage} 
                                onChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }} 
                                menuPlacement="top"
                            />
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="text-[14px] text-[#6B7280] font-medium">
                                {filteredMainData && filteredMainData.length > 0 ? `${indexOfFirstRow + 1}-${Math.min(indexOfLastRow, filteredMainData.length)} of ${filteredMainData.length}` : '0-0 of 0'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    className="p-2 rounded-[10px] bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#4B5563] hover:bg-[#F9FAFB] hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E7EB]"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1 || !filteredMainData || filteredMainData.length === 0}
                                >
                                    <ChevronLeft size={18} strokeWidth={2.5} />
                                </button>
                                <button 
                                    className="p-2 rounded-[10px] bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#4B5563] hover:bg-[#F9FAFB] hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E7EB]"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || !filteredMainData || filteredMainData.length === 0}
                                >
                                    <ChevronRight size={18} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center flex-1 min-h-[30vh]">
                    <div className="text-center font-outfit">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">{activeSubTab}</h2>
                        <p className="text-gray-500">This module is under development.</p>
                    </div>
                </div>
            )}

            {/* Account Details Modal */}
            {selectedAccount && createPortal(
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-2 sm:p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={() => { setSelectedAccount(null); setSearchQuery(''); setStartDate(''); setEndDate(''); setShowExportMenu(false); }} />
                    <div className="relative bg-white rounded-[16px] sm:rounded-[24px] shadow-2xl w-full sm:w-[95vw] lg:w-[90vw] max-w-none overflow-hidden animate-in zoom-in-95 duration-200 font-outfit flex flex-col h-[95vh] sm:h-auto sm:max-h-[85vh]">
                        <div className="flex items-start sm:items-center justify-between px-5 sm:px-8 py-5 sm:py-6 border-b border-[#F3F4F6] bg-white">
                            <div>
                                <h3 className="text-[20px] font-bold text-[#111827] tracking-tight">
                                    {activeMainTab === 'Ledger' ? `Ledger Account: ${selectedAccount.account}` : `${activeSubTab} Details: ${selectedAccount.vchNo}`}
                                </h3>
                                <p className="text-[14px] text-[#6B7280] font-medium mt-1">
                                    {activeMainTab === 'Ledger' ? 'Transaction history and details' : 'Complete transaction summary and status'}
                                </p>
                            </div>
                            <button onClick={() => { setSelectedAccount(null); setSearchQuery(''); setStartDate(''); setEndDate(''); setShowExportMenu(false); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 sm:p-8 overflow-y-auto bg-[#F9FAFB] flex-1">
                            {activeMainTab === 'Bank Reconciliation' ? (
                                <div className="max-w-4xl mx-auto">
                                    <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-sm overflow-hidden mb-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E5E7EB]">
                                            {[
                                                { label: 'Date', value: selectedAccount.date },
                                                { label: 'Voucher Number', value: selectedAccount.vchNo },
                                                { label: 'Account Name', value: selectedAccount.account },
                                                { label: 'Bank / Cash', value: selectedAccount.bank },
                                                { label: 'Amount', value: `₹ ${selectedAccount.amount}`, isBold: true, isFullWidth: true },
                                            ].map((detail, idx) => (
                                                <div key={idx} className={`bg-white p-6 flex flex-col gap-2 ${detail.isFullWidth ? 'md:col-span-2' : ''}`}>
                                                    <span className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wider">{detail.label}</span>
                                                    <span className={`text-[18px] text-[#111827] ${detail.isBold ? 'font-extrabold' : 'font-semibold'}`}>{detail.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-[#F8FAFC] p-6 rounded-[20px] border border-[#E2E8F0]">
                                        <p className="text-[14px] font-medium text-[#64748B] italic">Note: These details are for internal reconciliation purposes. To view the full ledger for this account, please use the Ledger tab.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
                                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4 sm:gap-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 w-full sm:w-auto">
                                                <span className="text-[14px] font-bold text-[#4B5563]">Name:</span>
                                                <input 
                                                    type="text" 
                                                    disabled 
                                                    value={selectedAccount.account} 
                                                    className="h-[42px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-[#6B7280] w-full sm:w-[240px] outline-none cursor-not-allowed" 
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 w-full sm:w-auto">
                                                <span className="text-[14px] font-bold text-[#4B5563]">Start Date:</span>
                                                <input 
                                                    type="date" 
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-[#4B5563] w-full sm:w-[180px] outline-none focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20 transition-all" 
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 w-full sm:w-auto">
                                                <span className="text-[14px] font-bold text-[#4B5563]">End Date:</span>
                                                <input 
                                                    type="date" 
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-[#4B5563] w-full sm:w-[180px] outline-none focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20 transition-all" 
                                                />
                                            </div>
                                            {(startDate || endDate) && (
                                                <div className="w-full sm:w-auto flex justify-end sm:block">
                                                    <button 
                                                        onClick={() => { setStartDate(''); setEndDate(''); }}
                                                        className="h-[42px] px-4 text-[13px] font-bold text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-[10px] transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                                                        title="Reset Dates"
                                                    >
                                                        <RotateCcw size={16} />
                                                        Reset
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                                            <div className="relative w-full sm:w-auto">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Search size={18} className="text-[#9CA3AF]" />
                                                </div>
                                                <input 
                                                    type="text" 
                                                    placeholder="Search By Anything..." 
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-4 text-[14px] text-[#4B5563] w-full sm:w-[300px] outline-none focus:border-[#9CA3AF] focus:ring-2 focus:ring-[#9CA3AF]/20 transition-all placeholder:text-[#9CA3AF] placeholder:font-normal" 
                                                />
                                            </div>
                                            <div className="relative w-full sm:w-auto">
                                                <button 
                                                    className="h-[42px] px-5 w-full sm:w-auto justify-center bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#4B5563] rounded-[10px] font-medium text-[15px] transition-colors flex items-center gap-2 shadow-sm"
                                                    onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                                                >
                                                    <Download size={18} className="text-[#6B7280]" />
                                                    Export
                                                </button>
                                                
                                                {/* Export Dropdown */}
                                                {showExportMenu && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowExportMenu(false); }} />
                                                        <div className="absolute right-0 top-12 w-48 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 flex flex-col py-2 font-outfit"
                                                            onClick={(e) => e.stopPropagation()}>
                                                            <button 
                                                                className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                                onClick={handleExportPDF}
                                                            >
                                                                <FileText size={18} className="text-red-500" />
                                                                Export as PDF
                                                            </button>
                                                            <button 
                                                                className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                                onClick={handleExportExcel}
                                                            >
                                                                <FileSpreadsheet size={18} className="text-emerald-500" />
                                                                Export as Excel
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-sm overflow-hidden w-full">
                                        <table className="w-full min-w-[800px] border-collapse text-left">
                                            <thead>
                                                <tr className="bg-[#E5E7EB] text-[#4B5563] font-bold text-[14px]">
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Sr.No</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap">Date</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap">Particular</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap">Narration</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-right">DR</th>
                                                    <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-right">CR</th>
                                                    <th className="px-6 py-4 whitespace-nowrap text-right">Cum Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[14px] text-[#111827]">
                                                {filteredTransactions.length > 0 ? (
                                                    filteredTransactions.map((tx, index) => (
                                                        <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                                            <td className="px-6 py-4 text-center">{index + 1}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap">{tx.date}</td>
                                                            <td className="px-6 py-4 font-bold">{tx.particulars}</td>
                                                            <td className="px-6 py-4 text-[#6B7280]">
                                                                {(tx.voucherNo && tx.voucherNo !== '-') ? (
                                                                    <span className="font-bold text-[#111827]">Inv.No-{tx.voucherNo.split('-')[1] || tx.voucherNo} - </span>
                                                                ) : null}
                                                                {tx.narration}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">{tx.debit}</td>
                                                            <td className="px-6 py-4 text-right">{tx.credit}</td>
                                                            <td className="px-6 py-4 text-right font-bold text-[#111827]">{tx.balance}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="7" className="px-6 py-8 text-center text-[#6B7280]">
                                                            No transactions found matching "{searchQuery}"
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-[#F8FAFC] text-[13px] font-bold text-[#334155] border-t-2 border-[#CBD5E1]">
                                                {/* Page Total Row */}
                                                <tr className="border-b border-[#E2E8F0]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right bg-[#F1F5F9]/50">Page Total</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#111827]">₹ {totalDR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#111827]">₹ {totalCR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {finalBalance}</td>
                                                </tr>

                                                {/* Transactions (Ledger) Row */}
                                                <tr className="border-b border-[#E2E8F0]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right bg-[#F1F5F9]/50">Transactions (Ledger)</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {totalDR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {totalCR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {finalBalance}</td>
                                                </tr>
                                                {/* Balance (Ledger) Row */}
                                                <tr className="bg-[#F1F5F9]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right font-extrabold text-[#0F172A]">Balance (Ledger)</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#94A3B8]">--</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#94A3B8]">--</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] font-extrabold text-[#111827]">₹ {finalBalance}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Finance;
