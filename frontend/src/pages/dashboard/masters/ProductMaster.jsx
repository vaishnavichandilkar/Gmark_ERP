import React, { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation, useParams } from "react-router-dom";
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
  ChevronsUpDown,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  Upload
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ProductForm from "./components/ProductForm";
import ViewProduct from "./components/ViewProduct";
import { translateDynamic } from "../../../utils/i18nUtils";
import SuccessToast from "./components/SuccessToast";
import productService from "../../../services/productService";
import toast from 'react-hot-toast';
import ImportModal from './components/ImportModal';

const ProductMaster = () => {
  const { t } = useTranslation(["modules", "common"]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const defaultFilters = { uom: "", status: "", productType: "" };
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [filterInputs, setFilterInputs] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const isFilterApplied = Object.values(appliedFilters).some(
    (val) => val !== "",
  );
  const [currentView, setCurrentView] = useState({ type: "list", data: null });
  const [showSuccessToast, setShowSuccessToast] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const exportRef = useRef(null);
  const dropdownRef = useRef(null);

  const showToast = (message, type = "success") => {
    setShowSuccessToast({ show: true, message, type });
  };

  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [uomOptions, setUomOptions] = useState([]);

  // Sync currentView with URL
  useEffect(() => {
    if (location.pathname.endsWith('/add')) {
      setCurrentView({ type: "add", data: null });
    } else if (location.pathname.includes('/edit/')) {
      const product = tableData.find(p => String(p.id) === String(id));
      if (product) {
        setCurrentView({ type: "edit", data: product });
      }
    } else if (location.pathname.includes('/view/')) {
      const product = tableData.find(p => String(p.id) === String(id));
      if (product) {
        setCurrentView({ type: "view", data: product });
      }
    } else {
      setCurrentView({ type: "list", data: null });
    }
  }, [location.pathname, tableData, id]);


  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Handle click outside for export and action dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click was outside both desktop and mobile export triggers/menus
      const isOutsideExport = 
          (!exportRef.current || !exportRef.current.contains(event.target)) &&
          !event.target.closest('.mobile-export-trigger');
      
      if (isOutsideExport) {
          setIsExportOpen(false);
      }
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        uom_id: appliedFilters.uom || undefined,
        product_type: appliedFilters.productType || undefined,
        status: appliedFilters.status || undefined,
      };
      const response = await productService.getProducts(params);
      setTableData(response.products || []);
      setTotalItems(response.total || 0);
    } catch (error) {
      console.error("Error fetching products:", error);
      showToast(t("common:error_fetching_data"), "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUoms = async () => {
    try {
      const data = await productService.getUomsDropdown();
      setUomOptions(data);
    } catch (error) {
      console.error("Error fetching UOMs:", error);
    }
  };

  const handleImportExcel = async (formData) => {
    const loadingToast = toast.loading(t('common:importing', 'Importing data...'), { id: 'import-toast' });
    
    try {
      await productService.importProducts(formData);
      toast.dismiss('import-toast');
      toast.success(t('common:import_success', 'Data imported successfully'));
      fetchProducts();
      return Promise.resolve();
    } catch (error) {
      toast.dismiss('import-toast');
      toast.error(error?.response?.data?.message || t('common:import_failed', 'Failed to import data'));
      return Promise.reject(error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentPage, itemsPerPage, searchQuery, appliedFilters]);

  useEffect(() => {
    fetchUoms();
  }, []);

  const toggleDropdown = (id, e) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  const renderImportActions = () => (
    <div className="relative flex items-center gap-3" ref={exportRef}>
      <button
        onClick={() => setIsImportModalOpen(true)}
        className="flex items-center justify-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all duration-200 bg-white shadow-sm"
      >
        <Upload size={18} className="text-gray-400" />
        {t('common:import', 'Import')}
      </button>
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportExcel}
        onDownloadSample={async () => {
          const response = await productService.downloadSample();
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', 'Product_Master_Sample.xlsx');
          document.body.appendChild(link);
          link.click();
          link.parentNode.removeChild(link);
        }}
        sampleFileName="Product_Master_Sample.xlsx"
        sampleHeaders={['Product Name*', 'UOM*', 'Product Type*', 'Category*', 'Sub Category*', 'HSN Code*', 'Product Description', 'Status']}
      />

      <button
        onClick={() => setIsExportOpen(!isExportOpen)}
        className={`flex items-center justify-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all duration-200 bg-white
                ${isExportOpen ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}
      >
        <Download size={18} className={isExportOpen ? 'text-[#073318]' : 'text-gray-400'} />
        {t('common:export')}
      </button>
    </div>
  );

  const handleToggleStatus = async (id, currentStatus) => {
    setLoading(true);
    try {
      const newStatus =
        currentStatus.toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await productService.toggleStatus(id, newStatus);
      showToast(`Product ${newStatus === "ACTIVE" ? "activated" : "inactivated"} successfully`);
      fetchProducts();
    } catch (error) {
      console.error("Error toggling status:", error);
      showToast(error.response?.data?.message || t("common:error_updating_status"), "error");
    } finally {
      setLoading(false);
      setActiveDropdown(null);
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
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = tableData;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRefresh = async () => {
    fetchProducts();
    showToast("Data refreshed successfully");
  };

  // Calculate which page numbers to show in the pagination bar (up to 4 pages as requested)
  const getVisiblePages = () => {
    const maxVisible = 4;
    let startPage = Math.max(1, currentPage - 1);
    let endPage = startPage + maxVisible - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    const pages = [];
    for (let i = startPage; i <= endPage; i++) {
      if (i >= 1 && i <= totalPages) {
        pages.push(i);
      }
    }
    return pages;
  };

  const handleExportPDF = async () => {
    setIsExportOpen(false);
    if (totalItems === 0) {
      showToast("No data available to export", "error");
      return;
    }
    try {
      const params = {
        format: "pdf",
        search: searchQuery || undefined,
        ...appliedFilters,
      };
      const response = await productService.exportProducts(params);
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `product_master_export_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showToast("PDF Exported Successfully");
    } catch (e) {
      console.error("Export failed", e);
      if (e.response && e.response.data instanceof Blob) {
        e.response.data.text().then((text) => {
          try {
            const errObj = JSON.parse(text);
            showToast(errObj.message || t("common:export_failed"), "error");
          } catch {
            showToast(t("common:export_failed"), "error");
          }
        });
      } else {
        showToast(e.response?.data?.message || t("common:export_failed"), "error");
      }
    }
  };

  const handleExportExcel = async () => {
    setIsExportOpen(false);
    if (totalItems === 0) {
      showToast("No data available to export", "error");
      return;
    }
    try {
      const params = {
        format: "xlsx",
        search: searchQuery || undefined,
        ...appliedFilters,
      };
      const response = await productService.exportProducts(params);
      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `product_master_export_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showToast("Excel Exported Successfully");
    } catch (e) {
      console.error("Export failed", e);
      if (e.response && e.response.data instanceof Blob) {
        e.response.data.text().then((text) => {
          try {
            const errObj = JSON.parse(text);
            showToast(errObj.message || t("common:export_failed"), "error");
          } catch {
            showToast(t("common:export_failed"), "error");
          }
        });
      } else {
        showToast(e.response?.data?.message || t("common:export_failed"), "error");
      }
    }
  };

  return (
    <div className="flex flex-col relative w-full h-full">
      {showSuccessToast.show && (
        <SuccessToast
          message={showSuccessToast.message}
          type={showSuccessToast.type}
          onClose={() => setShowSuccessToast({ ...showSuccessToast, show: false })}
        />
      )}
      {/* Conditional Content: Table or Form */}
      {currentView.type === "list" ? (
        <>
          <div className="flex flex-col gap-1 mb-4 md:mb-8">
            {/* Desktop Header */}
            <div className="hidden md:flex flex-row items-center justify-between gap-4">
              <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
                {t('modules:product_master')}
              </h2>

              <button
                onClick={() => navigate('add')}
                className="flex flex-row items-center justify-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[44px] rounded-[10px] text-[15px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0 whitespace-nowrap"
              >
                <Plus size={18} />
                {t("modules:add_product")}
              </button>
            </div>

            {/* Mobile Header - Stacked Layout */}
            <div className="md:hidden flex flex-col gap-3">
              <button
                onClick={() => navigate('add')}
                className="flex flex-row items-center justify-center gap-2 h-[42px] px-6 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold active:scale-[0.98] transition-all shadow-md w-full max-w-[358px] self-center whitespace-nowrap"
              >
                <Plus size={18} strokeWidth={3} />
                <span className="whitespace-nowrap">{t("modules:add_product")}</span>
              </button>
            </div>
          </div>

          <div 
            className={`master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8 rounded-[20px] overflow-hidden ${
              activeDropdown ? "!overflow-visible" : ""
            }`}
          >
            {/* Desktop Action Bar */}
            <div className="hidden md:flex items-center justify-between p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[20px]">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-[320px]">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder={t('common:search_placeholder', 'Search By Anything...')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)}
                  className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all shadow-sm ${isFilterApplied ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100" : "bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50"}`}
                >
                  <Filter size={18} className={isFilterApplied ? "text-red-500" : "text-gray-400"} />
                  {isFilterApplied ? t("common:clear") : t("common:filter")}
                </button>
                <button
                  className="flex-shrink-0 flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] hover:bg-gray-50 transition-colors bg-white shadow-sm"
                  title="Refresh Data"
                  onClick={handleRefresh}
                >
                  <RefreshCw size={18} className="text-gray-400" />
                </button>
              </div>

              <div className="flex items-center gap-3" ref={exportRef}>
                <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all duration-200 bg-white shadow-sm">
                  <Upload size={18} className="text-gray-400" />
                  {t('common:import')}
                </button>
                <div className="relative">
                  <button onClick={() => setIsExportOpen(!isExportOpen)} className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all ${isExportOpen ? "border-[#073318] text-[#073318]" : "border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50"}`}>
                    <Download size={18} />
                    {t("common:export")}
                  </button>
                  {isExportOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button onClick={handleExportPDF} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700">
                        <FileText size={18} className="text-red-500" /> PDF
                      </button>
                      <button onClick={handleExportExcel} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700">
                        <FileSpreadsheet size={18} className="text-green-600" /> Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Action Bar - Optimized One-line Layout */}
            <div className="md:hidden py-3 px-4 border-b border-[#F3F4F6] rounded-t-[20px]">
              <div className="flex items-center gap-2 h-[40px]">
                {/* Expandable Search */}
                <div className={`relative h-full transition-all duration-300 flex items-center ${isSearchExpanded ? 'flex-1' : 'w-[42px]'}`}>
                  {!isSearchExpanded ? (
                    <button 
                      onClick={() => setIsSearchExpanded(true)}
                      className="w-full h-full flex items-center justify-center text-gray-500"
                    >
                      <Search size={22} />
                    </button>
                  ) : (
                    <div className="relative w-full h-full flex items-center animate-in slide-in-from-right-4 duration-300">
                      <Search className="absolute left-3 text-gray-400" size={18} />
                      <input
                        type="text"
                        autoFocus
                        placeholder={t('common:search')}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full h-full bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none shadow-sm placeholder:text-gray-400 font-medium"
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                          className="absolute right-3 text-gray-400"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Icons - Hidden when search expanded */}
                {!isSearchExpanded ? (
                  <div className="flex items-center gap-1 ml-auto animate-in fade-in duration-300">
                    <button onClick={handleRefresh} className="w-10 h-10 flex items-center justify-center text-gray-500">
                      <RefreshCw size={20} />
                    </button>
                    <button onClick={() => setIsImportModalOpen(true)} className="w-10 h-10 flex items-center justify-center text-gray-500">
                      <Upload size={20} />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setIsExportOpen(!isExportOpen)} 
                        className={`w-10 h-10 flex items-center justify-center transition-colors ${isExportOpen ? 'text-[#073318]' : 'text-gray-500'}`}
                      >
                        <Download size={20} />
                      </button>
                      {isExportOpen && (
                        <div className="absolute top-full right-0 mt-2 w-[140px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[100] py-1 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                          <button onClick={handleExportPDF} className="w-full px-4 py-2.5 flex items-center gap-3 text-[13px] text-gray-700 hover:bg-gray-50">
                            <FileText size={18} className="text-red-500" /> PDF
                          </button>
                          <button onClick={handleExportExcel} className="w-full px-4 py-2.5 flex items-center gap-3 text-[13px] text-gray-700 hover:bg-gray-50 border-t border-gray-50">
                            <FileSpreadsheet size={18} className="text-green-600" /> Excel
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)}
                      className={`w-10 h-10 flex items-center justify-center ${isFilterApplied ? 'text-red-600' : 'text-gray-500'}`}
                      title={isFilterApplied ? t('common:clear') : t('common:filter')}
                    >
                      <Filter size={20} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); setCurrentPage(1); }}
                    className="text-[14px] font-bold text-[#073318] px-2 animate-in fade-in duration-300"
                  >
                    {t('common:cancel')}
                  </button>
                )}
              </div>
            </div>

            <div className="master-table-wrapper">
              <table className="master-table min-w-[1200px]">
                <thead>
                  <tr>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("product_code")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("product_name")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("modules:gst_uom", "GST UOM")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("product_type")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("category")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("sub_category", "Sub Category")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("sub_sub_category", "Sub-SubCategory")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("hsn_code")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("tax_percent")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 text-left">
                      <div className="flex items-center gap-2 tracking-tight">
                        {t("common:status")}{" "}
                        <ChevronsUpDown size={14} className="text-gray-300" />
                      </div>
                    </th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center tracking-tight">
                      {t("common:action")}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-[#111827]">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-[#073318]/10 border-t-[#073318] rounded-full animate-spin"></div>
                          <span className="text-gray-400 font-medium">
                            {t("common:loading")}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : currentData.length > 0 ? (
                    currentData.map((row, index) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB] transition-all group"
                      >
                        <td className="px-3 md:px-6 py-3 md:py-4 font-bold text-[#111827] border-r border-[#F3F4F6]">
                          {row.product_code}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 font-bold text-[#111827] border-r border-[#F3F4F6]">
                          {translateDynamic(row.product_name, t)}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-[#4B5563] border-r border-[#F3F4F6]">
                          {translateDynamic(row.uom?.gst_uom, t)}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-[#4B5563] border-r border-[#F3F4F6]">
                          {translateDynamic(row.product_type, t)}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-[#4B5563] border-r border-[#F3F4F6]">
                          {translateDynamic(row.category?.name, t)}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-[#4B5563] border-r border-[#F3F4F6]">
                          {translateDynamic(row.sub_category?.name, t)}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-[#4B5563] border-r border-[#F3F4F6]">
                          {translateDynamic(row.sub_sub_category?.name, t) || "-"}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-[#6B7280] border-r border-[#F3F4F6]">
                          {row.hsn_code}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-[#6B7280] border-r border-[#F3F4F6]">
                          {row.tax_rate}%
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 border-r border-[#F3F4F6]">
                          <div
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${row.status.toUpperCase() === "ACTIVE" ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FEF2F2] text-[#DC2626]"}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${row.status.toUpperCase() === "ACTIVE" ? "bg-[#059669]" : "bg-[#DC2626]"}`}
                            ></span>
                            {row.status.toUpperCase() === "ACTIVE"
                              ? t("common:active")
                              : t("common:inactive")}
                          </div>
                        </td>
                        <td
                          className={`px-3 md:px-6 py-3 md:py-4 text-center relative ${activeDropdown === row.id ? "z-[100]" : ""}`}
                          ref={activeDropdown === row.id ? dropdownRef : null}
                        >
                          <button
                            onClick={(e) => toggleDropdown(row.id, e)}
                            className={`p-2 rounded-lg transition-all ${activeDropdown === row.id ? 'bg-gray-100 text-[#111827]' : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'}`}
                          >
                            <MoreVertical size={20} />
                          </button>

                          {activeDropdown === row.id && (
                            <div
                              className={`absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 text-left ${
                                index >= currentData.length - 2 &&
                                currentData.length > 2
                                  ? "bottom-0 mb-2"
                                  : "top-0 mt-2"
                              }`}
                            >
                              <button
                                 onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`view/${row.id}`);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap font-bold"
                              >
                                <Eye size={18} className="text-gray-400" />
                                {t("modules:view_and_edit_product")}
                              </button>
                              <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />
                              <button
                                onClick={() =>
                                  handleToggleStatus(row.id, row.status)
                                }
                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap font-bold"
                              >
                                <CheckCircle2
                                  size={18}
                                  className={
                                    row.status.toUpperCase() === "ACTIVE"
                                      ? "text-gray-400"
                                      : "text-[#073318]"
                                  }
                                />
                                {row.status.toUpperCase() === "ACTIVE"
                                  ? t("common:inactive")
                                  : t("common:active")}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="11"
                        className="px-6 py-20 text-center text-gray-400"
                      >
                        <div className="flex flex-col items-center gap-3">
                          <span className="font-medium">
                            {t("no_products_found")}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-t border-[#F3F4F6] bg-white gap-4 w-full">
              <div className="flex items-center gap-2 text-[13px] text-[#6B7280] font-medium">
                <span className="hidden sm:inline">{t("common:show")}</span>
                <div className="relative group">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="appearance-none border border-[#E5E7EB] rounded-[8px] pl-3 pr-8 py-1.5 outline-none focus:border-[#073318] text-[#111827] bg-[#F9FAFB] cursor-pointer font-bold transition-all hover:bg-white"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#073318]"
                  />
                </div>
                <span className="hidden sm:inline">{t("common:per_page")}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#6B7280] text-[13px] font-medium whitespace-nowrap">
                  {totalItems > 0 ? `${startIndex + 1}–${endIndex} of ${totalItems}` : `0-0 of 0`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="hidden md:flex items-center gap-1.5 px-1">
                    {getVisiblePages().map((page, index) => (
                      <button
                        key={index}
                        onClick={() => typeof page === "number" ? handlePageChange(page) : null}
                        className={`min-w-[32px] h-[32px] rounded-[8px] flex items-center justify-center transition-all text-[13px] font-bold ${
                          currentPage === page
                            ? "bg-[#073318] text-white shadow-md"
                            : "text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Sidebar Overlay */}
          {isFilterOpen && (
            <div
              className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-[2px] transition-all duration-300 ease-in-out"
              onClick={() => setIsFilterOpen(false)}
            />
          )}

          {/* Filter Sidebar Offcanvas */}
          <div
            className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${isFilterOpen ? "translate-x-0" : "translate-x-full"}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#04200f] bg-emerald-900">
              <h2 className="text-[20px] font-bold text-white tracking-tight">
                {t("apply_filters")}
              </h2>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-emerald-100 hover:text-white rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-8 py-8 overflow-y-auto space-y-7">
              {/* UOM Filter */}
              <div className="space-y-2.5">
                <label className="text-[14px] font-medium text-[#4B5563]">
                  {t("uom")}
                </label>
                <div className="relative">
                  <select
                    value={filterInputs.uom}
                    onChange={(e) =>
                      setFilterInputs({ ...filterInputs, uom: e.target.value })
                    }
                    className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] pl-4 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] appearance-none bg-white font-medium transition-all"
                  >
                    <option value="">{t("common:all")}</option>
                    {Array.from(
                      new Map(
                        uomOptions
                          .filter((u) => u.gst_uom) // Ensure gst_uom exists
                          .map((uom) => [uom.gst_uom, uom])
                      ).values()
                    ).map((uom) => (
                      <option key={uom.id} value={uom.id}>
                        {translateDynamic(uom.gst_uom, t)}
                      </option>
                    ))}
                  </select>
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-2.5">
                <label className="text-[14px] font-medium text-[#4B5563]">
                  {t("common:status")}
                </label>
                <div className="relative">
                  <select
                    value={filterInputs.status}
                    onChange={(e) =>
                      setFilterInputs({
                        ...filterInputs,
                        status: e.target.value,
                      })
                    }
                    className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] pl-4 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] appearance-none bg-white font-medium transition-all"
                  >
                    <option value="">{t("common:all")}</option>
                    <option value="ACTIVE">{t("common:active")}</option>
                    <option value="INACTIVE">{t("common:inactive")}</option>
                  </select>
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>

              {/* Product Type Filter */}
              <div className="space-y-2.5">
                <label className="text-[14px] font-medium text-[#4B5563]">
                  {t("product_type")}
                </label>
                <div className="relative">
                  <select
                    value={filterInputs.productType}
                    onChange={(e) =>
                      setFilterInputs({
                        ...filterInputs,
                        productType: e.target.value,
                      })
                    }
                    className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] pl-4 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] appearance-none bg-white font-medium transition-all"
                  >
                    <option value="">{t("common:all")}</option>
                    <option value="GOODS">{t("modules:goods") || "Goods"}</option>
                    <option value="SERVICES">
                      {t("modules:services") || "Services"}
                    </option>
                  </select>
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-8 py-6 border-t border-[#E5E7EB] flex items-center gap-4 bg-white">
              <button
                onClick={handleClearFilter}
                className="flex-1 h-[48px] border border-[#E5E7EB] rounded-[10px] text-[15px] font-bold text-[#4B5563] hover:bg-gray-50 hover:text-[#111827] transition-all bg-white"
              >
                {t("common:clear_filter")}
              </button>
              <button
                onClick={handleApplyFilter}
                className="flex-1 h-[48px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-md"
              >
                {t("common:apply_filter") || "Apply Filter"}
              </button>
            </div>
          </div>
        </>
      ) : currentView.type === "view" ? (
        <ViewProduct
          initialData={currentView.data}
          onBack={() => navigate('/seller/masters/product-master')}
          onEdit={(data) => navigate(`/seller/masters/product-master/edit/${data.id}`)}
        />
      ) : (
        <ProductForm
          mode={currentView.type}
          initialData={currentView.data}
          onBack={() => {
            const redirect = searchParams.get("redirect");
            if (redirect) {
              navigate(redirect, { replace: true });
            } else {
              navigate('/seller/masters/product-master');
            }
          }}
          onEdit={(data) => navigate(`/seller/masters/product-master/edit/${data.id}`)}
          onSuccess={() => {
            const msg =
              currentView.type === "add"
                ? "Product added successfully"
                : "Product updated successfully";
            showToast(msg);
            
            const redirect = searchParams.get("redirect");
            if (redirect && currentView.type === "add") {
              setTimeout(() => navigate(redirect, { replace: true }), 1500); // Redirect back after toast
            } else {
              navigate('/seller/masters/product-master');
              fetchProducts();
            }
          }}
        />
      )}
      {isImportModalOpen && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportExcel}
          onDownloadSample={async () => {
             const response = await productService.downloadSample();
             const url = window.URL.createObjectURL(new Blob([response.data]));
             const link = document.createElement('a');
             link.href = url;
             link.setAttribute('download', 'Product_Master_Sample.xlsx');
             document.body.appendChild(link);
             link.click();
             link.parentNode.removeChild(link);
          }}
          sampleFileName="Product_Master_Sample.xlsx"
          sampleHeaders={['Product Name*', 'UOM*', 'Product Type*', 'Category*', 'Sub Category*', 'HSN Code*', 'Product Description', 'Status']}
        />
      )}
    </div>
  );
};

export default ProductMaster;
