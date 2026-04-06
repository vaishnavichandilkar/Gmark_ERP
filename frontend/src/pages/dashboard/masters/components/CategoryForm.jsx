import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ArrowLeft, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import categoryService from '../../../../services/masters/categoryService';

const CategoryForm = ({ mode = 'add', initialData = null, onBack, onSuccess, onShowToast }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [step, setStep] = useState(1);
    const [type, setType] = useState(initialData?.type === 'category' ? 'Category' : (initialData?.type === 'sub_category' ? 'Sub Category' : (initialData?.type || '')));
    const [categoryName, setCategoryName] = useState(initialData?.name || '');
    const [status, setStatus] = useState(initialData?.status || 'ACTIVE');
    const [parentCategory, setParentCategory] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownCategories, setDropdownCategories] = useState([]);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const dropdownRef = useRef(null);
    const parentDropdownRef = useRef(null);

    useEffect(() => {
        fetchDropdownData();
        if ((mode === 'edit' || mode === 'view') && initialData) {
            setStep(2);
            setType(initialData.type === 'category' ? 'Category' : 'Sub Category');
            setCategoryName(initialData.name);
            setStatus(initialData.status || 'ACTIVE');
        }
    }, [mode, initialData]);

    const fetchDropdownData = async () => {
        try {
            const data = await categoryService.getCategoriesDropdown();
            setDropdownCategories(data || []);

            // If editing a subcategory, find its parent from the dropdown list
            if ((mode === 'edit' || mode === 'view') && (initialData?.type === 'sub_category' || initialData?.type === 'Sub Category')) {
                const parentId = initialData.category_id || initialData.parent_id || initialData.parentCategoryId;
                if (parentId) {
                    const parent = data.find(c => Number(c.id) === Number(parentId));
                    if (parent) setParentCategory(parent);
                }
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target)) {
                setIsParentDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNext = () => {
        if (!type) {
            setErrors(prev => ({ ...prev, type: t('common:selection_required', 'Field is required') }));
            return;
        }
        setStep(2);
    };

    const handleSave = async () => {
        let newErrors = {};
        if (!categoryName.trim()) {
            newErrors.categoryName = t('modules:category_name_required', 'Category name is required');
        }
        if (type === 'Sub Category' && !parentCategory) {
            newErrors.parentCategory = t('modules:parent_category_selection_required', 'Please select a parent category');
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            onShowToast && onShowToast(Object.values(newErrors)[0], 'error');
            return;
        }

        setIsLoading(true);
        try {
            if (mode === 'add') {
                if (type === 'Category') {
                    await categoryService.createCategory({ name: categoryName });
                    onShowToast && onShowToast(t('modules:category_added_successfully'));
                } else {
                    await categoryService.createSubCategory({
                        name: categoryName,
                        category_id: parentCategory.id
                    });
                    onShowToast && onShowToast(t('modules:sub_category_added_successfully'));
                }
            } else {
                // Edit mode
                if (type === 'Category') {
                    await categoryService.updateCategory(initialData.id, { name: categoryName });
                    onShowToast && onShowToast(t('modules:category_updated_successfully'));
                } else {
                    await categoryService.updateSubCategory(initialData.id, {
                        name: categoryName,
                        category_id: parentCategory.id
                    });
                    onShowToast && onShowToast(t('modules:sub_category_updated_successfully'));
                }
            }
            onSuccess();
        } catch (error) {
            onShowToast && onShowToast(error.response?.data?.message || 'Operation failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const isView = mode === 'view';

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300 p-2">
            <div className={`bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col w-full mb-12 transition-all duration-300 ${isView ? 'overflow-hidden' : 'overflow-visible'}`}>
                {/* Header */}
                <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                            {mode === 'add' ? t('modules:add_new_category') : (mode === 'edit' ? t('modules:edit_category') : t('modules:view_category'))}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isView && mode === 'edit' && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isLoading}
                                className={`px-6 h-[40px] text-white rounded-[8px] text-[14px] font-bold transition-all shadow-sm flex items-center justify-center min-w-[120px] ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#073318] hover:bg-[#04200f]'}`}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                     t('modules:save_category', 'Save Category')
                                 )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-6 h-[40px] bg-white border border-[#E5E7EB] text-[#4B5563] rounded-[8px] text-[14px] font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            <ArrowLeft size={16} />
                            {t('common:back')}
                        </button>
                    </div>
                </div>

                {/* Form Body */}
                <div className="p-8 md:p-10 flex flex-col gap-8 w-full">
                    <div className="grid grid-cols-1 gap-8 w-full">
                        {/* Type Dropdown */}
                        <div className="space-y-2 relative" ref={dropdownRef}>
                            <label className="text-[14px] font-bold text-[#4B5563]">{t('common:type')} <span className="text-red-500">*</span></label>
                            <div
                                className={`w-full h-[48px] border rounded-[10px] flex items-center justify-between px-4 cursor-pointer transition-all ${errors.type ? 'border-red-500 ring-2 ring-red-500/10' : ''} ${mode === 'edit' || isView ? 'bg-gray-50 cursor-not-allowed border-[#E5E7EB]' : isDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300 bg-white'}`}
                                onClick={() => mode === 'add' && !isView && setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span className={`text-[14px] ${type ? 'text-[#111827] font-medium' : 'text-gray-400'}`}>
                                    {type ? (type === 'Category' ? t('modules:category') : t('modules:sub_category')) : t('modules:select_type')}
                                </span>
                                {mode === 'add' && !isView && (
                                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                )}
                            </div>
                            {errors.type && <p className="text-red-500 text-[12px] font-bold mt-1">{errors.type}</p>}

                            {isDropdownOpen && mode === 'add' && !isView && (
                                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {['Category', 'Sub Category'].map((opt) => {
                                        const isDisabled = opt === 'Sub Category' && dropdownCategories.length === 0;
                                        return (
                                            <div
                                                key={opt}
                                                className={`px-4 py-3 text-[14px] transition-colors ${isDisabled
                                                        ? 'text-gray-300 cursor-not-allowed'
                                                        : type === opt
                                                            ? 'bg-[#F9FAFB] text-[#073318] font-bold cursor-pointer'
                                                            : 'text-[#4B5563] hover:bg-gray-50 cursor-pointer'
                                                    }`}
                                                onClick={() => {
                                                    if (!isDisabled) {
                                                        setType(opt);
                                                        setErrors(prev => ({ ...prev, type: '' }));
                                                        setIsDropdownOpen(false);
                                                    }
                                                }}
                                            >
                                                {opt === 'Category' ? t('modules:category') : t('modules:sub_category')}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Step 2 Content */}
                        <div className={`space-y-8 transition-all duration-500 ease-in-out ${step === 2 ? 'opacity-100 max-h-[1000px] visible' : 'opacity-0 max-h-0 invisible overflow-hidden'}`}>
                            <div className="space-y-2">
                                <label className="text-[14px] font-bold text-[#4B5563]">
                                    {type === 'Category' ? t('modules:category_name') : t('modules:sub_category_name')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={categoryName}
                                    disabled={isView}
                                    onChange={(e) => {
                                        setCategoryName(e.target.value);
                                        setErrors(prev => ({ ...prev, categoryName: '' }));
                                    }}
                                    placeholder={type === 'Category' ? t('modules:enter_category_name') : t('modules:enter_sub_category_name')}
                                    className={`w-full h-[48px] border rounded-[10px] px-4 text-[14px] font-medium outline-none transition-all placeholder:text-gray-400 ${isView ? 'bg-gray-50 border-[#E5E7EB]' : errors.categoryName ? 'border-red-500 ring-2 ring-red-500/10' : 'border-[#E5E7EB] focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5'}`}
                                />
                                {errors.categoryName && <p className="text-red-500 text-[12px] font-bold mt-1">{errors.categoryName}</p>}
                            </div>

                            {type === 'Sub Category' && (
                                <div className="space-y-2 relative" ref={parentDropdownRef}>
                                    <label className="text-[14px] font-bold text-[#4B5563]">{t('modules:category_under')} <span className="text-red-500">*</span></label>
                                    <div
                                        className={`w-full h-[48px] border rounded-[10px] flex items-center justify-between px-4 cursor-pointer transition-all ${isView ? 'bg-gray-50 cursor-not-allowed border-[#E5E7EB]' : errors.parentCategory ? 'border-red-500 ring-2 ring-red-500/10' : isParentDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300 bg-white'}`}
                                        onClick={() => !isView && setIsParentDropdownOpen(!isParentDropdownOpen)}
                                    >
                                        <span className={`text-[14px] ${parentCategory ? parentCategory.name : t('modules:select_category')} `}>
                                            {parentCategory ? parentCategory.name : t('modules:select_category')}
                                        </span>
                                        {!isView && (
                                            <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isParentDropdownOpen ? 'rotate-180' : ''}`} />
                                        )}
                                    </div>
                                    {errors.parentCategory && <p className="text-red-500 text-[12px] font-bold mt-1">{errors.parentCategory}</p>}

                                    {isParentDropdownOpen && !isView && (
                                        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 max-h-[160px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                            {dropdownCategories.map((cat) => (
                                                <div
                                                    key={cat.id}
                                                    className={`px-4 py-3 text-[14px] cursor-pointer transition-colors ${parentCategory?.id === cat.id ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                                    onClick={() => {
                                                        setParentCategory(cat);
                                                        setErrors(prev => ({ ...prev, parentCategory: '' }));
                                                        setIsParentDropdownOpen(false);
                                                    }}
                                                >
                                                    {cat.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Status Display - Read Only in this form as status is managed via master list */}
                            {(mode === 'edit' || mode === 'view') && (
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <h3 className="text-[15px] font-bold text-[#111827]">{t('modules:system_status', 'System Status')}</h3>
                                    <div className="flex items-center gap-4 bg-gray-50/50 p-4 rounded-[12px] border border-gray-100">
                                        <div className="flex-1">
                                            <div className="text-[13px] text-gray-500 font-medium">{t('common:current_status', 'Entry Status')}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={`w-2.5 h-2.5 rounded-full ${status === 'INACTIVE' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                <span className={`text-[15px] font-bold ${status === 'INACTIVE' ? 'text-red-700' : 'text-emerald-700'}`}>
                                                    {status === 'INACTIVE' ? t('common:inactive') : t('common:active')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="px-4 py-2 bg-white rounded-[8px] border border-gray-200 shadow-sm text-[12px] text-gray-500 italic max-w-[200px]">
                                            {t('modules:status_managed_info', 'Status can be managed from the master list')}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons - Only for Add Mode */}
                {mode === 'add' && !isView && (
                    <div className="px-8 py-6 bg-[#F9FAFB]/50 flex justify-end gap-3 border-t border-[#F3F4F6]">
                        <button
                            onClick={onBack}
                            disabled={isLoading}
                            className="px-8 h-[46px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-white transition-all bg-white shadow-sm flex items-center justify-center"
                        >
                            {t('common:cancel')}
                        </button>
                        {step === 1 ? (
                            <button
                                onClick={handleNext}
                                className={`px-10 h-[46px] rounded-[10px] text-[14px] font-bold transition-all shadow-md flex items-center justify-center min-w-[160px] ${!type ? 'bg-gray-400 text-white cursor-not-allowed shadow-none' : 'bg-[#073318] text-white hover:bg-[#04200f]'}`}
                            >
                                {t('common:next')}
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className={`px-10 h-[46px] text-white rounded-[10px] text-[14px] font-bold transition-all shadow-md flex items-center justify-center min-w-[160px] ${isLoading ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-[#073318] hover:bg-[#04200f]'}`}
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : t('modules:save_category', 'Save Category')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryForm;
