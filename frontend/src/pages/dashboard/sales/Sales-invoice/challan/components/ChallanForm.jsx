import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from "@/constants/routes";

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
    const isChallan = type === 'Challan';
    const numLabel = isChallan ? 'Challan' : 'Invoice';
    const dateLabel = isChallan ? 'Challan' : 'Invoice';
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

    const toDisplayDate = (dateStr) => {
        if (!dateStr) return "";
        const parts = dateStr.includes("-") ? dateStr.split("-") : dateStr.split("/");
        if (parts.length === 3) {
            // If ISO (YYYY-MM-DD), convert to DD/MM/YY
            if (parts[0].length === 4) {
                const yearShort = parts[0].slice(-2);
                return `${parts[2]}/${parts[1]}/${yearShort}`;
            }
            // If already DD-MM-YYYY or DD/MM/YYYY, convert to DD/MM/YY
            const yearShort = parts[2].slice(-2);
            return `${parts[0]}/${parts[1]}/${yearShort}`;
        }
        return dateStr;
    };

    const handleDateTextChange = (e, field) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 8) val = val.slice(0, 8);

        let formatted = val;
        if (val.length > 2) formatted = val.slice(0, 2) + '-' + val.slice(2);
        if (val.length > 4) formatted = formatted.slice(0, 5) + '-' + val.slice(4);

        if (val.length === 8) {
            const day = val.slice(0, 2);
            const month = val.slice(2, 4);
            const year = val.slice(4, 8);
            const iso = `${year}-${month}-${day}`;
            setFormData(prev => ({ ...prev, [field]: iso }));
        }
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
                    <label className="text-[14px] font-semibold text-[#374151]">Customer Type</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.customerType || ''}
                        placeholder="Auto-fetched on customer select"
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-600 cursor-not-allowed"
                    />
                </div>

                {/* 3. Credit Days — Auto-fetched from Account Master, editable */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Credit Days</label>
                    <input
                        type="number"
                        min="0"
                        value={formData.creditDays !== undefined && formData.creditDays !== '' ? formData.creditDays : ''}
                        placeholder="Auto-fetched on customer select"
                        onChange={(e) => setFormData(prev => ({ ...prev, creditDays: e.target.value }))}
                        className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-[#111827] focus:border-[#073318] transition-all"
                    />
                </div>

                {/* 4. Address — Auto-fetched from Account Master */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Address</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.address || ''}
                        placeholder="Auto-fetched on customer select"
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-600 cursor-not-allowed"
                    />
                </div>

                {/* 5. Booking Date — Default today, non-editable */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Booking Date (Current Date) <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            value={toDisplayDate(new Date().toISOString().split('T')[0])}
                            readOnly
                            className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-[#111827] cursor-not-allowed"
                        />
                        <Calendar
                            size={18}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                    </div>
                </div>

                {/* 6. GST Number — Auto-fetched from Account Master */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                    <input
                        type="text"
                        readOnly
                        value={formData.gstNo || ''}
                        placeholder="Auto-fetched on customer select"
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-600 cursor-not-allowed"
                    />
                </div>

                {/* 7. SO Number (Optional) */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">SO Number (Optional)</label>
                    <div className="relative">
                        <select
                            className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] font-bold outline-none focus:border-[#073318] appearance-none"
                            value={formData.soId || ""}
                            onChange={(e) => handleSOChange(e.target.value)}
                        >
                            <option value="">Select SO Number</option>
                            {sos.map(p => <option key={p.id} value={p.id}>{p.soNumber}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                {/* 8. Customer Challan Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Customer {numLabel} Number <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        readOnly
                        value={formData.customerChallanNumber || ''}
                        className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed shadow-sm"
                        placeholder="Auto-generated"
                    />
                </div>

                {/* 9. Challan Date */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{dateLabel} Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="date"
                            ref={challanDateRef}
                            className="absolute opacity-0 pointer-events-none w-0 h-0"
                            value={formData.customerChallanDate || ''}
                            min={formData.soCreationDate ? formData.soCreationDate.split('T')[0] : ''}
                            max={new Date().toISOString().split('T')[0]}
                            onKeyDown={(e) => e.preventDefault()}
                            onChange={(e) => setFormData({ ...formData, customerChallanDate: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="DD-MM-YYYY"
                            value={toDisplayDate(formData.customerChallanDate)}
                            readOnly
                            onClick={() => challanDateRef.current?.showPicker?.()}
                            className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all cursor-pointer shadow-sm ${errors.customerChallanDate ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                        />
                        <Calendar
                            size={18}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer pointer-events-auto hover:text-[#073318]"
                            onClick={() => challanDateRef.current?.showPicker?.()}
                        />
                    </div>
                    {errors.customerChallanDate && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.customerChallanDate}</p>}
                </div>
            </div>
        </div>
    );
};

export default ChallanForm;
