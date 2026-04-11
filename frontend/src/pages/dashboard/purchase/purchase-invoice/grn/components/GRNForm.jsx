import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from "@/constants/routes";

const GRNForm = ({
    formData,
    setFormData,
    handleSupplierChange,
    handlePOChange,
    suppliers,
    pos,
    errors,
    bookingDateRef,
    challanDateRef,
    type = 'GRN'
}) => {
    const isGRN = type === 'GRN';
    const numLabel = isGRN ? 'Challan' : 'Invoice';
    const dateLabel = isGRN ? 'Challan' : 'Invoice';
    const navigate = useNavigate();
    const [supplierSearch, setSupplierSearch] = useState(formData.supplier_name || '');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s =>
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase())
        );
    }, [supplierSearch, suppliers]);

    const toDisplayDate = (dateStr) => {
        if (!dateStr) return "";
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
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
                {/* 1. Supplier Name */}
                <div className="space-y-2 relative">
                    <label className="text-[14px] font-semibold text-[#374151]">Supplier Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Select supplier name"
                            value={supplierSearch}
                            onFocus={() => setIsSupplierDropdownOpen(true)}
                            onChange={(e) => {
                                setSupplierSearch(e.target.value);
                                setIsSupplierDropdownOpen(true);
                            }}
                            className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all ${errors.supplier_name ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                        />
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
                                            <div className="px-5 py-8 text-[13px] text-gray-400 italic text-center">No results for "{supplierSearch}"</div>
                                        )}
                                    </div>
                                    <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/seller/masters/account-master/add?redirect=${isGRN ? ROUTES.GRN_ADD : ROUTES.PURCHASE_INVOICE_ADD}`)}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold shadow-md hover:bg-[#052611] transition-all"
                                        >
                                            <Plus size={16} /> Add new supplier
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
                    <label className="text-[14px] font-semibold text-[#374151]">Credit Days <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        placeholder="0"
                        value={formData.credit_days || ''}
                        onChange={(e) => setFormData({ ...formData, credit_days: e.target.value })}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all ${errors.credit_days ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                    />
                    {errors.credit_days && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.credit_days}</p>}
                </div>

                {/* 3. Address */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Address <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        placeholder="Enter address"
                        value={formData.address || ''}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all ${errors.address ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                    />
                    {errors.address && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.address}</p>}
                </div>

                {/* 4. GST Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                    <input
                        type="text"
                        placeholder="Optional"
                        value={formData.gst_no || ''}
                        onChange={(e) => setFormData({ ...formData, gst_no: e.target.value })}
                        className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all"
                    />
                </div>

                {/* 5. Link Purchase Order */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Link Purchase Order</label>
                    <div className="relative">
                        <select
                            className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 pr-10 text-[14px] font-bold outline-none focus:border-[#073318] appearance-none"
                            value={formData.po_id || ""}
                            onChange={(e) => handlePOChange(e.target.value)}
                        >
                            <option value="" disabled>Select PO Number</option>
                            {pos.map(p => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                {/* 6. Supplier Challan/Invoice Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Supplier {numLabel} Number <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        placeholder={`Enter ${numLabel.toLowerCase()} no.`}
                        value={formData.supplier_challan_number || ''}
                        onChange={(e) => setFormData({ ...formData, supplier_challan_number: e.target.value })}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all ${errors.supplier_challan_number ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                    />
                    {errors.supplier_challan_number && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.supplier_challan_number}</p>}
                </div>

                {/* 7. Challan Date */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{dateLabel} Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="date"
                            ref={challanDateRef}
                            className="absolute opacity-0 pointer-events-none w-0 h-0"
                            value={formData.document_date || ''}
                            onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="DD-MM-YYYY"
                            value={toDisplayDate(formData.document_date)}
                            onChange={(e) => handleDateTextChange(e, 'document_date')}
                            className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all ${errors.document_date ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                        />
                        <Calendar
                            size={18}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer pointer-events-auto shadow-sm hover:text-[#073318]"
                            onClick={() => challanDateRef.current?.showPicker?.()}
                        />
                    </div>
                    {errors.document_date && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.document_date}</p>}
                </div>

                {/* 8. Booking Date - Frozen current date */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Booking Date (Current Date) <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="text"
                            value={toDisplayDate(formData.booking_date)}
                            readOnly
                            className="w-full h-[48px] bg-gray-50 border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none text-gray-500 cursor-not-allowed"
                        />
                        <Calendar
                            size={18}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GRNForm;
