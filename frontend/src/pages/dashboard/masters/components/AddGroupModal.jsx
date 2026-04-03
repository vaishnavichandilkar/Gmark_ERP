import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import masterService from '../../../../services/masterService';
import { translateDynamic } from '../../../../utils/i18nUtils';

const AddGroupModal = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [isVisible, setIsVisible] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [allGroups, setAllGroups] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const modalRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchDropdownGroups();
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
            setGroupName('');
            setSelectedGroup(null);
            setError('');
            setSearchQuery('');
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

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
        if (!groupName.trim()) {
            setError(t('modules:group_required') || 'Group name is required');
            return;
        }
        if (!selectedGroup) {
            setError(t('modules:parent_group_required') || 'Parent group is required');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const response = await masterService.createGroup({
                group_name: groupName,
                parent_id: selectedGroup.id
            });

            if (response.success) {
                onSuccess();
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || t('common:error_occurred'));
        } finally {
            setIsLoading(false);
        }
    };

    const filteredGroups = allGroups.filter(g =>
        g.group_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isVisible && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            <div
                ref={modalRef}
                className={`bg-white w-full max-w-[440px] rounded-[16px] shadow-2xl transition-all duration-300 transform ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[#F3F4F6]">
                    <h2 className="text-[18px] font-bold text-[#111827] tracking-tight">{t('modules:add_group')}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#111827] hover:bg-gray-100 rounded-full transition-all">
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-[13px] rounded-[8px] border border-red-100 animate-in fade-in duration-300">
                            {error}
                        </div>
                    )}
                    
                    {/* Group Input */}
                    <div className="space-y-2">
                        <label className="text-[13px] font-bold text-[#4B5563]">
                            {t('common:group')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder={t('common:enter_group_text')}
                            className={`w-full h-[46px] border rounded-[10px] px-4 outline-none transition-all placeholder:text-[#9CA3AF] text-[14px] text-[#111827] bg-[#F9FAFB] hover:bg-white
                                ${error && !groupName.trim() ? 'border-red-300 bg-red-50/30' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5'}`}
                        />
                    </div>

                    {/* Group Under Dropdown */}
                    <div className="space-y-2 pb-2">
                        <label className="text-[13px] font-bold text-[#4B5563]">
                            {t('common:group_under')} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative" ref={dropdownRef}>
                            <div
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={`w-full h-[46px] border ${isDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300'} 
                                    ${error && !selectedGroup ? 'border-red-300 bg-red-50/30' : ''}
                                    rounded-[10px] px-4 flex items-center justify-between cursor-pointer transition-all bg-[#F9FAFB] hover:bg-white`}
                            >
                                <div className="flex items-center overflow-hidden">
                                    {selectedGroup ? (
                                        <>
                                            {selectedGroup.level === 1 && selectedGroup.is_header && <span className="mr-2">📁</span>}
                                            {selectedGroup.level > 1 && <span className="text-gray-400 mr-2">↳</span>}
                                            <span className={`text-[14px] truncate ${selectedGroup.level === 1 && selectedGroup.is_header ? 'font-bold text-[#111827]' : 'text-[#111827]'}`}>
                                                {translateDynamic(selectedGroup.group_name, t)}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-[14px] text-[#9CA3AF]">{t('common:select_group_under')}</span>
                                    )}
                                </div>
                                <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : 'rotate-0'}`} />
                            </div>

                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-[#E5E7EB] rounded-[10px] shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    {/* Search inside dropdown */}
                                    <div className="p-2 border-b border-[#F3F4F6]">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder={t('common:search_groups') || "Search groups..."}
                                                className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] pl-8 pr-3 text-[13px] outline-none focus:border-[#073318] transition-all"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>

                                    <div className="max-h-[220px] overflow-y-auto py-1.5 px-1.5">
                                        {filteredGroups.length > 0 ? (
                                            filteredGroups.map((group) => {
                                                const isHeader = group.level === 1 && group.is_header;
                                                const indentation = (group.level - 1) * 12;

                                                return (
                                                    <div
                                                        key={group.id}
                                                        onClick={() => {
                                                            setSelectedGroup(group);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className={`px-3 py-2.5 rounded-[8px] hover:bg-gray-50 cursor-pointer text-[13px] transition-all mb-0.5
                                                            ${selectedGroup?.id === group.id ? 'bg-gray-100 text-[#073318] font-bold' : 'text-[#4B5563] font-medium'}
                                                            ${isHeader ? 'mt-3 first:mt-0 font-bold border-t border-gray-50 pt-2.5' : ''}`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center overflow-hidden">
                                                                {!isHeader && (
                                                                    <>
                                                                        <span className="whitespace-pre text-transparent select-none">
                                                                            {' '.repeat(indentation)}
                                                                        </span>
                                                                        <span className="text-gray-500 mr-2 flex-shrink-0">↳</span>
                                                                    </>
                                                                )}
                                                                {isHeader && <span className="mr-2 flex-shrink-0 text-amber-600">📁</span>}
                                                                <span className={`truncate ${isHeader ? 'text-[#111827]' : 'text-[#4B5563]'}`}>
                                                                    {translateDynamic(group.group_name, t)}
                                                                </span>
                                                            </div>
                                                            {isHeader && (
                                                                <span className="text-[9px] bg-gray-100 text-[#6B7280] px-1.5 py-0.5 rounded font-bold tracking-wider flex-shrink-0 ml-2 border border-gray-200">
                                                                    {t('common:header') || 'HEADER'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="px-4 py-6 text-[13px] text-gray-400 text-center">{t('common:no_options_found')}</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F3F4F6]">
                        <button
                            className="px-6 h-[46px] border border-[#E5E7EB] text-[#4B5563] font-bold rounded-[10px] hover:bg-gray-50 hover:text-[#111827] transition-all text-[14px] bg-white shadow-sm"
                            onClick={onClose}
                        >
                            {t('common:cancel', 'Cancel')}
                        </button>
                        <button
                            className="px-10 h-[46px] bg-[#073318] text-white font-bold rounded-[10px] hover:bg-[#04200f] transition-all text-[14px] disabled:opacity-50 shadow-md min-w-[120px]"
                            onClick={handleSave}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : t('common:save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddGroupModal;
