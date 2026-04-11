import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";
import {
  Plus,
  Search,
  Download,
  MoreVertical,
  X,
  FileText,
  FileSpreadsheet,
  Eye,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Upload,
  ChevronsUpDown,
  Filter,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { ROUTES } from "../../../constants/routes";
import { useTranslation } from "react-i18next";
import ScrollableTable from "../../../components/common/ScrollableTable";

const SalesInvoice = () => {
  const { t } = useTranslation(["modules", "common"]);
  const navigate = useNavigate();

  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Invoice"); // Sub-tabs: Invoice, Challan
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [appliedStatus, setAppliedStatus] = useState("All");

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Refs
  const dropdownRefs = useRef({});
  const exportRef = useRef(null);
  const filterPanelRef = useRef(null);
  const fileInputRef = useRef(null);

  // Mock Data generation for 50 records
  const mockData = useMemo(() => {
    const customers = ["Shree Agro Traders", "Global Industrial", "Metro Supplies Co.", "Apex Logistics", "Zenith Manufacturing", "Dynamic Solutions", "Silverline Systems", "Organic Harvest", "Prime Distributing", "Global Connect"];
    const statuses = ["Pending", "Completed", "Expiring Soon", "Expired", "Deleted"];
    
    return Array.from({ length: 50 }, (_, i) => {
      const id = i + 1;
      const customer = customers[i % customers.length];
      const status = statuses[i % statuses.length];
      const baseAmt = 1200 + (i * 125);
      const taxAmt = baseAmt * 0.18;
      
      // Rotate dates to look realistic
      const day = String((i % 28) + 1).padStart(2, '0');
      const month = String((i % 3) + 1).padStart(2, '0');
      
      return {
        id,
        invoiceNo: `INV-${String(id).padStart(4, '0')}`,
        customerName: customer,
        customerType: customer,
        bookingDate: `${day}-${month}-2026`,
        invoiceDate: `${String(parseInt(day) + 2).padStart(2, '0')}-${month}-2026`,
        soNo: `PO${String(id).padStart(5, '0')}`,
        gstNo: `27${Math.random().toString(36).substring(2, 11).toUpperCase()}Z${i%9}`,
        creditDays: ((i % 4) + 1) * 15,
        taxableAmount: baseAmt,
        taxAmount: taxAmt,
        grossAmount: baseAmt + taxAmt,
        status: status
      };
    });
  }, []);

  // Logic: Click Outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Export dropdown
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }
      // Action dropdowns
      if (activeDropdown !== null) {
        const ref = dropdownRefs.current[activeDropdown];
        if (ref && !ref.contains(event.target)) {
          setActiveDropdown(null);
        }
      }
      // Filter panel
      if (isFilterOpen && filterPanelRef.current && !filterPanelRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown, isFilterOpen]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Data refreshed successfully");
    }, 400);
  };

  const handleApplyFilter = () => {
    setAppliedStatus(selectedStatus);
    setIsFilterOpen(false);
    setCurrentPage(1);
  };

  const handleClearFilter = () => {
    setSelectedStatus("All");
    setAppliedStatus("All");
    setIsFilterOpen(false);
    setCurrentPage(1);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = () => {
    if (!selectedFile) return;
    setIsRefreshing(true);
    const promise = new Promise((resolve) => setTimeout(resolve, 1500));
    toast.promise(promise, {
      loading: "Importing data...",
      success: "Data imported successfully!",
      error: "Failed to import data.",
    });
    promise.then(() => {
      setIsRefreshing(false);
      setIsImportModalOpen(false);
      setSelectedFile(null);
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("ERP", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(16);
    doc.text("Sales Invoice Report", pageWidth / 2, 25, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Exported on: ${dateStr}, ${timeStr}`, pageWidth - 20, 35, {
      align: "right",
    });

    // Table
    const tableColumn = [
      "Invoice No",
      "Customer Name",
      "Type",
      "Booking Date",
      "Invoice Date",
      "SO No",
      "GST No",
      "Days",
      "Taxable",
      "Tax",
      "Gross",
      "Status",
    ];

    const tableRows = filteredData.map((item) => [
      item.invoiceNo,
      item.customerName,
      item.customerType,
      item.bookingDate,
      item.invoiceDate,
      item.soNo,
      item.gstNo || "-",
      item.creditDays,
      item.taxableAmount.toFixed(2),
      item.taxAmount.toFixed(2),
      item.grossAmount.toFixed(2),
      item.status,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      headStyles: {
        fillColor: [54, 92, 245], // Blue background like ref image
        textColor: 255,
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        valign: "middle",
        halign: "center",
      },
      columnStyles: {
        1: { halign: "left", cellWidth: 40 },
        6: { fontSize: 8 },
      },
    });

    doc.save("sales_invoice_report.pdf");
    setIsExportOpen(false);
    toast.success("PDF exported successfully");
  };

  const exportToExcel = () => {
    const now = new Date();
    const dateTimeStr = `${now.toLocaleDateString()}, ${now.toLocaleTimeString()}`;

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Prepare Header & Main Data
    const data = [
      ["ERP"],
      ["Sales Invoice Report"],
      [`Exported on: ${dateTimeStr}`],
      [], // Spacer
      [
        "Invoice No",
        "Customer Name",
        "Customer Type",
        "Booking Date",
        "Invoice Date",
        "SO No",
        "GST No",
        "Credit Days",
        "Taxable Amount",
        "Tax Amount",
        "Gross Amount",
        "Status",
      ],
    ];

    // Add Table Data
    filteredData.forEach((item) => {
      data.push([
        item.invoiceNo,
        item.customerName,
        item.customerType,
        item.bookingDate,
        item.invoiceDate,
        item.soNo,
        item.gstNo || "-",
        item.creditDays,
        parseFloat(item.taxableAmount || 0).toFixed(2),
        parseFloat(item.taxAmount || 0).toFixed(2),
        parseFloat(item.grossAmount || 0).toFixed(2),
        item.status,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Get range
    const range = XLSX.utils.decode_range(ws["!ref"]);

    // --- Styling logic ---

    // Define Styles
    const titleStyle = {
      font: { bold: true, sz: 20, name: "Arial" },
      alignment: { horizontal: "center", vertical: "center" },
    };
    const subTitleStyle = {
      font: { bold: true, sz: 14, name: "Arial" },
      alignment: { horizontal: "center", vertical: "center" },
    };
    const infoStyle = {
      font: { sz: 10, name: "Arial" },
      alignment: { horizontal: "right", vertical: "center" },
    };
    const headerStyle = {
      fill: { fgColor: { rgb: "4472C4" } }, // Using a standard Blue (like Image 2)
      font: { color: { rgb: "FFFFFF" }, bold: true, name: "Arial" },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    // Apply styles to Rows 1-3 (taking merges into account)
    // ERP (Row 1)
    if (ws["A1"]) ws["A1"].s = titleStyle;
    // Report Title (Row 2)
    if (ws["A2"]) ws["A2"].s = subTitleStyle;
    // Exported Info (Row 3) - Need to apply to A3 because of merge
    if (ws["A3"]) ws["A3"].s = infoStyle;

    // Apply styles to Table Header (Row 5 - index 4)
    for (let c = 0; c <= 11; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 4, c: c });
      if (!ws[cellAddress]) ws[cellAddress] = { t: "s", v: "" };
      ws[cellAddress].s = headerStyle;
    }

    // Apply styles to Table Body (Rows 6+ - index 5+)
    for (let r = 5; r <= range.e.r; r++) {
      for (let c = 0; c <= 11; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r, c: c });
        if (!ws[cellAddress]) continue;

        const cellStyle = {
          font: { sz: 10, name: "Arial" },
          border: {
            top: { style: "thin", color: { rgb: "D1D5DB" } },
            bottom: { style: "thin", color: { rgb: "D1D5DB" } },
            left: { style: "thin", color: { rgb: "D1D5DB" } },
            right: { style: "thin", color: { rgb: "D1D5DB" } },
          },
          alignment: { vertical: "center" },
        };

        // Alignments
        if (c === 3 || c === 4) {
          cellStyle.alignment.horizontal = "center"; // Dates
        } else if (c >= 7 && c <= 10) {
          cellStyle.alignment.horizontal = "right"; // Numbers
        } else {
          cellStyle.alignment.horizontal = "left"; // Default
        }

        ws[cellAddress].s = cellStyle;
      }
    }

    // --- Layout Properties ---

    // Merges
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, // ERP
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } }, // Report Title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } }, // Timestamp
    ];

    // Column Widths
    ws["!cols"] = [
      { wch: 18 }, // Invoice No
      { wch: 35 }, // Customer Name
      { wch: 25 }, // Customer Type
      { wch: 15 }, // Booking Date
      { wch: 15 }, // Invoice Date
      { wch: 15 }, // SO No
      { wch: 22 }, // GST No
      { wch: 12 }, // Credit Days
      { wch: 18 }, // Taxable Amount
      { wch: 15 }, // Tax Amount
      { wch: 18 }, // Gross Amount
      { wch: 12 }, // Status
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Sales Invoices");
    XLSX.writeFile(wb, "sales_invoice_report.xlsx");
    setIsExportOpen(false);
    toast.success("Excel exported successfully");
    setIsExportOpen(false);
    toast.success("Excel exported successfully");
  };

  const filteredData = useMemo(() => {
    let data = mockData;

    // Apply Status Filter
    if (appliedStatus !== "All") {
      data = data.filter((item) => item.status === appliedStatus);
    }

    // Apply Search Filter
    const query = searchQuery.toLowerCase();
    if (query) {
      data = data.filter((item) => {
        const searchFields = [
          item.invoiceNo,
          item.customerName,
          item.customerType,
          item.bookingDate,
          item.invoiceDate,
          item.soNo,
          item.gstNo,
          item.status,
          item.creditDays?.toString(),
          item.taxableAmount?.toString(),
          item.taxAmount?.toString(),
          item.grossAmount?.toString(),
        ];

        return searchFields.some((field) =>
          field?.toString().toLowerCase().includes(query),
        );
      });
    }

    return data;
  }, [searchQuery, appliedStatus]);

  const totalItemsCount = filteredData.length;
  const totalPages = Math.ceil(totalItemsCount / itemsPerPage);
  const currentItems = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="flex flex-col w-full relative">
      {/* Title & Action Bar - Matching SO styling */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 md:mb-8 justify-between items-center font-outfit uppercase">
        <h1 className="text-[24px] md:text-[28px] font-bold text-[#111827] tracking-tight">
          Sales Invoice
        </h1>
      </div>

      {/* Sub-Tabs (Invoice/Challan) */}
      <div className="flex items-center justify-center gap-16 mb-4 border-b border-[#E5E7EB]">
        {["Invoice", "Challan"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 pb-4 text-[18px] font-bold transition-all relative ${
              activeTab === tab
                ? "text-[#073318]"
                : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#073318] rounded-full" />
            )}
          </button>
        ))}
      </div>


      {/* Tab Content */}
      {activeTab === "Invoice" ? (
        <>
          {/* Action Button Section - Positioned between Tabs and Table */}
          <div className="flex justify-end items-center mb-4">
            <button
              onClick={() => navigate("/seller/sales/invoice/add")}
              className="px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 duration-200"
            >
              <Plus size={18} /> Add SI
            </button>
          </div>

          {/* Main Card - Matching SO card and font-outfit */}
          <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden mb-8 font-outfit">
            {/* Search & Utility Bar - Matching SO Action Bar */}
            <div className="p-4 md:p-6 border-b border-[#F3F4F6] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-[320px]">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder={t(
                      "common:search_by_anything",
                      "Search By Anything...",
                    )}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 font-bold"
                  />
                  {searchQuery && (
                    <X
                      size={16}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                      onClick={() => setSearchQuery("")}
                    />
                  )}
                </div>
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-2 px-6 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all uppercase bg-white border-[#E5E7EB] text-[#4B5563]`}
                >
                  <Filter size={18} className="text-gray-400" />
                  Filter
                </button>
                <button
                  onClick={handleRefresh}
                  className={`w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] flex items-center justify-center hover:bg-gray-50 transition-all ${isRefreshing ? "animate-spin border-[#073318]" : ""}`}
                >
                  <RefreshCw
                    size={18}
                    className={isRefreshing ? "text-[#073318]" : "text-gray-400"}
                  />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-3 px-6 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all shadow-sm active:scale-95 duration-200 uppercase"
                >
                  <Upload size={18} className="text-gray-400" /> Import
                </button>
                <div className="relative" ref={exportRef}>
                  <button
                    onClick={() => setIsExportOpen(!isExportOpen)}
                    className="flex items-center gap-2 px-6 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 uppercase"
                  >
                    <Download size={18} className="text-gray-400" /> Export
                  </button>
                  {isExportOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[180px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-50 py-2 animate-in slide-in-from-top-2 duration-200 uppercase font-bold">
                      <button
                        onClick={exportToPDF}
                        className="w-full px-5 py-3 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] transition-colors"
                      >
                        <FileText size={18} className="text-red-500" /> PDF
                      </button>
                      <button
                        onClick={exportToExcel}
                        className="w-full px-4 py-3 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] transition-colors"
                      >
                        <FileSpreadsheet size={18} className="text-emerald-600" />{" "}
                        Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Table - Matching SO styling (Emerald header) */}
            <ScrollableTable>
              <table className="w-full min-w-[1700px] border-collapse text-left font-outfit">
                <thead>
                  <tr className="bg-emerald-900 text-white font-bold text-[15px]">
                    {[
                      { label: "Invoice No", key: "invoiceNo" },
                      { label: "Customer Name", key: "customerName" },
                      { label: "Customer Type", key: "customerType" },
                      { label: "Booking Date", key: "bookingDate" },
                      { label: "Invoice Date", key: "invoiceDate" },
                      { label: "SO No", key: "soNo" },
                      { label: "GST No", key: "gstNo" },
                      { label: "Credit Days", key: "creditDays" },
                      { label: "Taxable Amount", key: "taxableAmount" },
                      { label: "Tax Amount", key: "taxAmount" },
                      { label: "Gross Amount", key: "grossAmount" },
                      { label: "Status", key: "status" },
                      { label: "Action", key: "action" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="px-6 py-5 border-r border-white/10 whitespace-nowrap uppercase tracking-wider"
                      >
                        <div className="flex items-center gap-2">
                          {col.label}
                          {col.key !== "action" && (
                            <ChevronsUpDown size={14} className="text-white/30" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  className={`text-[14px] text-[#111827] ${isRefreshing ? "opacity-40" : "opacity-100"}`}
                >
                  {currentItems.length > 0 ? (
                    currentItems.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all group"
                      >
                        <td className="px-6 py-5 font-bold text-[#111827]">
                          {item.invoiceNo}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#111827]">
                          {item.customerName}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#6B7280]">
                          {item.customerType}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#4B5563]">
                          {item.bookingDate}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#4B5563]">
                          {item.invoiceDate}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#111827]">
                          {item.soNo}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#6B7280]">
                          {item.gstNo || "-"}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#6B7280] text-center">
                          {item.creditDays}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#111827]">
                          {item.taxableAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#111827]">
                          {item.taxAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-5 font-bold text-[#073318]">
                          {item.grossAmount.toFixed(2)}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span
                            className={`px-4 py-1.5 rounded-full text-[12px] font-bold shadow-sm inline-flex min-w-[100px] justify-center ${
                              item.status === "Deleted"
                                ? "bg-red-50 text-red-600"
                                : "bg-emerald-50 text-emerald-600"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td
                          className="px-6 py-5 text-center relative"
                          ref={(el) => (dropdownRefs.current[item.id] = el)}
                        >
                          <button
                            onClick={() =>
                              setActiveDropdown(
                                activeDropdown === item.id ? null : item.id,
                              )
                            }
                            className={`p-2 rounded-lg transition-all ${
                              activeDropdown === item.id
                                ? "bg-[#073318] text-white"
                                : "text-gray-400 hover:bg-gray-100"
                            }`}
                          >
                            <MoreVertical size={20} />
                          </button>
                          {activeDropdown === item.id && (
                            <div
                              className={`absolute right-full mr-2 w-max min-w-[180px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[110] py-2 animate-in zoom-in-95 duration-200 text-left font-bold ${
                                idx >= currentItems.length - 2
                                  ? "bottom-0"
                                  : "top-0"
                              }`}
                            >
                              <button className="w-full px-5 py-3.5 flex items-center gap-3 text-[#111827] hover:bg-[#F9FAFB] uppercase text-[12px] border-b border-gray-50">
                                <Eye size={18} className="text-gray-400" /> View SI
                              </button>
                              <button className="w-full px-5 py-3.5 flex items-center gap-3 text-[#111827] hover:bg-[#F9FAFB] uppercase text-[12px]">
                                <Eye size={18} className="text-gray-400" /> View &
                                Edit SI
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="13"
                        className="px-6 py-24 text-center text-gray-400 font-bold uppercase tracking-widest bg-white"
                      >
                        No results found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollableTable>

            {/* Pagination - Matching Master module styling exactly */}
            <div className="px-4 sm:px-6 py-4 border-t border-[#F3F4F6] bg-white flex flex-row items-center justify-between gap-4 font-outfit">
              {/* Left Side: Show per page */}
              <div className="flex items-center gap-2 text-[13px] text-[#6B7280] font-medium">
                <span className="hidden sm:inline">Show</span>
                <div className="relative group">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="appearance-none border border-[#E5E7EB] rounded-[8px] pl-3 pr-8 py-1.5 outline-none focus:border-[#0A3622] text-[#111827] bg-[#F9FAFB] cursor-pointer font-bold transition-all hover:bg-white"
                  >
                    {[5, 10, 20, 50].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#0A3622]"
                  />
                </div>
                <span className="hidden sm:inline">per page</span>
              </div>

              {/* Right Side: Info + Controls grouped */}
              <div className="flex items-center gap-3">
                <span className="text-[#6B7280] text-[13px] font-medium whitespace-nowrap">
                  {totalItemsCount > 0
                    ? `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalItemsCount)} of ${totalItemsCount}`
                    : "0-0 of 0"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="hidden md:flex items-center gap-1.5 px-1">
                    {(() => {
                      const maxVisible = 4;
                      let startPage = 1;

                      if (totalPages <= maxVisible) {
                        startPage = 1;
                      } else if (currentPage <= 2) {
                        startPage = 1;
                      } else if (currentPage >= totalPages - 1) {
                        startPage = totalPages - 3;
                      } else {
                        startPage = currentPage - 1;
                      }

                      const endPage = Math.min(startPage + maxVisible - 1, totalPages);
                      const pages = [];
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(i);
                      }

                      return pages.map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`min-w-[32px] h-[32px] rounded-[8px] flex items-center justify-center transition-all text-[13px] font-bold ${
                            currentPage === page
                              ? "bg-[#F9FAFB] text-[#111827] shadow-sm border border-gray-100"
                              : "text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]"
                          }`}
                        >
                          {page}
                        </button>
                      ));
                    })()}
                  </div>
                  <button
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Challan Tab - Under Development Placeholder */
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-[18px] font-bold text-[#9CA3AF] uppercase tracking-widest">
            This Page Is Under Development
          </p>
        </div>
      )}


      {/* Filter Sidebar Drawer */}
      {isFilterOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] transition-opacity duration-300"
            onClick={() => setIsFilterOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            ref={filterPanelRef}
            className={`fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl z-[101] flex flex-col transform transition-transform duration-300 font-outfit uppercase overflow-hidden ${
              isFilterOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="bg-[#073318] px-6 py-5 flex items-center justify-between">
              <h2 className="text-white text-[18px] font-bold tracking-tight">
                Apply Filters
              </h2>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 space-y-8 overflow-y-auto">
              <div className="space-y-4">
                <label className="text-[14px] font-bold text-[#4B5563]">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full h-[52px] px-5 bg-white border border-[#E5E7EB] rounded-[10px] text-[15px] font-bold text-[#111827] outline-none hover:border-[#073318] focus:border-[#073318] transition-all cursor-pointer appearance-none"
                  >
                    {[
                      "All",
                      "Pending",
                      "Expiring Soon",
                      "Expired",
                      "Completed",
                      "Deleted",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    size={18}
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-[#F3F4F6] grid grid-cols-2 gap-4">
              <button
                onClick={handleClearFilter}
                className="h-[52px] border border-[#E5E7EB] rounded-[10px] text-[15px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
              >
                Clear
              </button>
              <button
                onClick={handleApplyFilter}
                className="h-[52px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all active:scale-95 shadow-lg shadow-[#073318]/10"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center font-outfit">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsImportModalOpen(false)}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-[500px] bg-white rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 uppercase">
            {/* Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-50">
              <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                Import Data
              </h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="px-8 py-10 flex flex-col items-center">
              {/* Download Section */}
              <div className="w-full mb-10">
                <button className="w-full flex items-center justify-center gap-3 py-4 bg-[#E9F7EF] text-[#073318] rounded-[14px] text-[15px] font-bold hover:bg-[#D4EEDC] transition-all border border-[#073318]/5 group">
                  <Download
                    size={20}
                    className="group-hover:-translate-y-0.5 transition-transform"
                  />{" "}
                  Download Sample
                </button>
              </div>

              {/* Upload Section */}
              <div className="w-full space-y-4 text-center">
                <p className="text-[13px] font-bold text-[#6B7280] tracking-wider uppercase">
                  Upload File
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center h-[60px] border-2 border-dashed border-gray-200 rounded-[14px] overflow-hidden cursor-pointer hover:border-[#073318] transition-colors bg-gray-50/50 group"
                >
                  <div className="h-full px-6 flex items-center bg-gray-100 border-r border-gray-200 text-[14px] font-bold text-[#374151] group-hover:bg-gray-200 transition-colors">
                    BROWSE
                  </div>
                  <div className="flex-1 px-5 text-[14px] font-bold text-[#9CA3AF] truncate text-left">
                    {selectedFile ? selectedFile.name : "NO FILE CHOSEN..."}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".csv, .xlsx, .xls"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                disabled={!selectedFile}
                onClick={handleImportSubmit}
                className={`w-full mt-10 h-[56px] rounded-[14px] text-[15px] font-bold transition-all shadow-lg ${
                  selectedFile
                    ? "bg-[#073318] text-white hover:bg-[#04200f] active:scale-95 shadow-[#073318]/10"
                    : "bg-gray-100 text-[#9CA3AF] cursor-not-allowed border border-gray-100 shadow-none"
                }`}
              >
                SUBMIT DATA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesInvoice;
