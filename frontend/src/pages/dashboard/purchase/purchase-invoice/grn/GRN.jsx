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
  FileEdit
} from "lucide-react";
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import grnService from "@/services/grnService";
import ScrollableTable from "@/components/common/ScrollableTable";
import FilterDropdown from "@/pages/dashboard/masters/components/FilterDropdown";

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
            Delete GRN
          </h3>
          <p className="text-[#6B7280] text-[15px] font-medium mb-8">
            Are you sure you want to delete this Goods Receipt Note? This action will mark its status as deleted.
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

const GRN = () => {
    const { t } = useTranslation(['modules', 'common']);
    const navigate = useNavigate();

    // States
    const [searchQuery, setSearchQuery] = useState("");
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [grns, setGrns] = useState([]);
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [grnToDelete, setGrnToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filter State
    const defaultFilters = { status: "All" };
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterInputs, setFilterInputs] = useState(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
    const isFilterApplied = appliedFilters.status !== "All";

    // Pagination State
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const statusTabs = ["All", "Generated", "Deleted"];

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params = {
                page: currentPage,
                limit: itemsPerPage,
                search: searchQuery
            };
            
            const activeStatus = appliedFilters.status;
            if (activeStatus !== "All") {
                params.status = activeStatus.toLowerCase();
            }

            const response = await grnService.getAllGRNs(params);
            const data = Array.isArray(response) ? response : (response.data || []);
            setGrns(data);
            setTotalItemsCount(response.meta?.total || data.length);
        } catch (error) {
            console.error("Error fetching GRNs:", error);
            toast.error("Failed to load GRNs");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentPage, itemsPerPage, searchQuery, appliedFilters]);

    // Derived Data
    const mappedGRNs = useMemo(() => {
        return grns.map(item => {
            const taxableAmount = item.items?.reduce((sum, i) => sum + (i.quantity * i.rate), 0) || 0;
            const taxAmount = taxableAmount * 0.18; // Default 18% if not available
            const grossAmount = taxableAmount + taxAmount;
            const status = item.status === 'DELETED' ? 'Deleted' : 'Generated';
            
            return {
                ...item,
                supplierName: item.supplierName || "-",
                challanNo: item.challanNumber || "-",
                challanDate: item.challanDate ? item.challanDate.split('T')[0] : "-",
                bookingDate: item.bookingDate ? item.bookingDate.split('T')[0] : "-",
                poNo: item.poNumber || "-",
                gstNo: item.gstNumber || "-",
                creditDays: item.creditDays || 0,
                taxableAmount: taxableAmount.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                grossAmount: grossAmount.toFixed(2),
                status,
                bgClass: status === 'Generated' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'
            };
        });
    }, [grns]);

    const totalPages = Math.ceil(totalItemsCount / itemsPerPage);

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
        setGrnToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!grnToDelete) return;
        setIsDeleting(true);
        try {
            await grnService.deleteGRN(grnToDelete);
            toast.success("GRN deleted successfully");
            fetchData();
        } catch (error) {
            toast.error("Failed to delete GRN");
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            setGrnToDelete(null);
        }
    };

    return (
        <div className="flex flex-col w-full relative font-outfit">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
                <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">Goods Receipt Note (GRN)</h1>
                <button
                    onClick={() => navigate('add')}
                    className="px-8 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all flex items-center gap-2 active:scale-95"
                >
                    <Plus size={18} /> Add GRN
                </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex justify-center gap-16 border-b border-[#E5E7EB] w-full mb-8">
                {['GRN', 'Invoice'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => navigate(tab === 'GRN' ? '/seller/purchase/grn' : '/seller/purchase/invoice')}
                        className={`relative pb-4 text-[18px] font-bold transition-colors ${tab === 'GRN' ? 'text-[#073318]' : 'text-[#6B7280]'}`}
                    >
                        {tab}
                        {tab === 'GRN' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#073318]" />}
                    </button>
                ))}
            </div>

            {/* Status Tabs matching PO design */}
            <div className="flex gap-8 mb-6 border-b border-gray-100 pb-2">
                {statusTabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => {
                            setAppliedFilters({ status: tab });
                            setFilterInputs({ status: tab });
                            setCurrentPage(1);
                        }}
                        className={`text-[15px] font-bold transition-all pb-2 px-1 relative ${appliedFilters.status === tab ? 'text-[#073318]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        {tab}
                        {appliedFilters.status === tab && <motion.div layoutId="statusUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#073318]" />}
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
                            <RefreshCw size={18} className={`text-gray-400 ${isLoading ? 'animate-spin border-[#073318]' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-6 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] bg-white hover:bg-gray-50">
                            <Download size={18} /> Export
                        </button>
                    </div>
                </div>

                {/* Table */}
                <ScrollableTable>
                    <table className="w-full min-w-[1500px] border-collapse text-left">
                        <thead>
                            <tr className="bg-emerald-900 text-white font-bold text-[15px]">
                                {["Supplier Name", "Challan No", "Challan Date", "Booking Date", "Po No", "Gst No", "Credit Days", "Taxable Amount", "Tax Amount", "Gross Amount", "Status", "Action"].map(h => (
                                    <th key={h} className="px-6 py-5 border-r border-white/10 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className={`text-[14px] text-[#111827] ${isLoading ? 'opacity-40' : 'opacity-100'}`}>
                            {mappedGRNs.length > 0 ? (
                                mappedGRNs.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-all">
                                        <td className="px-6 py-5 font-bold">{row.supplierName}</td>
                                        <td className="px-6 py-4">{row.challanNo}</td>
                                        <td className="px-6 py-4">{row.challanDate}</td>
                                        <td className="px-6 py-4">{row.bookingDate}</td>
                                        <td className="px-6 py-4 font-medium">{row.poNo}</td>
                                        <td className="px-6 py-4">{row.gstNo}</td>
                                        <td className="px-6 py-4">{row.creditDays}</td>
                                        <td className="px-6 py-4 font-bold">₹{row.taxableAmount}</td>
                                        <td className="px-6 py-4">₹{row.taxAmount}</td>
                                        <td className="px-6 py-5 font-bold text-[#073318]">₹{row.grossAmount}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-4 py-1.5 ${row.bgClass} rounded-full text-[12px] font-bold shadow-sm inline-flex min-w-[100px] justify-center`}>{row.status}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center relative">
                                            <button 
                                                onClick={() => setActiveDropdown(activeDropdown === row.id ? null : row.id)}
                                                className={`p-2 rounded-lg transition-colors ${activeDropdown === row.id ? 'bg-[#073318] text-white' : 'text-gray-400 hover:bg-gray-100'}`}
                                            >
                                                <MoreVertical size={20} />
                                            </button>
                                            {activeDropdown === row.id && (
                                                <div className={`absolute right-full mr-2 w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-2xl z-[110] py-2 animate-in zoom-in-95 duration-200 text-left font-bold ${idx >= mappedGRNs.length - 2 ? 'bottom-0' : 'top-0'}`}>
                                                    <button onClick={() => navigate(`view/${row.id}`)} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50">
                                                        <Eye size={18} /> {row.status === 'Generated' ? 'View and Edit GRN' : 'View GRN'}
                                                    </button>
                                                    {row.status === 'Generated' && (
                                                        <>
                                                            <button onClick={() => navigate(`edit/${row.id}`)} className="w-full px-5 py-3.5 flex items-center gap-3 text-gray-700 hover:bg-[#F9FAFB] border-b border-gray-50">
                                                                <FileEdit size={18} /> Edit
                                                            </button>
                                                            <button onClick={() => handleDeleteClick(row.id)} className="w-full px-5 py-3.5 flex items-center gap-3 text-red-600 hover:bg-red-50">
                                                                <Trash2 size={18} /> Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan="12" className="px-6 py-24 text-center text-gray-400 font-bold uppercase tracking-widest">No results found</td></tr>
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
                    
                    {/* Filter Sidebar */}
                    {isFilterOpen && <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-[2px]" onClick={() => setIsFilterOpen(false)} />}
                    <div className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-[110] transform transition-all duration-300 ${isFilterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-[#04200f] bg-emerald-900 text-white font-bold">
                            <h2>Apply Filters</h2>
                            <button onClick={() => setIsFilterOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <FilterDropdown
                                label="Status"
                                name="status"
                                value={filterInputs.status}
                                onChange={(e) => setFilterInputs({ ...filterInputs, status: e.target.value })}
                                options={[{label:'All',value:'All'}, {label:'Generated',value:'Generated'}, {label:'Deleted',value:'Deleted'}]}
                            />
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

export default GRN;
