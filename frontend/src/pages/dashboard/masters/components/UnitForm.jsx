import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft, Plus, FileEdit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import unitService from '../../../../services/masters/unitService';
import toast from 'react-hot-toast';
import { translateDynamic } from '../../../../utils/i18nUtils';

const CustomSelect = ({ label, options, value, onChange, placeholder, isSearchable = false, disabled = false, showAsterisk = false, actionLabel = '', onAction = null, error = '' }) => {
    const { t } = useTranslation(['common']);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newValue, setNewValue] = useState('');
    const [subError, setSubError] = useState(false);
    const dropdownRef = useRef(null);

    const filteredOptions = isSearchable && searchTerm
        ? options.filter(opt => opt?.toLowerCase().includes(searchTerm.toLowerCase()))
        : options;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
                setIsAddingNew(false);
                setNewValue('');
                setSubError(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddNew = (e) => {
        e.stopPropagation();
        if (newValue.trim()) {
            onAction && onAction(newValue.trim().toUpperCase());
            setIsAddingNew(false);
            setNewValue('');
            setSubError(false);
            setIsOpen(false);
        } else {
            setSubError(true);
        }
    };

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
                {isSearchable && isOpen ? (
                    <input
                        type="text"
                        autoFocus
                        placeholder={value || placeholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-full bg-transparent outline-none text-[14px] text-[#111827] placeholder:text-gray-400 font-medium"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className={`text-[14px] truncate font-medium ${value ? 'text-[#111827]' : 'text-gray-400'}`}>
                        {value ? translateDynamic(value, t) : placeholder}
                    </span>
                )}
                {!disabled && (isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />)}
            </div>
            {error && <span className="text-red-500 text-[11px] mt-0.5 ml-1 animate-in fade-in slide-in-from-top-1 duration-200 font-medium">*{error}</span>}

            {isOpen && !disabled && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {!disabled && options?.length > 0 && (
                        <div className="max-h-[350px] overflow-y-auto w-full py-2 custom-scrollbar">
                            {filteredOptions?.length > 0 ? (
                                filteredOptions.map((opt, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-4 py-3 text-[14px] cursor-pointer transition-colors ${value === opt ? 'bg-[#F9FAFB] text-[#073318] font-bold' : 'text-[#4B5563] hover:bg-gray-50'}`}
                                        onClick={() => {
                                            onChange(opt);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                    >
                                        {translateDynamic(opt, t)}
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-4 text-[14px] text-gray-500 text-center">{t('common:no_options_found')}</div>
                            )}
                        </div>
                    )}

                    {actionLabel && onAction && (
                        <div className="border-t border-gray-100 p-3 bg-gray-50/50">
                            {isAddingNew ? (
                                <div className="flex flex-col gap-2 p-1">
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            autoFocus
                                            value={newValue}
                                            onChange={(e) => {
                                                setNewValue(e.target.value);
                                                if (e.target.value.trim()) setSubError(false);
                                            }}
                                            placeholder={t('common:enter_value')}
                                            className={`flex-1 h-[36px] px-3 bg-white border rounded-[8px] text-[13px] outline-none transition-colors ${subError ? 'border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.1)]' : 'border-gray-200 focus:border-[#073318]'}`}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddNew(e)}
                                        />
                                        <button
                                            onClick={handleAddNew}
                                            className="h-[36px] px-4 bg-[#073318] text-white text-[12px] font-bold rounded-[8px] hover:bg-[#04200f] transition-colors"
                                        >
                                            {t('common:add')}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsAddingNew(false);
                                                setNewValue('');
                                                setSubError(false);
                                            }}
                                            className="h-[36px] px-3 text-[#6B7280] text-[12px] font-semibold hover:bg-white rounded-[8px] transition-colors"
                                        >
                                            {t('common:cancel')}
                                        </button>
                                    </div>
                                    {subError && <span className="text-red-500 text-[11px] font-medium ml-1">{t('common:value_required', 'Value is required')}</span>}
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsAddingNew(true);
                                    }}
                                    className="w-full h-[44px] bg-[#073318] text-white text-[14px] font-bold hover:bg-[#04200f] transition-all flex items-center justify-center gap-2 rounded-[10px] shadow-sm"
                                >
                                    <Plus size={18} strokeWidth={3} /> {actionLabel}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const UnitForm = ({ mode = 'add', initialData = null, onBack, onSuccess, onEdit }) => {
    const { t } = useTranslation(['modules', 'common']);
    const [loading, setLoading] = useState(false);
    const [unitNameOptions, setUnitNameOptions] = useState([]);
    const [gstUomOptions, setGstUomOptions] = useState([]);
    const [fullNameOptions, setFullNameOptions] = useState([]);
    const [unitLibrary, setUnitLibrary] = useState([]); // Store mapping of Full Name <-> GST UOM

    const [formData, setFormData] = useState({
        unit_name: '',
        gst_uom: '',
        full_name_of_measurement: '',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if ((mode === 'edit' || mode === 'view') && initialData) {
            setFormData({
                unit_name: initialData.unit_name || '',
                gst_uom: initialData.gst_uom || '',
                full_name_of_measurement: initialData.full_name_of_measurement || '',
            });
        } else if (mode === 'add') {
            setFormData({
                unit_name: '',
                gst_uom: '',
                full_name_of_measurement: '',
            });
        }
    }, [initialData, mode]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const response = await unitService.getUnitNames();
                const filteredNames = (response.data || []).filter(name => name && name.trim() !== '-');
                setUnitNameOptions(filteredNames);

                if ((mode === 'edit' || mode === 'view') && initialData) {
                    if (initialData.unit_name) {
                        try {
                            const libRes = await unitService.getUnitLibrary({ unit_name: initialData.unit_name });
                            const library = libRes.data || [];
                            setUnitLibrary(library);
                            setGstUomOptions([...new Set(library.map(item => item.gst_uom))]);
                            setFullNameOptions([...new Set(library.map(item => item.full_name_of_measurement))]);
                        } catch (err) { console.error("Error loading library details:", err); }
                    }
                }
            } catch (error) {
                console.error('Error loading initial data:', error);
            }
        };
        loadInitialData();
    }, [mode, initialData]);

    const handleUnitNameChange = async (value) => {
        setFormData(prev => ({
            ...prev,
            unit_name: value,
            gst_uom: '',
            full_name_of_measurement: ''
        }));
        setErrors(prev => ({ ...prev, unit_name: '' }));

        if (value) {
            try {
                // Fetch library mappings for this unit name
                const response = await unitService.getUnitLibrary({ unit_name: value });
                const library = response.data || [];
                setUnitLibrary(library);

                // Populate both dropdowns from the library
                const uoms = [...new Set(library.map(item => item.gst_uom))];
                const measurements = [...new Set(library.map(item => item.full_name_of_measurement))];

                setGstUomOptions(uoms);
                setFullNameOptions(measurements);
            } catch (error) {
                console.error('Error loading library for unit:', error);
            }
        } else {
            setGstUomOptions([]);
            setFullNameOptions([]);
            setUnitLibrary([]);
        }
    };

    const handleGstUomChange = (value) => {
        // Find matching measurement from library
        const match = unitLibrary.find(item => item.gst_uom === value);
        const measurementName = match ? match.full_name_of_measurement : '';

        setFormData(prev => ({
            ...prev,
            gst_uom: value,
            full_name_of_measurement: measurementName || prev.full_name_of_measurement
        }));
        setErrors(prev => ({ ...prev, gst_uom: '', full_name_of_measurement: '' }));
    };

    const handleFullNameChange = (value) => {
        // Find matching GST UOM from library
        const match = unitLibrary.find(item => item.full_name_of_measurement === value);
        const uomCode = match ? match.gst_uom : '';

        setFormData(prev => ({
            ...prev,
            full_name_of_measurement: value,
            gst_uom: uomCode || prev.gst_uom
        }));
        setErrors(prev => ({ ...prev, full_name_of_measurement: '', gst_uom: '' }));
    };

    const handleAddCustomUnitName = (newValue) => {
        if (!unitNameOptions.includes(newValue)) {
            setUnitNameOptions(prev => [...prev, newValue]);
        }
        handleUnitNameChange(newValue);
    };

    const handleAddCustomGstUom = (newValue) => {
        if (!gstUomOptions.includes(newValue)) {
            setGstUomOptions(prev => [...prev, newValue]);
        }
        setFormData(prev => ({ ...prev, gst_uom: newValue }));
        setErrors(prev => ({ ...prev, gst_uom: '' }));
    };

    const handleAddCustomFullName = (newValue) => {
        if (!fullNameOptions.includes(newValue)) {
            setFullNameOptions(prev => [...prev, newValue]);
        }
        setFormData(prev => ({ ...prev, full_name_of_measurement: newValue }));
        setErrors(prev => ({ ...prev, full_name_of_measurement: '' }));
    };

    const isDirty = mode === 'edit' && initialData ? (
        formData.unit_name !== initialData.unit_name ||
        formData.gst_uom !== initialData.gst_uom ||
        formData.full_name_of_measurement !== initialData.full_name_of_measurement
    ) : true;

    const handleSubmit = async () => {
        if (mode === 'edit' && !isDirty) {
            toast.error(t("common:please_make_changes_to_save", "Please make changes to save"));
            return;
        }

        const newErrors = {};
        if (!formData.unit_name) newErrors.unit_name = t('modules:unit_name_required', 'Unit Name is required');
        if (!formData.gst_uom) newErrors.gst_uom = t('modules:gst_uom_required', 'GST UOM is required');
        if (!formData.full_name_of_measurement) newErrors.full_name_of_measurement = t('modules:measurement_name_required', 'Measurement Name is required');

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setLoading(true);
            const payload = {
                unit_name: formData.unit_name,
                gst_uom: formData.gst_uom,
                full_name_of_measurement: formData.full_name_of_measurement
            };

            if (mode === 'add') {
                await unitService.createUnit(payload);
            } else {
                const updateId = initialData?.id;
                if (!updateId) throw new Error(t('common:error_invalid_id'));
                await unitService.updateUnit(updateId, payload);
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving unit:', error);
            toast.error(error.response?.data?.message || t('common:error_saving_data'));
        } finally {
            setLoading(false);
        }
    };

    const isView = mode === 'view';

    const renderViewMode = () => (
        <div className="flex flex-col w-full bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] animate-in fade-in duration-300">
            <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                <div>
                    <h3 className="text-[20px] font-bold text-[#111827]">{t('modules:view_unit')}</h3>
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 h-[44px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
                >
                    <ArrowLeft size={18} />
                    {t('common:back')}
                </button>
            </div>

            <div className="flex flex-col">
                {[
                    { label: t('modules:unit_name'), value: formData.unit_name },
                    { label: t('modules:full_name_of_measurement'), value: formData.full_name_of_measurement || '-' },
                    { label: t('modules:gst_uom'), value: formData.gst_uom }
                ].map((item, idx) => (
                    <div key={idx} className="flex border-b border-[#F3F4F6] min-h-[56px] last:border-b-0 group">
                        <div className="w-[240px] bg-[#F9FAFB] px-8 py-4 flex items-center border-r border-[#F3F4F6]">
                            <span className="text-[14px] font-bold text-gray-500 uppercase tracking-tight">{item.label}:</span>
                        </div>
                        <div className="flex-1 px-8 py-4 flex items-center bg-white group-hover:bg-[#F9FAFB]/50 transition-colors">
                            <span className="text-[16px] font-bold text-[#111827]">{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="px-8 py-6 bg-[#F9FAFB]/50 flex justify-end gap-3 border-t border-[#F3F4F6]">
                <button
                    onClick={onBack}
                    className="px-8 h-[46px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-white transition-all bg-white"
                >
                    {t('common:cancel')}
                </button>
                <button
                    onClick={() => initialData && onEdit && onEdit(initialData)}
                    className="px-8 h-[46px] bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#04200f] transition-all shadow-sm flex items-center justify-center min-w-[140px]"
                >
                    {t('modules:edit_unit')}
                </button>
            </div>
        </div>
    );

    if (isView) {
        return (
            <div className="flex flex-col w-full h-full p-2">
                {renderViewMode()}
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full animate-in fade-in duration-300 p-2">
            <div className={`bg-white rounded-[16px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col w-full mb-12 transition-all duration-300 ${isView ? 'overflow-hidden' : 'overflow-visible'}`}>
                {/* Header */}
                <div className="px-8 py-6 border-b border-[#F3F4F6] bg-white flex items-center justify-between">
                    <div>
                        <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                            {mode === 'add' ? t('modules:add_new_unit') : (mode === 'edit' ? t('modules:edit_unit_details') : t('modules:view_unit_details'))}
                        </h2>
                    </div>
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-6 h-[44px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-gray-50 transition-all bg-white shadow-sm"
                    >
                        <ArrowLeft size={18} />
                        {t('common:back')}
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-8 md:p-10 flex flex-col gap-8 w-full">
                    <div className="grid grid-cols-1 gap-8 w-full">
                        <CustomSelect
                            label={t('modules:unit_name')}
                            placeholder={t('modules:select_unit_category')}
                            options={unitNameOptions}
                            value={formData.unit_name}
                            onChange={handleUnitNameChange}
                            showAsterisk={true}
                            disabled={isView}
                            actionLabel={t('modules:add_unit_name')}
                            onAction={handleAddCustomUnitName}
                            error={errors.unit_name}
                        />

                        <CustomSelect
                            label={t('modules:full_name_of_measurement')}
                            placeholder={t('modules:select_or_enter_full_name')}
                            options={fullNameOptions}
                            value={formData.full_name_of_measurement}
                            onChange={handleFullNameChange}
                            isSearchable={true}
                            disabled={isView || !formData.unit_name}
                            showAsterisk={true}
                            actionLabel={t('modules:add_full_name_of_measurement')}
                            onAction={handleAddCustomFullName}
                            error={errors.full_name_of_measurement}
                        />

                        <CustomSelect
                            label={t('modules:gst_uom')}
                            placeholder={t('modules:select_gst_uom')}
                            options={gstUomOptions}
                            value={formData.gst_uom}
                            onChange={handleGstUomChange}
                            isSearchable={true}
                            disabled={isView || !formData.unit_name}
                            showAsterisk={true}
                            actionLabel={t('modules:add_gst_uom')}
                            onAction={handleAddCustomGstUom}
                            error={errors.gst_uom}
                        />
                    </div>
                </div>

                {/* Footer Buttons - Only for Add/Edit Mode */}
                {!isView && (
                    <div className="px-8 py-6 bg-[#F9FAFB]/50 flex justify-end gap-3 border-t border-[#F3F4F6]">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className={`px-8 h-[46px] text-white rounded-[10px] text-[14px] font-bold transition-all shadow-md flex items-center justify-center min-w-[160px] ${loading ? 'bg-gray-400 cursor-not-allowed shadow-none' : 'bg-[#073318] hover:bg-[#04200f]'}`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : t('modules:save')}
                        </button>
                        <button
                            type="button"
                            onClick={onBack}
                            disabled={loading}
                            className="px-8 h-[46px] border border-[#E5E7EB] text-[#4B5563] rounded-[10px] text-[14px] font-bold hover:bg-white transition-all bg-white shadow-sm flex items-center justify-center"
                        >
                            {t('common:cancel')}
                        </button>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #E5E7EB;
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #D1D5DB;
                }
            `}</style>
        </div>
    );
};

export default UnitForm;
