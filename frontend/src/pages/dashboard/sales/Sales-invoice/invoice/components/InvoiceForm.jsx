import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from "@/constants/routes";
import ChallanMultiSelect from '../../challan/components/ChallanMultiSelect';

const InvoiceForm = ({
    formData,
    setFormData,
    handleCustomerChange,
    handleSOChange,
    handleChallanChange,
    customers = [],
    sos = [],
    challans = [],
    errors = {},
    bookingDateRef,
    invoiceDateRef,
    onAddCustomer,
    minDate,
    maxDate,
    isLocked
}) => {
    const navigate = useNavigate();
    const [customerSearch, setCustomerSearch] = useState(formData.customerName || '');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

    React.useEffect(() => {
        setCustomerSearch(formData.customerName || '');
    }, [formData.customerName]);

    // Condition 3 & General Sync: If locked, force invoiceDate to minDate (which is today)
    React.useEffect(() => {
        if (isLocked && minDate && formData.customerInvoiceDate !== minDate) {
            setFormData(prev => ({ ...prev, customerInvoiceDate: minDate }));
        }
    }, [isLocked, minDate, formData.customerInvoiceDate]);

    const filteredCustomers = useMemo(() => {
        return (customers || []).filter(c =>
            c.accountName?.toLowerCase().includes(customerSearch.toLowerCase())
        );
    }, [customerSearch, customers]);

    const toDisplayDate = (dateStr) => {
        if (!dateStr) return "";
        const separator = dateStr.includes("-") ? "-" : "/";
        const parts = dateStr.split(separator);
        if (parts.length === 3) {
            // If ISO (YYYY-MM-DD), convert to DD/MM/YY
            if (parts[0].length === 4) {
                const yearShort = parts[0].slice(-2);
                return `${parts[2]}/${parts[1]}/${yearShort}`;
            }
            // If already DD/MM/YYYY or DD-MM-YYYY, convert to DD/MM/YY
            const lastPart = parts[2].slice(-2);
            return `${parts[0]}/${parts[1]}/${lastPart}`;
        }
        return dateStr;
    };

    const handleDateTextChange = (e, field) => {
        // Handled via readOnly + picker
    };

    return (
        <div className="space-y-8 font-outfit">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* 1. Customer Name */}
                <div className="space-y-2 relative">
                    <label className="text-[14px] font-semibold text-[#374151]">Customer Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Select customer name"
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
                                    handleCustomerChange(''); // Assuming empty ID clears it
                                    // Actually, looking at handleCustomerChange in AddSalesInvoice, it needs a valid ID.
                                    // I should probably pass null or empty string and handle it there, 
                                    // OR just manually clear the formData fields here if possible, 
                                    // but setFormData is available.
                                    setFormData(prev => ({
                                        ...prev,
                                        customerId: '',
                                        customerName: '',
                                        customerType: '',
                                        address: '',
                                        gstNo: '',
                                        creditDays: 0,
                                        customerState: '',
                                        challanIds: [],
                                        soId: '',
                                        soNumber: ''
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
                                                    navigate(`/seller/masters/account-master/add?redirect=${ROUTES.SALES_INVOICE_ADD}`);
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

                {/* 2. Customer Type */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Customer Type <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        readOnly
                        value={formData.customerType || ''}
                        placeholder="Auto-fetched on customer select"
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed shadow-sm"
                    />
                </div>

                {/* 3. Credit Days */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Credit Days <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter credit days"
                        value={formData.creditDays || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, creditDays: e.target.value }))}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all shadow-sm ${errors.creditDays ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                    />
                    {errors.creditDays && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.creditDays}</p>}
                </div>

                {/* 4. Address */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Address <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        readOnly
                        value={formData.address || ''}
                        placeholder="Auto-fetched on customer select"
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed shadow-sm"
                    />
                    {errors.address && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.address}</p>}
                </div>

                {/* 5. GST Number (Optional) */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">GST Number (Optional)</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.gstNo || ''}
                        placeholder="Auto-fetched on customer select"
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed shadow-sm"
                    />
                </div>

                {/* 6. SO Number (Optional) */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">SO Number (Optional)</label>
                    <div className="relative">
                        <select
                            className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] font-bold outline-none focus:border-[#073318] appearance-none"
                            value={formData.soId || ""}
                            onChange={(e) => handleSOChange(e.target.value)}
                        >
                            <option value="">Enter SO number</option>
                            {sos.map(p => <option key={p.id} value={p.id}>{p.soNumber}</option>)}
                            {formData.soNumber && !sos.find(s => String(s.id) === String(formData.soId)) && (
                                <option value={formData.soId}>{formData.soNumber}</option>
                            )}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                {/* 7. Customer Invoice Date */}
                <div className="space-y-2 font-outfit">
                    <label className="text-[14px] font-semibold text-[#374151]">Customer Invoice Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="date"
                            ref={invoiceDateRef}
                            className="absolute opacity-0 pointer-events-none w-0 h-0"
                            value={formData.customerInvoiceDate || ''}
                            min={minDate}
                            max={maxDate}
                            onKeyDown={(e) => e.preventDefault()}
                            onChange={(e) => setFormData({ ...formData, customerInvoiceDate: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={toDisplayDate(formData.customerInvoiceDate)}
                            readOnly
                            onClick={() => !isLocked && invoiceDateRef.current?.showPicker?.()}
                            className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all shadow-sm ${
                                isLocked ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-[#E5E7EB]' : 
                                `cursor-pointer ${errors.customerInvoiceDate ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`
                            }`}
                        />
                        <Calendar
                            size={18}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${
                                isLocked ? 'text-gray-300 pointer-events-none' : 'text-gray-400 cursor-pointer pointer-events-auto hover:text-[#073318]'
                            }`}
                            onClick={() => !isLocked && invoiceDateRef.current?.showPicker?.()}
                        />
                    </div>
                </div>

                {/* 8. Booking Date */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Booking Date (Current Date) <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            value={toDisplayDate(new Date().toISOString().split('T')[0])}
                            readOnly
                            className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all text-gray-500 cursor-not-allowed shadow-sm"
                            placeholder="DD/MM/YYYY"
                        />
                        <Calendar
                            size={18}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
                        />
                    </div>
                </div>

                {/* 9. Customer Invoice Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Customer Invoice Number <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        placeholder="Enter customer invoice number"
                        value={formData.customerInvoiceNumber || ''}
                        onChange={(e) => setFormData({ ...formData, customerInvoiceNumber: e.target.value })}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all ${errors.customerInvoiceNumber ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                    />
                    {errors.customerInvoiceNumber && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.customerInvoiceNumber}</p>}
                </div>

                {/* 10. Customer Challan Number (Optional) */}
                <div className="space-y-2 relative">
                    <label className="text-[14px] font-semibold text-[#374151]">Customer Challan Number (Optional)</label>
                    <ChallanMultiSelect
                        challans={challans}
                        selectedIds={formData.challanIds || []}
                        onChange={(ids) => handleChallanChange(ids)}
                    />
                </div>
            </div>
        </div>
    );
};

export default InvoiceForm;
