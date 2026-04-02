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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownCategories, setDropdownCategories] = useState([]);
    const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef(null);
    const parentDropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setStep(initialStep);
            setType(initialType);
            setCategoryName('');
            setParentCategory(null);
            fetchDropdownData();
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

        setIsLoading(true);
        try {
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
                                {type ? (type === 'Category' ? t('modules:category') : t('modules:sub_category')) : t('modules:select_type')}
                            </span>
                            <ChevronDown size={18} className={`text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {isDropdownOpen && (
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

                    {/* Step 2 Content: smooth transition expansion */}
                    <div className={`space-y-6 transition-all duration-500 ease-in-out ${step === 2 ? 'max-height-expanded opacity-100 mb-6 overflow-visible' : 'max-h-0 opacity-0 invisible -mt-6 overflow-hidden'}`}>
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#4B5563]">
                                {type === 'Category' ? t('modules:category_name') : t('modules:sub_category_name')}
                            </label>
                            <input
                                type="text"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                                placeholder={type === 'Category' ? t('modules:enter_category_name') : t('modules:enter_sub_category_name')}
                                className="w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-medium outline-none focus:border-[#073318] focus:ring-4 focus:ring-[#073318]/5 transition-all placeholder:text-gray-400"
                            />
                        </div>

                        {type === 'Sub Category' && (
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
                                                onClick={() => {
                                                    setParentCategory(cat);
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
