import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Filter,
  Check,
  CheckSquare,
  Square,
  Calendar,
  RotateCcw,
  Eye,
  AlertTriangle,
  Building2,
  Clock,
  SlidersHorizontal,
  X,
  FileCheck,
  IndianRupee,
  CheckCircle2,
} from 'lucide-react';
import Card, { CardContent } from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import reportService from '../../../services/reportService';
import { CustomDateSelect, toLocalISOString } from './CustomDateSelect';
import OutstandingMetricModal from './OutstandingMetricModal';
import CustomerInvoicesModal from './CustomerInvoicesModal';
import {
  exportSalesOutstandingSummaryToExcel,
  exportSalesOutstandingAgingToExcel,
  exportSalesOutstandingToPDF,
} from '../utils/salesOutstandingExport';
import { toast } from 'react-hot-toast';

// Format number with Indian commas and 2 decimals
const formatCurrency = (val) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Format whole number or 2 decimal places
const formatAmountClean = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

// Format for Screenshot 2 Aging Matrix cell (leave BLANK if 0.00!)
const formatAgingCell = (val) => {
  const num = Number(val || 0);
  if (Math.abs(num) < 0.001) return '';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Formats "2026-09-30" to "30-Sep-2026"
const formatDateDDMMMYYYY = (dStr) => {
  if (!dStr) return '';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Formats date to "30/09/2026"
const formatDateDDMMYYYY = (dStr) => {
  if (!dStr) return '—';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

// Full date header for print preview (e.g. "Saturday, October 24, 2026")
const formatFullHeaderDate = (d = new Date()) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};



// MultiSelectDropdown component matching CustomerSalesReportView UI design
const MultiSelectDropdown = ({
  options = [],
  selectedIds = [],
  onChange,
  placeholder = 'Select options',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((opt) => {
      const name = String(opt.label || opt.name || '').toLowerCase();
      const code = String(opt.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [options, search]);

  const handleToggle = (id) => {
    const strId = String(id);
    if (selectedSet.has(strId)) {
      onChange(selectedIds.filter((x) => String(x) !== strId));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredOptions.map((opt) => opt.id);
    const combined = Array.from(new Set([...selectedIds, ...allFilteredIds]));
    onChange(combined);
  };

  const handleDeselectAll = () => {
    if (search.trim()) {
      const filteredIdSet = new Set(filteredOptions.map((o) => String(o.id)));
      onChange(selectedIds.filter((id) => !filteredIdSet.has(String(id))));
    } else {
      onChange([]);
    }
  };

  const displayLabel = useMemo(() => {
    if (selectedIds.length === 0) return placeholder;
    if (selectedIds.length === 1) {
      const item = options.find((opt) => String(opt.id) === String(selectedIds[0]));
      return item ? `${item.label || item.name}${item.code ? ` (${item.code})` : ''}` : '1 selected';
    }
    const firstItem = options.find((opt) => String(opt.id) === String(selectedIds[0]));
    const firstName = firstItem ? firstItem.label || firstItem.name : 'Item';
    return `${firstName} +${selectedIds.length - 1} more`;
  }, [selectedIds, options, placeholder]);

  return (
    <div className={`relative ${isOpen ? 'z-50' : 'z-10'}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        title={selectedIds.length > 0 ? displayLabel : undefined}
        className={`w-full h-[38px] px-3 text-xs border rounded-xl bg-white flex items-center justify-between shadow-2xs transition-all cursor-pointer ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
            : isOpen
            ? 'border-[#004f3b] ring-2 ring-[#004f3b]/10'
            : selectedIds.length > 0
            ? 'border-[#004f3b] bg-emerald-50/20'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          <span
            className={`truncate ${
              selectedIds.length > 0 ? 'font-bold text-slate-900' : 'text-gray-500'
            }`}
          >
            {displayLabel}
          </span>
          {selectedIds.length > 1 && (
            <span className="shrink-0 text-[10px] font-black bg-[#004f3b] text-white px-1.5 py-0.2 rounded-full">
              {selectedIds.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[220px] max-w-[320px] bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#004f3b]"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 text-[11px] font-semibold text-gray-600 px-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[#004f3b] hover:underline cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-red-600 hover:underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">No matches found</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedSet.has(String(opt.id));
                return (
                  <div
                    key={String(opt.id)}
                    onClick={() => handleToggle(opt.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-50 text-[#004f3b] font-bold' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#004f3b] border-[#004f3b] text-white' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check size={10} strokeWidth={3} />}
                    </div>
                    <span className="truncate flex-1">{opt.label || opt.name}</span>
                    {opt.code && (
                      <span className="text-[10px] text-gray-400 font-mono shrink-0">
                        {opt.code}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};


const SalesOutstandingReportView = () => {
  // Navigation State
  // 'SUMMARY' = View 1 (Sales Outstanding Invoice Wise - Screenshot 1)
  // 'AGING' = View 2 (Customer Outstanding Aging Print Preview - Screenshot 2)
  // 'ACCOUNT_INVOICES' = View 3 (Account Invoice Breakdown with Back to Selection - Screenshot 3)
  const [viewMode, setViewMode] = useState('SUMMARY');
  const [previousViewMode, setPreviousViewMode] = useState('SUMMARY');
  const [drilldownAccount, setDrilldownAccount] = useState(null);
  const [drilldownMetric, setDrilldownMetric] = useState(null);
  const [drilldownTitle, setDrilldownTitle] = useState('');

  // Outstanding Metric Modal State (for popup info on summary cards)
  const [activeOutstandingModal, setActiveOutstandingModal] = useState(null);

  // Customer Invoices Modal State (for popup info on customer rows)
  const [selectedCustomerModal, setSelectedCustomerModal] = useState(null);

  // Drilldown View Filters & Slabs State
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceActiveSlab, setInvoiceActiveSlab] = useState('ALL');
  const [invoiceSortField, setInvoiceSortField] = useState('invoiceDate');
  const [invoiceSortDir, setInvoiceSortDir] = useState('desc');
  const [invoiceActiveMetric, setInvoiceActiveMetric] = useState('ALL');

  // Parameters & As On Date
  const [asOnDate, setAsOnDate] = useState(() => toLocalISOString(new Date()));
  const [companyName, setCompanyName] = useState('A G CORPORATION');

  // The 4 intuitive threshold inputs from Screenshot 1:
  // "Days Below: [ 30 ] Days To [ 45 ] Days To [ 60 ] Days To [ 90 ] Days Above"
  const [thresholds, setThresholds] = useState({
    d1: 30, // Days Below
    d2: 45, // Days To (Slab 1 upper bound)
    d3: 60, // Days To (Slab 2 upper bound)
    d4: 90, // Days To / Above (Slab 3 upper bound & Above lower bound)
  });

  // Search & Filters (Matching CustomerSalesReportView UI design)
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCustomerFilterIds, setSelectedCustomerFilterIds] = useState([]); // Specific Customer multi-select
  const [selectedTypes, setSelectedTypes] = useState([]); // Customer Type multi-select
  const [msmeFilter, setMsmeFilter] = useState('ALL'); // 'ALL' | 'MSME' | 'NON_MSME'
  const [selectedRegTypes, setSelectedRegTypes] = useState([]); // Registration Type multi-select
  const [balanceFilter, setBalanceFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'ZERO'
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [activeMetricFilter, setActiveMetricFilter] = useState('ALL'); // 'ALL' | 'INVOICED' | 'PAID' | 'OUTSTANDING' | 'OVERDUE_90'

  // Data & Selection State
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [accountGroups, setAccountGroups] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState(new Set());

  // Dropdown States
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Derive dynamic slab boundaries from the 4 thresholds
  const slabs = useMemo(() => {
    const d1 = Number(thresholds.d1) > 0 ? Number(thresholds.d1) : 30;
    const d2 = Number(thresholds.d2) > d1 ? Number(thresholds.d2) : d1 + 15;
    const d3 = Number(thresholds.d3) > d2 ? Number(thresholds.d3) : d2 + 15;
    const d4 = Number(thresholds.d4) > d3 ? Number(thresholds.d4) : d3 + 30;

    return {
      belowDays: d1,
      slab1Min: d1,
      slab1Max: d2 - 1,
      slab2Min: d2,
      slab2Max: d3 - 1,
      slab3Min: d3,
      slab3Max: d4 - 1,
      aboveDays: d4,
    };
  }, [thresholds]);

  // Labels for the 5 Aging Columns (matching Screenshot 2: "< 30 days", "30 to 44 days", etc.)
  const slabLabels = useMemo(() => {
    return {
      below: `< ${slabs.belowDays} days`,
      slab1: `${slabs.slab1Min} to ${slabs.slab1Max} days`,
      slab2: `${slabs.slab2Min} to ${slabs.slab2Max} days`,
      slab3: `${slabs.slab3Min} to ${slabs.slab3Max} days`,
      above: `≥ ${slabs.aboveDays} days`,
    };
  }, [slabs]);

  // Handle threshold inputs change
  const handleThresholdChange = (key, val) => {
    const parsed = parseInt(val, 10);
    setThresholds((prev) => ({
      ...prev,
      [key]: isNaN(parsed) ? '' : Math.max(1, parsed),
    }));
  };

  // Fetch report data from backend API
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        asOnDate,
        belowDays: slabs.belowDays,
        slab1Min: slabs.slab1Min,
        slab1Max: slabs.slab1Max,
        slab2Min: slabs.slab2Min,
        slab2Max: slabs.slab2Max,
        slab3Min: slabs.slab3Min,
        slab3Max: slabs.slab3Max,
        aboveDays: slabs.aboveDays,
      };

      const res = await reportService.getSalesOutstandingReport(params);
      if (res && res.data) {
        setReportData(res.data);
        if (res.companyName) {
          setCompanyName(res.companyName);
        }
        if (res.accountGroups && res.accountGroups.length > 0) {
          setAccountGroups(res.accountGroups);
        }
        // Initialize accounts with invoices as selected by default
        const invoiceAccounts = res.data.filter(
          (item) => (item.invoicesCount > 0 || (item.invoices && item.invoices.length > 0))
        );
        const initialSelected = (invoiceAccounts.length > 0 ? invoiceAccounts : res.data).map(
          (item) => item.accountId
        );
        setSelectedAccountIds(new Set(initialSelected));
      }
    } catch (err) {
      console.error('Failed to load Sales Outstanding Report:', err);
      toast.error('Failed to load Sales Outstanding data');
    } finally {
      setLoading(false);
    }
  }, [asOnDate, slabs]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Dynamic recalculation of aging per account based on slabs and asOnDate
  const processedData = useMemo(() => {
    const parsedDate = asOnDate ? new Date(asOnDate) : new Date();
    const asOnTime = !isNaN(parsedDate.getTime())
      ? parsedDate.setHours(23, 59, 59, 999)
      : new Date().setHours(23, 59, 59, 999);

    return reportData.map((cust) => {
      let belowDaysAmt = 0;
      let slab1Amt = 0;
      let slab2Amt = 0;
      let slab3Amt = 0;
      let aboveDaysAmt = 0;
      let totalInvAmt = 0;
      let totalPaidAmt = Number(cust.paidAmount || 0);

      const updatedInvoices = (cust.invoices || []).map((inv) => {
        const invDateObj = new Date(inv.invoiceDate);
        const creditDays = Number(inv.creditDays || 0);
        const dueDateObj = new Date(invDateObj);
        dueDateObj.setDate(dueDateObj.getDate() + creditDays);

        const diffTime = asOnTime - dueDateObj.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        const invTotal = Number(inv.grandTotal || 0);
        const paid = Number(inv.paidAmount || 0);
        const outstanding = invTotal - paid;

        let agingBucket = '';
        if (daysOverdue < slabs.belowDays) {
          agingBucket = `< ${slabs.belowDays} days`;
          belowDaysAmt += outstanding;
        } else if (daysOverdue >= slabs.slab1Min && daysOverdue <= slabs.slab1Max) {
          agingBucket = `${slabs.slab1Min} to ${slabs.slab1Max} days`;
          slab1Amt += outstanding;
        } else if (daysOverdue >= slabs.slab2Min && daysOverdue <= slabs.slab2Max) {
          agingBucket = `${slabs.slab2Min} to ${slabs.slab2Max} days`;
          slab2Amt += outstanding;
        } else if (daysOverdue >= slabs.slab3Min && daysOverdue <= slabs.slab3Max) {
          agingBucket = `${slabs.slab3Min} to ${slabs.slab3Max} days`;
          slab3Amt += outstanding;
        } else {
          agingBucket = `≥ ${slabs.aboveDays} days`;
          aboveDaysAmt += outstanding;
        }

        totalInvAmt += invTotal;

        return {
          ...inv,
          dueDate: dueDateObj.toISOString().split('T')[0],
          daysOverdue,
          agingBucket,
          outstandingAmount: Number(outstanding.toFixed(2)),
        };
      });

      // Customer Net Outstanding = Invoiced - Paid (Can be negative!)
      const totalOutstandingAmt = Number((totalInvAmt - totalPaidAmt).toFixed(2));

      // Reconcile aging buckets so their sum equals totalOutstandingAmt exactly
      const currentAgingSum = belowDaysAmt + slab1Amt + slab2Amt + slab3Amt + aboveDaysAmt;
      const diff = totalOutstandingAmt - currentAgingSum;
      if (Math.abs(diff) > 0.001) {
        aboveDaysAmt += diff;
      }

      return {
        ...cust,
        invoiceAmount: Number(totalInvAmt.toFixed(2)),
        paidAmount: Number(totalPaidAmt.toFixed(2)),
        outstandingAmount: totalOutstandingAmt,
        belowDaysAmount: Number(belowDaysAmt.toFixed(2)),
        slab1Amount: Number(slab1Amt.toFixed(2)),
        slab2Amount: Number(slab2Amt.toFixed(2)),
        slab3Amount: Number(slab3Amt.toFixed(2)),
        aboveDaysAmount: Number(aboveDaysAmt.toFixed(2)),
        totalAgingOutstanding: totalOutstandingAmt,
        invoices: updatedInvoices,
      };
    });
  }, [reportData, asOnDate, slabs]);

  // Specific Customer options for MultiSelectDropdown
  const customerOptions = useMemo(() => {
    return reportData
      .filter((cust) => {
        const groupArr = Array.isArray(cust.groupName) ? cust.groupName : [];
        if (groupArr.some((g) => ['Bank & Cash', 'BANK', 'Cash'].includes(g))) {
          return false;
        }
        if (groupArr.includes('SUNDRY_CREDITORS') && !groupArr.includes('SUNDRY_DEBTORS')) {
          return false;
        }
        return true;
      })
      .map((cust) => ({
        id: cust.accountId,
        label: cust.displayName || cust.accountName,
        code: cust.customerCode,
      }));
  }, [reportData]);

  // Customer Type options for MultiSelectDropdown (Matching AddAccount.jsx: Industrial, Institutional, Dealer, Retailer)
  const customerTypeOptions = useMemo(() => {
    return [
      { id: 'industrial', label: 'Industrial' },
      { id: 'institutional', label: 'Institutional' },
      { id: 'dealer', label: 'Dealer' },
      { id: 'retailer', label: 'Retailer' },
    ];
  }, []);

  // Registration Type options for MultiSelectDropdown
  const regTypeOptions = useMemo(() => {
    const defaultTypes = ['Manufacturing', 'Service', 'Trading'];
    const dynamicSet = new Set(defaultTypes);
    (reportData || []).forEach((a) => {
      const val = (a.regType || '').trim();
      if (val && val !== '—' && val !== '-') {
        dynamicSet.add(val);
      }
    });

    return Array.from(dynamicSet).map((t) => ({ id: t, label: t }));
  }, [reportData]);

  // Active filters count for badge display
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCustomerFilterIds.length > 0) count += selectedCustomerFilterIds.length;
    if (selectedTypes.length > 0) count += selectedTypes.length;
    if (msmeFilter !== 'ALL') count++;
    if (selectedRegTypes.length > 0) count += selectedRegTypes.length;
    if (balanceFilter !== 'ALL') count++;
    if (minAmount || maxAmount) count++;
    if (activeMetricFilter !== 'ALL') count++;
    return count;
  }, [
    selectedCustomerFilterIds,
    selectedTypes,
    msmeFilter,
    selectedRegTypes,
    balanceFilter,
    minAmount,
    maxAmount,
    activeMetricFilter,
  ]);

  // Filter accounts by search query, filters, and active metric card
  const filteredData = useMemo(() => {
    return processedData.filter((cust) => {
      // 1. "only invoice not groups" - filter out accounts that have no sales invoices
      const hasInvoices = Array.isArray(cust.invoices) && cust.invoices.length > 0;
      const hasAmount = Math.abs(Number(cust.invoiceAmount || 0)) > 0.001 || Math.abs(Number(cust.outstandingAmount || 0)) > 0.001;
      if (!hasInvoices && !hasAmount) {
        return false;
      }

      // 2. Metric Card Quick Filter
      if (activeMetricFilter === 'INVOICED' && Number(cust.invoiceAmount || 0) <= 0.001) return false;
      if (activeMetricFilter === 'PAID' && Number(cust.paidAmount || 0) <= 0.001) return false;
      if (activeMetricFilter === 'OUTSTANDING' && Number(cust.outstandingAmount || 0) <= 0.001) return false;
      if (activeMetricFilter === 'OVERDUE_90' && Number(cust.aboveDaysAmount || 0) <= 0.001) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = (cust.accountName || '').toLowerCase().includes(q);
        const matchesCode = (cust.customerCode || '').toLowerCase().includes(q);
        const matchesDisplay = (cust.displayName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDisplay) return false;
      }

      // 4. Specific Customer Multi-select
      if (selectedCustomerFilterIds.length > 0) {
        const match = selectedCustomerFilterIds.some((id) => String(id) === String(cust.accountId));
        if (!match) return false;
      }

      // 5. Customer Type Multi-select
      if (selectedTypes.length > 0) {
        const cType = String(cust.customerType || '').toLowerCase();
        if (!selectedTypes.includes(cType)) return false;
      }

      // 6. Balance Filter
      if (balanceFilter === 'PENDING' && Number(cust.outstandingAmount || 0) <= 0.001) return false;
      if (balanceFilter === 'ZERO' && Math.abs(Number(cust.outstandingAmount || 0)) > 0.001) return false;

      // 7. Amount Range (₹)
      const outstanding = Number(cust.outstandingAmount || 0);
      if (minAmount && !isNaN(Number(minAmount))) {
        if (outstanding < Number(minAmount)) return false;
      }
      if (maxAmount && !isNaN(Number(maxAmount))) {
        if (outstanding > Number(maxAmount)) return false;
      }

      // 8. MSME Filter
      if (msmeFilter === 'MSME' && !cust.msmeEnabled) return false;
      if (msmeFilter === 'NON_MSME' && cust.msmeEnabled) return false;

      // 9. Registration Type Filter
      if (selectedRegTypes.length > 0) {
        const custReg = (cust.regType || '').trim();
        const match = selectedRegTypes.some(
          (selected) => custReg.toLowerCase() === selected.toLowerCase()
        );
        if (!match) return false;
      }

      return true;
    });
  }, [
    processedData,
    searchQuery,
    selectedCustomerFilterIds,
    selectedTypes,
    msmeFilter,
    selectedRegTypes,
    balanceFilter,
    minAmount,
    maxAmount,
    activeMetricFilter,
  ]);

  // Accounts for View 2 (Aging Matrix / Print Preview):
  // Shows all accounts selected in View 1
  const agingViewAccounts = useMemo(() => {
    return filteredData.filter((cust) => selectedAccountIds.has(cust.accountId));
  }, [filteredData, selectedAccountIds]);

  // Metric totals for View 1 Summary (calculated from base accounts)
  const summaryMetrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let accountsPending = 0;
    let overdueAbove90 = 0;

    const baseList = processedData.filter((cust) => {
      const hasInvoices = Array.isArray(cust.invoices) && cust.invoices.length > 0;
      const hasAmount = Math.abs(Number(cust.invoiceAmount || 0)) > 0.001 || Math.abs(Number(cust.outstandingAmount || 0)) > 0.001;
      return hasInvoices || hasAmount;
    });

    baseList.forEach((item) => {
      totalInvoiced += Number(item.invoiceAmount || 0);
      totalPaid += Number(item.paidAmount || 0);
      totalOutstanding += Number(item.outstandingAmount || 0);
      if (Number(item.outstandingAmount) > 0.001) {
        accountsPending += 1;
      }
      overdueAbove90 += Number(item.aboveDaysAmount || 0);
    });

    return {
      totalAccounts: baseList.length,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      accountsPending,
      overdueAbove90,
    };
  }, [processedData]);

  // Dynamic table totals summing currently visible rows
  const filteredTableTotals = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    filteredData.forEach((item) => {
      totalInvoiced += Number(item.invoiceAmount || 0);
      totalPaid += Number(item.paidAmount || 0);
      totalOutstanding += Number(item.outstandingAmount || 0);
    });

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
    };
  }, [filteredData]);

  // Handler for clicking summary metric cards -> Opens Invoices Drill-down View
  const handleMetricCardClick = (filterKey, label) => {
    setDrilldownAccount(null);
    setDrilldownMetric(filterKey);
    setDrilldownTitle(label);
    setPreviousViewMode('SUMMARY');
    setViewMode('ACCOUNT_INVOICES');
    setInvoiceSearchQuery('');
    setInvoiceActiveSlab('ALL');
    setInvoiceActiveMetric(filterKey);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render Metric Card Helper matching Screenshot 1 (Dashboard Design System)
  const renderSummaryCard = ({
    title,
    value,
    icon: IconComponent,
    formatAsCurrency = false,
    gradient = 'from-blue-50 to-blue-100/50',
    border = 'border-blue-100',
    iconBg = 'bg-blue-500/20',
    iconColor = 'text-blue-700',
    titleColor = 'text-blue-800/70',
    valueColor = 'text-blue-900',
    isActive = false,
    activeRing = 'ring-blue-500',
    onClick,
  }) => {
    return (
      <Card
        className={`bg-gradient-to-br ${gradient} ${border} shadow-2xs hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer group relative overflow-hidden select-none active:scale-[0.98] ${
          isActive && activeMetricFilter !== 'ALL'
            ? `ring-2 ring-offset-2 ${activeRing} shadow-md scale-[1.02]`
            : 'hover:-translate-y-0.5'
        }`}
        onClick={onClick}
        title={`Click to filter by ${title}`}
      >
        {isActive && activeMetricFilter !== 'ALL' && (
          <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-white/95 px-2 py-0.5 rounded-full shadow-2xs border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>Active</span>
          </div>
        )}
        <CardContent className="p-3.5 sm:p-4 flex items-center gap-3 h-full">
          {/* Symbol First (on Left) */}
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full ${iconBg} ${iconColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}
          >
            <IconComponent size={20} />
          </div>

          {/* Words Clear & Visible (on Right) */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p
                className={`text-[11px] font-bold uppercase tracking-wider ${titleColor} leading-snug break-words`}
              >
                {title}
              </p>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/80 border border-gray-200/60 text-gray-500 group-hover:bg-white group-hover:text-gray-900 transition-colors shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                View <ChevronRight size={9} />
              </span>
            </div>
            <div
              className={`text-base sm:text-lg font-black ${valueColor} tracking-tight mt-0.5 whitespace-nowrap`}
            >
              {formatAsCurrency
                ? `₹${formatCurrency(value)}`
                : Number(value || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Totals for View 2 Aging Matrix columns
  const agingTotals = useMemo(() => {
    let below = 0;
    let slab1 = 0;
    let slab2 = 0;
    let slab3 = 0;
    let above = 0;
    let grandTotal = 0;

    agingViewAccounts.forEach((item) => {
      below += Number(item.belowDaysAmount || 0);
      slab1 += Number(item.slab1Amount || 0);
      slab2 += Number(item.slab2Amount || 0);
      slab3 += Number(item.slab3Amount || 0);
      above += Number(item.aboveDaysAmount || 0);
      grandTotal += Number(item.totalAgingOutstanding || item.outstandingAmount || 0);
    });

    return {
      below,
      slab1,
      slab2,
      slab3,
      above,
      grandTotal,
    };
  }, [agingViewAccounts]);

  // Number of currently visible/filtered accounts that are selected
  const selectedVisibleCount = useMemo(() => {
    return filteredData.filter((item) => selectedAccountIds.has(item.accountId)).length;
  }, [filteredData, selectedAccountIds]);

  // Select / Deselect All logic
  const isAllSelected =
    filteredData.length > 0 &&
    filteredData.every((item) => selectedAccountIds.has(item.accountId));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAccountIds(new Set());
    } else {
      setSelectedAccountIds(new Set(filteredData.map((item) => item.accountId)));
    }
  };

  const toggleSelectAccount = (id) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };


  // Open Aging Report View (Screenshot 2)
  const handleOpenAgingReport = () => {
    if (selectedVisibleCount === 0) {
      toast.error('Please select at least one account to view the report');
      return;
    }
    setViewMode('AGING');
  };

  // Cancel / Reset all filters
  const handleClearFilters = () => {
    setSelectedCustomerFilterIds([]);
    setSelectedTypes([]);
    setMsmeFilter('ALL');
    setSelectedRegTypes([]);
    setBalanceFilter('ALL');
    setMinAmount('');
    setMaxAmount('');
    setActiveMetricFilter('ALL');
    setSearchQuery('');
    toast.success('All filters reset');
  };

  const handleCancel = handleClearFilters;

  // Native window print
  // Keyboard Escape listener to go back if in drilldown
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && viewMode === 'ACCOUNT_INVOICES') {
        handleBackToSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, previousViewMode]);

  // Aggregate all invoices across accounts for metric-level drill-down
  const allAccountInvoices = useMemo(() => {
    const list = [];
    (processedData || []).forEach((cust) => {
      (cust.invoices || []).forEach((inv) => {
        list.push({
          ...inv,
          customerName: cust.displayName || cust.accountName,
          customerCode: cust.customerCode,
          customerType: cust.customerType,
          accountId: cust.accountId,
        });
      });
    });
    return list;
  }, [processedData]);

  // Base invoices for current drill-down (either single account or metric across accounts)
  const drilldownBaseInvoices = useMemo(() => {
    if (drilldownAccount) {
      return (drilldownAccount.invoices || []).map((inv) => ({
        ...inv,
        customerName: drilldownAccount.displayName || drilldownAccount.accountName,
        customerCode: drilldownAccount.customerCode,
        customerType: drilldownAccount.customerType,
        accountId: drilldownAccount.accountId,
      }));
    }

    if (drilldownMetric) {
      if (drilldownMetric === 'INVOICED') {
        return allAccountInvoices.filter((inv) => Number(inv.grandTotal || 0) > 0.001);
      }
      if (drilldownMetric === 'PAID') {
        return allAccountInvoices.filter((inv) => Number(inv.paidAmount || 0) > 0.001);
      }
      if (drilldownMetric === 'OUTSTANDING') {
        return allAccountInvoices.filter((inv) => Number(inv.outstandingAmount || 0) > 0.001);
      }
      if (drilldownMetric === 'OVERDUE_90') {
        return allAccountInvoices.filter((inv) => Number(inv.daysOverdue || 0) >= slabs.aboveDays);
      }
      return allAccountInvoices;
    }

    return [];
  }, [drilldownAccount, drilldownMetric, allAccountInvoices, slabs.aboveDays]);

  const drilldownAvailableSlabs = useMemo(() => {
    const set = new Set();
    drilldownBaseInvoices.forEach((inv) => {
      if (inv.agingBucket) set.add(inv.agingBucket);
    });
    return Array.from(set);
  }, [drilldownBaseInvoices]);

  const filteredAccountInvoices = useMemo(() => {
    let list = drilldownBaseInvoices;

    // Filter by Metric Card if active inside drilldown view
    if (invoiceActiveMetric === 'INVOICED') {
      list = list.filter((inv) => Number(inv.grandTotal || 0) > 0);
    } else if (invoiceActiveMetric === 'PAID') {
      list = list.filter((inv) => Number(inv.paidAmount || 0) > 0);
    } else if (invoiceActiveMetric === 'OUTSTANDING') {
      list = list.filter((inv) => Number(inv.outstandingAmount || 0) > 0);
    } else if (invoiceActiveMetric === 'OVERDUE') {
      list = list.filter((inv) => Number(inv.daysOverdue || 0) > 0);
    }

    // Filter by Aging Slab
    if (invoiceActiveSlab !== 'ALL') {
      list = list.filter((inv) => inv.agingBucket === invoiceActiveSlab);
    }

    // Filter by Search Query
    if (invoiceSearchQuery.trim()) {
      const q = invoiceSearchQuery.trim().toLowerCase();
      list = list.filter((inv) => {
        const num = String(inv.invoiceNumber || '').toLowerCase();
        const slab = String(inv.agingBucket || '').toLowerCase();
        const custName = String(inv.customerName || '').toLowerCase();
        const amt = String(inv.grandTotal || '');
        const out = String(inv.outstandingAmount || '');
        return num.includes(q) || slab.includes(q) || custName.includes(q) || amt.includes(q) || out.includes(q);
      });
    }

    // Sort
    return [...list].sort((a, b) => {
      let valA = a[invoiceSortField];
      let valB = b[invoiceSortField];
      if (invoiceSortField === 'invoiceDate' || invoiceSortField === 'dueDate') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }
      if (typeof valA === 'string') {
        return invoiceSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return invoiceSortDir === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [drilldownBaseInvoices, invoiceActiveMetric, invoiceActiveSlab, invoiceSearchQuery, invoiceSortField, invoiceSortDir]);

  const drilldownTotals = useMemo(() => {
    let invoiced = 0;
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;
    drilldownBaseInvoices.forEach((inv) => {
      invoiced += Number(inv.grandTotal || 0);
      paid += Number(inv.paidAmount || 0);
      const out = Number(inv.outstandingAmount || 0);
      outstanding += out;
      if (Number(inv.daysOverdue || 0) > 0) {
        overdue += out;
      }
    });
    return {
      invoicesCount: drilldownBaseInvoices.length,
      invoiced,
      paid,
      outstanding,
      overdue,
    };
  }, [drilldownBaseInvoices]);

  const filteredDrilldownTotals = useMemo(() => {
    let invoiced = 0;
    let paid = 0;
    let outstanding = 0;
    filteredAccountInvoices.forEach((inv) => {
      invoiced += Number(inv.grandTotal || 0);
      paid += Number(inv.paidAmount || 0);
      outstanding += Number(inv.outstandingAmount || 0);
    });
    return { invoiced, paid, outstanding };
  }, [filteredAccountInvoices]);

  const handleInvoiceSort = (field) => {
    if (invoiceSortField === field) {
      setInvoiceSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setInvoiceSortField(field);
      setInvoiceSortDir('asc');
    }
  };

  const handleOpenAccountInvoices = (accountRow) => {
    setDrilldownAccount(accountRow);
    setDrilldownMetric(null);
    setDrilldownTitle(accountRow.displayName || accountRow.accountName);
    setPreviousViewMode(viewMode);
    setViewMode('ACCOUNT_INVOICES');
    setInvoiceSearchQuery('');
    setInvoiceActiveSlab('ALL');
    setInvoiceActiveMetric('ALL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSelection = () => {
    setViewMode(previousViewMode || 'SUMMARY');
    setDrilldownAccount(null);
    setDrilldownMetric(null);
    setDrilldownTitle('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (viewMode === 'SUMMARY') {
      const exportList = filteredData.filter((item) =>
        selectedAccountIds.has(item.accountId),
      );
      exportSalesOutstandingSummaryToExcel({
        data: exportList.length > 0 ? exportList : filteredData,
        summary: summaryMetrics,
        asOnDate,
      });
      toast.success('Sales Outstanding Summary exported to Excel');
    } else if (viewMode === 'AGING') {
      exportSalesOutstandingAgingToExcel({
        data: agingViewAccounts,
        summary: { agingTotals, totalOutstanding: agingTotals.grandTotal },
        asOnDate,
        companyName,
        slabs,
      });
      toast.success('Customer Outstanding Aging exported to Excel');
    } else if (viewMode === 'ACCOUNT_INVOICES' && (drilldownAccount || drilldownMetric)) {
      const XLSX = await import('xlsx');
      const safeName = (
        drilldownAccount
          ? (drilldownAccount?.displayName || drilldownAccount?.accountName)
          : (drilldownTitle || 'Metric')
      ).replace(/[^a-zA-Z0-9_-]/g, '_');
      const exportRows = filteredAccountInvoices.map((inv, idx) => ({
        '#': idx + 1,
        ...(!drilldownAccount ? { 'Account': inv.customerName || 'Customer' } : {}),
        'Invoice #': inv.invoiceNumber,
        'Invoice Date': formatDateDDMMYYYY(inv.invoiceDate),
        'Due Date': formatDateDDMMYYYY(inv.dueDate),
        'Credit Days': inv.creditDays || 0,
        'Overdue (Days)': inv.daysOverdue || 0,
        'Aging Slab': inv.agingBucket || '—',
        'Invoice Amount (₹)': Number(inv.grandTotal || 0),
        'Paid Amount (₹)': Number(inv.paidAmount || 0),
        'Outstanding (₹)': Number(inv.outstandingAmount || 0),
      }));

      exportRows.push({
        '#': '',
        ...(!drilldownAccount ? { 'Account': '' } : {}),
        'Invoice #': 'TOTAL',
        'Invoice Date': '',
        'Due Date': '',
        'Credit Days': '',
        'Overdue (Days)': '',
        'Aging Slab': '',
        'Invoice Amount (₹)': filteredDrilldownTotals.invoiced,
        'Paid Amount (₹)': filteredDrilldownTotals.paid,
        'Outstanding (₹)': filteredDrilldownTotals.outstanding,
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
      XLSX.writeFile(wb, `${safeName}_Outstanding_Invoices.xlsx`);
      toast.success('Invoices exported to Excel');
    }
    setIsExportOpen(false);
  };

  // Export to PDF
  const handleExportPDF = () => {
    let elementId = 'sales-outstanding-summary-printable';
    let filename = `Sales_Outstanding_Summary_${asOnDate}.pdf`;

    if (viewMode === 'AGING') {
      elementId = 'customer-aging-breakdown-printable';
      filename = `Customer_Outstanding_Aging_${asOnDate}.pdf`;
    } else if (viewMode === 'ACCOUNT_INVOICES') {
      const safeName = (
        drilldownAccount
          ? (drilldownAccount?.displayName || drilldownAccount?.accountName)
          : (drilldownTitle || 'Metric')
      ).replace(/[^a-zA-Z0-9_-]/g, '_');
      elementId = 'customer-invoices-printable';
      filename = `${safeName}_Outstanding_Invoices_${asOnDate}.pdf`;
    }

    exportSalesOutstandingToPDF({ elementId, filename });
    toast.success('Generating PDF...');
    setIsExportOpen(false);
  };

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-300">
      {/* Embedded print stylesheet for pixel-perfect physical printouts */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          aside, nav, header, footer, .no-print, [role="navigation"], .sidebar-container, .top-navigation, #sidebar, .sidebar { 
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          html, body, #root, #root div, main, .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            display: block !important;
          }
          .shadow-2xl, .shadow-xl, .shadow-lg, .shadow-md, .shadow-sm, .shadow-xs, .shadow-2xs, .shadow {
            box-shadow: none !important;
            display: revert !important;
          }
          #customer-aging-breakdown-printable {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            overflow: visible !important;
          }
          #customer-aging-breakdown-printable thead tr,
          #sales-outstanding-summary-printable thead tr {
            background-color: #004f3b !important;
            color: white !important;
          }
          #customer-aging-breakdown-printable thead th,
          #sales-outstanding-summary-printable thead th {
            background-color: #004f3b !important;
            color: white !important;
            border-right: 1px solid rgba(255, 255, 255, 0.3) !important;
          }
          #sales-outstanding-summary-printable {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* VIEW 1: SALES OUTSTANDING (INVOICE WISE) - SCREENSHOT 1                   */}
      {/* ========================================================================= */}
      {viewMode === 'SUMMARY' && (
        <div className="space-y-4">
          {/* Printable Document Header for View 1 (Only visible when printing View 1) */}
          <div className="hidden print:block mb-4 text-center relative">
            <div className="text-[11px] font-sans text-slate-500 absolute right-0 top-0 text-right">
              {formatFullHeaderDate()}
            </div>
            <h1 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-950 font-sans">
              {companyName || 'A G CORPORATION'}
            </h1>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 font-sans mt-0.5">
              Sales Outstanding Report as on {formatDateDDMMMYYYY(asOnDate)}
            </h2>
          </div>

          {/* Section: 5 Metric Summary Cards matching Screenshot 1 */}
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {renderSummaryCard({
              title: 'Total Accounts',
              value: summaryMetrics.totalAccounts,
              icon: Users,
              formatAsCurrency: false,
              gradient: 'from-blue-50 to-blue-100/50',
              border: 'border-blue-100',
              iconBg: 'bg-blue-500/20',
              iconColor: 'text-blue-700',
              titleColor: 'text-blue-800/70',
              valueColor: 'text-blue-900',
              isActive: activeMetricFilter === 'ALL',
              activeRing: 'ring-blue-500',
              onClick: () => setActiveOutstandingModal('ALL'),
            })}
            {renderSummaryCard({
              title: 'Total Invoiced',
              value: summaryMetrics.totalInvoiced,
              icon: IndianRupee,
              formatAsCurrency: true,
              gradient: 'from-emerald-50 to-emerald-100/50',
              border: 'border-emerald-100',
              iconBg: 'bg-emerald-500/20',
              iconColor: 'text-emerald-700',
              titleColor: 'text-emerald-800/70',
              valueColor: 'text-emerald-900',
              isActive: activeMetricFilter === 'INVOICED',
              activeRing: 'ring-emerald-600',
              onClick: () => setActiveOutstandingModal('INVOICED'),
            })}
            {renderSummaryCard({
              title: 'Total Paid / Settled',
              value: summaryMetrics.totalPaid,
              icon: CheckCircle2,
              formatAsCurrency: true,
              gradient: 'from-indigo-50 to-indigo-100/50',
              border: 'border-indigo-100',
              iconBg: 'bg-indigo-500/20',
              iconColor: 'text-indigo-700',
              titleColor: 'text-indigo-800/70',
              valueColor: 'text-indigo-900',
              isActive: activeMetricFilter === 'PAID',
              activeRing: 'ring-indigo-600',
              onClick: () => setActiveOutstandingModal('PAID'),
            })}
            {renderSummaryCard({
              title: 'Total Outstanding',
              value: summaryMetrics.totalOutstanding,
              icon: AlertTriangle,
              formatAsCurrency: true,
              gradient: 'from-amber-50 to-amber-100/50',
              border: 'border-amber-100',
              iconBg: 'bg-amber-500/20',
              iconColor: 'text-amber-700',
              titleColor: 'text-amber-800/70',
              valueColor: 'text-amber-900',
              isActive: activeMetricFilter === 'OUTSTANDING',
              activeRing: 'ring-amber-600',
              onClick: () => setActiveOutstandingModal('OUTSTANDING'),
            })}
            {renderSummaryCard({
              title: `Overdue ≥ ${slabs.aboveDays || 90} Days`,
              value: summaryMetrics.overdueAbove90,
              icon: Clock,
              formatAsCurrency: true,
              gradient: 'from-purple-50 to-purple-100/50',
              border: 'border-purple-100',
              iconBg: 'bg-purple-500/20',
              iconColor: 'text-purple-700',
              titleColor: 'text-purple-800/70',
              valueColor: 'text-purple-900',
              isActive: activeMetricFilter === 'OVERDUE_90',
              activeRing: 'ring-purple-600',
              onClick: () => setActiveOutstandingModal('OVERDUE_90'),
            })}
          </div>

          {/* Main Card Container styled to match the ERP desktop modal/window */}
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden print:border-none print:shadow-none">
            {/* Account Search Bar & Filter Controls */}
            <div className="no-print p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md min-w-[240px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search account name or customer code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#004f3b] text-slate-800"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filters Toggle Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all bg-white cursor-pointer ${
                    showFilters || activeFiltersCount > 0
                      ? 'border-[#004f3b] text-[#004f3b] bg-emerald-50/50 shadow-xs'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal size={14} className={showFilters || activeFiltersCount > 0 ? 'text-[#004f3b]' : 'text-slate-500'} />
                  <span>Filters</span>
                  <ChevronDown size={13} className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#004f3b] text-white text-[10px] flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Filter Panel - Responsive Grid */}
            {showFilters && (
              <div className="no-print bg-gray-50/70 px-6 py-4 border-b border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                  {/* Specific Customer (MultiSelectDropdown) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Specific Customer
                    </label>
                    <MultiSelectDropdown
                      options={customerOptions}
                      selectedIds={selectedCustomerFilterIds}
                      onChange={setSelectedCustomerFilterIds}
                      placeholder="All Customers"
                    />
                  </div>

                  {/* Customer Type (MultiSelectDropdown) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Customer Type
                    </label>
                    <MultiSelectDropdown
                      options={customerTypeOptions}
                      selectedIds={selectedTypes}
                      onChange={setSelectedTypes}
                      placeholder="All Customer Types"
                    />
                  </div>

                  {/* MSME Status */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      MSME Status
                    </label>
                    <div className="flex items-center gap-1 p-1 border border-gray-200 rounded-xl bg-white min-h-[38px]">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'MSME', label: 'MSME' },
                        { id: 'NON_MSME', label: 'Non' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMsmeFilter(m.id)}
                          className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                            msmeFilter === m.id
                              ? 'bg-[#004f3b] text-white shadow-2xs font-bold'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Registration Type (MultiSelectDropdown) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Registration Type
                    </label>
                    <MultiSelectDropdown
                      options={regTypeOptions}
                      selectedIds={selectedRegTypes}
                      onChange={setSelectedRegTypes}
                      placeholder="All Reg Types"
                    />
                  </div>

                  {/* Outstanding Balance */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Outstanding Balance
                    </label>
                    <div className="flex items-center gap-1.5 p-1 border border-gray-200 rounded-xl bg-white min-h-[38px]">
                      {[
                        { id: 'ALL', label: 'All' },
                        { id: 'PENDING', label: '> ₹0' },
                        { id: 'ZERO', label: 'Settled' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBalanceFilter(b.id)}
                          className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                            balanceFilter === b.id
                              ? 'bg-[#004f3b] text-white shadow-2xs font-bold'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Range (₹) */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Amount Range (₹)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min ₹"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        className="w-full h-[38px] px-3 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#004f3b] shadow-2xs"
                      />
                      <span className="text-gray-400 text-xs font-bold shrink-0">-</span>
                      <input
                        type="number"
                        placeholder="Max ₹"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        className="w-full h-[38px] px-3 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#004f3b] shadow-2xs"
                      />
                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={handleClearFilters}
                          className="h-[38px] px-3 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
                          title="Reset All Filters"
                        >
                          <X size={13} />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Active Filter Chips Bar */}
            {activeFiltersCount > 0 && (
              <div className="no-print flex flex-wrap items-center gap-2 px-6 py-2.5 bg-gray-50/50 border-b border-gray-100 animate-in fade-in duration-150">
                <span className="text-xs font-semibold text-gray-500">Active Filters:</span>
                {selectedCustomerFilterIds.map((id) => {
                  const cust = customerOptions.find((c) => String(c.id) === String(id));
                  return (
                    <span
                      key={`cust-${id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#004f3b] border border-emerald-200"
                    >
                      Customer: {cust ? cust.label : id}
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerFilterIds((prev) => prev.filter((x) => String(x) !== String(id)))}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                {selectedTypes.map((t) => {
                  const opt = customerTypeOptions.find((o) => o.id === t);
                  return (
                    <span
                      key={`type-${t}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#004f3b] border border-emerald-200"
                    >
                      Customer Type: {opt ? opt.label : (t.charAt(0).toUpperCase() + t.slice(1))}
                      <button
                        type="button"
                        onClick={() => setSelectedTypes((prev) => prev.filter((x) => x !== t))}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                {msmeFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#004f3b] border border-emerald-200">
                    MSME: {msmeFilter === 'MSME' ? 'Yes' : 'No'}
                    <button
                      type="button"
                      onClick={() => setMsmeFilter('ALL')}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {selectedRegTypes.map((rt) => (
                  <span
                    key={`reg-${rt}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#004f3b] border border-emerald-200"
                  >
                    Reg Type: {rt}
                    <button
                      type="button"
                      onClick={() => setSelectedRegTypes((prev) => prev.filter((x) => x !== rt))}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {balanceFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#004f3b] border border-emerald-200">
                    Balance: {balanceFilter === 'PENDING' ? '> ₹0' : 'Settled (₹0)'}
                    <button
                      type="button"
                      onClick={() => setBalanceFilter('ALL')}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {(minAmount || maxAmount) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#004f3b] border border-emerald-200">
                    Range: ₹{minAmount || '0'} - ₹{maxAmount || '∞'}
                    <button
                      type="button"
                      onClick={() => { setMinAmount(''); setMaxAmount(''); }}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {activeMetricFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#004f3b] border border-emerald-200">
                    Card: {
                      activeMetricFilter === 'INVOICED' ? 'Total Invoiced' :
                      activeMetricFilter === 'PAID' ? 'Total Paid / Settled' :
                      activeMetricFilter === 'OUTSTANDING' ? 'Total Outstanding' :
                      activeMetricFilter === 'OVERDUE_90' ? `Overdue ≥ ${slabs.aboveDays || 90} Days` : ''
                    }
                    <button
                      type="button"
                      onClick={() => setActiveMetricFilter('ALL')}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-red-600 hover:underline ml-2 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* ===================================================================== */}
            {/* TABLE: Account, MSME, Reg Type, Select, Inv Amt, Paid, Outstanding Amt */}
            {/* ===================================================================== */}
            <div
              id="sales-outstanding-summary-printable"
              className="overflow-x-auto max-h-[500px] overflow-y-auto"
            >
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300 select-none">
                  <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                    {/* Column 1: Account */}
                    <th className="py-2.5 px-4 font-bold border-r border-slate-200">
                      Account
                    </th>

                    {/* Column 2: Select */}
                    <th className="no-print py-2.5 px-3 text-center border-r border-slate-200 w-20">
                      <div className="flex items-center justify-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all accounts"
                          className="w-4 h-4 rounded text-[#004f3b] focus:ring-[#004f3b] cursor-pointer"
                        />
                        <span className="text-[11px]">Select</span>
                      </div>
                    </th>

                    {/* Column 3: Inv Amt */}
                    <th className="py-2.5 px-4 text-right border-r border-slate-200 font-bold">
                      Inv Amt
                    </th>

                    {/* Column 4: Paid */}
                    <th className="py-2.5 px-4 text-right border-r border-slate-200 font-bold">
                      Paid
                    </th>

                    {/* Column 5: Outstanding Amt */}
                    <th className="py-2.5 px-4 text-right font-bold text-amber-950 bg-amber-50/50">
                      Outstanding Amt
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 font-mono text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                        <Loader />
                        <p className="mt-2 text-xs font-semibold">Loading Sales Outstanding data...</p>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No accounts match the selected filter</p>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row) => {
                      const isSelected = selectedAccountIds.has(row.accountId);
                      const isNegative = Number(row.outstandingAmount) < -0.001;

                      return (
                        <tr
                          key={row.accountId}
                          className={`transition-colors hover:bg-slate-50 ${
                            isSelected ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          {/* Account / Customer Name - Clickable to open Invoices Modal */}
                          <td
                            className="py-2.5 px-4 font-sans text-slate-800 font-medium border-r border-slate-100 cursor-pointer group hover:bg-emerald-50/40 transition-colors"
                            onClick={() => setSelectedCustomerModal(row)}
                            title="Click to view customer invoices & aging summary"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 group-hover:text-[#004f3b] transition-colors">
                                    {row.accountName || row.displayName}
                                  </span>
                                  {row.customerType && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 capitalize border border-slate-200 shrink-0">
                                      {row.customerType}
                                    </span>
                                  )}
                                </div>
                                {row.customerCode && (
                                  <div className="text-[11px] font-mono text-slate-400">
                                    {row.customerCode}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0">
                                {row.invoices && row.invoices.length > 0 && (
                                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 group-hover:bg-emerald-100/70 group-hover:text-[#004f3b] px-2 py-0.5 rounded-full transition-colors">
                                    {row.invoices.length} {row.invoices.length === 1 ? 'inv' : 'invs'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Select Checkbox */}
                          <td className="no-print py-2 px-3 text-center border-r border-slate-100">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectAccount(row.accountId)}
                              className="w-4 h-4 rounded text-[#004f3b] focus:ring-[#004f3b] cursor-pointer"
                            />
                          </td>

                          {/* Inv_Amt */}
                          <td className="py-2 px-4 text-right text-slate-800 font-semibold border-r border-slate-100">
                            {formatAmountClean(row.invoiceAmount)}
                          </td>

                          {/* Paid */}
                          <td className="py-2 px-4 text-right text-slate-600 border-r border-slate-100">
                            {formatAmountClean(row.paidAmount)}
                          </td>

                          {/* Outstanding_Am (Negative amounts display with minus sign e.g. -228920) */}
                          <td
                            className={`py-2 px-4 text-right font-bold ${
                              isNegative
                                ? 'text-red-600 bg-red-50/30'
                                : Number(row.outstandingAmount) > 0
                                ? 'text-amber-900 bg-amber-50/30'
                                : 'text-slate-500'
                            }`}
                          >
                            {formatAmountClean(row.outstandingAmount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Table Footer Summary Row */}
                {filteredData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-slate-100 font-bold text-slate-900 text-xs border-t-2 border-slate-300 font-mono select-none">
                    <tr>
                      <td colSpan={1} className="py-2.5 px-4 font-sans border-r border-slate-200">
                        Total ({filteredData.length} Accounts)
                      </td>
                      <td className="no-print py-2.5 px-3 text-center border-r border-slate-200">
                        {selectedVisibleCount} Selected
                      </td>
                      <td className="py-2.5 px-4 text-right border-r border-slate-200">
                        {formatAmountClean(filteredTableTotals.totalInvoiced)}
                      </td>
                      <td className="py-2.5 px-4 text-right border-r border-slate-200">
                        {formatAmountClean(filteredTableTotals.totalPaid)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-bold bg-amber-100/60 ${
                          filteredTableTotals.totalOutstanding < 0 ? 'text-red-700' : 'text-amber-950'
                        }`}
                      >
                        {formatAmountClean(filteredTableTotals.totalOutstanding)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* ===================================================================== */}
            {/* BOTTOM CONTROLS PANEL (View button, cancel removed)                   */}
            {/* ===================================================================== */}
            <div className="no-print p-4 bg-slate-100/80 border-t border-slate-300 flex flex-col gap-3 rounded-b-2xl">
              {/* Row 1: Aging Slabs (Days Below: [30] Days To [45] Days To [60] Days To [90] Days Above) */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-700 font-medium">
                <span className="font-semibold text-slate-800">Days Below:</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={thresholds.d1}
                  onChange={(e) => handleThresholdChange('d1', e.target.value)}
                  className="w-14 text-center font-bold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#004f3b]"
                />

                <span className="font-semibold text-slate-800 ml-1">Days To</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={thresholds.d2}
                  onChange={(e) => handleThresholdChange('d2', e.target.value)}
                  className="w-14 text-center font-bold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#004f3b]"
                />

                <span className="font-semibold text-slate-800 ml-1">Days To</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={thresholds.d3}
                  onChange={(e) => handleThresholdChange('d3', e.target.value)}
                  className="w-14 text-center font-bold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#004f3b]"
                />

                <span className="font-semibold text-slate-800 ml-1">Days To</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={thresholds.d4}
                  onChange={(e) => handleThresholdChange('d4', e.target.value)}
                  className="w-14 text-center font-bold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#004f3b]"
                />

                <span className="font-semibold text-slate-800 ml-1">Days Above</span>
              </div>

              {/* Row 2: As On Date & Action Button (View only, Cancel removed) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                {/* As On Date Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">As On:</span>
                  <div className="inline-block bg-white rounded-lg border border-slate-300 px-1 py-0.5 shadow-2xs">
                    <CustomDateSelect
                      value={asOnDate}
                      onChange={(val) => setAsOnDate(val)}
                      dropUp={true}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                    ({formatDateDDMMMYYYY(asOnDate)})
                  </span>
                </div>

                {/* View Button (Cancel button removed as requested) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAgingReport}
                    className="flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-xl bg-[#004f3b] hover:bg-[#00382a] text-white shadow-sm cursor-pointer active:scale-95 transition-all"
                  >
                    <FileCheck size={15} className="text-emerald-300" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CUSTOMER OUTSTANDING AGING (PRINT PREVIEW) - SCREENSHOT 2        */}
      {/* ========================================================================= */}
      {viewMode === 'AGING' && (
        <div className="space-y-4">
          {/* Top Preview Action Toolbar */}
          <div className="no-print bg-white rounded-xl border border-slate-300 shadow-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setViewMode('SUMMARY')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

              <span className="text-xs text-slate-600 font-semibold">
                Showing <span className="font-bold text-slate-900">{agingViewAccounts.length}</span> Accounts
              </span>

              <div className="h-5 w-[1px] bg-slate-200 hidden md:block" />

              {/* MSME Quick Filter in Aging View */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase">MSME:</span>
                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'MSME', label: 'Yes' },
                    { id: 'NON_MSME', label: 'No' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMsmeFilter(m.id)}
                      className={`px-2 py-0.5 text-xs font-semibold rounded cursor-pointer transition-all ${
                        msmeFilter === m.id
                          ? 'bg-[#004f3b] text-white font-bold shadow-2xs'
                          : 'text-slate-600 hover:bg-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Registration Type Dropdown in Aging View */}
              <div className="relative w-44">
                <MultiSelectDropdown
                  options={regTypeOptions}
                  selectedIds={selectedRegTypes}
                  onChange={setSelectedRegTypes}
                  placeholder="All Reg Types"
                />
              </div>

              {(msmeFilter !== 'ALL' || selectedRegTypes.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setMsmeFilter('ALL');
                    setSelectedRegTypes([]);
                  }}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer flex items-center gap-1 ml-1"
                  title="Reset MSME & Reg Type filters"
                >
                  <X size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs cursor-pointer transition-all"
              >
                <Printer size={14} className="text-slate-700" />
                <span>Print</span>
              </button>

              {/* Export Dropdown */}
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded bg-[#004f3b] hover:bg-[#00382a] text-white shadow-2xs cursor-pointer transition-all"
                >
                  <Download size={14} />
                  <span>Export</span>
                  <ChevronDown size={13} />
                </button>

                {isExportOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <button
                      onClick={handleExportExcel}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 text-left font-medium"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      Export to Excel (.xlsx)
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-red-50 hover:text-red-900 text-left font-medium"
                    >
                      <FileText size={14} className="text-red-600" />
                      Export to PDF (.pdf)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* THE PHYSICAL PAPER REPORT (Clean corporate letterhead matching Screenshot 2) */}
          {/* ===================================================================== */}
          <div
            id="customer-aging-breakdown-printable"
            className="bg-white rounded-2xl border border-slate-300 p-6 sm:p-8 w-full shadow-sm text-slate-900 print:p-0 print:border-none print:m-0 print:w-full print:shadow-none print:rounded-none"
          >
            {/* Document Header */}
            <div className="mb-6 text-center relative border-b border-slate-200 pb-4">
              {/* Date right-aligned */}
              <div className="text-xs font-sans font-medium text-slate-500 absolute right-0 top-0 text-right">
                {formatFullHeaderDate()}
              </div>

              {/* Company Name Centered Bold */}
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-950 font-sans">
                {companyName || 'A G CORPORATION'}
              </h1>

              {/* Subtitle Report Name Centered */}
              <h2 className="text-sm sm:text-base font-bold text-slate-800 font-sans mt-1">
                Customer Outstanding as on {formatDateDDMMMYYYY(asOnDate)}
              </h2>
            </div>

            {/* Matrix Table with sharp accounting border */}
            <div className="overflow-x-auto w-full rounded-xl border border-slate-300 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs sm:text-[13px] font-mono">
                <thead>
                  <tr className="bg-[#004f3b] text-white border-b-2 border-[#00382a] font-sans text-xs font-bold uppercase tracking-wider select-none">
                    {/* Account */}
                    <th className="py-3 px-4 border-r border-white/20 text-left min-w-[220px]">
                      Account
                    </th>

                    {/* MSME */}
                    <th className="py-3 px-3 border-r border-white/20 text-center whitespace-nowrap min-w-[80px]">
                      MSME
                    </th>

                    {/* Reg Type */}
                    <th className="py-3 px-3 border-r border-white/20 text-left whitespace-nowrap min-w-[110px]">
                      Reg Type
                    </th>

                    {/* < 30 days */}
                    <th className="py-3 px-3 border-r border-white/20 text-right whitespace-nowrap">
                      {slabLabels.below}
                    </th>

                    {/* 30 to 44 days */}
                    <th className="py-3 px-3 border-r border-white/20 text-right whitespace-nowrap">
                      {slabLabels.slab1}
                    </th>

                    {/* 45 to 59 days */}
                    <th className="py-3 px-3 border-r border-white/20 text-right whitespace-nowrap">
                      {slabLabels.slab2}
                    </th>

                    {/* 60 to 89 days */}
                    <th className="py-3 px-3 border-r border-white/20 text-right whitespace-nowrap">
                      {slabLabels.slab3}
                    </th>

                    {/* >= 90 days */}
                    <th className="py-3 px-3 border-r border-white/20 text-right whitespace-nowrap">
                      {slabLabels.above}
                    </th>

                    {/* Total */}
                    <th className="py-3 px-4 text-right font-black whitespace-nowrap bg-[#003d2e] min-w-[120px]">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {agingViewAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-sans text-sm">
                        No accounts to display for the current selection
                      </td>
                    </tr>
                  ) : (
                    agingViewAccounts.map((row) => (
                      <tr key={row.accountId} className="odd:bg-white even:bg-slate-50/50 hover:bg-emerald-50/40 transition-colors">
                        {/* Account Name */}
                        <td
                          className="py-2.5 px-4 font-sans text-slate-900 font-semibold border-r border-slate-300 cursor-pointer hover:text-[#004f3b] hover:underline transition-colors"
                          onClick={() => setSelectedCustomerModal(row)}
                          title="Click to view invoices"
                        >
                          {row.displayName || row.accountName}
                        </td>

                        {/* MSME */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-300 font-sans text-slate-700">
                          {row.msmeStatus || (row.msmeEnabled ? 'Yes' : 'No')}
                        </td>

                        {/* Reg Type */}
                        <td className="py-2.5 px-3 text-left border-r border-slate-300 font-sans text-slate-700 whitespace-nowrap">
                          {row.regType || '—'}
                        </td>

                        {/* < 30 days (Blank if zero!) */}
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 text-slate-900">
                          {formatAgingCell(row.belowDaysAmount)}
                        </td>

                        {/* 30 to 44 days (Blank if zero!) */}
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 text-slate-900">
                          {formatAgingCell(row.slab1Amount)}
                        </td>

                        {/* 45 to 59 days (Blank if zero!) */}
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 text-slate-900">
                          {formatAgingCell(row.slab2Amount)}
                        </td>

                        {/* 60 to 89 days (Blank if zero!) */}
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 text-slate-900">
                          {formatAgingCell(row.slab3Amount)}
                        </td>

                        {/* >= 90 days (Blank if zero!) */}
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 text-slate-900 font-medium">
                          {formatAgingCell(row.aboveDaysAmount)}
                        </td>

                        {/* Total Outstanding */}
                        <td className="py-2.5 px-4 text-right font-bold text-slate-950 bg-slate-50/70">
                          {formatAgingCell(row.totalAgingOutstanding || row.outstandingAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Total Summary Footer Row */}
                {agingViewAccounts.length > 0 && (
                  <tfoot className="border-t-2 border-slate-400 font-bold text-slate-950 bg-slate-100 text-xs sm:text-[13px]">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 font-sans border-r border-slate-300 text-slate-900 font-extrabold">
                        Total ({agingViewAccounts.length} Accounts)
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-300">
                        {formatAgingCell(agingTotals.below)}
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-300">
                        {formatAgingCell(agingTotals.slab1)}
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-300">
                        {formatAgingCell(agingTotals.slab2)}
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-300">
                        {formatAgingCell(agingTotals.slab3)}
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-300 font-bold">
                        {formatAgingCell(agingTotals.above)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-950 bg-slate-200/80">
                        {formatAgingCell(agingTotals.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ACCOUNT INVOICES DETAIL (MATCHING SCREENSHOT 2 & 3 UI)            */}
      {/* ========================================================================= */}
      {viewMode === 'ACCOUNT_INVOICES' && (drilldownAccount || drilldownMetric) && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Preview Action Toolbar (Screenshot 2 Style) */}
          <div className="no-print bg-white rounded-xl border border-slate-300 shadow-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleBackToSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer transition-colors"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

              <span className="text-xs text-slate-600 font-semibold">
                Showing {filteredAccountInvoices.length} {filteredAccountInvoices.length === 1 ? 'Invoice' : 'Invoices'} for
              </span>

              <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                {drilldownAccount ? (drilldownAccount.displayName || drilldownAccount.accountName) : drilldownTitle}
              </span>

              {drilldownAccount?.customerCode && (
                <span className="text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {drilldownAccount.customerCode}
                </span>
              )}

              {drilldownAccount?.customerType && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full capitalize border border-slate-200">
                  {drilldownAccount.customerType}
                </span>
              )}

              {!drilldownAccount && drilldownMetric && (
                <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  All Accounts
                </span>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs cursor-pointer transition-all"
              >
                <Printer size={14} className="text-slate-700" />
                <span>Print</span>
              </button>

              {/* Export Dropdown */}
              <div className="relative" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded bg-[#004f3b] hover:bg-[#00382a] text-white shadow-2xs cursor-pointer transition-all"
                >
                  <Download size={14} />
                  <span>Export</span>
                  <ChevronDown size={13} />
                </button>

                {isExportOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                    <button
                      onClick={handleExportExcel}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 text-left font-medium cursor-pointer"
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                      Export to Excel (.xlsx)
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-red-50 hover:text-red-900 text-left font-medium cursor-pointer"
                    >
                      <FileText size={14} className="text-red-600" />
                      Export to PDF (.pdf)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KPI Mini-Cards Row (Screenshot 3 Style) */}
          <div className="no-print grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {renderSummaryCard({
              title: 'Total Invoices',
              value: drilldownTotals.invoicesCount,
              icon: Users,
              formatAsCurrency: false,
              gradient: 'from-blue-50 to-blue-100/50',
              border: 'border-blue-100',
              iconBg: 'bg-blue-500/20',
              iconColor: 'text-blue-700',
              titleColor: 'text-blue-800/70',
              valueColor: 'text-blue-900',
              isActive: invoiceActiveMetric === 'ALL',
              activeRing: 'ring-blue-500',
              onClick: () => setInvoiceActiveMetric('ALL'),
            })}

            {renderSummaryCard({
              title: 'Total Invoiced',
              value: drilldownTotals.invoiced,
              icon: IndianRupee,
              formatAsCurrency: true,
              gradient: 'from-emerald-50 to-emerald-100/50',
              border: 'border-emerald-100',
              iconBg: 'bg-emerald-500/20',
              iconColor: 'text-emerald-700',
              titleColor: 'text-emerald-800/70',
              valueColor: 'text-emerald-900',
              isActive: invoiceActiveMetric === 'INVOICED',
              activeRing: 'ring-emerald-600',
              onClick: () => setInvoiceActiveMetric((prev) => (prev === 'INVOICED' ? 'ALL' : 'INVOICED')),
            })}

            {renderSummaryCard({
              title: 'Total Paid / Settled',
              value: drilldownTotals.paid,
              icon: CheckCircle2,
              formatAsCurrency: true,
              gradient: 'from-indigo-50 to-indigo-100/50',
              border: 'border-indigo-100',
              iconBg: 'bg-indigo-500/20',
              iconColor: 'text-indigo-700',
              titleColor: 'text-indigo-800/70',
              valueColor: 'text-indigo-900',
              isActive: invoiceActiveMetric === 'PAID',
              activeRing: 'ring-indigo-600',
              onClick: () => setInvoiceActiveMetric((prev) => (prev === 'PAID' ? 'ALL' : 'PAID')),
            })}

            {renderSummaryCard({
              title: 'Total Outstanding',
              value: drilldownTotals.outstanding,
              icon: AlertTriangle,
              formatAsCurrency: true,
              gradient: 'from-amber-50 to-amber-100/50',
              border: 'border-amber-100',
              iconBg: 'bg-amber-500/20',
              iconColor: 'text-amber-700',
              titleColor: 'text-amber-800/70',
              valueColor: 'text-amber-900',
              isActive: invoiceActiveMetric === 'OUTSTANDING',
              activeRing: 'ring-amber-600',
              onClick: () => setInvoiceActiveMetric((prev) => (prev === 'OUTSTANDING' ? 'ALL' : 'OUTSTANDING')),
            })}

            {renderSummaryCard({
              title: 'Overdue Amount',
              value: drilldownTotals.overdue,
              icon: Clock,
              formatAsCurrency: true,
              gradient: 'from-purple-50 to-purple-100/50',
              border: 'border-purple-100',
              iconBg: 'bg-purple-500/20',
              iconColor: 'text-purple-700',
              titleColor: 'text-purple-800/70',
              valueColor: 'text-purple-900',
              isActive: invoiceActiveMetric === 'OVERDUE',
              activeRing: 'ring-purple-600',
              onClick: () => setInvoiceActiveMetric((prev) => (prev === 'OVERDUE' ? 'ALL' : 'OVERDUE')),
            })}
          </div>

          {/* Main Card Container styled to match ERP desktop reports */}
          <div
            id="customer-invoices-printable"
            className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden print:border-none print:shadow-none"
          >
            {/* Printable Letterhead (shown on print) */}
            <div className="hidden print:block mb-6 text-center border-b border-slate-200 pb-4">
              <div className="text-xs font-sans font-medium text-slate-500 text-right mb-2">
                {formatFullHeaderDate()}
              </div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-slate-950 font-sans">
                {companyName || 'A G CORPORATION'}
              </h1>
              <h2 className="text-base font-bold text-slate-800 font-sans mt-1">
                Outstanding Invoices - {drilldownAccount ? (drilldownAccount.displayName || drilldownAccount.accountName) : drilldownTitle}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                As on {formatDateDDMMMYYYY(asOnDate)}
              </p>
            </div>

            {/* Invoices Toolbar: Search + Aging Slabs Filter */}
            <div className="no-print p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice number, customer, slab, amount..."
                  value={invoiceSearchQuery}
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#004f3b] bg-white"
                />
                {invoiceSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInvoiceSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Slabs filter pills */}
              {drilldownAvailableSlabs.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 text-xs font-semibold">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setInvoiceActiveSlab('ALL')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      invoiceActiveSlab === 'ALL'
                        ? 'bg-[#004f3b] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    All ({drilldownBaseInvoices.length})
                  </button>
                  {drilldownAvailableSlabs.map((slab) => {
                    const count = drilldownBaseInvoices.filter((i) => i.agingBucket === slab).length;
                    return (
                      <button
                        key={slab}
                        type="button"
                        onClick={() => setInvoiceActiveSlab(slab)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          invoiceActiveSlab === slab
                            ? 'bg-[#004f3b] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {slab} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invoices Table */}
            <div className="overflow-x-auto w-full">
              {filteredAccountInvoices.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-sans">
                  <FileText size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-slate-500">
                    {drilldownBaseInvoices.length === 0
                      ? 'No outstanding invoices recorded for this selection'
                      : 'No invoices match the search or filter'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#004f3b] text-white font-bold border-b-2 border-[#00382a] text-xs uppercase tracking-wider select-none">
                      <th className="py-3 px-3 text-center w-12 border-r border-white/20">#</th>
                      {!drilldownAccount && (
                        <th
                          className="py-3 px-3.5 border-r border-white/20 cursor-pointer hover:bg-[#00382a] transition-colors"
                          onClick={() => handleInvoiceSort('customerName')}
                        >
                          <div className="flex items-center gap-1">
                            <span>Account</span>
                            <ArrowUpDown size={11} className="text-emerald-300" />
                          </div>
                        </th>
                      )}
                      <th
                        className="py-3 px-3.5 border-r border-white/20 cursor-pointer hover:bg-[#00382a] transition-colors"
                        onClick={() => handleInvoiceSort('invoiceNumber')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Invoice #</span>
                          <ArrowUpDown size={11} className="text-emerald-300" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 border-r border-white/20 cursor-pointer hover:bg-[#00382a] transition-colors"
                        onClick={() => handleInvoiceSort('invoiceDate')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Date</span>
                          <ArrowUpDown size={11} className="text-emerald-300" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 border-r border-white/20 cursor-pointer hover:bg-[#00382a] transition-colors"
                        onClick={() => handleInvoiceSort('dueDate')}
                      >
                        <div className="flex items-center gap-1">
                          <span>Due Date</span>
                          <ArrowUpDown size={11} className="text-emerald-300" />
                        </div>
                      </th>
                      <th className="py-3 px-2.5 text-center border-r border-white/20">Credit Days</th>
                      <th
                        className="py-3 px-3 text-center border-r border-white/20 cursor-pointer hover:bg-[#00382a] transition-colors"
                        onClick={() => handleInvoiceSort('daysOverdue')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Overdue</span>
                          <ArrowUpDown size={11} className="text-emerald-300" />
                        </div>
                      </th>
                      <th className="py-3 px-3 border-r border-white/20 text-center">Aging Slab</th>
                      <th
                        className="py-3 px-3 text-right border-r border-white/20 cursor-pointer hover:bg-[#00382a] transition-colors"
                        onClick={() => handleInvoiceSort('grandTotal')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Inv Amt</span>
                          <ArrowUpDown size={11} className="text-emerald-300" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-right border-r border-white/20 cursor-pointer hover:bg-[#00382a] transition-colors"
                        onClick={() => handleInvoiceSort('paidAmount')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Paid</span>
                          <ArrowUpDown size={11} className="text-emerald-300" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 text-right cursor-pointer hover:bg-[#00382a] transition-colors bg-[#003d2e]"
                        onClick={() => handleInvoiceSort('outstandingAmount')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Outstanding</span>
                          <ArrowUpDown size={11} className="text-emerald-300" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-mono">
                    {filteredAccountInvoices.map((inv, idx) => {
                      const isOverdue = Number(inv.daysOverdue || 0) > 0;
                      return (
                        <tr
                          key={inv.id || idx}
                          className="odd:bg-white even:bg-slate-50/50 hover:bg-emerald-50/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono border-r border-slate-200">
                            {idx + 1}
                          </td>
                          {!drilldownAccount && (
                            <td className="py-2.5 px-3.5 font-bold text-slate-900 border-r border-slate-200">
                              {inv.customerName || 'Customer'}
                            </td>
                          )}
                          <td className="py-2.5 px-3.5 font-bold text-slate-900 border-r border-slate-200 font-mono">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                            {formatDateDDMMYYYY(inv.invoiceDate)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                            {formatDateDDMMYYYY(inv.dueDate)}
                          </td>
                          <td className="py-2.5 px-2.5 text-center text-slate-600 font-mono border-r border-slate-200">
                            {inv.creditDays ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                            {isOverdue ? (
                              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                                {inv.daysOverdue} days
                              </span>
                            ) : (
                              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                                On time
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                              {inv.agingBucket || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-900 border-r border-slate-200 font-mono">
                            ₹{formatAmountClean(inv.grandTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700 border-r border-slate-200 font-mono">
                            ₹{formatAmountClean(inv.paidAmount)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-amber-950 font-mono bg-amber-50/40">
                            ₹{formatAmountClean(inv.outstandingAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-950 text-xs sm:text-[13px] font-mono">
                      <td colSpan={!drilldownAccount ? 8 : 7} className="py-3 px-4 font-sans font-black text-slate-900 border-r border-slate-300">
                        TOTAL ({filteredAccountInvoices.length} INVOICES)
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-300 text-slate-900 font-bold">
                        ₹{formatAmountClean(filteredDrilldownTotals.invoiced)}
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-300 text-slate-700 font-bold">
                        ₹{formatAmountClean(filteredDrilldownTotals.paid)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-950 bg-amber-100/70">
                        ₹{formatAmountClean(filteredDrilldownTotals.outstanding)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Bottom summary bar */}
            <div className="no-print px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>
                Showing {filteredAccountInvoices.length} of {drilldownBaseInvoices.length} invoices for {drilldownAccount ? (drilldownAccount?.displayName || drilldownAccount?.accountName) : drilldownTitle}
              </span>
              <button
                type="button"
                onClick={handleBackToSelection}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-800 transition-colors cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outstanding Metric Modal (matching Customer Sales Report design) */}
      {activeOutstandingModal && (
        <OutstandingMetricModal
          isOpen={Boolean(activeOutstandingModal)}
          metricKey={activeOutstandingModal}
          accounts={processedData}
          summaryMetrics={summaryMetrics}
          asOnDate={asOnDate}
          slabs={slabs}
          onSelectAccount={(account) => {
            setActiveOutstandingModal(null);
            setSelectedCustomerModal(account);
          }}
          onClose={() => setActiveOutstandingModal(null)}
        />
      )}

      {/* Customer Invoices & Outstanding Modal */}
      {selectedCustomerModal && (
        <CustomerInvoicesModal
          isOpen={Boolean(selectedCustomerModal)}
          customer={selectedCustomerModal}
          asOnDate={asOnDate}
          slabs={slabs}
          onClose={() => setSelectedCustomerModal(null)}
        />
      )}

    </div>
  );
};

export default SalesOutstandingReportView;
