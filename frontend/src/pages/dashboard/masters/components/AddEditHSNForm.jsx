import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

const FormDropdown = ({ label, options, value, onChange, placeholder, disabled = false, showAsterisk = false, error = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col gap-2 relative w-full" ref={dropdownRef}>
            <label className="text-[14px] font-bold text-[#374151]">
                {label} {showAsterisk && <span className="text-red-500">*</span>}
            </label>
            <div
                className={`w-full h-[46px] flex items-center justify-between px-4 border rounded-[10px] bg-white transition-all 
                    ${disabled ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F9FAFB]' :
                        error ? 'border-red-500 ring-1 ring-red-500/10' :
                            isOpen ? 'border-[#073318] ring-1 ring-[#073318]/10 cursor-pointer' :
                                'border-[#E5E7EB] hover:border-gray-300 cursor-pointer'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={`text-[14px] font-medium ${value !== undefined && value !== '' ? 'text-[#111827]' : 'text-gray-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                {!disabled && (isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />)}
            </div>
            {error && <span className="text-red-500 text-[11px] mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200 font-medium">*{error}</span>}

            {isOpen && !disabled && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[250px] overflow-y-auto w-full py-2">
                        {options.map((option, idx) => (
                            <div
                                key={idx}
                                className={`px-4 py-3 text-[14px] flex items-center justify-between cursor-pointer transition-colors ${value === option.value ? 'bg-[#073318]/5 text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                            >
                                {option.label}
                                {value === option.value && <Check size={16} className="text-[#073318]" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const AddEditHSNForm = ({ initialData = null, mode = 'add', onBack, onSubmit }) => {
    const { t } = useTranslation(['modules', 'common']);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        type: '',
        code: '',
        taxRate: '',
        description: '',
        isActive: true
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (initialData) {
            setFormData({
                type: initialData.type || '',
                code: initialData.code || '',
                taxRate: initialData.taxRate !== undefined ? parseInt(initialData.taxRate, 10) : '',
                description: initialData.description || '',
                isActive: initialData.isActive ?? true
            });
        }
    }, [initialData]);

    const handleCodeChange = (e) => {
        const value = e.target.value;
        // Limit to numeric characters only
        const numericVal = value.replace(/\D/g, '');
        // Limit length to 8 characters
        const codeVal = numericVal.slice(0, 8);
        setFormData(prev => ({ ...prev, code: codeVal }));
        
        // Instant Validation
        if (errors.code) {
            setErrors(prev => {
                const next = { ...prev };
                delete next.code;
                return next;
            });
        }
    };

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        // Remove error on change
        if (errors[field]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.type) {
            newErrors.type = 'Type is required.';
        }

        if (!formData.code) {
            newErrors.code = 'HSN/SAC Code is required.';
        } else {
            if (!/^\d+$/.test(formData.code)) {
                newErrors.code = 'Code must contain only numeric values.';
            } else if (formData.type === 'HSN') {
                if (formData.code.length !== 6 && formData.code.length !== 8) {
                    newErrors.code = 'HSN Code must be exactly 6 or 8 digits.';
                }
            } else if (formData.type === 'SAC') {
                if (formData.code.length !== 6) {
                    newErrors.code = 'SAC Code must be exactly 6 digits.';
                }
            } else {
                if (formData.code.length < 6 || formData.code.length > 8) {
                    newErrors.code = 'Code must be between 6 and 8 digits.';
                }
            }
        }

        if (formData.taxRate === '' || formData.taxRate === undefined) {
            newErrors.taxRate = 'Tax Rate is required.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (mode === 'view') return;

        if (!validateForm()) {
            toast.error(t('common:please_fill_required_fields', 'Please fill all required fields.'));
            return;
        }

        try {
            setSubmitting(true);
            await onSubmit(formData);
        } catch (error) {
            console.error('Submit error:', error);
            // Check for duplicate code error specifically
            const errMsg = error.response?.data?.message || '';
            if (errMsg.includes('already exists') || error.message?.includes('already exists')) {
                setErrors(prev => ({ ...prev, code: 'This HSN/SAC code already exists.' }));
            }
        } finally {
            setSubmitting(false);
        }
    };

    const getTitle = () => {
        if (mode === 'view') return t('modules:view_hsn', 'View HSN');
        if (mode === 'edit') return t('modules:edit_hsn', 'Edit HSN');
        return t('modules:add_hsn', 'Add HSN');
    };

    const isViewOnly = mode === 'view';

    return (
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-6 md:gap-8 bg-white border border-[#E5E7EB] rounded-[20px] p-6 md:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
            {/* Form Header */}
            <div className="flex flex-row items-center justify-between border-b border-[#F3F4F6] pb-5">
                <div className="flex flex-col gap-1">
                    <h2 className="text-[18px] md:text-[22px] font-bold text-[#111827] tracking-tight">{getTitle()}</h2>
                    {!isViewOnly && <p className="text-[12px] md:text-[13px] text-gray-400 font-medium">Fields marked with <span className="text-red-500">*</span> are mandatory</p>}
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="flex flex-row items-center justify-center gap-2 h-[42px] px-4 md:px-5 border border-[#E5E7EB] hover:bg-gray-50 rounded-[10px] text-[14px] font-bold text-[#4B5563] transition-all"
                >
                    <ArrowLeft size={16} />
                    <span>{t('common:back', 'Back')}</span>
                </button>
            </div>

            {/* Form Controls - 2 Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Field 1: Type */}
                <FormDropdown
                    label="Type"
                    placeholder="Select Type"
                    options={[
                        { label: 'HSN', value: 'HSN' },
                        { label: 'SAC', value: 'SAC' }
                    ]}
                    value={formData.type}
                    onChange={(val) => handleFieldChange('type', val)}
                    showAsterisk={!isViewOnly}
                    disabled={isViewOnly || mode === 'edit'} // Lock type during edit to match product logic
                    error={errors.type}
                />

                {/* Field 2: Code */}
                <div className="flex flex-col gap-2 relative w-full">
                    <label className="text-[14px] font-bold text-[#374151]">
                        {formData.type === 'SAC' ? 'SAC Code' : formData.type === 'HSN' ? 'HSN Code' : 'Code'} {!isViewOnly && <span className="text-red-500">*</span>}
                    </label>
                    <input
                        type="text"
                        placeholder={formData.type === 'SAC' ? 'Enter 6 digit code' : formData.type === 'HSN' ? 'Enter 6 or 8 digit code' : 'Enter 6-8 digit code'}
                        value={formData.code}
                        onChange={handleCodeChange}
                        disabled={isViewOnly || mode === 'edit'} // Lock code during edit
                        className={`w-full h-[46px] border rounded-[10px] px-4 text-[14px] font-medium transition-all outline-none
                            ${isViewOnly || mode === 'edit' ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]' :
                                errors.code ? 'border-red-500 focus:ring-1 focus:ring-red-500/10' :
                                    'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'}`}
                    />
                    {errors.code && <span className="text-red-500 text-[11px] mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200 font-medium">*{errors.code}</span>}
                </div>

                {/* Field 3: Tax Rate */}
                <FormDropdown
                    label="Tax Rate (%)"
                    placeholder="Select Tax Rate"
                    options={[
                        { label: '0%', value: 0 },
                        { label: '5%', value: 5 },
                        { label: '12%', value: 12 },
                        { label: '18%', value: 18 },
                        { label: '28%', value: 28 }
                    ]}
                    value={formData.taxRate}
                    onChange={(val) => handleFieldChange('taxRate', val)}
                    showAsterisk={!isViewOnly}
                    disabled={isViewOnly}
                    error={errors.taxRate}
                />

                {/* Field 4: Description */}
                <div className="flex flex-col gap-2 relative w-full md:col-span-2">
                    <label className="text-[14px] font-bold text-[#374151]">
                        {formData.type === 'SAC' ? 'SAC Description' : formData.type === 'HSN' ? 'HSN Description' : 'Description'}
                    </label>
                    <textarea
                        rows={3}
                        placeholder={formData.type === 'SAC' ? 'Enter SAC description (optional)' : formData.type === 'HSN' ? 'Enter HSN description (optional)' : 'Enter description (optional)'}
                        value={formData.description}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        disabled={isViewOnly}
                        className={`w-full border rounded-[10px] p-4 text-[14px] font-medium transition-all outline-none resize-none
                            ${isViewOnly ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]' :
                                errors.description ? 'border-red-500 focus:ring-1 focus:ring-red-500/10' :
                                    'border-[#E5E7EB] focus:border-[#073318] focus:ring-1 focus:ring-[#073318]/10'}`}
                    />
                </div>
            </div>

            {/* Form Actions */}
            {!isViewOnly && (
                <div className="flex flex-row items-center justify-end gap-3 border-t border-[#F3F4F6] pt-6 mt-2">
                    <button
                        type="button"
                        onClick={onBack}
                        className="h-[44px] px-6 border border-[#E5E7EB] hover:bg-gray-50 rounded-[10px] text-[14px] font-bold text-[#4B5563] transition-colors"
                        disabled={submitting}
                    >
                        {t('common:cancel', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        className="flex items-center justify-center min-w-[120px] h-[44px] px-6 bg-[#073318] hover:bg-[#04200f] text-white text-[14px] font-bold rounded-[10px] transition-all shadow-sm active:scale-[0.98]"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            t('common:save', 'Save')
                        )}
                    </button>
                </div>
            )}
        </form>
    );
};

export default AddEditHSNForm;
