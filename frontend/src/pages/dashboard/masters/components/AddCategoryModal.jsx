import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import categoryService from '../../../../services/masters/categoryService';
import { translateDynamic } from '../../../../utils/i18nUtils';

const AddCategoryModal = ({
    isOpen,
    onClose,
    onSuccess,
    onShowToast,
    initialStep = 1,
    initialType = '',
    lockType = false
}) => {
    const { t } = useTranslation(['common', 'modules']);
    const [step, setStep] = useState(initialStep);
    const [type, setType] = useState(initialType);
    const [categoryName, setCategoryName] = useState('');
    const [parentCategory, setParentCategory] = useState(null);
    const [subCategory, setSubCategory] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownCategories, setDropdownCategories] = useState([]);
    const [dropdownSubCategories, setDropdownSubCategories] = useState([]);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [isSubDropdownOpen, setIsSubDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [hierarchyStats, setHierarchyStats] = useState({ hasCategories: false, hasSubCategories: false });
    const [tooltip, setTooltip] = useState({ show: false, content: '', x: 0, y: 0 });
    const dropdownRef = useRef(null);
    const parentDropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setStep(initialStep);
            setType(initialType);
            setCategoryName('');
            setParentCategory(null);
            setSubCategory(null);
            setDropdownSubCategories([]);
            fetchDropdownData();
            fetchHierarchyStats();
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const fetchDropdownData = async () => {
        try {
            const data = await categoryService.getCategoriesDropdown();
            setDropdownCategories(data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };
    const fetchHierarchyStats = async () => {
        try {
            const stats = await categoryService.getHierarchyStats();
            setHierarchyStats(stats);
        } catch (err) {
            console.error('Error fetching hierarchy stats:', err);
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
        if (type) {
            setStep(2);
        }
    };

    const handleSave = async () => {
        if (!categoryName.trim()) {
            toast.error(t('modules:category_name_required', 'Category name is required'));
            return;
        }

        if (type === 'Sub Category' && !parentCategory) {
            toast.error(t('modules:parent_category_required'));
            return;
        }

        if (type === 'Sub Sub Category' && (!parentCategory || !subCategory)) {
            toast.error(t('modules:parent_sub_category_required', 'Parent sub category is required'));
            return;
        }

        setIsLoading(true);
        try {
            if (type === 'Category') {
                await categoryService.createCategory({ name: categoryName });
                onShowToast && onShowToast(t('modules:category_added_successfully'));
            } else if (type === 'Sub Category') {
                await categoryService.createSubCategory({
                    name: categoryName,
                    category_id: parentCategory.id
                });
                onShowToast && onShowToast(t('modules:sub_category_added_successfully'));
            } else if (type === 'Sub Sub Category') {
                await categoryService.createSubSubCategory({
                    name: categoryName,
                    sub_category_id: subCategory.id
                });
                onShowToast && onShowToast(t('modules:sub_sub_category_added_successfully', 'Sub Sub Category added successfully'));
            }
            onSuccess();
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
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative bg-white rounded-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-[440px] transform transition-all duration-500 ease-in-out animate-in zoom-in-95`}>
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-[#04200f] bg-emerald-900 rounded-t-[20px]">
                    <h2 className="text-[18px] font-bold text-white tracking-tight">{t('modules:add_category')}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 text-emerald-100 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    {/* Type Dropdown */}
                    <div className="space-y-2 relative" ref={dropdownRef}>
                        <label className="text-[13px] font-semibold text-[#4B5563]">{t('common:type')}</label>
                        <div
                            className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 ${lockType ? 'cursor-default border-[#E5E7EB] bg-white' : 'cursor-pointer hover:border-gray-300 bg-white'} transition-all ${isDropdownOpen && !lockType ? 'border-[#073318] ring-4 ring-[#073318]/5' : ''}`}
                            onClick={() => !lockType && setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <span className={`text-[14px] ${type ? 'text-[#111827] font-medium' : 'text-gray-400'}`}>
                                {type ? (
                                    type === 'Category' ? t('modules:category') :
                                        type === 'Sub Category' ? t('modules:sub_category') :
                                            t('modules:sub_sub_category', 'Sub Sub Category')
                                ) : t('modules:select_type')}
                            </span>
                            <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {isDropdownOpen && (
                            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[12px] shadow-xl z-[110] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                {['Category', 'Sub Category', 'Sub Sub Category'].map((opt) => {
                                    let isDisabled = false;
                                    let tooltipMsg = '';

                                    if (opt === 'Sub Category') {
                                        if (!hierarchyStats.hasCategories) {
                                            isDisabled = true;
                                            tooltipMsg = t('modules:add_category_first', 'Please add a Category first');
                                        }
                                    } else if (opt === 'Sub Sub Category') {
                                        if (!hierarchyStats.hasCategories) {
                                            isDisabled = true;
                                            tooltipMsg = t('modules:add_cat_and_sub_first', 'Please add a Category and SubCategory first');
                                        } else if (!hierarchyStats.hasSubCategories) {
                                            isDisabled = true;
                                            tooltipMsg = t('modules:add_sub_category_first', 'Please add a SubCategory first');
                                        }
                                    }

                                    return (
                                        <div
                                            key={opt}
                                            className={`group relative px-4 py-3 text-[14px] transition-colors ${isDisabled
                                                ? 'text-gray-300 cursor-not-allowed bg-gray-50/50'
                                                : type === opt
                                                    ? 'bg-[#F9FAFB] text-[#073318] font-bold cursor-pointer'
                                                    : 'text-[#4B5563] hover:bg-gray-50 cursor-pointer'
                                                }`}
                                            onMouseEnter={(e) => {
                                                if (isDisabled) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setTooltip({
                                                        show: true,
                                                        content: tooltipMsg,
                                                        x: rect.left + rect.width / 2,
                                                        y: rect.top
                                                    });
                                                }
                                            }}
                                            onMouseLeave={() => setTooltip({ ...tooltip, show: false })}
                                            onClick={(e) => {
                                                if (isDisabled) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setTooltip({
                                                        show: true,
                                                        content: tooltipMsg,
                                                        x: rect.left + rect.width / 2,
                                                        y: rect.top
                                                    });
                                                } else {
                                                    setType(opt);
                                                    setParentCategory(null);
                                                    setSubCategory(null);
                                                    setDropdownSubCategories([]);
                                                    setIsDropdownOpen(false);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>
                                                    {opt === 'Category' ? t('modules:category') :
                                                        opt === 'Sub Category' ? t('modules:sub_category') :
                                                            t('modules:sub_sub_category', 'Sub Sub Category')}
                                                </span>
                                                {isDisabled && (
                                                    <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                                        {t('common:locked', 'Locked')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Step 2 Content: smooth transition expansion */}
                    <div className={`space-y-6 transition-all duration-500 ease-in-out ${step === 2 ? 'max-height-expanded opacity-100 mb-6 overflow-visible' : 'max-h-0 opacity-0 invisible -mt-6 overflow-hidden'}`}>
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#4B5563]">
                                {type === 'Category' ? t('modules:category_name') :
                                    type === 'Sub Category' ? t('modules:sub_category_name') :
                                        t('modules:sub_sub_category_name', 'Sub Sub Category Name')}
                            </label>
                            <input
                                type="text"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                placeholder={type === 'Category' ? t('modules:enter_category_name') :
                                    type === 'Sub Category' ? t('modules:enter_sub_category_name') :
                                        t('modules:enter_sub_sub_category_name', 'Enter Sub Sub Category Name')}
                                className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-medium outline-none focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all placeholder:text-gray-400"
                            />
                        </div>

                        {(type === 'Sub Category' || type === 'Sub Sub Category') && (
                            <div className="space-y-2 relative" ref={parentDropdownRef}>
                                <label className="text-[13px] font-semibold text-[#4B5563]">{t('modules:category_under')}</label>
                                <div
                                    className={`w-full h-[46px] border rounded-[10px] flex items-center justify-between px-4 cursor-pointer transition-all ${isParentDropdownOpen ? 'border-[#073318] ring-4 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300 bg-white'}`}
                                    onClick={() => setIsParentDropdownOpen(!isParentDropdownOpen)}
                                >
                                    <span className={`text-[14px] ${parentCategory ? 'text-[#111827] font-medium' : 'text-gray-400'}`}>
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
                                                    if (type === 'Sub Sub Category') {
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
                        )}

                        {type === 'Sub Sub Category' && (
                            <div className="space-y-2 relative">
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
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-center gap-3 pt-2">
                        {step === 1 ? (
                            <button
                                onClick={handleNext}
                                disabled={!type}
                                className={`flex-1 h-[48px] rounded-[12px] text-[15px] font-bold transition-all ${!type ? 'bg-[#B0C4B8] text-white cursor-not-allowed' : 'bg-[#073318] text-white hover:bg-[#04200f]'}`}
                            >
                                {t('common:next')}
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="flex-1 h-[48px] bg-[#073318] text-white rounded-[12px] text-[15px] font-bold hover:bg-[#04200f] transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : t('common:save')}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-[100px] h-[48px] border border-[#E5E7EB] text-[#4B5563] rounded-[12px] text-[15px] font-bold hover:bg-gray-50 transition-all bg-white"
                        >
                            {t('common:exit', 'Exit')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Dynamic Tooltip */}
            {tooltip.show && (
                <div
                    className="fixed z-[999] px-3 py-2 bg-slate-900 text-white text-[12px] font-medium rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 animate-in fade-in zoom-in-95 duration-200"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.content}
                    {/* Tooltip Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                </div>
            )}

            <style jsx>{`
                .max-height-expanded {
                    max-height: 400px;
                }
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
            `}</style>
        </div>
    );
};

export default AddCategoryModal;
