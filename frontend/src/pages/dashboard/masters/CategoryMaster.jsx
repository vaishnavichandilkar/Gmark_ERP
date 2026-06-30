import React, { useState, useMemo, useRef, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  Eye,
  Loader2,
  ArrowLeft as LeftIcon,
  ArrowRight as RightIcon,
  ChevronsUpDown,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import CategoryForm from "./components/CategoryForm";
import ImportModal from "./components/ImportModal";
import AddCategoryModal from "./components/AddCategoryModal";
import EditCategoryModal from "./components/EditCategoryModal";
import categoryService from "../../../services/masters/categoryService";
import SuccessToast from "./components/SuccessToast";
import CustomSelect from "../../../components/common/CustomSelect";

const CategoryMaster = () => {
  const { t } = useTranslation(["modules", "common"]);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
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
  const [itemsPerPage, setItemsPerPage] = useState(15);

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

  // Sync currentView with URL
  useEffect(() => {
    if (location.pathname.endsWith("/add")) {
      setCurrentView({ type: "form", data: null, mode: "add" });
    } else if (location.pathname.includes("/edit/")) {
      // Find the category to edit
      const findCategory = (data, targetId) => {
        for (const cat of data) {
          if (String(cat.id) === String(targetId)) return cat;
          if (cat.items) {
            const found = findCategory(cat.items, targetId);
            if (found) return found;
          }
        }
        return null;
      };
      const category = findCategory(masterData, id);
      if (category) {
        setCurrentView({ type: "form", data: category, mode: "edit" });
      }
    } else {
      setCurrentView({ type: "list", data: null, mode: "add" });
    }
  }, [location.pathname, masterData, id]);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const data = await categoryService.getCategories();
      setMasterData(data);
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
        (section.sub_categories || []).forEach((sub) => {
          if (sub.sub_sub_categories && sub.sub_sub_categories.length > 0) {
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
        if (type === "category" && String(cat.id) === String(id)) {
          const updatedCat = { ...cat, status: newStatus };
          if (newStatus === "INACTIVE") {
            updatedCat.sub_categories = (cat.sub_categories || []).map(
              (sub) => ({
                ...sub,
                status: "INACTIVE",
                sub_sub_categories: (sub.sub_sub_categories || []).map(
                  (ss) => ({ ...ss, status: "INACTIVE" }),
                ),
              }),
            );
          }
          return updatedCat;
        } else if (type === "sub_category") {
          const subExists = (cat.sub_categories || []).some(
            (s) => String(s.id) === String(id),
          );
          if (!subExists) return cat;

          return {
            ...cat,
            sub_categories: (cat.sub_categories || []).map((sub) => {
              if (String(sub.id) === String(id)) {
                const updatedSub = { ...sub, status: newStatus };
                if (newStatus === "INACTIVE") {
                  updatedSub.sub_sub_categories = (
                    sub.sub_sub_categories || []
                  ).map((ss) => ({ ...ss, status: "INACTIVE" }));
                }
                return updatedSub;
              }
              return sub;
            }),
          };
        } else if (type === "sub_sub_category") {
          const subSubExists = (cat.sub_categories || []).some((s) =>
            (s.sub_sub_categories || []).some(
              (ss) => String(ss.id) === String(id),
            ),
          );
          if (!subSubExists) return cat;

          return {
            ...cat,
            sub_categories: (cat.sub_categories || []).map((sub) => ({
              ...sub,
              sub_sub_categories: (sub.sub_sub_categories || []).map((ss) =>
                String(ss.id) === String(id)
                  ? { ...ss, status: newStatus }
                  : ss,
              ),
            })),
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
        `${type.replace(/_/g, " ")} ${newStatus === "ACTIVE" ? "activated" : "inactivated"} successfully`,
      );
      // fetchCategories(); // Removed redundant fetch to keep optimistic UI smoothness
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to update status",
        "error",
      );
      fetchCategories(); // Revert on failure
    } finally {
      setActiveRowDropdown(null);
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the category "${categoryName}"?`);
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      await categoryService.deleteCategory(categoryId);
      showToast("Category deleted successfully");
      fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      showToast(
        error.response?.data?.message || error.message || "Failed to delete category",
        "error"
      );
    } finally {
      setIsLoading(false);
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

  // Filter logic
  const filteredData = () => {
    let data = masterData;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((section) => {
        const nameMatch = section.name.toLowerCase().includes(q);
        const subMatch = (section.sub_categories || []).some((item) =>
          (item.name || "").toLowerCase().includes(q),
        );
        const subSubMatch = (section.sub_categories || []).some((item) =>
          (item.sub_sub_categories || []).some((ss) =>
            (ss.name || "").toLowerCase().includes(q),
          ),
        );
        return nameMatch || subMatch || subSubMatch;
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
    if (filteredData().length === 0) {
      showToast("No data available to export", "error");
      return;
    }
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
      let message = "Failed to export PDF";
      if (error.response && error.response.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          message = errorData.message || message;
        } catch (err) {}
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      showToast(message, "error");
    }
  };

  const handleExportExcel = async () => {
    setIsExportOpen(false);
    if (filteredData().length === 0) {
      showToast("No data available to export", "error");
      return;
    }
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
      let message = "Failed to export Excel";
      if (error.response && error.response.data instanceof Blob) {
        const text = await error.response.data.text();
        try {
          const errorData = JSON.parse(text);
          message = errorData.message || message;
        } catch (err) {}
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      }
      showToast(message, "error");
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

  if (currentView.type === "form") {
    return (
      <CategoryForm
        mode={currentView.mode}
        initialData={currentView.data}
        onBack={() => navigate("/seller/masters/category")}
        onSuccess={() => {
          fetchCategories();
          navigate("/seller/masters/category");
        }}
        onShowToast={showToast}
      />
    );
  }

  return (
    <div className="flex flex-col w-full relative">
      <div className="flex flex-col gap-1 mb-4 md:mb-8">
        {/* Desktop Header */}
        <div className="hidden md:flex flex-row items-center justify-between gap-4">
          <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
            {t("modules:category_master")}
          </h2>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            <Plus size={18} />
            {t("modules:add_category")}
          </button>
        </div>

        {/* Mobile Header - Stacked Layout */}
        <div className="md:hidden flex flex-col gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 h-[42px] px-6 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold active:scale-[0.98] transition-all shadow-md w-full max-w-[358px] self-center"
          >
            <Plus size={18} strokeWidth={3} />
            {t("modules:add_category")}
          </button>
        </div>
      </div>

      <div
        className={`flex flex-col bg-white rounded-[20px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-8 ${activeRowDropdown ? "!overflow-visible" : "overflow-hidden"}`}
      >
        {/* Desktop Action Bar */}
        <div className="hidden md:flex flex-col lg:flex-row items-stretch lg:items-center justify-between p-4 md:p-6 border-b border-[#F3F4F6] gap-4 rounded-t-[20px]">
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
                    placeholder={t('searchByAnything')}
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
                <Download size={18} className="text-gray-400" />
                <span className="hidden sm:inline">
                  {t("common:import", "Import")}
                </span>
              </button>

              <div className="relative flex-1 sm:flex-none">
                <button
                  onClick={() => setIsExportOpen(!isExportOpen)}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 h-[42px] border rounded-[10px] text-[13px] sm:text-[14px] font-bold transition-all duration-200 bg-white
                    ${isExportOpen ? "border-[#073318] text-[#073318]" : "border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50"}`}
                >
                  <Upload
                    size={18}
                    className={
                      isExportOpen ? "text-[#073318]" : "text-gray-400"
                    }
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
        </div>

        {/* Mobile Action Bar */}
        <div className="md:hidden py-3 px-4 border-b border-[#F3F4F6] rounded-t-[20px]">
          <div className="flex items-center gap-2 h-[40px]">
            <div
              className={`relative h-full transition-all duration-300 flex items-center ${isSearchExpanded ? "flex-1" : "w-[42px]"}`}
            >
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
                    placeholder={t("common:search")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-full bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none shadow-sm placeholder:text-gray-400 font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 text-gray-400"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isSearchExpanded ? (
              <div className="flex items-center gap-1 ml-auto animate-in fade-in duration-300">
                <button
                  onClick={fetchCategories}
                  className="w-10 h-10 flex items-center justify-center text-gray-500"
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="w-10 h-10 flex items-center justify-center text-gray-500"
                >
                  <Download size={20} />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsExportOpen(!isExportOpen)}
                    className={`w-10 h-10 flex items-center justify-center transition-colors ${isExportOpen ? "text-[#073318]" : "text-gray-500"}`}
                  >
                    <Upload size={20} />
                  </button>
                  {isExportOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[140px] bg-white border border-gray-100 rounded-[12px] shadow-lg z-[100] py-1">
                      <button
                        onClick={handleExportPDF}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[13px] text-gray-700 hover:bg-gray-50"
                      >
                        <FileText size={18} className="text-red-500" /> PDF
                      </button>
                      <button
                        onClick={handleExportExcel}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[13px] text-gray-700 hover:bg-gray-50"
                      >
                        <FileSpreadsheet size={18} className="text-green-600" />{" "}
                        Excel
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={toggleExpandAll}
                  className="w-10 h-10 flex items-center justify-center text-gray-500"
                >
                  {isAllExpanded ? (
                    <Minimize2 size={20} />
                  ) : (
                    <Maximize2 size={20} />
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsSearchExpanded(false);
                  setSearchQuery("");
                }}
                className="text-[14px] font-bold text-[#073318] px-2"
              >
                {t("common:cancel")}
              </button>
            )}
          </div>
        </div>

        {/* Table Header */}
        <div className="master-table-header">
          <div className="flex-1 pl-9 gap-2">
            {t("modules:category_sub_category")}
            <ChevronsUpDown size={14} className="opacity-70" />
          </div>
          <div className="flex items-stretch shrink-0 !p-0 !border-r-0">
            <div className="w-[110px] md:w-[120px] flex items-center justify-center px-2 md:px-4 gap-2 border-l border-white/10">
              {t("common:status")}
              <ChevronsUpDown size={14} className="opacity-70" />
            </div>
            <div className="w-16 md:w-20 flex items-center justify-center px-4 border-l border-white/10">
              {t("common:action")}
            </div>
          </div>
        </div>

        {/* Hierarchical List */}
        <div className="min-h-[300px]">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#073318]" />
            </div>
          ) : paginatedData.length > 0 ? (
            paginatedData.map((section, paginatedIndex) => {
              const isSearchExpanding =
                searchQuery &&
                (section.sub_categories || []).some(
                  (item) =>
                    (item.name || "")
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    (item.sub_sub_categories || []).some((ss) =>
                      (ss.name || "")
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                    ),
                );
              const isExpanded =
                expandedGroups[section.id] || isSearchExpanding;

              return (
                <React.Fragment key={section.id}>
                  {/* Category Row */}
                  <div className="flex items-center justify-between py-2 md:py-4 border-b border-[#F3F4F6] transition-all duration-200 group-row bg-[#F9FAFB]/50 hover:bg-gray-50">
                    <div
                      className="flex items-center flex-1 cursor-pointer select-none gap-3"
                      style={{ paddingLeft: '12px' }}
                      onClick={() => toggleGroup(section.id)}
                    >
                      <div className="w-6 h-6 flex items-center justify-center">
                        {(section.sub_categories && section.sub_categories.length > 0) ? (
                          <div className={`p-0.5 rounded transition-colors duration-200 ${isExpanded ? 'bg-red-50 text-red-600' : 'bg-[#073318]/5 text-[#111827]'}`}>
                            {isExpanded ? (
                              <Minus size={14} strokeWidth={3} />
                            ) : (
                              <Plus size={14} strokeWidth={3} />
                            )}
                          </div>
                        ) : (
                          <div className="w-1.5 h-1.5 bg-[#4B5563] rounded-full ml-0.5" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-[14px] transition-colors font-bold ${section.status === 'INACTIVE' ? 'text-gray-400' : 'text-[#111827]'}`}>
                          {section.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-stretch shrink-0">
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
                          className={`dropdown-trigger p-1.5 rounded-md transition-all duration-200 ${activeRowDropdown === `group-${section.id}` ? "bg-gray-100 text-[#111827]" : "text-gray-400 hover:text-[#073318] hover:bg-white border border-transparent"}`}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {activeRowDropdown === `group-${section.id}` && (
                          <div
                            className={`dropdown-menu absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in zoom-in-95 duration-200 text-left ${paginatedIndex >= paginatedData.length - 1 ? "bottom-0 mb-2" : "top-0 mt-2"}`}
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
                              className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                            >
                              <Eye size={18} className="text-gray-400" />{" "}
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
                              className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                            >
                              {section.status === "INACTIVE" ? (
                                <CheckCircle2 size={18} className="text-[#073318]" />
                              ) : (
                                <XCircle size={18} />
                              )}
                              {section.status === "INACTIVE"
                                ? t("common:active")
                                : t("common:inactive")}
                            </button>
                            <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(section.id, section.name);
                              }}
                              className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                            >
                              <Trash2 size={18} className="text-red-500" />
                              {t("common:delete", "Delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SubCategories & SubSubCategories Container */}
                  {isExpanded && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      {(section.sub_categories || []).map((item) => {
                        const subDropdownId = `sub-${item.id}`;
                        const hasSubSubs =
                          item.sub_sub_categories &&
                          item.sub_sub_categories.length > 0;
                        const isSubExpanded =
                          expandedSubGroups[item.id] ||
                          (searchQuery &&
                            (item.sub_sub_categories || []).some((ss) =>
                              (ss.name || "")
                                .toLowerCase()
                                .includes(searchQuery.toLowerCase()),
                            ));

                        return (
                          <React.Fragment key={item.id}>
                            <div
                              className="flex items-center justify-between py-2 md:py-4 border-b border-[#F3F4F6] transition-all duration-200 group-row bg-white hover:bg-gray-50"
                            >
                              <div
                                className="flex items-center flex-1 cursor-pointer select-none gap-3"
                                onClick={() => hasSubSubs && toggleSubGroup(item.id)}
                                style={{ paddingLeft: '32px' }}
                              >
                                <div className="w-6 h-6 flex items-center justify-center">
                                  {hasSubSubs ? (
                                    <div className={`p-0.5 rounded transition-colors duration-200 ${isSubExpanded ? 'bg-red-50 text-red-600' : 'bg-[#073318]/5 text-[#111827]'}`}>
                                      {isSubExpanded ? (
                                        <Minus size={14} strokeWidth={3} />
                                      ) : (
                                        <Plus size={14} strokeWidth={3} />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="w-1.5 h-1.5 bg-[#4B5563] rounded-full ml-0.5" />
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span
                                    className={`text-[14px] transition-colors font-medium ${item.status === "INACTIVE" ? "text-gray-400" : "text-[#374151]"}`}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-stretch shrink-0">
                                <div className="w-[110px] md:w-[120px] flex items-center justify-center px-2 md:px-4">
                                  <div
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${item.status === "INACTIVE" ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#ECFDF5] text-[#059669]"}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${item.status === "INACTIVE" ? "bg-[#DC2626]" : "bg-[#059669]"}`}></span>
                                    {item.status === "INACTIVE"
                                      ? t("common:inactive")
                                      : t("common:active")}
                                  </div>
                                </div>
                                <div className="w-16 md:w-20 flex items-center justify-center px-4 relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRowDropdown(
                                        activeRowDropdown === subDropdownId
                                          ? null
                                          : subDropdownId,
                                      );
                                    }}
                                    className={`dropdown-trigger p-1.5 rounded-md transition-all duration-200 ${activeRowDropdown === subDropdownId ? "bg-gray-100 text-[#111827]" : "text-gray-400 hover:text-[#073318] hover:bg-white border border-transparent"}`}
                                  >
                                    <MoreVertical size={18} />
                                  </button>
                                  {activeRowDropdown === subDropdownId && (
                                    <div
                                      className={`dropdown-menu absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in zoom-in-95 duration-200 text-left ${paginatedIndex >= paginatedData.length - 1 ? "bottom-0 mb-2" : "top-0 mt-2"}`}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCategoryData({
                                            ...item,
                                            type: "sub_category",
                                          });
                                          setIsEditModalOpen(true);
                                          setActiveRowDropdown(null);
                                        }}
                                        className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                                      >
                                        <Eye
                                          size={18}
                                          className="text-gray-400"
                                        />{" "}
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
                                        className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                                      >
                                        {item.status === "INACTIVE" ? (
                                          <CheckCircle2 size={18} className="text-[#073318]" />
                                        ) : (
                                          <XCircle size={18} />
                                        )}
                                        {item.status === "INACTIVE"
                                          ? t("common:active")
                                          : t("common:inactive")}
                                      </button>
                                      <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteCategory(item.id, item.name);
                                        }}
                                        className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                                      >
                                        <Trash2 size={18} className="text-red-500" />
                                        {t("common:delete", "Delete")}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* SubSubCategories List */}
                            {hasSubSubs && isSubExpanded && (
                              <div className="animate-in slide-in-from-top-2 duration-300">
                                {item.sub_sub_categories.map((subSub) => {
                                  const ssDropdownId = `ss-${subSub.id}`;
                                  return (
                                    <div
                                      key={subSub.id}
                                      className="flex items-center justify-between py-2 md:py-4 border-b border-[#F3F4F6] transition-all duration-200 group-row bg-white hover:bg-gray-50"
                                    >
                                      <div
                                        className="flex items-center flex-1 select-none gap-3"
                                        style={{ paddingLeft: '52px' }}
                                      >
                                        <div className="w-6 h-6 flex items-center justify-center">
                                          <div className="w-1.5 h-1.5 bg-[#4B5563] rounded-full ml-0.5" />
                                        </div>
                                        <div className="flex flex-col">
                                          <span className={`text-[14px] transition-colors font-medium ${subSub.status === "INACTIVE" ? "text-gray-400" : "text-[#374151]"}`}>
                                            {subSub.name}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-stretch shrink-0">
                                        <div className="w-[110px] md:w-[120px] flex items-center justify-center px-2 md:px-4">
                                          <div
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${subSub.status === "INACTIVE" ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#ECFDF5] text-[#059669]"}`}
                                          >
                                            <span className={`w-1.5 h-1.5 rounded-full ${subSub.status === "INACTIVE" ? "bg-[#DC2626]" : "bg-[#059669]"}`}></span>
                                            {subSub.status === "INACTIVE"
                                              ? t("common:inactive")
                                              : t("common:active")}
                                          </div>
                                        </div>
                                        <div className="w-16 md:w-20 flex items-center justify-center px-4 relative">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveRowDropdown(
                                                activeRowDropdown ===
                                                  ssDropdownId
                                                  ? null
                                                  : ssDropdownId,
                                              );
                                            }}
                                            className={`dropdown-trigger p-1.5 rounded-md transition-all duration-200 ${activeRowDropdown === ssDropdownId ? "bg-gray-100 text-[#111827]" : "text-gray-400 hover:text-[#073318] hover:bg-white border border-transparent"}`}
                                          >
                                            <MoreVertical size={18} />
                                          </button>
                                          {activeRowDropdown ===
                                            ssDropdownId && (
                                            <div
                                              className={`dropdown-menu absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in zoom-in-95 duration-200 text-left ${paginatedIndex >= paginatedData.length - 1 ? "bottom-0 mb-2" : "top-0 mt-2"}`}
                                            >
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedCategoryData({
                                                    ...subSub,
                                                    type: "sub_sub_category",
                                                  });
                                                  setIsEditModalOpen(true);
                                                  setActiveRowDropdown(null);
                                                }}
                                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                                              >
                                                <Eye
                                                  size={18}
                                                  className="text-gray-400"
                                                />{" "}
                                                {t(
                                                  "modules:view_and_edit_category",
                                                )}
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
                                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                                              >
                                                {subSub.status ===
                                                "INACTIVE" ? (
                                                  <CheckCircle2 size={18} className="text-[#073318]" />
                                                ) : (
                                                  <XCircle size={18} />
                                                )}
                                                {subSub.status === "INACTIVE"
                                                  ? t("common:active")
                                                  : t("common:inactive")}
                                              </button>
                                              <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteCategory(subSub.id, subSub.name);
                                                }}
                                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                                              >
                                                <Trash2 size={18} className="text-red-500" />
                                                {t("common:delete", "Delete")}
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
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <div className="p-12 text-center text-gray-400 text-[14px]">
              {t("no_matching_categories")}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-t border-[#F3F4F6] bg-white gap-4 w-full">
          <div className="flex items-center gap-2 text-[13px] text-[#6B7280] font-medium">
            <span className="hidden sm:inline">{t("common:show")}</span>
            <CustomSelect 
                value={itemsPerPage}
                onChange={(val) => {
                  setItemsPerPage(val);
                  setCurrentPage(1);
                }}
                options={[5, 10, 20, 50]}
                menuPlacement="top"
            />
            <span className="hidden sm:inline">{t("common:per_page")}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[#6B7280] text-[13px] font-medium whitespace-nowrap">
              {totalItems > 0
                ? `${startIndex + 1}-${endIndex} of ${totalItems}`
                : `0-0 of 0`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
              >
                <LeftIcon size={16} />
              </button>
              <div className="hidden md:flex items-center gap-1.5 px-1">
                {getVisiblePages().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[36px] sm:min-w-[40px] h-[36px] sm:h-[40px] rounded-[10px] flex items-center justify-center transition-all text-[13px] sm:text-[14px] font-bold
                      ${currentPage === page ? "bg-[#F9FAFB] text-[#111827] shadow-sm border border-gray-100" : "text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]"}`}
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
                className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
              >
                <RightIcon size={16} />
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
