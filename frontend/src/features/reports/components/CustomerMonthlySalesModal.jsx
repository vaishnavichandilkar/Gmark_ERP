import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  TrendingUp,
  Calendar,
  BarChart2,
  IndianRupee,
  ShoppingCart,
  Activity,
  Award,
  Sparkles,
  Layers,
  CheckCircle2,
  Package,
  Filter,
  RefreshCw,
  Search,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  Cell,
} from 'recharts';
import reportService from '../../../services/reportService';
import Loader from '../../../components/common/Loader';

const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDateKey = (d) => {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const GRANULARITIES = [
  { id: 'DAILY', label: 'Daily', singular: 'day' },
  { id: 'WEEKLY', label: 'Weekly', singular: 'week' },
  { id: 'MONTHLY', label: 'Monthly', singular: 'month' },
  { id: 'YEARLY', label: 'Yearly', singular: 'year' },
];

const CustomChartTooltip = ({ active, payload, viewMode, granularityLabel }) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-gray-900/95 text-white p-3.5 rounded-xl shadow-2xl border border-gray-700/80 text-xs backdrop-blur-md min-w-[210px] max-w-[320px] space-y-2 animate-in fade-in zoom-in-95 duration-100">
      <div className="font-bold text-gray-200 border-b border-gray-700/80 pb-1.5 flex items-center justify-between">
        <span className="text-sm font-extrabold">{item.fullName || item.name}</span>
        {item.isPeak && (
          <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
            Peak {granularityLabel || 'Period'}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Net Sales:</span>
          <span className="font-bold text-emerald-400">₹{formatCurrency(item.Amount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Orders:</span>
          <span className="font-bold text-blue-300">
            {item.Frequency} {item.Frequency === 1 ? 'order' : 'orders'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Share of Total:</span>
          <span className="font-bold text-purple-300">{item.Share}%</span>
        </div>
      </div>

      {(item.Frequency > 0 || (item.products && item.products.length > 0)) && (
        <div className="pt-2 border-t border-gray-700/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-300 font-semibold flex items-center gap-1.5">
              <Package size={13} className="text-emerald-400 shrink-0" />
              <span>Products Sold:</span>
            </span>
            {item.products && item.products.length > 0 && (
              <span className="text-[10px] text-gray-400 font-mono">
                ({item.products.length})
              </span>
            )}
          </div>
          {item.products && item.products.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto pr-0.5">
              {(item.productDetails && item.productDetails.length > 0
                ? item.productDetails.slice(0, 5)
                : item.products.slice(0, 5)
              ).map((pd, idx) => {
                const isDetail = typeof pd === 'object' && pd !== null;
                const pName = isDetail ? pd.productName : pd;
                const qty = isDetail ? pd.quantity : 0;
                const uom = isDetail ? pd.uom : '';
                return (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 px-2 py-1 rounded-md bg-gray-800/90 border border-gray-700/60 text-[11px]"
                  >
                    <span className="font-medium text-emerald-300 leading-tight break-words flex-1">
                      {pName}
                    </span>
                    {qty > 0 && (
                      <span className="text-gray-300 text-[10px] font-mono shrink-0 whitespace-nowrap bg-gray-700/70 px-1 py-0.2 rounded">
                        ×{qty} {uom || ''}
                      </span>
                    )}
                  </div>
                );
              })}
              {item.products.length > 5 && (
                <div className="text-[10px] text-emerald-300/90 font-medium italic pt-1 text-center bg-gray-800/50 rounded py-0.5 border border-dashed border-gray-700/60">
                  + {(item.products.length - 5).toLocaleString('en-IN')} more products (click row in table below)
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-400 text-[11px] italic">No product details recorded</span>
          )}
        </div>
      )}
    </div>
  );
};

// Helper to export period products to CSV (Excel compatible with UTF-8 BOM)
const exportProductsToCSV = (items, periodLabel, customerName) => {
  if (!items || items.length === 0) return;
  const headers = ['#', 'Product Name', 'Product Code', 'Quantity', 'UOM', 'Sales Amount (INR)', 'Share of Period (%)'];
  const totalAmt = items.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);

  const rows = items.map((it, idx) => {
    const amt = Number(it.totalAmount) || 0;
    const share = totalAmt > 0 ? ((amt / totalAmt) * 100).toFixed(2) : '0.00';
    return [
      idx + 1,
      `"${(it.productName || '').replace(/"/g, '""')}"`,
      `"${(it.productCode || '').replace(/"/g, '""')}"`,
      it.quantity || 0,
      `"${(it.uom || '').replace(/"/g, '""')}"`,
      amt.toFixed(2),
      share,
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  const cleanCust = (customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanPeriod = (periodLabel || 'Period').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${cleanCust}_${cleanPeriod}_Products_Sold.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Dedicated Searchable & Paginated Modal for inspecting 10 to 1000+ products
const PeriodProductsModal = ({ period, customer, granularityLabel, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('amount-desc');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Normalize items
  const allItems = useMemo(() => {
    if (!period) return [];
    if (period.productDetails && period.productDetails.length > 0) {
      return period.productDetails;
    }
    if (period.products && period.products.length > 0) {
      return period.products.map((p) => ({
        productName: p,
        productCode: '',
        quantity: 0,
        uom: '',
        totalAmount: 0,
      }));
    }
    return [];
  }, [period]);

  const totalPeriodAmount = useMemo(() => {
    return period?.salesAmount || allItems.reduce((acc, it) => acc + (Number(it.totalAmount) || 0), 0);
  }, [period, allItems]);

  const totalPeriodQty = useMemo(() => {
    return allItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [allItems]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...allItems];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          (it.productName && it.productName.toLowerCase().includes(q)) ||
          (it.productCode && it.productCode.toLowerCase().includes(q)) ||
          (it.uom && it.uom.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      const amtA = Number(a.totalAmount || 0);
      const amtB = Number(b.totalAmount || 0);
      const qtyA = Number(a.quantity || 0);
      const qtyB = Number(b.quantity || 0);
      const nameA = (a.productName || '').toLowerCase();
      const nameB = (b.productName || '').toLowerCase();

      switch (sortBy) {
        case 'amount-desc':
          return amtB !== amtA ? amtB - amtA : qtyB - qtyA;
        case 'amount-asc':
          return amtA !== amtB ? amtA - amtB : qtyA - qtyB;
        case 'qty-desc':
          return qtyB !== qtyA ? qtyB - qtyA : amtB - amtA;
        case 'qty-asc':
          return qtyA !== qtyB ? qtyA - qtyB : amtA - amtB;
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        default:
          return 0;
      }
    });

    return result;
  }, [allItems, searchQuery, sortBy]);

  // Reset page on search or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, pageSize]);

  // Pagination calculation
  const isAllPages = pageSize === 'all';
  const numPageSize = Number(pageSize) || 25;
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(filteredItems.length / numPageSize));

  const paginatedItems = useMemo(() => {
    if (isAllPages) return filteredItems;
    const start = (currentPage - 1) * numPageSize;
    return filteredItems.slice(start, start + numPageSize);
  }, [filteredItems, currentPage, isAllPages, numPageSize]);

  const handleExport = () => {
    exportProductsToCSV(
      filteredItems.length > 0 ? filteredItems : allItems,
      period?.label,
      customer?.customerName || customer?.accountName
    );
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50/80">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <Package size={20} className="text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 truncate">
                  {period?.label} • Products Sold
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {allItems.length.toLocaleString('en-IN')} products
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {customer?.customerName || customer?.accountName || 'Customer'}
                {customer?.customerCode ? ` (${customer.customerCode})` : ''} • {granularityLabel || 'Monthly'} Breakdown
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-bold text-xs transition-colors cursor-pointer shadow-2xs active:scale-95"
              title="Export all products to Excel/CSV"
            >
              <Download size={13} className="text-emerald-700" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-slate-50/70 border-b border-slate-200 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Distinct Items</span>
            <span className="text-sm font-black text-slate-900">{allItems.length.toLocaleString('en-IN')}</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Quantity</span>
            <span className="text-sm font-black text-emerald-900">{totalPeriodQty.toLocaleString('en-IN')} units</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Total Sales (₹)</span>
            <span className="text-sm font-black text-blue-950">₹{formatCurrency(totalPeriodAmount)}</span>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Sales Frequency</span>
            <span className="text-sm font-black text-purple-900">{period?.orderFrequency || 0} orders</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name or code..."
              className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Controls: Sort and Page Size */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={13} className="text-slate-600" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="py-1.5 px-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="amount-desc">Amount: High to Low</option>
                <option value="amount-asc">Amount: Low to High</option>
                <option value="qty-desc">Quantity: High to Low</option>
                <option value="qty-asc">Quantity: Low to High</option>
                <option value="name-asc">Product Name: A → Z</option>
                <option value="name-desc">Product Name: Z → A</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="py-1.5 px-2.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">All ({allItems.length})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Table View */}
        <div className="flex-1 overflow-y-auto max-h-[46vh] divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Package size={36} className="mx-auto text-slate-300" />
              <p className="font-semibold text-sm text-slate-700">No matching products found</p>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                No products in this period match &ldquo;{searchQuery}&rdquo;. Try another search keyword.
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 px-3 py-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 rounded-lg cursor-pointer border border-emerald-200"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] z-10">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-4">Product Name</th>
                  <th className="py-2.5 px-4 text-right">Quantity Sold</th>
                  <th className="py-2.5 px-4 text-right">Sales Amount (₹)</th>
                  <th className="py-2.5 px-4 text-right w-40">% of Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map((pd, index) => {
                  const itemIndex = isAllPages ? index + 1 : (currentPage - 1) * numPageSize + index + 1;
                  const amt = Number(pd.totalAmount || 0);
                  const qty = Number(pd.quantity || 0);
                  const share = totalPeriodAmount > 0 ? (amt / totalPeriodAmount) * 100 : 0;

                  return (
                    <tr key={index} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px]">
                        {itemIndex}
                      </td>
                      <td className="py-2 px-4">
                        <div className="font-bold text-slate-900 leading-tight">
                          {pd.productName}
                        </div>
                        {pd.productCode && (
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                            Code: {pd.productCode}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        {qty > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 text-[11px]">
                            {qty.toLocaleString('en-IN')} {pd.uom || ''}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right font-black text-slate-900 whitespace-nowrap text-[12px]">
                        {amt > 0 ? (
                          <span>₹{formatCurrency(amt)}</span>
                        ) : (
                          <span className="text-slate-600 font-normal">₹0.00</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full bg-emerald-600 rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 w-11 text-right text-[11px]">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            Showing{' '}
            <span className="font-bold text-slate-800">
              {filteredItems.length === 0
                ? 0
                : isAllPages
                ? 1
                : (currentPage - 1) * numPageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-bold text-slate-800">
              {isAllPages
                ? filteredItems.length
                : Math.min(filteredItems.length, currentPage * numPageSize)}
            </span>{' '}
            of <span className="font-bold text-slate-800">{filteredItems.length.toLocaleString('en-IN')}</span> products
            {filteredItems.length !== allItems.length && (
              <span className="text-slate-600"> (filtered from {allItems.length.toLocaleString('en-IN')})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isAllPages && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 py-1 font-bold text-slate-700 text-xs">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 font-bold text-slate-800 transition-colors cursor-pointer text-xs ml-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomerMonthlySalesModal = ({ customer, dateRange, filterParams, onClose }) => {
  const [granularity, setGranularity] = useState('MONTHLY'); // 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  const [viewMode, setViewMode] = useState('AMOUNT'); // 'AMOUNT' | 'FREQUENCY'
  const [showAllDaily, setShowAllDaily] = useState(false);
  const [showAllWeekly, setShowAllWeekly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPeriodForProducts, setSelectedPeriodForProducts] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedPeriodForProducts) {
          setSelectedPeriodForProducts(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedPeriodForProducts]);

  const fetchMonthlyData = useCallback(async () => {
    if (!customer?.customerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reportService.getCustomerMonthlySales(customer.customerId, {
        dateFrom: dateRange?.dateFrom,
        dateTo: dateRange?.dateTo,
        productIds: filterParams?.productIds || undefined,
        categoryIds: filterParams?.categoryIds || undefined,
        subCategoryIds: filterParams?.subCategoryIds || undefined,
        subSubCategoryIds: filterParams?.subSubCategoryIds || undefined,
      });
      setData(res);
    } catch (err) {
      console.error('Error fetching customer sales breakdown:', err);
      setError('Failed to load sales data.');
    } finally {
      setLoading(false);
    }
  }, [
    customer?.customerId,
    dateRange?.dateFrom,
    dateRange?.dateTo,
    filterParams?.productIds,
    filterParams?.categoryIds,
    filterParams?.subCategoryIds,
    filterParams?.subSubCategoryIds,
  ]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  const modalData = data?.data || data;

  // Process and normalize periods for current granularity (with full fallback if needed)
  const processedData = useMemo(() => {
    if (!modalData) return null;

    const totalAmount = Number(modalData.totalAmount || 0);
    const totalFrequency = Number(modalData.totalFrequency || 0);

    // 1. Get periods for selected granularity
    let rawPeriods = [];
    if (granularity === 'DAILY') {
      if (modalData.daily && modalData.daily.length > 0) {
        rawPeriods = modalData.daily;
      } else if (modalData.invoices && modalData.invoices.length > 0) {
        // Client-side fallback aggregation from invoices
        const dayMap = new Map();
        modalData.invoices.forEach((inv) => {
          const invDate = new Date(inv.customerInvoiceDate || inv.bookingDate);
          if (isNaN(invDate.getTime())) return;
          const key = formatDateKey(invDate);
          const amt = Number(inv.taxableAmount || inv.grandTotal || 0);
          const oKey = inv.soNumber || (inv.soId ? `SO-${inv.soId}` : inv.invoiceNumber) || `INV-${key}`;

          if (!dayMap.has(key)) {
            dayMap.set(key, {
              key,
              label: `${invDate.getDate()} ${shortMonthNames[invDate.getMonth()]} '${invDate.getFullYear().toString().slice(-2)}`,
              date: key,
              salesAmount: 0,
              orderSet: new Set(),
              products: new Set(),
              productDetails: [],
            });
          }
          const item = dayMap.get(key);
          item.salesAmount += amt;
          item.orderSet.add(oKey);
          if (inv.items && Array.isArray(inv.items)) {
            inv.items.forEach((it) => {
              if (it.productName) item.products.add(it.productName);
            });
          }
        });
        rawPeriods = Array.from(dayMap.values()).map((d) => ({
          ...d,
          orderFrequency: d.orderSet.size,
          sharePercent: totalAmount > 0 ? Math.round((d.salesAmount / totalAmount) * 1000) / 10 : 0,
          products: Array.from(d.products),
        }));
      } else if (modalData.months && modalData.months.length > 0) {
        // Fallback: If only monthly data is present in payload,
        // present the active periods from months so chart & table are never empty!
        rawPeriods = modalData.months
          .filter((m) => m.salesAmount > 0 || m.orderFrequency > 0)
          .map((m) => ({
            key: m.monthKey,
            label: m.monthLabel,
            date: m.monthKey,
            salesAmount: m.salesAmount,
            orderFrequency: m.orderFrequency,
            sharePercent: m.sharePercent,
            products: m.products || [],
            productDetails: m.productDetails || [],
          }));
      }
    } else if (granularity === 'WEEKLY') {
      if (modalData.weekly && modalData.weekly.length > 0) {
        rawPeriods = modalData.weekly;
      } else if (modalData.invoices && modalData.invoices.length > 0) {
        const weekMap = new Map();
        modalData.invoices.forEach((inv) => {
          const invDate = new Date(inv.customerInvoiceDate || inv.bookingDate);
          if (isNaN(invDate.getTime())) return;
          const dCopy = new Date(invDate.getFullYear(), invDate.getMonth(), invDate.getDate());
          const dDay = dCopy.getDay();
          const dDiff = dDay === 0 ? -6 : 1 - dDay;
          dCopy.setDate(dCopy.getDate() + dDiff);
          const key = formatDateKey(dCopy);
          const amt = Number(inv.taxableAmount || inv.grandTotal || 0);
          const oKey = inv.soNumber || (inv.soId ? `SO-${inv.soId}` : inv.invoiceNumber) || `INV-${key}`;

          if (!weekMap.has(key)) {
            const wSun = new Date(dCopy);
            wSun.setDate(dCopy.getDate() + 6);
            weekMap.set(key, {
              key,
              label: `${dCopy.getDate()} ${shortMonthNames[dCopy.getMonth()]} - ${wSun.getDate()} ${shortMonthNames[wSun.getMonth()]} '${wSun.getFullYear().toString().slice(-2)}`,
              subLabel: 'Wk',
              salesAmount: 0,
              orderSet: new Set(),
              products: new Set(),
              productDetails: [],
            });
          }
          const item = weekMap.get(key);
          item.salesAmount += amt;
          item.orderSet.add(oKey);
          if (inv.items && Array.isArray(inv.items)) {
            inv.items.forEach((it) => {
              if (it.productName) item.products.add(it.productName);
            });
          }
        });
        rawPeriods = Array.from(weekMap.values()).map((w) => ({
          ...w,
          orderFrequency: w.orderSet.size,
          sharePercent: totalAmount > 0 ? Math.round((w.salesAmount / totalAmount) * 1000) / 10 : 0,
          products: Array.from(w.products),
        }));
      } else if (modalData.months && modalData.months.length > 0) {
        rawPeriods = modalData.months
          .filter((m) => m.salesAmount > 0 || m.orderFrequency > 0)
          .map((m) => ({
            key: m.monthKey,
            label: m.monthLabel,
            subLabel: m.monthLabel,
            salesAmount: m.salesAmount,
            orderFrequency: m.orderFrequency,
            sharePercent: m.sharePercent,
            products: m.products || [],
            productDetails: m.productDetails || [],
          }));
      }
    } else if (granularity === 'YEARLY') {
      if (modalData.yearly && modalData.yearly.length > 0) {
        rawPeriods = modalData.yearly;
      } else if (modalData.months && modalData.months.length > 0) {
        // Aggregate from months
        const yMap = new Map();
        modalData.months.forEach((m) => {
          const fyYear = m.month >= 4 ? m.year : m.year - 1;
          const fyKey = `FY ${fyYear}-${(fyYear + 1).toString().slice(-2)}`;
          if (!yMap.has(fyKey)) {
            yMap.set(fyKey, {
              key: fyKey,
              label: fyKey,
              salesAmount: 0,
              orderFrequency: 0,
              products: new Set(),
              productDetails: [],
            });
          }
          const item = yMap.get(fyKey);
          item.salesAmount += m.salesAmount;
          item.orderFrequency += m.orderFrequency;
          if (m.products) m.products.forEach((p) => item.products.add(p));
        });
        rawPeriods = Array.from(yMap.values()).map((y) => ({
          ...y,
          sharePercent: totalAmount > 0 ? Math.round((y.salesAmount / totalAmount) * 1000) / 10 : 0,
          products: Array.from(y.products),
        }));
      }
    } else {
      // Default: MONTHLY
      rawPeriods = (modalData.months || []).map((m) => ({
        key: m.monthKey,
        label: m.monthLabel,
        salesAmount: m.salesAmount,
        orderFrequency: m.orderFrequency,
        sharePercent: m.sharePercent,
        products: m.products || [],
        productDetails: m.productDetails || [],
      }));
    }

    // Filter active vs all periods for table & chart
    const activePeriods = rawPeriods.filter((p) => p.salesAmount > 0 || p.orderFrequency > 0);

    let displayPeriods = rawPeriods;
    if (granularity === 'DAILY' && !showAllDaily && rawPeriods.length > 31) {
      displayPeriods = activePeriods.length > 0 ? activePeriods : rawPeriods;
    } else if (granularity === 'WEEKLY' && !showAllWeekly && rawPeriods.length > 20) {
      displayPeriods = activePeriods.length > 0 ? activePeriods : rawPeriods;
    }

    // Peak calculations for current granularity (prioritize active periods)
    let peakAmountItem = activePeriods.length > 0
      ? activePeriods[0]
      : (rawPeriods[0] || { label: 'N/A', salesAmount: 0, orderFrequency: 0, key: '' });
    let peakFrequencyItem = activePeriods.length > 0
      ? activePeriods[0]
      : (rawPeriods[0] || { label: 'N/A', salesAmount: 0, orderFrequency: 0, key: '' });

    rawPeriods.forEach((p) => {
      if ((p.salesAmount || 0) > (peakAmountItem.salesAmount || 0)) {
        peakAmountItem = p;
      }
      if ((p.orderFrequency || 0) > (peakFrequencyItem.orderFrequency || 0)) {
        peakFrequencyItem = p;
      }
    });

    // Average calculations
    const periodCount = rawPeriods.length || 1;
    const averageAmount = Math.round((totalAmount / periodCount) * 100) / 100;
    const averageFrequency = Math.round((totalFrequency / periodCount) * 10) / 10;

    return {
      rawPeriods,
      displayPeriods,
      activePeriods,
      totalPeriodsCount: rawPeriods.length,
      activePeriodsCount: activePeriods.length,
      averageAmount,
      averageFrequency,
      peakAmountItem,
      peakFrequencyItem,
    };
  }, [modalData, granularity, showAllDaily, showAllWeekly]);

  // Current granularity config
  const currentGranularityMeta = GRANULARITIES.find((g) => g.id === granularity) || GRANULARITIES[2];

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!processedData?.displayPeriods) return [];
    const peakKey =
      viewMode === 'AMOUNT'
        ? processedData.peakAmountItem?.key
        : processedData.peakFrequencyItem?.key;

    return processedData.displayPeriods.map((p) => {
      let displayName = p.label;
      if (granularity === 'MONTHLY') {
        const parts = p.label.split(' ');
        if (parts.length === 2) displayName = `${parts[0]} '${parts[1].slice(-2)}`;
      } else if (granularity === 'DAILY') {
        const parts = p.label.split(' ');
        if (parts.length >= 2) displayName = `${parts[0]} ${parts[1]}`;
      } else if (granularity === 'WEEKLY' && p.subLabel) {
        displayName = p.subLabel;
      }

      return {
        key: p.key,
        name: displayName,
        fullName: p.label,
        Amount: p.salesAmount || 0,
        Frequency: p.orderFrequency || 0,
        Share: p.sharePercent || 0,
        products: p.products || [],
        productDetails: p.productDetails || [],
        isPeak: p.key === peakKey && (p.salesAmount > 0 || p.orderFrequency > 0),
      };
    });
  }, [processedData, granularity, viewMode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-200/80 bg-gradient-to-r from-gray-50 via-white to-gray-50/80">
          {/* Customer Identity */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#073318] text-white flex items-center justify-center shadow-sm shrink-0">
              <TrendingUp size={22} className="text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                  {customer?.customerName}
                </h3>
                <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {customer?.customerCode || `CUST-${customer?.customerId}`}
                </span>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  {customer?.customerTypeLabel || 'Customer'}
                </span>
                {filterParams?.activeProductName && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-[#073318] border border-emerald-300 shrink-0">
                    <Package size={12} className="text-[#073318]" />
                    Product: {filterParams.activeProductName}
                  </span>
                )}
                {filterParams?.activeCategoryName && !filterParams?.activeProductName && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                    Category: {filterParams.activeCategoryName}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 font-medium">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span>Period:</span>
                <span className="font-semibold text-gray-800">
                  {modalData?.periodLabel || 'Selected Financial Year'}
                </span>
              </p>
            </div>
          </div>

          {/* Controls: Granularity & Metric Switcher */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* 1. Time Granularity Selector (Daily, Weekly, Monthly, Yearly) */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold border border-gray-200/80 shadow-2xs">
              {GRANULARITIES.map((g) => {
                const isActive = granularity === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGranularity(g.id)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#073318] text-white shadow-xs font-bold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>

            {/* 2. Metric Mode (Amount vs Frequency) */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold border border-gray-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('AMOUNT')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'AMOUNT'
                    ? 'bg-white text-gray-900 shadow-xs font-bold border border-gray-200/60'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Amount (₹)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('FREQUENCY')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'FREQUENCY'
                    ? 'bg-[#073318] text-white shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Frequency (Orders)
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchMonthlyData}
              disabled={loading}
              className="w-9 h-9 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer border border-gray-200/70"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-600' : ''} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader />
              <p className="text-xs text-gray-400 mt-2 font-medium">Loading sales analytics...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50 rounded-xl border border-red-200">
              {error}
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Total Sales */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/70 via-blue-50/40 to-white border border-blue-100 shadow-2xs">
                  <div className="flex items-center justify-between text-blue-700 mb-1.5">
                    <span className="text-[11px] font-bold text-blue-900/70 uppercase tracking-wider">
                      Total Sales (Period)
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <IndianRupee size={15} />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight">
                    ₹{formatCurrency(modalData?.totalAmount)}
                  </div>
                  <span className="text-[11px] font-medium text-blue-700/80 mt-0.5 block">
                    Reconciled Net Sales
                  </span>
                </div>

                {/* 2. Total Orders */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/70 via-emerald-50/40 to-white border border-emerald-100 shadow-2xs">
                  <div className="flex items-center justify-between text-emerald-700 mb-1.5">
                    <span className="text-[11px] font-bold text-emerald-900/70 uppercase tracking-wider">
                      Total Orders
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <ShoppingCart size={15} />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight">
                    {modalData?.totalFrequency || 0}
                  </div>
                  <span className="text-[11px] font-medium text-emerald-700/80 mt-0.5 block">
                    Distinct qualifying orders
                  </span>
                </div>

                {/* 3. Granular Average */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/70 via-indigo-50/40 to-white border border-indigo-100 shadow-2xs">
                  <div className="flex items-center justify-between text-indigo-700 mb-1.5">
                    <span className="text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">
                      {currentGranularityMeta.label} Average
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Activity size={15} />
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
                    {viewMode === 'AMOUNT'
                      ? `₹${formatCurrency(processedData?.averageAmount)}`
                      : `${processedData?.averageFrequency || 0} orders`}
                  </div>
                  <span className="text-[11px] font-medium text-indigo-700/80 mt-0.5 block">
                    Across {processedData?.totalPeriodsCount}{' '}
                    {processedData?.totalPeriodsCount === 1
                      ? currentGranularityMeta.singular
                      : `${currentGranularityMeta.singular}s`}
                    {granularity === 'DAILY' || granularity === 'WEEKLY'
                      ? ` (${processedData?.activePeriodsCount} active)`
                      : ''}
                  </span>
                </div>

                {/* 4. Peak Performance */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50/70 via-amber-50/40 to-white border border-amber-100 shadow-2xs">
                  <div className="flex items-center justify-between text-amber-700 mb-1.5">
                    <span className="text-[11px] font-bold text-amber-900/70 uppercase tracking-wider">
                      Peak Performance
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Award size={15} />
                    </div>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-amber-950 truncate tracking-tight">
                    {viewMode === 'AMOUNT'
                      ? (processedData?.peakAmountItem?.salesAmount > 0 ? processedData.peakAmountItem.label : 'N/A')
                      : (processedData?.peakFrequencyItem?.orderFrequency > 0 ? processedData.peakFrequencyItem.label : 'N/A')}
                  </div>
                  <span className="text-[11px] font-semibold text-amber-800 mt-0.5 block truncate">
                    {viewMode === 'AMOUNT'
                      ? (processedData?.peakAmountItem?.salesAmount > 0
                          ? `₹${formatCurrency(processedData.peakAmountItem.salesAmount)}`
                          : 'No sales in period')
                      : (processedData?.peakFrequencyItem?.orderFrequency > 0
                          ? `Highest active ${currentGranularityMeta.singular} (${processedData.peakFrequencyItem.orderFrequency} orders)`
                          : 'No orders in period')}
                  </span>
                </div>
              </div>

              {/* Trend Chart (Standardized on Bar Chart) */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        viewMode === 'AMOUNT'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      <BarChart2 size={17} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 leading-tight">
                        {currentGranularityMeta.label}{' '}
                        {viewMode === 'AMOUNT' ? 'Sales Revenue' : 'Order Frequency'} Breakdown
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {viewMode === 'AMOUNT'
                          ? 'Values in Indian Rupees (₹)'
                          : 'Count of Distinct Qualifying Orders'}
                        {chartData.length === 1 && (
                          <span className="ml-1.5 font-semibold text-blue-600">
                            • Single active {currentGranularityMeta.singular} ({chartData[0]?.name})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-gray-400">
                    {chartData.length} {currentGranularityMeta.singular}{chartData.length === 1 ? '' : 's'} displayed
                  </span>
                </div>

                <div className="h-[270px] w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                      <BarChart2 size={36} className="text-gray-300 stroke-1" />
                      <p className="text-xs font-medium">No sales data recorded for the selected period</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 18, right: 15, left: 10, bottom: 8 }}
                      >
                        <defs>
                          <linearGradient id="modalBarGradientAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.88} />
                          </linearGradient>
                          <linearGradient id="modalBarGradientAmountPeak" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity={1} />
                            <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0.95} />
                          </linearGradient>
                          <linearGradient id="modalBarGradientFrequency" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.88} />
                          </linearGradient>
                          <linearGradient id="modalBarGradientFrequencyPeak" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity={1} />
                            <stop offset="100%" stopColor="#064E3B" stopOpacity={0.95} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="name"
                          axisLine={{ stroke: '#E2E8F0' }}
                          tickLine={false}
                          interval={chartData.length > 25 ? 'preserveStartEnd' : 0}
                          tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                          dy={6}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
                          allowDecimals={viewMode === 'AMOUNT'}
                          domain={[
                            0,
                            (dataMax) => {
                              if (dataMax <= 0) return viewMode === 'AMOUNT' ? 100 : 5;
                              return viewMode === 'AMOUNT'
                                ? Math.ceil(dataMax * 1.25)
                                : Math.max(dataMax + 1, Math.ceil(dataMax * 1.25));
                            },
                          ]}
                          tickFormatter={(val) => {
                            if (viewMode === 'FREQUENCY') return val;
                            if (val === 0) return '₹0';
                            if (val >= 100000) return `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)}L`;
                            if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                            return `₹${val}`;
                          }}
                          dx={-4}
                        />
                        <Tooltip
                          content={
                            <CustomChartTooltip
                              viewMode={viewMode}
                              granularityLabel={currentGranularityMeta.singular}
                            />
                          }
                        />
                        <Bar
                          dataKey={viewMode === 'AMOUNT' ? 'Amount' : 'Frequency'}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={chartData.length === 1 ? 56 : (chartData.length > 25 ? 18 : 36)}
                          name={viewMode === 'AMOUNT' ? 'Sales Amount' : 'Order Frequency'}
                        >
                          {chartData.length <= 15 && (
                            <LabelList
                              dataKey={viewMode === 'AMOUNT' ? 'Amount' : 'Frequency'}
                              position="top"
                              offset={8}
                              formatter={(val) => {
                                if (!val || val <= 0) return '';
                                if (viewMode === 'AMOUNT') {
                                  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                                  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                                  return `₹${val}`;
                                }
                                return val;
                              }}
                              style={{
                                fill: viewMode === 'AMOUNT' ? '#1D4ED8' : '#047857',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            />
                          )}
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                viewMode === 'AMOUNT'
                                  ? (entry.isPeak
                                      ? 'url(#modalBarGradientAmountPeak)'
                                      : 'url(#modalBarGradientAmount)')
                                  : (entry.isPeak
                                      ? 'url(#modalBarGradientFrequencyPeak)'
                                      : 'url(#modalBarGradientFrequency)')
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Granular Breakdown Table */}
              <div className="border border-gray-200/90 rounded-2xl overflow-hidden shadow-2xs bg-white">
                {/* Table Header Controls (e.g., Active vs All toggle for Daily/Weekly) */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">
                      {currentGranularityMeta.label} Breakdown
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500 font-medium">
                      Showing {processedData?.displayPeriods.length} of {processedData?.totalPeriodsCount}{' '}
                      {currentGranularityMeta.singular}s
                    </span>
                  </div>

                  {granularity === 'DAILY' && processedData?.totalPeriodsCount > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDaily(!showAllDaily)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Filter size={12} className="text-gray-500" />
                      <span>
                        {showAllDaily
                          ? `Active Days Only (${processedData.activePeriodsCount})`
                          : `Show All Days (${processedData.totalPeriodsCount})`}
                      </span>
                    </button>
                  )}

                  {granularity === 'WEEKLY' && processedData?.totalPeriodsCount > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllWeekly(!showAllWeekly)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Filter size={12} className="text-gray-500" />
                      <span>
                        {showAllWeekly
                          ? `Active Weeks Only (${processedData.activePeriodsCount})`
                          : `Show All Weeks (${processedData.totalPeriodsCount})`}
                      </span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">
                          {granularity === 'DAILY'
                            ? 'Date'
                            : granularity === 'WEEKLY'
                            ? 'Week Period'
                            : granularity === 'YEARLY'
                            ? 'Financial Year'
                            : 'Month'}
                        </th>
                        <th className="py-3 px-4">Products Sold</th>
                        <th className="py-3 px-4 text-right">Sales Amount (₹)</th>
                        <th className="py-3 px-4 text-right">Sales Frequency</th>
                        <th className="py-3 px-4 text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {processedData?.displayPeriods.map((period) => {
                        const isPeak =
                          viewMode === 'AMOUNT'
                            ? period.key === processedData?.peakAmountItem?.key && period.salesAmount > 0
                            : period.key === processedData?.peakFrequencyItem?.key && period.orderFrequency > 0;

                        return (
                          <tr
                            key={period.key}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isPeak ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    period.salesAmount > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`}
                                ></span>
                                <span>{period.label}</span>
                                {isPeak && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    <Sparkles size={10} />
                                    Peak
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              {(() => {
                                const details = period.productDetails || [];
                                const prods = period.products || [];
                                const hasDetails = details.length > 0;
                                const totalCount = hasDetails ? details.length : prods.length;
                                if (totalCount === 0) {
                                  return <span className="text-slate-300 font-normal">—</span>;
                                }

                                const MAX_PREVIEW = 2;
                                const previewItems = hasDetails
                                  ? details.slice(0, MAX_PREVIEW)
                                  : prods.slice(0, MAX_PREVIEW).map((p) => ({ productName: p }));
                                const remainingCount = totalCount - MAX_PREVIEW;

                                return (
                                  <div className="flex flex-wrap items-center gap-1.5 max-w-[340px]">
                                    {previewItems.map((pd, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50/80 text-emerald-900 border border-emerald-200/90 shadow-2xs hover:bg-emerald-100/70 transition-colors"
                                        title={`${pd.productName}${pd.quantity ? ` (${pd.quantity} ${pd.uom || ''})` : ''}`}
                                      >
                                        <span className="truncate max-w-[130px] font-semibold">
                                          {pd.productName}
                                        </span>
                                        {pd.quantity > 0 && (
                                          <span className="text-[10px] font-bold text-emerald-700 bg-white/90 px-1 py-0.2 rounded border border-emerald-200/70">
                                            {pd.quantity} {pd.uom || ''}
                                          </span>
                                        )}
                                      </span>
                                    ))}

                                    {remainingCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPeriodForProducts(period)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100/90 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 hover:border-emerald-400 transition-all cursor-pointer shadow-2xs group active:scale-95 shrink-0"
                                        title={`View all ${totalCount.toLocaleString('en-IN')} products sold in ${period.label}`}
                                      >
                                        <span>+{remainingCount.toLocaleString('en-IN')} more</span>
                                        <ChevronRight size={11} className="text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
                                      </button>
                                    )}

                                    {totalCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPeriodForProducts(period)}
                                        className="text-[10px] text-emerald-700 hover:text-emerald-900 hover:underline font-semibold ml-0.5 cursor-pointer"
                                        title={`View full product breakdown for ${period.label}`}
                                      >
                                        View all
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                              {period.salesAmount > 0 ? (
                                <span className="text-emerald-950 font-black">
                                  ₹{formatCurrency(period.salesAmount)}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">₹0.00</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-slate-700 whitespace-nowrap">
                              {period.orderFrequency > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                                  {period.orderFrequency}{' '}
                                  {period.orderFrequency === 1 ? 'order' : 'orders'}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2.5">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      period.sharePercent > 0
                                        ? isPeak
                                          ? 'bg-amber-500'
                                          : 'bg-[#073318]'
                                        : 'bg-transparent'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, period.sharePercent))}%`,
                                    }}
                                  />
                                </div>
                                <span className="font-bold text-slate-700 w-11 text-right">
                                  {period.sharePercent}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300 text-slate-900">
                        <td className="py-3 px-4 font-black uppercase tracking-wider text-xs">
                          TOTAL (RECONCILED)
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-normal text-xs">—</td>
                        <td className="py-3 px-4 text-right text-blue-950 font-black text-sm whitespace-nowrap">
                          ₹{formatCurrency(modalData?.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-950 font-black text-sm whitespace-nowrap">
                          {modalData?.totalFrequency || 0} Orders
                        </td>
                        <td className="py-3 px-4 text-right font-black text-xs text-slate-700 whitespace-nowrap">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200/80 bg-gray-50/80 flex items-center justify-between text-xs text-gray-500">
          <span>
            {granularity === 'DAILY'
              ? '* Daily frequency of sales reflects qualifying transactions grouped by calendar date.'
              : granularity === 'WEEKLY'
              ? '* Weekly frequency of sales groups transactions by 7-day Monday–Sunday periods.'
              : granularity === 'YEARLY'
              ? '* Yearly frequency reflects financial year totals.'
              : '* Months with no sales transactions are zero-filled to maintain full financial year fidelity.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Sub-modal for detailed products breakdown when +N more or View all is clicked */}
      {selectedPeriodForProducts && (
        <PeriodProductsModal
          period={selectedPeriodForProducts}
          customer={customer}
          granularityLabel={
            granularity === 'DAILY'
              ? 'Daily'
              : granularity === 'WEEKLY'
              ? 'Weekly'
              : granularity === 'YEARLY'
              ? 'Yearly'
              : 'Monthly'
          }
          onClose={() => setSelectedPeriodForProducts(null)}
        />
      )}
    </div>
  );
};

export default CustomerMonthlySalesModal;
