import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

const GRNMultiSelect = ({ 
    challans = [], 
    selectedIds = [], 
    onChange, 
    isLoading = false 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredChallans = challans.filter(c => 
        c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleChallan = (id) => {
        const newSelectedIds = selectedIds.includes(id)
            ? selectedIds.filter(idx => idx !== id)
            : [...selectedIds, id];
        
        onChange(newSelectedIds);
    };

    const removeId = (e, id) => {
        e.stopPropagation();
        onChange(selectedIds.filter(idx => idx !== id));
    };

    const selectedChallans = challans.filter(c => selectedIds.includes(c.id));

    return (
        <div className="relative font-outfit" ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`min-h-[48px] w-full bg-white border rounded-[10px] px-3 py-2 cursor-pointer transition-all flex flex-wrap gap-2 items-center ${isOpen ? 'border-[#073318] ring-2 ring-[#073318]/5' : 'border-[#E5E7EB] hover:border-gray-300'}`}
            >
                {selectedChallans.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 flex-1">
                        {selectedChallans.map(c => (
                            <div 
                                key={c.id} 
                                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg group hover:bg-emerald-100 transition-colors"
                            >
                                <span className="text-[12px] font-bold text-emerald-900">{c.challanNumber}</span>
                                <X 
                                    className="cursor-pointer text-emerald-600 hover:text-emerald-900" 
                                    size={14} 
                                    onClick={(e) => removeId(e, c.id)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <span className="text-gray-400 text-[14px] px-1">
                        {isLoading ? "Loading Challans..." : (challans.length > 0 ? `Select Challan (${challans.length} found)` : "No Challans Found")}
                    </span>
                )}
                
                <div className="flex items-center gap-2 ml-auto pr-1">
                    {selectedIds.length > 0 && (
                        <span className="text-[11px] font-black bg-[#073318] text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            {selectedIds.length} Selected
                        </span>
                    )}
                    <ChevronDown className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} size={18} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] top-[calc(100%+8px)] left-0 w-full bg-white border border-[#E5E7EB] rounded-[16px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 border-t-4 border-t-[#073318]">
                    {/* Search Bar */}
                    <div className="p-3 border-b border-[#F3F4F6] bg-gray-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search challan number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-[38px] bg-white border border-[#E5E7EB] rounded-[8px] pl-10 pr-4 text-[13px] font-medium outline-none focus:border-[#073318] transition-all"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1">
                        {filteredChallans.length > 0 ? (
                            filteredChallans.map(c => {
                                const isSelected = selectedIds.includes(c.id);
                                const isDisabled = (c.remainingQty ?? 1) <= 0 && !isSelected; // Only disable if 0 AND not already selected

                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => toggleChallan(c.id)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition-all group ${isDisabled ? 'bg-gray-50' : 'hover:bg-emerald-50'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-[#073318] border-[#073318]' : 'bg-white border-gray-300 group-hover:border-[#073318]'}`}>
                                            {isSelected && <Check size={14} className="text-white" />}
                                        </div>
                                        <div className="flex flex-col flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[14px] font-bold ${isSelected ? 'text-[#073318]' : 'text-[#111827]'}`}>
                                                    {c.challanNumber}
                                                </span>
                                                <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                                                    {new Date(c.bookingDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <span className="text-[12px] text-gray-500 font-medium">Total: ₹{c.grandTotal}</span>
                                                {isDisabled && (
                                                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">Fully Invoiced</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-5 py-8 text-[13px] text-gray-400 italic text-center">
                                {searchTerm ? `No results for "${searchTerm}"` : "No challans available"}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GRNMultiSelect;
