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
import { ROUTES } from "../../../constants/routes";
import { useTranslation } from 'react-i18next';

import salesOrderService from "../../../services/salesOrderService";
import ScrollableTable from "../../../components/common/ScrollableTable";

const DeleteConfirmModal = ({ isOpen, onCancel, onConfirm, isDeleting }) => {
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
            Delete Sales Order
          </h3>
          <p className="text-[#6B7280] text-[15px] font-medium mb-8 font-outfit">
            Are you sure you want to delete this sales order? This action will mark the status as deleted.
          </p>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] border border-[#E5E7EB] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all font-outfit uppercase tracking-widest"
            >
              No, Keep it
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] bg-red-600 hover:bg-red-700 text-white text-[14px] font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 font-outfit uppercase tracking-widest"
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

const SalesOrder = () => {
  const statusTabs = ["All", "Pending", "Completed", "Deleted"];
  const { t } = useTranslation(['modules', 'common']);
  const navigate = useNavigate();
  
  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [soToDelete, setSoToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [salesOrders, setSalesOrders] = useState([]);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [activeTab, setActiveTab] = useState("All");

  // Filter State
  const defaultFilters = { status: "All" };
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterInputs, setFilterInputs] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const isFilterApplied = appliedFilters.status !== "All";

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Refs
  const dropdownRefs = useRef({});
  const exportRef = useRef(null);
  const filterRef = useRef(null);

  // Helper: Date Format
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  // Logic: Fetch Data
  useEffect(() => {
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
            "Deleted": "deleted"
          };
          params.filter = statusMap[statusFilter];
        }

        const response = await salesOrderService.getSalesOrders(params);
        const data = Array.isArray(response) ? response : (response.data || []);
        setSalesOrders(data);
        setTotalItemsCount(response.meta?.total || data.length);
      } catch (error) {
        console.error("Error fetching sales orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage, searchQuery, appliedFilters, isRefreshing]);

  // Logic: Click Outside
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

  // Memoized: Computed Data
  const filteredData = useMemo(() => {
    return salesOrders.map(so => {
      const status = so.status;
      let computedStatusLabel = "Pending";
      let bgClass = "bg-gray-100 text-gray-600";

      if (status === 'INVOICE_GENERATED' || status === 'completed') {
        computedStatusLabel = "Completed"; bgClass = "bg-emerald-100 text-emerald-600";
      } else if (status === 'DELETED' || status === 'deleted') {
        computedStatusLabel = "Deleted"; bgClass = "bg-red-100 text-red-600";
      } else {
        computedStatusLabel = "Pending"; bgClass = "bg-orange-100 text-orange-600";
      }

      return { ...so, computedStatusLabel, bgClass };
    });
  }, [salesOrders]);

  const totalPages = Math.ceil(totalItemsCount / itemsPerPage);
  const currentItems = filteredData;

  // Handlers
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Data refreshed successfully");
    }, 400);
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

  const handleDeleteSO = (id) => {
    setSoToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!soToDelete) return;
    setIsDeleting(true);
    try {
      await salesOrderService.deleteSalesOrder(soToDelete);
      toast.success("Sales order deleted successfully");
      setIsDeleteModalOpen(false);
      setSoToDelete(null);
      setIsRefreshing(prev => !prev);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error.response?.data?.message || "Failed to delete SO");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async (format) => {
    try {
      if (salesOrders.length === 0) {
        toast.error("No data available to export.");
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
      const response = await salesOrderService.exportSalesOrders(params);
      if (response && response.data) {
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sales_orders.${format}`);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }, 100);
        toast.success(`Exported to ${format.toUpperCase()} successfully!`);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const response = await salesOrderService.downloadSample();
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'SO_Sample.xlsx');
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      toast.success("Sample file downloaded!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Error downloading sample file.");
    }
  };

  const handleSubmitImport = async () => {
    if (!selectedFile) return;
    try {
      setIsRefreshing(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      await salesOrderService.importSalesOrders(formData);
      setIsImportModalOpen(false);
      setSelectedFile(null);
      toast.success("Data imported successfully");
      handleRefresh();
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error.response?.data?.message || "Import failed");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Title & Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 md:mb-8 justify-between items-center font-outfit uppercase">
        <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">Sales Order</h1>
        <button
          onClick={() => navigate(ROUTES.SALES_ORDER_ADD)}
          className="px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 duration-200"
        >
          <Plus size={18} /> Add SO
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
                placeholder={t('common:search_by_anything', 'Search By Anything...')}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 font-bold"
              />
              {searchQuery && <X size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setSearchQuery("")} />}
            </div>
            <button onClick={handleRefresh} className={`w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] flex items-center justify-center hover:bg-gray-50 transition-all ${isRefreshing ? 'animate-spin border-[#073318]' : ''}`}>
              <RefreshCw size={18} className={isRefreshing ? "text-[#073318]" : "text-gray-400"} />
            </button>
            <button
              onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)}
              className={`flex items-center gap-2 px-6 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all uppercase ${isFilterApplied ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-[#E5E7EB] text-[#4B5563]'}`}
            >
              <Filter size={18} className={isFilterApplied ? "text-red-500" : "text-gray-400"} />
              {isFilterApplied ? "Clear" : "Apply Filters"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-6 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 uppercase">
              <Upload size={18} className="text-gray-400" /> Import
            </button>
            <div className="relative" ref={exportRef}>
              <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-6 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 uppercase">
                <Download size={18} className="text-gray-400" /> Export
              </button>
              {isExportOpen && (
                <div className="absolute top-full right-0 mt-2 w-[180px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-50 py-2 animate-in slide-in-from-top-2 duration-200 uppercase font-bold">
                  <button onClick={() => handleExport('pdf')} className="w-full px-5 py-3 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB]"><FileText size={18} className="text-red-500" /> PDF</button>
                  <button onClick={() => handleExport('xlsx')} className="w-full px-5 py-3 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB]"><FileSpreadsheet size={18} className="text-emerald-600" /> Excel</button>
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
                {["SO No", "Customer Name", "Customer Type", "Creation Date", "Expiry Date", "Amount", "Gst Number", "Credit Days", "Tax Amount", "Total Amount", "Status", "Action"].map(h => (
                  <th key={h} className="px-6 py-5 border-r border-white/10 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`text-[14px] text-[#111827] ${isRefreshing ? 'opacity-40' : 'opacity-100'}`}>
              {currentItems.length > 0 ? (
                currentItems.map((so, idx) => (
                  <tr key={so.id || idx} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                    <td className="px-6 py-5 font-bold">{so.soNumber}</td>
                    <td className="px-6 py-5 font-bold capitalize lowercase">{so.customerName}</td>
                    <td className="px-6 py-5 font-bold capitalize lowercase text-[#6B7280]">{so.customerType || 'Retail'}</td>
                    <td className="px-6 py-5 font-bold text-[#4B5563]">{formatDate(so.soCreationDate)}</td>
                    <td className="px-6 py-5 font-bold text-[#4B5563]">{formatDate(so.expiryDate)}</td>
                    <td className="px-6 py-5 font-bold">{(so.totalAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-5 font-bold text-center">{so.gstNumber || '-'}</td>
                    <td className="px-6 py-5 font-bold text-center">{so.creditDays || 0}</td>
                    <td className="px-6 py-5 font-bold text-center">{(so.taxAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-5 font-bold text-[#073318]">{(so.grandTotal || 0).toFixed(2)}</td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-4 py-1.5 ${so.bgClass} rounded-full text-[12px] font-bold shadow-sm inline-flex min-w-[100px] justify-center`}>{so.computedStatusLabel}</span>
                    </td>
                    <td className="px-6 py-5 text-center relative" ref={el => dropdownRefs.current[so.id] = el}>
                      <button onClick={() => setActiveDropdown(activeDropdown === so.id ? null : so.id)} className={`p-2 rounded-lg ${activeDropdown === so.id ? 'bg-[#073318] text-white' : 'text-gray-400 hover:bg-gray-100'}`}><MoreVertical size={20} /></button>
                      {activeDropdown === so.id && (
                        <div className={`absolute right-full mr-2 w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[110] py-2 animate-in zoom-in-95 duration-200 text-left font-bold ${idx >= currentItems.length - 2 ? 'bottom-0' : 'top-0'}`}>
                          <button onClick={() => navigate(ROUTES.SALES_ORDER_VIEW.replace(':id', so.id))} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] uppercase border-b border-gray-50"><Eye size={18} /> View / Edit SO</button>
                          {so.computedStatusLabel !== 'Deleted' && (
                            <button onClick={() => handleDeleteSO(so.id)} className="w-full px-5 py-3.5 flex items-center gap-3 text-red-600 hover:bg-red-50 uppercase"><Trash2 size={18} /> Delete</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="11" className="px-6 py-24 text-center text-gray-400 uppercase font-bold tracking-widest">No results found</td></tr>
              )}
            </tbody>
          </table>
        </ScrollableTable>

        {/* Pagination */}
        <div className="px-8 py-5 border-t border-[#F3F4F6] bg-[#F9FAFB] flex flex-row items-center justify-between uppercase">
          <div className="flex items-center gap-2 text-[14px] font-bold text-[#6B7280]">
            <span>Show</span>
            <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border border-[#E5E7EB] rounded-[8px] px-3 py-1.5 outline-none bg-white text-black font-bold">
              {[5, 10, 20, 50].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
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

      {/* Modals */}
      <DeleteConfirmModal isOpen={isDeleteModalOpen} isDeleting={isDeleting} onCancel={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} />

      {isImportModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" onClick={() => setIsImportModalOpen(false)} />
          <div className="relative bg-white w-full max-w-[500px] rounded-[24px] shadow-2xl p-10 space-y-8 animate-in zoom-in-95 duration-300">
            <h3 className="text-[20px] font-bold text-[#111827] uppercase text-center tracking-tight font-outfit">Import Data</h3>
            <button onClick={handleDownloadSample} className="w-full py-4 border-2 border-emerald-100 bg-emerald-50 text-emerald-700 rounded-[14px] font-bold uppercase transition-all hover:bg-emerald-100 flex items-center justify-center gap-3"><Download size={20} /> Download Sample</button>
            <div className="space-y-4 font-outfit">
              <span className="text-[13px] font-bold text-gray-500 uppercase tracking-widest block text-center">Upload File</span>
              <div className="border-2 border-dashed border-gray-200 rounded-[14px] h-[56px] flex items-center overflow-hidden bg-gray-50">
                <label className="h-full px-6 flex items-center justify-center bg-gray-100 border-r-2 border-dashed border-gray-200 font-bold uppercase text-[14px] cursor-pointer hover:bg-gray-200 transition-all font-outfit">Browse<input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files[0])} /></label>
                <span className="px-6 text-[14px] font-bold text-gray-400 truncate flex-1 uppercase tracking-tight">{selectedFile ? selectedFile.name : 'No file chosen...'}</span>
              </div>
            </div>
            <button onClick={handleSubmitImport} disabled={!selectedFile || isRefreshing} className={`w-full py-4 rounded-[14px] font-bold uppercase shadow-lg transition-all ${selectedFile ? 'bg-[#073318] text-white hover:bg-[#04200f]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>{isRefreshing ? 'Importing...' : 'Submit Data'}</button>
          </div>
        </div>
      )}

      {isRefreshing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
          <div className="relative bg-white/95 px-12 py-10 rounded-[32px] shadow-2xl flex flex-col items-center gap-5 animate-in zoom-in-95 duration-400">
            <RefreshCw size={48} className="text-[#073318] animate-spin" />
            <p className="font-bold text-[#073318] uppercase tracking-widest font-outfit">Processing...</p>
          </div>
        </div>
      )}

      {/* Filter Sidebar */}
      {isFilterOpen && <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-[4px]" onClick={() => setIsFilterOpen(false)} />}
      <div className={`fixed top-0 right-0 h-full w-[440px] bg-white shadow-2xl z-[110] transform transition-transform duration-500 ${isFilterOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="bg-[#073318] p-8 flex items-center justify-between">
          <h2 className="text-white font-bold uppercase text-[20px] tracking-tight font-outfit">Apply Filters</h2>
          <button onClick={() => setIsFilterOpen(false)} className="text-white/50 hover:text-white transition-all bg-white/10 p-2 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-10 flex flex-col h-full bg-white font-outfit">
          <div className="space-y-4">
            <label className="text-[14px] font-bold text-gray-400 uppercase tracking-widest block">Status Filter</label>
            <div className="grid grid-cols-2 gap-3">
              {statusTabs.map(s => (
                <button key={s} onClick={() => setFilterInputs({ ...filterInputs, status: s })} className={`h-12 rounded-[12px] font-bold text-[14px] transition-all border uppercase tracking-tight ${filterInputs.status === s ? 'bg-[#073318] border-[#073318] text-white shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="mt-auto pb-16 flex gap-4">
            <button onClick={handleClearFilter} className="flex-1 h-14 border border-[#E5E7EB] rounded-[14px] font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all font-outfit">Clear</button>
            <button onClick={handleApplyFilter} className="flex-1 h-14 bg-[#073318] text-white rounded-[14px] font-bold uppercase tracking-widest hover:bg-[#04200f] shadow-lg transition-all font-outfit">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesOrder;
