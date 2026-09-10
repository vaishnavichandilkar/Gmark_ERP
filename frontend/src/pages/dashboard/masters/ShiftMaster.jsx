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
  X,
  FileSpreadsheet,
  ChevronsUpDown,
  AlertTriangle,
  Clock,
  Sparkles,
  MoreVertical
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api.config';
import ScrollableTable from '../../../components/common/ScrollableTable';
import CustomSelect from '../../../components/common/CustomSelect';
import * as XLSX from 'xlsx';
import ImportModal from './components/ImportModal';

const ShiftMaster = () => {
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID', 'ADD', 'EDIT', 'VIEW'
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Column Filters
  const [columnFilters, setColumnFilters] = useState({
    shiftName: '',
    startTime: '',
    endTime: '',
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form State & Validation
  const [formData, setFormData] = useState({ shiftName: '', startTime: '', endTime: '' });
  const [formErrors, setFormErrors] = useState({ shiftName: '', startTime: '', endTime: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);

  const exportRef = useRef(null);
  const dropdownRef = useRef(null);
  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/masters/shift-master`, {
        ...getHeaders(),
        params: { search: searchQuery }
      });
      const shiftList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setShifts(shiftList);
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to load shift list';
      toast.error(errMsg);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  // Format time 24h string (e.g. "09:00") to 12h display string (e.g. "09:00 AM")
  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return '';
    // If already contains AM/PM
    if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
      return timeStr;
    }
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    if (isNaN(hours)) return timeStr;
    const minutes = minutesStr ? minutesStr.slice(0, 2) : '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour 0 should be 12
    const strHours = hours < 10 ? `0${hours}` : hours;
    return `${strHours}:${minutes} ${ampm}`;
  };

  // Convert "09:00 AM" or "09:00" to "HH:mm" for <input type="time" />
  const parseTimeToInput = (timeStr) => {
    if (!timeStr) return '';
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return timeStr;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3];
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const hh = hours < 10 ? `0${hours}` : hours;
    return `${hh}:${minutes}`;
  };

  // Filtered & Paginated Table Data
  const filteredShifts = useMemo(() => {
    let list = Array.isArray(shifts) ? shifts : [];

    if (columnFilters.shiftName) {
      const name = columnFilters.shiftName.toLowerCase().trim();
      list = list.filter(s => (s.shiftName || '').toLowerCase().includes(name));
    }

    if (columnFilters.startTime) {
      const st = columnFilters.startTime.toLowerCase().trim();
      list = list.filter(s => (s.startTime || '').toLowerCase().includes(st) || formatTimeDisplay(s.startTime).toLowerCase().includes(st));
    }

    if (columnFilters.endTime) {
      const et = columnFilters.endTime.toLowerCase().trim();
      list = list.filter(s => (s.endTime || '').toLowerCase().includes(et) || formatTimeDisplay(s.endTime).toLowerCase().includes(et));
    }

    return list;
  }, [shifts, columnFilters]);

  const totalItems = filteredShifts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredShifts.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRefresh = () => {
    fetchShifts();
    toast.success('Data refreshed successfully');
  };

  const handleOpenAdd = () => {
    setFormData({ shiftName: '', startTime: '', endTime: '' });
    setFormErrors({ shiftName: '', startTime: '', endTime: '' });
    setSelectedShift(null);
    setViewMode('ADD');
  };

  // IMPORTANT Requirement: Always open in VIEW mode first!
  const handleOpenView = (shift) => {
    setSelectedShift(shift);
    setFormData({ 
      shiftName: shift.shiftName || '', 
      startTime: parseTimeToInput(shift.startTime) || shift.startTime || '', 
      endTime: parseTimeToInput(shift.endTime) || shift.endTime || '' 
    });
    setFormErrors({ shiftName: '', startTime: '', endTime: '' });
    setViewMode('VIEW');
  };

  const handleSwitchToEdit = () => {
    setFormErrors({ shiftName: '', startTime: '', endTime: '' });
    setViewMode('EDIT');
  };

  const handleCancelEdit = () => {
    if (selectedShift) {
      // Reset form data to selectedShift values
      setFormData({
        shiftName: selectedShift.shiftName || '',
        startTime: parseTimeToInput(selectedShift.startTime) || selectedShift.startTime || '',
        endTime: parseTimeToInput(selectedShift.endTime) || selectedShift.endTime || ''
      });
      setFormErrors({ shiftName: '', startTime: '', endTime: '' });
      setViewMode('VIEW');
    } else {
      setViewMode('GRID');
    }
  };

  const validateForm = () => {
    const errors = { shiftName: '', startTime: '', endTime: '' };
    let isValid = true;

    if (!formData.shiftName.trim()) {
      errors.shiftName = 'Shift Name is required.';
      isValid = false;
    }

    if (!formData.startTime.trim()) {
      errors.startTime = 'Start Time is required.';
      isValid = false;
    }

    if (!formData.endTime.trim()) {
      errors.endTime = 'End Time is required.';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fill in all mandatory fields correctly.');
      return;
    }

    const shiftName = formData.shiftName.trim();
    const startTime = formatTimeDisplay(formData.startTime);
    const endTime = formatTimeDisplay(formData.endTime);

    // Duplicate check on frontend
    const isDuplicate = shifts.some(s => 
      s.shiftName.toLowerCase() === shiftName.toLowerCase() && 
      (!selectedShift || s.id !== selectedShift.id)
    );

    if (isDuplicate) {
      setFormErrors(prev => ({ ...prev, shiftName: `Shift with name "${shiftName}" already exists.` }));
      toast.error(`Shift with name "${shiftName}" already exists.`);
      return;
    }

    try {
      setActionLoading(true);

      if (viewMode === 'EDIT' && selectedShift) {
        await axios.patch(
          `${API_BASE_URL}/masters/shift-master/${selectedShift.id}`, 
          { shiftName, startTime, endTime }, 
          getHeaders()
        );
        toast.success('Shift updated successfully.');
        fetchShifts();
        // Return to VIEW mode with updated data
        setSelectedShift({ ...selectedShift, shiftName, startTime, endTime });
        setViewMode('VIEW');
      } else {
        await axios.post(
          `${API_BASE_URL}/masters/shift-master`, 
          { shiftName, startTime, endTime }, 
          getHeaders()
        );
        toast.success('Shift created successfully.');
        setViewMode('GRID');
        fetchShifts();
      }
    } catch (err) {
      console.error('Failed to save shift:', err);
      const msg = err.response?.data?.message || 'Failed to save shift';
      if (msg.toLowerCase().includes('already exists')) {
        setFormErrors(prev => ({ ...prev, shiftName: msg }));
      }
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = (shift) => {
    setShiftToDelete(shift);
    setShowDeleteModal(true);
  };

  const handleDeleteExecute = async () => {
    if (!shiftToDelete) return;

    try {
      setActionLoading(true);
      await axios.delete(`${API_BASE_URL}/masters/shift-master/${shiftToDelete.id}`, getHeaders());
      toast.success('Shift deleted successfully.');
      setShowDeleteModal(false);
      setShiftToDelete(null);
      fetchShifts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete shift');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredShifts.length === 0) return toast.error('No shift records to export');
    
    const exportData = filteredShifts.map((shift, index) => ({
      'SR NO': index + 1,
      'SHIFT NAME': shift.shiftName,
      'START TIME': formatTimeDisplay(shift.startTime),
      'END TIME': formatTimeDisplay(shift.endTime),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Shift Master');
    XLSX.writeFile(workbook, `Shift_Master_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel Exported Successfully');
  };

  return (
    <div className="flex flex-col relative w-full h-full font-['Plus_Jakarta_Sans'] text-[#111827]">
      {viewMode === 'GRID' ? (
        <>
          {/* Top Title & Description Header */}
          <div className="flex flex-row items-center justify-between gap-4 mb-4 md:mb-6">
            <div>
              <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
                Shift Master
              </h2>
              <p className="text-[#6B7280] text-[13px] md:text-[14px] font-medium mt-1">
                Create and manage employee work shifts.
              </p>
            </div>

            <button
              onClick={handleOpenAdd}
              className="flex flex-row items-center justify-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[44px] rounded-[10px] text-[15px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0 whitespace-nowrap"
            >
              <Plus size={18} />
              Add Shift
            </button>
          </div>

          {/* Master Table Container */}
          <div className="master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8 rounded-[20px] min-h-[350px] overflow-hidden">
            
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
                    placeholder="Search by shift name or time..."
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

              {/* Import & Export Controls */}
              <div className="flex items-center gap-3" ref={exportRef}>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all duration-200 bg-white shadow-sm"
                >
                  <Download size={18} />
                  Import
                </button>

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
                    <th className="border-r border-white/10 text-center w-20">
                      <div className="flex items-center justify-center gap-1">
                        SR NO <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10">
                      <div className="flex items-center gap-2">
                        SHIFT NAME <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10 w-48">
                      <div className="flex items-center gap-2">
                        START TIME <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="border-r border-white/10 w-48">
                      <div className="flex items-center gap-2">
                        END TIME <ChevronsUpDown size={14} className="opacity-70" />
                      </div>
                    </th>
                    <th className="text-center w-40">
                      ACTION
                    </th>
                  </tr>

                  {/* Header Row 2: Search Filters */}
                  <tr className="bg-[#0b543f]">
                    <th className="px-2 py-2 border-r border-white/10 text-center"></th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Search Shift..."
                        value={columnFilters.shiftName}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, shiftName: e.target.value }))}
                        className="w-full px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Search Start..."
                        value={columnFilters.startTime}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 border-r border-white/10">
                      <input
                        type="text"
                        placeholder="Search End..."
                        value={columnFilters.endTime}
                        onChange={(e) => setColumnFilters(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full px-2 py-1 text-[12px] bg-white/10 text-white placeholder-white/40 border border-white/20 rounded focus:outline-none focus:bg-white/20 focus:border-white/50 transition-all font-medium"
                      />
                    </th>
                    <th className="px-2 py-2 text-center"></th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                          <RefreshCw size={24} className="animate-spin text-[#073318]" />
                          <span className="text-[14px] font-semibold">Loading shifts...</span>
                        </div>
                      </td>
                    </tr>
                  ) : currentData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                          <Clock size={36} className="text-gray-300" />
                          <p className="text-[15px] font-bold text-gray-700">No Shifts Found</p>
                          <p className="text-[13px] text-gray-500">
                            {searchQuery || columnFilters.shiftName || columnFilters.startTime || columnFilters.endTime 
                              ? "No shifts match your search query." 
                              : "Click 'Add Shift' above to create your first employee work shift."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentData.map((shift, idx) => (
                      <tr 
                        key={shift.id} 
                        className="hover:bg-gray-50/80 transition-colors border-b border-gray-100 font-medium text-[14px]"
                      >
                        <td className="text-center py-3.5 px-3 border-r border-gray-100 font-mono text-gray-500 text-[13px]">
                          {startIndex + idx + 1}
                        </td>
                        <td className="py-3.5 px-4 border-r border-gray-100 font-bold text-[#111827]">
                          {shift.shiftName}
                        </td>
                        <td className="py-3.5 px-4 border-r border-gray-100 text-gray-700">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-md text-[12px] font-semibold border border-emerald-200/50">
                            <Clock size={12} className="text-emerald-600" />
                            {formatTimeDisplay(shift.startTime)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 border-r border-gray-100 text-gray-700">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md text-[12px] font-semibold border border-amber-200/50">
                            <Clock size={12} className="text-amber-600" />
                            {formatTimeDisplay(shift.endTime)}
                          </span>
                        </td>
                        <td 
                          className={`text-center relative ${activeDropdown === shift.id ? "z-[100]" : ""}`}
                          ref={activeDropdown === shift.id ? dropdownRef : null}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(activeDropdown === shift.id ? null : shift.id);
                            }}
                            className={`p-2 rounded-lg transition-all ${
                              activeDropdown === shift.id
                                ? 'bg-gray-100 text-[#111827]'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'
                            }`}
                          >
                            <MoreVertical size={20} />
                          </button>

                          {activeDropdown === shift.id && (
                            <div
                              className={`absolute right-4 w-max min-w-[170px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 text-left ${
                                (idx > 0 && (currentData.length <= 2 || idx >= currentData.length - 2))
                                  ? "bottom-0 mb-2"
                                  : "top-0 mt-2"
                              }`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenView(shift);
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
                                  confirmDelete(shift);
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
                  )}
                </tbody>
              </table>
            </ScrollableTable>

            {/* Pagination Controls */}
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
                {viewMode === 'ADD' && 'Add Shift'}
                {viewMode === 'EDIT' && 'Edit Shift'}
                {viewMode === 'VIEW' && 'Shift Details'}
              </h2>

              <div className="flex items-center gap-3">
                {viewMode === 'VIEW' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('EDIT')}
                    className="flex items-center justify-center h-[40px] px-6 bg-[#073318] hover:bg-[#04200f] text-white rounded-[10px] text-[14px] font-bold transition-all shadow-sm active:scale-95"
                  >
                    Edit Shift
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
              <form onSubmit={handleSaveShift} className="flex flex-col gap-6 max-w-3xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Shift Name */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[13px] font-semibold text-[#4B5563]">
                      Shift Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={viewMode === 'VIEW'}
                      placeholder="Enter shift name (e.g. Morning Shift, Night Shift)"
                      value={formData.shiftName}
                      onChange={(e) => {
                        setFormData({ ...formData, shiftName: e.target.value });
                        if (formErrors.shiftName) setFormErrors({ ...formErrors, shiftName: '' });
                      }}
                      className={`w-full h-[42px] px-4 bg-white border ${
                        formErrors.shiftName ? 'border-red-500' : 'border-[#E5E7EB]'
                      } rounded-[10px] text-[14px] font-medium text-[#111827] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed`}
                    />
                    {formErrors.shiftName && (
                      <span className="text-[12px] text-red-500 font-semibold">{formErrors.shiftName}</span>
                    )}
                  </div>

                  {/* Start Time */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[#4B5563]">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.startTime}
                        onChange={(e) => {
                          setFormData({ ...formData, startTime: e.target.value });
                          if (formErrors.startTime) setFormErrors({ ...formErrors, startTime: '' });
                        }}
                        className={`w-full h-[42px] px-4 bg-white border ${
                          formErrors.startTime ? 'border-red-500' : 'border-[#E5E7EB]'
                        } rounded-[10px] text-[14px] font-semibold text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed`}
                      />
                    </div>
                    {formErrors.startTime && (
                      <span className="text-[12px] text-red-500 font-semibold">{formErrors.startTime}</span>
                    )}
                    {formData.startTime && (
                      <span className="text-[11px] text-gray-500 font-medium">
                        Display: {formatTimeDisplay(formData.startTime)}
                      </span>
                    )}
                  </div>

                  {/* End Time */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold text-[#4B5563]">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        required
                        disabled={viewMode === 'VIEW'}
                        value={formData.endTime}
                        onChange={(e) => {
                          setFormData({ ...formData, endTime: e.target.value });
                          if (formErrors.endTime) setFormErrors({ ...formErrors, endTime: '' });
                        }}
                        className={`w-full h-[42px] px-4 bg-white border ${
                          formErrors.endTime ? 'border-red-500' : 'border-[#E5E7EB]'
                        } rounded-[10px] text-[14px] font-semibold text-[#111827] outline-none focus:border-[#073318] transition-all shadow-sm disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed`}
                      />
                    </div>
                    {formErrors.endTime && (
                      <span className="text-[12px] text-red-500 font-semibold">{formErrors.endTime}</span>
                    )}
                    {formData.endTime && (
                      <span className="text-[11px] text-gray-500 font-medium">
                        Display: {formatTimeDisplay(formData.endTime)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-[#E5E7EB] mt-4">
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    className="px-6 h-[40px] border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
                  >
                    {viewMode === 'VIEW' ? 'Close' : 'Back'}
                  </button>

                  {viewMode !== 'VIEW' && (
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-8 h-[40px] bg-[#073318] hover:bg-[#04200f] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Shift</h3>
                <p className="text-xs text-gray-500 font-medium">Confirm shift removal</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to delete shift <strong className="text-gray-900 font-bold">"{shiftToDelete?.shiftName}"</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setShiftToDelete(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExecute}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md flex items-center gap-1.5"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportModalOpen && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          sampleFileName="Shift_Master_Sample.xlsx"
          sampleHeaders={['Shift Name', 'Start Time', 'End Time']}
          onImport={async (file) => {
            try {
              const reader = new FileReader();
              reader.onload = async (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                let count = 0;
                for (const row of json) {
                  const shiftName = row['Shift Name'] || row['shiftName'] || row['Name'] || row['name'];
                  const startTime = row['Start Time'] || row['startTime'] || '09:00 AM';
                  const endTime = row['End Time'] || row['endTime'] || '05:00 PM';
                  if (shiftName) {
                    await axios.post(`${API_BASE_URL}/masters/shift-master`, {
                      shiftName: String(shiftName).trim(),
                      startTime: String(startTime).trim(),
                      endTime: String(endTime).trim(),
                    }, getHeaders());
                    count++;
                  }
                }
                toast.success(`Successfully imported ${count} Shifts`);
                fetchShifts();
                setIsImportModalOpen(false);
              };
              reader.readAsArrayBuffer(file);
            } catch (err) {
              console.error('Import failed:', err);
              toast.error('Failed to import Shifts');
            }
          }}
        />
      )}
    </div>
  );
};

export default ShiftMaster;
