import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import categoryService from '../../../../services/masters/categoryService';
import SimpleTooltip from './SimpleTooltip';

const EditCategoryModal = ({ isOpen, onClose, data, onSuccess, onShowToast }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [categoryName, setCategoryName] = useState('');
    const [targetLevel, setTargetLevel] = useState('none'); // 'none', 'category', 'sub_category', 'sub_sub_category'
    const [parentCategory, setParentCategory] = useState(null);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [dropdownCategories, setDropdownCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const parentDropdownRef = useRef(null);

    const currentType = data?.type; // 'category', 'sub_category', 'sub_sub_category'
    const isCategory = currentType === 'category';
    const isSubCategory = currentType === 'sub_category';
    const isSubSubCategory = currentType === 'sub_sub_category';

    const hasSubCategories = data?.sub_categories?.length > 0;
    const hasSubSubCategories = data?.sub_sub_categories?.length > 0;
    const hasAnyChildren = hasSubCategories || hasSubSubCategories;

    useEffect(() => {
        if (isOpen && data) {
            setCategoryName(data.name || '');
            setTargetLevel('none');
            setParentCategory(null);
            setIsParentDropdownOpen(false);

            // Set initial parent if not moving
            if (isSubCategory && (data.category_id || data.parent_id)) {
                fetchInitialParent('category', data.category_id || data.parent_id);
            } else if (isSubSubCategory && (data.sub_category_id || data.parent_id)) {
                fetchInitialParent('sub_category', data.sub_category_id || data.parent_id);
            }
        }
    }, [isOpen, data]);

    const fetchInitialParent = async (type, id) => {
        if (!id) return;
        try {
            const allData = await categoryService.getCategories();
            if (type === 'category') {
                const parent = allData.find(c => Number(c.id) === Number(id));
                if (parent) setParentCategory({ id: parent.id, name: parent.name });
            } else {
                const allSubs = allData.flatMap(cat =>
                    (cat.sub_categories || []).map(sub => ({ ...sub, categoryName: cat.name }))
                );
                const parent = allSubs.find(s => Number(s.id) === Number(id));
                if (parent) setParentCategory({ id: parent.id, name: parent.name, categoryName: parent.categoryName });
            }
        } catch (err) {
            console.error('Error fetching initial parent:', err);
        }
    };

    const numSubCategories = data?.sub_categories?.length || 0;
    const hasDeepChildren = (data?.sub_categories || []).some(sub => (sub.sub_sub_categories || []).length > 0);

    const isCategoryMoveToSubBlocked = numSubCategories > 1 || hasDeepChildren;
    const isCategoryMoveToSubSubBlocked = numSubCategories > 0;

    const fetchDropdownData = async () => {
        try {
            if (targetLevel === 'sub_category') {
                const dropdownData = await categoryService.getCategoriesDropdown(isCategory ? data.id : null);
                setDropdownCategories(dropdownData || []);
            } else if (targetLevel === 'sub_sub_category') {
                const allData = await categoryService.getCategories();
                const filteredData = isCategory ? allData.filter(cat => Number(cat.id) !== Number(data.id)) : allData;
                const allSubs = filteredData.flatMap(cat =>
                    (cat.sub_categories || []).map(sub => ({ ...sub, categoryName: cat.name }))
                );
                setDropdownCategories(allSubs);
            }
        } catch (err) {
            console.error('Error fetching dropdown data:', err);
        }
    };

    useEffect(() => {
        if (targetLevel !== 'none') {
            setParentCategory(null);
            fetchDropdownData();
        }
    }, [targetLevel]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target)) {
                setIsParentDropdownOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCategories = searchTerm
        ? dropdownCategories.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : dropdownCategories;

    const handleSave = async () => {
        const trimmedName = categoryName.trim();
        if (!trimmedName) {
            onShowToast && onShowToast(t('modules:name_required', 'Name is required'), 'error');
            return;
        }

        const isMoving = targetLevel !== 'none';

        // Validation for parent
        if (isMoving) {
            if (targetLevel !== 'category' && !parentCategory) {
                onShowToast && onShowToast(t('modules:parent_required', 'Parent selection is required'), 'error');
                return;
            }
        } else {
            // Updating existing without moving level
            if ((isSubCategory || isSubSubCategory) && !parentCategory) {
                onShowToast && onShowToast(t('modules:parent_required', 'Parent selection is required'), 'error');
                return;
            }
        }

        setIsLoading(true);
        try {
            if (isMoving) {
                // MOVE LOGIC
                if (isCategory) {
                    if (targetLevel === 'sub_category') {
                        await categoryService.demoteCategory(data.id, parentCategory.id);
                    } else if (targetLevel === 'sub_sub_category') {
                        await categoryService.demoteCategoryToSubSub(data.id, parentCategory.id);
                    }
                } else if (isSubCategory) {
                    if (targetLevel === 'category') {
                        await categoryService.promoteSubCategory(data.id);
                    } else if (targetLevel === 'sub_sub_category') {
                        await categoryService.demoteSubCategoryToSubSub(data.id, parentCategory.id);
                    }
                } else if (isSubSubCategory) {
                    if (targetLevel === 'category') {
                        await categoryService.promoteSubSubToCategory(data.id);
                    } else if (targetLevel === 'sub_category') {
                        await categoryService.promoteSubSubToSub(data.id, parentCategory.id);
                    }
                }
                onShowToast && onShowToast(t('modules:moved_successfully', 'Category level changed successfully'));
            } else {
                // UPDATE LOGIC (Same Level)
                if (isCategory) {
                    await categoryService.updateCategory(data.id, { name: trimmedName });
                } else if (isSubCategory) {
                    await categoryService.updateSubCategory(data.id, { name: trimmedName, category_id: parentCategory.id });
                } else if (isSubSubCategory) {
                    await categoryService.updateSubSubCategory(data.id, { name: trimmedName, sub_category_id: parentCategory.id });
                }
                onShowToast && onShowToast(t('modules:updated_successfully', 'Updated successfully'));
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
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-[440px] transform transition-all duration-300 ease-in-out animate-in zoom-in-95 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-emerald-800 bg-emerald-900 text-white">
                    <h2 className="text-[18px] font-bold tracking-tight">
                        {isSubSubCategory ? t('modules:edit_sub_sub_category') : isSubCategory ? t('modules:edit_sub_category') : t('modules:edit_category')}
                    </h2>
                    <button onClick={onClose} className="p-1 text-emerald-100 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto dropdown-scrollbar">
                    {/* Name Input */}
                    <div className="space-y-2">
                        <label className="text-[13px] font-semibold text-[#4B5563]">
                            {isSubSubCategory ? t('modules:sub_sub_category_name') : isSubCategory ? t('modules:sub_category_name') : t('modules:category_name')}
                        </label>
                        <input
                            type="text"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            disabled={targetLevel !== 'none'}
                            placeholder={t('modules:enter_name')}
                            className={`w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-medium transition-all ${targetLevel !== 'none' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5'}`}
                        />
                        {targetLevel !== 'none' && (
                            <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                                <AlertCircle size={12} /> {t('modules:name_freeze_during_move', 'Name edit disabled while relocating')}
                            </p>
                        )}
                    </div>

                    {/* Move Level Selection */}
                    <div className="space-y-3">
                        <label className="text-[13px] font-semibold text-[#4B5563]">
                            {t('modules:relocate_hierarchy', 'Relocate Hierarchy')}
                        </label>

                        <div className="grid grid-cols-1 gap-2">
                            {/* Option: Current Level (None/Reset) */}
                            <label className={`flex items-center gap-3 p-4 rounded-[12px] border cursor-pointer transition-all duration-200 ${targetLevel === 'none' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                <input type="radio" name="targetLevel" checked={targetLevel === 'none'} onChange={() => setTargetLevel('none')} className="sr-only" />
                                <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'none' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                    <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'none' ? 'opacity-100' : 'opacity-0'}`} />
                                </div>
                                <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'none' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                    {t('modules:keep_current_level', 'Keep Current Level')}
                                </span>
                            </label>

                            {/* Option: To Category (if not already) */}
                            {!isCategory && (
                                <label className={`flex items-center gap-3 p-4 rounded-[12px] border cursor-pointer transition-all duration-200 ${targetLevel === 'category' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                    <input type="radio" name="targetLevel" checked={targetLevel === 'category'} onChange={() => setTargetLevel('category')} className="sr-only" />
                                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'category' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                        <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'category' ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'category' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                            {t('modules:move_to_category', 'Move to Category')}
                                        </span>
                                        <SimpleTooltip message="Move to Category → Bring this to top level" />
                                    </div>
                                </label>
                            )}

                            {/* Option: To Sub-Category (if not already) */}
                            {!isSubCategory && (
                                <label className={`flex items-center gap-3 p-4 rounded-[12px] border transition-all duration-200 ${isCategory && isCategoryMoveToSubBlocked ? 'bg-gray-50/80 border-gray-200 opacity-60 cursor-not-allowed grayscale-[0.4]' : 'cursor-pointer'} ${targetLevel === 'sub_category' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                    <input type="radio" name="targetLevel" checked={targetLevel === 'sub_category'} disabled={isCategory && isCategoryMoveToSubBlocked} onChange={() => setTargetLevel('sub_category')} className="sr-only" />
                                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'sub_category' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                        <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'sub_category' ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'sub_category' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                            {t('modules:move_to_subcategory', 'Move to Sub-Category')}
                                        </span>
                                        <SimpleTooltip message={isCategory && isCategoryMoveToSubBlocked ? "Cannot move. It has items inside." : "Move to SubCategory → Place this under another category"} />
                                    </div>
                                    {(isCategory && isCategoryMoveToSubBlocked) && (
                                        <div className="ml-auto flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                            <AlertCircle size={14} />
                                            <span className="text-[10px] font-bold">LOCKED</span>
                                        </div>
                                    )}
                                </label>
                            )}

                            {/* Option: To Sub-SubCategory (if not already) */}
                            {!isSubSubCategory && (
                                <label className={`flex items-center gap-3 p-4 rounded-[12px] border transition-all duration-200 ${isCategory ? (isCategoryMoveToSubSubBlocked ? 'bg-gray-50/80 border-gray-200 opacity-60 cursor-not-allowed grayscale-[0.4]' : 'cursor-pointer') : (hasSubSubCategories ? 'bg-gray-50/80 border-gray-200 opacity-60 cursor-not-allowed grayscale-[0.4]' : 'cursor-pointer')} ${targetLevel === 'sub_sub_category' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                    <input type="radio" name="targetLevel" checked={targetLevel === 'sub_sub_category'} disabled={isCategory ? isCategoryMoveToSubSubBlocked : hasSubSubCategories} onChange={() => setTargetLevel('sub_sub_category')} className="sr-only" />
                                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'sub_sub_category' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                        <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'sub_sub_category' ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'sub_sub_category' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                            {t('modules:move_to_sub_sub', 'Move to Sub-SubCategory')}
                                        </span>
                                        <SimpleTooltip message={(isCategory ? isCategoryMoveToSubSubBlocked : hasSubSubCategories) ? "Cannot move. It has items inside." : "Move to SubSubCategory → Place this under a subcategory"} />
                                    </div>
                                    {(isCategory ? isCategoryMoveToSubSubBlocked : hasSubSubCategories) && (
                                        <div className="ml-auto flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                            <AlertCircle size={14} />
                                            <span className="text-[10px] font-bold">LOCKED</span>
                                        </div>
                                    )}
                                </label>
                            )}
                        </div>

                        {/* Product restriction warning for leaf-to-root promotion */}
                        {isSubSubCategory && targetLevel === 'category' && data.products?.length > 0 && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                                <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-amber-700 leading-tight">
                                    {t('modules:promote_l3_restriction', 'Converting this to a Category will orphan its products as they require a SubCategory parent. Please move products first.')}
                                </p>
                            </div>
                        )}

                        {(isCategory && numSubCategories > 1) && targetLevel !== 'none' && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-red-600 leading-tight font-medium">
                                    {t('modules:category_move_blocked_multiple', 'Cannot move. It has items inside.')}
                                </p>
                            </div>
                        )}

                        {(isSubCategory && hasSubSubCategories && targetLevel === 'sub_sub_category') && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-red-600 leading-tight font-medium">
                                    {t('modules:items_inside_restriction', 'Cannot move. It has items inside.')}
                                </p>
                            </div>
                        )}

                        {(isCategory && numSubCategories === 1 && targetLevel === 'sub_sub_category') && (
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                                <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-amber-700 leading-tight">
                                    {t('modules:category_move_l2_only', 'Please select a valid place')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Dynamic Parent Dropdown */}
                    {(targetLevel !== 'category' && (targetLevel !== 'none' || (isSubCategory || isSubSubCategory))) && (
                        <div className="space-y-2 relative" ref={parentDropdownRef}>
                            <label className="text-[13px] font-semibold text-[#4B5563]">
                                {targetLevel === 'sub_category' || (targetLevel === 'none' && isSubCategory)
                                    ? t('modules:move_under_category', 'Move this under a category')
                                    : t('modules:move_under_sub_desc', 'Move this under a subcategory')}
                            </label>
                            <div
                                className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 cursor-pointer transition-all ${isParentDropdownOpen ? 'border-emerald-600 ring-4 ring-emerald-600/5' : 'border-[#E5E7EB] bg-white group'}`}
                                onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                            >
                                {isParentDropdownOpen ? (
                                    <input
                                        type="text" autoFocus
                                        placeholder={parentCategory?.name || t('common:search')}
                                        className="w-full bg-transparent outline-none text-[14px] font-medium"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className={`text-[14px] ${parentCategory ? 'text-[#111827] font-medium' : 'text-gray-400 italic'}`}>
                                        {parentCategory ? parentCategory.name : t('common:select_option')}
                                    </span>
                                )}
                                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isParentDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isParentDropdownOpen && (
                                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 max-h-[200px] overflow-y-auto dropdown-scrollbar animate-in fade-in slide-in-from-top-2">
                                    {filteredCategories.length > 0 ? (
                                        filteredCategories.map((cat) => (
                                            <div
                                                key={cat.id}
                                                className={`px-4 py-2 text-[14px] cursor-pointer hover:bg-emerald-50 transition-colors ${parentCategory?.id === cat.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-600'}`}
                                                onClick={() => {
                                                    setParentCategory(cat);
                                                    setIsParentDropdownOpen(false);
                                                    setSearchTerm('');
                                                }}
                                            >
                                                {cat.name} {cat.categoryName && <span className="text-[11px] text-gray-400 ml-1">({cat.categoryName})</span>}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-[12px] text-gray-400 text-center italic">{t('common:no_results')}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 pt-4">
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="flex-1 h-[48px] rounded-[12px] bg-emerald-900 text-white text-[15px] font-bold hover:bg-emerald-950 transition-all flex items-center justify-center shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : t('common:save')}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-[100px] h-[48px] border border-[#E5E7EB] rounded-[12px] text-[15px] font-bold hover:bg-gray-50 transition-all"
                        >
                            {t('common:cancel')}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .animate-in { animation-duration: 300ms; animation-fill-mode: forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes slideInTop { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .fade-in { animation-name: fadeIn; }
                .zoom-in-95 { animation-name: zoomIn; }
                .slide-in-from-top-2 { animation-name: slideInTop; }
                .dropdown-scrollbar::-webkit-scrollbar { width: 4px; }
                .dropdown-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default EditCategoryModal;
