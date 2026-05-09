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
  FileEdit
} from "lucide-react";
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import challanService from "@/services/challanService";
import ScrollableTable from "@/components/common/ScrollableTable";
import ImportModal from "./components/ImportModal";
import CustomSelect from "@/components/common/CustomSelect";

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
          <h3 className="text-[20px] font-bold text-[#111827] mb-2 uppercase tracking-tight">
            Delete Challan
          </h3>
          <p className="text-[#6B7280] text-[15px] font-medium mb-8">
            Are you sure you want to delete this Sales Challan? This action will mark its status as deleted.
          </p>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] border border-[#E5E7EB] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all uppercase tracking-widest"
            >
              No, Keep it
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 h-[52px] rounded-[14px] bg-red-600 hover:bg-red-700 text-white text-[14px] font-bold transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              {isDeleting ? <RefreshCw size={18} className="animate-spin" /> : "Yes, Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Challan = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState("");
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [challans, setChallans] = useState([]);
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [challanToDelete, setChallanToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const exportRef = useRef(null);

    const defaultFilters = { status: "All" };
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterInputs, setFilterInputs] = useState(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
    const isFilterApplied = appliedFilters.status !== "All";

    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params = {
                page: currentPage,
                limit: itemsPerPage,
                search: searchQuery
            };
            
            if (appliedFilters.status !== "All") {
                params.status = appliedFilters.status.toLowerCase();
            }

            const response = await challanService.getAllChallans(params);
            const data = Array.isArray(response) ? response : (response.data || []);
            setChallans(data);
            setTotalItemsCount(response.meta?.total || data.length);
        } catch (error) {
            console.error("Error fetching challans:", error);
            toast.error("Failed to load challans");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentPage, itemsPerPage, searchQuery, appliedFilters]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportRef.current && !exportRef.current.contains(event.target)) {
                setIsExportOpen(false);
            }
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
            const response = await challanService.exportChallans('pdf', searchQuery);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `sales_challans_${Date.now()}.pdf`);
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
            const response = await challanService.exportChallans('xlsx', searchQuery);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `sales_challans_${Date.now()}.xlsx`);
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
            const response = await challanService.downloadSample();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `challan_sample.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (e) {
            toast.error('Failed to download sample file');
        }
    };

    const handleImportExcel = async (file) => {
        const loadingToast = toast.loading('Importing challans...');
        try {
            const formData = new FormData();
            formData.append('file', file);
            await challanService.importChallans(formData);
            toast.dismiss(loadingToast);
            toast.success('Challans imported successfully');
            fetchData();
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error(error?.response?.data?.message || 'Failed to import challans');
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

    const handleDeleteClick = (id) => {
        setChallanToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!challanToDelete) return;
        setIsDeleting(true);
        try {
            await challanService.deleteChallan(challanToDelete);
            toast.success("Challan deleted successfully");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete challan");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            setChallanToDelete(null);
        }
    };

    const mappedChallans = useMemo(() => {
        return challans.map(item => {
            const statusLabel = item.status?.toUpperCase() === 'DELETED' ? 'Deleted' : 'Generated';
            return {
                ...item,
                customerName: item.customerName || "-",
                challanNo: item.challanNumber || "-",
                challanDate: item.challanDate ? item.challanDate.split('T')[0] : "-",
                bookingDate: item.bookingDate ? item.bookingDate.split('T')[0] : "-",
                soNo: item.soNumber || "-",
                gstNo: item.gstNumber || "-",
                grandTotal: item.grandTotal?.toFixed(2) || "0.00",
                status: statusLabel,
                bgClass: statusLabel === 'Generated' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
            };
        });
    }, [challans]);

    const totalPages = Math.ceil(totalItemsCount / itemsPerPage);

    return (
        <div className="flex flex-col w-full relative font-outfit">
            <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
                <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">Sales Challan</h1>
                <button
                    onClick={() => {
                        sessionStorage.removeItem('add_challan_draft');
                        navigate('add');
                    }}
                    className="px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all flex items-center gap-2 active:scale-95"
                >
                    <Plus size={18} /> Add Challan
                </button>
            </div>

            <div className="flex justify-center gap-16 border-b border-[#E5E7EB] w-full mb-8">
                {['Challan', 'Invoice'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => navigate(tab === 'Challan' ? '/seller/sales/challan' : '/seller/sales/invoice')}
                        className={`relative pb-4 text-[18px] font-bold transition-colors ${tab === 'Challan' ? 'text-[#073318]' : 'text-[#6B7280]'}`}
                    >
                        {tab}
                        {tab === 'Challan' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#073318]" />}
                    </button>
                ))}
            </div>

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

                <ScrollableTable>
                    <table className="w-full min-w-[1500px] border-collapse text-left">
                        <thead>
                            <tr className="bg-emerald-900 text-white font-bold text-[14px] uppercase tracking-wider">
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap">Customer Name</th>
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap">Challan Number</th>
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap">Challan Date</th>
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap">Booking Date</th>
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap">SO No</th>
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap">Gst No</th>
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap text-right">Grand Total</th>
                                <th className="px-6 py-5 border-r border-white/10 whitespace-nowrap text-center">Status</th>
                                <th className="px-6 py-5 whitespace-nowrap text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className={`text-[14px] text-[#111827] font-medium ${isLoading ? 'opacity-40' : 'opacity-100'}`}>
                            {mappedChallans.length > 0 ? (
                                mappedChallans.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                        <td className="px-6 py-5 font-bold">{row.customerName}</td>
                                        <td className="px-6 py-4">{row.challanNo}</td>
                                        <td className="px-6 py-4">{row.challanDate}</td>
                                        <td className="px-6 py-4">{row.bookingDate}</td>
                                        <td className="px-6 py-4 font-bold text-gray-500">{row.soNo}</td>
                                        <td className="px-6 py-4 font-medium uppercase">{row.gstNo}</td>
                                        <td className="px-6 py-4 text-right font-bold text-[#073318]">₹{row.grandTotal}</td>
                                        <td className="px-6 py-5 text-center">
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
                                                        {row.status === 'Deleted' ? 'View Challan' : 'View/Edit Challan'}
                                                    </button>
                                                    {row.status !== 'Deleted' && (
                                                        <button onClick={() => { setActiveDropdown(null); handleDeleteClick(row.id); }} className="w-full px-5 py-3.5 flex items-center gap-3 text-red-600 hover:bg-red-50">
                                                            <Trash2 size={18} /> Delete
                                                        </button>
                                                    )}
                                                </div>,
                                                document.body
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="9" className="px-6 py-24 text-center text-gray-400 font-bold uppercase tracking-widest">No results found</td></tr>
                            )}
                        </tbody>
                    </table>
                </ScrollableTable>

                {/* Pagination */}
                <div className="px-8 py-5 border-t border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between font-bold text-[#6B7280]">
                    <div className="flex items-center gap-2">
                        <span>Show</span>
                        <CustomSelect 
                            value={itemsPerPage}
                            onChange={(val) => {
                                setItemsPerPage(val);
                                setCurrentPage(1);
                            }}
                            options={[10, 20, 50]}
                            menuPlacement="top"
                        />
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

            {createPortal(
                <>
                    <DeleteConfirmModal isOpen={isDeleteModalOpen} isDeleting={isDeleting} onCancel={() => setIsDeleteModalOpen(false)} onConfirm={confirmDelete} />
                    <ImportModal
                        isOpen={isImportModalOpen}
                        onClose={() => setIsImportModalOpen(false)}
                        onImport={handleImportExcel}
                        onDownloadSample={handleDownloadSample}
                        title="Import Sales Challans"
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

export default Challan;
