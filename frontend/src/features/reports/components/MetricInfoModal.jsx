import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  CheckCircle2,
  Search,
  ChevronRight,
  ExternalLink,
  Award,
  Calendar,
  Percent,
  Download,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateDDMMYYYY = (dStr) => {
  if (!dStr) return 'N/A';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

const METRIC_CONFIG = {
  CUSTOMERS_WITH_SALES: {
    id: 'CUSTOMERS_WITH_SALES',
    title: 'Customers with Sales',
    subtitle: 'Active customers who placed transactions in this period',
    icon: Users,
    color: 'blue',
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    headerBg: 'bg-blue-600',
    headerBorder: 'border-blue-200',
    iconBg: 'bg-blue-100 text-blue-700',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    accentText: 'text-blue-700',
  },
  TOTAL_SALES: {
    id: 'TOTAL_SALES',
    title: 'Total Sales (Net)',
    subtitle: 'Revenue generated across all qualifying customer orders',
    icon: IndianRupee,
    color: 'emerald',
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    headerBg: 'bg-[#073318]',
    headerBorder: 'border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-800',
    badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    accentText: 'text-emerald-800',
  },
  TOTAL_ORDERS: {
    id: 'TOTAL_ORDERS',
    title: 'Total Orders',
    subtitle: 'Total completed sales orders and invoices processed',
    icon: ShoppingCart,
    color: 'amber',
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    headerBg: 'bg-amber-600',
    headerBorder: 'border-amber-200',
    iconBg: 'bg-amber-100 text-amber-800',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    accentText: 'text-amber-800',
  },
  AVG_ORDER_VALUE: {
    id: 'AVG_ORDER_VALUE',
    title: 'Avg Order Value (AOV)',
    subtitle: 'Average transaction size per order across active customers',
    icon: TrendingUp,
    color: 'indigo',
    gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
    headerBg: 'bg-indigo-600',
    headerBorder: 'border-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-800',
    badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    accentText: 'text-indigo-800',
  },
  REPEAT_CUSTOMERS: {
    id: 'REPEAT_CUSTOMERS',
    title: 'Repeat Customers',
    subtitle: 'Customers with 2 or more orders in this date range',
    icon: CheckCircle2,
    color: 'purple',
    gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    headerBg: 'bg-purple-700',
    headerBorder: 'border-purple-200',
    iconBg: 'bg-purple-100 text-purple-800',
    badgeBg: 'bg-purple-50 text-purple-900 border-purple-200',
    accentText: 'text-purple-800',
  },
};

const MetricInfoModal = ({
  isOpen,
  onClose,
  initialMetricKey = 'CUSTOMERS_WITH_SALES',
  summaryData = null,
  groupsData = [],
  periodLabel = '',
  onSelectCustomer,
}) => {
  const [activeMetric, setActiveMetric] = useState(initialMetricKey);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync initialMetricKey if changed
  React.useEffect(() => {
    if (initialMetricKey) {
      setActiveMetric(initialMetricKey);
      setSearchTerm('');
    }
  }, [initialMetricKey]);

  // Extract all customers across all groups
  const allCustomers = useMemo(() => {
    const list = [];
    (groupsData || []).forEach((group) => {
      (group.customers || []).forEach((cust) => {
        list.push({
          ...cust,
          customerType: cust.customerType || group.customerType,
          customerTypeLabel: group.customerTypeLabel || cust.customerTypeLabel || 'Customer',
        });
      });
    });
    return list;
  }, [groupsData]);

  // Overall calculations
  const totalSalesVal = summaryData?.totalSales || allCustomers.reduce((s, c) => s + (c.netSales || 0), 0);
  const totalOrdersVal = summaryData?.totalOrders || allCustomers.reduce((s, c) => s + (c.totalOrders || 0), 0);
  const totalCustomersVal = summaryData?.totalCustomers || allCustomers.length;
  const benchmarkAov = totalOrdersVal > 0 ? totalSalesVal / totalOrdersVal : 0;
  const repeatCustomersCount = summaryData?.repeatCustomers || allCustomers.filter((c) => (c.totalOrders || 0) > 1).length;
  const repeatRevenue = allCustomers.filter((c) => (c.totalOrders || 0) > 1).reduce((s, c) => s + (c.netSales || 0), 0);
  const totalGrossVal = allCustomers.reduce((s, c) => s + (c.grossSales || 0), 0);
  const totalDiscountsVal = allCustomers.reduce((s, c) => s + (c.discounts || 0), 0);
  const totalTaxVal = allCustomers.reduce((s, c) => s + (c.taxAmount || 0), 0);

  // Filtered customer list for the active metric
  const metricCustomers = useMemo(() => {
    let list = [...allCustomers];

    if (activeMetric === 'REPEAT_CUSTOMERS') {
      list = list.filter((c) => (c.totalOrders || 0) > 1);
      list.sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0));
    } else if (activeMetric === 'TOTAL_ORDERS') {
      list.sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0));
    } else if (activeMetric === 'AVG_ORDER_VALUE') {
      list.sort((a, b) => (b.averageOrderValue || 0) - (a.averageOrderValue || 0));
    } else {
      // CUSTOMERS_WITH_SALES & TOTAL_SALES
      list.sort((a, b) => (b.netSales || 0) - (a.netSales || 0));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.customerName || '').toLowerCase().includes(q) ||
          (c.customerCode || '').toLowerCase().includes(q) ||
          (c.customerTypeLabel || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [allCustomers, activeMetric, searchTerm]);

  // Group-level summary breakdown
  const groupStats = useMemo(() => {
    return (groupsData || []).map((g) => {
      const gCusts = g.customers || [];
      const gSales = g.totalSales || gCusts.reduce((s, c) => s + (c.netSales || 0), 0);
      const gOrders = g.totalOrders || gCusts.reduce((s, c) => s + (c.totalOrders || 0), 0);
      const pctSales = totalSalesVal > 0 ? (gSales / totalSalesVal) * 100 : 0;
      return {
        type: g.customerType,
        label: g.customerTypeLabel,
        count: gCusts.length,
        sales: gSales,
        orders: gOrders,
        pctSales,
      };
    });
  }, [groupsData, totalSalesVal]);

  if (!isOpen) return null;

  const currentConfig = METRIC_CONFIG[activeMetric] || METRIC_CONFIG.CUSTOMERS_WITH_SALES;
  const MetricIcon = currentConfig.icon;

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
                  {currentConfig.title}
                </h3>
                {periodLabel && (
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/80 flex items-center gap-1">
                    <Calendar size={11} className="text-gray-400" />
                    {periodLabel}
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
          {/* Section 1: Dynamic Highlight Cards based on active metric */}
          {activeMetric === 'CUSTOMERS_WITH_SALES' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700/80 tracking-wider">Total Active</span>
                <div className="text-xl font-black text-blue-950 mt-0.5">{totalCustomersVal}</div>
                <span className="text-[11px] text-blue-600 font-medium">with sales orders</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-700/80 tracking-wider">Total Revenue</span>
                <div className="text-xl font-black text-emerald-950 mt-0.5">₹{formatCurrency(totalSalesVal)}</div>
                <span className="text-[11px] text-emerald-600 font-medium">across all orders</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-700/80 tracking-wider">Total Orders</span>
                <div className="text-xl font-black text-amber-950 mt-0.5">{totalOrdersVal}</div>
                <span className="text-[11px] text-amber-600 font-medium">
                  avg {(totalOrdersVal / (totalCustomersVal || 1)).toFixed(1)} / cust
                </span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-[10px] uppercase font-bold text-purple-700/80 tracking-wider">Top Customer</span>
                <div className="text-base font-extrabold text-purple-950 truncate mt-0.5" title={metricCustomers[0]?.customerName}>
                  {metricCustomers[0]?.customerName || 'None'}
                </div>
                <span className="text-[11px] text-purple-700 font-bold">
                  {metricCustomers[0] ? `₹${formatCurrency(metricCustomers[0].netSales)}` : '—'}
                </span>
              </div>
            </div>
          )}

          {activeMetric === 'TOTAL_SALES' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Net Sales</span>
                <div className="text-xl font-black text-emerald-950 mt-0.5">₹{formatCurrency(totalSalesVal)}</div>
                <span className="text-[11px] text-emerald-700 font-medium">billed to customers</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700/80 tracking-wider">Gross Sales</span>
                <div className="text-lg font-black text-blue-950 mt-0.5">₹{formatCurrency(totalGrossVal || totalSalesVal)}</div>
                <span className="text-[11px] text-blue-600 font-medium">before discounts & tax</span>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                <span className="text-[10px] uppercase font-bold text-rose-700/80 tracking-wider">Discounts Given</span>
                <div className="text-lg font-black text-rose-950 mt-0.5">₹{formatCurrency(totalDiscountsVal)}</div>
                <span className="text-[11px] text-rose-600 font-medium">promotions & concessions</span>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-700/80 tracking-wider">Total Tax (GST)</span>
                <div className="text-lg font-black text-indigo-950 mt-0.5">₹{formatCurrency(totalTaxVal)}</div>
                <span className="text-[11px] text-indigo-600 font-medium">CGST + SGST + IGST</span>
              </div>
            </div>
          )}

          {activeMetric === 'TOTAL_ORDERS' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Total Orders</span>
                <div className="text-xl font-black text-amber-950 mt-0.5">{totalOrdersVal}</div>
                <span className="text-[11px] text-amber-700 font-medium">completed orders</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700/80 tracking-wider">Active Customers</span>
                <div className="text-xl font-black text-blue-950 mt-0.5">{totalCustomersVal}</div>
                <span className="text-[11px] text-blue-600 font-medium">placed orders</span>
              </div>
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-700/80 tracking-wider">Avg Frequency</span>
                <div className="text-xl font-black text-indigo-950 mt-0.5">
                  {(totalOrdersVal / (totalCustomersVal || 1)).toFixed(1)}
                </div>
                <span className="text-[11px] text-indigo-600 font-medium">orders per customer</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-700/80 tracking-wider">Total Order Value</span>
                <div className="text-lg font-black text-emerald-950 mt-0.5">₹{formatCurrency(totalSalesVal)}</div>
                <span className="text-[11px] text-emerald-600 font-medium">across all orders</span>
              </div>
            </div>
          )}

          {activeMetric === 'AVG_ORDER_VALUE' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-2xs">
                    ₹
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-indigo-700 tracking-wider">
                      Overall Benchmark AOV
                    </span>
                    <div className="text-2xl font-black text-indigo-950">
                      ₹{formatCurrency(benchmarkAov)}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-indigo-800 bg-white/80 px-3 py-2 rounded-lg border border-indigo-200/80 font-medium">
                  <span className="font-bold">Formula:</span> ₹{formatCurrency(totalSalesVal)} (Net Sales) ÷ {totalOrdersVal} (Orders)
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">Highest Customer AOV</span>
                  <div className="text-sm font-bold text-emerald-700 truncate mt-0.5">
                    {metricCustomers[0]?.customerName || '—'}: ₹{formatCurrency(metricCustomers[0]?.averageOrderValue)}
                  </div>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">Lowest Customer AOV</span>
                  <div className="text-sm font-bold text-amber-700 truncate mt-0.5">
                    {metricCustomers[metricCustomers.length - 1]?.customerName || '—'}: ₹{formatCurrency(metricCustomers[metricCustomers.length - 1]?.averageOrderValue)}
                  </div>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 sm:col-span-1 col-span-2">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">Above Benchmark</span>
                  <div className="text-sm font-bold text-gray-900 mt-0.5">
                    {allCustomers.filter((c) => (c.averageOrderValue || 0) >= benchmarkAov).length} of {allCustomers.length} customers
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMetric === 'REPEAT_CUSTOMERS' && (
            <div className="space-y-3">
              <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase font-bold text-purple-800 tracking-wider">
                    Repeat Customer Rate
                  </span>
                  <div className="text-2xl font-black text-purple-950 flex items-center gap-2 mt-0.5">
                    <span>
                      {totalCustomersVal > 0 ? ((repeatCustomersCount / totalCustomersVal) * 100).toFixed(1) : 0}%
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900">
                      {repeatCustomersCount} of {totalCustomersVal} customers
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-purple-700 font-bold uppercase">Repeat Revenue</span>
                  <div className="text-lg font-black text-purple-950">
                    ₹{formatCurrency(repeatRevenue)}
                  </div>
                  <span className="text-[11px] text-purple-600">
                    {totalSalesVal > 0 ? ((repeatRevenue / totalSalesVal) * 100).toFixed(1) : 0}% of net sales
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Repeat Buyers</span>
                    <div className="text-lg font-black text-emerald-950 mt-0.5">{repeatCustomersCount} Customers</div>
                    <span className="text-[11px] text-emerald-600 font-medium">&gt; 1 order in period</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-800 flex items-center justify-center font-black">
                    ✓
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">One-time Buyers</span>
                    <div className="text-lg font-black text-gray-800 mt-0.5">{Math.max(0, totalCustomersVal - repeatCustomersCount)} Customers</div>
                    <span className="text-[11px] text-gray-500 font-medium">1 order only</span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold">
                    1
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Customer Type Distribution Bar */}
          <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="uppercase tracking-wider text-[11px] text-gray-500">Distribution by Customer Type</span>
              <span>{allCustomers.length} Total Customers</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-200 gap-0.5">
              {groupStats.map((g, idx) => {
                if (g.sales <= 0 && g.count <= 0) return null;
                const colors = ['bg-[#073318]', 'bg-blue-600', 'bg-amber-500', 'bg-purple-600'];
                return (
                  <div
                    key={g.type}
                    style={{ width: `${Math.max(g.pctSales, 4)}%` }}
                    className={`${colors[idx % colors.length]} transition-all`}
                    title={`${g.label}: ₹${formatCurrency(g.sales)} (${g.pctSales.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1">
              {groupStats.map((g, idx) => {
                const dotColors = ['bg-[#073318]', 'bg-blue-600', 'bg-amber-500', 'bg-purple-600'];
                return (
                  <div key={g.type} className="flex items-center gap-1.5 font-medium text-gray-700">
                    <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`}></span>
                    <span>{g.label}:</span>
                    <span className="font-bold text-gray-900">₹{formatCurrency(g.sales)}</span>
                    <span className="text-gray-400">({g.pctSales.toFixed(0)}%)</span>
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="text-xs font-semibold text-gray-500">
                Showing <span className="font-bold text-gray-800">{metricCustomers.length}</span> of {allCustomers.length} customers
              </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto max-h-[360px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-center">Orders</th>
                    <th className="py-2.5 px-3 text-right">Net Sales</th>
                    {activeMetric === 'AVG_ORDER_VALUE' ? (
                      <th className="py-2.5 px-3 text-right">Customer AOV</th>
                    ) : activeMetric === 'TOTAL_SALES' ? (
                      <th className="py-2.5 px-3 text-right">% Share</th>
                    ) : (
                      <th className="py-2.5 px-3 text-right">Last Purchase</th>
                    )}
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {metricCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                        No customers match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    metricCustomers.map((cust, idx) => {
                      const custShare = totalSalesVal > 0 ? ((cust.netSales || 0) / totalSalesVal) * 100 : 0;
                      const isAboveAov = (cust.averageOrderValue || 0) >= benchmarkAov;

                      return (
                        <tr
                          key={cust.customerId || idx}
                          className="hover:bg-gray-50 transition-colors group cursor-pointer"
                          onClick={() => onSelectCustomer && onSelectCustomer(cust)}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-gray-900 group-hover:text-[#073318] transition-colors flex items-center gap-1.5">
                              <span>{cust.customerName}</span>
                              {(cust.totalOrders || 0) > 1 && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                  Repeat
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-gray-400">
                              {cust.customerCode || '—'}
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 capitalize border border-gray-200">
                              {cust.customerTypeLabel || cust.customerType || 'Customer'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className="font-extrabold text-gray-800 px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px]">
                              {cust.totalOrders || 1}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="font-extrabold text-emerald-950">
                              ₹{formatCurrency(cust.netSales)}
                            </div>
                            {totalSalesVal > 0 && activeMetric !== 'TOTAL_SALES' && (
                              <div className="text-[10px] text-gray-400">
                                {custShare.toFixed(1)}% of total
                              </div>
                            )}
                          </td>

                          {activeMetric === 'AVG_ORDER_VALUE' ? (
                            <td className="py-2.5 px-3 text-right">
                              <div className="font-bold text-indigo-950">
                                ₹{formatCurrency(cust.averageOrderValue)}
                              </div>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                  isAboveAov
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {isAboveAov ? '▲ Above Avg' : '▼ Below Avg'}
                              </span>
                            </td>
                          ) : activeMetric === 'TOTAL_SALES' ? (
                            <td className="py-2.5 px-3 text-right">
                              <div className="font-bold text-gray-800">{custShare.toFixed(1)}%</div>
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden ml-auto mt-0.5">
                                <div
                                  className="h-full bg-emerald-600 rounded-full"
                                  style={{ width: `${Math.min(custShare, 100)}%` }}
                                />
                              </div>
                            </td>
                          ) : (
                            <td className="py-2.5 px-3 text-right text-gray-600 font-medium">
                              {formatDateDDMMYYYY(cust.lastPurchaseDate)}
                            </td>
                          )}

                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCustomer && onSelectCustomer(cust);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-[#073318] hover:bg-[#073318] hover:text-white transition-all cursor-pointer border border-emerald-200/80 inline-flex items-center gap-1"
                              title="View monthly sales breakdown"
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
            Click on any customer row to open their <span className="font-semibold text-gray-800">Monthly Sales Analysis</span>.
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

export default MetricInfoModal;
