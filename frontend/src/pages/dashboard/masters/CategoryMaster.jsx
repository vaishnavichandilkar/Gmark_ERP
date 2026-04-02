import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Download,
  Upload,
  Plus,
  Minus,
  Check,
  FileText,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  X,
  Filter,
  Edit,
  Loader2,
  ArrowLeft as LeftIcon,
  ArrowRight as RightIcon,
  ChevronsUpDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import CategoryForm from "./components/CategoryForm";
import ImportModal from "./components/ImportModal";
import AddCategoryModal from "./components/AddCategoryModal";
import EditCategoryModal from "./components/EditCategoryModal";
import categoryService from "../../../services/masters/categoryService";
import SuccessToast from "./components/SuccessToast";

const CategoryMaster = () => {
  const { t } = useTranslation(["modules", "common"]);
  const [currentView, setCurrentView] = useState({
    type: "list",
    data: null,
    mode: "add",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedSubGroups, setExpandedSubGroups] = useState({});
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCategoryData, setSelectedCategoryData] = useState(null);
  const [activeRowDropdown, setActiveRowDropdown] = useState(null);
  const [toastMessage, setToastMessage] = useState({
    show: false,
    message: "",
    type: "success",
  });
  const [selectedItems, setSelectedItems] = useState([]);

  const showToast = (message, type = "success") => {
    setToastMessage({ show: true, message, type });
  };
  const exportRef = useRef(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Filter states
  const defaultFilters = { status: "" };
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterInputs, setFilterInputs] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const isFilterApplied = Object.values(appliedFilters).some(
    (val) => val !== "",
  );

  const [masterData, setMasterData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const data = await categoryService.getCategories();
      const mappedData = data.map((cat) => ({
        id: cat.id,
        name: cat.name,
        status: cat.status || "ACTIVE",
        items: (cat.sub_categories || []).map((sub) => ({
          ...sub,
          items: sub.sub_sub_categories || []
        })),
      }));
      setMasterData(mappedData);
      setSelectedItems([]);
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to fetch categories",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Handle click outside for export/dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }

      // Only clear dropdown if NOT clicking on a dropdown button or item
      if (
        !event.target.closest(".dropdown-trigger") &&
        !event.target.closest(".dropdown-menu")
      ) {
        setActiveRowDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset pagination to page 1 on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, appliedFilters]);

  // Helper to toggle expansion
  const toggleGroup = (id) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSubGroup = (id) => {
    setExpandedSubGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isAllExpanded =
    masterData.length > 0 &&
    Object.keys(expandedGroups).length === masterData.length &&
    Object.values(expandedGroups).every(Boolean);

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedGroups({});
      setExpandedSubGroups({});
    } else {
      const newExpanded = {};
      const newSubExpanded = {};
      masterData.forEach((section) => {
        newExpanded[section.id] = true;
        section.items.forEach(sub => {
          if (sub.items && sub.items.length > 0) {
            newSubExpanded[sub.id] = true;
          }
        });
      });
      setExpandedGroups(newExpanded);
      setExpandedSubGroups(newSubExpanded);
    }
  };

  const handleToggleStatus = async (id, currentStatus, type) => {
    const newStatus = currentStatus === "INACTIVE" ? "ACTIVE" : "INACTIVE";

    // Optimistic UI update
    setMasterData((prev) =>
      prev.map((cat) => {
        if (type === "category" && Number(cat.id) === Number(id)) {
          const updatedCat = { ...cat, status: newStatus };
          if (newStatus === "INACTIVE") {
            updatedCat.items = cat.items.map((sub) => ({
              ...sub,
              status: "INACTIVE",
            }));
          }
          return updatedCat;
        } else if (type === "sub_category") {
          return {
            ...cat,
            items: cat.items.map((sub) =>
              Number(sub.id) === Number(id)
                ? { ...sub, status: newStatus }
                : sub,
            ),
          };
        }
        return cat;
      }),
    );

    try {
      if (type === "category") {
        await categoryService.toggleCategoryStatus(id, newStatus);
      } else if (type === "sub_category") {
        await categoryService.toggleSubCategoryStatus(id, newStatus);
      } else if (type === "sub_sub_category") {
        await categoryService.toggleSubSubCategoryStatus(id, newStatus);
      }
      showToast(
        `${type.replace('_', ' ')} ${newStatus === "ACTIVE" ? "activated" : "inactivated"} successfully`,
      );
      fetchCategories(); // Final sync from DB
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to update status",
        "error",
      );
      fetchCategories(); // Revert if failed
    } finally {
      setActiveRowDropdown(null);
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectGroup = (items) => {
    const itemIds = items.map((i) => i.id);
    const allSelected = itemIds.every((id) => selectedItems.includes(id));

    if (allSelected) {
      setSelectedItems((prev) => prev.filter((id) => !itemIds.includes(id)));
    } else {
      setSelectedItems((prev) => [...new Set([...prev, ...itemIds])]);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedItems.length === 0) return;
    try {
      await Promise.all(
        selectedItems.map((id) =>
          categoryService.toggleSubCategoryStatus(id, "INACTIVE"),
        ),
      );
      toast.success(
        t(
          "modules:bulk_deactivate_success",
          "Selected items deactivated successfully",
        ),
      );
      setSelectedItems([]);
      fetchCategories();
    } catch (error) {
      toast.error("Bulk operation failed");
    }
  };

  // Filter logic
  const filteredData = () => {
    let data = masterData;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((section) => {
        const nameMatch = section.name.toLowerCase().includes(q);
        const itemsMatch = section.items.some((item) =>
          (item.name || "").toLowerCase().includes(q),
        );
        return nameMatch || itemsMatch;
      });
    }

    if (appliedFilters.status) {
      data = data.filter((section) => {
        const status = section.status || "ACTIVE";
        return status.toLowerCase() === appliedFilters.status.toLowerCase();
      });
    }

    return data;
  };

  const handleApplyFilter = () => {
    setAppliedFilters(filterInputs);
    setIsFilterOpen(false);
  };

  const handleClearFilter = () => {
    setFilterInputs(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  // Export Logic
  const handleExportPDF = async () => {
    setIsExportOpen(false);
    try {
      const response = await categoryService.exportCategories("pdf");
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `category_master_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showToast("PDF Exported Successfully");
    } catch (error) {
      console.error("Export failed", error);
      showToast("Failed to export PDF", "error");
    }
  };

  const handleExportExcel = async () => {
    setIsExportOpen(false);
    try {
      const response = await categoryService.exportCategories("xlsx");
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `category_master_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showToast("Excel Exported Successfully");
    } catch (error) {
      console.error("Export failed", error);
      showToast("Failed to export Excel", "error");
    }
  };

  const handleImportExcel = async (formData) => {
    const loadingToast = toast.loading(
      t("common:importing", "Importing data..."),
    );

    try {
      await categoryService.importCategories(formData);
      toast.dismiss(loadingToast);
      toast.success(t("common:import_success", "Data imported successfully"));
      fetchCategories();
      return Promise.resolve();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(
        error?.response?.data?.message ||
        t("common:import_failed", "Failed to import data"),
      );
      return Promise.reject(error);
    }
  };

  const processedData = filteredData();

  // Pagination Calculations
  const totalItems = processedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedData = processedData.slice(startIndex, endIndex);

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

  // No edit/add view redirection needed as we use modals

  if (currentView.type === "form") {
    return (
      <CategoryForm
        mode={currentView.mode}
        initialData={currentView.data}
        onBack={() => setCurrentView({ type: "list", data: null, mode: "add" })}
        onSuccess={() => {
          fetchCategories();
          setCurrentView({ type: "list", data: null, mode: "add" });
        }}
        onShowToast={showToast}
      />
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 mb-6 md:mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">
            {t("modules:category_master")}
          </h1>
          <p className="text-[#6B7280] text-[14px] md:text-[15px]">
            {t("modules:category_master_desc")}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            {t("modules:add_category")}
          </button>
        </div>
      </div>

      <div
        className={`flex flex-col bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-8 ${activeRowDropdown ? "!overflow-visible" : "overflow-hidden"}`}
      >
        {/* Action Bar - Mobile Optimized */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-4 md:p-6 border-b border-[#F3F4F6] gap-4">
          {/* Desktop Action Bar */}
          <div className="hidden md:flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {selectedItems.length > 0 ? (
                <div className="flex items-center gap-3 animate-in slide-in-from-left-4 duration-300 bg-[#073318]/5 px-4 py-2 rounded-[12px] border border-[#073318]/10 w-full sm:w-auto">
                  <span className="text-[14px] font-bold text-[#073318]">
                    {selectedItems.length} {t("common:selected", "Selected")}
                  </span>
                  <div className="w-[1px] h-4 bg-[#073318]/20 mx-1" />
                  <button
                    onClick={handleBulkDeactivate}
                    className="text-[13px] font-bold text-amber-700 hover:text-amber-800 transition-colors"
                  >
                    {t("common:deactivate_selected", "Deactivate")}
                  </button>
                  <button
                    onClick={() => setSelectedItems([])}
                    className="text-[13px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {t("common:cancel", "Cancel")}
                  </button>
                </div>
              ) : (
                <div className="relative w-full sm:w-[320px]">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder={t(
                      "common:search_placeholder",
                      "Search By Name...",
                    )}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all placeholder:text-gray-400 shadow-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleExpandAll}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all bg-white shadow-sm"
                >
                  {isAllExpanded ? (
                    <Minimize2 size={16} className="text-gray-400" />
                  ) : (
                    <Maximize2 size={16} className="text-gray-400" />
                  )}
                  <span className="hidden sm:inline">
                    {isAllExpanded
                      ? t("common:collapse_all")
                      : t("common:expand_all")}
                  </span>
                  <span className="sm:hidden">
                    {isAllExpanded ? "Collapse" : "Expand"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setSearchQuery("");
                    setExpandedGroups({});
                    handleClearFilter();
                    fetchCategories();
                    showToast("Data refreshed successfully");
                  }}
                  className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] hover:bg-gray-50 transition-colors bg-white shadow-sm flex-shrink-0"
                  title="Refresh Data"
                >
                  <RefreshCw size={18} className="text-gray-400" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3" ref={exportRef}>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[13px] sm:text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all duration-200 bg-white shadow-sm"
              >
                <Upload size={18} className="text-gray-400" />
                <span className="hidden sm:inline">
                  {t("common:import", "Import")}
                </span>
                <span className="sm:hidden">Import</span>
              </button>

              <div className="relative flex-1 sm:flex-none">
                <button
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 h-[42px] border rounded-[10px] text-[13px] sm:text-[14px] font-bold transition-all duration-200 bg-white
                                        ${isExportOpen ? "border-[#073318] text-[#073318]" : "border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50"}`}
                >
                  <Download
                    size={18}
                    className={isExportOpen ? "text-[#073318]" : "text-gray-400"}
                  />
                  {t("common:export")}
                </button>

                {isExportOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[50] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={handleExportPDF}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors"
                    >
                      <FileText size={18} className="text-red-500" />
                      {t("common:pdf")}
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors"
                    >
                      <FileSpreadsheet size={18} className="text-green-600" />
                      {t("common:excel")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Action Bar - Optimized One-line Layout */}
          <div className="md:hidden mt-2 p-0 w-full mb-3">
            <div className="flex items-center gap-1.5 h-[48px]">
              {/* Compact Search */}
              <div className="flex-1 relative h-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={t("common:search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-full bg-white border border-[#E5E7EB] rounded-[12px] pl-8 pr-8 text-[14px] outline-none shadow-sm placeholder:text-gray-400 font-medium"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Control Buttons Group */}
              <div className="flex items-center gap-1 h-full">
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setExpandedGroups({});
                    handleClearFilter();
                    fetchCategories();
                  }}
                  className="w-[44px] h-[44px] flex items-center justify-center bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm active:bg-gray-50 text-gray-400"
                  title={t("common:refresh")}
                >
                  <RefreshCw size={18} />
                </button>

                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-[44px] h-[44px] flex items-center justify-center bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm active:bg-gray-50 text-gray-400"
                  title={t("common:import")}
                >
                  <Upload size={18} />
                </button>

                <div className="relative mobile-export-trigger">
                  <button
                    onClick={() => setIsExportOpen(!isExportOpen)}
                    className={`w-[44px] h-[44px] flex items-center justify-center border rounded-[12px] shadow-sm transition-all active:scale-95 ${isExportOpen ? "bg-[#073318] border-[#073318] text-white" : "bg-white border-[#E5E7EB] text-gray-400"}`}
                  >
                    <Download size={18} />
                  </button>
                  {isExportOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[140px] bg-white border border-gray-100 rounded-[12px] shadow-2xl z-[100] py-1 overflow-hidden">
                      <button onClick={handleExportPDF} className="w-full px-4 py-3 flex items-center gap-3 text-[13px] font-bold text-gray-700 active:bg-gray-50">
                        <FileText size={16} className="text-red-500" /> PDF
                      </button>
                      <button onClick={handleExportExcel} className="w-full px-4 py-3 flex items-center gap-3 text-[13px] font-bold text-gray-700 active:bg-gray-50 border-t border-gray-50">
                        <FileSpreadsheet size={16} className="text-green-600" /> Excel
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleExpandAll}
                  className="w-[44px] h-[44px] flex items-center justify-center bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm active:bg-gray-50 text-gray-400"
                  title={isAllExpanded ? t("common:collapse") : t("common:expand")}
                >
                  {isAllExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-stretch justify-between border-b border-emerald-950 bg-emerald-900 text-[14px] font-bold text-white uppercase tracking-tight">
          <div className="flex-1 border-r border-white/50 px-4 md:px-6 py-3 md:py-5 flex items-center gap-2">
            {t("modules:category_sub_category")}
            <ChevronsUpDown size={14} className="text-gray-300" />
          </div>
          <div className="flex items-stretch shrink-0">
            <div className="w-[110px] md:w-[120px] border-r border-white/50 flex items-center justify-center px-4 gap-2">
              {t("common:status")}
              <ChevronsUpDown size={14} className="text-gray-300" />
            </div>
            <div className="w-16 md:w-20 flex items-center justify-center px-4 py-3 md:py-5">
              {t("common:action")}
            </div>
          </div>
        </div>

        <div className="min-h-[300px]">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#073318]" />
            </div>
          ) : paginatedData.length > 0 ? (
            paginatedData.map((section, paginatedIndex) => {
              const isSearchExpanding =
                searchQuery &&
                section.items.some((item) =>
                  (item.name || "")
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase()),
                );
              const isExpanded =
                expandedGroups[section.id] || isSearchExpanding;

              return (
                <div
                  key={section.id}
                  className={`flex flex-col border-b border-[#E5E7EB] last:border-b-0 relative ${activeRowDropdown?.includes(section.id.toString()) ? "z-[30]" : "z-0"}`}
                >
                  <div className="flex items-center justify-between py-2 md:py-4 bg-white hover:bg-gray-50/50 transition-colors group">
                    <div
                      className="flex items-center flex-1 cursor-pointer select-none gap-3 pl-4 md:pl-6"
                      onClick={() => toggleGroup(section.id)}
                    >
                      <div className="flex items-center justify-center w-5 h-5">
                        {isExpanded ? (
                          <Minus
                            size={14}
                            className="text-[#111827] stroke-[3px]"
                          />
                        ) : (
                          <Plus
                            size={14}
                            className="text-[#111827] stroke-[3px]"
                          />
                        )}
                      </div>
                      <span className="text-[14px] font-bold text-[#111827]">
                        {section.name}
                      </span>
                    </div>

                    <div className="flex items-stretch shrink-0">
                      {/* Status Column */}
                      <div className="w-[110px] md:w-[120px] flex items-center justify-center px-2 md:px-4">
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${section.status === "INACTIVE" ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#ECFDF5] text-[#059669]"}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${section.status === "INACTIVE" ? "bg-[#DC2626]" : "bg-[#059669]"}`}
                          ></span>
                          {section.status === "INACTIVE"
                            ? t("common:inactive")
                            : t("common:active")}
                        </div>
                      </div>

                      {/* Action Column */}
                      <div className="w-16 md:w-20 flex items-center justify-center px-4 relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveRowDropdown(
                              activeRowDropdown === `group-${section.id}`
                                ? null
                                : `group-${section.id}`,
                            );
                          }}
                          className={`p-1.5 rounded-md transition-all duration-200 dropdown-trigger
                                                        ${activeRowDropdown === `group-${section.id}` ? "bg-gray-100 text-[#111827]" : "text-gray-400 hover:text-[#073318] hover:bg-white border border-transparent"}`}
                        >
                          <MoreVertical size={18} />
                        </button>

                        {activeRowDropdown === `group-${section.id}` && (
                          <div
                            className={`absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in zoom-in-95 duration-200 dropdown-menu text-left
                                                            ${paginatedIndex >= paginatedData.length - 1 && paginatedData.length > 1 ? "bottom-0 mb-2" : "top-0 mt-2"}`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategoryData({
                                  ...section,
                                  type: "category",
                                });
                                setIsEditModalOpen(true);
                                setActiveRowDropdown(null);
                              }}
                              className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap dropdown-item"
                            >
                              <Edit size={18} className="text-[#073318]" />
                              {t("modules:view_and_edit_category")}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStatus(
                                  section.id,
                                  section.status,
                                  "category",
                                );
                              }}
                              className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap dropdown-item"
                            >
                              {section.status === "INACTIVE" ? (
                                <CheckCircle2
                                  size={18}
                                  className="text-[#073318]"
                                />
                              ) : (
                                <XCircle
                                  size={18}
                                  className="text-gray-400 -mt-0.5"
                                />
                              )}
                              {section.status === "INACTIVE"
                                ? t("common:active")
                                : t("common:inactive")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[800px] opacity-100 overflow-visible" : "max-h-0 opacity-0 overflow-hidden"}`}
                  >
                    <div className="flex flex-col bg-gray-50/30 border-t border-[#E5E7EB]/50">
                      {section.items.map((item, itemIdx) => {
                        const dropdownId = `${section.id}-item-${itemIdx}`;
                        const hasSubSubs = item.items && item.items.length > 0;
                        const isSubExpanded = expandedSubGroups[item.id] || searchQuery;

                        return (
                          <div key={item.id} className="flex flex-col border-b border-[#E5E7EB]/50 last:border-b-0">
                            <div
                              className={`relative flex items-center justify-between py-3.5 pl-[52px] text-[13px] hover:bg-gray-50 transition-colors ${activeRowDropdown === dropdownId ? "z-[50]" : "z-0"}`}
                            >
                              <div
                                className="flex items-center flex-1 cursor-pointer select-none gap-3"
                                onClick={() => hasSubSubs && toggleSubGroup(item.id)}
                              >
                                <div className="flex items-center justify-center w-4 h-4">
                                  {hasSubSubs ? (
                                    isSubExpanded ? (
                                      <Minus size={12} className="text-[#4B5563] stroke-[3px]" />
                                    ) : (
                                      <Plus size={12} className="text-[#4B5563] stroke-[3px]" />
                                    )
                                  ) : null}
                                </div>
                                <span className="font-bold text-[#4B5563]">
                                  {itemIdx + 1}. {item.name}
                                </span>
                              </div>

                              <div className="flex items-stretch shrink-0">
                                {/* Status Column */}
                                <div className="w-[110px] md:w-[120px] flex items-center justify-center px-2 md:px-4">
                                  <div
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${item.status === "INACTIVE" ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#ECFDF5] text-[#059669]"}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${item.status === "INACTIVE" ? "bg-[#DC2626]" : "bg-[#059669]"}`}
                                    ></span>
                                    {item.status === "INACTIVE"
                                      ? t("common:inactive")
                                      : t("common:active")}
                                  </div>
                                </div>

                                {/* Action Column */}
                                <div className="w-16 md:w-20 flex items-center justify-center px-2 md:px-4 relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRowDropdown(
                                        activeRowDropdown === dropdownId
                                          ? null
                                          : dropdownId,
                                      );
                                    }}
                                    className={`p-1.5 rounded-md transition-all duration-200 dropdown-trigger
                                                                          ${activeRowDropdown === dropdownId ? "bg-gray-100 text-[#111827]" : "text-gray-400 hover:text-[#073318] hover:bg-white border border-transparent"}`}
                                  >
                                    <MoreVertical size={16} />
                                  </button>

                                  {activeRowDropdown === dropdownId && (
                                    <div
                                      className={`absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in zoom-in-95 duration-200 dropdown-menu text-left
                                                                              ${itemIdx >= section.items.length - 1 && section.items.length > 1 ? "bottom-0 mb-2" : "top-0 mt-2"}`}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCategoryData({
                                            ...item,
                                            type: "sub_category",
                                            parentId: section.id,
                                          });
                                          setIsEditModalOpen(true);
                                          setActiveRowDropdown(null);
                                        }}
                                        className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap dropdown-item"
                                      >
                                        <Edit
                                          size={18}
                                          className="text-[#073318]"
                                        />
                                        {t("modules:view_and_edit_category")}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleStatus(
                                            item.id,
                                            item.status,
                                            "sub_category",
                                          );
                                        }}
                                        className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap dropdown-item"
                                      >
                                        {item.status === "INACTIVE" ? (
                                          <CheckCircle2
                                            size={18}
                                            className="text-[#073318]"
                                          />
                                        ) : (
                                          <XCircle
                                            size={18}
                                            className="text-gray-400 -mt-0.5"
                                          />
                                        )}
                                        {item.status === "INACTIVE"
                                          ? t("common:active")
                                          : t("common:inactive")}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Third Level - SubSubCategories */}
                            {hasSubSubs && isSubExpanded && (
                              <div className="flex flex-col bg-gray-100/40">
                                {item.items.map((subSub, subSubIdx) => {
                                  const subSubDropdownId = `subsub-${subSub.id}`;
                                  return (
                                    <div key={subSub.id} className="flex items-center justify-between py-2.5 pl-[90px] text-[12px] border-b border-[#E5E7EB]/30 last:border-b-0 hover:bg-gray-100/60 transition-colors">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                        <span className="font-medium text-[#6B7280]">
                                          {subSub.name}
                                        </span>
                                      </div>

                                      <div className="flex items-stretch shrink-0">
                                        {/* Status Column */}
                                        <div className="w-[110px] md:w-[120px] flex items-center justify-center px-4">
                                          <div
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${subSub.status === "INACTIVE" ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#ECFDF5] text-[#059669]"}`}
                                          >
                                            {subSub.status === "INACTIVE"
                                              ? t("common:inactive")
                                              : t("common:active")}
                                          </div>
                                        </div>

                                        {/* Action Column */}
                                        <div className="w-16 md:w-20 flex items-center justify-center px-4 relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveRowDropdown(
                                                activeRowDropdown === subSubDropdownId
                                                  ? null
                                                  : subSubDropdownId,
                                              );
                                            }}
                                            className={`p-1 rounded-md transition-all duration-200 dropdown-trigger
                                                                                  ${activeRowDropdown === subSubDropdownId ? "bg-gray-200 text-[#111827]" : "text-gray-400 hover:text-[#073318]"}`}
                                          >
                                            <MoreVertical size={14} />
                                          </button>

                                          {activeRowDropdown === subSubDropdownId && (
                                            <div
                                              className="absolute right-[80%] top-0 mt-2 w-max min-w-[180px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-[120] py-1.5 animate-in zoom-in-95 duration-200 text-left"
                                            >
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedCategoryData({
                                                    ...subSub,
                                                    type: "sub_sub_category",
                                                    parentId: item.id,
                                                    grandParentId: section.id
                                                  });
                                                  setIsEditModalOpen(true);
                                                  setActiveRowDropdown(null);
                                                }}
                                                className="w-full px-4 py-2 flex items-center gap-3 text-[13px] font-semibold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                                              >
                                                <Edit size={16} className="text-[#073318]" />
                                                {t("modules:view_and_edit_category")}
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleStatus(
                                                    subSub.id,
                                                    subSub.status,
                                                    "sub_sub_category",
                                                  );
                                                }}
                                                className="w-full px-4 py-2 flex items-center gap-3 text-[13px] font-semibold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                                              >
                                                {subSub.status === "INACTIVE" ? t("common:active") : t("common:inactive")}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-gray-400 text-[14px]">
              {t("no_matching_categories")}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-5 sm:py-6 border-t border-[#F3F4F6] bg-white gap-6">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-[14px] text-[#6B7280] font-medium order-2 sm:order-1 border-t sm:border-0 pt-4 sm:pt-0">
            <div className="flex items-center gap-2">
              <span>{t("common:show")}</span>
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
              <span>{t("common:per_page")}</span>
            </div>
            <span className="sm:hidden text-gray-400">
              {totalItems > 0
                ? `${startIndex + 1}-${endIndex} / ${totalItems}`
                : `0-0 / 0`}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto order-1 sm:order-2">
            <span className="hidden sm:inline text-[#6B7280] text-[14px] font-medium">
              {totalItems > 0
                ? `${startIndex + 1}-${endIndex} of ${totalItems}`
                : `0-0 of 0`}
            </span>
            <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="flex-1 sm:flex-none w-10 h-10 flex items-center justify-center text-[#6B7280] bg-gray-50/50 sm:bg-transparent hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px] border border-transparent hover:border-gray-100"
              >
                <LeftIcon size={18} />
              </button>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[180px] sm:max-w-none px-1">
                {getVisiblePages().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[36px] sm:min-w-[40px] h-[36px] sm:h-[40px] rounded-[10px] flex items-center justify-center transition-all text-[13px] sm:text-[14px] font-bold
                                            ${currentPage === page
                        ? "bg-[#F9FAFB] text-[#111827] shadow-sm border border-gray-100"
                        : "text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]"
                      }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex-1 sm:flex-none w-10 h-10 flex items-center justify-center text-[#6B7280] bg-gray-50/50 sm:bg-transparent hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px] border border-transparent hover:border-gray-100"
              >
                <RightIcon size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {toastMessage.show && (
        <SuccessToast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage({ ...toastMessage, show: false })}
        />
      )}

      <AddCategoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchCategories}
        onShowToast={showToast}
      />

      <EditCategoryModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        data={selectedCategoryData}
        onSuccess={fetchCategories}
        onShowToast={showToast}
      />
      {isImportModalOpen && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportExcel}
          onDownloadSample={() => categoryService.downloadCategorySampleExcel()}
          sampleFileName="Category_Master_Sample.xlsx"
          sampleHeaders={["Category Name", "Sub Category"]}
        />
      )}
    </div>
  );
};

export default CategoryMaster;
