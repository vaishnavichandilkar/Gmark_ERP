import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
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
    const [moveOptions, setMoveOptions] = useState(null);
    const parentDropdownRef = useRef(null);

    const currentType = data?.type; // 'category', 'sub_category', 'sub_sub_category'
    const isCategory = currentType === 'category';
    const isSubCategory = currentType === 'sub_category';
    const isSubSubCategory = currentType === 'sub_sub_category';

    useEffect(() => {
        if (isOpen && data) {
            setCategoryName(data.name || '');
            setTargetLevel('none');
            setParentCategory(null);
            setIsParentDropdownOpen(false);

            // Fetch move options and valid targets
            const fetchOptions = async () => {
                try {
                    const res = await categoryService.getMoveOptions(data.id);
                    setMoveOptions(res);

                    // Set initial parent if available
                    if (isSubCategory && data.category_id) {
                        const allParents = res.eligibleParents?.level1 || [];
                        const parent = allParents.find(p => p.id === data.category_id);
                        if (parent) setParentCategory(parent);
                    } else if (isSubSubCategory && data.sub_category_id) {
                        const allParents = res.eligibleParents?.level2 || [];
                        const parent = allParents.find(p => p.id === data.sub_category_id);
                        if (parent) setParentCategory(parent);
                    }
                } catch (err) {
                    console.error('Error fetching move options:', err);
                }
            };
            fetchOptions();
        }
    }, [isOpen, data]);

    useEffect(() => {
        if (moveOptions) {
            setParentCategory(null);
            if (targetLevel === 'none') {
                if (moveOptions.currentLevel === 2) {
                    setDropdownCategories(moveOptions.eligibleParents?.level1 || []);
                    // Restore initial parent
                    if (isSubCategory && data.category_id) {
                        const parent = moveOptions.eligibleParents?.level1?.find(p => p.id === data.category_id);
                        if (parent) setParentCategory(parent);
                    }
                } else if (moveOptions.currentLevel === 3) {
                    setDropdownCategories(moveOptions.eligibleParents?.level2 || []);
                    // Restore initial parent
                    if (isSubSubCategory && data.sub_category_id) {
                        const parent = moveOptions.eligibleParents?.level2?.find(p => p.id === data.sub_category_id);
                        if (parent) setParentCategory(parent);
                    }
                } else {
                    setDropdownCategories([]);
                }
            } else if (targetLevel === 'category') {
                setDropdownCategories([]);
            } else if (targetLevel === 'sub_category') {
                setDropdownCategories(moveOptions.eligibleParents?.level1 || []);
            } else if (targetLevel === 'sub_sub_category') {
                setDropdownCategories(moveOptions.eligibleParents?.level2 || []);
            }
        }
    }, [targetLevel, moveOptions]);

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

        const isRelocating = targetLevel !== 'none';
        const isSameLevelParentReassignment = targetLevel === 'none' && 
            ((isSubCategory && parentCategory?.id !== data.category_id) || 
             (isSubSubCategory && parentCategory?.id !== data.sub_category_id));

        setIsLoading(true);
        try {
            if (isRelocating) {
                let targetParentId = null;
                if (targetLevel === 'sub_category' || targetLevel === 'sub_sub_category') {
                    if (!parentCategory) {
                        onShowToast && onShowToast(t('modules:parent_required', 'Parent selection is required'), 'error');
                        setIsLoading(false);
                        return;
                    }
                    targetParentId = parentCategory.id;
                }
                await categoryService.moveCategory(data.id, targetParentId);
                onShowToast && onShowToast(t('modules:moved_successfully', 'Category level changed successfully'));
            } else if (isSameLevelParentReassignment) {
                if (!parentCategory) {
                    onShowToast && onShowToast(t('modules:parent_required', 'Parent selection is required'), 'error');
                    setIsLoading(false);
                    return;
                }
                await categoryService.moveCategory(data.id, parentCategory.id);
                onShowToast && onShowToast(t('modules:updated_successfully', 'Updated successfully'));
            } else {
                // Name update only
                await categoryService.updateCategory(data.id, { name: trimmedName });
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

    const currentLevel = moveOptions?.currentLevel || 1;
    const canMoveToL1 = moveOptions?.moveToLevel1 && currentLevel !== 1;
    const canMoveToL2 = moveOptions?.moveToLevel2 && currentLevel !== 2;
    const canMoveToL3 = moveOptions?.moveToLevel3 && currentLevel !== 3;

    // Same level parent display condition
    const showParentSelector = (targetLevel !== 'category' && (targetLevel !== 'none' || currentLevel > 1));

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
                            {isSubSubCategory ? t('modules:sub_sub_category_name') : isSubCategory ? t('modules:sub_category_name') : t('modules:categoryName')}
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
                            {t('modules:relocateHierarchy')}
                        </label>

                        <div className="grid grid-cols-1 gap-2">
                            {/* Option: Current Level */}
                            <label className={`flex items-center gap-3 p-4 rounded-[12px] border cursor-pointer transition-all duration-200 ${targetLevel === 'none' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                <input type="radio" name="targetLevel" checked={targetLevel === 'none'} onChange={() => setTargetLevel('none')} className="sr-only" />
                                <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'none' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                    <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'none' ? 'opacity-100' : 'opacity-0'}`} />
                                </div>
                                <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'none' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                    {t('modules:keepCurrentLevel')}
                                </span>
                            </label>

                            {/* Option: To Category */}
                            {currentLevel !== 1 && (
                                <label className={`flex items-center gap-3 p-4 rounded-[12px] border transition-all duration-200 ${!canMoveToL1 ? 'bg-gray-50/80 border-gray-200 opacity-60 cursor-not-allowed grayscale-[0.4]' : 'cursor-pointer'} ${targetLevel === 'category' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                    <input type="radio" name="targetLevel" checked={targetLevel === 'category'} disabled={!canMoveToL1} onChange={() => setTargetLevel('category')} className="sr-only" />
                                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'category' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                        <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'category' ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'category' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                            {t('modules:moveToCategory')}
                                        </span>
                                        <SimpleTooltip message={t('modules:moveToCategoryTooltip')} />
                                    </div>
                                    {!canMoveToL1 && (
                                        <div className="ml-auto flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                            <AlertCircle size={14} />
                                            <span className="text-[10px] font-bold">LOCKED</span>
                                        </div>
                                    )}
                                </label>
                            )}

                            {/* Option: To Sub-Category */}
                            {currentLevel !== 2 && (
                                <label className={`flex items-center gap-3 p-4 rounded-[12px] border transition-all duration-200 ${!canMoveToL2 ? 'bg-gray-50/80 border-gray-200 opacity-60 cursor-not-allowed grayscale-[0.4]' : 'cursor-pointer'} ${targetLevel === 'sub_category' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                    <input type="radio" name="targetLevel" checked={targetLevel === 'sub_category'} disabled={!canMoveToL2} onChange={() => setTargetLevel('sub_category')} className="sr-only" />
                                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'sub_category' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                        <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'sub_category' ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'sub_category' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                            {t('modules:moveToSubCategory')}
                                        </span>
                                        <SimpleTooltip message={t('modules:moveToSubCategoryTooltip')} />
                                    </div>
                                    {!canMoveToL2 && (
                                        <div className="ml-auto flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                            <AlertCircle size={14} />
                                            <span className="text-[10px] font-bold">LOCKED</span>
                                        </div>
                                    )}
                                </label>
                            )}

                            {/* Option: To Sub-SubCategory */}
                            {currentLevel !== 3 && (
                                <label className={`flex items-center gap-3 p-4 rounded-[12px] border transition-all duration-200 ${!canMoveToL3 ? 'bg-gray-50/80 border-gray-200 opacity-60 cursor-not-allowed grayscale-[0.4]' : 'cursor-pointer'} ${targetLevel === 'sub_sub_category' ? 'bg-emerald-50/50 border-emerald-900 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-sm'}`}>
                                    <input type="radio" name="targetLevel" checked={targetLevel === 'sub_sub_category'} disabled={!canMoveToL3} onChange={() => setTargetLevel('sub_sub_category')} className="sr-only" />
                                    <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-colors ${targetLevel === 'sub_sub_category' ? 'bg-emerald-900 border-emerald-900' : 'border-gray-300'}`}>
                                        <div className={`w-2 h-2 bg-white rounded-full transition-opacity ${targetLevel === 'sub_sub_category' ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-bold tracking-tight ${targetLevel === 'sub_sub_category' ? 'text-emerald-900' : 'text-[#111827]'}`}>
                                            {t('modules:moveToSubSubCategory')}
                                        </span>
                                        <SimpleTooltip message={t('modules:moveToSubSubCategoryTooltip')} />
                                    </div>
                                    {!canMoveToL3 && (
                                        <div className="ml-auto flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
                                            <AlertCircle size={14} />
                                            <span className="text-[10px] font-bold">LOCKED</span>
                                        </div>
                                    )}
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Dynamic Parent Dropdown */}
                    {showParentSelector && (
                        <div className="space-y-2 relative" ref={parentDropdownRef}>
                            <label className="text-[13px] font-semibold text-[#4B5563]">
                                {targetLevel === 'sub_category' || (targetLevel === 'none' && currentLevel === 2)
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
                            onClick={onClose}
                            className="w-[100px] h-[48px] border border-[#E5E7EB] rounded-[12px] text-[15px] font-bold hover:bg-gray-50 transition-all"
                        >
                            {t('common:cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="flex-1 h-[48px] rounded-[12px] bg-emerald-900 text-white text-[15px] font-bold hover:bg-emerald-950 transition-all flex items-center justify-center shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : t('modules:save_category', 'Save Category')}
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
