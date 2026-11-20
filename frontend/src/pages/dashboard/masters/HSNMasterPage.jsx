import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Search, Download, Upload, Plus, Filter, X, FileText, FileSpreadsheet, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import HSNMasterTable from './components/HSNMasterTable';
import AddEditHSNForm from './components/AddEditHSNForm';
import ViewHSN from './components/ViewHSN';
import hsnService from '../../../services/masters/hsnService';
import { useHsnMaster, useHsnPermissions } from '../../../hooks/useHsnMaster';

import SuccessToast from './components/SuccessToast';
import FilterDropdown from './components/FilterDropdown';
import ImportModal from './components/ImportModal';
import CustomSelect from '../../../components/common/CustomSelect';

const HSNMasterPage = () => {
    const { t } = useTranslation(['modules', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const { id } = useParams();

    const {
        hsnList,
        total,
        page,
        limit,
        totalPages,
        selectedHsn,
        loading,
        getHsnList,
        getHsnById,
        createHsn,
        updateHsn,
        deleteHsn,
        toggleHsnStatus,
        clearSelected
    } = useHsnMaster();

    const permissions = useHsnPermissions();

    const defaultFilters = { type: '', taxRate: '', status: '' };
    const [searchQuery, setSearchQuery] = useState('');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterInputs, setFilterInputs] = useState(defaultFilters);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
    const [currentView, setCurrentView] = useState({ type: 'list', data: null });
    const [showSuccessToast, setShowSuccessToast] = useState({ show: false, message: '', type: 'success' });
    
    // Pagination & sorting
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [isFilterApplied, setIsFilterApplied] = useState(false);
    
    // Delete modal confirmation
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, record: null });

    const exportRef = useRef(null);
    const filterRef = useRef(null);

    const showToast = (message, type = 'success') => {
        setShowSuccessToast({ show: true, message, type });
    };

    const fetchHsnData = async () => {
        if (!permissions.canView) return;
        try {
            const params = {
                page: currentPage.toString(),
                limit: itemsPerPage.toString(),
                search: searchQuery || undefined,
                type: appliedFilters.type || undefined,
                taxRate: appliedFilters.taxRate !== '' ? appliedFilters.taxRate : undefined,
                isActive: appliedFilters.status || undefined,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            };
            await getHsnList(params);
        } catch (error) {
            console.error('Error fetching HSN list:', error);
            toast.error(t('common:error_fetching_data', 'Failed to fetch HSN records'));
        }
    };

    useEffect(() => {
        fetchHsnData();
    }, [currentPage, itemsPerPage, searchQuery, appliedFilters, permissions.canView]);

    // Sync view with URL paths
    useEffect(() => {
        if (location.pathname.endsWith('/add')) {
            setCurrentView({ type: 'add', data: null });
        } else if (location.pathname.includes('/edit/')) {
            if (id) {
                // If selected hsn matches id, we use it, otherwise fetch
                if (selectedHsn && String(selectedHsn.id) === String(id)) {
                    setCurrentView({ type: 'edit', data: selectedHsn });
                } else {
                    getHsnById(id).then((res) => {
                        if (res.payload) {
                            setCurrentView({ type: 'edit', data: res.payload });
                        }
                    });
                }
            }
        } else if (location.pathname.includes('/view/')) {
            if (id) {
                if (selectedHsn && String(selectedHsn.id) === String(id)) {
                    setCurrentView({ type: 'view', data: selectedHsn });
                } else {
                    getHsnById(id).then((res) => {
                        if (res.payload) {
                            setCurrentView({ type: 'view', data: res.payload });
                        }
                    });
                }
            }
        } else {
            setCurrentView({ type: 'list', data: null });
            clearSelected();
        }
    }, [location.pathname, id, selectedHsn]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const isOutsideExport = 
                (!exportRef.current || !exportRef.current.contains(event.target)) &&
                !event.target.closest('.mobile-export-trigger');
            
            if (isOutsideExport) {
                setIsExportOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleStatus = async (recordId, currentStatus) => {
        try {
            const nextStatus = !currentStatus;
            const res = await toggleHsnStatus({ id: recordId, isActive: nextStatus });
            if (res.error) throw new Error(res.payload || res.error.message || 'Failed to update status');
            showToast(`HSN status updated to ${nextStatus ? 'Active' : 'Inactive'} successfully`);
            fetchHsnData();
        } catch (error) {
            console.error('Error toggling HSN status:', error);
            showToast(t('common:error_updating_status', 'Failed to update status'), 'error');
        }
    };

    const handleApplyFilter = () => {
        setAppliedFilters(filterInputs);
        const hasFilters = filterInputs.type || filterInputs.taxRate !== '' || filterInputs.status;
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
        fetchHsnData();
        showToast("Data refreshed successfully");
    };

    const handleFormSubmit = async (data) => {
        try {
            if (currentView.type === 'add') {
                const res = await createHsn(data);
                if (res.error) throw new Error(res.payload || res.error.message || 'Failed to create');
                showToast('HSN record created successfully');
            } else if (currentView.type === 'edit' && id) {
                const res = await updateHsn(id, data);
                if (res.error) throw new Error(res.payload || res.error.message || 'Failed to update');
                showToast('HSN record updated successfully');
            }
            navigate('/seller/masters/hsn-master');
        } catch (error) {
            console.error('Submit error:', error);
            toast.error(error.message || 'Action failed');
            throw error;
        }
    };

    const handleExport = async (format) => {
        setIsExportOpen(false);
        if (total === 0) {
            showToast("No data available to export", "error");
            return;
        }
        try {
            const params = {
                format,
                search: searchQuery || undefined,
                type: appliedFilters.type || undefined,
                taxRate: appliedFilters.taxRate !== '' ? appliedFilters.taxRate : undefined,
                isActive: appliedFilters.status || undefined
            };
            const response = await hsnService.exportHsn(params);
            const mimeType = format === 'pdf' 
                ? 'application/pdf' 
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `hsn_master_export_${Date.now()}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast(`${format === 'pdf' ? 'PDF' : 'Excel'} Exported Successfully`);
        } catch (e) {
            console.error('Export failed', e);
            showToast('Export failed', 'error');
        }
    };

    const handleImportExcel = async (formData) => {
        try {
            const response = await hsnService.importHsn(formData);
            const res = response?.data || response;
            fetchHsnData();
            return res;
        } catch (error) {
            console.error("Import error:", error);
            throw error;
        }
    };

    const handleDownloadSample = async () => {
        try {
            const response = await hsnService.downloadSampleExcel();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'hsn_master_sample.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download sample:', error);
            toast.error('Failed to download sample file');
        }
    };

    const handleDeleteClick = (record) => {
        setDeleteModal({ isOpen: true, record });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal.record) return;
        try {
            const res = await deleteHsn(deleteModal.record.id);
            if (res.error) throw new Error(res.payload || res.error.message || 'Failed to delete record');
            showToast('HSN record deleted successfully');
            fetchHsnData();
        } catch (error) {
            console.error('Failed to delete HSN:', error);
            showToast(error.message || 'Failed to delete record', 'error');
        } finally {
            setDeleteModal({ isOpen: false, record: null });
        }
    };

    const handlePageChange = (pageNo) => {
        if (pageNo >= 1 && pageNo <= totalPages) {
            setCurrentPage(pageNo);
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

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, total);

    if (!permissions.canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-white border border-[#E5E7EB] rounded-[20px] shadow-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">Access Denied</h3>
                <p className="text-gray-500">You do not have permission to view HSN Master module.</p>
            </div>
        );
    }

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
                    {/* Header */}
                    <div className="flex flex-col gap-1 mb-4 md:mb-8">
                        <div className="flex flex-row items-center justify-between gap-4">
                            <h2 className="text-[20px] md:text-[24px] font-bold text-[#111827] tracking-tight">
                                HSN Master
                            </h2>

                            {permissions.canCreate && (
                                <button 
                                    onClick={() => navigate('add')}
                                    className="flex items-center gap-2 bg-[#073318] hover:bg-[#04200f] text-white px-6 h-[44px] rounded-[10px] text-[15px] font-bold transition-all shadow-sm active:scale-[0.98]"
                                >
                                    <Plus size={18} />
                                    Add HSN
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className={`master-table-container bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8 rounded-[20px] overflow-hidden ${activeDropdown ? '!overflow-visible' : ''}`}>
                        {/* Desktop Search / Control Bar */}
                        <div className="hidden md:flex items-center justify-between p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[20px]">
                            <div className="flex items-center gap-3 flex-1">
                                <div className="relative flex-1 max-w-[320px]">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by code or description"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400 shadow-sm font-medium"
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
                                <button onClick={handleRefresh} className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 bg-white">
                                    <RefreshCw size={18} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3" ref={exportRef}>
                                {permissions.canCreate && (
                                    <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all duration-200 bg-white">
                                        <Download size={18} className="text-gray-400" />
                                        {t('common:import')}
                                    </button>
                                )}
                                {permissions.canExport && (
                                    <div className="relative">
                                        <button onClick={() => setIsExportOpen(!isExportOpen)} className={`flex items-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all ${isExportOpen ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563]'}`}>
                                            <Upload size={18} />
                                            {t('common:export')}
                                        </button>
                                        {isExportOpen && (
                                            <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700">
                                                    <FileText size={18} className="text-red-500" /> PDF
                                                </button>
                                                <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-[14px] font-bold text-gray-700">
                                                    <FileSpreadsheet size={18} className="text-green-600" /> Excel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile Actions Header */}
                        <div className="md:hidden py-3 px-4 border-b border-[#F3F4F6] rounded-t-[20px]">
                            <div className="flex items-center gap-2 h-[40px]">
                                <div className={`relative h-full transition-all duration-300 flex items-center ${isSearchExpanded ? 'flex-1' : 'w-[42px]'}`}>
                                    {!isSearchExpanded ? (
                                        <button onClick={() => setIsSearchExpanded(true)} className="w-full h-full flex items-center justify-center text-gray-500">
                                            <Search size={22} />
                                        </button>
                                    ) : (
                                        <div className="relative w-full h-full flex items-center animate-in slide-in-from-right-4 duration-300">
                                            <Search className="absolute left-3 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Search code..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setCurrentPage(1);
                                                }}
                                                className="w-full h-full bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none shadow-sm placeholder:text-gray-400 font-medium"
                                            />
                                            {searchQuery && (
                                                <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }} className="absolute right-3 text-gray-400">
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {!isSearchExpanded ? (
                                    <div className="flex items-center gap-1 ml-auto">
                                        <button onClick={handleRefresh} className="w-10 h-10 flex items-center justify-center text-gray-500">
                                            <RefreshCw size={20} />
                                        </button>
                                        {permissions.canCreate && (
                                            <button onClick={() => setIsImportModalOpen(true)} className="w-10 h-10 flex items-center justify-center text-gray-500">
                                                <Download size={20} />
                                            </button>
                                        )}
                                        {permissions.canExport && (
                                            <div className="relative">
                                                <button onClick={() => setIsExportOpen(!isExportOpen)} className={`w-10 h-10 flex items-center justify-center ${isExportOpen ? 'text-[#073318]' : 'text-gray-500'}`}>
                                                    <Upload size={20} />
                                                </button>
                                                {isExportOpen && (
                                                    <div className="absolute top-full right-0 mt-2 w-[140px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[100] py-1">
                                                        <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 flex items-center gap-3 text-[13px] text-gray-700">PDF</button>
                                                        <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 flex items-center gap-3 text-[13px] text-gray-700">Excel</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <button onClick={() => isFilterApplied ? handleClearFilter() : setIsFilterOpen(true)} className={`w-10 h-10 flex items-center justify-center ${isFilterApplied ? 'text-red-600' : 'text-gray-500'}`}>
                                            <Filter size={20} />
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); setCurrentPage(1); }} className="text-[14px] font-bold text-[#073318] px-2">
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* HSN Table Component */}
                        <HSNMasterTable
                            data={hsnList}
                            loading={loading}
                            activeDropdown={activeDropdown}
                            setActiveDropdown={setActiveDropdown}
                            onView={(record) => navigate(`view/${record.id}`)}
                            onEdit={(record) => navigate(`edit/${record.id}`)}
                            onDelete={handleDeleteClick}
                            onToggleStatus={handleToggleStatus}
                            permissions={permissions}
                        />

                        {/* Pagination Bar */}
                        <div className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 border-t border-[#F3F4F6] bg-white gap-4 w-full">
                            <div className="flex items-center gap-2 text-[13px] text-[#6B7280] font-medium">
                                <span className="hidden sm:inline">{t('common:show')}</span>
                                <CustomSelect 
                                    value={itemsPerPage}
                                    onChange={(val) => {
                                        setItemsPerPage(val);
                                        setCurrentPage(1);
                                    }}
                                    options={[5, 10, 15, 20, 50]}
                                    menuPlacement="top"
                                />
                                <span className="hidden sm:inline">{t('common:per_page')}</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-[#6B7280] text-[13px] font-medium whitespace-nowrap">
                                    {total > 0 ? `${startIndex + 1}–${endIndex} of ${total}` : '0-0 of 0'}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handlePageChange(1)}
                                        disabled={currentPage === 1}
                                        title="First Page"
                                        className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                                    >
                                        <ChevronsLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        title="Previous Page"
                                        className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="hidden md:flex items-center gap-1.5 px-1">
                                        {getVisiblePages().map((pageNo) => (
                                            <button
                                                key={pageNo}
                                                onClick={() => handlePageChange(pageNo)}
                                                className={`min-w-[32px] h-[32px] rounded-[8px] flex items-center justify-center transition-all text-[13px] font-bold ${
                                                    currentPage === pageNo
                                                        ? 'bg-[#073318] text-white shadow-md'
                                                        : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111827]'
                                                }`}
                                            >
                                                {pageNo}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        title="Next Page"
                                        className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                    <button
                                        onClick={() => handlePageChange(totalPages)}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        title="Last Page"
                                        className="w-8 h-8 flex items-center justify-center text-[#6B7280] hover:bg-gray-50 hover:text-[#111827] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-lg"
                                    >
                                        <ChevronsRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reusable Import Excel Modal */}
                    {permissions.canCreate && (
                        <ImportModal
                            isOpen={isImportModalOpen}
                            onClose={() => setIsImportModalOpen(false)}
                            onImport={handleImportExcel}
                            onDownloadSample={handleDownloadSample}
                            sampleFileName="hsn_master_sample.xlsx"
                            sampleHeaders={['Type*', 'Code*', 'Tax Rate*', 'Description']}
                        />
                    )}

                    {/* Reusable Delete Confirmation Modal */}
                    {deleteModal.isOpen && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-slate-900/30 backdrop-blur-[2px] transition-all duration-300">
                            <div className="bg-white w-full max-w-[380px] flex flex-col rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.2)] overflow-hidden p-7 transform transition-all scale-100 opacity-100">
                                <div className="flex items-start mb-8">
                                    <div className="w-[42px] h-[42px] rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0 ring-[6px] ring-[#FFF5F5] mt-1">
                                        <AlertCircle className="w-5 h-5 text-[#DC2626]" strokeWidth={2.5} />
                                    </div>
                                    <div className="ml-5">
                                        <h2 className="text-[18px] font-bold text-gray-900 mb-1">Delete HSN Record</h2>
                                        <p className="text-[14px] text-gray-500 leading-relaxed font-medium pb-1 pr-2">
                                            Are you sure you want to delete this HSN record?
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col space-y-3">
                                    <button
                                        onClick={handleDeleteConfirm}
                                        className="w-full bg-[#DE352B] hover:bg-[#B91C1C] text-white font-semibold py-3 rounded-[10px] transition-colors shadow-sm text-[15px]"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => setDeleteModal({ isOpen: false, record: null })}
                                        className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3 rounded-[10px] transition-colors shadow-sm text-[15px]"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filter Slide-over Panel */}
                    {isFilterOpen && (
                        <div className="fixed inset-0 z-50 overflow-hidden" ref={filterRef}>
                            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={() => setIsFilterOpen(false)} />
                            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
                                <div className="w-screen max-w-md bg-white shadow-xl flex flex-col justify-between p-6">
                                    <div className="flex flex-col gap-6">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                            <h3 className="text-lg font-bold text-gray-900">Filters</h3>
                                            <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 hover:text-gray-500">
                                                <X size={20} />
                                            </button>
                                        </div>

                                        <div className="flex flex-col gap-5">
                                            <FilterDropdown
                                                label="Type"
                                                name="type"
                                                value={filterInputs.type}
                                                options={[
                                                    { label: 'All Types', value: '' },
                                                    { label: 'HSN', value: 'HSN' },
                                                    { label: 'SAC', value: 'SAC' }
                                                ]}
                                                onChange={(e) => setFilterInputs(prev => ({ ...prev, type: e.target.value }))}
                                            />

                                            <FilterDropdown
                                                label="Tax Rate (%)"
                                                name="taxRate"
                                                value={filterInputs.taxRate}
                                                options={[
                                                    { label: 'All Rates', value: '' },
                                                    { label: '0%', value: 0 },
                                                    { label: '5%', value: 5 },
                                                    { label: '12%', value: 12 },
                                                    { label: '18%', value: 18 },
                                                    { label: '28%', value: 28 }
                                                ]}
                                                onChange={(e) => setFilterInputs(prev => ({ ...prev, taxRate: e.target.value }))}
                                            />

                                            <FilterDropdown
                                                label="Active Status"
                                                name="status"
                                                value={filterInputs.status}
                                                options={[
                                                    { label: 'All Statuses', value: '' },
                                                    { label: 'Active Only', value: 'true' },
                                                    { label: 'Inactive Only', value: 'false' }
                                                ]}
                                                onChange={(e) => setFilterInputs(prev => ({ ...prev, status: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 border-t border-gray-100 pt-6">
                                        <button
                                            onClick={handleClearFilter}
                                            className="flex-1 py-3 px-4 border border-gray-200 rounded-[10px] text-[14px] font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            Reset All
                                        </button>
                                        <button
                                            onClick={handleApplyFilter}
                                            className="flex-1 py-3 px-4 bg-[#073318] hover:bg-[#04200f] text-white rounded-[10px] text-[14px] font-bold transition-colors shadow-sm"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : currentView.type === 'view' ? (
                <ViewHSN
                    initialData={currentView.data}
                    onBack={() => navigate('/seller/masters/hsn-master')}
                    onEdit={(record) => navigate(`/seller/masters/hsn-master/edit/${record.id}`)}
                />
            ) : (
                <AddEditHSNForm
                    initialData={currentView.data}
                    mode={currentView.type}
                    onBack={() => navigate('/seller/masters/hsn-master')}
                    onSubmit={handleFormSubmit}
                />
            )}
        </div>
    );
};

export default HSNMasterPage;
