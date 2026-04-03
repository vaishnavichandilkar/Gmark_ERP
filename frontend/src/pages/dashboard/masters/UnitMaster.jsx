import React, { useState, useRef, useEffect } from 'react';
import { Search, Download, Upload, Plus, Filter, MoreVertical, X, FileText, FileSpreadsheet, Eye, FileEdit, ArrowLeft, ArrowRight, ChevronsUpDown, CheckCircle2, RefreshCw, ChevronDown, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UnitForm from './components/UnitForm';
import unitService from '../../../services/masters/unitService';
import toast from 'react-hot-toast';

import { translateDynamic } from '../../../utils/i18nUtils';
import SuccessToast from './components/SuccessToast';
import ImportModal from './components/ImportModal';

const UnitMaster = () => {
    const { t } = useTranslation(['modules', 'common']);
    const defaultFilters = { gstUom: '', status: '', unitName: '' };
    const [searchQuery, setSearchQuery] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterInputs, setFilterInputs] = useState(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
    const [currentView, setCurrentView] = useState({ type: 'list', data: null });
    const exportRef = useRef(null);
    const dropdownRef = useRef(null);

    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [gstUomOptions, setGstUomOptions] = useState([]);
    const [showSuccessToast, setShowSuccessToast] = useState({ show: false, message: '', type: 'success' });
    const [isFilterApplied, setIsFilterApplied] = useState(false);

    const showToast = (message, type = 'success') => {
        setShowSuccessToast({ show: true, message, type });
    };

    const fetchUnits = async () => {
        try {
            setLoading(true);
            const params = {
                page: currentPage.toString(),
                limit: itemsPerPage.toString(),
                search: searchQuery,
                status: appliedFilters.status || undefined,
                gst_uom: appliedFilters.gstUom || undefined,
                unit_name: appliedFilters.unitName || undefined
            };
            const response = await unitService.getUnits(params);
            setTableData(response.data || []);
            setTotalItems(response.meta?.total || 0);
        } catch (error) {
            console.error('Error fetching units:', error);
            toast.error(t('common:error_fetching_data'));
        } finally {
            setLoading(false);
        }
    };

    const fetchGstUomList = async () => {
        try {
            const response = await unitService.getGstUoms();
            setGstUomOptions(response.data || []);
        } catch (error) {
            console.error('Error fetching GST UOMs:', error);
        }
    };

    useEffect(() => {
        fetchUnits();
    }, [currentPage, itemsPerPage, searchQuery, appliedFilters]);

    useEffect(() => {
        fetchGstUomList();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if click was outside both desktop and mobile export triggers/menus
            const isOutsideExport = 
                (!exportRef.current || !exportRef.current.contains(event.target)) &&
                !event.target.closest('.mobile-export-trigger');
            
            if (isOutsideExport) {
                setIsExportOpen(false);
            }
            
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) && !event.target.closest('[data-dropdown-btn="true"]')) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = (id, e) => {
        e.stopPropagation();
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            await unitService.updateUnitStatus(id, newStatus);
            showToast(`Unit ${newStatus === 'ACTIVE' ? 'activated' : 'inactivated'} successfully`);
            fetchUnits();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast(error.response?.data?.message || t('common:error_updating_status'), 'error');
        }
        setActiveDropdown(null);
    };

    const handleApplyFilter = () => {
        setAppliedFilters(filterInputs);
        // Check if any filter is actually selected
        const hasFilters = filterInputs.unitName || filterInputs.status || filterInputs.gstUom;
        setIsFilterApplied(!!hasFilters);
        setIsFilterOpen(false);
        setCurrentPage(1);
    };

    const handleClearFilter = () => {
        setFilterInputs(defaultFilters);
        setAppliedFilters(defaultFilters);
        setSearchQuery('');
        setIsFilterApplied(false);
        setCurrentPage(1);
    };

    const handleRefresh = async () => {
        fetchUnits();
        showToast("Data refreshed successfully");
    };

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

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

    const handleExportPDF = async () => {
        setIsExportOpen(false);
        try {
            const params = { 
                format: 'pdf', 
                search: searchQuery || undefined,
                status: appliedFilters.status || undefined,
                gst_uom: appliedFilters.gstUom || undefined,
                unit_name: appliedFilters.unitName || undefined
            };
            const response = await unitService.exportUnits(params);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `unit_master_export_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            showToast('PDF Exported Successfully');
        } catch (e) {
            console.error('Export failed', e);
            let message = 'Export failed';
            if (e.response && e.response.data instanceof Blob) {
                const text = await e.response.data.text();
                try {
                    const errorData = JSON.parse(text);
                    message = errorData.message || message;
                } catch (err) {}
            } else if (e.response?.data?.message) {
                message = e.response.data.message;
            }
            showToast(message, 'error');
        }
    };

    const handleExportExcel = async () => {
        setIsExportOpen(false);
        try {
            const params = { 
                format: 'xlsx', 
                search: searchQuery || undefined,
                status: appliedFilters.status || undefined,
                gst_uom: appliedFilters.gstUom || undefined,
                unit_name: appliedFilters.unitName || undefined
            };
            const response = await unitService.exportUnits(params);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `unit_master_export_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            showToast('Excel Exported Successfully');
        } catch (e) {
            console.error('Export failed', e);
            let message = 'Export failed';
            if (e.response && e.response.data instanceof Blob) {
                const text = await e.response.data.text();
                try {
                    const errorData = JSON.parse(text);
                    message = errorData.message || message;
                } catch (err) {}
            } else if (e.response?.data?.message) {
                message = e.response.data.message;
            }
            showToast(message, 'error');
        }
    };

    const handleImportExcel = async (formData) => {
        try {
            toast.loading(t('common:importing', 'Importing...'), { id: 'import-toast' });
            await unitService.importUnits(formData);
            toast.dismiss('import-toast');
            toast.success(t('common:import_success', 'Data imported successfully'));
            fetchUnits();
            return Promise.resolve();
        } catch (error) {
            toast.dismiss('import-toast');
            toast.error(error?.response?.data?.message || t('common:import_failed', 'Failed to import data'));
            return Promise.reject(error);
        }
    };

    return (
        <div className="flex flex-col relative w-full h-full">
            {showSuccessToast.show && (
                <SuccessToast
                    message={showSuccessToast.message}
                    type={showSuccessToast.type}
                    onClose={() => setShowSuccessToast({ ...showSuccessToast, show: false })}
                />
            )}

            {currentView.type === 'list' ? (
                <>
                    <div className="flex flex-col gap-1 mb-4 md:mb-8">
                        {/* Desktop Header */}
                        <div className="hidden md:flex flex-row items-center justify-end gap-4">

                            <button 
                                onClick={() => setCurrentView({ type: 'add', data: null })}
                                className="flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[44px] rounded-[10px] text-[15px] font-bold transition-all shadow-sm active:scale-[0.98] shrink-0"
                            >
                                <Plus size={18} />
                                {t('modules:add_unit')}
                            </button>
                        </div>

                        {/* Mobile Header - Stacked Layout */}
                        <div className="md:hidden flex flex-col gap-3">

                            <button
                                onClick={() => setCurrentView({ type: 'add', data: null })}
                                className="flex items-center justify-center gap-2 h-[42px] px-6 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold active:scale-[0.98] transition-all shadow-md w-full max-w-[358px] self-center"
                            >
                                <Plus size={18} strokeWidth={3} />
                                {t('modules:add_unit')}
                            </button>
                        </div>
                    </div>

                    <div className={`master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8 rounded-[20px] overflow-hidden ${activeDropdown ? '!overflow-visible' : ''}`}>
                        {/* Desktop Action Bar */}
                        <div className="hidden md:flex items-center justify-between p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[20px]">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-[320px]">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder={t('common:search_placeholder', 'Search By Anything...')}
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)} className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all shadow-sm ${isFilterApplied ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}>
                                    <Filter size={18} className={isFilterApplied ? "text-red-500" : "text-gray-400"} />
                                    {isFilterApplied ? t('common:clear', 'Clear') : t('common:filter', 'Filter')}
                                </button>
                                <button onClick={fetchUnits} className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 bg-white">
                                    <RefreshCw size={18} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3" ref={exportRef}>
                                <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all duration-200 bg-white">
                                    <Upload size={18} className="text-gray-400" />
                                    {t('common:import')}
                                </button>
                                <div className="relative">
                                    <button onClick={() => setIsExportOpen(!isExportOpen)} className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all ${isExportOpen ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563]'}`}>
                                        <Download size={18} />
                                        {t('common:export')}
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

                        {/* Mobile Action Bar - Optimized One-line Layout */}
                        <div className="md:hidden py-3 px-4 border-b border-[#F3F4F6] rounded-t-[20px]">
                            <div className="flex items-center gap-2 h-[40px]">
                                {/* Expandable Search */}
                                <div className={`relative h-full transition-all duration-300 flex items-center ${isSearchExpanded ? 'flex-1' : 'w-[42px]'}`}>
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
                                                placeholder={t('common:search')}
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setCurrentPage(1);
                                                }}
                                                className="w-full h-full bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none shadow-sm placeholder:text-gray-400 font-medium"
                                            />
                                            {searchQuery && (
                                                <button 
                                                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                                    className="absolute right-3 text-gray-400"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Action Icons - Hidden when search expanded */}
                                {!isSearchExpanded ? (
                                    <div className="flex items-center gap-1 ml-auto animate-in fade-in duration-300">
                                        <button onClick={fetchUnits} className="w-10 h-10 flex items-center justify-center text-gray-500">
                                            <RefreshCw size={20} />
                                        </button>
                                        <button onClick={() => setIsImportModalOpen(true)} className="w-10 h-10 flex items-center justify-center text-gray-500">
                                            <Upload size={20} />
                                        </button>
                                        <div className="relative">
                                            <button 
                                                onClick={() => setIsExportOpen(!isExportOpen)} 
                                                className={`w-10 h-10 flex items-center justify-center transition-colors ${isExportOpen ? 'text-[#073318]' : 'text-gray-500'}`}
                                            >
                                                <Download size={20} />
                                            </button>
                                            {isExportOpen && (
                                                <div className="absolute top-full right-0 mt-2 w-[140px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[100] py-1 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                                    <button onClick={handleExportPDF} className="w-full px-4 py-2.5 flex items-center gap-3 text-[13px] text-gray-700 hover:bg-gray-50">
                                                        <FileText size={18} className="text-red-500" /> PDF
                                                    </button>
                                                    <button onClick={handleExportExcel} className="w-full px-4 py-2.5 flex items-center gap-3 text-[13px] text-gray-700 hover:bg-gray-50 border-t border-gray-50">
                                                        <FileSpreadsheet size={18} className="text-green-600" /> Excel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)}
                                            className={`w-10 h-10 flex items-center justify-center ${isFilterApplied ? 'text-red-600' : 'text-gray-500'}`}
                                            title={isFilterApplied ? t('common:clear') : t('common:filter')}
                                        >
                                            <Filter size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); setCurrentPage(1); }}
                                        className="text-[14px] font-bold text-[#073318] px-2 animate-in fade-in duration-300"
                                    >
                                        {t('common:cancel')}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="master-table-wrapper">
                            <table className="master-table min-w-[1000px]">
                                <thead>
                                    <tr>
                                        <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 tracking-tight text-left">
                                            <div className="flex items-center gap-2">
                                                {t('common:sr_no')}
                                                <ChevronsUpDown size={14} className="text-gray-300" />
                                            </div>
                                        </th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 tracking-tight text-left">
                                            <div className="flex items-center gap-2">
                                                {t('modules:unit_name')}
                                                <ChevronsUpDown size={14} className="text-gray-300" />
                                            </div>
                                        </th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 tracking-tight text-left">
                                            <div className="flex items-center gap-2">
                                                {t('modules:gst_uom')}
                                                <ChevronsUpDown size={14} className="text-gray-300" />
                                            </div>
                                        </th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 tracking-tight text-left">
                                            <div className="flex items-center gap-2">
                                                {t('modules:full_name_of_measurement')}
                                                <ChevronsUpDown size={14} className="text-gray-300" />
                                            </div>
                                        </th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 border-r border-white/10 tracking-tight text-left">
                                            <div className="flex items-center gap-2">
                                                {t('common:status')}
                                                <ChevronsUpDown size={14} className="text-gray-300" />
                                            </div>
                                        </th>
                                        <th className="px-3 md:px-6 py-3 md:py-4 text-center tracking-tight">{t('common:action')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-[14px] text-[#111827]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center text-gray-400">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-10 h-10 border-4 border-[#0A3622]/10 border-t-[#0A3622] rounded-full animate-spin"></div>
                                                    <span className="font-medium">{t('common:loading')}...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : tableData.length > 0 ? tableData.map((row, index) => (
                                        <tr key={row.id} className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB] transition-all group">
                                            <td className="px-3 md:px-6 py-3 md:py-5 text-gray-500 font-medium border-r border-[#F3F4F6]">{startIndex + index + 1}</td>
                                            <td className="px-3 md:px-6 py-3 md:py-5 font-bold text-[#111827] border-r border-[#F3F4F6]">{row.unit_name}</td>
                                            <td className="px-3 md:px-6 py-3 md:py-5 text-[#6B7280] max-w-[300px] truncate border-r border-[#F3F4F6]">{row.full_name_of_measurement || '-'}</td>
                                            <td className="px-3 md:px-6 py-3 md:py-5 font-medium text-[#4B5563] border-r border-[#F3F4F6]">{row.gst_uom}</td>
                                            <td className="px-3 md:px-6 py-3 md:py-5 border-r border-[#F3F4F6]">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${row.status === 'ACTIVE' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'ACTIVE' ? 'bg-[#059669]' : 'bg-[#DC2626]'}`}></span>
                                                    {row.status === 'ACTIVE' ? t('common:active') : t('common:inactive')}
                                                </div>
                                            </td>
                                            <td className={`px-3 md:px-6 py-3 md:py-5 text-center relative ${activeDropdown === row.id ? 'z-[100]' : ''}`} ref={activeDropdown === row.id ? dropdownRef : null}>
                                                <button
                                                    onClick={(e) => toggleDropdown(row.id, e)}
                                                    data-dropdown-btn="true"
                                                    className={`p-2 rounded-lg transition-all ${activeDropdown === row.id ? 'bg-gray-100 text-[#111827]' : 'text-gray-400 hover:bg-gray-100 hover:text-[#111827]'}`}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                {activeDropdown === row.id && (
                                                    <div
                                                        className={`absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 text-left ${index >= tableData.length - 2 && tableData.length > 2
                                                            ? 'bottom-0 mb-2'
                                                            : 'top-0 mt-2'
                                                            }`}
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdown(null);
                                                                setCurrentView({ type: 'view', data: row });
                                                            }}
                                                            className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#0A3622] transition-colors whitespace-nowrap font-bold"
                                                        >
                                                            <Eye size={18} className="text-gray-400" />
                                                            {t('modules:view_and_edit_unit')}
                                                        </button>
                                                        <div className="h-[1px] bg-[#F3F4F6] mx-2 my-1" />
                                                        <button
                                                            onClick={() => handleToggleStatus(row.id, row.status)}
                                                            className="w-full px-5 py-3 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#0A3622] transition-colors whitespace-nowrap font-bold"
                                                        >
                                                            <CheckCircle2 size={18} className={row.status === 'ACTIVE' ? "text-gray-400" : "text-[#0A3622]"} />
                                                            {row.status === 'ACTIVE' ? t('common:inactive') : t('common:active')}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="p-4 bg-gray-50 rounded-full">
                                                        <Database size={32} className="text-gray-300" />
                                                    </div>
                                                    <p className="text-[#6B7280] font-medium">{t('no_units_found')}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-5 sm:py-6 border-t border-[#F3F4F6] bg-white gap-6">
                            <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-[14px] text-[#6B7280] font-medium order-2 sm:order-1 border-t sm:border-0 pt-4 sm:pt-0">
                                <div className="flex items-center gap-2">
                                    <span>{t('common:show')}</span>
                                    <div className="relative group">
                                        <select
                                            value={itemsPerPage}
                                            onChange={(e) => {
                                                setItemsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="appearance-none border border-[#E5E7EB] rounded-[8px] pl-3 pr-8 py-1.5 outline-none focus:border-[#0A3622] text-[#111827] bg-[#F9FAFB] cursor-pointer font-bold transition-all hover:bg-white"
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-[#0A3622]" />
                                    </div>
                                    <span>{t('common:per_page')}</span>
                                </div>
                                <span className="sm:hidden text-gray-400">
                                    {totalItems > 0 ? `${startIndex + 1}-${endIndex} / ${totalItems}` : `0-0 / 0`}
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full sm:w-auto order-1 sm:order-2">
                                <span className="hidden sm:inline text-[#6B7280] text-[14px] font-medium">
                                    {totalItems > 0 ? `${startIndex + 1}-${endIndex} of ${totalItems}` : `0-0 of 0`}
                                </span>
                                <div className="flex items-center justify-center gap-1.5 w-full sm:w-auto">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="flex-1 sm:flex-none w-10 h-10 flex items-center justify-center text-[#6B7280] bg-gray-50/50 sm:bg-transparent hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px] border border-transparent hover:border-gray-100"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[180px] sm:max-w-none px-1">
                                        {getVisiblePages().map((page, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handlePageChange(page)}
                                                className={`min-w-[36px] sm:min-w-[40px] h-[36px] sm:h-[40px] rounded-[10px] flex items-center justify-center transition-all text-[13px] sm:text-[14px] font-bold
                                                                    ${currentPage === page
                                                        ? 'bg-[#F9FAFB] text-[#111827] shadow-sm border border-gray-100'
                                                        : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="flex-1 sm:flex-none w-10 h-10 flex items-center justify-center text-[#6B7280] bg-gray-50/50 sm:bg-transparent hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[10px] border border-transparent hover:border-gray-100"
                                    >
                                        <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isFilterOpen && (
                        <div
                            className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-[2px] transition-all duration-300 ease-in-out"
                            onClick={() => setIsFilterOpen(false)}
                        />
                    )}

                    <div className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${isFilterOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="flex items-center justify-between px-6 py-5 border-b border-[#04200f] bg-emerald-900">
                            <h2 className="text-[20px] font-bold text-white tracking-tight">{t('apply_filters')}</h2>
                            <button onClick={() => setIsFilterOpen(false)} className="text-emerald-100 hover:text-white transition-colors p-1">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 px-8 py-8 overflow-y-auto space-y-7">
                            <div className="space-y-2.5">
                                <label className="text-[14px] font-medium text-[#4B5563]">{t('select_gst_uom')}</label>
                                <div className="relative">
                                    <select
                                        value={filterInputs.gstUom}
                                        onChange={(e) => setFilterInputs({ ...filterInputs, gstUom: e.target.value })}
                                        className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] pl-4 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#014A36] appearance-none bg-white font-medium"
                                    >
                                        <option value="">{t('common:all')}</option>
                                        {gstUomOptions.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                    <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <ChevronsUpDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <label className="text-[14px] font-medium text-[#4B5563]">{t('common:status')}</label>
                                <div className="relative">
                                    <select
                                        value={filterInputs.status}
                                        onChange={(e) => setFilterInputs({ ...filterInputs, status: e.target.value })}
                                        className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] pl-4 pr-10 text-[14px] text-[#111827] outline-none focus:border-[#014A36] appearance-none bg-white font-medium"
                                    >
                                        <option value="">{t('common:all')}</option>
                                        <option value="ACTIVE">{t('common:active')}</option>
                                        <option value="INACTIVE">{t('common:inactive')}</option>
                                    </select>
                                    <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <ChevronsUpDown size={14} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <label className="text-[14px] font-medium text-[#4B5563]">{t('unit_name')}</label>
                                <input
                                    type="text"
                                    value={filterInputs.unitName}
                                    onChange={(e) => setFilterInputs({ ...filterInputs, unitName: e.target.value })}
                                    placeholder="Enter unit name"
                                    className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-[#111827] outline-none focus:border-[#014A36] bg-white font-medium"
                                />
                            </div>
                        </div>

                        <div className="px-8 py-6 border-t border-[#E5E7EB] flex items-center gap-4 bg-white">
                            <button
                                onClick={handleClearFilter}
                                className="flex-1 h-[46px] bg-white border border-[#E5E7EB] text-[#374151] text-[15px] font-semibold rounded-[10px] hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleApplyFilter}
                                className="flex-1 h-[46px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-colors shadow-sm"
                            >
                                {t('common:apply_filter') || 'Apply Filter'}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <UnitForm
                    mode={currentView.type}
                    initialData={currentView.data}
                    onBack={() => setCurrentView({ type: 'list', data: null })}
                    onEdit={(data) => setCurrentView({ type: 'edit', data })}
                    onSuccess={() => {
                        const message = currentView.type === 'add' ? 'Unit added successfully' : 'Unit edited successfully';
                        setCurrentView({ type: 'list', data: null });
                        showToast(message);
                        fetchUnits();
                    }}
                />
            )}
            {isImportModalOpen && (
                <ImportModal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={handleImportExcel}
                    onDownloadSample={() => unitService.downloadUnitSampleExcel()}
                    sampleFileName="Unit_Master_Sample.xlsx"
                    sampleHeaders={['Unit Name', 'GST UOM', 'Full Name Of Measurement', 'Status']}
                />
            )}
        </div>
    );
};

export default UnitMaster;
