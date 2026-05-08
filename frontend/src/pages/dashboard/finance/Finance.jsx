import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { MoreVertical, X, Eye, Users, BookOpen, Download, Search, FileText, FileSpreadsheet, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ScrollableTable from "@/components/common/ScrollableTable";

const Finance = () => {
    const { t } = useTranslation(['modules', 'common']);
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
    const [searchParams] = useSearchParams();

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

    const mainTabs = ['Ledger', 'Bank Reconciliation'];
    const getSubTabs = (mainTab) => {
        if (mainTab === 'Bank Reconciliation') return ['Receipts', 'Withdrawals', 'JV', 'Contra'];
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

    const dummyBankData = {
        'Receipts': [
            { id: 1, date: "01-Oct-2023", vchNo: "REC-001", account: "Retail Stores Inc", bank: "HDFC Bank", amount: "5000", status: "Reconciled" },
            { id: 2, date: "05-Oct-2023", vchNo: "REC-002", account: "Mega Market", bank: "SBI Bank", amount: "12000", status: "Unreconciled" },
            { id: 3, date: "10-Oct-2023", vchNo: "REC-003", account: "City Wholesale", bank: "HDFC Bank", amount: "8500", status: "Reconciled" },
        ],
        'Withdrawals': [
            { id: 1, date: "02-Oct-2023", vchNo: "WTH-001", account: "Salary Payment", bank: "SBI Bank", amount: "45000", status: "Reconciled" },
            { id: 2, date: "08-Oct-2023", vchNo: "WTH-002", account: "Office Rent", bank: "HDFC Bank", amount: "15000", status: "Unreconciled" },
        ],
        'JV': [
            { id: 1, date: "15-Oct-2023", vchNo: "JV-001", account: "Depreciation", bank: "-", amount: "2500", status: "Reconciled" },
        ],
        'Contra': [
            { id: 1, date: "20-Oct-2023", vchNo: "CON-001", account: "Cash to Bank", bank: "SBI Bank", amount: "10000", status: "Reconciled" },
        ]
    };

    const dummyTransactions = [
        { id: 1, date: "01-Oct-2023", particulars: "Opening Balance", type: "-", voucherNo: "-", debit: "0", credit: "5000", balance: "5000 Cr", narration: "Opening balance" },
        { id: 2, date: "05-Oct-2023", particulars: "Purchase Invoice", type: "PI", voucherNo: "PI-001", debit: "0", credit: "2000", balance: "7000 Cr", narration: "Purchase of raw materials" },
        { id: 3, date: "10-Oct-2023", particulars: "Bank Payment", type: "BP", voucherNo: "BP-001", debit: "3000", credit: "0", balance: "4000 Cr", narration: "Payment to vendor via HDFC" },
        { id: 4, date: "15-Oct-2023", particulars: "Purchase Return", type: "PR", voucherNo: "PR-001", debit: "500", credit: "0", balance: "3500 Cr", narration: "Defective goods returned" },
        { id: 5, date: "20-Oct-2023", particulars: "Bank Payment", type: "BP", voucherNo: "BP-002", debit: "500", credit: "0", balance: "3000 Cr", narration: "Quarterly maintenance charges" }
    ];

    const currentData = activeMainTab === 'Ledger'
        ? (activeSubTab === 'Sundry Creditors' ? dummyCreditors 
           : activeSubTab === 'Sundry Debtors' ? dummyDebtors 
           : activeSubTab === 'Bank' ? dummyBankLedger
           : activeSubTab === 'Cash' ? dummyCashLedger : [])
        : dummyBankData[activeSubTab] || [];

    // Pagination Logic
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = currentData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(currentData.length / rowsPerPage);

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
            const txDate = new Date(tx.date);
            if (startDate) {
                const start = new Date(startDate);
                if (txDate < start) dateMatch = false;
            }
            if (endDate) {
                const end = new Date(endDate);
                if (txDate > end) dateMatch = false;
            }
        }

        return textMatch && dateMatch;
    });

    const totalDR = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.debit || 0), 0);
    const totalCR = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.credit || 0), 0);
    const finalBalance = filteredTransactions.length > 0 ? filteredTransactions[filteredTransactions.length - 1].balance : '0';


    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Ledger Account: ${selectedAccount?.account || 'Account'}`, 14, 20);
        
        const tableColumn = ["Sr.No", "Date", "Particular", "Narration", "DR", "CR", "Cum Balance"];
        const tableRows = [];

        filteredTransactions.forEach((tx, index) => {
            const txData = [
                index + 1,
                tx.date,
                tx.particulars,
                tx.narration || '-',
                tx.debit,
                tx.credit,
                tx.balance
            ];
            tableRows.push(txData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [7, 51, 24] },
            styles: { fontSize: 9 }
        });

        doc.save(`${selectedAccount?.account || 'Account'}_ledger.pdf`);
        setShowExportMenu(false);
    };

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(filteredTransactions.map((tx, index) => ({
            "Sr.No": index + 1,
            "Date": tx.date,
            "Particular": tx.particulars,
            "Narration": tx.narration || '-',
            "DR": tx.debit,
            "CR": tx.credit,
            "Cum Balance": tx.balance
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");
        XLSX.writeFile(workbook, `${selectedAccount?.account || 'Account'}_ledger.xlsx`);
        setShowExportMenu(false);
    };

    return (
        <div className="flex flex-col w-full max-w-[1400px] mx-auto px-2 sm:px-4 md:px-8 py-6 pb-10 font-['Plus_Jakarta_Sans'] transition-all duration-300 relative h-full">
            {/* Title & Subtitle */}
            <div className="flex flex-col gap-1 mb-6 md:mb-8 justify-start items-start font-outfit">
                <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">{t('finance', 'Finance')}</h1>
                <p className="text-[14px] md:text-[16px] text-[#6B7280] font-medium">Manage your financial operations and reporting</p>
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
                                        ? 'text-[#073318]'
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
                            className={`relative pb-4 text-[16px] md:text-[18px] font-bold transition-colors whitespace-nowrap shrink-0 ${isActive ? 'text-[#073318]' : 'text-[#6B7280]'}`}
                        >
                            {tab}
                            {isActive && <motion.div layoutId="underlineSubTabFinance" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#073318]" />}
                        </button>
                    );
                })}
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
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Amount</th>
                                            <th className="px-6 py-4 border-r border-white/10 whitespace-nowrap text-center">Status</th>
                                        </>
                                    )}
                                    <th className="px-6 py-4 whitespace-nowrap text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-[14px] text-[#111827]">
                                {currentRows.map((item) => (
                                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                        {activeMainTab === 'Ledger' ? (
                                            <>
                                                <td 
                                                    className="px-6 py-4 text-center font-bold text-[#073318] hover:underline cursor-pointer"
                                                    onClick={() => setSelectedAccount(item)}
                                                >
                                                    {item.account}
                                                </td>
                                                <td className="px-6 py-4 text-center">{item.openingBalance}</td>
                                                <td className="px-6 py-4 text-center">{item.debit}</td>
                                                <td className="px-6 py-4 text-center">{item.credit}</td>
                                                <td className="px-6 py-4 text-center text-[#073318] font-bold">{item.closingBalance}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 text-center">{item.date}</td>
                                                <td className="px-6 py-4 text-center font-bold">{item.vchNo}</td>
                                                <td className="px-6 py-4 text-center">{item.account}</td>
                                                <td className="px-6 py-4 text-center">{item.bank}</td>
                                                <td className="px-6 py-4 text-center font-bold text-[#073318]">₹ {item.amount}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-[12px] font-bold ${item.status === 'Reconciled' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {item.status}
                                                    </span>
                                                </td>
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
                                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(null); }} />
                                                    <div className="absolute right-4 md:right-8 top-12 w-48 sm:w-56 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 flex flex-col py-2 font-outfit"
                                                        onClick={(e) => e.stopPropagation()}>
                                                        <button 
                                                            className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                            onClick={() => setOpenActionMenuId(null)}
                                                        >
                                                            <Eye size={18} className="text-[#9CA3AF]" />
                                                            View & Edit
                                                        </button>
                                                        <button 
                                                            className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                            onClick={() => setOpenActionMenuId(null)}
                                                        >
                                                            <Users size={18} className="text-[#9CA3AF]" />
                                                            Group
                                                        </button>
                                                        <button 
                                                            className="flex items-center gap-3 w-full px-5 py-2.5 text-[15px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors"
                                                            onClick={() => setOpenActionMenuId(null)}
                                                        >
                                                            <BookOpen size={18} className="text-[#9CA3AF]" />
                                                            Ledger
                                                        </button>

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
                            <select 
                                className="h-[36px] bg-white border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] text-[#4B5563] outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all font-semibold cursor-pointer shadow-sm hover:border-gray-300"
                                value={rowsPerPage}
                                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-6">
                            <span className="text-[14px] text-[#6B7280] font-medium">
                                {currentData && currentData.length > 0 ? `${indexOfFirstRow + 1}-${Math.min(indexOfLastRow, currentData.length)} of ${currentData.length}` : '0-0 of 0'}
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    className="p-2 rounded-[10px] bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#4B5563] hover:bg-[#F9FAFB] hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E7EB]"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1 || !currentData || currentData.length === 0}
                                >
                                    <ChevronLeft size={18} strokeWidth={2.5} />
                                </button>
                                <button 
                                    className="p-2 rounded-[10px] bg-white border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#4B5563] hover:bg-[#F9FAFB] hover:border-gray-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E7EB]"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || !currentData || currentData.length === 0}
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
                                <h3 className="text-[20px] font-bold text-[#111827] tracking-tight">Ledger Account: {selectedAccount.account}</h3>
                                <p className="text-[14px] text-[#6B7280] font-medium mt-1">Transaction history and details</p>
                            </div>
                            <button onClick={() => { setSelectedAccount(null); setSearchQuery(''); setStartDate(''); setEndDate(''); setShowExportMenu(false); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 sm:p-8 overflow-y-auto bg-[#F9FAFB] flex-1">
                            {/* Filter Section */}
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
                                                    <td className="px-6 py-4 text-[#6B7280]">{tx.narration}</td>
                                                    <td className="px-6 py-4 text-right">{tx.debit}</td>
                                                    <td className="px-6 py-4 text-right">{tx.credit}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-[#073318]">{tx.balance}</td>
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
                                            <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-blue-600">₹ {totalDR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] text-red-600">₹ {totalCR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
                                            <td className="px-4 py-2.5 text-right border-l border-[#E2E8F0] font-extrabold text-[#073318]">₹ {finalBalance}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Finance;
