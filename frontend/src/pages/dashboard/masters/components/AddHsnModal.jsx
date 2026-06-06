import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import hsnService from '../../../../services/masters/hsnService';

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
            <label className="text-[13px] font-semibold text-gray-600">
                {label} {showAsterisk && <span className="text-red-500">*</span>}
            </label>
            <div
                className={`w-full h-[46px] flex items-center justify-between px-4 border rounded-xl bg-white transition-all 
                    ${disabled ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F9FAFB] opacity-60' :
                        error ? 'border-red-500 ring-4 ring-red-500/5' :
                            isOpen ? 'border-[#073318] ring-4 ring-[#073318]/5 cursor-pointer' :
                                'border-gray-200 hover:border-gray-300 cursor-pointer'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={`text-[14px] ${value !== undefined && value !== '' ? 'text-gray-900 font-medium' : 'text-gray-400 italic'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                {!disabled && <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
            </div>
            {error && <p className="text-[11px] text-red-500 ml-1 mt-0.5 font-medium">*{error}</p>}

            {isOpen && !disabled && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-2xl z-[110] py-2 max-h-[180px] overflow-y-auto dropdown-scrollbar animate-in slide-in-from-top-2">
                    {options.map((option, idx) => (
                        <div
                            key={idx}
                            className={`px-4 py-2.5 text-[14px] cursor-pointer hover:bg-emerald-50 transition-colors ${value === option.value ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-600'}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AddHsnModal = ({ isOpen, onClose, onSuccess, onShowToast, presetType = '' }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: '',
        code: '',
        taxRate: '',
        description: '',
        isActive: true
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isOpen) {
            setFormData({
                type: presetType === 'SERVICES' ? 'SAC' : presetType === 'GOODS' ? 'HSN' : '',
                code: '',
                taxRate: '',
                description: '',
                isActive: true
            });
            setErrors({});
        }
    }, [isOpen, presetType]);

    const handleCodeChange = (e) => {
        const value = e.target.value;
        const numericVal = value.replace(/\D/g, '');
        const codeVal = numericVal.slice(0, 8);
        setFormData(prev => ({ ...prev, code: codeVal }));
        
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
            newErrors.code = `${formData.type || 'Code'} is required.`;
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
            }
        }

        if (formData.taxRate === '' || formData.taxRate === undefined) {
            newErrors.taxRate = 'Tax Rate is required.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        try {
            const result = await hsnService.createHsn(formData);
            onShowToast && onShowToast(t('modules:hsn_added_successfully', 'HSN/SAC Code added successfully'));
            onSuccess && onSuccess(result);
            onClose();
        } catch (error) {
            const errMsg = error.response?.data?.message || '';
            if (errMsg.includes('already exists') || error.message?.includes('already exists')) {
                setErrors(prev => ({ ...prev, code: `This ${formData.type} code already exists.` }));
            } else {
                onShowToast && onShowToast(error.response?.data?.message || 'Operation failed', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const codeLabel = formData.type === 'SAC' ? 'SAC Code' : formData.type === 'HSN' ? 'HSN Code' : 'Code';
    const codePlaceholder = formData.type === 'SAC' ? 'Enter 6 digit code' : formData.type === 'HSN' ? 'Enter 6 or 8 digit code' : 'Enter 6-8 digit code';
    const descLabel = formData.type === 'SAC' ? 'SAC Description' : formData.type === 'HSN' ? 'HSN Description' : 'Description';
    const descPlaceholder = formData.type === 'SAC' ? 'Enter SAC description (optional)' : formData.type === 'HSN' ? 'Enter HSN description (optional)' : 'Enter description (optional)';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-[440px] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 bg-emerald-900 text-white border-b border-emerald-800">
                    <h2 className="text-[18px] font-bold tracking-tight">
                        {formData.type === 'SAC' ? 'Add New SAC Code' : formData.type === 'HSN' ? 'Add New HSN Code' : 'Add New HSN/SAC Code'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-5">
                        {/* Type Field */}
                        <FormDropdown
                            label="Type"
                            placeholder="Select Type"
                            options={[
                                { label: 'HSN', value: 'HSN' },
                                { label: 'SAC', value: 'SAC' }
                            ]}
                            value={formData.type}
                            onChange={(val) => handleFieldChange('type', val)}
                            showAsterisk={true}
                            disabled={presetType === 'SERVICES' || presetType === 'GOODS'}
                            error={errors.type}
                        />

                        {/* Code Field */}
                        <div className="space-y-2 relative">
                            <label className="text-[13px] font-semibold text-gray-600">
                                {codeLabel} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder={codePlaceholder}
                                value={formData.code}
                                onChange={handleCodeChange}
                                className={`w-full h-[46px] border rounded-xl px-4 text-[14px] font-medium transition-all outline-none
                                    ${errors.code ? 'border-red-500 focus:ring-4 focus:ring-red-500/5 bg-red-50/10' :
                                        'border-gray-200 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5'}`}
                            />
                            {errors.code && <p className="text-[11px] text-red-500 ml-1 mt-0.5 font-medium">{errors.code}</p>}
                        </div>

                        {/* Tax Rate Field */}
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
                            showAsterisk={true}
                            error={errors.taxRate}
                        />

                        {/* Description Field */}
                        <div className="space-y-2 relative">
                            <label className="text-[13px] font-semibold text-gray-600">
                                {descLabel}
                            </label>
                            <textarea
                                rows={3}
                                placeholder={descPlaceholder}
                                value={formData.description}
                                onChange={(e) => handleFieldChange('description', e.target.value)}
                                className="w-full border border-gray-200 rounded-xl p-4 text-[14px] font-medium transition-all outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5 resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className="flex-1 h-[52px] bg-emerald-900 text-white rounded-xl text-[16px] font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-950 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : t('common:save')}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-[100px] h-[52px] border border-gray-200 rounded-xl text-[15px] font-bold text-gray-500 hover:bg-gray-50 transition-all"
                        >
                            {t('common:exit', 'Exit')}
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

export default AddHsnModal;
