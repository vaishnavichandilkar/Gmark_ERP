import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  ChevronsUpDown,
  Upload,
  CloudUpload,
  Trash2,
  XCircle,
  Check,
  Printer
} from "lucide-react";
import toast from 'react-hot-toast';
import { ROUTES } from "@/constants/routes";
import { useTranslation } from 'react-i18next';

import purchaseOrderService from "@/services/purchaseOrderService";
import ScrollableTable from "@/components/common/ScrollableTable";
import FilterDropdown from "@/pages/dashboard/masters/components/FilterDropdown";
import ImportModal from "@/pages/dashboard/masters/components/ImportModal";
import CustomSelect from "@/components/common/CustomSelect";
import { formatDate } from "@/utils/dateUtils";

const DeleteConfirmModal = ({ isOpen, onCancel, onConfirm, isDeleting, t }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={onCancel} />
      <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 size={32} className="text-red-500" />
          </div>
          <h3 className="text-[20px] font-bold text-[#111827] mb-2 font-outfit uppercase tracking-tight">
            {t('modules:delete_po')}
          </h3>
          <p className="text-[#6B7280] text-[15px] font-medium mb-8 font-outfit">
            {t('modules:delete_po_confirm')}
          </p>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] border border-[#E5E7EB] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all font-outfit uppercase tracking-widest"
            >
              {t('common:no_keep_it')}
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] bg-red-600 hover:bg-red-700 text-white text-[14px] font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 font-outfit uppercase tracking-widest"
            >
              {isDeleting ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                t('common:yes_delete')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PurchaseOrder = () => {
  const statusTabs = ["All", "Pending", "Expiring Soon", "Expired", "Completed", "Deleted"];
  const { t } = useTranslation(['modules', 'common']);
  const navigate = useNavigate();

  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("All");

  // Filter State
  const defaultFilters = { status: "All" };
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterInputs, setFilterInputs] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const isFilterApplied = appliedFilters.status !== "All";

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Refs
  const dropdownRefs = useRef({});
  const exportRef = useRef(null);
  const filterRef = useRef(null);

  // Helper: Date Format


  // Helper: Date Parse
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr.includes("T")) return new Date(dateStr);
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [yearOrDay, month, dayOrYear] = parts;
      if (yearOrDay.length === 4) return new Date(dateStr);
      return new Date(Number(dayOrYear), Number(month) - 1, Number(yearOrDay));
    }
    return new Date(dateStr);
  };

  // Logic: Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
      };

      const statusFilter = appliedFilters.status;
      if (statusFilter !== "All") {
        const statusMap = {
          "Pending": "pending",
          "Completed": "completed",
          "Deleted": "deleted",
          "Expiring Soon": "expiring",
          "Expired": "expired"
        };
        params.filter = statusMap[statusFilter];
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

  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage, searchQuery, appliedFilters]);

  // Logic: Click Outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click was outside export trigger/menu
      const isOutsideExport =
        (!exportRef.current || !exportRef.current.contains(event.target));

      if (isOutsideExport) {
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

  // Memoized: Computed Data
  const filteredData = useMemo(() => {
    const rawMapped = purchaseOrders.map(po => {
      const status = po.status;
      const expDate = parseDate(po.expiryDate);
      const now = new Date();
      const expiryEndOfDay = new Date(expDate);
      expiryEndOfDay.setHours(23, 59, 59, 999);
      const diffHrs = (expiryEndOfDay.getTime() - now.getTime()) / (1000 * 60 * 60);

      let computedStatusLabel = "Pending";
      let bgClass = "bg-orange-100 text-orange-600";

      if (status === 'DELETED') {
        computedStatusLabel = "Deleted"; bgClass = "bg-red-50 text-red-600 border border-red-100";
      } else if (status === 'INVOICE_GENERATED' || status === 'INVOICE_COMPLETED' || status === 'COMPLETED') {
        computedStatusLabel = "Completed"; bgClass = "bg-emerald-50 text-emerald-600 border border-emerald-100";
      } else if (status === 'GRN_COMPLETED') {
        computedStatusLabel = "GRN Completed"; bgClass = "bg-teal-50 text-teal-600 border border-teal-100";
      } else if (po.grn?.length > 0 || po.purchaseInvoices?.length > 0) {
        computedStatusLabel = "Partial GRN"; bgClass = "bg-indigo-50 text-indigo-600 border border-indigo-100";
      } else if (expiryEndOfDay < now) {
        computedStatusLabel = "Expired"; bgClass = "bg-red-50 text-red-600 border border-red-100";
      } else if (diffHrs > 0 && diffHrs <= 48) {
        computedStatusLabel = "Expiring Soon"; bgClass = "bg-amber-50 text-amber-600 border border-amber-100";
      } else {
        computedStatusLabel = "Pending"; bgClass = "bg-blue-50 text-blue-600 border border-blue-100";
      }

      return { ...po, computedStatusLabel, bgClass };
    });

    // Refine based on applied filter
    if (!appliedFilters.status || appliedFilters.status === "All") return rawMapped;
    return rawMapped.filter(item => item.computedStatusLabel === appliedFilters.status);
  }, [purchaseOrders, appliedFilters.status]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentItems = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handlers
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      toast.success(t('common:data_refreshed'));
    } catch (error) {
      toast.error(t('common:failed_to_refresh'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApplyFilter = () => {
    setAppliedFilters(filterInputs);
    setIsFilterOpen(false);
    setCurrentPage(1);
  };

  const handleClearFilter = () => {
    setFilterInputs(defaultFilters);
    setAppliedFilters(defaultFilters);
    setIsFilterOpen(false);
    setCurrentPage(1);
  };

  const handleDeletePO = (id) => {
    setPoToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!poToDelete) return;
    setIsDeleting(true);

    // Close modal immediately for snappy feel
    setIsDeleteModalOpen(false);
    const deletedId = poToDelete;
    setPoToDelete(null);

    // Optimistic Update: Remove from local state immediately
    const previousOrders = [...purchaseOrders];
    setPurchaseOrders(prev => prev.filter(po => po.id !== deletedId));

    try {
      await purchaseOrderService.deletePurchaseOrder(deletedId);
      toast.success(t('modules:po_deleted'));
      // Optional: Refetch after a small delay to sync with server
      setTimeout(fetchData, 500);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error.response?.data?.message || t('modules:failed_to_delete_po'));
      // Revert if error
      setPurchaseOrders(previousOrders);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = async (poData) => {
    try {
      setIsRefreshing(true);
      const fullPo = await purchaseOrderService.getPurchaseOrderById(poData.id);
      const poToPrint = fullPo.data || fullPo;

      // Ensure items have both printDescription and description for preview compatibility
      if (poToPrint.items) {
        poToPrint.items = poToPrint.items.map(it => ({
          ...it,
          printDescription: it.printDescription || it.description || it.print_description || it.productName || it.product_name || '',
          description: it.description || it.printDescription || it.print_description || it.productName || it.product_name || ''
        }));
      }

      navigate(ROUTES.PURCHASE_ORDER_PRINT, {
        state: {
          poData: poToPrint,
          from: '/seller/purchase/order'
        }
      });
    } catch (error) {
      console.error("Print error:", error);
      toast.error(t('modules:failed_to_load_print'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = async (format) => {
    try {
      if (purchaseOrders.length === 0) {
        toast.error(t('modules:no_data_to_export'));
        setIsExportOpen(false);
        return;
      }
      setIsExportOpen(false);
      setIsRefreshing(true);
      const params = {
        format,
        filter: appliedFilters.status === "All" ? "all" : appliedFilters.status.toLowerCase(),
        search: searchQuery
      };
      const response = await purchaseOrderService.exportPurchaseOrders(params);
      if (response && response.data) {
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `purchase_orders.${format}`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        toast.success(t('common:export_pdf_success'));
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error(t('common:export_failed'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadSample = async () => {
    const response = await purchaseOrderService.downloadSample();
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'PO_Sample.xlsx');
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const handleSubmitImport = async (formData) => {
    try {
      setIsRefreshing(true);
      await purchaseOrderService.importPurchaseOrders(formData);
      setIsImportModalOpen(false);
      toast.success(t('modules:data_imported'));
      handleRefresh();
      return Promise.resolve();
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error.response?.data?.message || t('common:import_failed'));
      return Promise.reject(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Title & Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 md:mb-8 justify-between items-center font-outfit">
        <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">{t('modules:purchase_order', 'Purchase Order')}</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem('add_po_draft');
            navigate('/seller/purchase/order/add');
          }}
          className="px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 duration-200"
        >
          <Plus size={18} /> {t('modules:add_po', 'Add PO')}
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden mb-8 font-outfit">
        {/* Action Bar */}
        <div className="p-4 md:p-6 border-b border-[#F3F4F6] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-[320px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={t('common:search_by_anything', 'Search by anything...')}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10"
              />
              {searchQuery && <X size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setSearchQuery("")} />}
            </div>
            <button
              onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)}
              className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all shadow-sm ${isFilterApplied ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}
            >
              <Filter size={18} className={isFilterApplied ? "text-red-500" : "text-gray-400"} />
              {isFilterApplied ? t('common:clear', 'Clear') : t('common:filter', 'Filter')}
            </button>
            <button onClick={handleRefresh} className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 bg-white">
              <RefreshCw size={18} className={`text-gray-400 ${isRefreshing ? 'animate-spin border-[#073318]' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-6 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all"
            >
              <Download size={18} /> {t('common:import')}
            </button>
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setIsExportOpen(!isExportOpen)}
                className={`flex items-center gap-2 px-6 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all bg-white ${isExportOpen ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}
              >
                <Upload size={18} /> {t('common:export')}
              </button>
              {isExportOpen && (
                <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700">
                    <FileText size={18} className="text-red-500" /> {t('common:pdf')}
                  </button>
                  <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700">
                    <FileSpreadsheet size={18} className="text-green-600" /> {t('common:excel')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <ScrollableTable>
          <table className="w-full min-w-[1500px] border-collapse text-left font-outfit">
            <thead>
              <tr className="bg-emerald-900 text-white font-bold text-[15px]">
                {[
                  t('modules:po_no'), t('modules:supplier_name'), t('modules:creation_date'),
                  t('modules:expiry_date'), t('modules:gst_number_col'), t('modules:credit_days_col'),
                  t('modules:tax_amount_col'), t('modules:total_amount_col'), t('common:status'), t('common:action')
                ].map(h => (
                  <th key={h} className="px-6 py-5 border-r border-white/10 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`text-[14px] text-[#111827] ${isRefreshing ? 'opacity-40' : 'opacity-100'}`}>
              {currentItems.length > 0 ? (
                currentItems.map((po, idx) => (
                  <tr key={po.id || idx} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                    <td className="px-6 py-5">{po.poNumber}</td>
                    <td className="px-6 py-5 font-bold">
                      {po.supplierName ? po.supplierName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : '-'}
                    </td>
                    <td className="px-6 py-5 text-[#4B5563]">{formatDate(po.poCreationDate)}</td>
                    <td className="px-6 py-5 text-[#4B5563]">{formatDate(po.expiryDate)}</td>
                    <td className="px-6 py-5 text-center">{po.gstNumber || '-'}</td>
                    <td className="px-6 py-5 text-center">{po.creditDays || 0}</td>
                    <td className="px-6 py-5 text-center">{(po.taxAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-5 text-[#073318]">{(po.totalAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-4 py-1.5 ${po.bgClass} rounded-full text-[12px] font-bold shadow-sm inline-flex min-w-[100px] justify-center`}>{t(`common:status_${po.computedStatusLabel.toLowerCase().replace(' ', '_')}`, po.computedStatusLabel)}</span>
                    </td>
                    <td className="px-6 py-5 text-center relative" ref={el => dropdownRefs.current[po.id] = el}>
                      <button onClick={() => setActiveDropdown(activeDropdown === po.id ? null : po.id)} className={`p-2 rounded-lg ${activeDropdown === po.id ? 'bg-[#073318] text-white' : 'text-gray-400 hover:bg-gray-100'}`}><MoreVertical size={20} /></button>
                      {activeDropdown === po.id && (
                        <div className={`absolute right-full mr-2 w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[110] py-2 animate-in zoom-in-95 duration-200 text-left font-bold ${idx >= currentItems.length - 2 ? 'bottom-0' : 'top-0'}`}>
                          {/* VIEW / VIEW & EDIT */}
                          {((['Pending', 'Expiring Soon'].includes(po.computedStatusLabel)) && !(po.grn?.length > 0 || po.purchaseInvoices?.length > 0)) ? (
                            <button onClick={() => navigate(ROUTES.PURCHASE_ORDER_VIEW.replace(':id', po.id))} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50 underline-offset-4 decoration-emerald-500 hover:text-emerald-700"><Eye size={18} /> {t('modules:view_edit_po')}</button>
                          ) : (
                            <button onClick={() => navigate(ROUTES.PURCHASE_ORDER_VIEW.replace(':id', po.id))} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50"><Eye size={18} /> {t('modules:view_po_action')}</button>
                          )}

                          {/* PRINT */}
                          {['Pending', 'Expiring Soon', 'Completed', 'Expired', 'GRN Completed', 'Partial GRN'].includes(po.computedStatusLabel) && (
                            <button onClick={() => handlePrint(po)} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50"><Printer size={18} /> {t('modules:print_po')}</button>
                          )}

                          {/* DELETE */}
                          {['Expired'].includes(po.computedStatusLabel) && (
                            <button onClick={() => handleDeletePO(po.id)} className="w-full px-5 py-3.5 flex items-center gap-3 text-red-600 hover:bg-red-50"><Trash2 size={18} /> {t('modules:delete_action')}</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="11" className="px-6 py-24 text-center text-gray-400 uppercase font-bold tracking-widest">{t('common:no_results_found')}</td></tr>
              )}
            </tbody>
          </table>
        </ScrollableTable>

        {/* Pagination */}
        <div className="px-8 py-5 border-t border-[#F3F4F6] bg-[#F9FAFB] flex flex-row items-center justify-between uppercase">
          <div className="flex items-center gap-2 text-[14px] font-bold text-[#6B7280]">
            <span>{t('common:show')}</span>
            <CustomSelect 
                value={itemsPerPage}
                onChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                }}
                options={[5, 10, 20, 50]}
                menuPlacement="top"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#6B7280] text-[14px] font-bold lowercase">{totalItemsCount > 0 ? `${((currentPage - 1) * itemsPerPage) + 1}–${Math.min(currentPage * itemsPerPage, totalItemsCount)} of ${totalItemsCount}` : '0-0 of 0'}</span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all"><ArrowLeft size={18} /></button>
              <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => handlePageChange(currentPage + 1)} className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all"><ArrowRight size={18} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Overlays - Using Portals to break out of layout constraints */}
      {createPortal(
        <>
          <DeleteConfirmModal isOpen={isDeleteModalOpen} isDeleting={isDeleting} onCancel={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} t={t} />

          {isImportModalOpen && (
            <ImportModal
              isOpen={isImportModalOpen}
              onClose={() => setIsImportModalOpen(false)}
              onImport={handleSubmitImport}
              onDownloadSample={handleDownloadSample}
            />
          )}

          {isRefreshing && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
              <div className="relative bg-white/95 px-12 py-10 rounded-[32px] shadow-2xl flex flex-col items-center gap-5 animate-in zoom-in-95 duration-400">
                <RefreshCw size={48} className="text-[#073318] animate-spin" />
                <p className="font-bold text-[#073318] uppercase tracking-widest font-outfit">{t('common:processing')}</p>
              </div>
            </div>
          )}

          {/* Filter Sidebar */}
          {isFilterOpen && (
            <div
              className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-[2px] transition-all duration-300 ease-in-out"
              onClick={() => setIsFilterOpen(false)}
            />
          )}
          <div className={`fixed top-0 right-0 h-full w-screen sm:w-[440px] bg-white shadow-2xl z-[110] transform transition-all duration-300 ease-in-out flex flex-col font-outfit ${isFilterOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#04200f] bg-emerald-900">
              <h2 className="text-[20px] font-bold text-white tracking-tight text-transform-none">{t('modules:apply_filters_title')}</h2>
              <button onClick={() => setIsFilterOpen(false)} className="text-emerald-100 hover:text-white transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 px-5 sm:px-8 py-6 sm:py-8 overflow-y-auto space-y-6 sm:space-y-7 pb-32">
              <FilterDropdown
                label={t('common:status')}
                name="status"
                value={filterInputs.status}
                onChange={(e) => setFilterInputs({ ...filterInputs, status: e.target.value })}
                options={[
                  { label: t('common:status_all'), value: 'All' },
                  { label: t('common:status_pending'), value: 'Pending' },
                  { label: t('common:status_expiring_soon'), value: 'Expiring Soon' },
                  { label: t('common:status_expired'), value: 'Expired' },
                  { label: t('common:status_completed'), value: 'Completed' },
                  { label: t('common:status_deleted'), value: 'Deleted' }
                ]}
              />
            </div>

            <div className="px-8 py-6 border-t border-[#E5E7EB] flex items-center gap-4 bg-white">
              <button
                onClick={handleClearFilter}
                className="flex-1 h-[46px] bg-white border border-[#E5E7EB] text-[#374151] text-[15px] font-semibold rounded-[10px] hover:bg-gray-50 transition-colors shadow-sm"
              >
                {t('common:clear', 'Clear')}
              </button>
              <button
                onClick={handleApplyFilter}
                className="flex-1 h-[46px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-colors shadow-sm"
              >
                {t('common:apply_filter', 'Apply Filter')}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default PurchaseOrder;
