import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Download, Filter, Plus, Minus, FileText, FileSpreadsheet, Maximize2, Minimize2, MoreVertical, CheckCircle2, XCircle, RefreshCw, ChevronDown, X, Eye, ChevronsUpDown, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GroupForm from './components/GroupForm';
import ImportModal from './components/ImportModal';
import { exportToPDF, exportToExcel } from '../../../utils/exportUtils';
import masterService from '../../../services/masterService';
import { translateDynamic } from '../../../utils/i18nUtils';
import toast from 'react-hot-toast';
import SuccessToast from './components/SuccessToast';

const GroupMaster = () => {
    const { t } = useTranslation(['modules', 'common']);
    const [currentView, setCurrentView] = useState({ type: 'list', data: null });
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({});
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterInputs, setFilterInputs] = useState({ status: '' });
    const [appliedFilters, setAppliedFilters] = useState({ status: '' });
    const isFilterApplied = appliedFilters.status !== '';
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const exportRef = useRef(null);
    const [activeRowDropdown, setActiveRowDropdown] = useState(null);
    const [toastState, setToastState] = useState(null);

    const showToast = (message, type = 'success') => {
        setToastState({ message, type });
        setTimeout(() => setToastState(null), 3000);
    };

    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            const response = await masterService.getAllGroups();
            if (response.success) {
                setGroups(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch groups', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    // Handle click outside for export dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if click was outside both desktop and mobile export triggers/menus
            const isOutsideExport = 
                (!exportRef.current || !exportRef.current.contains(event.target)) &&
                !event.target.closest('.mobile-export-trigger');
            
            if (isOutsideExport) {
                setIsExportOpen(false);
            }
            
            if (!event.target.closest('.dropdown-trigger') && !event.target.closest('.dropdown-menu')) {
                setActiveRowDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleGroup = (id) => {
        setExpandedGroups(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const hasMatchingChild = (group, query) => {
        const q = query.toLowerCase();
        if (group.group_name.toLowerCase().includes(q)) return true;
        if (group.status && group.status.toLowerCase().includes(q)) return true;
        if (group.children && group.children.length > 0) {
            return group.children.some(child => hasMatchingChild(child, query));
        }
        return false;
    };

    const filteredData = useMemo(() => {
        let result = groups;
        if (searchQuery) {
            result = result.filter(group => hasMatchingChild(group, searchQuery));
        }
        if (appliedFilters.status) {
            result = result.filter(group => group.status === appliedFilters.status);
        }
        return result;
    }, [groups, searchQuery, appliedFilters]);

    const getAllIds = (items) => {
        let ids = [];
        items.forEach(item => {
            ids.push(item.id);
            if (item.children && item.children.length > 0) {
                ids = ids.concat(getAllIds(item.children));
            }
        });
        return ids;
    };

    const allGroupIds = useMemo(() => getAllIds(groups), [groups]);
    const isAllExpanded = allGroupIds.length > 0 && allGroupIds.every(id => expandedGroups[id]);

    const toggleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedGroups({});
        } else {
            const newExpanded = {};
            allGroupIds.forEach(id => newExpanded[id] = true);
            setExpandedGroups(newExpanded);
        }
    };

    const handleToggleStatus = async (groupId, currentStatus) => {
        const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        setActiveRowDropdown(null);

        try {
            const response = await masterService.updateGroupStatus(groupId, nextStatus);
            if (response.success) {
                showToast(`Group ${nextStatus === 'ACTIVE' ? 'activated' : 'inactivated'} successfully`);
                fetchGroups();
            } else {
                showToast(response.message || 'Failed to update status', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            showToast(err.response?.data?.message || err.message || 'Server error', 'error');
        }
    };

    const handleApplyFilter = () => {
        setAppliedFilters(filterInputs);
        setIsFilterOpen(false);
    };

    const handleClearFilter = () => {
        setFilterInputs({ status: '' });
        setAppliedFilters({ status: '' });
        setIsFilterOpen(false);
    };

    // Export Logic
    const handleExportPDF = async () => {
        setIsExportOpen(false);
        try {
            const response = await masterService.exportGroups({ format: 'pdf' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `group_master_export_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            showToast('PDF Exported Successfully');
        } catch (e) {
            console.error('Export failed', e);
            showToast('Failed to export PDF', 'error');
        }
    };

    const handleExportExcel = async () => {
        setIsExportOpen(false);
        try {
            const response = await masterService.exportGroups({ format: 'xlsx' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `group_master_export_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            showToast('Excel Exported Successfully');
        } catch (e) {
            console.error('Export failed', e);
            showToast('Failed to export Excel', 'error');
        }
    };

    const handleImportExcel = async (formData) => {
        const loadingToast = toast.loading(t('common:importing', 'Importing data...'), { id: 'import-toast' });
        
        try {
            const response = await masterService.importGroups(formData);
            toast.dismiss('import-toast');
            
            // Show static success message as requested by user
            showToast(t('common:import_success', 'Data imported successfully'), 'success');
            
            if (response.errors && response.errors.length > 0) {
                console.warn('Import had some errors:', response.errors);
            }
            
            fetchGroups();
            return Promise.resolve();
        } catch (error) {
            toast.dismiss('import-toast');
            showToast(error?.response?.data?.message || t('common:import_failed', 'Failed to import data'), 'error');
            return Promise.reject(error);
        }
    };

    const renderGroupRow = (group, depth = 0, index = 0, siblingsLength = 0) => {
        const hasChildren = group.children && group.children.length > 0;
        const isExpanded = expandedGroups[group.id] || (searchQuery && hasMatchingChild(group, searchQuery));
        const dropdownId = `dropdown-${group.id}`;
        const isHighlighted = searchQuery && group.group_name.toLowerCase().includes(searchQuery.toLowerCase());

        return (
            <React.Fragment key={group.id}>
                <div
                    className={`flex items-center justify-between py-2 md:py-4 border-b border-[#F3F4F6] transition-all duration-200 group-row
                        ${depth === 0 ? 'bg-[#F9FAFB]/50' : 'bg-white'}
                        hover:bg-gray-50`}
                >
                    <div
                        className="flex items-center flex-1 cursor-pointer select-none gap-3"
                        style={{ paddingLeft: `${depth === 0 ? 12 : 12 + depth * 20}px` }}
                        onClick={() => hasChildren && toggleGroup(group.id)}
                    >
                        {/* Plus/Minus Toggle - Darker & bolder */}
                        <div className="w-6 h-6 flex items-center justify-center">
                            {hasChildren ? (
                                <div className={`p-0.5 rounded transition-colors duration-200 ${isExpanded ? 'bg-red-50 text-red-600' : 'bg-[#073318]/5 text-[#111827]'}`}>
                                    {isExpanded ? (
                                        <Minus size={14} strokeWidth={3} />
                                    ) : (
                                        <Plus size={14} strokeWidth={3} />
                                    )}
                                </div>
                            ) : (
                                <div className="w-1.5 h-1.5 bg-[#4B5563] rounded-full ml-0.5" />
                            )}
                        </div>

                        {/* Group Name with Visual Hierarchy */}
                        <div className="flex flex-col">
                            <span className={`text-[14px] transition-colors
                                ${depth === 0 ? 'font-bold text-[#111827]' : 'font-medium text-[#374151]'}
                                ${group.status === 'INACTIVE' ? 'text-gray-400' : ''}`}
                            >
                                {translateDynamic(group.group_name, t)}
                                {group.is_header && group.level === 1 && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-[#6B7280] text-[9px] font-bold rounded uppercase tracking-wider">
                                        {t('common:header', 'Header')}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Properly Aligned Actions Area - Matching Header Structure */}
                    <div className="flex items-stretch shrink-0">
                        {/* Status Column */}
                        <div className="w-[110px] md:w-[120px] flex items-center justify-center px-2 md:px-4">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${group.status === 'ACTIVE' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${group.status === 'ACTIVE' ? 'bg-[#059669]' : 'bg-[#DC2626]'}`}></span>
                                {group.status === 'ACTIVE' ? t('common:active') : t('common:inactive')}
                            </div>
                        </div>

                        {/* Action Column */}
                        <div className="w-16 md:w-20 flex items-center justify-center px-4 relative">
                            {(!group.is_header || group.level !== 1) && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveRowDropdown(activeRowDropdown === dropdownId ? null : dropdownId);
                                        }}
                                        className={`p-1.5 rounded-md transition-all duration-200 dropdown-trigger
                                            ${activeRowDropdown === dropdownId ? 'bg-gray-100 text-[#111827]' : 'text-gray-400 hover:text-[#073318] hover:bg-white border border-transparent'}`}
                                    >
                                        <MoreVertical size={18} />
                                    </button>

                                    {activeRowDropdown === dropdownId && (
                                        <div 
                                            className={`absolute right-[80%] w-max min-w-[200px] bg-white border border-gray-100 rounded-[14px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[110] py-2 animate-in zoom-in-95 duration-200 dropdown-menu text-left
                                                ${index >= siblingsLength - 2 && siblingsLength > 2 ? 'bottom-0 mb-2' : 'top-0 mt-2'}`}
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleStatus(group.id, group.status);
                                                }}
                                                className="w-full px-5 py-3 flex items-center gap-3 text-[14px] font-bold text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors whitespace-nowrap"
                                            >
                                                <CheckCircle2 size={18} className={group.status === 'ACTIVE' ? "text-gray-400" : "text-[#073318]"} />
                                                {group.status === 'ACTIVE' ? t('common:inactive') : t('common:active')}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
                {/* Recursive Children with Indentation */}
                {hasChildren && isExpanded && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                        {group.children.map((child, childIndex) => renderGroupRow(child, depth + 1, childIndex, group.children.length))}
                    </div>
                )}
            </React.Fragment>
        );
    };

    if (currentView.type === 'add' || currentView.type === 'edit') {
        return (
            <GroupForm
                mode={currentView.type}
                initialData={currentView.data}
                onBack={() => setCurrentView({ type: 'list', data: null })}
                onSuccess={() => {
                    fetchGroups();
                    setCurrentView({ type: 'list', data: null });
                    showToast(currentView.type === 'add' ? 'Group added successfully' : 'Group updated successfully');
                }}
            />
        );
    }

    return (
        <div className="flex flex-col animate-in fade-in duration-500 relative font-['Plus_Jakarta_Sans']">
            {toastState && (
                <SuccessToast 
                    message={toastState.message} 
                    type={toastState.type}
                    onClose={() => setToastState(null)} 
                />
            )}

            <div className="flex flex-col gap-1 mb-4 md:mb-8">
                {/* Desktop Header */}
                <div className="hidden md:flex flex-row items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-[28px] font-bold text-[#111827] tracking-tight">{t('group_master')}</h1>
                        <p className="text-[#6B7280] text-[15px] font-medium leading-relaxed max-w-[600px]">{t('group_master_desc')}</p>
                    </div>
                    <button
                        onClick={() => setCurrentView({ type: 'add', data: null })}
                        className="px-6 h-[44px] bg-[#073318] text-white rounded-[10px] text-[15px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
                    >
                        <Plus size={18} />
                        {t('add_group')}
                    </button>
                </div>

                {/* Mobile Header - Stacked Layout */}
                <div className="md:hidden flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-[24px] font-bold text-[#111827] tracking-tight">{t('group_master')}</h1>
                        <p className="text-[#6B7280] text-[14px] font-medium leading-relaxed">{t('group_master_desc')}</p>
                    </div>
                    <button
                        onClick={() => setCurrentView({ type: 'add', data: null })}
                        className="flex items-center justify-center gap-2 h-[42px] px-6 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold active:scale-[0.98] transition-all shadow-md w-fit self-end"
                    >
                        <Plus size={18} strokeWidth={3} />
                        {t('add_group')}
                    </button>
                </div>
            </div>

            {/* Action Bar - Mobile Optimized */}
            <div className="master-table-container !bg-transparent !shadow-none !border-none md:!bg-white md:!shadow-[0_4px_20px_rgba(0,0,0,0.03)] md:!border md:!border-[#E5E7EB] mb-8">
                {/* Desktop Action Bar */}
                <div className="hidden md:flex items-center justify-between p-6 border-b border-[#F3F4F6] bg-white gap-4 rounded-t-[16px]">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="relative flex-1 max-w-[320px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder={t('common:search_by_anything')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-[42px] bg-white border border-[#E5E7EB] rounded-[10px] pl-10 pr-10 text-[14px] outline-none focus:border-[#073318] transition-all placeholder:text-gray-400"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <button onClick={toggleExpandAll} className="flex items-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 transition-all bg-white">
                            {isAllExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                            {isAllExpanded ? t('common:collapse_all') : t('common:expand_all')}
                        </button>
                        <button onClick={() => fetchGroups()} className="flex items-center justify-center w-[42px] h-[42px] border border-[#E5E7EB] rounded-[10px] hover:bg-gray-50 bg-white">
                            <RefreshCw size={18} className="text-gray-400" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3" ref={exportRef}>
                        <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 h-[42px] border border-[#E5E7EB] rounded-[10px] text-[14px] font-bold text-[#4B5563] hover:bg-gray-50 bg-white">
                            <Upload size={18} className="text-gray-400" />
                            {t('common:import')}
                        </button>

                        <div className="relative flex items-center gap-3">
                            <button
                                onClick={() => setIsExportOpen(!isExportOpen)}
                                className={`flex items-center justify-center gap-2 px-4 h-[42px] border rounded-[10px] text-[14px] font-bold transition-all duration-200 bg-white
                                    ${isExportOpen ? 'border-[#073318] text-[#073318]' : 'border-[#E5E7EB] text-[#4B5563] hover:bg-gray-50'}`}
                            >
                                <Download size={18} className={isExportOpen ? 'text-[#073318]' : 'text-gray-400'} />
                                {t('common:export')}
                            </button>

                            {/* Export Dropdown */}
                            {isExportOpen && (
                                <div className="absolute top-full right-0 mt-2 w-[160px] bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[50] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button
                                        onClick={handleExportPDF}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors"
                                    >
                                        <FileText size={18} className="text-red-500" />
                                        {t('common:pdf')}
                                    </button>
                                    <button
                                        onClick={handleExportExcel}
                                        className="w-full px-4 py-2.5 flex items-center gap-3 text-[14px] text-gray-700 hover:bg-[#F9FAFB] hover:text-[#073318] transition-colors"
                                    >
                                        <FileSpreadsheet size={18} className="text-green-600" />
                                        {t('common:excel')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Action Bar - Optimized One-line Layout */}
                <div className="md:hidden mt-2">
                    <div className="flex items-center gap-2 h-[48px]">
                        {/* Compact Search */}
                        <div className="flex-1 relative h-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder={t('common:search')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-full bg-white border border-[#E5E7EB] rounded-[12px] pl-9 pr-8 text-[14px] outline-none shadow-sm placeholder:text-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Control Buttons Group */}
                        <div className="flex items-center gap-1.5 h-full">
                            <button
                                onClick={() => fetchGroups()}
                                className="w-[44px] h-[44px] flex items-center justify-center bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm active:bg-gray-50 text-gray-500"
                                title={t('common:refresh')}
                            >
                                <RefreshCw size={18} />
                            </button>

                            <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="w-[44px] h-[44px] flex items-center justify-center bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm active:bg-gray-50 text-gray-500"
                            >
                                <Upload size={18} />
                            </button>

                            <div className="relative mobile-export-trigger">
                                <button
                                    onClick={() => setIsExportOpen(!isExportOpen)}
                                    className={`w-[44px] h-[44px] flex items-center justify-center border rounded-[12px] shadow-sm transition-all active:scale-95 ${isExportOpen ? 'bg-[#073318] border-[#073318] text-white' : 'bg-white border-[#E5E7EB] text-gray-500'}`}
                                >
                                    <Download size={18} />
                                </button>
                                {isExportOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-[140px] bg-white border border-gray-100 rounded-[12px] shadow-2xl z-[100] py-1 border-t border-gray-50 overflow-hidden">
                                        <button onClick={handleExportPDF} className="w-full px-4 py-3 flex items-center gap-3 text-[13px] font-bold text-gray-700 active:bg-gray-50">
                                            <FileText size={16} className="text-red-500" /> PDF
                                        </button>
                                        <button onClick={handleExportExcel} className="w-full px-4 py-3 flex items-center gap-3 text-[13px] font-bold text-gray-700 active:bg-gray-50 border-t border-gray-50">
                                            <FileSpreadsheet size={16} className="text-green-600" /> Excel
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={toggleExpandAll}
                                className="w-[44px] h-[44px] flex items-center justify-center bg-white border border-[#E5E7EB] rounded-[12px] shadow-sm active:bg-gray-50 text-gray-500"
                            >
                                {isAllExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="w-full overflow-x-auto no-scrollbar">
                    <div className="min-w-[800px]">
                    <div className="flex items-stretch justify-between bg-emerald-900 border-b border-emerald-950 text-[14px] font-bold text-white uppercase tracking-tight">
                        <div className="flex-1 border-r border-white/50 pr-4 md:pr-6 py-3 md:py-5 pl-6 md:pl-9 flex items-center gap-2">
                            {t('modules:group_master')}
                            <ChevronsUpDown size={14} className="text-gray-300" />
                        </div>
                        <div className="flex items-stretch shrink-0">
                            <div className="w-[110px] md:w-[120px] border-r border-white/50 flex items-center justify-center px-4 gap-2">
                                {t('common:status')}
                                <ChevronsUpDown size={14} className="text-gray-300" />
                            </div>
                            <div className="w-16 md:w-20 flex items-center justify-center px-4 py-3 md:py-5">{t('common:action')}</div>
                        </div>
                    </div>
                    <div className="flex flex-col divide-y divide-[#F3F4F6]">
                        {isLoading ? (
                            <div className="p-16 text-center">
                                <div className="inline-block w-8 h-8 border-2 border-[#073318] border-t-transparent rounded-full animate-spin mb-4" />
                                <p className="text-[#6B7280] text-[14px] font-medium">{t('common:loading')}...</p>
                            </div>
                        ) : filteredData.length > 0 ? (
                            filteredData.map((group, index) => renderGroupRow(group, 0, index, filteredData.length))
                        ) : (
                            <div className="p-16 text-center">
                                <Search size={40} className="mx-auto text-gray-200 mb-4" />
                                <p className="text-gray-400 text-[15px] font-medium">
                                    {t('no_matching_groups')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {isImportModalOpen && (
            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImportExcel}
                onDownloadSample={() => masterService.downloadGroupSampleExcel()}
                sampleFileName="group_master_sample.xlsx"
                sampleHeaders={['Group Name', 'Group Under', 'Status']}
            />
        )}
    </div>
  );
};

export default GroupMaster;
