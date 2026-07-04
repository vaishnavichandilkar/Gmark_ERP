import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SupplierDropdown = ({
    suppliers,
    supplierSearch,
    setSupplierSearch,
    isSupplierDropdownOpen,
    setIsSupplierDropdownOpen,
    handleSelectSupplier,
    errors
}) => {
    const navigate = useNavigate();

    const filteredSuppliers = useMemo(() => {
        return (suppliers || []).filter(s => 
            s.accountName?.toLowerCase().includes(supplierSearch.toLowerCase())
        );
    }, [supplierSearch, suppliers]);

    return (
        <div className="relative">
            <input
                type="text"
                placeholder="Search supplier..."
                value={supplierSearch}
                onFocus={() => setIsSupplierDropdownOpen(true)}
                onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setIsSupplierDropdownOpen(true);
                }}
                className={`w-full h-[48px] bg-white border ${errors?.supplier_name ? 'border-red-500' : 'border-[#E5E7EB]'} rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]`}
            />
            
            {isSupplierDropdownOpen && (
                <>
                    <div className="fixed inset-0 z-[65]" onClick={() => setIsSupplierDropdownOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#E5E7EB] rounded-[16px] shadow-2xl z-[70] overflow-hidden font-outfit">
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {filteredSuppliers.length > 0 ? (
                                filteredSuppliers.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleSelectSupplier(s)}
                                        className="w-full text-left px-5 py-3.5 hover:bg-emerald-50 transition-all border-b border-[#F3F4F6] last:border-0 group"
                                    >
                                        <div className="font-bold text-[#111827] text-[15px] group-hover:text-emerald-900 transition-colors">{s.accountName}</div>
                                        <div className="text-[12px] text-gray-400 mt-0.5">{s.gstNo || 'No GST Number'}</div>
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-[13px] text-gray-400 italic text-center font-outfit">
                                    No results for "{supplierSearch}"
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                            <button 
                                onClick={() => {
                                    navigate(`/seller/masters/account-master/add?redirect=${encodeURIComponent(window.location.pathname + '?restore=true')}`);
                                }}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-[#073318] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#052611] transition-all shadow-md group font-outfit"
                            >
                                <Plus size={16} className="group-hover:scale-125 transition-all" /> 
                                Add new supplier
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SupplierDropdown;
