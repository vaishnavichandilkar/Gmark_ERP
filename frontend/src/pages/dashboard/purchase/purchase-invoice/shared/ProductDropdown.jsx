import React, { useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProductDropdown = ({
    products,
    tableSearch,
    setTableSearch,
    isProductSearchOpen,
    setIsProductSearchOpen,
    activeRowIndex,
    setActiveRowIndex,
    handleQuickAddProduct,
    addedProductIds = [],
    errors
}) => {
    const navigate = useNavigate();

    const filteredProducts = useMemo(() => {
        const searchLower = tableSearch.toLowerCase();
        return (products || []).filter(p => {
            if (addedProductIds.includes(p.id)) return false;
            if (!tableSearch) return true;
            return (
                p.product_name?.toLowerCase().includes(searchLower) ||
                p.product_code?.toLowerCase().includes(searchLower) ||
                p.hsn_code?.toLowerCase().includes(searchLower)
            );
        });
    }, [products, addedProductIds, tableSearch]);

    return (
        <div className="relative max-w-[550px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
            <input
                type="text"
                placeholder="Search By Anything..."
                value={tableSearch}
                onFocus={() => { setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                className={`w-full h-[44px] bg-white border ${errors?.items ? 'border-red-500 font-bold' : 'border-[#E5E7EB]'} rounded-[12px] pl-11 pr-4 text-[14px] outline-none focus:border-[#073318] placeholder:text-[#9CA3AF] shadow-sm font-outfit`}
            />
            
            {isProductSearchOpen && activeRowIndex === null && (
                <>
                    <div className="fixed inset-0 z-[65]" onClick={() => setIsProductSearchOpen(false)}></div>
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-[20px] shadow-2xl z-[80] overflow-hidden border-t-4 border-emerald-800 animate-in slide-in-from-top-2 duration-300 font-outfit">
                        <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                            {filteredProducts.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => handleQuickAddProduct(p)} 
                                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-emerald-50 transition-all text-left border-b border-gray-100 last:border-0 group relative overflow-hidden"
                                >
                                    <div className="flex flex-col gap-2 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <span className="font-extrabold text-[#111827] text-[16px] group-hover:text-emerald-950">{p.product_name}</span>
                                            <span className="px-2.5 py-0.5 bg-gray-100 rounded-[6px] text-[11px] font-black text-gray-500 uppercase tracking-tighter shadow-sm">#{p.product_code}</span>
                                        </div>
                                        <div className="flex text-[13px] text-gray-400 gap-x-6">
                                            <span className="flex items-center gap-1.5"><span className="text-gray-300 font-medium">HSN:</span> <span className="text-gray-700 font-bold">{p.hsn_code || '---'}</span></span>
                                            <span className="flex items-center gap-1.5"><span className="text-gray-300 font-medium">Tax:</span> <span className="text-emerald-700 font-black">{p.tax_rate}%</span></span>
                                            <span className="flex items-center gap-1.5"><span className="text-gray-300 font-medium">Price:</span> <span className="text-[#073318] font-black">₹{p.purchaseRate || 0}</span></span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 relative z-10">
                                        <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 transition-all group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-90 group-hover:shadow-lg">
                                            <Plus size={20} strokeWidth={3} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="py-12 text-center text-gray-400 italic font-outfit">No products found for "{tableSearch}"</div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <button 
                                onClick={() => navigate(`/seller/masters/product-master/add?redirect=${encodeURIComponent(window.location.pathname + '?restore=true')}`)}
                                className="w-full h-[52px] bg-[#073318] text-white rounded-[14px] text-[15px] font-black flex items-center justify-center gap-3 hover:bg-[#052611] transition-all shadow-lg active:scale-95 group font-outfit"
                            >
                                <Plus size={20} className="group-hover:rotate-90 transition-all duration-300" />
                                Add new product
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductDropdown;
