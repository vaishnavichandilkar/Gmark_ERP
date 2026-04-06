import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Info, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import unitService from '../../../../services/masters/unitService';
import { translateDynamic } from '../../../../utils/i18nUtils';

const AddUomModal = ({ isOpen, onClose, onSuccess, onShowToast }) => {
    const { t } = useTranslation(['common', 'modules']);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        unit_name: '',
        gst_uom: '',
        full_name_of_measurement: '',
    });
    const [errors, setErrors] = useState({});

    const [unitNameOptions, setUnitNameOptions] = useState([]);
    const [gstUomOptions, setGstUomOptions] = useState([]);
    const [fullNameOptions, setFullNameOptions] = useState([]);
    const [unitLibrary, setUnitLibrary] = useState([]);

    const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
    const [isUomDropdownOpen, setIsUomDropdownOpen] = useState(false);
    const [isFullDropdownOpen, setIsFullDropdownOpen] = useState(false);

    const nameRef = useRef(null);
    const uomRef = useRef(null);
    const fullRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                unit_name: '',
                gst_uom: '',
                full_name_of_measurement: '',
            });
            setErrors({});
            fetchInitialData();
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        try {
            const response = await unitService.getUnitNames();
            const filteredNames = (response.data || []).filter(name => name && name.trim() !== '-');
            setUnitNameOptions(filteredNames);
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (nameRef.current && !nameRef.current.contains(event.target)) setIsNameDropdownOpen(false);
            if (uomRef.current && !uomRef.current.contains(event.target)) setIsUomDropdownOpen(false);
            if (fullRef.current && !fullRef.current.contains(event.target)) setIsFullDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleUnitNameChange = async (value) => {
        setFormData(prev => ({
            ...prev,
            unit_name: value,
            gst_uom: '',
            full_name_of_measurement: ''
        }));
        setErrors(prev => ({ ...prev, unit_name: '' }));
        setIsNameDropdownOpen(false);

        if (value) {
            try {
                const response = await unitService.getUnitLibrary({ unit_name: value });
                const library = response.data || [];
                setUnitLibrary(library);
                setGstUomOptions([...new Set(library.map(item => item.gst_uom))]);
                setFullNameOptions([...new Set(library.map(item => item.full_name_of_measurement))]);
            } catch (error) {
                console.error('Error loading library for unit:', error);
            }
        }
    };

    const handleGstUomChange = (value) => {
        const match = unitLibrary.find(item => item.gst_uom === value);
        const measurementName = match ? match.full_name_of_measurement : '';
        setFormData(prev => ({
            ...prev,
            gst_uom: value,
            full_name_of_measurement: measurementName || prev.full_name_of_measurement
        }));
        setErrors(prev => ({ ...prev, gst_uom: '', full_name_of_measurement: '' }));
        setIsUomDropdownOpen(false);
    };

    const handleFullNameChange = (value) => {
        const match = unitLibrary.find(item => item.full_name_of_measurement === value);
        const uomCode = match ? match.gst_uom : '';
        setFormData(prev => ({
            ...prev,
            full_name_of_measurement: value,
            gst_uom: uomCode || prev.gst_uom
        }));
        setErrors(prev => ({ ...prev, full_name_of_measurement: '', gst_uom: '' }));
        setIsFullDropdownOpen(false);
    };

    const handleSave = async () => {
        const newErrors = {};
        if (!formData.unit_name) newErrors.unit_name = t('modules:unit_name_required');
        if (!formData.gst_uom) newErrors.gst_uom = t('modules:gst_uom_required');
        if (!formData.full_name_of_measurement) newErrors.full_name_of_measurement = t('modules:measurement_name_required');

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsLoading(true);
        try {
            const result = await unitService.createUnit(formData);
            onShowToast && onShowToast(t('modules:unit_added_successfully', 'Unit added successfully'));
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
                        {t('modules:add_new_unit')}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-5">
                        {/* Unit Name Category */}
                        <div className="space-y-2 relative" ref={nameRef}>
                            <label className="text-[13px] font-semibold text-gray-600">{t('modules:unit_name')} <span className="text-red-500">*</span></label>
                            <div
                                className={`w-full h-[46px] border rounded-xl flex items-center justify-between px-4 cursor-pointer transition-all ${isNameDropdownOpen ? 'border-emerald-600 ring-4 ring-emerald-600/5' : 'border-gray-200 hover:border-gray-300'} ${errors.unit_name ? 'border-red-500 bg-red-50/10' : ''}`}
                                onClick={() => setIsNameDropdownOpen(!isNameDropdownOpen)}
                            >
                                <span className={`text-[14px] ${formData.unit_name ? 'text-gray-900 font-medium' : 'text-gray-400 italic'}`}>
                                    {formData.unit_name ? formData.unit_name : t('modules:select_unit_category')}
                                </span>
                                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isNameDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                            {isNameDropdownOpen && (
                                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-2xl z-[110] py-2 max-h-[180px] overflow-y-auto dropdown-scrollbar animate-in slide-in-from-top-2">
                                    {unitNameOptions.map((opt) => (
                                        <div
                                            key={opt}
                                            className={`px-4 py-2.5 text-[14px] cursor-pointer hover:bg-emerald-50 transition-colors ${formData.unit_name === opt ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-600'}`}
                                            onClick={() => handleUnitNameChange(opt)}
                                        >
                                            {opt}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {errors.unit_name && <p className="text-[11px] text-red-500 ml-1 mt-0.5 font-medium">{errors.unit_name}</p>}
                        </div>

                        {/* GST UOM */}
                        <div className="space-y-2 relative" ref={uomRef}>
                            <label className="text-[13px] font-semibold text-gray-600">{t('modules:gst_uom')} <span className="text-red-500">*</span></label>
                            <div
                                className={`w-full h-[46px] border rounded-xl flex items-center justify-between px-4 cursor-pointer transition-all ${isUomDropdownOpen ? 'border-emerald-600 ring-4 ring-emerald-600/5' : 'border-gray-200 hover:border-gray-300'} ${!formData.unit_name ? 'bg-gray-50 opacity-60 cursor-not-allowed' : ''} ${errors.gst_uom ? 'border-red-500 bg-red-50/10' : ''}`}
                                onClick={() => formData.unit_name && setIsUomDropdownOpen(!isUomDropdownOpen)}
                            >
                                <span className={`text-[14px] ${formData.gst_uom ? 'text-gray-900 font-medium' : 'text-gray-400 italic'}`}>
                                    {formData.gst_uom ? formData.gst_uom : t('modules:select_gst_uom')}
                                </span>
                                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isUomDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                            {isUomDropdownOpen && (
                                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-2xl z-[110] py-2 max-h-[180px] overflow-y-auto dropdown-scrollbar animate-in slide-in-from-top-2">
                                    {gstUomOptions.map((opt) => (
                                        <div
                                            key={opt}
                                            className={`px-4 py-2.5 text-[14px] cursor-pointer hover:bg-emerald-50 transition-colors ${formData.gst_uom === opt ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-600'}`}
                                            onClick={() => handleGstUomChange(opt)}
                                        >
                                            {opt}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {errors.gst_uom && <p className="text-[11px] text-red-500 ml-1 mt-0.5 font-medium">{errors.gst_uom}</p>}
                        </div>

                        {/* Full Name of Measurement */}
                        <div className="space-y-2 relative" ref={fullRef}>
                            <label className="text-[13px] font-semibold text-gray-600">{t('modules:full_name_of_measurement')} <span className="text-red-500">*</span></label>
                            <div
                                className={`w-full h-[46px] border rounded-xl flex items-center justify-between px-4 cursor-pointer transition-all ${isFullDropdownOpen ? 'border-emerald-600 ring-4 ring-emerald-600/5' : 'border-gray-200 hover:border-gray-300'} ${!formData.unit_name ? 'bg-gray-50 opacity-60 cursor-not-allowed' : ''} ${errors.full_name_of_measurement ? 'border-red-500 bg-red-50/10' : ''}`}
                                onClick={() => formData.unit_name && setIsFullDropdownOpen(!isFullDropdownOpen)}
                            >
                                <span className={`text-[14px] ${formData.full_name_of_measurement ? 'text-gray-900 font-medium' : 'text-gray-400 italic'}`}>
                                    {formData.full_name_of_measurement ? formData.full_name_of_measurement : t('modules:select_or_enter_full_name')}
                                </span>
                                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isFullDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                            {isFullDropdownOpen && (
                                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-xl shadow-2xl z-[110] py-2 max-h-[180px] overflow-y-auto dropdown-scrollbar animate-in slide-in-from-top-2">
                                    {fullNameOptions.map((opt) => (
                                        <div
                                            key={opt}
                                            className={`px-4 py-2.5 text-[14px] cursor-pointer hover:bg-emerald-50 transition-colors ${formData.full_name_of_measurement === opt ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-gray-600'}`}
                                            onClick={() => handleFullNameChange(opt)}
                                        >
                                            {opt}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {errors.full_name_of_measurement && <p className="text-[11px] text-red-500 ml-1 mt-0.5 font-medium">{errors.full_name_of_measurement}</p>}
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

export default AddUomModal;
