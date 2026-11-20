import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ChevronRight,
  Calendar,
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

const METRIC_CONFIG = {
  ALL: {
    id: 'ALL',
    title: 'Total Accounts',
    subtitle: 'All active customer accounts with recorded invoices or receivables',
    icon: Users,
    color: 'blue',
    headerBg: 'bg-blue-600',
    iconBg: 'bg-blue-100 text-blue-700',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    accentText: 'text-blue-700',
  },
  INVOICED: {
    id: 'INVOICED',
    title: 'Total Invoiced',
    subtitle: 'Cumulative sales invoice billing recorded up to as on date',
    icon: IndianRupee,
    color: 'emerald',
    headerBg: 'bg-[#073318]',
    iconBg: 'bg-emerald-100 text-emerald-800',
    badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    accentText: 'text-emerald-800',
  },
  PAID: {
    id: 'PAID',
    title: 'Total Paid / Settled',
    subtitle: 'Receipt vouchers and settled collections recorded up to as on date',
    icon: CheckCircle2,
    color: 'indigo',
    headerBg: 'bg-indigo-600',
    iconBg: 'bg-indigo-100 text-indigo-800',
    badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    accentText: 'text-indigo-800',
  },
  OUTSTANDING: {
    id: 'OUTSTANDING',
    title: 'Total Outstanding',
    subtitle: 'Net unpaid customer receivables and overdue balances',
    icon: AlertTriangle,
    color: 'amber',
    headerBg: 'bg-amber-600',
    iconBg: 'bg-amber-100 text-amber-800',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    accentText: 'text-amber-800',
  },
  OVERDUE_90: {
    id: 'OVERDUE_90',
    title: 'Overdue ≥ 90 Days',
    subtitle: 'Critical aging receivables exceeding threshold',
    icon: Clock,
    color: 'purple',
    headerBg: 'bg-purple-700',
    iconBg: 'bg-purple-100 text-purple-800',
    badgeBg: 'bg-purple-50 text-purple-900 border-purple-200',
    accentText: 'text-purple-800',
  },
};

