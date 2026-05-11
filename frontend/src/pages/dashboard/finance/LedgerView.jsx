import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Download, Search, FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from "xlsx";
import ScrollableTable from "@/components/common/ScrollableTable";

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
        email: 'contact@account.com'
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [activeFiscalYear, setActiveFiscalYear] = useState('2024-2025');

    const fiscalYears = ['2024-2025', '2025-2026', '2026-2027'];

    const handleFiscalYearChange = (year) => {
        setActiveFiscalYear(year);
        const [startYear, endYear] = year.split('-');
        setStartDate(`${startYear}-04-01`);
        setEndDate(`${endYear}-03-31`);
    };

    React.useEffect(() => {
        const start = searchParams.get('startDate');
        const end = searchParams.get('endDate');
        const name = searchParams.get('name');

        if (start) setStartDate(start);
        if (end) setEndDate(end);
        if (name) setAccountData(prev => ({ ...prev, name }));
        
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

    // Dummy data matching Finance.jsx
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

    const handleAccountChange = (e) => {
        const { name, value } = e.target;
        setAccountData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        setIsEditing(false);
        // Here you would typically call an API to save the changes
    };

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

    const filteredTransactions = dummyTransactions.filter(tx => {
        const matchesSearch = tx.particulars.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            tx.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            tx.voucherNo.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchesDate = true;
        if (startDate || endDate) {
            const txDateStr = normalizeDate(tx.date);
            if (startDate && txDateStr < startDate) matchesDate = false;
            if (endDate && txDateStr > endDate) matchesDate = false;
        }
        
        return matchesSearch && matchesDate;
    });

    const totalDR = filteredTransactions.reduce((acc, tx) => acc + Number(tx.debit || 0), 0);
    const totalCR = filteredTransactions.reduce((acc, tx) => acc + Number(tx.credit || 0), 0);
    const finalBalance = filteredTransactions.length > 0 ? filteredTransactions[filteredTransactions.length - 1].balance : '0.00';

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text(`Ledger Account: ${accountData.name}`, 14, 20);
        
        const tableColumn = ["Sr.No", "Date", "Particular", "Narration", "DR", "CR", "Balance"];
        const tableRows = filteredTransactions.map((tx, idx) => [
            idx + 1,
            tx.date,
            tx.particulars,
            (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
            tx.debit !== '0' ? tx.debit : '-',
            tx.credit !== '0' ? tx.credit : '-',
            tx.balance
        ]);

        const footerRows = [
            ['', '', '', 'Page Total', totalDR.toLocaleString(), totalCR.toLocaleString(), finalBalance],
            ['', '', '', 'Transactions (Ledger)', totalDR.toLocaleString(), totalCR.toLocaleString(), finalBalance],
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

        doc.save(`${accountData.name}_ledger.pdf`);
    };

    const handleExportExcel = () => {
        const exportData = filteredTransactions.map((tx, idx) => ({
            "Sr.No": idx + 1,
            "Date": tx.date,
            "Particular": tx.particulars,
            "Narration": (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
            "Debit (₹)": tx.debit,
            "Credit (₹)": tx.credit,
            "Balance": tx.balance
        }));

        // Add summary rows to Excel
        exportData.push({}); // Empty row for spacing
        exportData.push({ "Narration": "Page Total", "Debit (₹)": totalDR, "Credit (₹)": totalCR, "Balance": finalBalance });
        exportData.push({ "Narration": "Transactions (Ledger)", "Debit (₹)": totalDR, "Credit (₹)": totalCR, "Balance": finalBalance });
        exportData.push({ "Narration": "Balance (Ledger)", "Debit (₹)": "--", "Credit (₹)": "--", "Balance": finalBalance });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ledger");
        XLSX.utils.writeFile(wb, `${accountData.name}_ledger.xlsx`);
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
                            <h1 className="text-[24px] font-bold text-[#111827] tracking-tight">Ledger Account: {accountData.name}</h1>
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
                                <h3 className="text-2xl font-extrabold text-[#111827]">₹ {totalDR.toLocaleString()}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Total Credit</p>
                                <h3 className="text-2xl font-extrabold text-[#111827]">₹ {totalCR.toLocaleString()}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Closing Balance</p>
                                <h3 className="text-2xl font-extrabold text-[#111827]">₹ {finalBalance}</h3>
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
                                    <th className="px-6 py-4 text-right font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Debit (₹)</th>
                                    <th className="px-6 py-4 text-right font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Credit (₹)</th>
                                    <th className="px-6 py-4 text-right font-bold text-[#6B7280] uppercase text-[12px] tracking-wider">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((tx, idx) => (
                                    <tr key={tx.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                                        <td className="px-6 py-5 text-center text-gray-500 font-medium">{idx + 1}</td>
                                        <td className="px-6 py-5 font-medium text-gray-700">{tx.date}</td>
                                        <td className="px-6 py-5 font-bold text-gray-900">{tx.particulars}</td>
                                        <td className="px-6 py-5 text-gray-500 max-w-[300px]">
                                            {tx.voucherNo && tx.voucherNo !== '-' && (
                                                <span className="font-bold text-[#111827]">Inv.No-{tx.voucherNo.split('-')[1] || tx.voucherNo} - </span>
                                            )}
                                            {tx.narration}
                                        </td>
                                        <td className="px-6 py-5 text-right font-bold text-[#111827]">{tx.debit !== '0' ? `₹ ${tx.debit}` : '-'}</td>
                                        <td className="px-6 py-5 text-right font-bold text-[#111827]">{tx.credit !== '0' ? `₹ ${tx.credit}` : '-'}</td>
                                        <td className="px-6 py-5 text-right font-extrabold text-[#111827]">{tx.balance}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-white border-t-2 border-[#E5E7EB] font-outfit">
                                {/* Page Total Row */}
                                <tr className="border-b border-gray-100">
                                    <td colSpan="4" className="px-6 py-3 text-right font-bold text-gray-900 bg-gray-50/50">Page Total</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {totalDR.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {totalCR.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100 bg-gray-50/50">{finalBalance}</td>
                                </tr>
                                {/* Transactions (Ledger) Row */}
                                <tr className="border-b border-gray-100">
                                    <td colSpan="4" className="px-6 py-3 text-right font-bold text-gray-900 bg-gray-50/50">Transactions (Ledger)</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {totalDR.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100">₹ {totalCR.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100 bg-gray-50/50">{finalBalance}</td>
                                </tr>
                                {/* Balance (Ledger) Row */}
                                <tr>
                                    <td colSpan="4" className="px-6 py-3 text-right font-bold text-gray-900 bg-gray-50/50">Balance (Ledger)</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-400 border-l border-gray-100 text-center">--</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-400 border-l border-gray-100 text-center">--</td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 border-l border-gray-100 bg-gray-50/50">{finalBalance}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </ScrollableTable>
                </div>
            </div>
        </div>
    );
};

export default LedgerView;
