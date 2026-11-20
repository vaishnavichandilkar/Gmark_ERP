import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Calendar,
  FileText,
  Building2,
  ShieldCheck,
  Percent,
} from 'lucide-react';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateDDMMYYYY = (dStr) => {
  if (!dStr) return 'N/A';
  const parts = dStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

const CustomerInvoicesModal = ({
  isOpen,
  onClose,
  customer,
  asOnDate = '',
  slabs = { belowDays: 30, aboveDays: 90 },
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'SETTLED' | 'OVERDUE'

  if (!isOpen || !customer) return null;

  const invoices = customer.invoices || [];

  // Totals calculated from actual invoices
  const totalInvoiced = Number(customer.invoiceAmount || 0);
  const totalPaid = Number(customer.paidAmount || 0);
  const totalOutstanding = Number(customer.outstandingAmount || 0);
  const recoveryRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

  // Overdue count and amount
  const overdueInvoices = invoices.filter((inv) => Number(inv.daysOverdue || 0) > 0 && Number(inv.outstandingAmount || 0) > 0.001);
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.outstandingAmount || 0), 0);
  const criticalOverdueAmount = Number(customer.aboveDaysAmount || 0);

  // Filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    // Status filter
    const isDue = Number(inv.outstandingAmount || 0) > 0.001;
    const isOverdue = Number(inv.daysOverdue || 0) > 0 && isDue;

    if (statusFilter === 'PENDING' && !isDue) return false;
    if (statusFilter === 'SETTLED' && isDue) return false;
    if (statusFilter === 'OVERDUE' && !isOverdue) return false;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const numMatch = (inv.invoiceNumber || '').toLowerCase().includes(q);
      const custNumMatch = (inv.customerInvoiceNumber || '').toLowerCase().includes(q);
      const dateMatch = (inv.invoiceDate || '').includes(q);
      const dueMatch = (inv.dueDate || '').includes(q);
      const agingMatch = (inv.agingBucket || '').toLowerCase().includes(q);
      return numMatch || custNumMatch || dateMatch || dueMatch || agingMatch;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/70 via-gray-50/50 to-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-[#073318] flex items-center justify-center shrink-0 shadow-2xs font-extrabold text-sm">
              <User size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                  {customer.accountName || customer.displayName || 'Customer Invoices'}
                </h3>
                {customer.customerCode && (
                  <span className="text-[11px] font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                    {customer.customerCode}
                  </span>
                )}
                {customer.customerType && (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 capitalize">
                    {customer.customerType}
                  </span>
                )}
                {customer.msmeEnabled && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                    <ShieldCheck size={11} />
                    MSME
                  </span>
                )}
                {asOnDate && (
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/80 flex items-center gap-1">
                    <Calendar size={11} className="text-gray-400" />
                    As on {formatDateDDMMYYYY(asOnDate)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                Complete sales invoice ledger, payment settlements, and aging receivable breakdown
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Section 1: 4 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Invoiced */}
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                Total Invoiced
              </span>
              <div className="text-xl font-black text-emerald-950 mt-0.5">
                ₹{formatCurrency(totalInvoiced)}
              </div>
              <span className="text-[11px] text-emerald-700 font-medium">
                across {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
              </span>
            </div>

            {/* Total Paid */}
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200/80">
              <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider">
                Total Paid / Settled
              </span>
              <div className="text-xl font-black text-indigo-950 mt-0.5">
                ₹{formatCurrency(totalPaid)}
              </div>
              <span className="text-[11px] text-indigo-700 font-medium">
                {recoveryRate.toFixed(1)}% recovery rate
              </span>
            </div>

            {/* Total Outstanding */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80">
              <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                Net Outstanding
              </span>
              <div className="text-xl font-black text-amber-950 mt-0.5">
                ₹{formatCurrency(totalOutstanding)}
              </div>
              <span className="text-[11px] text-amber-700 font-medium">
                {totalOutstanding > 0.001 ? 'pending balance' : 'fully settled'}
              </span>
            </div>

            {/* Critical Overdue / Aging Overdue */}
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80">
              <span className="text-[10px] uppercase font-bold text-purple-800 tracking-wider">
                Overdue Aging
              </span>
              <div className="text-xl font-black text-purple-950 mt-0.5">
                ₹{formatCurrency(overdueAmount)}
              </div>
              <span className="text-[11px] text-purple-700 font-medium">
                {overdueInvoices.length} {overdueInvoices.length === 1 ? 'invoice' : 'invoices'} past due
              </span>
            </div>
          </div>

          {/* Section 2: Aging Slabs Strip */}
          <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="uppercase tracking-wider text-[11px] text-gray-500">Aging Slabs Breakdown</span>
              <span className="text-gray-500 text-[11px]">Threshold: {slabs.belowDays || 30}d - {slabs.aboveDays || 90}d</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase">&lt; {slabs.belowDays || 30} Days</span>
                <div className="font-extrabold text-gray-900 mt-0.5">₹{formatCurrency(customer.belowDaysAmount)}</div>
                <span className="text-[10px] text-emerald-600 font-medium">Current</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{slabs.slab1Min || 30} - {slabs.slab1Max || 44} Days</span>
                <div className="font-extrabold text-gray-900 mt-0.5">₹{formatCurrency(customer.slab1Amount)}</div>
                <span className="text-[10px] text-amber-600 font-medium">Slab 1</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{slabs.slab2Min || 45} - {slabs.slab2Max || 59} Days</span>
                <div className="font-extrabold text-gray-900 mt-0.5">₹{formatCurrency(customer.slab2Amount)}</div>
                <span className="text-[10px] text-amber-600 font-medium">Slab 2</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{slabs.slab3Min || 60} - {slabs.slab3Max || 89} Days</span>
                <div className="font-extrabold text-gray-900 mt-0.5">₹{formatCurrency(customer.slab3Amount)}</div>
                <span className="text-[10px] text-purple-600 font-medium">Slab 3</span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase">≥ {slabs.aboveDays || 90} Days</span>
                <div className="font-extrabold text-gray-900 mt-0.5">₹{formatCurrency(customer.aboveDaysAmount)}</div>
                <span className="text-[10px] text-red-600 font-medium">Critical</span>
              </div>
            </div>
          </div>

          {/* Section 3: Invoices Table with Search and Status Filter */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            {/* Table Header Filter Toolbar */}
            <div className="p-3 bg-gray-50/90 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
                <div className="relative w-full">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search invoice # or date..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#073318]"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-white p-0.5 border border-gray-200 rounded-lg">
                {[
                  { id: 'ALL', label: 'All Invoices' },
                  { id: 'PENDING', label: 'Pending Due' },
                  { id: 'SETTLED', label: 'Settled' },
                  { id: 'OVERDUE', label: 'Overdue Only' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-[#073318] text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-semibold text-gray-500">
                Showing <span className="font-bold text-gray-800">{filteredInvoices.length}</span> of {invoices.length} invoices
              </div>
            </div>

            {/* Invoices List */}
            <div className="overflow-x-auto max-h-[380px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Invoice Date</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-center">Overdue</th>
                    <th className="py-2.5 px-3">Aging Slab</th>
                    <th className="py-2.5 px-3 text-right">Invoiced</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-400 italic">
                        No invoices match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv, idx) => {
                      const isDue = Number(inv.outstandingAmount || 0) > 0.001;
                      const daysOverdue = Number(inv.daysOverdue || 0);
                      const isOverdue = daysOverdue > 0 && isDue;

                      return (
                        <tr key={inv.id || idx} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                            <div>{inv.invoiceNumber}</div>
                            {inv.customerInvoiceNumber && (
                              <div className="text-[10px] text-gray-400 font-sans font-normal">
                                Cust: {inv.customerInvoiceNumber}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-gray-700">
                            {formatDateDDMMYYYY(inv.invoiceDate)}
                          </td>

                          <td className="py-2.5 px-3 text-gray-700">
                            <div>{formatDateDDMMYYYY(inv.dueDate)}</div>
                            {inv.creditDays !== undefined && (
                              <div className="text-[10px] text-gray-400">
                                {inv.creditDays}d credit
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {isOverdue ? (
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  daysOverdue >= (slabs.aboveDays || 90)
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {daysOverdue}d overdue
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Current
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-gray-600 font-medium text-[11px]">
                            {inv.agingBucket || '—'}
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-gray-800">
                            ₹{formatCurrency(inv.grandTotal)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-blue-900">
                            ₹{formatCurrency(inv.paidAmount)}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`font-black ${
                                isDue ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              ₹{formatCurrency(inv.outstandingAmount)}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                                !isDue
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isOverdue
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {!isDue ? 'Paid' : isOverdue ? 'Overdue' : 'Due'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs">
          <div className="text-gray-500">
            Showing all recorded invoices and settlement status for{' '}
            <span className="font-semibold text-gray-800">
              {customer.accountName || customer.displayName}
            </span>
            .
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerInvoicesModal;
