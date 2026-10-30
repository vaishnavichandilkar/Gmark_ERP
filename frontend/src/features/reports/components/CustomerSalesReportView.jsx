import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  Activity,
  CheckCircle2,
  Check,
  Plus,
  Minus,
  Download,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  FileText,
  Calendar,
  Layers,
  BarChart2,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  AlertCircle,
  Maximize2,
  Minimize2,
  Upload,
} from 'lucide-react';
import Card, { CardContent } from '../../../components/common/Card';
import Loader from '../../../components/common/Loader';
import reportService from '../../../services/reportService';
import categoryService from '../../../services/masters/categoryService';
import CustomerMonthlySalesModal from './CustomerMonthlySalesModal';
import MetricInfoModal from './MetricInfoModal';
import { CustomDateSelect, toLocalISOString } from './CustomDateSelect';
import {
  exportCustomerSalesToExcel,
  exportCustomerSalesToCSV,
  exportCustomerSalesToPDF,
} from '../utils/customerSalesExport';
import { toast } from 'react-hot-toast';

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

  // Normalize selected IDs as strings for consistent comparison
  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((opt) => {
      const name = String(opt.name || opt.label || '').toLowerCase();
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

  // Label to show on the trigger button
  const displayLabel = useMemo(() => {
    if (selectedIds.length === 0) return placeholder;
    if (selectedIds.length === 1) {
      const item = options.find((opt) => String(opt.id) === String(selectedIds[0]));
      return item ? `${item.name || item.label}${item.code ? ` (${item.code})` : ''}` : '1 selected';
    }
    const firstItem = options.find((opt) => String(opt.id) === String(selectedIds[0]));
    const firstName = firstItem ? firstItem.name || firstItem.label : 'Item';
    return `${firstName} +${selectedIds.length - 1} more`;
  }, [selectedIds, options, placeholder]);

  // Optimize rendering for large lists (e.g. 1000+ products) while keeping all selected items visible
  const renderedOptions = useMemo(() => {
    if (filteredOptions.length <= 200) return filteredOptions;
    const selectedFiltered = [];
    const unselectedFiltered = [];
    filteredOptions.forEach((opt) => {
      if (selectedSet.has(String(opt.id))) {
        selectedFiltered.push(opt);
      } else {
        unselectedFiltered.push(opt);
      }
    });
    return [...selectedFiltered, ...unselectedFiltered.slice(0, 200 - Math.min(selectedFiltered.length, 100))];
  }, [filteredOptions, selectedSet]);

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
            ? 'border-[#073318] ring-2 ring-[#073318]/10'
            : selectedIds.length > 0
            ? 'border-emerald-600 bg-emerald-50/20'
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
            <span className="shrink-0 text-[10px] font-black bg-[#073318] text-white px-1.5 py-0.2 rounded-full">
              {selectedIds.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedIds.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[220px] animate-in fade-in zoom-in-95 duration-100">
          {/* Search bar inside dropdown */}
          {options.length > 5 && (
            <div className="p-2 border-b border-gray-100 bg-gray-50/50">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${options.length} options...`}
                  className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#073318]"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Quick Action Bar (Select All / Clear) */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/80 border-b border-gray-100 text-[11px]">
            <span className="text-gray-500 font-medium">
              {selectedIds.length} of {options.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-gray-500 hover:text-red-600 font-medium hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-gray-50">
            {renderedOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                No matching options
              </div>
            ) : (
              <>
                {renderedOptions.map((opt) => {
                  const isChecked = selectedSet.has(String(opt.id));
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleToggle(opt.id)}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-emerald-50 text-emerald-950 font-bold'
                          : 'text-gray-700 hover:bg-gray-100/80'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-[#073318] border-[#073318] text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span className="truncate flex-1">
                        {opt.name || opt.label}
                        {opt.code ? ` (${opt.code})` : ''}
                      </span>
                    </div>
                  );
                })}
                {filteredOptions.length > renderedOptions.length && (
                  <div className="p-2 text-center text-[11px] text-gray-500 bg-gray-50/80 font-medium">
                    Showing top {renderedOptions.length} of {filteredOptions.length} — type to filter more
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CustomerSalesReportView = ({
  fromDate: propFromDate,
  toDate: propToDate,
  onFromDateChange,
  onToDateChange,
  dateRange,
  periodLabel,
}) => {
  // State
  const [internalFromDate, setInternalFromDate] = useState(dateRange?.dateFrom || '2026-04-01');
  const [internalToDate, setInternalToDate] = useState(dateRange?.dateTo || '2027-03-31');

  const fromDate = propFromDate !== undefined ? propFromDate : internalFromDate;
  const toDate = propToDate !== undefined ? propToDate : internalToDate;

  const handleFromDateChange = (val) => {
    if (toDate && val && new Date(val) > new Date(toDate)) {
      toast.error('From date cannot be greater than To date');
      return;
    }
    if (onFromDateChange) {
      onFromDateChange(val);
    } else {
      setInternalFromDate(val);
    }
  };

  const handleToDateChange = (val) => {
    if (fromDate && val && new Date(val) < new Date(fromDate)) {
      toast.error('To date cannot be smaller than From date');
      return;
    }
    if (onToDateChange) {
      onToDateChange(val);
    } else {
      setInternalToDate(val);
    }
  };

  const handlePresetChange = (newFrom, newTo) => {
    if (onFromDateChange && onToDateChange) {
      onFromDateChange(newFrom);
      onToDateChange(newTo);
    } else {
      setInternalFromDate(newFrom);
      setInternalToDate(newTo);
    }
  };

  const [loading, setLoading] = useState(true);
  const [groupsData, setGroupsData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [totalMatchingCustomers, setTotalMatchingCustomers] = useState(0);
  const [totalMatchingOrders, setTotalMatchingOrders] = useState(0);

  // Filter Options & Filter States
  const [filterOptions, setFilterOptions] = useState({
    customerTypes: [
      { id: 'industrial', label: 'Industrial' },
      { id: 'institutional', label: 'Institutional' },
      { id: 'dealer', label: 'Dealer' },
      { id: 'retailer', label: 'Retailer' },
    ],
    customers: [],
    products: [],
    categories: [],
    subCategories: [],
    subSubCategories: [],
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState([]);
  const [selectedSubSubCategoryIds, setSelectedSubSubCategoryIds] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Group Accordion Expanded State: Set of customerType keys
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // In-table Sorting & Pagination per group
  const [sortField, setSortField] = useState('customerName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pageByGroup, setPageByGroup] = useState({});
  const pageSize = 10;

  // Monthly Sales Modal State
  const [monthlyModalCustomer, setMonthlyModalCustomer] = useState(null);

  // Metric Info Modal State (for clickable summary cards)
  const [activeMetricModal, setActiveMetricModal] = useState(null);

  // Export Dropdown State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const exportRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Filter Options once
  useEffect(() => {
    let isMounted = true;
    const fetchOptions = async () => {
      try {
        const [opts, catTree] = await Promise.all([
          reportService.getCustomerSalesFilterOptions().catch((err) => {
            console.error('Failed to load filter options:', err);
            return null;
          }),
          categoryService.getCategories().catch((err) => {
            console.error('Failed to load categories tree:', err);
            return null;
          }),
        ]);

        if (isMounted) {
          const allowedTypes = ['industrial', 'institutional', 'dealer', 'retailer'];
          const filteredTypes = (opts?.customerTypes || [])
            .filter((t) => allowedTypes.includes(t.id.toLowerCase()))
            .map((t) => ({
              id: t.id.toLowerCase(),
              label:
                t.id.toLowerCase() === 'industrial' ? 'Industrial'
                : t.id.toLowerCase() === 'institutional' ? 'Institutional'
                : t.id.toLowerCase() === 'dealer' ? 'Dealer'
                : t.id.toLowerCase() === 'retailer' ? 'Retailer'
                : t.label,
            }));

          // Parse full categories, sub-categories, sub-sub-categories
          let parsedCategories = opts?.categories || [];
          let parsedSubCategories = opts?.subCategories || [];
          let parsedSubSubCategories = opts?.subSubCategories || [];

          if (Array.isArray(catTree) && catTree.length > 0) {
            parsedCategories = catTree.map((c) => ({ id: c.id, name: c.name }));
            parsedSubCategories = [];
            parsedSubSubCategories = [];

            catTree.forEach((cat) => {
              (cat.sub_categories || []).forEach((sub) => {
                parsedSubCategories.push({
                  id: sub.id,
                  name: sub.name,
                  categoryId: cat.id,
                });
                (sub.sub_sub_categories || []).forEach((subsub) => {
                  parsedSubSubCategories.push({
                    id: subsub.id,
                    name: subsub.name,
                    subCategoryId: sub.id,
                    categoryId: cat.id,
                  });
                });
              });
            });
          }

          setFilterOptions({
            customerTypes: filteredTypes.length > 0 ? filteredTypes : [
              { id: 'industrial', label: 'Industrial' },
              { id: 'institutional', label: 'Institutional' },
              { id: 'dealer', label: 'Dealer' },
              { id: 'retailer', label: 'Retailer' },
            ],
            customers: (opts?.customers || []).filter((c) => {
              const code = String(c?.code || '').trim();
              const type = String(c?.type || '').toLowerCase();
              const isExcludedType = ['bank', 'cash', 'supplier'].includes(type);
              const isSyntheticNonCustomer = code.startsWith('CUST-') && !['industrial', 'institutional', 'dealer', 'retailer'].includes(type);
              return !isExcludedType && !isSyntheticNonCustomer;
            }),
            products: opts?.products || [],
            categories: parsedCategories,
            subCategories: parsedSubCategories,
            subSubCategories: parsedSubSubCategories,
          });
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    fetchOptions();
    return () => { isMounted = false; };
  }, []);



  // Fetch Report Data from Backend
  const loadReportData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = {
        dateFrom: fromDate || undefined,
        dateTo: toDate || undefined,
        customerTypes: selectedTypes.length > 0 ? selectedTypes.join(',') : undefined,
        customerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds.join(',') : undefined,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds.join(',') : undefined,
        subCategoryIds: selectedSubCategoryIds.length > 0 ? selectedSubCategoryIds.join(',') : undefined,
        subSubCategoryIds: selectedSubSubCategoryIds.length > 0 ? selectedSubSubCategoryIds.join(',') : undefined,
        productIds: selectedProductIds.length > 0 ? selectedProductIds.join(',') : undefined,
        minAmount: minAmount !== '' ? Number(minAmount) : undefined,
        maxAmount: maxAmount !== '' ? Number(maxAmount) : undefined,
        search: searchTerm || undefined,
        sortBy: sortField,
        sortOrder: sortOrder,
      };

      const res = await reportService.getCustomerSalesGroups(params);
      const allowedTypes = ['industrial', 'institutional', 'dealer', 'retailer'];
      const sanitizedGroups = (res?.groups || [])
        .filter((g) => allowedTypes.includes(g.customerType.toLowerCase()))
        .map((g) => ({
          ...g,
          customerTypeLabel:
            g.customerType.toLowerCase() === 'industrial' ? 'Industrial'
            : g.customerType.toLowerCase() === 'institutional' ? 'Institutional'
            : g.customerType.toLowerCase() === 'dealer' ? 'Dealer'
            : g.customerType.toLowerCase() === 'retailer' ? 'Retailer'
            : g.customerTypeLabel,
        }));
      setGroupsData(sanitizedGroups);
      setSummaryData(res?.summary || null);
      setTotalMatchingCustomers(res?.totalMatchingCustomers || 0);
      setTotalMatchingOrders(res?.totalMatchingOrders || 0);
      setFetchError(null);

      // Auto-expand all groups by default on initial load
      if (res?.groups?.length > 0) {
        setExpandedGroups((prev) => {
          if (prev.size === 0) {
            return new Set(res.groups.map((g) => g.customerType));
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error loading customer sales groups:', err);
      if (err?.code !== 'ERR_CANCELED') {
        const errorMsg = err?.response?.data?.message || err?.message || 'Failed to load customer sales report data';
        setFetchError(errorMsg);
        toast.error(errorMsg, { id: 'customer-sales-report-error' });
      }
    } finally {
      setLoading(false);
    }
  }, [
    fromDate,
    toDate,
    selectedTypes,
    selectedCustomerIds,
    selectedCategoryIds,
    selectedSubCategoryIds,
    selectedSubSubCategoryIds,
    selectedProductIds,
    minAmount,
    maxAmount,
    searchTerm,
    sortField,
    sortOrder,
  ]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Group Accordion Toggles
  const toggleGroup = (typeKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(typeKey)) {
        next.delete(typeKey);
      } else {
        next.add(typeKey);
      }
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(groupsData.map((g) => g.customerType)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  // Check if all available groups are expanded
  const isAllExpanded = useMemo(() => {
    if (!groupsData || groupsData.length === 0) return false;
    return groupsData.every((g) => expandedGroups.has(g.customerType));
  }, [groupsData, expandedGroups]);

  const toggleAllGroups = () => {
    if (isAllExpanded) {
      collapseAllGroups();
    } else {
      expandAllGroups();
    }
  };

  // Sort Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtered sub-categories based on selected category (if any categories selected)
  const filteredSubCategories = useMemo(() => {
    if (!filterOptions.subCategories) return [];
    if (selectedCategoryIds.length === 0) return filterOptions.subCategories;
    const catIdSet = new Set(selectedCategoryIds.map(String));
    return filterOptions.subCategories.filter((sc) => catIdSet.has(String(sc.categoryId)));
  }, [filterOptions.subCategories, selectedCategoryIds]);

  // Filtered sub-sub-categories based on selected sub-categories or categories
  const filteredSubSubCategories = useMemo(() => {
    if (!filterOptions.subSubCategories) return [];
    const subCatIdSet = new Set(selectedSubCategoryIds.map(String));
    const catIdSet = new Set(selectedCategoryIds.map(String));

    return filterOptions.subSubCategories.filter((ssc) => {
      if (selectedSubCategoryIds.length > 0 && !subCatIdSet.has(String(ssc.subCategoryId))) return false;
      if (selectedCategoryIds.length > 0 && ssc.categoryId && !catIdSet.has(String(ssc.categoryId))) return false;
      return true;
    });
  }, [filterOptions.subSubCategories, selectedSubCategoryIds, selectedCategoryIds]);

  // Filtered products based on category, sub-category, sub-sub-category
  const filteredProducts = useMemo(() => {
    if (!filterOptions.products) return [];
    const subSubCatIdSet = new Set(selectedSubSubCategoryIds.map(String));
    const subCatIdSet = new Set(selectedSubCategoryIds.map(String));
    const catIdSet = new Set(selectedCategoryIds.map(String));

    return filterOptions.products.filter((p) => {
      if (
        selectedSubSubCategoryIds.length > 0 &&
        !subSubCatIdSet.has(String(p.subSubCategoryId)) &&
        !subSubCatIdSet.has(String(p.categoryId))
      )
        return false;
      if (
        selectedSubCategoryIds.length > 0 &&
        !subCatIdSet.has(String(p.subCategoryId)) &&
        !subCatIdSet.has(String(p.categoryId))
      )
        return false;
      if (selectedCategoryIds.length > 0 && !catIdSet.has(String(p.categoryId))) return false;
      return true;
    });
  }, [filterOptions.products, selectedCategoryIds, selectedSubCategoryIds, selectedSubSubCategoryIds]);

  const handleCategoryChange = (ids) => {
    setSelectedCategoryIds(ids);
    if (ids.length > 0) {
      const allowedCatSet = new Set(ids.map(String));
      setSelectedSubCategoryIds((prev) =>
        prev.filter((subId) => {
          const sc = filterOptions.subCategories.find((s) => String(s.id) === String(subId));
          return sc && allowedCatSet.has(String(sc.categoryId));
        })
      );
      setSelectedSubSubCategoryIds((prev) =>
        prev.filter((sscId) => {
          const ssc = filterOptions.subSubCategories.find((s) => String(s.id) === String(sscId));
          return ssc && (!ssc.categoryId || allowedCatSet.has(String(ssc.categoryId)));
        })
      );
    }
  };

  const handleSubCategoryChange = (ids) => {
    setSelectedSubCategoryIds(ids);
    if (ids.length > 0) {
      const allowedSubSet = new Set(ids.map(String));
      setSelectedSubSubCategoryIds((prev) =>
        prev.filter((sscId) => {
          const ssc = filterOptions.subSubCategories.find((s) => String(s.id) === String(sscId));
          return ssc && allowedSubSet.has(String(ssc.subCategoryId));
        })
      );
    }
  };

  const handleSubSubCategoryChange = (ids) => {
    setSelectedSubSubCategoryIds(ids);
  };

  // Active Filter Count Badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedTypes.length > 0) count += selectedTypes.length;
    if (selectedCustomerIds.length > 0) count += selectedCustomerIds.length;
    if (selectedCategoryIds.length > 0) count += selectedCategoryIds.length;
    if (selectedSubCategoryIds.length > 0) count += selectedSubCategoryIds.length;
    if (selectedSubSubCategoryIds.length > 0) count += selectedSubSubCategoryIds.length;
    if (selectedProductIds.length > 0) count += selectedProductIds.length;
    if (minAmount !== '') count++;
    if (maxAmount !== '') count++;
    if (searchTerm) count++;
    return count;
  }, [
    selectedTypes,
    selectedCustomerIds,
    selectedCategoryIds,
    selectedSubCategoryIds,
    selectedSubSubCategoryIds,
    selectedProductIds,
    minAmount,
    maxAmount,
    searchTerm,
  ]);

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedTypes([]);
    setSelectedCustomerIds([]);
    setSelectedCategoryIds([]);
    setSelectedSubCategoryIds([]);
    setSelectedSubSubCategoryIds([]);
    setSelectedProductIds([]);
    setMinAmount('');
    setMaxAmount('');
    setSearchTerm('');
  };

  // Export Handlers
  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      setShowExportMenu(false);
      exportCustomerSalesToExcel({
        groups: groupsData,
        summary: summaryData || {},
        periodLabel: periodLabel || 'All Time',
      });
      toast.success('Excel workbook generated successfully');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to generate Excel report');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExportLoading(true);
      setShowExportMenu(false);
      exportCustomerSalesToCSV({
        groups: groupsData,
        periodLabel: periodLabel || 'All Time',
      });
      toast.success('CSV report exported successfully');
    } catch (err) {
      console.error('CSV export error:', err);
      toast.error('Failed to export CSV report');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportLoading(true);
      setShowExportMenu(false);
      // Export the table directly as displayed without forcing all groups to expand
      setTimeout(() => {
        exportCustomerSalesToPDF({
          elementId: 'customer-sales-report-table-printable',
          reportTitle: `Customer Sales Report (${periodLabel || 'All Time'})`,
        });
        toast.success('PDF report generated successfully');
        setExportLoading(false);
      }, 300);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to generate PDF report');
      setExportLoading(false);
    }
  };

  // Render Metric Card Helper with Dedicated Theme matching Gmark ERP Dashboard
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
    onClick,
  }) => {
    return (
      <Card
        className={`bg-gradient-to-br ${gradient} ${border} shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 rounded-2xl cursor-pointer group relative overflow-hidden`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick && onClick();
          }
        }}
        title={`Click to view ${title} details & customer breakdown`}
      >
        <CardContent className="p-3.5 sm:p-4 flex items-center gap-3 h-full">
          {/* Symbol First (on Left) */}
          <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full ${iconBg} ${iconColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}>
            <IconComponent size={20} />
          </div>

          {/* Words Clear & Visible (on Right) */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className={`text-[11px] font-bold uppercase tracking-wider ${titleColor} leading-snug break-words`}>
                {title}
              </p>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-white/80 border border-gray-200/60 text-gray-500 group-hover:bg-white group-hover:text-gray-900 transition-colors shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                View <ChevronRight size={9} />
              </span>
            </div>
            <div className={`text-base sm:text-lg font-black ${valueColor} tracking-tight mt-0.5 whitespace-nowrap`}>
              {formatAsCurrency ? `₹${formatCurrency(value)}` : Number(value || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const now = new Date();
  const firstDayThisMonth = toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayDate = toLocalISOString(now);
  const isFY = fromDate === '2026-04-01' && toDate === '2027-03-31';
  const isThisMonth = fromDate === firstDayThisMonth && toDate === todayDate;
  const isAllTime = !fromDate && !toDate;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Top Filter and Action Bar (Matching P&L / User's Reference Bar) */}
      <div className="bg-white p-3 md:p-3.5 rounded-2xl border border-gray-200/80 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Left Side: From, To, and Quick Presets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">From:</label>
            <CustomDateSelect
              value={fromDate}
              onChange={handleFromDateChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">To:</label>
            <CustomDateSelect
              value={toDate}
              onChange={handleToDateChange}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePresetChange('2026-04-01', '2027-03-31')}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer ${
                isFY ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              FY 2026-27
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange(firstDayThisMonth, todayDate)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer ${
                isThisMonth ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('', '')}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-colors outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer ${
                isAllTime ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {periodLabel && (
          <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 ml-auto">
            <Calendar size={14} className="text-[#0f4a3c]" />
            <span>Active Period:</span>
            <span className="font-bold text-[#0f4a3c] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {periodLabel}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Section A: Customer Sales Summary (5 Clickable Cards with Rich Info Modal) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {renderSummaryCard({
            title: 'Customers with Sales',
            value: summaryData?.totalCustomers || 0,
            icon: Users,
            formatAsCurrency: false,
            gradient: 'from-blue-50 to-blue-100/50',
            border: 'border-blue-100',
            iconBg: 'bg-blue-500/20',
            iconColor: 'text-blue-700',
            titleColor: 'text-blue-800/70',
            valueColor: 'text-blue-900',
            onClick: () => setActiveMetricModal('CUSTOMERS_WITH_SALES'),
          })}
          {renderSummaryCard({
            title: 'Total Sales (Net)',
            value: summaryData?.totalSales || 0,
            icon: IndianRupee,
            formatAsCurrency: true,
            gradient: 'from-emerald-50 to-emerald-100/50',
            border: 'border-emerald-100',
            iconBg: 'bg-emerald-500/20',
            iconColor: 'text-emerald-700',
            titleColor: 'text-emerald-800/70',
            valueColor: 'text-emerald-900',
            onClick: () => setActiveMetricModal('TOTAL_SALES'),
          })}
          {renderSummaryCard({
            title: 'Total Orders',
            value: summaryData?.totalOrders || 0,
            icon: ShoppingCart,
            formatAsCurrency: false,
            gradient: 'from-amber-50 to-amber-100/50',
            border: 'border-amber-100',
            iconBg: 'bg-amber-500/20',
            iconColor: 'text-amber-700',
            titleColor: 'text-amber-800/70',
            valueColor: 'text-amber-900',
            onClick: () => setActiveMetricModal('TOTAL_ORDERS'),
          })}
          {renderSummaryCard({
            title: 'Avg Order Value',
            value: summaryData?.averageOrderValue || 0,
            icon: TrendingUp,
            formatAsCurrency: true,
            gradient: 'from-indigo-50 to-indigo-100/50',
            border: 'border-indigo-100',
            iconBg: 'bg-indigo-500/20',
            iconColor: 'text-indigo-700',
            titleColor: 'text-indigo-800/70',
            valueColor: 'text-indigo-900',
            onClick: () => setActiveMetricModal('AVG_ORDER_VALUE'),
          })}
          {renderSummaryCard({
            title: 'Repeat Customers',
            value: summaryData?.repeatCustomers || 0,
            icon: CheckCircle2,
            formatAsCurrency: false,
            gradient: 'from-purple-50 to-purple-100/50',
            border: 'border-purple-100',
            iconBg: 'bg-purple-500/20',
            iconColor: 'text-purple-700',
            titleColor: 'text-purple-800/70',
            valueColor: 'text-purple-900',
            onClick: () => setActiveMetricModal('REPEAT_CUSTOMERS'),
          })}
        </div>

        {/* Section B & C: Master Table Container (Matching Gmark ERP Master UI Design) */}
        <div className="master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] rounded-[20px] mb-8">
          {/* Action Bar Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[20px] flex-wrap">
            {/* Left Side: Search Box */}
            <div className="relative flex-1 max-w-[360px] min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search customer name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Right Side: Filters, Collapse/Expand, Refresh & Export Buttons */}
            <div className="flex items-center gap-3 flex-wrap ml-auto">
              {/* Filters Toggle Button */}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all bg-white cursor-pointer ${
                  showFilters || activeFiltersCount > 0
                    ? 'border-[#073318] text-[#073318] bg-emerald-50/40 shadow-xs'
                    : 'border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal size={16} className={showFilters || activeFiltersCount > 0 ? 'text-[#073318]' : 'text-gray-400'} />
                <span>Filters</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#073318] text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Collapse / Expand All Button */}
              <button
                type="button"
                onClick={toggleAllGroups}
                className="flex items-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all bg-white cursor-pointer"
              >
                {isAllExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={loadReportData}
                className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 bg-white cursor-pointer transition-colors"
                title="Refresh Report Data"
              >
                <RefreshCw size={18} className="text-gray-400 hover:text-[#073318]" />
              </button>

              {/* Export Dropdown (Matching GroupMaster and ERP Master tables) */}
              <div className="relative flex items-center gap-3" ref={exportRef}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exportLoading}
                  className={`flex items-center justify-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all duration-200 bg-white cursor-pointer disabled:opacity-50 ${
                    showExportMenu ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'
                  }`}
                >
                  <Upload size={18} className={showExportMenu ? 'text-[#073318]' : 'text-gray-400'} />
                  <span>Export</span>
                </button>

                {/* Export Dropdown Popover */}
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[50] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors cursor-pointer"
                    >
                      <FileText size={18} className="text-red-500" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet size={18} className="text-green-600" />
                      <span>Excel</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Filter Panel - Multi-Row Responsive Grid (No Horizontal Scroll) */}
          {showFilters && (
            <div className="bg-gray-50/70 px-6 py-4 border-b border-gray-200 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                {/* Customer Type Multi-select */}
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Customer Types</label>
                  <div className="flex flex-wrap items-center gap-1.5 p-1 border border-gray-200 rounded-xl bg-white min-h-[38px]">
                    {filterOptions.customerTypes.map((t) => {
                      const isChecked = selectedTypes.includes(t.id.toLowerCase());
                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => {
                            setSelectedTypes((prev) =>
                              isChecked ? prev.filter((x) => x !== t.id.toLowerCase()) : [...prev, t.id.toLowerCase()]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            isChecked
                              ? 'bg-[#073318] text-white shadow-2xs font-bold'
                              : 'bg-white text-gray-700 border border-gray-200/80 hover:bg-gray-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Customer */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Specific Customer</label>
                  <MultiSelectDropdown
                    options={filterOptions.customers}
                    selectedIds={selectedCustomerIds}
                    onChange={setSelectedCustomerIds}
                    placeholder="All Customers"
                  />
                </div>

                {/* Product Filter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Filter by Product</label>
                  <MultiSelectDropdown
                    options={filteredProducts}
                    selectedIds={selectedProductIds}
                    onChange={setSelectedProductIds}
                    placeholder="All Products"
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Category</label>
                  <MultiSelectDropdown
                    options={filterOptions.categories || []}
                    selectedIds={selectedCategoryIds}
                    onChange={handleCategoryChange}
                    placeholder="All Categories"
                  />
                </div>

                {/* Sub Category Filter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sub Category</label>
                  <MultiSelectDropdown
                    options={filteredSubCategories}
                    selectedIds={selectedSubCategoryIds}
                    onChange={handleSubCategoryChange}
                    placeholder="All Sub Categories"
                    disabled={filteredSubCategories.length === 0}
                  />
                </div>

                {/* Sub Sub Category Filter */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sub Sub Category</label>
                  <MultiSelectDropdown
                    options={filteredSubSubCategories}
                    selectedIds={selectedSubSubCategoryIds}
                    onChange={handleSubSubCategoryChange}
                    placeholder="All Sub-Sub Categories"
                    disabled={filteredSubSubCategories.length === 0}
                  />
                </div>

                {/* Amount Range & Reset */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Amount Range (₹)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min ₹"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full h-[38px] px-3 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#073318] shadow-2xs"
                    />
                    <span className="text-gray-400 text-xs font-bold shrink-0">-</span>
                    <input
                      type="number"
                      placeholder="Max ₹"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full h-[38px] px-3 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#073318] shadow-2xs"
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

          {/* Active Filter Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 bg-gray-50/50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">Active Filters:</span>
              {selectedTypes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#073318] border border-emerald-200"
                >
                  Type: {t}
                  <button
                    type="button"
                    onClick={() => setSelectedTypes((prev) => prev.filter((x) => x !== t))}
                    className="hover:text-red-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {selectedCustomerIds.map((id) => {
                const item = filterOptions.customers.find((c) => String(c.id) === String(id));
                return (
                  <span
                    key={`cust-${id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#073318] border border-emerald-200"
                  >
                    Customer: {item ? item.name : id}
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerIds((prev) => prev.filter((x) => String(x) !== String(id)))}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}

              {selectedProductIds.map((id) => {
                const item = filterOptions.products.find((p) => String(p.id) === String(id));
                return (
                  <span
                    key={`prod-${id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                  >
                    Product: {item ? item.name : id}
                    <button
                      type="button"
                      onClick={() => setSelectedProductIds((prev) => prev.filter((x) => String(x) !== String(id)))}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}

              {selectedCategoryIds.map((id) => {
                const item = filterOptions.categories?.find((c) => String(c.id) === String(id));
                return (
                  <span
                    key={`cat-${id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#073318] border border-emerald-200"
                  >
                    Category: {item ? item.name : id}
                    <button
                      type="button"
                      onClick={() => handleCategoryChange(selectedCategoryIds.filter((x) => String(x) !== String(id)))}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}

              {selectedSubCategoryIds.map((id) => {
                const item = filterOptions.subCategories?.find((sc) => String(sc.id) === String(id));
                return (
                  <span
                    key={`subcat-${id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200"
                  >
                    Sub-Category: {item ? item.name : id}
                    <button
                      type="button"
                      onClick={() => handleSubCategoryChange(selectedSubCategoryIds.filter((x) => String(x) !== String(id)))}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}

              {selectedSubSubCategoryIds.map((id) => {
                const item = filterOptions.subSubCategories?.find((ssc) => String(ssc.id) === String(id));
                return (
                  <span
                    key={`subsub-${id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200"
                  >
                    Sub-Sub: {item ? item.name : id}
                    <button
                      type="button"
                      onClick={() => handleSubSubCategoryChange(selectedSubSubCategoryIds.filter((x) => String(x) !== String(id)))}
                      className="hover:text-red-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}

              {minAmount !== '' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                  Min: ₹{minAmount}
                  <button type="button" onClick={() => setMinAmount('')} className="hover:text-red-600 cursor-pointer">
                    <X size={12} />
                  </button>
                </span>
              )}

              {maxAmount !== '' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                  Max: ₹{maxAmount}
                  <button type="button" onClick={() => setMaxAmount('')} className="hover:text-red-600 cursor-pointer">
                    <X size={12} />
                  </button>
                </span>
              )}

              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                  Search: "{searchTerm}"
                  <button type="button" onClick={() => setSearchTerm('')} className="hover:text-red-600 cursor-pointer">
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

          {/* Table Content or States */}
          {loading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Loader />
              <p className="text-xs text-gray-400 mt-2 font-medium">Loading customer sales report...</p>
            </div>
          ) : fetchError ? (
            <div className="p-10 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3">
                <AlertCircle size={24} />
              </div>
              <h4 className="text-base font-bold text-gray-900">Failed to Load Customer Sales Data</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-md">{fetchError}</p>
              <button
                type="button"
                onClick={loadReportData}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-[10px] bg-[#073318] text-white hover:bg-[#04200f] shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                Retry Loading Data
              </button>
            </div>
          ) : groupsData.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-gray-400">
              <Users size={48} className="mb-3 opacity-40 text-[#073318]" />
              <h4 className="text-base font-bold text-gray-700">No Customers Found</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                No sales records match the selected date period or applied filters. Try adjusting your filter parameters or selecting a broader date range.
              </p>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-4 px-4 py-1.5 text-xs font-bold rounded-[10px] bg-emerald-50 text-[#073318] hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Clear Applied Filters
                </button>
              )}
            </div>
          ) : (
            <div id="customer-sales-report-table-printable" className="bg-white">
              {/* Dark Green Banner Header (matching GroupMaster and ERP Master tables) */}
              <div className="px-6 py-3.5 bg-[#073318] text-white font-bold text-[13px] uppercase tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  <span>PARTICULAR</span>
                </div>
                <div className="font-bold text-[13px] uppercase tracking-wider text-white">
                  <span>AMT</span>
                </div>
              </div>

              {/* Customer Type Groups */}
              <div className="divide-y divide-gray-100">
                {groupsData.map((group) => {
                  const isExpanded = expandedGroups.has(group.customerType);
                  const groupCustomers = group.customers || [];

                  return (
                    <div key={group.customerType}>
                      {/* Group Header Row */}
                      <div
                        onClick={() => toggleGroup(group.customerType)}
                        className="flex items-center justify-between px-6 py-4 hover:bg-emerald-50/30 transition-colors cursor-pointer group font-semibold text-gray-700 select-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center w-5 h-5 rounded-[6px] bg-emerald-50 text-[#073318] font-black text-xs shrink-0 border border-emerald-100 shadow-2xs">
                            {isExpanded ? <Minus size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                          </span>
                          <span className="group-hover:translate-x-0.5 transition-transform font-bold text-gray-900 text-sm">
                            {group.customerTypeLabel}
                          </span>
                          {groupCustomers.length > 0 && (
                            <span className="text-[11px] font-bold text-[#073318] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {groupCustomers.length} {groupCustomers.length === 1 ? 'Customer' : 'Customers'}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-900 font-bold text-sm">
                          {formatCurrency(group.totalSales)}
                        </span>
                      </div>

                      {/* Sub-rows when Expanded */}
                      {isExpanded && (
                        <div className="bg-emerald-50/10 divide-y divide-gray-100 border-t border-b border-gray-100">
                          {groupCustomers.length === 0 ? (
                            <div className="pl-12 pr-6 py-3 text-xs text-gray-400 italic">
                              No customer transactions recorded under {group.customerTypeLabel}.
                            </div>
                          ) : (
                            groupCustomers.map((cust, cIdx) => (
                              <div
                                key={`cust-${cust.customerId || cIdx}`}
                                onClick={() => setMonthlyModalCustomer(cust)}
                                className="flex items-center justify-between pl-12 pr-6 py-2.5 bg-emerald-50/20 text-xs hover:bg-emerald-100/30 transition-colors cursor-pointer font-semibold text-gray-700 group"
                                title="Click to view monthly sales breakdown"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex h-1.5 w-1.5 rounded-full bg-[#073318] shrink-0"></span>
                                  <span className="font-bold text-gray-900 group-hover:text-[#073318] transition-colors truncate">
                                    {cust.customerName}
                                  </span>
                                  <span className="text-[11px] font-medium text-gray-500 shrink-0">
                                    ({cust.customerCode} • {cust.totalOrders} {cust.totalOrders === 1 ? 'order' : 'orders'}
                                    {selectedProductIds.length === 1
                                      ? ` for ${filterOptions.products?.find((p) => String(p.id) === String(selectedProductIds[0]))?.name || 'product'}`
                                      : selectedProductIds.length > 1
                                      ? ` for ${selectedProductIds.length} products`
                                      : ''})
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-bold text-emerald-950 text-sm">
                                    {formatCurrency(cust.netSales)}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}

                          {/* Group Subtotal Row */}
                          <div className="flex items-center justify-between pl-12 pr-6 py-2.5 bg-gray-100/80 font-bold text-xs text-gray-800">
                            <span className="font-extrabold uppercase tracking-wider">
                              TOTAL {group.customerTypeLabel.toUpperCase()}
                            </span>
                            <span className="text-gray-950 font-black text-sm">
                              {formatCurrency(group.totalSales)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Totals Header: Total Sales */}
              <div className="flex items-center justify-between px-6 py-3.5 bg-gray-100/90 font-bold border-t-2 border-gray-300 rounded-b-[20px]">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-800">
                  TOTAL SALES
                </span>
                <span className="text-gray-950 font-black text-sm">
                  {formatCurrency(summaryData?.totalSales || groupsData.reduce((s, g) => s + (g.totalSales || 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Sales Breakdown Modal */}
      {monthlyModalCustomer && (
        <CustomerMonthlySalesModal
          customer={monthlyModalCustomer}
          dateRange={{ dateFrom: fromDate, dateTo: toDate }}
          filterParams={{
            productIds: selectedProductIds.length > 0 ? selectedProductIds.join(',') : undefined,
            categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds.join(',') : undefined,
            subCategoryIds: selectedSubCategoryIds.length > 0 ? selectedSubCategoryIds.join(',') : undefined,
            subSubCategoryIds: selectedSubSubCategoryIds.length > 0 ? selectedSubSubCategoryIds.join(',') : undefined,
            activeProductName:
              selectedProductIds.length === 1
                ? filterOptions.products?.find((p) => String(p.id) === String(selectedProductIds[0]))?.name
                : selectedProductIds.length > 1
                ? `${selectedProductIds.length} Products`
                : undefined,
            activeCategoryName:
              selectedCategoryIds.length === 1
                ? filterOptions.categories?.find((c) => String(c.id) === String(selectedCategoryIds[0]))?.name
                : selectedCategoryIds.length > 1
                ? `${selectedCategoryIds.length} Categories`
                : undefined,
          }}
          onClose={() => setMonthlyModalCustomer(null)}
        />
      )}

      {/* Metric Info Breakdown Modal */}
      {activeMetricModal && (
        <MetricInfoModal
          isOpen={Boolean(activeMetricModal)}
          initialMetricKey={activeMetricModal}
          summaryData={summaryData}
          groupsData={groupsData}
          periodLabel={periodLabel || (fromDate && toDate ? `${formatDateDDMMYYYY(fromDate)} to ${formatDateDDMMYYYY(toDate)}` : 'All Time')}
          onSelectCustomer={(cust) => {
            setActiveMetricModal(null);
            setMonthlyModalCustomer(cust);
          }}
          onClose={() => setActiveMetricModal(null)}
        />
      )}
    </div>
  );
};

export default CustomerSalesReportView;
