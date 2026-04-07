import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Download,
  Filter,
  MoreVertical,
  X,
  FileText,
  FileSpreadsheet,
  Eye,
  FileEdit,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  ChevronsUpDown,
  Upload,
  CloudUpload,
  Trash2,
  XCircle
} from "lucide-react";
import toast from 'react-hot-toast';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { ROUTES } from "../../../constants/routes";
import { useTranslation } from 'react-i18next';

import purchaseOrderService from "../../../services/purchaseOrderService";

const DeleteConfirmModal = ({ isOpen, onCancel, onConfirm, isDeleting }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 size={32} className="text-red-500" />
          </div>
          <h3 className="text-[20px] font-bold text-[#111827] mb-2 font-outfit">
            Delete Purchase Order
          </h3>
          <p className="text-[#6B7280] text-[15px] font-medium mb-8">
            Are you sure you want to delete this purchase order? This action will mark the status as deleted.
          </p>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] border border-[#E5E7EB] text-[15px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all font-outfit"
            >
              No, Keep it
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] bg-red-600 hover:bg-red-700 text-white text-[15px] font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 font-outfit"
            >
              {isDeleting ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                "Yes, Delete"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PurchaseOrder = () => {
  const { t } = useTranslation(['modules', 'common']);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRefs = useRef({});
  const exportRef = useRef(null);

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Current date
  const currentDate = new Date();

  // Local Storage Data Retrieval
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Helper date formatting
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  // Fetch logic from API
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery,
        };

        // Map tabs to backend statuses if needed
        if (activeTab !== "All") {
          if (activeTab === "Pending") params.filter = "pending";
          if (activeTab === "Completed") params.filter = "completed";
          if (activeTab === "Deleted") params.filter = "deleted";
          if (activeTab === "Expiring Soon") params.filter = "expiring";
          if (activeTab === "Expired") params.filter = "expired";
        }

        const response = await purchaseOrderService.getPurchaseOrders(params);
        const data = Array.isArray(response) ? response : (response.data || []);
        setPurchaseOrders(data);
        setTotalItemsCount(response.meta?.total || data.length);
      } catch (error) {
        console.error("Error fetching purchase orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage, searchQuery, activeTab, isRefreshing]);

  // Helper date parsing
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr.includes("T")) {
      return new Date(dateStr);
    }
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [yearOrDay, month, dayOrYear] = parts;
      if (yearOrDay.length === 4) {
        return new Date(dateStr);
      }
      return new Date(Number(dayOrYear), Number(month) - 1, Number(yearOrDay));
    }
    return new Date(dateStr);
  };

  /**
   * Filter Logic
   */
  const filteredData = useMemo(() => {
    const mapped = purchaseOrders.map(po => {
      const status = po.status;
      const expDate = parseDate(po.expiryDate);
      const now = new Date();
      const expiryEndOfDay = new Date(expDate);
      expiryEndOfDay.setHours(23, 59, 59, 999);
      const diffHrs = (expiryEndOfDay.getTime() - now.getTime()) / (1000 * 60 * 60);

      let computedStatusLabel = "Pending";
      let bgClass = "bg-orange-100 text-orange-600";

      if (status === 'INVOICE_GENERATED') {
        computedStatusLabel = "Completed"; bgClass = "bg-emerald-100 text-emerald-600";
      } else if (status === 'DELETED') {
        computedStatusLabel = "Deleted"; bgClass = "bg-red-100 text-red-600";
      } else if (expiryEndOfDay < now) {
        computedStatusLabel = "Expired"; bgClass = "bg-red-100 text-red-600";
      } else if (diffHrs > 0 && diffHrs <= 48) {
        computedStatusLabel = "Expiring Soon"; bgClass = "bg-amber-100 text-amber-600";
      } else {
        computedStatusLabel = "Pending"; bgClass = "bg-gray-100 text-gray-600";
      }

      return { ...po, computedStatusLabel, bgClass };
    });

    if (activeTab === "All") return mapped;
    return mapped.filter(po => po.computedStatusLabel === activeTab);
  }, [purchaseOrders, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }
      if (activeDropdown !== null) {
        const ref = dropdownRefs.current[activeDropdown];
        if (ref && !ref.contains(event.target)) {
          setActiveDropdown(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown]);

  // Derived pagination data
  // Derived pagination data
  const totalItems = totalItemsCount;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredData; // API handles pagination slice

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  /**
   * Action: Refresh (Quick + Toast)
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Data refreshed successfully");
    }, 400);
  };

  const handleDeletePO = (id) => {
    setPoToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handlePrint = async (poData) => {
    try {
      setIsRefreshing(true);
      // We already have some data in poData, but it's better to fetch full details if items are missing
      // However, if the row already has what we need or we can fetch it:
      const fullPo = await purchaseOrderService.getPurchaseOrderById(poData.id);
      navigate(ROUTES.PURCHASE_ORDER_PRINT, { state: { poData: fullPo } });
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to load print preview");
    } finally {
      setIsRefreshing(false);
    }
  };

  const confirmDelete = async () => {
    if (!poToDelete) return;
    setIsDeleting(true);
    try {
      await purchaseOrderService.deletePurchaseOrder(poToDelete);
      toast.success("Purchase order deleted successfully");
      setIsDeleteModalOpen(false);
      setPoToDelete(null);
      // Refresh items:
      setIsRefreshing(prev => !prev); // Toggle to trigger useEffect
    } catch (error) {
      console.error("Error deleting PO:", error);
      const errorMsg = error.response?.data?.message || "Failed to delete Purchase Order";
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Export Logic
   */
  /**
   * Universal Export Handler (Backend Driven)
   */
  const handleExport = async (format) => {
    try {
      setIsExportOpen(false);
      setIsRefreshing(true);

      const params = {
        format,
        filter: activeTab === "All" ? "all" : activeTab.toLowerCase(),
        search: searchQuery
      };

      const response = await purchaseOrderService.exportPurchaseOrders(params);

      // Trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `purchase_orders_${activeTab.toLowerCase()}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportPDF = () => handleExport('pdf');
  const handleExportExcel = () => handleExport('xlsx');

  const handleDownloadSample = async () => {
    try {
      const response = await purchaseOrderService.downloadSample();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'PO_Import_Sample.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading sample:", error);
    }
  };

  const handleSubmitImport = async () => {
    if (!selectedFile) return;
    try {
      setIsRefreshing(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      await purchaseOrderService.importPurchaseOrders(formData);
      setIsImportModalOpen(false);
      setSelectedFile(null);
      toast.success("Data imported successfully");
      // Trigger data refresh from backend
      // fetchData will run because isRefreshing changes or by directly calling it if needed.
      // Actually handleRefresh simulates a small delay then calls it? No it just sets isRefreshing.
      // I'll call handleRefresh.
      handleRefresh();
    } catch (error) {
      console.error("Error importing PO:", error);
      toast.error(error.response?.data?.message || "Import failed. Please verify your columns.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusTabs = ["All", "Pending", "Expiring Soon", "Expired", "Completed", "Deleted"];

  return (
    <div className="flex flex-col w-full relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
            height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #E5E7EB;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #A7C0B8;
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #073318;
        }
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      {/* Title Section */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 md:mb-8 justify-between items-start md:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">
            {t('modules:purchase_order', 'Purchase Order')}
          </h1>
          {/* <p className="text-[#6B7280] text-[14px] md:text-[15px]">
                {t('modules:purchase_order_desc', 'View, verify, and monitor all purchase orders, supplier invoices, and stock procurement activities.')}
              </p> */}
        </div>
        <button
          onClick={() => navigate('/seller/purchase/order/add')}
          className="px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2 flex-shrink-0"
        >
          <Plus size={18} />
          {t('modules:add_po', 'Add PO')}
        </button>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-8 border-b border-[#E5E7EB] mb-8 overflow-x-auto no-scrollbar scrollbar-hide md:justify-center">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
            className={`pb-4 text-[14px] font-semibold transition-all duration-200 relative whitespace-nowrap
              ${activeTab === tab
                ? 'text-[#073318] after:absolute after:bottom-[-1px] after:left-0 after:w-full after:h-[2px] after:bg-[#073318]'
                : 'text-[#6B7280] hover:text-[#111827]'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table Area */}
      <div className="flex flex-col bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] w-full overflow-hidden mb-8">
        {/* Action Bar - Mobile Optimized */}
        <div className="flex flex-col items-stretch p-4 md:p-6 border-b border-[#F3F4F6] bg-white gap-4">
          {/* Desktop View Action Bar */}
          <div className="hidden md:flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-[320px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder={t('common:search_by_anything', 'Search By Anything...')}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all placeholder:text-gray-400 shadow-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={handleRefresh}
                className={`flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] hover:bg-gray-50 bg-white shadow-sm transition-all flex-shrink-0 ${isRefreshing ? 'animate-spin border-[#073318] text-[#073318]' : ''}`}
                disabled={isRefreshing}
                title="Refresh"
              >
                <RefreshCw size={18} className={isRefreshing ? "text-[#073318]" : "text-gray-400"} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 shadow-sm transition-all"
              >
                <Upload size={18} className="text-gray-400" />
                {t('common:import', 'Import')}
              </button>

              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className={`flex items-center justify-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 shadow-sm transition-all ${isExportOpen ? 'border-[#073318] text-[#073318]' : ''}`}
                >
                  <Download size={18} className="text-gray-400" />
                  {t('common:export', 'Export')}
                </button>
                {isExportOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={handleExportPDF}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#0A3622] transition-colors"
                    >
                      <FileText size={18} className="text-red-500" /> {t('common:pdf', 'PDF')}
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#0A3622] transition-colors"
                    >
                      <FileSpreadsheet size={18} className="text-green-600" /> {t('common:excel', 'Excel')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile View Action Bar (Standardized Layout) */}
          <div className="flex md:hidden flex-col gap-3">
            {/* Single Row: Search and Quick Actions */}
            <div className="flex items-center gap-2">
              <div className={`relative transition-all duration-300 ease-in-out ${isSearchFocused || searchQuery ? 'flex-1' : 'w-[42px]'}`}>
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${isSearchFocused || searchQuery ? 'text-[#073318]' : 'text-gray-500'}`} size={22} />
                <input
                  type="text"
                  placeholder={isSearchFocused || searchQuery ? "Search orders..." : ""}
                  value={searchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className={`w-full h-[42px] bg-[#F9FAFB] rounded-[10px] pl-10 pr-8 text-[14px] outline-none transition-all duration-300
                                ${isSearchFocused || searchQuery ? 'border border-[#073318]/20 ring-1 ring-[#073318]/5' : 'border-none bg-transparent cursor-pointer'}`}
                />
                {(isSearchFocused || searchQuery) && searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {(isSearchFocused || searchQuery) && (
                <button
                  onClick={() => {
                    setIsSearchFocused(false);
                    setSearchQuery("");
                  }}
                  className="text-[#073318] text-[14px] font-bold px-1 animate-in fade-in slide-in-from-right-2 duration-200"
                >
                  Cancel
                </button>
              )}

              {/* Action Icons - Hidden when searching on mobile */}
              {!isSearchFocused && !searchQuery && (
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={handleRefresh}
                    className="w-[42px] h-[42px] flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
                  >
                    <RefreshCw size={22} className={isRefreshing ? 'animate-spin text-[#073318]' : ''} />
                  </button>

                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="w-[42px] h-[42px] flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
                  >
                    <Upload size={22} />
                  </button>

                  <div className="relative mobile-export-trigger px-0">
                    <button
                      onClick={() => setIsExportOpen(!isExportOpen)}
                      className={`w-[42px] h-[42px] flex items-center justify-center transition-all ${isExportOpen ? 'text-[#073318]' : 'text-gray-500'}`}
                    >
                      <Download size={22} />
                    </button>
                    {isExportOpen && (
                      <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[100] py-2 overflow-hidden">
                        <button onClick={handleExportPDF} className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 active:bg-gray-50 border-none bg-transparent">
                          <FileText size={18} className="text-red-500" /> PDF
                        </button>
                        <button onClick={handleExportExcel} className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 active:bg-gray-50 border-none bg-transparent">
                          <FileSpreadsheet size={18} className="text-green-600" /> Excel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto w-full min-h-[400px] custom-scrollbar">
          <table className="w-full min-w-[1500px] border-collapse text-left">
            <thead>
              <tr className="bg-emerald-900 border-b border-emerald-950 text-[15px] font-bold text-white tracking-tight">
                {[
                  "Po No", "Supplier Name", "Creation Date", "Expiry Date", "Amount",
                  "Gst Number", "Credit Days", "Tax Amount", "Total Amount", "Status"
                ].map((col) => (
                  <th key={col} className="px-6 py-5 border-r border-white/50 whitespace-nowrap tracking-tight">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-white/80 transition-colors tracking-tight">
                      {col}
                      <ChevronsUpDown size={14} className="text-white opacity-80" />
                    </div>
                  </th>
                ))}
                <th className="px-6 py-5 text-center w-[100px] whitespace-nowrap tracking-tight">Action</th>
              </tr>
            </thead>
            <tbody className={`text-[14px] text-[#111827] transition-opacity duration-300 ${isRefreshing ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              {(isLoading ? Array(5).fill({}) : currentItems).length > 0 ? (
                (isLoading ? Array(5).fill({}) : currentItems).map((po, index) => (
                  <tr key={po.id || index} className={`border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors group ${isLoading ? 'animate-pulse' : ''}`}>
                    <td className="px-6 py-5 font-bold border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-20"></div> : po.poNumber}
                    </td>
                    <td className="px-6 py-5 font-bold border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-40"></div> : po.supplierName}
                    </td>
                    <td className="px-6 py-5 text-[#4B5563] border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-24"></div> : formatDate(po.poCreationDate)}
                    </td>
                    <td className="px-6 py-5 text-[#4B5563] border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-24"></div> : formatDate(po.expiryDate)}
                    </td>
                    <td className="px-6 py-5 font-medium border-r border-[#F3F4F6] text-[#4B5563]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-16"></div> : (po.totalAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-[#4B5563] border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-32"></div> : (po.gstNumber || '-')}
                    </td>
                    <td className="px-6 py-5 text-[#4B5563] border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-8"></div> : (po.creditDays || 0)}
                    </td>
                    <td className="px-6 py-5 text-[#4B5563] border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-16"></div> : (po.taxAmount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-5 font-bold border-r border-[#F3F4F6] text-[#111827]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-20"></div> : (po.grandTotal || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-[#4B5563] border-r border-[#F3F4F6]">
                      {isLoading ? <div className="h-4 bg-gray-200 rounded w-20"></div> : (
                        <span className={`px-3 py-1 ${po.bgClass} rounded-full text-[12px] font-bold uppercase shadow-sm whitespace-nowrap`}>{po.computedStatusLabel}</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center relative" ref={el => dropdownRefs.current[po.id] = el}>
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === po.id ? null : po.id)}
                        className={`p-2 rounded-lg transition-all ${activeDropdown === po.id ? 'bg-gray-100 text-[#111827]' : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'}`}
                      >
                        <MoreVertical size={20} />
                      </button>

                      {activeDropdown === po.id && (
                        <div className={`absolute right-[calc(50%+1.25rem)] w-max min-w-[180px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in duration-200 text-left ${index >= currentItems.length - 2 ? 'bottom-0 mb-2' : 'top-0 mt-2'}`}>
                          <button
                            onClick={() => { setActiveDropdown(null); navigate(ROUTES.PURCHASE_ORDER_VIEW.replace(':id', po.id)); }}
                            className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors font-bold border-b border-gray-50"
                          >
                            <Eye size={18} className="text-gray-400" />
                            {(po.computedStatusLabel === 'Pending' || po.computedStatusLabel === 'Expiring Soon')
                              ? t('common:view_and_edit_po', 'View and edit PO')
                              : t('common:view_po', 'View PO')
                            }
                          </button>

                          {(po.computedStatusLabel === 'Pending' || po.computedStatusLabel === 'Expiring Soon' || po.computedStatusLabel === 'Completed') && (
                            <button
                              onClick={() => { setActiveDropdown(null); handlePrint(po); }}
                              className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] transition-colors font-bold border-b border-gray-50"
                            >
                              <Download size={18} className="text-gray-400" />
                              Print PO
                            </button>
                          )}

                          {po.computedStatusLabel !== 'Deleted' && (
                            <button
                              onClick={() => { setActiveDropdown(null); handleDeletePO(po.id); }}
                              className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-red-600 hover:bg-red-50 transition-colors font-bold"
                            >
                              <XCircle size={18} className="text-red-500" />
                              {t('common:delete', 'delete')}
                            </button>
                          )}
                        </div>
                      )}
                    </td >
                  </tr >
                ))
              ) : (
                <tr>
                  <td colSpan="11" className="px-6 py-20 text-center text-gray-400 font-medium">
                    No results found for {activeTab}
                  </td>
                </tr>
              )}
            </tbody >
          </table >
          {isRefreshing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/20 backdrop-blur-[1px] transition-all">
              <div className="w-10 h-10 border-4 border-[#073318]/10 border-t-[#073318] rounded-full animate-spin"></div>
            </div>
          )}
        </div >

        {/* Pagination Section - Standardized Single Row */}
        < div className="flex flex-row items-center justify-between px-4 sm:px-8 py-4 sm:py-6 border-t border-[#F3F4F6] bg-white gap-2" >
          <div className="flex items-center gap-2 text-[13px] sm:text-[14px] text-[#6B7280] font-medium min-w-fit">
            <span>Show</span>
            <div className="relative group">
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="appearance-none border border-[#E5E7EB] rounded-[8px] pl-2 sm:pl-3 pr-6 sm:pr-8 py-1 sm:py-1.5 outline-none focus:border-[#073318] text-[#111827] bg-[#F9FAFB] cursor-pointer font-bold transition-all hover:bg-white text-[13px] sm:text-[14px]"
              >
                {[5, 10, 20, 50].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#073318]" />
            </div>
            <span className="hidden xs:inline">per page</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            <span className="text-[#6B7280] text-[12px] sm:text-[14px] font-medium whitespace-nowrap">
              {totalItems > 0
                ? `${((currentPage - 1) * itemsPerPage) + 1}–${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems}`
                : '0-0 of 0'}
            </span>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px] border border-transparent hover:border-gray-100"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePageChange(i + 1)}
                    className={`min-w-[40px] h-[40px] rounded-[10px] flex items-center justify-center transition-all text-[14px] font-bold
                      ${currentPage === i + 1
                        ? 'bg-[#F9FAFB] text-[#111827] shadow-sm border border-gray-100'
                        : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => handlePageChange(currentPage + 1)}
                className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px] border border-transparent hover:border-gray-100"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div >
      </div >

      {/* Import Modal */}
      {
        isImportModalOpen && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-[4px] animate-in fade-in duration-300 p-4"
            onClick={() => setIsImportModalOpen(false)}
          >
            <div
              className="bg-white w-full max-w-[500px] rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
                <h3 className="text-[18px] font-bold text-[#111827]">Import Data</h3>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 sm:p-8 flex flex-col items-center gap-6 sm:gap-10">
                {/* Download Sample */}
                <button
                  onClick={handleDownloadSample}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#AFC9BD]/40 text-[#073318] rounded-[10px] text-[14px] font-bold hover:bg-[#AFC9BD]/60 transition-all font-outfit"
                >
                  <Download size={18} />
                  Download Sample
                </button>

                {/* Upload Section */}
                <div className="w-full flex flex-col items-center gap-3">
                  <span className="text-[15px] font-bold text-[#4B5563]">Upload File</span>
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                    <span className="hidden sm:inline text-[14px] text-gray-400 font-medium whitespace-nowrap">Select File</span>
                    <div className="flex-1 flex items-center border border-dashed border-gray-300 rounded-[8px] h-[44px] overflow-hidden w-full">
                      <label className="h-full px-4 flex items-center justify-center bg-gray-50 border-r border-dashed border-gray-300 text-[13px] font-bold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors">
                        Choose
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setSelectedFile(e.target.files[0])}
                        />
                      </label>
                      <span className="px-4 text-[13px] text-gray-400 truncate flex-1">
                        {selectedFile ? selectedFile.name : 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  onClick={handleSubmitImport}
                  disabled={!selectedFile || isRefreshing}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-3 rounded-[12px] text-[15px] font-bold transition-all shadow-sm font-outfit
                          ${selectedFile && !isRefreshing
                      ? 'bg-[#073318] text-white hover:bg-[#04200f] shadow-[#073318]/20'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  <CloudUpload size={20} />
                  {isRefreshing ? 'Importing...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )
      }
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        onCancel={() => { setIsDeleteModalOpen(false); setPoToDelete(null); }}
        onConfirm={confirmDelete}
      />
    </div >
  );
};

export default PurchaseOrder;
