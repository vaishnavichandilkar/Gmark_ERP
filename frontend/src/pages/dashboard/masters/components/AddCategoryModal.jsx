import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Info, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import categoryService from '../../../../services/masters/categoryService';

const AddCategoryModal = ({ isOpen, onClose, onSuccess, onShowToast, initialStep = 1, initialType = '', initialParent = null }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [step, setStep] = useState(initialStep);
    const [type, setType] = useState(initialType); // 'Category', 'Sub Category', 'Sub Sub Category'
    const [categoryName, setCategoryName] = useState('');
    const [parentCategory, setParentCategory] = useState(initialParent);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownCategories, setDropdownCategories] = useState([]);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState({ hasCategories: false, hasSubCategories: false, isLoaded: false });
    const dropdownRef = useRef(null);
    const parentDropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setStep(initialStep || 1);
            setType(initialType || '');
            setCategoryName('');
            setParentCategory(initialParent || null);
            setSearchTerm('');
            fetchStats();
        }
    }, [isOpen, initialStep, initialType, initialParent]);

    const fetchStats = async () => {
        try {
            const data = await categoryService.getCategories();
            const hasCategories = data.length > 0;
            const hasSubCategories = data.some(cat => cat.sub_categories && cat.sub_categories.length > 0);
            setStats({ hasCategories, hasSubCategories, isLoaded: true });
        } catch (err) {
            console.error('Error fetching stats:', err);
            setStats(prev => ({ ...prev, isLoaded: true }));
        }
    };

    const fetchDropdownData = async () => {
        try {
            if (type === 'Sub Sub Category') {
                const allData = await categoryService.getCategories();
                const allSubCategories = allData.flatMap(cat =>
                    (cat.sub_categories || []).map(sub => ({
                        ...sub,
                        categoryName: cat.name
                    }))
                );
                setDropdownCategories(allSubCategories);
            } else if (type === 'Sub Category') {
                const data = await categoryService.getCategoriesDropdown();
                setDropdownCategories(data || []);
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    useEffect(() => {
        if (type && type !== 'Category') {
            fetchDropdownData();
            setParentCategory(null);
            setSearchTerm('');
        }
    }, [type]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
            if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target)) {
                setIsParentDropdownOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredParents = searchTerm
        ? dropdownCategories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : dropdownCategories;

    const handleNext = () => {
        if (type) setStep(2);
    };

    const handleSave = async () => {
        const trimmedName = categoryName.trim();
        if (!trimmedName) {
            toast.error(t('modules:name_required', 'Name is required'));
            return;
        }

        if (type !== 'Category' && !parentCategory) {
            toast.error(t('modules:parent_selection_required', 'Parent selection is required'));
            return;
        }

        setIsLoading(true);
        try {
            let result;
            if (type === 'Category') {
                result = await categoryService.createCategory({ name: trimmedName });
                onShowToast && onShowToast(t('modules:category_added_successfully'));
            } else if (type === 'Sub Category') {
                result = await categoryService.createSubCategory({ name: trimmedName, category_id: parentCategory.id });
                onShowToast && onShowToast(t('modules:sub_category_added_successfully'));
            } else {
                result = await categoryService.createSubSubCategory({ name: trimmedName, sub_category_id: parentCategory.id });
                onShowToast && onShowToast(t('modules:sub_sub_category_added_successfully'));
            }
            onSuccess(result);
            onClose();
        } catch (error) {
            onShowToast && onShowToast(error.response?.data?.message || 'Operation failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[440px] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 bg-emerald-900 text-white border-b border-emerald-800">
                    <h2 className="text-[18px] font-bold tracking-tight">
                        {initialStep === 2 ? t('modules:add_' + type?.toLowerCase()?.replace(/\s+/g, '_'), `Add ${type}`) : (step === 1 ? t('modules:select_category_type', 'Step 1: Select Type') : t('modules:add_details', 'Step 2: Add Details'))}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <label className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">{t('modules:choose_hierarchy_level', 'Choose Hierarchy Level')}</label>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { id: 'Category', label: t('modules:category'), desc: 'Top Level (Level 1)', disabled: false },
                                    { id: 'Sub Category', label: t('modules:sub_category'), desc: 'Child Level (Level 2)', disabled: !stats.hasCategories },
                                    { id: 'Sub Sub Category', label: t('modules:sub_sub_category'), desc: 'Grandchild Level (Level 3)', disabled: !stats.hasSubCategories }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        disabled={opt.disabled}
                                        onClick={() => setType(opt.id)}
                                        className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${type === opt.id ? 'border-emerald-600 bg-emerald-50' : 'border-gray-100 hover:border-emerald-200'} ${opt.disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'active:scale-98'}`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className={`text-[15px] font-bold ${type === opt.id ? 'text-emerald-900' : 'text-gray-700'}`}>{opt.label}</span>
                                            {type === opt.id && <div className="w-4 h-4 rounded-full bg-emerald-600" />}
                                        </div>
                                        <span className="text-[12px] text-gray-400 font-medium">{opt.desc}</span>
                                        {opt.disabled && (
                                            <span className="text-[10px] text-red-500 mt-1 font-bold italic flex items-center gap-1">
                                                <Info size={10} /> {opt.id === 'Sub Category' ? 'Add a category first' : 'Add a sub-category first'}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                            {/* Selected Type Badge / Selection */}
                            <div className="space-y-2">
                                <label className="text-[13px] font-semibold text-gray-600">{t('common:type')}</label>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <p className="text-[14px] font-bold text-emerald-900">{t('modules:' + type?.toLowerCase()?.replace(/\s+/g, '_'), type)}</p>
                                    </div>
                                    {initialStep !== 2 && (
                                        <button onClick={() => setStep(1)} className="text-[12px] text-emerald-700 font-bold hover:underline">
                                            {t('common:change')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Name Input */}
                            <div className="space-y-2">
                                <label className="text-[13px] font-semibold text-gray-600">{t('modules:name')}</label>
                                <input
                                    type="text" autoFocus
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    placeholder={t('modules:enter_name')}
                                    className="w-full h-[46px] border border-gray-200 rounded-xl px-4 text-[14px] font-medium outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5 transition-all"
                                />
                            </div>

                            {/* Parent Dropdown (Conditional) */}
                            {type !== 'Category' && (
                                <div className="space-y-2 relative" ref={parentDropdownRef}>
                                    <label className="text-[13px] font-semibold text-gray-600">
                                        {type === 'Sub Category' ? t('modules:select_parent_category') : t('modules:select_parent_sub_category')}
                                    </label>
                                    {initialStep === 2 && initialParent ? (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                                            <p className="text-[14px] font-bold text-emerald-900">{initialParent.name}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className={`w-full h-[46px] border rounded-xl flex items-center justify-between px-4 cursor-pointer transition-all ${isParentDropdownOpen ? 'border-emerald-600 ring-4 ring-emerald-600/5' : 'border-gray-200 hover:border-gray-300'}`}
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
                                                    <span className={`text-[14px] ${parentCategory ? 'text-gray-900 font-medium' : 'text-gray-400 italic'}`}>
                                                        {parentCategory ? parentCategory.name : t('common:select_option')}
                                                    </span>
                                                )}
                                                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isParentDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {isParentDropdownOpen && (
                                                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-2xl z-[110] py-2 max-h-[180px] overflow-y-auto dropdown-scrollbar animate-in slide-in-from-top-2">
                                                    {filteredParents.length > 0 ? (
                                                        filteredParents.map((cat) => (
                                                            <div
                                                                key={cat.id}
                                                                className={`px-4 py-2.5 text-[14px] cursor-pointer hover:bg-emerald-50 transition-colors ${parentCategory?.id === cat.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-600'}`}
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
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        {step === 1 ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="w-[100px] h-[52px] border border-gray-200 rounded-xl text-[15px] font-bold text-gray-500 hover:bg-gray-50 transition-all"
                                >
                                    {t('common:cancel')}
                                </button>
                                <button
                                    onClick={handleNext}
                                    disabled={!type}
                                    className="flex-1 h-[52px] bg-emerald-900 text-white rounded-xl text-[16px] font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-950 transition-all disabled:opacity-50 disabled:grayscale active:scale-95"
                                >
                                    {t('common:next')}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={isLoading}
                                    className="flex-1 h-[52px] bg-emerald-900 text-white rounded-xl text-[16px] font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-950 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : (initialStep === 2 ? t('common:save') : t('modules:save_category', 'Save Category'))}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-[100px] h-[52px] border border-gray-200 rounded-xl text-[15px] font-bold text-gray-500 hover:bg-gray-50 transition-all"
                                >
                                    {initialStep === 2 ? t('common:exit', 'Exit') : t('common:cancel')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .animate-in { animation-duration: 300ms; animation-fill-mode: forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoomIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes slideInSide { from { transform: translateX(10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideInTop { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .fade-in { animation-name: fadeIn; }
                .zoom-in-95 { animation-name: zoomIn; }
                .slide-in-from-right-4 { animation-name: slideInSide; }
                .slide-in-from-top-2 { animation-name: slideInTop; }
                .dropdown-scrollbar::-webkit-scrollbar { width: 4px; }
                .dropdown-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
            `}</style>
        </div>
    );
};

export default AddCategoryModal;
