import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from "@/constants/routes";
import { useTranslation } from 'react-i18next';
import { toDisplayDate } from '@/utils/dateUtils';
import DateInput from '@/components/common/DateInput';

const ChallanForm = ({
    formData,
    setFormData,
    handleCustomerChange,
    handleSOChange,
    customers = [],
    sos = [],
    errors,
    bookingDateRef,
    challanDateRef,
    type = 'Challan',
    onAddCustomer
}) => {
    const { t } = useTranslation(['modules', 'common']);
    const isChallan = type === 'Challan';
    const numLabel = isChallan ? t('modules:challan', 'Challan') : t('modules:invoice', 'Invoice');
    const dateLabel = isChallan ? t('modules:challan', 'Challan') : t('modules:invoice', 'Invoice');
    const navigate = useNavigate();
    const [customerSearch, setCustomerSearch] = useState(formData.customerName || '');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

    React.useEffect(() => {
        setCustomerSearch(formData.customerName || '');
    }, [formData.customerName]);

    const filteredCustomers = useMemo(() => {
        return (customers || []).filter(c =>
            c.accountName?.toLowerCase().includes(customerSearch.toLowerCase())
        );
    }, [customerSearch, customers]);

    // Local duplicate date helpers removed in favor of central import

    return (
        <div className="space-y-8 font-outfit">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* 1. Customer Name */}
                <div className="space-y-2 relative">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:customer_name', 'Customer Name')} <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t('modules:select_customer_name', 'Select customer name')}
                            value={customerSearch}
                            onFocus={() => setIsCustomerDropdownOpen(true)}
                            onChange={(e) => {
                                setCustomerSearch(e.target.value);
                                setIsCustomerDropdownOpen(true);
                            }}
                            className={`w-full h-[48px] bg-white border rounded-[10px] px-4 pr-14 text-[14px] font-bold outline-none transition-all ${errors.customerName ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                        />
                        {formData.customerId && !isCustomerDropdownOpen && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData(prev => ({
                                        ...prev,
                                        customerId: '',
                                        customerName: '',
                                        customerType: '',
                                        address: '',
                                        gstNo: '',
                                        creditDays: 0,
                                        customerState: '',
                                        soId: '',
                                        soNumber: '',
                                        challanIds: []
                                    }));
                                    setCustomerSearch('');
                                }}
                                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />

                        {isCustomerDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-[65]" onClick={() => setIsCustomerDropdownOpen(false)}></div>
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-[70] overflow-hidden border-t-4 border-t-emerald-800">
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {filteredCustomers.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => {
                                                    handleCustomerChange(c.id);
                                                    setCustomerSearch(c.accountName);
                                                    setIsCustomerDropdownOpen(false);
                                                }}
                                                className="w-full text-left px-5 py-3.5 hover:bg-emerald-50 transition-all border-b border-[#F3F4F6] last:border-0"
                                            >
                                                <div className="font-bold text-[#111827] text-[15px]">{c.accountName}</div>
                                                <div className="text-[12px] text-gray-400 mt-0.5 font-medium">{c.gstNo || 'No GST Number'}</div>
                                            </button>
                                        ))}
                                        {filteredCustomers.length === 0 && (
                                            <div className="px-5 py-8 text-[13px] text-gray-400 italic text-center">No results for "{customerSearch}"</div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (onAddCustomer) {
                                                    onAddCustomer();
                                                } else {
                                                    navigate(`/seller/masters/account-master/add?redirect=${ROUTES.CHALLAN_ADD}`);
                                                }
                                            }}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold shadow-md hover:bg-[#052611] transition-all"
                                        >
                                            <Plus size={16} /> Add new customer
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {errors.customerName && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.customerName}</p>}
                </div>

                {/* 2. Customer Type — Auto-fetched from Account Master */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:customer_type', 'Customer Type')}</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.customerType || ''}
                        placeholder={t('modules:auto_fetched_on_customer_select', 'Auto-fetched on customer select')}
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-600 cursor-not-allowed"
                    />
                </div>

                {/* 3. Credit Days — Auto-fetched from Account Master, editable */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:credit_days', 'Credit Days')}</label>
                    <input
                        type="number"
                        min="0"
                        value={formData.creditDays !== undefined && formData.creditDays !== '' ? formData.creditDays : ''}
                        placeholder={t('modules:auto_fetched_on_customer_select', 'Auto-fetched on customer select')}
                        onChange={(e) => setFormData(prev => ({ ...prev, creditDays: e.target.value }))}
                        readOnly={!!formData.soId}
                        className={`w-full h-[48px] border rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all ${
                            formData.soId
                                ? 'bg-gray-50 border-[#E5E7EB] text-gray-500 cursor-not-allowed'
                                : 'bg-white text-[#111827] focus:border-[#073318] border-[#E5E7EB]'
                        }`}
                    />
                </div>

                {/* 4. Address — Auto-fetched from Account Master */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:address', 'Address')}</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.address || ''}
                        placeholder={t('modules:auto_fetched_on_customer_select', 'Auto-fetched on customer select')}
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-600 cursor-not-allowed"
                    />
                </div>

                {/* 5. Booking Date — Default today, non-editable */}
                <DateInput
                    label={t('modules:booking_date', 'Booking Date') + ' (Current Date)'}
                    required
                    value={toDisplayDate(new Date())}
                    isLocked={true}
                    onChange={() => {}}
                />

                {/* 6. GST Number — Auto-fetched from Account Master */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:gst_number_col', 'GST Number')}</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.gstNo || ''}
                        placeholder={t('modules:auto_fetched_on_customer_select', 'Auto-fetched on customer select')}
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-600 cursor-not-allowed"
                    />
                </div>

                {/* 7. SO Number (Optional) */}
                <div className="space-y-2 relative">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:so_number_optional', 'SO Number (Optional)')}</label>
                    <div className="relative">
                        <select
                            className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-14 text-[14px] font-bold outline-none focus:border-[#073318] appearance-none"
                            value={formData.soId || ""}
                            onChange={(e) => handleSOChange(e.target.value)}
                        >
                            <option value="">{t('modules:select_so_number', 'Select SO Number')}</option>
                            {sos.map(p => <option key={p.id} value={p.id}>{p.soNumber}</option>)}
                        </select>
                        {formData.soId && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSOChange("");
                                }}
                                className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors z-10"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                {/* 8. Customer Challan Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{t('modules:customer', 'Customer')} {numLabel} {t('modules:number', 'Number')} <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        readOnly
                        value={formData.customerChallanNumber || ''}
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed shadow-sm"
                        placeholder="Auto-generated"
                    />
                </div>

                {/* 9. Challan Date */}
                <DateInput
                    label={dateLabel + ' ' + t('modules:date', 'Date')}
                    required
                    value={toDisplayDate(formData.customerChallanDate)}
                    minDate={formData.soId && formData.soCreationDate ? toDisplayDate(formData.soCreationDate) : (() => {
                        const today = new Date();
                        const currentMonth = today.getMonth();
                        const startYear = currentMonth < 3 ? today.getFullYear() - 1 : today.getFullYear();
                        return `${startYear}-04-01`;
                    })()}
                    maxDate={toDisplayDate(new Date())}
                    onChange={(val) => setFormData({ ...formData, customerChallanDate: val })}
                    error={errors.customerChallanDate}
                />
            </div>
        </div>
    );
};

export default ChallanForm;
