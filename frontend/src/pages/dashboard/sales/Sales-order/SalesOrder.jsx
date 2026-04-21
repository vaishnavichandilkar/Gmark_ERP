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
  Printer
} from "lucide-react";
import toast from 'react-hot-toast';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";
import { ROUTES } from "../../../../constants/routes";
import { useTranslation } from 'react-i18next';

import salesOrderService from "../../../../services/salesOrderService";
import ScrollableTable from "../../../../components/common/ScrollableTable";

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
  const statusTabs = ["ALL", "PENDING", "COMPLETED", "DELETED"];
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
  const defaultFilters = { status: "ALL" };
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterInputs, setFilterInputs] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const isFilterApplied = appliedFilters.status !== "ALL";

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
          search: searchQuery.trim(),
        };

        const statusFilter = appliedFilters.status;
        if (statusFilter !== "ALL") {
          params.filter = statusFilter.toLowerCase();
        }

        const response = await salesOrderService.getSalesOrders(params);

        // Handle response based on backend structure
        const data = Array.isArray(response) ? response : (response.data || []);
        setSalesOrders(data);
        setTotalItemsCount(response.meta?.total || data.length);
      } catch (error) {
        console.error("Error fetching sales orders:", error);
        toast.error("Failed to load sales orders");
        setSalesOrders([]);
        setTotalItemsCount(0);
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
    let baseData = salesOrders.map(so => {
      const status = so.status;
      const expiryDate = so.expiryDate ? new Date(so.expiryDate) : null;
      const today = new Date();
      const isExpired = expiryDate && expiryDate < today;

      // Calculate days diff
      const diffTime = expiryDate ? expiryDate - today : null;
      const diffDays = diffTime ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : null;
      const isExpiringSoon = !isExpired && diffDays !== null && diffDays <= 3;

      let computedStatusLabel = "Pending";
      let bgClass = "bg-gray-100 text-gray-600";

      if (status === 'DELETED' || status === 'deleted') {
        computedStatusLabel = "Deleted"; bgClass = "bg-red-100 text-red-600";
      } else if (status === 'INVOICE_GENERATED' || status === 'completed' || status === 'COMPLETED') {
        computedStatusLabel = "Completed"; bgClass = "bg-emerald-100 text-emerald-600";
      } else if (isExpired) {
        computedStatusLabel = "Expired"; bgClass = "bg-slate-100 text-slate-500 border border-slate-200";
      } else if (isExpiringSoon) {
        computedStatusLabel = "Expiring Soon"; bgClass = "bg-amber-100 text-amber-600 border border-amber-200";
      } else {
        computedStatusLabel = "Pending"; bgClass = "bg-orange-100 text-orange-600";
      }

      return { ...so, computedStatusLabel, bgClass };
    });

    const query = searchQuery.toLowerCase().trim().replace(/,/g, '');
    if (!query) return baseData;

    return baseData.filter(so =>
      so.soNumber?.toLowerCase().includes(query) ||
      so.customerName?.toLowerCase().includes(query) ||
      so.customerType?.toLowerCase().includes(query) ||
      so.gstNumber?.toLowerCase().includes(query) ||
      so.computedStatusLabel?.toLowerCase().includes(query) ||
      so.totalAmount?.toString().includes(query) ||
      so.totalAmount?.toFixed(2).includes(query) ||
      so.grandTotal?.toString().includes(query) ||
      so.grandTotal?.toFixed(2).includes(query) ||
      so.taxAmount?.toString().includes(query) ||
      so.taxAmount?.toFixed(2).includes(query)
    );
  }, [salesOrders, searchQuery]);

  const totalPages = Math.ceil(totalItemsCount / itemsPerPage);
  const currentItems = filteredData;

  // Handlers
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handlePrint = async (soData) => {
    try {
      setIsRefreshing(true);
      const fullSo = await salesOrderService.getSalesOrderById(soData.id);
      navigate(ROUTES.SALES_ORDER_PRINT, {
        state: {
          soData: fullSo.data || fullSo,
          from: '/seller/sales/order'
        }
      });
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to load print preview");
    } finally {
      setIsRefreshing(false);
    }
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

  const handleExport = (format) => {
    try {
      if (filteredData.length === 0) {
        toast.error("No data available to export.");
        setIsExportOpen(false);
        return;
      }
      setIsExportOpen(false);
      setIsRefreshing(true);

      // Map data for export with proper headers
      const exportData = filteredData.map(so => ({
        "SO NO": so.soNumber,
        "CUSTOMER NAME": so.customerName,
        "CUSTOMER TYPE": so.customerType || 'Retail',
        "CREATION DATE": formatDate(so.soCreationDate),
        "EXPIRY DATE": formatDate(so.expiryDate),
        "AMOUNT": (so.totalAmount || 0).toFixed(2),
        "GST NUMBER": so.gstNumber || '-',
        "CREDIT DAYS": so.creditDays || 0,
        "TAX AMOUNT": (so.taxAmount || 0).toFixed(2),
        "TOTAL AMOUNT": (so.grandTotal || 0).toFixed(2),
        "STATUS": so.computedStatusLabel
      }));

      if (format === 'xlsx') {
        const timestampStr = `${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

        // Define Column Headers
        const headers = ["SO No", "Customer Name", "Customer Type", "Cr. Date", "Exp. Date", "Amount", "GST Number", "Cr. Days", "Tax Amt", "Total Amt", "Status"];

        // Prepare Data for AOA (Array of Arrays)
        const aoaData = [
          ["Sales Orders Report"], // Row 1: Title
          [`Exported on: ${timestampStr}`], // Row 2: Timestamp
          [], // Row 3: Spacing
          headers // Row 4: Table Headers
        ];

        // Add Data Rows
        filteredData.forEach(so => {
          aoaData.push([
            so.soNumber || "-",
            so.customerName || "-",
            so.customerType || "Retail",
            formatDate(so.soCreationDate),
            formatDate(so.expiryDate),
            (so.totalAmount || 0).toFixed(2),
            so.gstNumber || "-",
            so.creditDays || 0,
            (so.taxAmount || 0).toFixed(2),
            (so.grandTotal || 0).toFixed(2),
            so.computedStatusLabel.toUpperCase()
          ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(aoaData);

        // Define Styles
        const mainColor = "073318";
        const titleStyle = {
          font: { bold: true, size: 16, color: { rgb: mainColor } },
          alignment: { horizontal: "center", vertical: "center" }
        };
        const subTitleStyle = {
          font: { bold: true, size: 10, italic: true, color: { rgb: "64748B" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
        const headerStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: mainColor } },
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
        const cellStyle = {
          font: { size: 10 },
          alignment: { horizontal: "left", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "E5E7EB" } },
            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
            left: { style: "thin", color: { rgb: "E5E7EB" } },
            right: { style: "thin", color: { rgb: "E5E7EB" } }
          }
        };

        // Apply Merges
        worksheet['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }, // Merge Title
          { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }  // Merge Timestamp
        ];

        // Apply Styles to Cells
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[address]) continue;

            if (R === 0) worksheet[address].s = titleStyle;
            else if (R === 1) worksheet[address].s = subTitleStyle;
            else if (R === 3) worksheet[address].s = headerStyle;
            else if (R > 3) {
              worksheet[address].s = cellStyle;
            }
          }
        }

        // Set widths
        worksheet['!cols'] = [
          { wch: 18 }, { wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
          { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 18 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Orders");
        XLSX.writeFile(workbook, `Sales_Orders_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const mainColor = [7, 51, 24]; // #073318

        // Header Structure
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(mainColor[0], mainColor[1], mainColor[2]);
        doc.text("Sales Orders Report", pageWidth / 2, 18, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        const timestamp = `Exported on: ${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
        doc.text(timestamp, pageWidth - 14, 26, { align: "right" });

        const head = [["SO No", "Customer Name", "Cr. Date", "Exp. Date", "Amount", "GST Number", "Cr. Days", "Tax Amt", "Total Amt", "Status"]];
        const body = filteredData.map(so => [
          so.soNumber || "-",
          so.customerName || "-",
          formatDate(so.soCreationDate),
          formatDate(so.expiryDate),
          (so.totalAmount || 0).toFixed(2),
          so.gstNumber || "-",
          so.creditDays || 0,
          (so.taxAmount || 0).toFixed(2),
          (so.grandTotal || 0).toFixed(2),
          so.computedStatusLabel.toUpperCase()
        ]);

        autoTable(doc, {
          head: head,
          body: body,
          startY: 32,
          styles: {
            fontSize: 8.5,
            font: 'helvetica',
            cellPadding: 4,
            valign: 'middle'
          },
          headStyles: {
            fillColor: mainColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'left'
          },
          columnStyles: {
            0: { cellWidth: 28 }, // SO No
            1: { cellWidth: 45 }, // Customer Name
            4: { halign: 'right' }, // Amount
            6: { halign: 'center' }, // Cr. Days
            7: { halign: 'right' }, // Tax Amt
            8: { halign: 'right' }, // Total Amt
            9: { halign: 'left', fontStyle: 'bold' } // Status
          },
          didParseCell: function (data) {
            // Apply Status Colors
            if (data.section === 'body' && data.column.index === 9) {
              const status = data.cell.raw;
              if (status === 'EXPIRING SOON') {
                data.cell.styles.textColor = [217, 119, 6]; // Amber-600
              } else if (status === 'COMPLETED') {
                data.cell.styles.textColor = [5, 150, 105]; // Emerald-600
              } else if (status === 'DELETED') {
                data.cell.styles.textColor = [220, 38, 38]; // Red-600
              } else if (status === 'PENDING') {
                data.cell.styles.textColor = [234, 88, 12]; // Orange-600
              } else if (status === 'EXPIRED') {
                data.cell.styles.textColor = [71, 85, 105]; // Slate-600
              }
            }
          },
          alternateRowStyles: {
            fillColor: [252, 253, 253]
          },
          margin: { left: 14, right: 14 }
        });

        doc.save(`Sales_Orders_${new Date().toLocaleDateString('en-GB').replace(/\//g, '_')}.pdf`);
      }

      toast.success(`Exported to ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownloadSample = () => {
    try {
      const sampleData = [{
        "Customer Name*": "Global Exports Pvt Ltd",
        "Credit Days": 30,
        "Expiry Date (YYYY-MM-DD)*": "2024-05-15",
        "Product Code*": "PRD001",
        "Quantity*": 10,
        "Rate*": 1200.00,
        "Discount %": 5,
        "Discount Amount": 600.00,
        "Tax %": 18
      }, {
        "Customer Name*": "Global Exports Pvt Ltd",
        "Credit Days": 30,
        "Expiry Date (YYYY-MM-DD)*": "2024-05-15",
        "Product Code*": "PRD002",
        "Quantity*": 5,
        "Rate*": 2500.00,
        "Discount %": 0,
        "Discount Amount": 0,
        "Tax %": 12
      }];

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(sampleData);

      // Define Professional Styling
      const headerStyle = {
        font: { bold: true, color: { rgb: "000000" }, name: "Arial", sz: 11 },
        fill: { fgColor: { rgb: "F2F2F2" } },
        alignment: { horizontal: "left", vertical: "center" }, // Changed header to left for consistency
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };

      const dataStyle = {
        font: { name: "Arial", sz: 10 },
        alignment: { horizontal: "left", vertical: "center" } // Force left alignment for numbers
      };

      // Apply styles to all cells
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[address]) continue;

          if (R === 0) {
            worksheet[address].s = headerStyle; // First row is header
          } else {
            worksheet[address].s = dataStyle; // Other rows are data
          }
        }
      }

      // Setting column widths for better readability
      worksheet['!cols'] = [
        { wch: 30 }, // Customer Name
        { wch: 15 }, // Credit Days
        { wch: 25 }, // Expiry Date
        { wch: 15 }, // Product Code
        { wch: 12 }, // Quantity
        { wch: 12 }, // Rate
        { wch: 12 }, // Discount %
        { wch: 15 }, // Discount Amount
        { wch: 10 }  // Tax %
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Order Sample");
      XLSX.writeFile(workbook, "Sales_Order_Import_Template.xlsx");
      toast.success("Professional styled template downloaded!");
    } catch (error) {
      console.error("Sample download error:", error);
      toast.error("Failed to generate styled sample file.");
    }
  };

  const handleSubmitImport = () => {
    if (!selectedFile) return;
    setIsRefreshing(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet);

          if (json.length === 0) {
            toast.error("The uploaded file is empty.");
            setIsRefreshing(false);
            return;
          }

          // Map JSON to internal format
          const importedData = json.map((row, index) => ({
            id: `imported-${Date.now()}-${index}`,
            soNumber: row["SO NO"] || row["SO Number"] || `SO-IMP-${index}`,
            customerName: row["CUSTOMER NAME"] || row["Customer Name"] || "Unknown Customer",
            customerType: row["CUSTOMER TYPE"] || row["Customer Type"] || "Retail",
            soCreationDate: row["CREATION DATE"] || row["Creation Date"] || new Date().toISOString(),
            expiryDate: row["EXPIRY DATE"] || row["Expiry Date"] || new Date().toISOString(),
            totalAmount: parseFloat(row["AMOUNT"] || row["Amount"]) || 0,
            gstNumber: row["GST NUMBER"] || row["GST Number"] || "-",
            creditDays: parseInt(row["CREDIT DAYS"] || row["Credit Days"]) || 0,
            taxAmount: parseFloat(row["TAX AMOUNT"] || row["Tax Amount"]) || 0,
            grandTotal: parseFloat(row["TOTAL AMOUNT"] || row["Total Amount"]) || 0,
            status: (row["STATUS"] || row["Status"] || "pending").toLowerCase()
          }));

          setSalesOrders(prev => [...importedData, ...prev]);
          setTotalItemsCount(prev => prev + importedData.length);
          setIsImportModalOpen(false);
          setSelectedFile(null);
          toast.success(`${importedData.length} records imported successfully!`);
        } catch (err) {
          console.error("Parsing error:", err);
          toast.error("Invalid file format. Please use the provided sample template.");
        } finally {
          setIsRefreshing(false);
        }
      };
      reader.readAsBinaryString(selectedFile);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to read file.");
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
              <tr className="bg-emerald-900 text-white font-bold text-[15px] uppercase">
                {["SO No", "Customer Name", "Customer Type", "Creation Date", "Expiry Date", "Amount", "Gst Number", "Credit Days", "Tax Amount", "Total Amount", "Status", "Action"].map(h => (
                  <th key={h} className="px-6 py-5 border-r border-white/10 whitespace-nowrap" style={{ wordSpacing: '1px' }}>{h}</th>
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
                        <div className={`absolute right-full mr-2 w-max min-w-[220px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[110] py-2 animate-in zoom-in-95 duration-200 text-left font-bold ${idx >= currentItems.length - 3 ? 'bottom-0' : 'top-0'}`}>
                          {/* View Option (Always) */}
                          <button onClick={() => navigate(ROUTES.SALES_ORDER_VIEW.replace(':id', so.id))} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] uppercase border-b border-gray-50">
                            <Eye size={18} />
                            {(so.computedStatusLabel === 'Pending' || so.computedStatusLabel === 'Expiring Soon') ? 'View / Edit SO' : 'View SO'}
                          </button>

                          {/* Print Option (Not for Deleted) */}
                          {so.computedStatusLabel !== 'Deleted' && (
                            <button onClick={() => handlePrint(so)} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] uppercase border-b border-gray-50">
                              <Printer size={18} /> Print
                            </button>
                          )}

                          {/* Delete Option (Only for Expired) */}
                          {so.computedStatusLabel === 'Expired' && (
                            <button onClick={() => handleDeleteSO(so.id)} className="w-full px-5 py-3.5 flex items-center gap-3 text-red-600 hover:bg-red-50 uppercase">
                              <Trash2 size={18} /> Delete
                            </button>
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
      {createPortal(
        <>
          {isImportModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] transition-all duration-300" onClick={() => { setIsImportModalOpen(false); setSelectedFile(null); }} />
              <div className="relative bg-white w-full max-w-[500px] rounded-[24px] shadow-2xl p-10 space-y-8 animate-in zoom-in-95 duration-300 border border-gray-100">
                <div className="text-center space-y-2">
                  <h3 className="text-[24px] font-bold text-[#111827] uppercase tracking-tight font-outfit">Import Sales Orders</h3>
                  <p className="text-gray-500 text-[14px] font-medium font-outfit">Download the sample file to ensure correct format.</p>
                </div>

                <button
                  onClick={handleDownloadSample}
                  className="w-full py-4 border-2 border-emerald-100 bg-emerald-50 text-emerald-700 rounded-[14px] font-bold uppercase transition-all hover:bg-emerald-100 flex items-center justify-center gap-3 active:scale-95 duration-200 shadow-sm"
                >
                  <Download size={20} /> Download Sample XLSX
                </button>

                <div className="space-y-4 font-outfit">
                  <label className="text-[13px] font-bold text-gray-500 uppercase tracking-widest block text-center">Upload Template</label>
                  <div className={`border-2 border-dashed rounded-[18px] h-[72px] flex items-center overflow-hidden transition-all duration-300 ${selectedFile ? 'border-[#073318] bg-emerald-50/50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                    <label className="h-full px-8 flex items-center justify-center bg-white border-r border-dashed border-gray-200 font-bold uppercase text-[14px] cursor-pointer hover:bg-gray-50 transition-all text-[#073318]">
                      Browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;

                          const allowedExtensions = ['xlsx', 'xls', 'csv'];
                          const fileExtension = file.name.split('.').pop().toLowerCase();

                          if (!allowedExtensions.includes(fileExtension)) {
                            toast.error("Invalid file type. Only Excel and CSV files are allowed.");
                            e.target.value = '';
                            setSelectedFile(null);
                            return;
                          }
                          setSelectedFile(file);
                        }}
                      />
                    </label>
                    <div className="px-6 flex items-center gap-2 truncate flex-1 min-w-0">
                      {selectedFile ? (
                        <>
                          <FileSpreadsheet size={18} className="text-[#073318] shrink-0" />
                          <span className="text-[14px] font-bold text-[#073318] truncate uppercase tracking-tight">{selectedFile.name}</span>
                          <button onClick={() => setSelectedFile(null)} className="ml-auto p-1.5 hover:bg-emerald-100 rounded-full text-emerald-700 transition-colors"><X size={14} /></button>
                        </>
                      ) : (
                        <span className="text-[14px] font-bold text-gray-400 uppercase tracking-tight">No file chosen...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => { setIsImportModalOpen(false); setSelectedFile(null); }}
                    className="flex-1 py-4 border border-[#E5E7EB] text-[#4B5563] rounded-[14px] font-bold uppercase transition-all hover:bg-gray-50 active:scale-95 duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitImport}
                    disabled={!selectedFile || isRefreshing}
                    className={`flex-[2] py-4 rounded-[14px] font-bold uppercase shadow-lg transition-all active:scale-95 duration-200 ${selectedFile ? 'bg-[#073318] text-white hover:bg-[#04200f]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    {isRefreshing ? 'Importing...' : 'Submit Data'}
                  </button>
                </div>
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
                <div className="relative">
                  <select
                    value={filterInputs.status}
                    onChange={(e) => setFilterInputs({ ...filterInputs, status: e.target.value })}
                    className="w-full h-14 bg-white border border-gray-200 rounded-[12px] px-5 text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 appearance-none font-outfit"
                  >
                    {statusTabs.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={20} />
                  </div>
                </div>
              </div>
              <div className="mt-auto pb-16 flex gap-4">
                <button onClick={handleClearFilter} className="flex-1 h-14 border border-[#E5E7EB] rounded-[14px] font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all font-outfit">Clear</button>
                <button onClick={handleApplyFilter} className="flex-1 h-14 bg-[#073318] text-white rounded-[14px] font-bold uppercase tracking-widest hover:bg-[#04200f] shadow-lg transition-all font-outfit">Apply</button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default SalesOrder;
