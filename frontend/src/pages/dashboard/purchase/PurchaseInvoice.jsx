import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
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
  Plus,
  Printer,
  History
} from "lucide-react";
import toast from 'react-hot-toast';
import { ROUTES } from "../../../constants/routes";
import purchaseInvoiceService from "../../../services/purchaseInvoiceService";

const PurchaseInvoice = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRefs = useRef({});
  const exportRef = useRef(null);

  // Pagination state
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Data state
  const [invoices, setInvoices] = useState([]);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
  };

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const response = await purchaseInvoiceService.getAllInvoices();
            const data = Array.isArray(response) ? response : (response.data || []);
            
            // Filter locally for now as backend search is basic
            let filtered = data;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = data.filter(inv => 
                    inv.invoiceNumber.toLowerCase().includes(query) ||
                    inv.supplierName.toLowerCase().includes(query) ||
                    inv.supplierInvoiceNumber.toLowerCase().includes(query)
                );
            }

            setInvoices(filtered);
            setTotalItemsCount(filtered.length);
        } catch (error) {
            console.error("Error fetching purchase invoices:", error);
            toast.error("Failed to load invoices");
        } finally {
            setIsLoading(false);
        }
    };

    fetchData();
  }, [searchQuery, activeTab, isRefreshing]);

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

  const totalPages = Math.ceil(totalItemsCount / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = invoices.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleRefresh = () => {
    setIsRefreshing(!isRefreshing);
    toast.success("Data refreshed");
  };

  const handleExport = async (format) => {
    try {
        setIsExportOpen(false);
        const data = await purchaseInvoiceService.exportInvoices(format, searchQuery);
        const url = window.URL.createObjectURL(new Blob([data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `purchase_invoices.${format === 'xlsx' ? 'xlsx' : 'pdf'}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
        toast.error("Export failed");
    }
  };

  const handlePrint = async (id) => {
    try {
        const data = await purchaseInvoiceService.printInvoice(id);
        const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        window.open(url, '_blank');
    } catch (error) {
        toast.error("Failed to generate print preview");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 font-['Plus_Jakarta_Sans']">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-[#073318] rounded-xl shadow-lg shadow-emerald-900/10">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase Invoice</h1>
            </div>
            <p className="text-gray-500 font-medium">Manage and track your purchase invoices efficiently</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={handleRefresh}
              className="p-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="relative" ref={exportRef}>
              <button 
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExportOpen ? 'rotate-180' : ''}`} />
              </button>
              {isExportOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-[#073318] transition-colors">
                    <FileText className="w-4 h-4" />
                    <span className="font-medium text-sm">Download PDF</span>
                  </button>
                  <button onClick={() => handleExport('xlsx')} className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-emerald-50 hover:text-[#073318] transition-colors">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="font-medium text-sm">Download Excel</span>
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={() => navigate('add')} // We'll build AddPurchaseInvoice next or use existing AddPO if possible, but separate is better.
              className="flex items-center gap-2 px-6 py-2.5 bg-[#073318] text-white rounded-xl font-bold hover:bg-[#0a4d25] transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Invoices', value: totalItemsCount, color: 'emerald' },
            { label: 'Total Tax Amt', value: `₹ ${invoices.reduce((acc, curr) => acc + (curr.cgstAmount + curr.sgstAmount), 0).toLocaleString()}`, color: 'blue' },
            { label: 'Total Amount', value: `₹ ${invoices.reduce((acc, curr) => acc + curr.grandTotal, 0).toLocaleString()}`, color: 'green' },
            { label: 'Active Suppliers', value: new Set(invoices.map(i => i.supplierName)).size, color: 'purple' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-sm font-semibold text-gray-500 mb-1">{stat.label}</p>
              <h4 className="text-xl font-bold text-gray-900">{stat.value}</h4>
            </div>
          ))}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 p-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by invoice number, supplier..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#073318]/10 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors">
                <Filter className="w-4 h-4" />
                <span>Advanced Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left font-bold text-gray-600 text-sm uppercase tracking-wider">Invoice Details</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-600 text-sm uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-600 text-sm uppercase tracking-wider">Booking Date</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-600 text-sm uppercase tracking-wider">Taxable Amt</th>
                  <th className="px-6 py-4 text-right font-bold text-gray-600 text-sm uppercase tracking-wider">Grand Total</th>
                  <th className="px-6 py-4 text-center font-bold text-gray-600 text-sm uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center font-bold text-gray-600 text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                    <tr>
                        <td colSpan="7" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <RefreshCw className="w-8 h-8 text-[#073318] animate-spin" />
                                <p className="text-gray-500 font-medium tracking-wide">Loading Invoices...</p>
                            </div>
                        </td>
                    </tr>
                ) : currentItems.length === 0 ? (
                    <tr>
                        <td colSpan="7" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <Search className="w-10 h-10 text-gray-300" />
                                <p className="text-gray-500 font-medium">No invoices found matching your criteria</p>
                            </div>
                        </td>
                    </tr>
                ) : (
                  currentItems.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-gray-900 group-hover:text-[#073318] transition-colors">{inv.invoiceNumber}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Ref: {inv.supplierInvoiceNumber || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-700">{inv.supplierName}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <FileText className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500">PO: {inv.poNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600 tracking-tight">
                        {formatDate(inv.bookingDate)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-gray-900 tracking-tight">₹{inv.taxableAmount.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-extrabold text-[#073318] tracking-tight">₹{inv.grandTotal.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wide">
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handlePrint(inv.id)}
                            className="p-2 text-gray-500 hover:text-[#073318] hover:bg-emerald-50 rounded-lg transition-all"
                            title="Print Invoice"
                          >
                            <Printer className="w-4.5 h-4.5" />
                          </button>
                          <div className="relative" ref={el => dropdownRefs.current[inv.id] = el}>
                            <button 
                              onClick={() => setActiveDropdown(activeDropdown === inv.id ? null : inv.id)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <MoreVertical className="w-4.5 h-4.5" />
                            </button>
                            {activeDropdown === inv.id && (
                              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 transition-colors">
                                  <Eye className="w-4 h-4" />
                                  <span className="font-semibold">View Details</span>
                                </button>
                                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 transition-colors">
                                  <History className="w-4 h-4" />
                                  <span className="font-semibold">Log</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {!isLoading && invoices.length > 0 && (
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-sm font-semibold text-gray-500">
                    Showing <span className="text-[#073318]">{startIndex + 1}</span> to <span className="text-[#073318]">{Math.min(startIndex + itemsPerPage, totalItemsCount)}</span> of <span className="text-[#073318]">{totalItemsCount}</span> invoices
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i}
                            onClick={() => handlePageChange(i + 1)}
                            className={`min-w-[36px] h-9 px-2 flex items-center justify-center rounded-lg text-sm font-bold transition-all shadow-sm ${
                                currentPage === i + 1 
                                ? 'bg-[#073318] text-white' 
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-top-2 { from { transform: translateY(-0.5rem); } to { transform: translateY(0); } }
        @keyframes zoom-in-95 { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-in { animation-duration: 200ms; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); animation-fill-mode: forwards; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-top-2 { animation-name: slide-in-from-top-2; }
        .zoom-in-95 { animation-name: zoom-in-95; }
      `}} />
    </div>
  );
};

export default PurchaseInvoice;
