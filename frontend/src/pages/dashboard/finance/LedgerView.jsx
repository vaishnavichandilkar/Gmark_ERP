import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Download, Search, FileText, FileSpreadsheet, RotateCcw, XSquare } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ScrollableTable from "@/components/common/ScrollableTable";
import ledgerService from '../../../services/ledgerService';
import toast from 'react-hot-toast';

const LedgerView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isEditing, setIsEditing] = useState(false);
    const [accountData, setAccountData] = useState({
        name: `Account #${id}`,
        group: 'Sundry Creditors',
        openingBalance: '5000',
        contact: '+91 98765 43210',
        email: 'contact@account.com',
        accountType: 'Debtor'
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showAllocations, setShowAllocations] = useState(false);
    const [activeFiscalYear, setActiveFiscalYear] = useState('2025-2026');
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [periodTotals, setPeriodTotals] = useState({ debit: 0, credit: 0 });

    const fiscalYears = ['2025-2026', '2026-2027'];

    const handleFiscalYearChange = (year) => {
        setActiveFiscalYear(year);
        const [startYear, endYear] = year.split('-');
        setStartDate(`${startYear}-04-01`);
        setEndDate(`${endYear}-03-31`);
    };

    useEffect(() => {
        const fetchLedger = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const params = { startDate, endDate, type, page: currentPage, limit: 14 };
                const response = await ledgerService.getDetailedLedger(id, params);
                setTransactions(response.data.items || []);
                setTotalPages(response.data.totalPages || 1);
                setTotalTransactions(response.data.total || 0);
                setPeriodTotals({
                    debit: response.data.periodDebit || 0,
                    credit: response.data.periodCredit || 0
                });
                setAccountData(prev => ({
                    ...prev,
                    name: response.data.accountName || prev.name,
                    openingBalance: response.data.openingBalance,
                    // Account type would ideally be returned in meta or summary
                }));
            } catch (error) {
                console.error('Error fetching ledger details:', error);
                toast.error('Failed to load ledger details');
            } finally {
                setLoading(false);
            }
        };

        fetchLedger();
    }, [id, startDate, endDate, type, currentPage]);

    const handleDeleteAllocation = async (allocationId) => {
        if (!window.confirm('Are you sure you want to delete this allocation?')) return;
        try {
            await ledgerService.deleteAllocation(allocationId);
            toast.success('Allocation deleted successfully');
            
            // Refresh data
            setLoading(true);
            const params = { startDate, endDate, type, page: currentPage, limit: 14 };
            const response = await ledgerService.getDetailedLedger(id, params);
            setTransactions(response.data.items || []);
            setTotalPages(response.data.totalPages || 1);
            setTotalTransactions(response.data.total || 0);
            setPeriodTotals({
                debit: response.data.periodDebit || 0,
                credit: response.data.periodCredit || 0
            });
            setLoading(false);
        } catch (error) {
            console.error('Error deleting allocation:', error);
            toast.error('Failed to delete allocation');
            setLoading(false);
        }
    };

    React.useEffect(() => {
        const start = searchParams.get('startDate');
        const end = searchParams.get('endDate');
        const name = searchParams.get('name');
        const ledgerType = searchParams.get('type');

        if (start) setStartDate(start);
        if (end) setEndDate(end);
        if (name && name !== 'undefined') setAccountData(prev => ({ ...prev, name }));
        if (ledgerType) {
            setType(ledgerType);
            setAccountData(prev => ({ ...prev, group: ledgerType }));
        }
        
        // Find if these dates match a fiscal year
        if (start && end) {
            const fiscalYear = fiscalYears.find(fy => {
                const [sY, eY] = fy.split('-');
                return start === `${sY}-04-01` && end === `${eY}-03-31`;
            });
            if (fiscalYear) setActiveFiscalYear(fiscalYear);
            else setActiveFiscalYear(null);
        }
    }, [searchParams]);

    const handleAccountChange = (e) => {
        const { name, value } = e.target;
        setAccountData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        setIsEditing(false);
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            const matchesSearch = tx.particulars.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (tx.narration || '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [transactions, searchQuery]);

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


    const pageNetBalance = useMemo(() => pageTotalCR - pageTotalDR, [pageTotalCR, pageTotalDR]);

    const finalBalance = useMemo(() => filteredTransactions.length > 0 ? filteredTransactions[filteredTransactions.length - 1].balance : 0, [filteredTransactions]);

    const handleExportPDF = () => {
        try {
            if (!filteredTransactions || filteredTransactions.length === 0) {
                toast.error('No data available to export');
                return;
            }

            const doc = new jsPDF();
            
            doc.setFontSize(16);
            doc.text(`Ledger Account: ${accountData.name}`, 14, 20);
            
            const tableColumn = ["Sr.No", "Date", "Particular", "Narration", "Unallocated", "DR", "CR", "Balance"];
            const tableRows = filteredTransactions.map((tx, idx) => [
                idx + 1,
                tx.date,
                tx.particulars,
                (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
                tx.unallocated !== undefined && tx.unallocated !== null ? Number(tx.unallocated).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
                tx.debit !== '0' && tx.debit ? Number(tx.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
                tx.credit !== '0' && tx.credit ? Number(tx.credit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-',
                Number(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` ${type === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}`
            ]);

            const footerRows = [
                ['', '', '', 'Page Total', '', pageTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), `${Math.abs(pageNetBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${pageTotalCR >= pageTotalDR ? 'Cr' : 'Dr'}`],
                ['', '', '', 'Transactions (Ledger)', '', periodTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), periodTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), `${Math.abs(periodTotals.credit - periodTotals.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${periodTotals.credit >= periodTotals.debit ? 'Cr' : 'Dr'}`],
                ['', '', '', 'Closing Balance', '', '--', '--', `${Math.abs(finalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${type === 'Sundry Creditors' ? (finalBalance >= 0 ? 'Cr' : 'Dr') : (finalBalance >= 0 ? 'Dr' : 'Cr')}`]
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

            const fileName = `${accountData.name}_ledger`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            doc.save(`${fileName}.pdf`);
            toast.success('PDF exported successfully');
            setShowExportMenu(false);
        } catch (error) {
            console.error('PDF export error:', error);
            toast.error('Failed to export PDF file');
        }
    };

    const handleExportExcel = () => {
        try {
            if (!filteredTransactions || filteredTransactions.length === 0) {
                toast.error('No data available to export');
                return;
            }

            const exportData = filteredTransactions.map((tx, idx) => ({
                "Sr.No": idx + 1,
                "Date": tx.date,
                "Particular": tx.particulars,
                "Narration": (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
                "Unallocated (₹)": tx.unallocated !== undefined && tx.unallocated !== null ? Number(tx.unallocated) : null,
                "Debit (₹)": tx.debit !== '0' && tx.debit ? Number(tx.debit) : null,
                "Credit (₹)": tx.credit !== '0' && tx.credit ? Number(tx.credit) : null,
                "Balance": `${Math.abs(Number(tx.balance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${type === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}`
            }));

            // Add summary rows to Excel
            exportData.push({}); // Empty row for spacing
            exportData.push({ "Narration": "Page Total", "Unallocated (₹)": "--", "Debit (₹)": pageTotalDR, "Credit (₹)": pageTotalCR, "Balance": `${Math.abs(pageNetBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${pageTotalCR >= pageTotalDR ? 'Cr' : 'Dr'}` });
            exportData.push({ "Narration": "Transactions (Ledger)", "Unallocated (₹)": "--", "Debit (₹)": periodTotals.debit, "Credit (₹)": periodTotals.credit, "Balance": `${Math.abs(periodTotals.credit - periodTotals.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${periodTotals.credit >= periodTotals.debit ? 'Cr' : 'Dr'}` });
            exportData.push({ "Narration": "Closing Balance", "Unallocated (₹)": "--", "Debit (₹)": "--", "Credit (₹)": "--", "Balance": `${Math.abs(finalBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${type === 'Sundry Creditors' ? (finalBalance >= 0 ? 'Cr' : 'Dr') : (finalBalance >= 0 ? 'Dr' : 'Cr')}` });

            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Set column widths
            const wscols = [
                {wch: 8},  // Sr.No
                {wch: 15}, // Date
                {wch: 30}, // Particular
                {wch: 40}, // Narration
                {wch: 15}, // Unallocated
                {wch: 15}, // Debit
                {wch: 15}, // Credit
                {wch: 15}  // Balance
            ];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ledger");
            
            const fileName = `${accountData.name}_ledger`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            XLSX.utils.writeFile(wb, `${fileName}.xlsx`);
            
            toast.success('Excel exported successfully');
            setShowExportMenu(false);
        } catch (error) {
            console.error('Excel export error:', error);
            toast.error('Failed to export Excel file');
        }
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F9FAFB] font-outfit">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#E5E7EB] bg-white rounded-b-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        {isEditing ? (
                            <input 
                                type="text"
                                name="name"
                                value={accountData.name}
                                onChange={handleAccountChange}
                                className="text-[24px] font-bold text-[#111827] tracking-tight border-b-2 border-[#073318] outline-none bg-transparent w-full max-w-[400px]"
                                autoFocus
                            />
                        ) : (
                            <h1 className="text-[24px] font-bold text-[#111827] tracking-tight">LEDGER (UPDATED): {accountData.name}</h1>
                        )}
                        <p className="text-[14px] text-[#6B7280] font-medium">Detailed transaction history and financial status</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {isEditing ? (
                        <>
                            <button 
                                className="h-[42px] px-6 border border-[#E5E7EB] text-gray-600 rounded-[14px] font-bold text-[14px] hover:bg-gray-50 transition-all"
                                onClick={() => setIsEditing(false)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="h-[42px] px-8 bg-[#073318] text-white rounded-[14px] font-bold text-[14px] shadow-lg shadow-[#073318]/20 hover:bg-[#0a4422] transition-all"
                                onClick={handleSave}
                            >
                                Save Changes
                            </button>
                        </>
                    ) : (
                        <button 
                            className="h-[42px] px-8 bg-[#073318] text-white rounded-[14px] font-bold text-[14px] shadow-lg shadow-[#073318]/20 hover:bg-[#0a4422] transition-all"
                            onClick={() => setIsEditing(true)}
                        >
                            Edit Account
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6 md:p-8 flex-1">
                {/* Account Details / Statistics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                    {isEditing ? (
                        <div className="lg:col-span-4 bg-white p-8 rounded-[24px] border border-[#E5E7EB] shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-[#6B7280] uppercase">Account Group</label>
                                <select 
                                    name="group"
                                    value={accountData.group}
                                    onChange={handleAccountChange}
                                    className="w-full h-11 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:border-[#073318] outline-none"
                                >
                                    <option value="Sundry Creditors">Sundry Creditors</option>
                                    <option value="Sundry Debtors">Sundry Debtors</option>
                                    <option value="Bank">Bank</option>
                                    <option value="Cash">Cash</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-[#6B7280] uppercase">Opening Balance</label>
                                <input 
                                    type="number"
                                    name="openingBalance"
                                    value={accountData.openingBalance}
                                    onChange={handleAccountChange}
                                    className="w-full h-11 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:border-[#073318] outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-[#6B7280] uppercase">Contact Number</label>
                                <input 
                                    type="text"
                                    name="contact"
                                    value={accountData.contact}
                                    onChange={handleAccountChange}
                                    className="w-full h-11 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:border-[#073318] outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-[#6B7280] uppercase">Email Address</label>
                                <input 
                                    type="email"
                                    name="email"
                                    value={accountData.email}
                                    onChange={handleAccountChange}
                                    className="w-full h-11 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:border-[#073318] outline-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Total Debit</p>
                                <h3 className="text-2xl font-extrabold text-[#111827]">₹ {periodTotals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Total Credit</p>
                                <h3 className="text-2xl font-extrabold text-[#111827]">₹ {periodTotals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Closing Balance</p>
                                <h3 className="text-2xl font-extrabold text-[#111827]">₹ {Math.abs(Number(finalBalance)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {type === 'Sundry Creditors' ? (finalBalance >= 0 ? 'Cr' : 'Dr') : (finalBalance >= 0 ? 'Dr' : 'Cr')}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Group</p>
                                <h3 className="text-[18px] font-bold text-gray-800">{accountData.group}</h3>
                            </div>
                        </>
                    )}
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-[24px] border border-[#E5E7EB] shadow-sm mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search transactions..."
                                    className="h-[46px] pl-10 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all w-full sm:w-[320px] font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">From</span>
                                    <input 
                                        type="date" 
                                        className="h-[44px] px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none text-[14px] font-bold text-[#111827] focus:border-[#073318] transition-all cursor-pointer"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">To</span>
                                    <input 
                                        type="date" 
                                        className="h-[44px] px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none text-[14px] font-bold text-[#111827] focus:border-[#073318] transition-all cursor-pointer"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
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

                        <div className="flex items-center gap-3">
                            <button 
                                className={`h-[44px] px-6 transition-all flex items-center shadow-lg rounded-[12px] font-bold text-[15px] ${showAllocations ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-[#073318] hover:bg-[#0a4422] text-white'}`}
                                onClick={() => setShowAllocations(!showAllocations)}
                            >
                                {showAllocations ? 'Hide Allocation' : 'Allocation'}
                            </button>
                            <div className="relative">
                            <button 
                                className="h-[44px] px-6 bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#4B5563] rounded-[12px] font-bold text-[15px] transition-all flex items-center gap-2 shadow-sm"
                                onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
                            >
                                <Download size={18} />
                                Export
                            </button>
                            
                            {showExportMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 flex flex-col py-2 font-outfit">
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
                </div>

                {/* Table */}
                <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-sm overflow-hidden">
                    <ScrollableTable>
                        <table className="w-full min-w-[1000px]">
                            <thead>
                                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                                    <th className="px-6 py-4 text-center font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Sr.No</th>
                                    <th className="px-6 py-4 text-left font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Particulars</th>
                                    <th className="px-6 py-4 text-left font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Narration</th>
                                    <th className="px-6 py-4 text-right font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Unallocated</th>
                                    <th className="px-6 py-4 text-right font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Debit (₹)</th>
                                    <th className="px-6 py-4 text-right font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Credit (₹)</th>
                                    <th className="px-6 py-4 text-right font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-10 h-10 border-4 border-[#073318]/20 border-t-[#073318] rounded-full animate-spin"></div>
                                                <p className="text-[16px] font-bold text-[#6B7280]">Fetching ledger records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredTransactions.length > 0 ? (
                                    filteredTransactions.map((tx, idx) => (
                                        <React.Fragment key={tx.id || idx}>
                                            <tr className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                                                <td className="px-6 py-5 text-center text-gray-500 font-medium">
                                                    {(tx.isBalanceRow || tx.particulars.toLowerCase().includes('balance')) ? '-' : ((currentPage - 1) * 14 + idx + 1)}
                                                </td>
                                                <td className="px-6 py-5 font-medium text-gray-700">
                                                    {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
                                                </td>
                                                <td className="px-6 py-5 font-bold text-gray-900">{tx.particulars}</td>
                                                <td className="px-6 py-5 text-gray-500 max-w-[300px]">
                                                    {tx.narration || '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-gray-700">
                                                    {(() => {
                                                        if (tx.isBalanceRow || tx.particulars.toLowerCase().includes('balance')) return '-';
                                                        if (tx.unallocated === undefined || tx.unallocated === null) return '-';
                                                        const totalAllocated = tx.allocations ? tx.allocations.reduce((s, a) => s + a.amount, 0) : 0;
                                                        const remainingUnallocated = Math.max(0, tx.unallocated - totalAllocated);
                                                        const displayAmount = showAllocations ? tx.unallocated : remainingUnallocated;
                                                        const pType = tx.particulars || '';
                                                        const suffix = pType.includes('Purchase') || pType.includes('Receipt') ? 'Cr' : (pType.includes('Sales') || pType.includes('Payment') ? 'Dr' : '');
                                                        
                                                        if (displayAmount === 0) return `-- ${suffix}`.trim();
                                                        return `₹ ${displayAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`.trim();
                                                    })()}
                                                </td>
                                                <td className="px-6 py-5 text-right font-bold text-[#111827]">{tx.debit > 0 ? `₹ ${tx.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                                                <td className="px-6 py-5 text-right font-bold text-[#111827]">{tx.credit > 0 ? `₹ ${tx.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                                                <td className="px-6 py-5 text-right font-extrabold text-[#111827]">
                                                    ₹ {Math.abs(tx.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {type === 'Sundry Creditors' ? (tx.balance >= 0 ? 'Cr' : 'Dr') : (tx.balance >= 0 ? 'Dr' : 'Cr')}
                                                </td>
                                            </tr>
                                            {showAllocations && tx.allocations && tx.allocations.length > 0 && (
                                                <>
                                                    {tx.allocations.map((alloc) => (
                                                        <tr key={`alloc-${alloc.id}`} className="bg-[#FAFAFA] border-b border-[#F1F5F9]">
                                                            <td className="px-6 py-3"></td>
                                                            <td className="px-6 py-3 text-[13px] text-gray-500 font-medium">
                                                                {new Date(alloc.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')}
                                                            </td>
                                                            <td className="px-6 py-3 text-[13px] font-bold text-gray-700">{alloc.type}</td>
                                                            <td className="px-6 py-3">
                                                                {alloc.voucherNo !== '-' ? (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[13px] font-bold text-gray-700">{alloc.voucherNo}</span>
                                                                        {alloc.narration && alloc.narration !== '-' && (
                                                                            <span className="text-[11.5px] font-medium text-gray-500 italic">{alloc.narration}</span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[13px] text-gray-500">{alloc.narration}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className="text-[12px] font-bold text-gray-700">
                                                                        {formatCurrency(alloc.amount)} {tx.particulars && (tx.particulars.includes('Purchase') || tx.particulars.includes('Receipt')) ? 'Dr' : (tx.particulars && (tx.particulars.includes('Sales') || tx.particulars.includes('Payment')) ? 'Cr' : '')}
                                                                    </span>
                                                                    <button 
                                                                        onClick={() => handleDeleteAllocation(alloc.id)}
                                                                        className="w-5 h-5 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                                                        title="Delete Allocation"
                                                                    >
                                                                        <XSquare size={12} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td colSpan="3"></td>
                                                        </tr>
                                                    ))}
                                                    <tr className="bg-[#FAFAFA] border-b border-[#F3F4F6]">
                                                        <td colSpan="4" className="px-6 py-2 text-right text-[12px] font-medium text-gray-500">
                                                            Unallocated Balance:
                                                        </td>
                                                        <td className="px-6 py-2 text-center text-[13px] font-bold text-gray-700">
                                                            {(tx.unallocated ? Math.max(0, tx.unallocated - tx.allocations.reduce((s, a) => s + a.amount, 0)) : 0) > 0 
                                                                ? `₹ ${(tx.unallocated - tx.allocations.reduce((s, a) => s + a.amount, 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tx.particulars && (tx.particulars.includes('Purchase') || tx.particulars.includes('Receipt')) ? 'Cr' : (tx.particulars && (tx.particulars.includes('Sales') || tx.particulars.includes('Payment')) ? 'Dr' : '')}` 
                                                                : `-- ${tx.particulars && (tx.particulars.includes('Purchase') || tx.particulars.includes('Receipt')) ? 'Cr' : (tx.particulars && (tx.particulars.includes('Sales') || tx.particulars.includes('Payment')) ? 'Dr' : '')}`}
                                                        </td>
                                                        <td colSpan="3"></td>
                                                    </tr>
                                                </>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-[#6B7280] font-medium">
                                            No transactions found for the selected criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-white border-t-2 border-[#E5E7EB] font-outfit">
                                {/* Page Total Row */}
                                <tr className="border-b border-gray-100">
                                    <td colSpan="4" className="px-6 py-3 text-right font-bold text-gray-900 bg-gray-50/50">PAGE TOTAL (NEW)</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-400 border-l border-gray-100 text-center">--</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {pageTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {pageTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100 bg-gray-50/50">₹ {Math.abs(pageNetBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pageTotalCR >= pageTotalDR ? 'Cr' : 'Dr'}</td>
                                </tr>
                                {/* Transactions (Ledger) Row */}
                                <tr className="border-b border-gray-100">
                                    <td colSpan="4" className="px-6 py-3 text-right font-bold text-gray-900 bg-gray-50/50">Transactions (Ledger)</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-400 border-l border-gray-100 text-center">--</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {runningTotalDR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {runningTotalCR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100 bg-gray-50/50">₹ {Math.abs(runningTotalCR - runningTotalDR).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {runningTotalCR >= runningTotalDR ? 'Cr' : 'Dr'}</td>
                                </tr>
                                {/* Balance (Ledger) Row */}
                                <tr>
                                    <td colSpan="4" className="px-6 py-3 text-right font-bold text-gray-900 bg-gray-50/50">Closing Balance</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-400 border-l border-gray-100 text-center">--</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-400 border-l border-gray-100 text-center">--</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-400 border-l border-gray-100 text-center">--</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100 bg-gray-50/50">₹ {Math.abs(currentClosingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {type === 'Sundry Creditors' ? (currentClosingBalance >= 0 ? 'Cr' : 'Dr') : (currentClosingBalance >= 0 ? 'Dr' : 'Cr')}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </ScrollableTable>
                </div>

                {/* Pagination Controls - Moved outside for better visibility */}
                <div className="mt-6 px-8 py-5 bg-white rounded-[20px] border border-[#E5E7EB] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-center sm:items-start">
                        <p className="text-[15px] text-[#111827] font-bold">
                            Page {currentPage} of {totalPages}
                        </p>
                        <p className="text-[13px] text-[#6B7280] font-medium">
                            Showing {transactions.length} records of {totalTransactions} total transactions
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                setCurrentPage(prev => Math.max(1, prev - 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage === 1 || loading}
                            className={`flex items-center gap-2 h-[44px] px-6 rounded-[12px] border border-[#E5E7EB] text-[14px] font-bold transition-all shadow-sm ${currentPage === 1 ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50' : 'bg-white text-[#111827] hover:bg-gray-50 hover:border-gray-300 active:scale-95'}`}
                        >
                            <ChevronLeft size={18} />
                            Previous
                        </button>

                        <div className="hidden md:flex items-center gap-2 mx-2">
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => {
                                        setCurrentPage(i + 1);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className={`w-[40px] h-[40px] rounded-[10px] text-[14px] font-bold transition-all ${currentPage === i + 1 ? 'bg-[#073318] text-white shadow-lg shadow-[#073318]/20' : 'text-[#4B5563] hover:bg-gray-100 hover:text-[#111827]'}`}
                                >
                                    {i + 1}
                                </button>
                            )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                        </div>

                        <button 
                            onClick={() => {
                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage === totalPages || loading}
                            className={`flex items-center gap-2 h-[44px] px-6 rounded-[12px] border border-[#E5E7EB] text-[14px] font-bold transition-all shadow-sm ${currentPage === totalPages ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50' : 'bg-white text-[#111827] hover:bg-gray-50 hover:border-gray-300 active:scale-95'}`}
                        >
                            Next
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LedgerView;
