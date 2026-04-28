import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from "@/constants/routes";
import GRNMultiSelect from './GRNMultiSelect';

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
    const isGRN = type === 'GRN';
    const numLabel = isGRN ? 'Challan' : 'Invoice';
    const navigate = useNavigate();
    const fieldForNumber = isGRN ? 'supplier_challan_number' : 'supplier_invoice_number';
    const [supplierSearch, setSupplierSearch] = useState(formData.supplier_name || '');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

    // Dynamic Label Correction
    const displayDateLabel = isGRN ? 'Supplier Challan' : 'Supplier Invoice';

    React.useEffect(() => {
        setSupplierSearch(formData.supplier_name || '');
    }, [formData.supplier_name]);

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s =>
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase())
        );
    }, [supplierSearch, suppliers]);

    const toDisplayDate = (dateStr) => {
        if (!dateStr) return "";
        // If it already contains / and parts are short, it might be already formatted
        const partsSlash = dateStr.split("/");
        if (partsSlash.length === 3 && partsSlash[2].length === 2) return dateStr;
        
        // If it looks like ISO YYYY-MM-DD or DD/MM/YYYY
        const separator = dateStr.includes("-") ? "-" : "/";
        const parts = dateStr.split(separator);
        
        if (parts.length === 3) {
            // ISO Case: YYYY-MM-DD
            if (parts[0].length === 4) {
                const yearShort = parts[0].slice(-2);
                return `${parts[2]}/${parts[1]}/${yearShort}`;
            }
            // DD/MM/YYYY Case
            const yearShort = parts[2].slice(-2);
            return `${parts[0]}/${parts[1]}/${yearShort}`;
        }
        return dateStr;
    };

    const handleDateTextChange = (e, field) => {
        if (isDocumentDateReadOnly) return;
        const val = e.target.value;
        const digits = val.replace(/\D/g, '').substring(0, 8);
        
        // Auto-format as they type
        let formatted = digits;
        if (digits.length >= 3) formatted = digits.substring(0, 2) + '/' + digits.substring(2);
        if (digits.length >= 5) formatted = formatted.substring(0, 5) + '/' + digits.substring(5);

        // Update state with formatted string to allow typing
        setFormData(prev => ({ ...prev, [field]: formatted }));
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
                                            <div className="px-5 py-8 text-[13px] text-gray-400 italic text-center">No results for "{supplierSearch}"</div>
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
                        min="0"
                        placeholder="0"
                        value={formData.credit_days || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, credit_days: e.target.value }))}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all shadow-sm ${errors.credit_days ? 'border-red-500' : 'border-[#E5E7EB]'}`}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all shadow-sm ${errors.address ? 'border-red-500' : 'border-[#E5E7EB]'}`}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, gst_no: e.target.value }))}
                        className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all shadow-sm"
                    />
                </div>

                {/* 5. Link Purchase Order */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">PO Number</label>
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
                        value={formData[fieldForNumber] || ''}
                        onChange={(e) => setFormData({ ...formData, [fieldForNumber]: e.target.value })}
                        className={`w-full h-[48px] bg-white border rounded-[10px] px-4 text-[14px] font-bold outline-none focus:border-[#073318] transition-all ${errors[fieldForNumber] ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                    />
                    {errors[fieldForNumber] && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors[fieldForNumber]}</p>}
                </div>

                {/* 6.1 Supplier Challan Number (Only for Invoice) */}
                {type === 'Invoice' && (
                    <div className="space-y-2 font-outfit">
                        <label className="text-[14px] font-semibold text-[#374151]">Supplier Challan Number</label>
                        <GRNMultiSelect 
                            challans={challans}
                            selectedIds={formData.grn_ids || []}
                            onChange={(ids) => handleChallanChange(ids)}
                        />
                    </div>
                )}

                {/* 7. Challan/Invoice Date */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">{displayDateLabel} Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <input
                            type="date"
                            ref={challanDateRef}
                            className="absolute opacity-0 pointer-events-none w-0 h-0"
                            value={formData.document_date || ''}
                            min={minDate}
                            max={maxDate || new Date().toISOString().split('T')[0]}
                            onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                            readOnly={isDocumentDateReadOnly}
                        />
                        <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={toDisplayDate(formData.document_date)}
                            readOnly={true}
                            onClick={() => !isDocumentDateReadOnly && (challanDateRef.current?.showPicker?.() || challanDateRef.current?.focus())}
                            className={`w-full h-[48px] rounded-[10px] px-4 text-[14px] font-bold outline-none transition-all ${
                                isDocumentDateReadOnly 
                                    ? 'bg-gray-50 border-[#E5E7EB] text-gray-500 cursor-not-allowed' 
                                    : `bg-white border cursor-pointer ${errors.document_date ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`
                            }`}
                        />
                        <Calendar
                            size={18}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 shadow-sm ${
                                isDocumentDateReadOnly 
                                    ? 'text-gray-300 pointer-events-none' 
                                    : 'text-gray-400 cursor-pointer pointer-events-auto hover:text-[#073318]'
                            }`}
                            onClick={() => !isDocumentDateReadOnly && challanDateRef.current?.showPicker?.()}
                        />
                    </div>
                    {errors.document_date && <p className="text-red-500 text-[12px] mt-1 font-medium italic">*{errors.document_date}</p>}
                </div>

                {/* 8. Booking Date - Frozen current date */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Booking Date</label>
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
