import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import categoryService from '../../../../services/masters/categoryService';

const EditCategoryModal = ({ isOpen, onClose, data, onSuccess, onShowToast }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [categoryName, setCategoryName] = useState('');
    const [parentCategory, setParentCategory] = useState(null);
    const [subCategory, setSubCategory] = useState(null);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
    const [dropdownCategories, setDropdownCategories] = useState([]);
    const [dropdownSubCategories, setDropdownSubCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPromotingToCategory, setIsPromotingToCategory] = useState(false);
    const [demoteLevel, setDemoteLevel] = useState(null); // null, 'sub_category', 'sub_sub_category'
    const [targetLevel, setTargetLevel] = useState('');
    const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
    const parentDropdownRef = useRef(null);
    const subDropdownRef = useRef(null);
    const levelDropdownRef = useRef(null);

    const isSubCategory = data?.type === 'sub_category';
    const isSubSubCategory = data?.type === 'sub_sub_category';
    const hasSubCategories = !isSubCategory && !isSubSubCategory && data?.items?.length > 0;
    const hasSubSubCategories = isSubCategory && data?.items?.length > 0;

    useEffect(() => {
        if (isOpen && data) {
            setCategoryName(data.name || '');
            setIsPromotingToCategory(false);
            setDemoteLevel(null);
            setParentCategory(null);
            setSubCategory(null);
            setDropdownSubCategories([]);
            setTargetLevel(data.type);
            setIsLevelDropdownOpen(false);
            fetchDropdownData();
        }
    }, [isOpen, data]);

    const fetchDropdownData = async () => {
        try {
            // excludeId is current category id to prevent self-parent selection
            const dropdownData = await categoryService.getCategoriesDropdown(data.type === 'category' ? data.id : null);
            setDropdownCategories(dropdownData || []);

            if (isSubCategory) {
                const pId = data.category_id || data.parent_id || data.parentId;
                if (pId) {
                    const parent = dropdownData?.find(c => Number(c.id) === Number(pId));
                    if (parent) setParentCategory(parent);
                }
            } else if (isSubSubCategory) {
                const gpId = data.grandParentId;
                const pId = data.sub_category_id || data.parentId;

                if (gpId) {
                    const grandParent = dropdownData?.find(c => Number(c.id) === Number(gpId));
                    if (grandParent) {
                        setParentCategory(grandParent);
                        const subs = await categoryService.getSubCategoriesDropdown(gpId);
                        setDropdownSubCategories(subs || []);
                        const parent = subs?.find(s => Number(s.id) === Number(pId));
                        if (parent) setSubCategory(parent);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target)) {
                setIsParentDropdownOpen(false);
            }
            if (subDropdownRef.current && !subDropdownRef.current.contains(event.target)) {
                setIsSubDropdownOpen(false);
            }
            if (levelDropdownRef.current && !levelDropdownRef.current.contains(event.target)) {
                setIsLevelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCategories = searchTerm
        ? dropdownCategories.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : dropdownCategories;

    const handleSave = async () => {
        if (!categoryName.trim()) {
            onShowToast && onShowToast(isSubCategory ? t('modules:sub_category_name_required') : t('modules:category_name_required'), 'error');
            return;
        }

        if (isSubCategory && !parentCategory && !isPromotingToCategory) {
            onShowToast && onShowToast(t('modules:parent_category_required', 'Please select a parent category'), 'error');
            return;
        }

        if (isSubSubCategory && targetLevel === 'sub_sub_category' && (!parentCategory || !subCategory)) {
            onShowToast && onShowToast(t('modules:parent_sub_category_required', 'Please select a parent sub category'), 'error');
            return;
        }

        if (isSubSubCategory && targetLevel === 'sub_category' && !parentCategory) {
            onShowToast && onShowToast(t('modules:parent_category_required', 'Please select a parent category'), 'error');
            return;
        }

        if (!isSubCategory && !isSubSubCategory && demoteLevel === 'sub_category' && !parentCategory) {
            onShowToast && onShowToast(t('modules:please_select_parent_category', 'Please select a parent category'), 'error');
            return;
        }

        if (!isSubCategory && !isSubSubCategory && demoteLevel === 'sub_sub_category' && (!parentCategory || !subCategory)) {
            onShowToast && onShowToast(t('modules:please_select_parent_sub_category', 'Please select a parent sub category'), 'error');
            return;
        }

        setIsLoading(true);
        try {
            if (isSubSubCategory && targetLevel !== 'sub_sub_category') {
                const confirmed = window.confirm(t('modules:confirm_level_change', 'Are you sure you want to change hierarchy level?'));
                if (!confirmed) {
                    setIsLoading(false);
                    return;
                }

                await categoryService.promoteSubSubCategory(
                    data.id,
                    targetLevel === 'category' ? 'category' : 'sub_category',
                    parentCategory?.id
                );
                onShowToast && onShowToast(t('modules:level_changed_successfully', 'Hierarchy level changed successfully'));
            } else if (isSubCategory) {
                if (isPromotingToCategory) {
                    await categoryService.promoteSubCategory(data.id);
                    onShowToast && onShowToast(`${categoryName} moved to category successfully.`);
                } else {
                    await categoryService.updateSubCategory(data.id, {
                        name: categoryName,
                        category_id: parentCategory.id
                    });
                    onShowToast && onShowToast(t('modules:sub_category_updated_successfully'));
                }
            } else if (isSubSubCategory) {
                await categoryService.updateSubSubCategory(data.id, {
                    name: categoryName,
                    sub_category_id: subCategory.id
                });
                onShowToast && onShowToast(t('modules:sub_sub_category_updated_successfully', 'Sub Sub Category updated successfully'));
            } else {
                if (demoteLevel === 'sub_category') {
                    await categoryService.demoteCategory(data.id, parentCategory.id);
                    onShowToast && onShowToast(`${categoryName} moved to sub-category successfully.`);
                } else if (demoteLevel === 'sub_sub_category') {
                    await categoryService.demoteCategoryToSubSubCategory(data.id, subCategory.id);
                    onShowToast && onShowToast(`${categoryName} moved to sub-sub-category successfully.`);
                } else {
                    await categoryService.updateCategory(data.id, { name: categoryName });
                    onShowToast && onShowToast(t('modules:category_updated_successfully'));
                }
            }
            onSuccess();
            onClose();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Operation failed';
            onShowToast && onShowToast(errorMsg, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-[440px] transform transition-all duration-300 ease-in-out animate-in zoom-in-95">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-[#04200f] bg-emerald-900 rounded-t-[20px]">
                    <h2 className="text-[18px] font-bold text-white tracking-tight">
                        {isSubCategory ? t('modules:edit_sub_category', 'Edit Sub Category') :
                            isSubSubCategory ? t('modules:edit_sub_sub_category', 'Edit Sub Sub Category') :
                                t('modules:edit_category', 'Edit Category')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-emerald-100 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    {/* Name Input */}
                    <div className="space-y-2">
                        <label className="text-[13px] font-semibold text-[#4B5563]">
                            {isSubCategory ? t('modules:sub_category_name') :
                                isSubSubCategory ? t('modules:sub_sub_category_name', 'Sub Sub Category Name') :
                                    t('modules:category_name')}
                        </label>
                        <input
                            type="text"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            disabled={isPromotingToCategory || !!demoteLevel}
                            placeholder={isSubCategory ? t('modules:enter_sub_category_name') :
                                isSubSubCategory ? t('modules:enter_sub_sub_category_name', 'Enter Sub Sub Category Name') :
                                    t('modules:enter_category_name')}
                            className={`w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-medium outline-none transition-all placeholder:text-gray-400 ${isPromotingToCategory || demoteLevel ? 'bg-gray-50 text-gray-400' : 'focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5'}`}
                        />
                    </div>

                    {/* Change Level for SubSubCategory */}
                    {isSubSubCategory && (
                        <div className="space-y-2 relative" ref={levelDropdownRef}>
                            <label className="text-[13px] font-semibold text-[#4B5563]">{t('modules:change_level', 'Change Level')}</label>
                            <div
                                className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 cursor-pointer transition-all ${isLevelDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300 bg-white'}`}
                                onClick={() => setIsLevelDropdownOpen(!isLevelDropdownOpen)}
                            >
                                <span className="text-[14px] text-[#111827] font-medium">
                                    {targetLevel === 'category' ? t('modules:category') :
                                        targetLevel === 'sub_category' ? t('modules:sub_category') :
                                            t('modules:sub_sub_category', 'Sub Sub Category')}
                                </span>
                                <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isLevelDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isLevelDropdownOpen && (
                                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {[
                                        { id: 'category', label: t('modules:category') },
                                        { id: 'sub_category', label: t('modules:sub_category') },
                                        { id: 'sub_sub_category', label: t('modules:sub_sub_category', 'Sub Sub Category') }
                                    ].map((opt) => (
                                        <div
                                            key={opt.id}
                                            className={`px-4 py-3 text-[14px] cursor-pointer transition-colors ${targetLevel === opt.id ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                            onClick={() => {
                                                setTargetLevel(opt.id);
                                                setIsLevelDropdownOpen(false);
                                            }}
                                        >
                                            {opt.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {(isSubCategory || isSubSubCategory) && (
                        <>
                            {/* Parent Selection */}
                            <div className={`space-y-2 relative transition-all duration-300 ${(isPromotingToCategory || (isSubSubCategory && targetLevel === 'category')) ? 'opacity-30 pointer-events-none grayscale' : ''}`} ref={parentDropdownRef}>
                                <label className="text-[13px] font-semibold text-[#4B5563]">{t('modules:category_under')}</label>
                                <div
                                    className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 cursor-pointer transition-all ${isParentDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300 bg-white'}`}
                                    onClick={() => (targetLevel !== 'category' && !isPromotingToCategory) && setIsParentDropdownOpen(!isParentDropdownOpen)}
                                >
                                    <span className={`text-[14px] ${parentCategory ? 'text-[#111827] font-medium' : 'text-gray-400 italic'}`}>
                                        {parentCategory ? parentCategory.name : t('modules:select_category')}
                                    </span>
                                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isParentDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isParentDropdownOpen && (
                                    <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 max-h-[160px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                        {dropdownCategories.map((cat) => (
                                            <div
                                                key={cat.id}
                                                className={`px-4 py-3 text-[14px] cursor-pointer transition-colors ${parentCategory?.id === cat.id ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                                onClick={async () => {
                                                    setParentCategory(cat);
                                                    setSubCategory(null);
                                                    setIsParentDropdownOpen(false);
                                                    if (isSubSubCategory) {
                                                        const subs = await categoryService.getSubCategoriesDropdown(cat.id);
                                                        setDropdownSubCategories(subs || []);
                                                    }
                                                }}
                                            >
                                                {cat.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {isSubSubCategory && targetLevel === 'sub_sub_category' && (
                                <div className="space-y-2 relative" ref={subDropdownRef}>
                                    <label className="text-[13px] font-semibold text-[#4B5563]">{t('modules:sub_category_under', 'Sub Category Under')}</label>
                                    <div
                                        className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 transition-all ${!parentCategory ? 'bg-gray-50 cursor-not-allowed border-[#E5E7EB]' : 'cursor-pointer hover:border-gray-300 bg-white'} ${isSubDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB]'}`}
                                        onClick={() => parentCategory && setIsSubDropdownOpen(!isSubDropdownOpen)}
                                    >
                                        <span className={`text-[14px] ${subCategory ? 'text-[#111827] font-medium' : 'text-gray-400'}`}>
                                            {subCategory ? subCategory.name : t('modules:select_sub_category', 'Select Sub Category')}
                                        </span>
                                        <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isSubDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isSubDropdownOpen && (
                                        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 max-h-[160px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                            {dropdownSubCategories.length > 0 ? (
                                                dropdownSubCategories.map((sub) => (
                                                    <div
                                                        key={sub.id}
                                                        className={`px-4 py-3 text-[14px] cursor-pointer transition-colors ${subCategory?.id === sub.id ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                                        onClick={() => {
                                                            setSubCategory(sub);
                                                            setIsSubDropdownOpen(false);
                                                        }}
                                                    >
                                                        {sub.name}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-[13px] text-gray-400 italic">No sub categories found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {isSubCategory && (
                                <div className="pt-2">
                                    <label
                                        className={`flex items-center gap-3 cursor-pointer group p-3 rounded-[12px] border transition-all ${hasSubSubCategories ? 'bg-red-50/50 border-red-100' : isPromotingToCategory ? 'bg-[#073318]/5 border-[#073318]/20 ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300'}`}
                                        onClick={() => {
                                            if (hasSubSubCategories) {
                                                onShowToast && onShowToast(`${data.name} has sub-sub-categories.`, 'error');
                                            }
                                        }}
                                    >
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                className="peer sr-only"
                                                checked={isPromotingToCategory}
                                                disabled={hasSubSubCategories}
                                                onChange={(e) => setIsPromotingToCategory(e.target.checked)}
                                            />
                                            <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center ${isPromotingToCategory ? 'bg-[#073318] border-[#073318]' : 'border-gray-200 group-hover:border-gray-300 bg-white'}`}>
                                                <Check size={14} className={`text-white transition-opacity ${isPromotingToCategory ? 'opacity-100' : 'opacity-0'}`} />
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-[13px] font-bold transition-colors ${isPromotingToCategory ? 'text-[#073318]' : 'text-gray-700'}`}>
                                                {t('modules:do_you_want_to_move_to_category', 'Do you want to move to Category')}
                                            </span>
                                            <span className={`text-[11px] font-medium ${hasSubSubCategories ? 'text-red-500' : 'text-gray-400'}`}>
                                                {hasSubSubCategories
                                                    ? t('modules:cannot_promote_because_subsubcats_exist', 'This sub-category cannot be moved to category because it already contains sub-sub-categories.')
                                                    : isPromotingToCategory ? t('modules:promotion_warning', 'This will convert this sub-category into a main category.') : t('modules:promotion_hint', 'Check to promote to top-level category')}
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </>
                    )}

                    {!isSubCategory && !isSubSubCategory && (
                        <div className="space-y-4 pt-2">
                            {/* Move Level Selection Dropdown */}
                            <div className={`p-4 rounded-[16px] border transition-all ${hasSubCategories ? 'bg-red-50/50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[13px] font-bold ${hasSubCategories ? 'text-red-500' : 'text-gray-700'}`}>
                                            {t('modules:change_hierarchy_level', 'Change Hierarchy Level')}
                                        </span>
                                        {hasSubCategories && (
                                            <span className="text-[10px] font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full uppercase">
                                                {t('modules:blocked', 'Blocked')}
                                            </span>
                                        )}
                                    </div>

                                    {hasSubCategories ? (
                                        <p className="text-[11px] text-red-500 font-medium">
                                            {t('modules:cannot_move_category_with_subs', 'Category cannot be moved because it has SubCategories')}
                                        </p>
                                    ) : (
                                        <div className="flex gap-2">
                                            {[
                                                { id: null, label: t('modules:keep_as_is', 'No Change') },
                                                { id: 'sub_category', label: t('modules:to_sub_category', 'Sub Category') },
                                                { id: 'sub_sub_category', label: t('modules:to_sub_sub_category', 'Sub-SubCategory') }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => {
                                                        setDemoteLevel(opt.id);
                                                        setParentCategory(null);
                                                        setSubCategory(null);
                                                    }}
                                                    className={`flex-1 py-2 px-3 rounded-[10px] text-[12px] font-bold transition-all border ${demoteLevel === opt.id ? 'bg-[#073318] text-white border-[#073318]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Parent Selection when Demoting */}
                            {demoteLevel && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2 relative" ref={parentDropdownRef}>
                                        <label className="text-[13px] font-semibold text-[#4B5563]">{t('modules:category_under', 'Category Under')}</label>
                                        <div
                                            className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 cursor-pointer transition-all ${isParentDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300 bg-white'}`}
                                            onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                                        >
                                            {isParentDropdownOpen ? (
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder={parentCategory?.name || t('modules:select_category')}
                                                    className="w-full bg-transparent outline-none text-[14px] font-medium"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className={`text-[14px] ${parentCategory ? 'text-[#111827] font-medium' : 'text-gray-400 italic'}`}>
                                                    {parentCategory ? parentCategory.name : t('modules:select_category')}
                                                </span>
                                            )}
                                            <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isParentDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isParentDropdownOpen && (
                                            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 max-h-[224px] overflow-y-auto dropdown-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                                                {filteredCategories.length > 0 ? (
                                                    filteredCategories.map((cat) => (
                                                        <div
                                                            key={cat.id}
                                                            className={`px-4 py-3 text-[14px] cursor-pointer transition-colors ${parentCategory?.id === cat.id ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                                            onClick={async () => {
                                                                setParentCategory(cat);
                                                                setSubCategory(null);
                                                                setIsParentDropdownOpen(false);
                                                                setSearchTerm('');
                                                                if (demoteLevel === 'sub_sub_category') {
                                                                    const subs = await categoryService.getSubCategoriesDropdown(cat.id);
                                                                    setDropdownSubCategories(subs || []);
                                                                }
                                                            }}
                                                        >
                                                            {cat.name}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-[12px] text-gray-400 text-center italic">
                                                        {t('common:no_results_found')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {demoteLevel === 'sub_sub_category' && (
                                        <div className="space-y-2 relative animate-in fade-in slide-in-from-top-2 duration-300" ref={subDropdownRef}>
                                            <label className="text-[13px] font-semibold text-[#4B5563]">{t('modules:sub_category_under', 'Sub Category Under')}</label>
                                            <div
                                                className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 transition-all ${!parentCategory ? 'bg-gray-50 cursor-not-allowed border-[#E5E7EB]' : 'cursor-pointer hover:border-gray-300 bg-white'} ${isSubDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB]'}`}
                                                onClick={() => parentCategory && setIsSubDropdownOpen(!isSubDropdownOpen)}
                                            >
                                                <span className={`text-[14px] ${subCategory ? 'text-[#111827] font-medium' : 'text-gray-400 italic'}`}>
                                                    {subCategory ? subCategory.name : t('modules:select_sub_category', 'Select Sub Category')}
                                                </span>
                                                <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isSubDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {isSubDropdownOpen && (
                                                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 max-h-[160px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                                    {dropdownSubCategories.length > 0 ? (
                                                        dropdownSubCategories.map((sub) => (
                                                            <div
                                                                key={sub.id}
                                                                className={`px-4 py-3 text-[14px] cursor-pointer transition-colors ${subCategory?.id === sub.id ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                                                onClick={() => {
                                                                    setSubCategory(sub);
                                                                    setIsSubDropdownOpen(false);
                                                                }}
                                                            >
                                                                {sub.name}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="px-4 py-3 text-[13px] text-gray-400 italic">No sub categories found</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className={`flex-1 h-[48px] rounded-[12px] text-[15px] font-bold transition-all flex items-center justify-center gap-2 shadow-md ${isPromotingToCategory || demoteLevel ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-[#073318] hover:bg-[#04200f] shadow-[#073318]/20'} text-white hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : t('common:save')}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-[100px] h-[48px] border border-[#E5E7EB] text-[#4B5563] rounded-[12px] text-[15px] font-bold hover:bg-gray-50 transition-all bg-white"
                        >
                            {t('common:exit')}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .animate-in {
                    animation-duration: 300ms;
                    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                    animation-fill-mode: forwards;
                }
                .zoom-in-95 {
                    animation-name: zoomIn;
                }
                .fade-in {
                    animation-name: fadeIn;
                }
                .slide-in-from-top-2 {
                    animation-name: slideInTop;
                }
                @keyframes zoomIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideInTop {
                    from { transform: translateY(-8px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .dropdown-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .dropdown-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .dropdown-scrollbar::-webkit-scrollbar-thumb {
                    background: #E5E7EB;
                    border-radius: 10px;
                }
                .dropdown-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #D1D5DB;
                }
            `}</style>
        </div>
    );
};

export default EditCategoryModal;
