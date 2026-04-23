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
  RefreshCw,
  Trash2,
  Upload,
  FileEdit,
  Printer
} from "lucide-react";
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import salesInvoiceService from "@/services/salesInvoiceService";
import { ROUTES } from "@/constants/routes";
import ScrollableTable from "@/components/common/ScrollableTable";
import ImportModal from "./components/ImportModal";

const DeleteConfirmModal = ({ isOpen, onCancel, onConfirm, isDeleting }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={onCancel} />
      <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 font-outfit">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 size={32} className="text-red-500" />
          </div>
          <h3 className="text-[20px] font-bold text-[#111827] mb-2 uppercase tracking-tight">Delete Invoice</h3>
          <p className="text-[#6B7280] text-[15px] font-medium mb-8">Are you sure you want to delete this Sales Invoice? This action will mark its status as deleted.</p>
          <div className="flex gap-4">
            <button onClick={onCancel} disabled={isDeleting} className="flex-1 h-[52px] rounded-[14px] border border-[#E5E7EB] text-[14px] font-bold text-[#4B5563] uppercase tracking-widest hover:bg-gray-50 transition-all">No, Keep it</button>
            <button onClick={onConfirm} disabled={isDeleting} className="flex-1 h-[52px] rounded-[14px] bg-red-600 text-white text-[14px] font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-red-700 transition-all">
              {isDeleting ? <RefreshCw size={18} className="animate-spin" /> : "Yes, Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesInvoice = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState("");
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [invoices, setInvoices] = useState([]);
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [invToDelete, setInvToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const exportRef = useRef(null);

    // Filter State
    const defaultFilters = { status: "All" };
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterInputs, setFilterInputs] = useState(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
    const isFilterApplied = appliedFilters.status !== "All";

    // Pagination
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params = { page: currentPage, limit: itemsPerPage, search: searchQuery };
            if (appliedFilters.status !== "All") {
                params.status = appliedFilters.status.toLowerCase();
            }
            const response = await salesInvoiceService.getAllInvoices(params);
            const data = Array.isArray(response) ? response : (response.data || []);
            setInvoices(data);
            setTotalItemsCount(response.meta?.total || data.length);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            toast.error("Failed to load invoices");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [currentPage, itemsPerPage, searchQuery, appliedFilters]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown !== null) {
                const menu = document.querySelector(`[data-menu-id="${activeDropdown}"]`);
                const btn = document.querySelector(`[data-dropdown-id="${activeDropdown}"]`);
                if (btn && !btn.contains(event.target) && menu && !menu.contains(event.target)) {
                    setActiveDropdown(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', () => setActiveDropdown(null));
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', () => setActiveDropdown(null));
        };
    }, [activeDropdown]);

    const handleDropdownToggle = (e, id) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setDropdownPos({ 
            top: rect.bottom + window.scrollY, 
            left: rect.left + window.scrollX 
        });
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    const handleExportPDF = async () => {
        setIsExportOpen(false);
        try {
            const response = await salesInvoiceService.exportInvoices('pdf', searchQuery);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `sales_invoices_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            toast.success('PDF Exported Successfully');
        } catch (e) {
            toast.error('Failed to export PDF');
        }
    };

    const handleExportExcel = async () => {
        setIsExportOpen(false);
        try {
            const response = await salesInvoiceService.exportInvoices('xlsx', searchQuery);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `sales_invoices_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            toast.success('Excel Exported Successfully');
        } catch (e) {
            toast.error('Failed to export Excel');
        }
    };

    const handleDownloadSample = async () => {
        try {
            const response = await salesInvoiceService.downloadSample();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `sales_invoice_sample.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (e) {
            toast.error('Failed to download sample file');
        }
    };

    const handleImportExcel = async (file) => {
        const loadingToast = toast.loading('Importing invoices...');
        try {
            const formData = new FormData();
            formData.append('file', file);
            await salesInvoiceService.importInvoices(formData);
            toast.dismiss(loadingToast);
            toast.success('Invoices imported successfully');
            fetchData();
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error(error?.response?.data?.message || 'Failed to import invoices');
        }
    };

    const handleDeleteClick = (id) => {
        setInvToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!invToDelete) return;
        setIsDeleting(true);
        try {
            await salesInvoiceService.deleteInvoice(invToDelete);
            toast.success("Invoice deleted successfully");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete invoice");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            setInvToDelete(null);
        }
    };

    const handlePrint = async (invoice) => {
        try {
            setIsLoading(true);
            const fullInvoice = await salesInvoiceService.getInvoiceById(invoice.id);
            const invoiceToPrint = fullInvoice.data || fullInvoice;

            // Ensure items have both printDescription and description for preview compatibility
            if (invoiceToPrint.items) {
                invoiceToPrint.items = invoiceToPrint.items.map(it => ({
                    ...it,
                    printDescription: it.printDescription || it.description || it.print_description || it.productName || it.product_name || '',
                    description: it.description || it.printDescription || it.print_description || it.productName || it.product_name || ''
                }));
            }

            navigate(ROUTES.SALES_INVOICE_PRINT, {
                state: {
                    invoiceData: invoiceToPrint,
                    from: '/seller/sales/invoice'
                }
            });
        } catch (error) {
            console.error("Print error:", error);
            toast.error("Failed to load print preview");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearFilter = () => {
        setFilterInputs(defaultFilters);
        setAppliedFilters(defaultFilters);
        setIsFilterOpen(false);
        setCurrentPage(1);
    };

    const handleApplyFilter = () => {
        setAppliedFilters(filterInputs);
        setIsFilterOpen(false);
        setCurrentPage(1);
    };

    const mappedInvoices = useMemo(() => {
        return invoices.map(item => {
            const statusLabel = item.status?.toUpperCase() === 'DELETED' ? 'Deleted' : 'Generated';
            return {
                ...item,
                customerName: item.customerName || "-",
                invoiceNo: item.invoiceNumber || "-",
                customerInvNo: item.customerInvoiceNumber || "-",
                invoiceDate: item.invoiceDate ? item.invoiceDate.split('T')[0] : "-",
                grandTotal: item.grandTotal?.toFixed(2) || "0.00",
                status: statusLabel,
                bgClass: statusLabel === 'Generated' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
            };
        });
    }, [invoices]);

    const totalPages = Math.ceil(totalItemsCount / itemsPerPage);

    return (
        <div className="flex flex-col w-full relative font-outfit">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
                <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">Sales Invoice</h1>
                <button
                    onClick={() => {
                        sessionStorage.removeItem('add_si_draft');
                        navigate('add');
                    }}
                    className="px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all flex items-center gap-2 active:scale-95"
                >
                    <Plus size={18} /> Add Invoice
                </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex justify-center gap-16 border-b border-[#E5E7EB] w-full mb-8">
                {['Challan', 'Invoice'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => navigate(tab === 'Challan' ? '/seller/sales/challan' : '/seller/sales/invoice')}
                        className={`relative pb-4 text-[18px] font-bold transition-colors ${tab === 'Invoice' ? 'text-[#073318]' : 'text-[#6B7280]'}`}
                    >
                        {tab}
                        {tab === 'Invoice' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#073318]" />}
                    </button>
                ))}
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden mb-8">
                {/* Toolbar */}
                <div className="p-4 md:p-6 border-b border-[#F3F4F6] flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-[320px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by anything..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="w-full h-[42px] border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318]"
                            />
                            {searchQuery && <X size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setSearchQuery("")} />}
                        </div>
                        <button
                            onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)}
                            className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all ${isFilterApplied ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-[#E5E7EB] text-[#4B5563]'}`}
                        >
                            <Filter size={18} /> {isFilterApplied ? "Clear" : "Filter"}
                        </button>
                        <button onClick={fetchData} className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] flex items-center justify-center bg-white hover:bg-gray-50 transition-colors">
                            <RefreshCw size={18} className={`text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-6 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50 transition-all">
                            <Upload size={18} className="text-gray-400" /> Import
                        </button>
                        <div className="relative" ref={exportRef}>
                            <button
                                onClick={() => setIsExportOpen(!isExportOpen)}
                                className={`flex items-center gap-2 px-6 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all ${isExportOpen ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563]'}`}
                            >
                                <Download size={18} /> Export
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

                {/* Table */}
                <ScrollableTable>
                    <table className="w-full min-w-[1200px] border-collapse text-left">
                        <thead>
                            <tr className="bg-emerald-900 text-white font-bold text-[15px]">
                                {["Customer Name", "Invoice Number", "Date", "Cust. Inv. No", "Grand Total", "Status", "Action"].map(h => (
                                    <th key={h} className="px-6 py-5 border-r border-white/10 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className={`text-[14px] text-[#111827] ${isLoading ? 'opacity-40' : 'opacity-100'}`}>
                            {mappedInvoices.length > 0 ? (
                                mappedInvoices.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                        <td className="px-6 py-5 font-bold">{row.customerName}</td>
                                        <td className="px-6 py-4">{row.invoiceNo}</td>
                                        <td className="px-6 py-4">{row.invoiceDate}</td>
                                        <td className="px-6 py-4 font-bold text-gray-500">{row.customerInvNo}</td>
                                        <td className="px-6 py-4 font-bold text-[#073318]">₹{row.grandTotal}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 ${row.bgClass} rounded-full text-[12px] font-bold shadow-sm inline-flex min-w-[100px] justify-center`}>{row.status}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center relative">
                                            <button
                                                data-dropdown-id={row.id}
                                                onClick={(e) => handleDropdownToggle(e, row.id)}
                                                className={`p-2 rounded-lg transition-colors ${activeDropdown === row.id ? 'bg-[#073318] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                                            >
                                                <MoreVertical size={20} />
                                            </button>
                                            {activeDropdown === row.id && createPortal(
                                                <div 
                                                    data-menu-id={row.id} 
                                                    style={{ 
                                                        position: 'absolute',
                                                        top: dropdownPos.top + 8,
                                                        left: dropdownPos.left - 180,
                                                        zIndex: 9999
                                                    }}
                                                    className="w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-2xl py-2 animate-in zoom-in-95 duration-200 text-left font-bold"
                                                >
                                                    <button onClick={() => { setActiveDropdown(null); navigate(`view/${row.id}`); }} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50">
                                                        <Eye size={18} className="text-emerald-600" /> 
                                                        {row.status === 'Deleted' ? 'View Invoice' : 'View/Edit Invoice'}
                                                    </button>
                                                    {row.status !== 'Deleted' && (
                                                        <>
                                                            <button 
                                                                onClick={() => { setActiveDropdown(null); handlePrint(row); }} 
                                                                className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50"
                                                            >
                                                                <Printer size={18} className="text-[#073318]" /> Print Invoice
                                                            </button>
                                                            <button onClick={() => { setActiveDropdown(null); handleDeleteClick(row.id); }} className="w-full px-5 py-3.5 flex items-center gap-3 text-red-600 hover:bg-red-50">
                                                                <Trash2 size={18} /> Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>,
                                                document.body
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="7" className="px-6 py-24 text-center text-gray-400 font-bold uppercase tracking-widest">No results found</td></tr>
                            )}
                        </tbody>
                    </table>
                </ScrollableTable>

                {/* Pagination */}
                <div className="px-8 py-5 border-t border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between font-bold text-[#6B7280]">
                    <div className="flex items-center gap-2">
                        <span>Show</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="border border-[#E5E7EB] rounded-[8px] px-3 py-1.5 outline-none bg-white text-black"
                        >
                            {[10, 20, 50].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[14px]">Page {currentPage} of {totalPages || 1}</span>
                        <div className="flex gap-2">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all"><ArrowLeft size={18} /></button>
                            <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 transition-all"><ArrowRight size={18} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals via Portal */}
            {createPortal(
                <>
                    <DeleteConfirmModal isOpen={isDeleteModalOpen} isDeleting={isDeleting} onCancel={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} />
                    <ImportModal
                        isOpen={isImportModalOpen}
                        onClose={() => setIsImportModalOpen(false)}
                        onImport={handleImportExcel}
                        onDownloadSample={handleDownloadSample}
                        title="Import Sales Invoices"
                    />

                    {/* Filter Sidebar */}
                    {isFilterOpen && <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-[2px]" onClick={() => setIsFilterOpen(false)} />}
                    <div className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-[110] transform transition-all duration-300 ${isFilterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-[#04200f] bg-emerald-900 text-white font-bold">
                            <h2>Apply Filters</h2>
                            <button onClick={() => setIsFilterOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#374151]">Status</label>
                                <select
                                    value={filterInputs.status}
                                    onChange={(e) => setFilterInputs(prev => ({ ...prev, status: e.target.value }))}
                                    className="w-full h-[44px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                                >
                                    {["All", "Generated", "Deleted"].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-8 border-t flex gap-4 bg-white">
                            <button onClick={handleClearFilter} className="flex-1 h-[46px] border border-[#E5E7EB] rounded-[10px] font-bold">Clear</button>
                            <button onClick={handleApplyFilter} className="flex-1 h-[46px] bg-[#073318] text-white rounded-[10px] font-bold">Apply</button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default SalesInvoice;