const OutstandingMetricModal = ({
  isOpen,
  onClose,
  metricKey = 'ALL',
  accounts = [],
  summaryMetrics = {},
  asOnDate = '',
  slabs = { belowDays: 30, aboveDays: 90 },
  onSelectAccount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Overall calculations
  const totalInvoicedVal = Number(summaryMetrics.totalInvoiced || 0);
  const totalPaidVal = Number(summaryMetrics.totalPaid || 0);
  const totalOutstandingVal = Number(summaryMetrics.totalOutstanding || 0);
  const accountsCount = Number(summaryMetrics.totalAccounts || accounts.length);
  const pendingCount = Number(summaryMetrics.accountsPending || 0);
  const overdue90Val = Number(summaryMetrics.overdueAbove90 || 0);

  const recoveryRate = totalInvoicedVal > 0 ? (totalPaidVal / totalInvoicedVal) * 100 : 0;
  const overdueShare = totalOutstandingVal > 0 ? (overdue90Val / totalOutstandingVal) * 100 : 0;

  const belowDaysSum = useMemo(() => {
    return accounts.reduce((s, a) => s + Number(a.belowDaysAmount || 0), 0);
  }, [accounts]);

  const overdueSum = useMemo(() => {
    return accounts.reduce(
      (s, a) =>
        s +
        Number(a.slab1Amount || 0) +
        Number(a.slab2Amount || 0) +
        Number(a.slab3Amount || 0) +
        Number(a.aboveDaysAmount || 0),
      0
    );
  }, [accounts]);

  // Filtered customer list for the active metric
  const filteredAccounts = useMemo(() => {
    let list = [...accounts];

    if (metricKey === 'INVOICED') {
      list.sort((a, b) => Number(b.invoiceAmount || 0) - Number(a.invoiceAmount || 0));
    } else if (metricKey === 'PAID') {
      list.sort((a, b) => Number(b.paidAmount || 0) - Number(a.paidAmount || 0));
    } else if (metricKey === 'OUTSTANDING') {
      list.sort((a, b) => Number(b.outstandingAmount || 0) - Number(a.outstandingAmount || 0));
    } else if (metricKey === 'OVERDUE_90') {
      list.sort((a, b) => Number(b.aboveDaysAmount || 0) - Number(a.aboveDaysAmount || 0));
    } else {
      list.sort((a, b) => Number(b.outstandingAmount || 0) - Number(a.outstandingAmount || 0));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.accountName || '').toLowerCase().includes(q) ||
          (a.displayName || '').toLowerCase().includes(q) ||
          (a.customerCode || '').toLowerCase().includes(q) ||
          (a.customerType || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [accounts, metricKey, searchTerm]);

  // Customer Type breakdown
  const typeStats = useMemo(() => {
    const map = new Map();
    accounts.forEach((a) => {
      const typeKey = (a.customerType || 'Other').toLowerCase();
      const label =
        typeKey === 'industrial' ? 'Industrial'
        : typeKey === 'institutional' ? 'Institutional'
        : typeKey === 'dealer' ? 'Dealer'
        : typeKey === 'retailer' ? 'Retailer'
        : 'Other';

      if (!map.has(typeKey)) {
        map.set(typeKey, { label, invoiced: 0, outstanding: 0, count: 0 });
      }
      const entry = map.get(typeKey);
      entry.invoiced += Number(a.invoiceAmount || 0);
      entry.outstanding += Number(a.outstandingAmount || 0);
      entry.count += 1;
    });

    return Array.from(map.values()).map((item) => {
      const baseTotal = metricKey === 'INVOICED' ? totalInvoicedVal : totalOutstandingVal || totalInvoicedVal;
      const baseValue = metricKey === 'INVOICED' ? item.invoiced : item.outstanding;
      const pct = baseTotal > 0 ? (baseValue / baseTotal) * 100 : 0;
      return {
        ...item,
        value: baseValue,
        pct: Math.max(0, Math.min(100, pct)),
      };
    });
  }, [accounts, metricKey, totalInvoicedVal, totalOutstandingVal]);

  if (!isOpen) return null;

  const currentConfig = METRIC_CONFIG[metricKey] || METRIC_CONFIG.ALL;
  const MetricIcon = currentConfig.icon;
  const dynamicTitle =
    metricKey === 'OVERDUE_90' ? `Overdue ≥ ${slabs.aboveDays || 90} Days` : currentConfig.title;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-gray-50/80 to-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${currentConfig.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
              <MetricIcon size={20} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                  {dynamicTitle}
                </h3>
                {asOnDate && (
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/80 flex items-center gap-1">
                    <Calendar size={11} className="text-gray-400" />
                    As on {formatDateDDMMYYYY(asOnDate)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {currentConfig.subtitle}
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

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: 4 Highlight Cards based on active metric */}
          {metricKey === 'ALL' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700/80 tracking-wider">Total Accounts</span>
                <div className="text-xl font-black text-blue-950 mt-0.5">{accountsCount}</div>
                <span className="text-[11px] text-blue-600 font-medium">active customers</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-700/80 tracking-wider">Total Invoiced</span>
                <div className="text-xl font-black text-emerald-950 mt-0.5">₹{formatCurrency(totalInvoicedVal)}</div>
                <span className="text-[11px] text-emerald-600 font-medium">billed sales total</span>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-700/80 tracking-wider">Total Paid</span>
                <div className="text-xl font-black text-indigo-950 mt-0.5">₹{formatCurrency(totalPaidVal)}</div>
                <span className="text-[11px] text-indigo-600 font-medium">settled collections</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-700/80 tracking-wider">Total Outstanding</span>
                <div className="text-xl font-black text-amber-950 mt-0.5">₹{formatCurrency(totalOutstandingVal)}</div>
                <span className="text-[11px] text-amber-600 font-medium">{pendingCount} accounts pending</span>
              </div>
            </div>
          )}

          {metricKey === 'INVOICED' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Net Invoiced</span>
                <div className="text-xl font-black text-emerald-950 mt-0.5">₹{formatCurrency(totalInvoicedVal)}</div>
                <span className="text-[11px] text-emerald-700 font-medium">billed to customers</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700/80 tracking-wider">Paid / Settled</span>
                <div className="text-lg font-black text-blue-950 mt-0.5">₹{formatCurrency(totalPaidVal)}</div>
                <span className="text-[11px] text-blue-600 font-medium">collections received</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-700/80 tracking-wider">Unpaid Balance</span>
                <div className="text-lg font-black text-amber-950 mt-0.5">₹{formatCurrency(totalOutstandingVal)}</div>
                <span className="text-[11px] text-amber-600 font-medium">pending receivables</span>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-700/80 tracking-wider">Collection Rate</span>
                <div className="text-lg font-black text-indigo-950 mt-0.5">{recoveryRate.toFixed(1)}%</div>
                <span className="text-[11px] text-indigo-600 font-medium">recovered of billed</span>
              </div>
            </div>
          )}

          {metricKey === 'PAID' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200">
                <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider">Total Paid / Settled</span>
                <div className="text-xl font-black text-indigo-950 mt-0.5">₹{formatCurrency(totalPaidVal)}</div>
                <span className="text-[11px] text-indigo-700 font-medium">receipts & settlements</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-700/80 tracking-wider">Original Billed</span>
                <div className="text-lg font-black text-emerald-950 mt-0.5">₹{formatCurrency(totalInvoicedVal)}</div>
                <span className="text-[11px] text-emerald-600 font-medium">invoiced amount</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700/80 tracking-wider">Recovery Ratio</span>
                <div className="text-lg font-black text-blue-950 mt-0.5">{recoveryRate.toFixed(1)}%</div>
                <span className="text-[11px] text-blue-600 font-medium">settled collections</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-700/80 tracking-wider">Remaining Due</span>
                <div className="text-lg font-black text-amber-950 mt-0.5">₹{formatCurrency(totalOutstandingVal)}</div>
                <span className="text-[11px] text-amber-600 font-medium">net pending balance</span>
              </div>
            </div>
          )}

          {metricKey === 'OUTSTANDING' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Total Outstanding</span>
                <div className="text-xl font-black text-amber-950 mt-0.5">₹{formatCurrency(totalOutstandingVal)}</div>
                <span className="text-[11px] text-amber-700 font-medium">net customer receivables</span>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                <span className="text-[10px] uppercase font-bold text-rose-700/80 tracking-wider">Pending Accounts</span>
                <div className="text-lg font-black text-rose-950 mt-0.5">{pendingCount} of {accountsCount}</div>
                <span className="text-[11px] text-rose-600 font-medium">accounts with balance &gt; ₹0</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-700/80 tracking-wider">Current (&lt; {slabs.belowDays}d)</span>
                <div className="text-lg font-black text-emerald-950 mt-0.5">₹{formatCurrency(belowDaysSum)}</div>
                <span className="text-[11px] text-emerald-600 font-medium">within credit terms</span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-[10px] uppercase font-bold text-purple-700/80 tracking-wider">Aging Overdue</span>
                <div className="text-lg font-black text-purple-950 mt-0.5">₹{formatCurrency(overdueSum)}</div>
                <span className="text-[11px] text-purple-600 font-medium">past due slabs</span>
              </div>
            </div>
          )}

          {metricKey === 'OVERDUE_90' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200">
                <span className="text-[10px] uppercase font-bold text-purple-800 tracking-wider">
                  Critical Overdue (≥ {slabs.aboveDays || 90}d)
                </span>
                <div className="text-xl font-black text-purple-950 mt-0.5">₹{formatCurrency(overdue90Val)}</div>
                <span className="text-[11px] text-purple-700 font-medium">highest risk aging bucket</span>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                <span className="text-[10px] uppercase font-bold text-rose-700/80 tracking-wider">Affected Accounts</span>
                <div className="text-lg font-black text-rose-950 mt-0.5">
                  {accounts.filter((a) => Number(a.aboveDaysAmount) > 0.001).length} Accounts
                </div>
                <span className="text-[11px] text-rose-600 font-medium">with critical overdue</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-700/80 tracking-wider">Total Outstanding</span>
                <div className="text-lg font-black text-amber-950 mt-0.5">₹{formatCurrency(totalOutstandingVal)}</div>
                <span className="text-[11px] text-amber-600 font-medium">overall receivables</span>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-700/80 tracking-wider">Overdue Share</span>
                <div className="text-lg font-black text-indigo-950 mt-0.5">{overdueShare.toFixed(1)}%</div>
                <span className="text-[11px] text-indigo-600 font-medium">share of total debt</span>
              </div>
            </div>
          )}

          {/* Section 2: Distribution Bar by Customer Type */}
          <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="uppercase tracking-wider text-[11px] text-gray-500">Distribution by Customer Type</span>
              <span>{accounts.length} Total Customers</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-200 gap-0.5">
              {typeStats.map((item, idx) => {
                if (item.value <= 0 && item.count <= 0) return null;
                const colors = ['bg-[#073318]', 'bg-blue-600', 'bg-amber-500', 'bg-purple-600'];
                return (
                  <div
                    key={item.label}
                    style={{ width: `${Math.max(item.pct, 4)}%` }}
                    className={`${colors[idx % colors.length]} transition-all`}
                    title={`${item.label}: ₹${formatCurrency(item.value)} (${item.pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1">
              {typeStats.map((item, idx) => {
                const dotColors = ['bg-[#073318]', 'bg-blue-600', 'bg-amber-500', 'bg-purple-600'];
                return (
                  <div key={item.label} className="flex items-center gap-1.5 font-medium text-gray-700">
                    <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                    <span>{item.label}:</span>
                    <span className="font-bold text-gray-900">₹{formatCurrency(item.value)}</span>
                    <span className="text-gray-400">({item.pct.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Customer Table with Search */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            {/* Table Action Bar */}
            <div className="p-3 bg-gray-50/90 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter customers by name or code..."
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

              <div className="text-xs font-semibold text-gray-500">
                Showing <span className="font-bold text-gray-800">{filteredAccounts.length}</span> of {accounts.length} customers
              </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-center">Invoices</th>
                    <th className="py-2.5 px-3 text-right">Invoiced</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-right">% Share</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                        No customer accounts match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((cust, idx) => {
                      const shareBase =
                        metricKey === 'INVOICED' ? totalInvoicedVal
                        : metricKey === 'PAID' ? totalPaidVal
                        : totalOutstandingVal || totalInvoicedVal;

                      const shareVal =
                        metricKey === 'INVOICED' ? Number(cust.invoiceAmount || 0)
                        : metricKey === 'PAID' ? Number(cust.paidAmount || 0)
                        : Number(cust.outstandingAmount || 0);

                      const custShare = shareBase > 0 ? (shareVal / shareBase) * 100 : 0;
                      const hasOutstanding = Number(cust.outstandingAmount || 0) > 0.001;
                      const invoicesCount = Array.isArray(cust.invoices) ? cust.invoices.length : (cust.invoicesCount || 0);

                      return (
                        <tr
                          key={cust.accountId || idx}
                          className="hover:bg-gray-50 transition-colors group cursor-pointer"
                          onClick={() => onSelectAccount && onSelectAccount(cust)}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-gray-900 group-hover:text-[#073318] transition-colors flex items-center gap-1.5">
                              <span>{cust.displayName || cust.accountName}</span>
                            </div>
                            <div className="text-[11px] font-mono text-gray-400">
                              {cust.customerCode || '—'}
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 capitalize border border-gray-200">
                              {cust.customerType || 'Customer'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className="font-extrabold text-gray-800 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">
                              {invoicesCount} {invoicesCount === 1 ? 'inv' : 'invs'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-gray-800">
                            ₹{formatCurrency(cust.invoiceAmount)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-blue-900">
                            ₹{formatCurrency(cust.paidAmount)}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`font-black ${
                                hasOutstanding ? 'text-amber-700' : 'text-emerald-700'
                              }`}
                            >
                              ₹{formatCurrency(cust.outstandingAmount)}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="font-bold text-gray-800">{custShare.toFixed(1)}%</div>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden ml-auto mt-0.5">
                              <div
                                className={`h-full rounded-full ${
                                  metricKey === 'PAID' ? 'bg-indigo-600'
                                  : metricKey === 'INVOICED' ? 'bg-emerald-600'
                                  : 'bg-amber-600'
                                }`}
                                style={{ width: `${Math.min(custShare, 100)}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectAccount && onSelectAccount(cust);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-[#073318] hover:bg-[#073318] hover:text-white transition-all cursor-pointer border border-emerald-200/80 inline-flex items-center gap-1"
                              title="View account invoices breakdown"
                            >
                              <span>View</span>
                              <ChevronRight size={12} />
                            </button>
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
            Click on any customer row or <span className="font-semibold text-gray-800">View</span> to open their Invoices Breakdown.
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

export default OutstandingMetricModal;
