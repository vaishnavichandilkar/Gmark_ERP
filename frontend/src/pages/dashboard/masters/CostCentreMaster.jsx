import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Upload,
  Download,
  ArrowLeft, 
  ArrowRight,
  Eye, 
  Edit3, 
  Trash2, 
  MoreVertical,
  PieChart, 
  X,
  FileText,
  FileSpreadsheet,
  ChevronsUpDown,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api.config';
import ScrollableTable from '../../../components/common/ScrollableTable';
import CustomSelect from '../../../components/common/CustomSelect';
import * as XLSX from 'xlsx';

const CostCentreMaster = () => {
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID', 'ADD', 'EDIT', 'VIEW'
  const [costCentres, setCostCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedCostCentre, setSelectedCostCentre] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Column Filters
  const [columnFilters, setColumnFilters] = useState({
    prefix: '',
    costCentreName: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form State
  const [formData, setFormData] = useState({ prefix: '', costCentreName: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [costCentreToDelete, setCostCentreToDelete] = useState(null);

  const exportRef = useRef(null);
  const dropdownRef = useRef(null);
  const token = localStorage.getItem('token');
  const getHeaders = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchCostCentres = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/masters/cost-centre-master`, {
        ...getHeaders(),
        params: { search: searchQuery }
      });
      const ccList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setCostCentres(ccList);
    } catch (err) {
      console.error('Failed to fetch cost centres:', err);
      toast.error('Failed to load cost centre list');
      setCostCentres([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostCentres();
  }, []);

  // Filtered & Paginated Table Data
  const filteredCostCentres = useMemo(() => {
    let list = Array.isArray(costCentres) ? costCentres : [];

    if (columnFilters.prefix) {
      const p = columnFilters.prefix.toLowerCase().trim();
      list = list.filter(c => (c.prefix || '').toLowerCase().includes(p));
    }

    if (columnFilters.costCentreName) {
      const cc = columnFilters.costCentreName.toLowerCase().trim();
      list = list.filter(c => (c.costCentreName || '').toLowerCase().includes(cc));
    }

    return list;
  }, [costCentres, columnFilters]);

  const totalItems = filteredCostCentres.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredCostCentres.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRefresh = () => {
    fetchCostCentres();
    toast.success('Data refreshed successfully');
  };

  const handleOpenAdd = () => {
    setFormData({ prefix: '', costCentreName: '' });
    setSelectedCostCentre(null);
    setViewMode('ADD');
  };

  const handleOpenView = (cc) => {
    setSelectedCostCentre(cc);
    setFormData({ prefix: cc.prefix || '', costCentreName: cc.costCentreName || '' });
    setViewMode('VIEW');
  };

  const handleOpenEdit = (cc) => {
    setSelectedCostCentre(cc);
    setFormData({ prefix: cc.prefix || '', costCentreName: cc.costCentreName || '' });
    setViewMode('VIEW');
  };

  const handleSaveCostCentre = async (e) => {
    e.preventDefault();

    const prefix = formData.prefix.trim().toUpperCase();
    const costCentreName = formData.costCentreName.trim();

    if (!prefix) return toast.error('Prefix is required');
    if (!costCentreName) return toast.error('Cost Centre Name is required');

    try {
      setActionLoading(true);

      if (viewMode === 'EDIT' && selectedCostCentre) {
        await axios.patch(
          `${API_BASE_URL}/masters/cost-centre-master/${selectedCostCentre.id}`, 
          { prefix, costCentreName }, 
          getHeaders()
        );
        toast.success('Cost Centre updated successfully');
      } else {
        await axios.post(
          `${API_BASE_URL}/masters/cost-centre-master`, 
          { prefix, costCentreName }, 
          getHeaders()
        );
        toast.success('Cost Centre created successfully');
      }

      setViewMode('GRID');
      fetchCostCentres();
    } catch (err) {
      console.error('Failed to save cost centre:', err);
      toast.error(err.response?.data?.message || 'Failed to save cost centre');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = (cc) => {
    setCostCentreToDelete(cc);
    setShowDeleteModal(true);
  };

  const handleDeleteExecute = async () => {
    if (!costCentreToDelete) return;

    try {
      setActionLoading(true);
      await axios.delete(`${API_BASE_URL}/masters/cost-centre-master/${costCentreToDelete.id}`, getHeaders());
      toast.success(`Cost Centre "${costCentreToDelete.costCentreName}" deleted successfully`);
      setShowDeleteModal(false);
      setCostCentreToDelete(null);
      fetchCostCentres();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete cost centre');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredCostCentres.length === 0) return toast.error('No cost centre records to export');
    
    const exportData = filteredCostCentres.map((cc, index) => ({
      'SR NO': index + 1,
      'PREFIX': cc.prefix,
      'COST CENTRE NAME': cc.costCentreName,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Centre Master');
    XLSX.writeFile(workbook, `Cost_Centre_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel Exported Successfully');
  };

  return (
    <div className="flex flex-col relative w-full h-full font-['Plus_Jakarta_Sans'] text-[#111827]">
      {viewMode === 'GRID' ? (
        <>
          {/* Top Title & Header Action */}
          <div className="flex flex-row items-center justify-between gap-4 mb-4 md:mb-6">
            <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
              Cost Centre Master
            </h2>

            <button
              onClick={handleOpenAdd}
              className="flex flex-row items-center justify-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[44px] rounded-[10px] text-[15px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0 whitespace-nowrap"
            >
              <Plus size={18} />
              Add Cost Centre
            </button>
          </div>

          {/* Master Table Container */}
          <div className={`master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8 rounded-[20px] min-h-[350px] ${activeDropdown ? "!overflow-visible" : "overflow-hidden"}`}>
            
            {/* Action Bar */}
            <div className="flex items-center justify-between p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[20px]">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-[320px]">
                  <Search
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search by anything"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm font-medium"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => { setSearchQuery(""); setCurrentPage(1); }} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <button
                  className="flex-shrink-0 flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] hover:bg-gray-50 transition-colors bg-white shadow-sm"
                  title="Refresh Data"
                  onClick={handleRefresh}
                >
                  <RefreshCw size={18} className={loading ? "animate-spin text-gray-400" : "text-gray-400"} />
                </button>
              </div>

              {/* Export Control */}
              <div className="flex items-center gap-3" ref={exportRef}>
                <div className="relative">
                  <button 
                    onClick={() => setIsExportOpen(!isExportOpen)} 
                    className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all ${
                      isExportOpen ? "border-[#073318] text-[#073318]" : "border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50"
                    }`}
                  >
                    <Upload size={18} />
                    Export
                  </button>
                  {isExportOpen && (
                    <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 py-2 animate-in fade-in duration-200">
                      <button 
                        onClick={handleExportExcel} 
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700"
                      >
                        <FileSpreadsheet size={18} className="text-green-600" /> Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Table */}
            <ScrollableTable className="master-table-wrapper">
              <table className="master-table min-w-[800px]">
                <thead>
                  <tr>
                    <th className="border-r border-white/10 text-center w-24">
                      <div className="flex items-center justify-center gap-2">
                        SR NO <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10 w-40">
                      <div className="flex items-center gap-2">
                        PREFIX <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        COST CENTRE NAME <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="text-center w-24">
                      ACTION
                    </th>
                  </tr>

                  {/* Header Row 2: Search Filters */}
                  <tr className="bg-[#0b543f]">
                    <th className="px-2 py-2 border-r border-white/10 text-center"></th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Search Prefix..."
                        value={columnFilters.prefix}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, prefix: e.target.value }))}
                        className="w-full min-w-[70px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Search Cost Centre..."
                        value={columnFilters.costCentreName}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, costCentreName: e.target.value }))}
                        className="w-full min-w-[120px] px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 text-center"></th>
                  </tr>
                </thead>

                <tbody className="text-[14px] text-[#111827]">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-4 border-[#073318]/10 border-t-[#073318] rounded-full animate-spin"></div>
                          <span className="text-gray-400 font-medium">Loading cost centres...</span>
                        </div>
                      </td>
                    </tr>
                  ) : currentData.length > 0 ? (
                    currentData.map((cc, index) => (
                      <tr key={cc.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="text-center font-bold text-[#6B7280] border-r border-[#F3F4F6]">
                          {startIndex + index + 1}
                        </td>
                        <td className="border-r border-[#F3F4F6]">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-mono font-extrabold text-[12px]">
                            {cc.prefix}
                          </span>
                        </td>
                        <td className="font-bold text-[#111827] border-r border-[#F3F4F6]">
                          {cc.costCentreName}
                        </td>
                        <td 
                          className={`text-center relative ${activeDropdown === cc.id ? "z-[100]" : ""}`}
                          ref={activeDropdown === cc.id ? dropdownRef : null}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === cc.id ? null : cc.id);
                            }}
                            className={`p-2 rounded-lg transition-all ${
                              activeDropdown === cc.id
                                ? 'bg-gray-100 text-[#111827]'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'
                            }`}
                          >
                            <MoreVertical size={20} />
                          </button>

                          {activeDropdown === cc.id && (
                            <div
                              className={`absolute right-4 w-max min-w-[170px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 text-left ${
                                (index >= currentData.length - 2 || currentData.length <= 2)
                                  ? "bottom-0 mb-2"
                                  : "top-0 mt-2"
                              }`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(cc);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap font-bold"
                              >
                                <Eye size={18} className="text-gray-400" />
                                View and Edit
                              </button>

                              <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDelete(cc);
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap font-bold"
                              >
                                <Trash2 size={18} className="text-red-500" />
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-16 text-center text-gray-400 font-medium">
                        No cost centres found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollableTable>

            {/* Pagination Toolbar */}
            <div className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-t border-[#F3F4F6] bg-white gap-4 w-full">
              <div className="flex items-center gap-2 text-[13px] text-[#6B7280] font-medium">
                <span>Show</span>
                <CustomSelect 
                  value={itemsPerPage}
                  onChange={(val) => {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                  }}
                  options={[5, 10, 15, 20, 50]}
                  menuPlacement="top"
                />
                <span>per page</span>
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
        </>
      ) : (
        /* Form View */
        <div className="flex flex-col w-full animate-in fade-in duration-300">
          <div className="bg-white rounded-[12px] border border-[#E5E7EB] shadow-sm flex flex-col w-full relative">
            <div className="flex border-b border-[#E5E7EB] px-6 py-4 items-center justify-between bg-white rounded-t-[12px]">
              <h2 className="text-[18px] md:text-[20px] font-bold text-[#111827]">
                {viewMode === 'ADD' && 'Add Cost Centre'}
                {viewMode === 'EDIT' && 'Edit Cost Centre'}
                {viewMode === 'VIEW' && 'Cost Centre Details'}
              </h2>

              <div className="flex items-center gap-3">
                {viewMode === 'VIEW' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('EDIT')}
                    className="flex items-center justify-center h-[40px] px-5 bg-[#073318] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#0a4722] transition-all shadow-sm active:scale-95 gap-2"
                  >
                    <Edit3 size={16} />
                    Edit Cost Centre
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setViewMode('GRID')}
                  className="flex items-center justify-center h-[40px] px-6 border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm active:scale-95"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <form onSubmit={handleSaveCostCentre} className="flex flex-col gap-6 max-w-3xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Prefix */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[#4B5563]">
                      Prefix <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      disabled={viewMode === 'VIEW'}
                      placeholder="Enter 2-character prefix (e.g. FC)"
                      value={formData.prefix}
                      onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })}
                      className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-mono font-bold text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50 uppercase"
                    />
                    <span className="text-[11px] text-gray-400 font-medium">Unique identifier prefix for cost centre</span>
                  </div>

                  {/* Cost Centre Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[#4B5563]">
                      Cost Centre Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={viewMode === 'VIEW'}
                      placeholder="Enter cost centre name"
                      value={formData.costCentreName}
                      onChange={(e) => setFormData({ ...formData, costCentreName: e.target.value })}
                      className="w-full h-[42px] px-4 bg-white border border-[#E5E7EB] rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#E5E7EB] mt-4">
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    className="px-6 h-[40px] border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
                  >
                    Back
                  </button>

                  {viewMode === 'VIEW' ? (
                    <button
                      type="button"
                      onClick={() => setViewMode('EDIT')}
                      className="px-8 h-[40px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2"
                    >
                      <Edit3 size={16} />
                      Edit Cost Centre
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-8 h-[40px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm active:scale-95"
                    >
                      {actionLoading ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Confirm Delete</h3>
            </div>

            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to delete cost centre <strong className="text-gray-900 font-bold">"{costCentreToDelete?.costCentreName}"</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setCostCentreToDelete(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExecute}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostCentreMaster;
