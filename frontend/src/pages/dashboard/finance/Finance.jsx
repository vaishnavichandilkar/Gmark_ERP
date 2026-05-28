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

import ledgerService from '../../../services/ledgerService';
import voucherService from '../../../services/voucherService';
import PaymentModal from '../../../components/common/PaymentModal';

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
    
    // Edit Voucher States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editVoucherData, setEditVoucherData] = useState(null);
    const [editVoucherType, setEditVoucherType] = useState('Receipt');
    const getCurrentFiscalYear = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed
        if (month < 3) { // Before April
            return `${year - 1}-${year}`;
        }
        return `${year}-${year + 1}`;
    };

    const [activeFiscalYear, setActiveFiscalYear] = useState(getCurrentFiscalYear());

    // Effect to initialize dates when component mounts or fiscal year changes
    useEffect(() => {
        if (activeFiscalYear) {
            const [startYear, endYear] = activeFiscalYear.split('-');
            setStartDate(`${startYear}-04-01`);
            setEndDate(`${endYear}-03-31`);
        }
    }, [activeFiscalYear]);
    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fiscalYears = ['2025-2026', '2026-2027'];

    const handleFiscalYearChange = (year) => {
        setActiveFiscalYear(year);
        const [startYear, endYear] = year.split('-');
        setStartDate(`${startYear}-04-01`);
        setEndDate(`${endYear}-03-31`);
    };

    useEffect(() => {
        const fetchSummary = async () => {
            if (activeMainTab !== 'Ledger') return;
            setLoading(true);
            try {
                let response;
                const params = { search: searchQuery, startDate, endDate };
                
                if (activeSubTab === 'Sundry Creditors') {
                    response = await ledgerService.getCreditors(params);
                } else if (activeSubTab === 'Sundry Debtors') {
                    response = await ledgerService.getDebtors(params);
                } else {
                    // Bank or Cash
                    const group = activeSubTab === 'Bank' ? 'BANK' : 'CASH';
                    response = await ledgerService.getBankCash({ ...params, group });
                }
                
                setSummaryData(response.data || []);
            } catch (error) {
                console.error('Error fetching ledger summary:', error);
                toast.error('Failed to load ledger data');
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, [activeMainTab, activeSubTab, searchQuery, startDate, endDate]);

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
            // Trigger refresh by updating state or just relying on the useEffect dependencies
            setLoading(true);
            setTimeout(() => {
                const subTabParam = searchParams.get('subTab');
                setActiveSubTab(subTabParam || activeSubTab);
                // The useEffect will trigger because activeSubTab or loading state changed
                setLoading(false);
            }, 100);
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


    const [bankData, setBankData] = useState([]);

    const fetchVouchers = async () => {
        if (activeMainTab !== 'Bank Reconciliation') return;
        setLoading(true);
        try {
            let response;
            if (activeSubTab === 'Receipts') {
                response = await voucherService.getReceiptVouchers();
            } else if (activeSubTab === 'Payments') {
                response = await voucherService.getPaymentVouchers();
            } else {
                setBankData([]);
                return;
            }
            
            // Map backend data to table format
            const mappedData = response.map(v => ({
                id: v.id,
                date: new Date(v.voucherDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
                vchNo: v.voucherNumber,
                account: v.items?.map(i => i.account?.accountName).join(', ') || 'Unknown',
                bank: v.bankCashLedger?.accountName || '-',
                narration: v.narration,
                amount: v.totalAmount,
                status: 'Pending',
                originalVoucher: v
            }));
            
            setBankData(mappedData);
        } catch (error) {
            console.error('Error fetching vouchers:', error);
            toast.error('Failed to load vouchers');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVoucher = async (item) => {
        if (!window.confirm(`Are you sure you want to delete voucher ${item.vchNo}?`)) {
            return;
        }

        try {
            if (activeSubTab === 'Receipts') {
                await voucherService.deleteReceiptVoucher(item.id);
            } else if (activeSubTab === 'Payments') {
                await voucherService.deletePaymentVoucher(item.id);
            }
            toast.success('Voucher deleted successfully');
            fetchVouchers();
        } catch (error) {
            console.error('Error deleting voucher:', error);
            const msg = error.response?.data?.message;
            toast.error(Array.isArray(msg) ? msg[0] : (msg || 'Failed to delete voucher'));
        }
    };

    useEffect(() => {
        fetchVouchers();
    }, [activeMainTab, activeSubTab, searchQuery, startDate, endDate]);

    const [detailedLedger, setDetailedLedger] = useState(null);
    const [detailedLoading, setDetailedLoading] = useState(false);
    const [detailedCurrentPage, setDetailedCurrentPage] = useState(1);
    const [detailedTotalPages, setDetailedTotalPages] = useState(1);
    const [detailedTotalTotal, setDetailedTotalTotal] = useState(0);

    useEffect(() => {
        const fetchDetailed = async () => {
            if (!selectedAccount || activeMainTab !== 'Ledger') return;
            setDetailedLoading(true);
            try {
                const params = { 
                    startDate, 
                    endDate, 
                    type: activeMainTab === 'Ledger' ? activeSubTab : undefined,
                    page: detailedCurrentPage,
                    limit: 14
                };
                const response = await ledgerService.getDetailedLedger(selectedAccount.id, params);
                setDetailedLedger(response.data);
                setDetailedTotalPages(response.data.totalPages || 1);
                setDetailedTotalTotal(response.data.total || 0);
            } catch (error) {
                console.error('Error fetching detailed ledger:', error);
                toast.error('Failed to load detailed ledger');
            } finally {
                setDetailedLoading(false);
            }
        };

        fetchDetailed();
    }, [selectedAccount, startDate, endDate, activeMainTab, detailedCurrentPage]);

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
        ? summaryData
        : bankData;

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
            
            // Filter empty bank/cash accounts
            if (activeMainTab === 'Ledger' && (activeSubTab === 'Bank' || activeSubTab === 'Cash')) {
                const debit = Number(item.debit) || 0;
                const credit = Number(item.credit) || 0;
                const opening = Number(item.openingBalance) || 0;
                if (debit === 0 && credit === 0 && opening === 0) {
                    return false;
                }
            }

            return matchesSearch && matchesDate;
        });

        return filtered;
    }, [currentData, searchQuery, startDate, endDate, activeMainTab]);

    // Pagination Logic
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredMainData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredMainData.length / rowsPerPage);

    const filteredTransactions = useMemo(() => {
        if (!detailedLedger || !detailedLedger.items) return [];
        
        return detailedLedger.items.filter(tx => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return (
                new Date(tx.date).toLocaleDateString().toLowerCase().includes(query) ||
                tx.particulars.toLowerCase().includes(query) ||
                (tx.narration || '').toLowerCase().includes(query) ||
                tx.debit.toString().includes(query) ||
                tx.credit.toString().includes(query) ||
                tx.balance.toString().includes(query)
            );
        });
    }, [detailedLedger, searchQuery]);

    const pageTotalDR = useMemo(() => 
        filteredTransactions
            .filter(tx => !tx.particulars.toLowerCase().includes('previous'))
            .reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0), 
        [filteredTransactions]
    );

    const pageTotalCR = useMemo(() => 
        filteredTransactions
            .filter(tx => !tx.particulars.toLowerCase().includes('previous'))
            .reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0), 
        [filteredTransactions]
    );

    const runningTotalDR = useMemo(() => 
        filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0), 
        [filteredTransactions]
    );

    const runningTotalCR = useMemo(() => 
        filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0), 
        [filteredTransactions]
    );

    const currentClosingBalance = useMemo(() => {
        if (filteredTransactions.length === 0) return 0;
        return filteredTransactions[filteredTransactions.length - 1].balance;
    }, [filteredTransactions]);

    
    const overallTotalDR = detailedLedger?.periodDebit || 0;
    const overallTotalCR = detailedLedger?.periodCredit || 0;
    const initialOpeningBalance = detailedLedger?.openingBalance || 0;

    // Cumulative totals including initial opening balance
    const cumTotalDR = useMemo(() => {
        if (activeSubTab === 'Sundry Creditors') {
            return initialOpeningBalance < 0 ? Math.abs(initialOpeningBalance) + overallTotalDR : overallTotalDR;
        }
        return initialOpeningBalance > 0 ? initialOpeningBalance + overallTotalDR : overallTotalDR;
    }, [initialOpeningBalance, overallTotalDR, activeSubTab]);

    const cumTotalCR = useMemo(() => {
        if (activeSubTab === 'Sundry Creditors') {
            return initialOpeningBalance > 0 ? initialOpeningBalance + overallTotalCR : overallTotalCR;
        }
        return initialOpeningBalance < 0 ? Math.abs(initialOpeningBalance) + overallTotalCR : overallTotalCR;
    }, [initialOpeningBalance, overallTotalCR, activeSubTab]);
    
    // Final closing balance for the ledger
    const finalLedgerBalance = useMemo(() => {
        if (activeSubTab === 'Sundry Creditors') {
            return initialOpeningBalance + overallTotalCR - overallTotalDR;
        }
        return initialOpeningBalance + overallTotalDR - overallTotalCR;
    }, [initialOpeningBalance, overallTotalDR, overallTotalCR, activeSubTab]);

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
        doc.text(`Ledger Account: ${selectedAccount?.accountName || 'Account'}`, 14, 20);
        
        const tableColumn = ["Sr.No", "Date", "Particular", "Narration", "DR", "CR", "Cum Balance"];
        const tableRows = filteredTransactions.map((tx, index) => [
            index + 1,
            new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
            tx.particulars,
            tx.narration || '-',
            tx.debit > 0 ? tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
            tx.credit > 0 ? tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
            `${Math.abs(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}`
        ]);

        const footerRows = [
            ['', '', '', 'Page Total', pageTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), `${Math.abs(currentClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (currentClosingBalance >= 0 ? 'Cr' : 'Dr') : (currentClosingBalance >= 0 ? 'Dr' : 'Cr')}`],
            ['', '', '', 'Transactions (Ledger)', overallTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), overallTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), `${Math.abs(finalLedgerBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalLedgerBalance >= 0 ? 'Cr' : 'Dr') : (finalLedgerBalance >= 0 ? 'Dr' : 'Cr')}`],
            ['', '', '', 'Closing Balance', '--', '--', `${Math.abs(finalLedgerBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalLedgerBalance >= 0 ? 'Cr' : 'Dr') : (finalLedgerBalance >= 0 ? 'Dr' : 'Cr')}`]
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

        doc.save(`${selectedAccount?.accountName || 'Account'}_ledger.pdf`);
        setShowExportMenu(false);
    };

    const handleExportExcel = () => {
        const exportData = filteredTransactions.map((tx, index) => ({
            "Sr.No": index + 1,
            "Date": new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
            "Particular": tx.particulars,
            "Narration": tx.narration || '-',
            "Debit (₹)": tx.debit,
            "Credit (₹)": tx.credit,
            "Balance": `${Math.abs(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}`
        }));

        // Add summary rows to Excel
        exportData.push({}); 
        exportData.push({ "Narration": "Page Total", "Debit (₹)": pageTotalDR, "Credit (₹)": pageTotalCR, "Balance": `${Math.abs(currentClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (currentClosingBalance >= 0 ? 'Cr' : 'Dr') : (currentClosingBalance >= 0 ? 'Dr' : 'Cr')}` });
        exportData.push({ "Narration": "Transactions (Ledger)", "Debit (₹)": overallTotalDR, "Credit (₹)": overallTotalCR, "Balance": `${Math.abs(finalLedgerBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalLedgerBalance >= 0 ? 'Cr' : 'Dr') : (finalLedgerBalance >= 0 ? 'Dr' : 'Cr')}` });
        exportData.push({ "Narration": "Closing Balance", "Debit (₹)": "--", "Credit (₹)": "--", "Balance": `${Math.abs(finalLedgerBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (finalLedgerBalance >= 0 ? 'Cr' : 'Dr') : (finalLedgerBalance >= 0 ? 'Dr' : 'Cr')}` });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ledger");
        XLSX.utils.writeFile(wb, `${selectedAccount?.accountName || 'Account'}_ledger.xlsx`);
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
                                            <th className="px-6 py-4 whitespace-nowrap text-center">Action</th>
                                        </>
                                    )}
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
                                                    {item.accountName}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {item.openingBalance != null ? `${Math.abs(Number(item.openingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (Number(item.openingBalance) >= 0 ? 'Cr' : 'Dr') : (Number(item.openingBalance) >= 0 ? 'Dr' : 'Cr')}` : ''}
                                                </td>
                                                <td className="px-6 py-4 text-center">{Number(item.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-4 text-center">{Number(item.credit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-4 text-center text-[#111827] font-bold">
                                                    {item.closingBalance != null ? `${Math.abs(Number(item.closingBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeSubTab === 'Sundry Creditors' ? (Number(item.closingBalance) >= 0 ? 'Cr' : 'Dr') : (Number(item.closingBalance) >= 0 ? 'Dr' : 'Cr')}` : ''}
                                                </td>
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
                                        {activeMainTab !== 'Ledger' && (
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
                                                                        const name = item.accountName || item.account || '';
                                                                        const qs = `?name=${encodeURIComponent(name)}${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}&type=${encodeURIComponent(activeSubTab)}`;
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
                                                                    onClick={() => {
                                                                        handleDeleteVoucher(item);
                                                                        setOpenActionMenuId(null);
                                                                    }}
                                                                >
                                                                    <Trash2 size={18} className="text-red-400" />
                                                                    Delete
                                                                </button>
                                                            )}

                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        )}
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
                                    {activeMainTab === 'Ledger' ? `Ledger Account: ${selectedAccount.accountName || selectedAccount.account}` : `${activeSubTab} Details: ${selectedAccount.vchNo}`}
                                </h3>
                                <p className="text-[14px] text-[#6B7280] font-medium mt-1">
                                    {activeMainTab === 'Ledger' ? 'Transaction history and details' : 'Complete transaction summary and status'}
                                </p>
                            </div>
                            <button onClick={() => { setSelectedAccount(null); setSearchQuery(''); setStartDate(''); setEndDate(''); setShowExportMenu(false); setDetailedCurrentPage(1); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
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
                                    <div className="mt-8 flex justify-end gap-3">
                                        <button 
                                            onClick={() => {
                                                setEditVoucherData(selectedAccount.originalVoucher);
                                                setEditVoucherType(activeSubTab === 'Receipts' ? 'Receipt' : 'Payment');
                                                setIsEditModalOpen(true);
                                                setSelectedAccount(null); // Close the view modal
                                            }}
                                            className="px-6 py-2.5 rounded-xl bg-[#073318] text-white font-bold hover:bg-[#0a4422] transition-all text-[14px] shadow-[0_4px_14px_rgba(7,51,24,0.25)] flex items-center gap-2"
                                        >
                                            Edit Voucher
                                        </button>
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
                                                    value={selectedAccount.accountName || selectedAccount.account || ''} 
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
                                                {detailedLoading ? (
                                                    <tr>
                                                        <td colSpan="7" className="px-6 py-12 text-center">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <div className="w-8 h-8 border-4 border-[#073318]/20 border-t-[#073318] rounded-full animate-spin"></div>
                                                                <p className="font-medium text-[#6B7280]">Loading transaction history...</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : filteredTransactions.length > 0 ? (
                                                    filteredTransactions.map((tx, index) => {
                                                        return (
                                                            <tr key={tx.id || index} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                                                <td className="px-6 py-4 text-center">
                                                                    {(tx.isBalanceRow || tx.particulars.toLowerCase().includes('balance')) ? '-' : ((detailedCurrentPage - 1) * 14 + index)}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
                                                                </td>
                                                                <td className="px-6 py-4 font-bold">{tx.particulars}</td>
                                                                <td className="px-6 py-4 text-[#6B7280]">
                                                                    {tx.narration || '-'}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-medium">{tx.debit > 0 ? tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                                                <td className="px-6 py-4 text-right font-medium">{tx.credit > 0 ? tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                                                                <td className="px-6 py-4 text-right font-bold text-[#111827]">
                                                                    ₹ {Math.abs(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeSubTab === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
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
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#111827]">₹ {pageTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#111827]">₹ {pageTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {Math.abs(pageTotalCR - pageTotalDR).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pageTotalCR >= pageTotalDR ? 'Cr' : 'Dr'}</td>
                                                </tr>

                                                {/* Transactions (Ledger) Row */}
                                                <tr className="border-b border-[#E2E8F0]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right bg-[#F1F5F9]/50">Transactions (Ledger)</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {runningTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {runningTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0]">₹ {Math.abs(runningTotalCR - runningTotalDR).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {runningTotalCR >= runningTotalDR ? 'Cr' : 'Dr'}</td>
                                                </tr>
                                                {/* Balance (Ledger) Row */}
                                                <tr className="bg-[#F1F5F9]">
                                                    <td colSpan="4" className="px-4 py-2.5 text-right font-extrabold text-[#0F172A]">Closing Balance</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#94A3B8]">--</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-[#94A3B8]">--</td>
                                                    <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] font-extrabold text-[#111827]">₹ {Math.abs(currentClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeSubTab === 'Sundry Creditors' ? (currentClosingBalance >= 0 ? 'Cr' : 'Dr') : (currentClosingBalance >= 0 ? 'Dr' : 'Cr')}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    {/* Modal Pagination Controls */}
                                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t border-gray-100 bg-white/50 rounded-b-[16px]">
                                        <div className="flex flex-col items-center sm:items-start">
                                            <p className="text-[14px] text-[#111827] font-bold">
                                                Page {detailedCurrentPage} of {detailedTotalPages}
                                            </p>
                                            <p className="text-[12px] text-[#6B7280] font-medium">
                                                {detailedTotalTotal} total transactions
                                            </p>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setDetailedCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={detailedCurrentPage === 1 || detailedLoading}
                                                className={`flex items-center gap-1 h-[36px] px-4 rounded-[8px] border border-[#E5E7EB] text-[13px] font-bold transition-all shadow-sm ${detailedCurrentPage === 1 ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50' : 'bg-white text-[#111827] hover:bg-gray-50 active:scale-95'}`}
                                            >
                                                <ChevronLeft size={16} />
                                                Prev
                                            </button>

                                            <div className="flex items-center gap-1">
                                                {[...Array(detailedTotalPages)].map((_, i) => (
                                                    <button
                                                        key={i + 1}
                                                        onClick={() => setDetailedCurrentPage(i + 1)}
                                                        className={`w-[32px] h-[32px] rounded-[6px] text-[12px] font-bold transition-all ${detailedCurrentPage === i + 1 ? 'bg-[#073318] text-white' : 'text-[#4B5563] hover:bg-gray-100'}`}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                )).slice(Math.max(0, detailedCurrentPage - 3), Math.min(detailedTotalPages, detailedCurrentPage + 2))}
                                            </div>

                                            <button 
                                                onClick={() => setDetailedCurrentPage(prev => Math.min(detailedTotalPages, prev + 1))}
                                                disabled={detailedCurrentPage === detailedTotalPages || detailedLoading}
                                                className={`flex items-center gap-1 h-[36px] px-4 rounded-[8px] border border-[#E5E7EB] text-[13px] font-bold transition-all shadow-sm ${detailedCurrentPage === detailedTotalPages ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50' : 'bg-white text-[#111827] hover:bg-gray-50 active:scale-95'}`}
                                            >
                                                Next
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isEditModalOpen && (
                <PaymentModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setEditVoucherData(null);
                        fetchVouchers();
                    }}
                    type={editVoucherType}
                    initialData={editVoucherData}
                />
            )}
        </div>
    );
};

export default Finance;
