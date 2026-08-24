import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from "@/constants/routes";
import GRNMultiSelect from './GRNMultiSelect';
import { useTranslation } from 'react-i18next';
import { toDisplayDate } from '@/utils/dateUtils';
import DateInput from '@/components/common/DateInput';

const GRNForm = ({
    formData,
    setFormData,
    handleSupplierChange,
    handlePOChange,
    handleChallanChange,
    suppliers,
    pos,
    challans = [],
    errors,
    challanDateRef,
    minDate,
    maxDate,
    isDocumentDateReadOnly = false,
    type = 'GRN',
    onAddSupplier
}) => {
    const { t } = useTranslation(['common', 'modules']);
    const isGRN = type === 'GRN';
    const numLabel = isGRN ? t('modules:challan_tab', 'Challan') : t('modules:invoice_purchase_tab', 'Invoice');
    const navigate = useNavigate();
    const fieldForNumber = isGRN ? 'supplier_challan_number' : 'supplier_invoice_number';
    const [supplierSearch, setSupplierSearch] = useState(formData.supplier_name || '');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

    // Dynamic Label Correction
    const displayDateLabel = isGRN ? t('modules:supplier_challan_no', 'Supplier Challan') : t('modules:supplier_invoice_no', 'Supplier Invoice');

    React.useEffect(() => {
        setSupplierSearch(formData.supplier_name || '');
    }, [formData.supplier_name]);

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s =>
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase())
        );
    }, [supplierSearch, suppliers]);

    // Local duplicate date helpers removed in favor of central import

    return (
        <div className="space-y-8 font-outfit">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* 1. Supplier Name */}
                <div className="space-y-2 relative">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:supplier_name', 'Supplier Name')} <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t('modules:select_supplier_name', 'Select supplier name')}
                            value={supplierSearch}
                            onFocus={() => setIsSupplierDropdownOpen(true)}
                            onChange={(e) => {
                                setSupplierSearch(e.target.value);
                                setIsSupplierDropdownOpen(true);
                            }}
                            className={`w-full h-[48px] bg-white border rounded-[10px] px-4 pr-14 text-[14px] font-bold outline-none transition-all ${errors.supplier_name ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                        />
                        {formData.supplier_id && !isSupplierDropdownOpen && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData(prev => ({
                                        ...prev,
                                        supplier_id: '',
                                        supplier_name: '',
                                        address: '',
                                        gst_no: '',
                                        credit_days: 0,
                                        supplier_state: '',
                                        po_id: '',
                                        po_number: ''
                                    }));
                                    setSupplierSearch('');
                                }}
                                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />

                        {isSupplierDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-[65]" onClick={() => setIsSupplierDropdownOpen(false)}></div>
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[70] overflow-hidden border-t-4 border-t-emerald-800">
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {filteredSuppliers.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    handleSupplierChange(s.id);
                                                    setSupplierSearch(s.accountName);
                                                    setIsSupplierDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-5 py-3.5 hover:bg-emerald-50 transition-all border-b border-[#F3F4F6] last:border-0"
                                            >
                                                <div className="font-bold text-[#111827] text-[15px]">{s.accountName}</div>
                                                <div className="text-[12px] text-gray-400 mt-0.5 font-medium">{s.gstNo || 'No GST Number'}</div>
                                            </button>
                                        ))}
                                        {filteredSuppliers.length === 0 && (
                                            <div className="px-5 py-8 text-[13px] text-gray-400 italic text-center">{t('common:no_results_found', 'No results found')}</div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (onAddSupplier) {
                                                    onAddSupplier();
                                                } else {
                                                    navigate(`/seller/masters/account-master/add?redirect=${isGRN ? ROUTES.GRN_ADD : ROUTES.PURCHASE_INVOICE_ADD}`);
                                                }
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold shadow-md hover:bg-[#052611] transition-all"
                                        >
                                            <Plus size={16} /> {t('modules:add_new_supplier', 'Add new supplier')}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {errors.supplier_name && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.supplier_name}</p>}
                </div>

                {/* 2. Credit Days */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:credit_days', 'Credit Days')} <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.credit_days !== undefined && formData.credit_days !== null && formData.credit_days !== '' ? formData.credit_days : ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, credit_days: e.target.value }))}
                        readOnly={!!formData.po_id}
                        className={`w-full h-[48px] border rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all shadow-sm ${
                            formData.po_id
                                ? 'bg-gray-50 border-[#E5E7EB] text-gray-500 cursor-not-allowed'
                                : `bg-white focus:border-[#073318] ${errors.credit_days ? 'border-red-500' : 'border-[#E5E7EB]'}`
                        }`}
                    />
                    {errors.credit_days && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.credit_days}</p>}
                </div>

                {/* 3. Address */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('common:address', 'Address')} <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        placeholder={t('modules:auto_fetched_desc', 'Auto-fetched from Account Master')}
                        value={formData.address || ''}
                        readOnly
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed shadow-sm"
                    />
                    {errors.address && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.address}</p>}
                </div>

                {/* 4. GST Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:gst_no', 'GST Number')}</label>
                    <input
                        type="text"
                        placeholder={t('modules:auto_fetched_desc', 'Auto-fetched from Account Master')}
                        value={formData.gst_no || ''}
                        readOnly
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed shadow-sm"
                    />
                </div>

                {/* 5. Link Purchase Order */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:po_no', 'PO Number')}</label>
                    <div className="relative">
                        <select
                            className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-14 text-[14px] font-bold outline-none focus:border-[#073318] appearance-none"
                            value={formData.po_id || ""}
                            onChange={(e) => handlePOChange(e.target.value)}
                        >
                            <option value="">{t('modules:select_po_number', 'Select PO Number')}</option>
                            {pos.map(p => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
                        </select>
                        {formData.po_id && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handlePOChange("");
                                }}
                                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors z-10"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                {/* 5.1 GRN Number (Auto Generated) */}
                {isGRN && (
                    <div className="space-y-2">
                        <label className="text-[14px] font-semibold text-[#374151]">{t('modules:grn_no', 'GRN No')}</label>
                        <input
                            type="text"
                            placeholder="Auto-generated (e.g. GRN-0001)"
                            value={formData.document_number || formData.grn_number || ''}
                            readOnly
                            className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-700 cursor-not-allowed shadow-sm"
                        />
                    </div>
                )}

                {/* 6. Supplier Challan/Invoice Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:supplier_no_label', 'Supplier {{label}} Number', { label: numLabel })} <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        placeholder={t('modules:enter_no_placeholder', 'Enter {{label}} no.', { label: numLabel.toLowerCase() })}
                        value={formData[fieldForNumber] || ''}
                        onChange={(e) => setFormData({ ...formData, [fieldForNumber]: e.target.value })}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all ${errors[fieldForNumber] ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                    />
                    {errors[fieldForNumber] && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors[fieldForNumber]}</p>}
                </div>

                {/* 6.1 Supplier Challan Number (Only for Invoice) */}
                {type === 'Invoice' && (
                    <div className="space-y-2 font-outfit">
                        <label className="text-[14px] font-semibold text-[#374151]">{t('modules:supplier_challan_no', 'Supplier Challan Number')}</label>
                        <GRNMultiSelect 
                            challans={challans}
                            selectedIds={formData.grn_ids || []}
                            onChange={(ids) => handleChallanChange(ids)}
                        />
                    </div>
                )}

                {/* 7. Challan/Invoice Date */}
                <DateInput
                    label={isGRN ? t('modules:supplier_challan_date', 'Supplier Challan Date') : t('modules:supplier_invoice_date', 'Supplier Invoice Date')}
                    required
                    value={toDisplayDate(formData.document_date)}
                    minDate={minDate}
                    maxDate={maxDate || toDisplayDate(new Date())}
                    isLocked={isDocumentDateReadOnly}
                    onChange={(val) => setFormData({ ...formData, document_date: val })}
                    error={errors.document_date}
                />

                {/* 8. Booking Date - Frozen current date */}
                <DateInput
                    label={t('modules:booking_date', 'Booking Date')}
                    value={toDisplayDate(formData.booking_date)}
                    isLocked={true}
                    onChange={() => {}}
                />
            </div>
        </div>
    );
};

export default GRNForm;
