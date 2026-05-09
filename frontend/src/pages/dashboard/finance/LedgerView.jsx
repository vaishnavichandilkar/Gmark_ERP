import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Search, FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from "xlsx";
import ScrollableTable from "@/components/common/ScrollableTable";

const LedgerView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
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
        doc.text(`Ledger Statement`, 14, 15);
        autoTable(doc, {
            head: [['Sr.No', 'Date', 'Particular', 'Narration', 'DR', 'CR', 'Balance']],
            body: filteredTransactions.map((tx, idx) => [
                idx + 1,
                tx.date,
                tx.particulars,
                (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
                tx.debit,
                tx.credit,
                tx.balance
            ]),
            startY: 25,
        });
        doc.save(`ledger_${id}.pdf`);
    };

    const handleExportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredTransactions.map((tx, idx) => ({
            "Sr.No": idx + 1,
            "Date": tx.date,
            "Particulars": tx.particulars,
            "Narration": (tx.voucherNo && tx.voucherNo !== '-' ? `Inv.No-${tx.voucherNo.split('-')[1] || tx.voucherNo} - ` : '') + (tx.narration || ''),
            "Debit (₹)": tx.debit,
            "Credit (₹)": tx.credit,
            "Balance": tx.balance
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ledger");
        XLSX.utils.writeFile(wb, `ledger_${id}.xlsx`);
    };

    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F9FAFB] font-outfit">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border border-[#E5E7EB] bg-white sticky top-4 mx-6 z-10 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-4">
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
                                <h3 className="text-2xl font-extrabold text-blue-600">₹ {totalDR.toLocaleString()}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Total Credit</p>
                                <h3 className="text-2xl font-extrabold text-red-600">₹ {totalCR.toLocaleString()}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-[20px] border border-[#E5E7EB] shadow-sm">
                                <p className="text-[14px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Closing Balance</p>
                                <h3 className="text-2xl font-extrabold text-[#073318]">₹ {finalBalance}</h3>
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
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Search transactions..."
                                    className="h-[44px] pl-10 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all w-[300px]"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Fiscal Year Selector */}
                            <div className="flex items-center gap-2 p-1 bg-gray-100/50 rounded-[14px] border border-gray-100">
                                {fiscalYears.map((year) => (
                                    <button
                                        key={year}
                                        onClick={() => handleFiscalYearChange(year)}
                                        className={`px-4 py-1.5 rounded-[10px] text-[13px] font-bold transition-all duration-300
                                            ${activeFiscalYear === year 
                                                ? 'bg-[#073318] text-white shadow-md shadow-[#073318]/20' 
                                                : 'text-gray-500 hover:text-[#073318] hover:bg-white'}`}
                                    >
                                        {year}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                <input 
                                    type="date" 
                                    className="h-[44px] px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                                <span className="text-gray-400 font-bold">to</span>
                                <input 
                                    type="date" 
                                    className="h-[44px] px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] outline-none"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                                {(startDate || endDate) && (
                                    <button onClick={() => {setStartDate(''); setEndDate('');}} className="p-2 text-gray-400 hover:text-red-500">
                                        <RotateCcw size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            <button 
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="h-[44px] px-6 bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded-[12px] font-bold text-gray-700 flex items-center gap-2 transition-all shadow-sm"
                            >
                                <Download size={18} />
                                Export Ledger
                            </button>
                            {showExportMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                                    <div className="absolute right-0 top-13 w-48 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 py-2">
                                        <button onClick={handleExportPDF} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 font-medium text-gray-700">
                                            <FileText size={18} className="text-red-500" /> PDF Document
                                        </button>
                                        <button onClick={handleExportExcel} className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 font-medium text-gray-700">
                                            <FileSpreadsheet size={18} className="text-green-500" /> Excel Sheet
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
                                        <td className="px-6 py-5 text-right font-bold text-blue-600">{tx.debit !== '0' ? `₹ ${tx.debit}` : '-'}</td>
                                        <td className="px-6 py-5 text-right font-bold text-red-600">{tx.credit !== '0' ? `₹ ${tx.credit}` : '-'}</td>
                                        <td className="px-6 py-5 text-right font-extrabold text-[#073318]">{tx.balance}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </ScrollableTable>
                </div>
            </div>
        </div>
    );
};

export default LedgerView;
