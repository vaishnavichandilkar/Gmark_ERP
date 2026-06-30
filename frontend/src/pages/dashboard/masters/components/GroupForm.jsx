import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, ArrowLeft, ChevronUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import masterService from '../../../../services/masterService';
import { translateDynamic } from '../../../../utils/i18nUtils';

const GroupForm = ({ mode = 'add', initialData = null, onBack, onSuccess }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [groupName, setGroupName] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [openingBalance, setOpeningBalance] = useState('');
    const [balanceType, setBalanceType] = useState('Dr');
    const isParentGroup = mode === 'edit' && initialData && initialData.children && initialData.children.length > 0;
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [allGroups, setAllGroups] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const dropdownRef = useRef(null);

    useEffect(() => {
        fetchDropdownGroups();
        if (mode === 'edit' && initialData) {
            setGroupName(initialData.group_name || '');
            setOpeningBalance(initialData.opening_balance || '');
            setBalanceType(initialData.balance_type || 'Dr');
        }
    }, [mode, initialData]);

    useEffect(() => {
        if (allGroups.length > 0 && mode === 'edit' && initialData && initialData.parent_id) {
            const parent = findGroupById(allGroups, initialData.parent_id);
            if (parent) setSelectedGroup(parent);
        }
    }, [allGroups, mode, initialData]);

    const findGroupById = (groups, id) => {
        for (const g of groups) {
            if (g.id === id) return g;
        }
        return null;
    };

    const fetchDropdownGroups = async () => {
        try {
            const response = await masterService.getGroupDropdown();
            if (response.success) {
                setAllGroups(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch dropdown groups', err);
        }
    };

    const handleSave = async () => {
        const newErrors = {};
        if (!groupName.trim()) {
            newErrors.group_name = t('modules:group_required') || 'Group name is required';
        }
        if (!selectedGroup) {
            newErrors.parent_group = t('modules:parent_group_required') || 'Parent group is required';
        }

        if (!isParentGroup && openingBalance !== '') {
            const val = Number(openingBalance);
            if (isNaN(val) || val < 0) {
                newErrors.opening_balance = t('modules:error_opening_balance_negative') || 'Opening balance cannot be negative';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const isExpenseParent = selectedGroup ? isExpenseGroup(selectedGroup, allGroups) : false;
        setIsLoading(true);
        setErrors({});
        try {
            let response;
            if (mode === 'add') {
                response = await masterService.createGroup({
                    group_name: groupName,
                    parent_id: selectedGroup.id,
                    opening_balance: (!isExpenseParent && openingBalance !== '') ? Number(openingBalance) : null,
                    balance_type: !isExpenseParent ? balanceType : null
                });
            } else {
                response = await masterService.updateGroup(initialData.id, {
                    group_name: groupName,
                    parent_id: selectedGroup.id,
                    opening_balance: (!isExpenseParent && openingBalance !== '') ? Number(openingBalance) : null,
                    balance_type: !isExpenseParent ? balanceType : null
                });
            }

            if (response?.success) {
                onSuccess();
            }
        } catch (err) {
            setErrors({ general: err.response?.data?.message || t('common:error_occurred') });
        } finally {
            setIsLoading(false);
        }
    };

    const filteredGroups = allGroups.filter(g =>
        g.group_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300 p-2">
            <div className={`bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col w-full mb-12 transform-gpu ${isDropdownOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
                {/* Header */}
                <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                            {mode === 'add' ? t('modules:add_group') : t('modules:edit_group')}
                        </h2>
                    </div>
                    <button
                        onClick={onBack}
                        className="group flex items-center justify-center w-10 h-10 md:w-auto md:h-[44px] md:px-6 border border-[#E5E7EB] text-[#4B5563] rounded-[12px] md:rounded-[10px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm active:scale-95"
                        title={t('common:back')}
                    >
                        <X size={22} className="md:hidden text-gray-500" />
                        <ArrowLeft size={18} className="hidden md:block" />
                        <span className="hidden md:inline ml-2">{t('common:back')}</span>
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-8 md:p-10 flex flex-col gap-8 w-full">
                    {errors.general && (
                        <div className="p-4 bg-red-50 text-red-600 text-[14px] rounded-[10px] border border-red-100 font-medium">
                            {errors.general}
                        </div>
                    )}
                    
                    {/* Group Input */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[14px] font-bold text-[#374151]">
                            {t('common:group')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => {
                                setGroupName(e.target.value);
                                if (errors.group_name) setErrors(prev => ({ ...prev, group_name: '' }));
                            }}
                            placeholder={t('common:enter_group_text')}
                            className={`w-full h-[46px] border rounded-[10px] px-4 outline-none transition-all placeholder:text-gray-400 text-[14px] text-[#111827] bg-white
                                ${errors.group_name ? 'border-red-300 ring-1 ring-red-50' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'}`}
                        />
                        {errors.group_name && <span className="text-red-500 text-[11px] mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200 font-medium">*{errors.group_name}</span>}
                    </div>

                    {/* Group Under Dropdown - Standardized with Single Search Option like UnitForm's GST UOM */}
                    <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
                        <label className="text-[14px] font-bold text-[#374151]">
                            {t('common:group_under')} <span className="text-red-500">*</span>
                        </label>
                        <div
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`w-full h-[46px] border ${isDropdownOpen ? 'border-[#073318] ring-1 ring-[#073318]/10' : 'border-[#E5E7EB] hover:border-gray-300'} 
                                ${errors.parent_group ? 'border-red-300 ring-1 ring-red-50' : ''}
                                rounded-[10px] px-4 flex items-center justify-between cursor-pointer transition-all bg-white`}
                        >
                            <div className="flex items-center flex-1 overflow-hidden">
                                {isDropdownOpen ? (
                                    <input
                                        type="text"
                                        autoFocus
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={selectedGroup ? translateDynamic(selectedGroup.group_name, t) : t('common:search_groups')}
                                        className="w-full h-full bg-transparent outline-none text-[14px] text-[#111827] placeholder:text-gray-400 font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="flex items-center overflow-hidden">
                                        {selectedGroup ? (
                                            <>
                                                {selectedGroup.level === 1 && selectedGroup.is_header && <span className="mr-2">📁</span>}
                                                {selectedGroup.level > 1 && <span className="text-gray-400 mr-2">↳</span>}
                                                <span className={`text-[14px] truncate font-medium ${selectedGroup.level === 1 && selectedGroup.is_header ? 'font-bold text-[#111827]' : 'text-[#111827]'}`}>
                                                    {translateDynamic(selectedGroup.group_name, t)}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-[14px] text-gray-400 font-medium">{t('common:select_group_under')}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {isDropdownOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                        </div>
                        {errors.parent_group && <span className="text-red-500 text-[11px] mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200 font-medium">*{errors.parent_group}</span>}

                        {isDropdownOpen && (
                            <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 focus-within:ring-0">
                                <div className="max-h-[300px] overflow-y-auto py-2 px-1 custom-scrollbar">
                                    {filteredGroups.length > 0 ? (
                                        filteredGroups.map((group) => {
                                            const isHeader = group.level === 1 && group.is_header;
                                            const indentation = (group.level - 1) * 16;

                                            return (
                                                <div
                                                    key={group.id}
                                                    onClick={() => {
                                                        setSelectedGroup(group);
                                                        setIsDropdownOpen(false);
                                                        setSearchQuery('');
                                                        if (errors.parent_group) setErrors(prev => ({ ...prev, parent_group: '' }));
                                                    }}
                                                    className={`px-4 py-3 rounded-[8px] hover:bg-gray-50 cursor-pointer text-[14px] transition-all mb-0.5
                                                        ${selectedGroup?.id === group.id ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] font-medium'}
                                                        ${isHeader ? 'mt-2 first:mt-0 font-bold bg-[#F9FAFB]/50' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center overflow-hidden" style={{ paddingLeft: `${indentation}px` }}>
                                                            {!isHeader && <span className="text-gray-400 mr-2 flex-shrink-0">↳</span>}
                                                            {isHeader && <span className="mr-2 flex-shrink-0 text-amber-600">📁</span>}
                                                            <span className="truncate">
                                                                {translateDynamic(group.group_name, t)}
                                                            </span>
                                                        </div>
                                                        {isHeader && (
                                                            <span className="text-[9px] bg-white text-[#6B7280] px-2 py-0.5 rounded font-bold tracking-wider border border-gray-100 ml-2">
                                                                {t('common:header')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="px-4 py-8 text-[14px] text-gray-500 text-center font-medium">{t('common:no_options_found')}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Opening Balance and Balance Type */}
                    {!(selectedGroup ? isExpenseGroup(selectedGroup, allGroups) : false) && (
                        <div className="flex flex-col gap-4 w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Opening Balance */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-[14px] font-bold text-[#374151]">
                                        {t('modules:openingBalance', 'Opening Balance')}
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        disabled={isParentGroup}
                                        value={openingBalance}
                                        onChange={(e) => {
                                            setOpeningBalance(e.target.value);
                                            if (errors.opening_balance) setErrors(prev => ({ ...prev, opening_balance: '' }));
                                        }}
                                        placeholder={t('modules:enter_op_balance', 'Enter opening balance')}
                                        className={`w-full h-[46px] border rounded-[10px] px-4 outline-none transition-all placeholder:text-gray-400 text-[14px] text-[#111827] bg-white
                                            ${errors.opening_balance ? 'border-red-300 ring-1 ring-red-50' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'}
                                            ${isParentGroup ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                    />
                                    {errors.opening_balance && <span className="text-red-500 text-[11px] mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200 font-medium">*{errors.opening_balance}</span>}
                                </div>

                                {/* Balance Type */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-[14px] font-bold text-[#374151]">
                                        {t('modules:balanceType', 'Balance Type')}
                                    </label>
                                    <select
                                        disabled={isParentGroup}
                                        value={balanceType}
                                        onChange={(e) => setBalanceType(e.target.value)}
                                        className={`w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10 transition-all text-[14px] text-[#111827] bg-white cursor-pointer
                                            ${isParentGroup ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="Dr">Dr</option>
                                        <option value="Cr">Cr</option>
                                    </select>
                                </div>
                            </div>
                            {isParentGroup && (
                                <span className="text-[12px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5 font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
                                    💡 This is a parent group containing child groups or accounts. Its opening balance and balance type are automatically calculated.
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-6 bg-[#F9FAFB]/50 flex items-center justify-end gap-3 border-t border-[#F3F4F6]">
                    <button
                        className="px-8 h-[46px] border border-[#E5E7EB] text-[#4B5563] font-bold rounded-[10px] hover:bg-white hover:text-[#111827] transition-all text-[14px] bg-white shadow-sm shadow-black/5"
                        onClick={onBack}
                    >
                        {t('common:cancel')}
                    </button>
                    <button
                        className="px-10 h-[46px] bg-[#073318] text-white font-bold rounded-[10px] hover:bg-[#04200f] transition-all text-[14px] disabled:opacity-50 shadow-md shadow-[#073318]/10 min-w-[140px] whitespace-nowrap"
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                        ) : t('modules:save_group', 'Save Group')}
                    </button>
                </div>
            </div>
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #E5E7EB;
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #D1D5DB;
                }
            `}</style>
        </div>
    );
};

const isExpenseGroup = (group, groupsList) => {
    if (!group) return false;
    const name = group.group_name;
    if (name === 'Direct Expense' || name === 'Indirect Expense') {
        return true;
    }
    if (group.parent_id) {
        const parent = groupsList.find(g => g.id === group.parent_id);
        if (parent) {
            return isExpenseGroup(parent, groupsList);
        }
    }
    return false;
};

export default GroupForm;
