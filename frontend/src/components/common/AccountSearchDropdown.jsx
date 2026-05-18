import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AccountSearchDropdown = ({ 
    value, 
    onChange, 
    options = [], 
    placeholder = "Search account...",
    className = "" 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const containerRef = useRef(null);

    // Find the selected option to display its label
    const selectedOption = useMemo(() => {
        return options.find(opt => opt.id === value);
    }, [options, value]);

    // Filter options based on search query
    const filteredOptions = useMemo(() => {
        if (!searchQuery) return options;
        const query = searchQuery.toLowerCase();
        return options.filter(opt => 
            (opt.accountName || opt.ledgerName || "").toLowerCase().includes(query)
        );
    }, [options, searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        onChange(option.id, option.accountName || option.ledgerName);
        setIsOpen(false);
        setSearchQuery("");
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-10 px-3 bg-[#F9FAFB] border border-transparent rounded-lg flex items-center justify-between text-[14px] transition-all hover:bg-gray-100 focus:bg-white focus:border-[#073318]"
            >
                <span className={selectedOption ? "text-gray-900 font-medium" : "text-gray-400"}>
                    {selectedOption ? (selectedOption.accountName || selectedOption.ledgerName) : placeholder}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.98 }}
                        className="absolute z-[1100] left-0 right-0 mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[300px]"
                    >
                        <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input 
                                    type="text"
                                    className="w-full h-9 pl-9 pr-3 bg-gray-50 border-none rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-[#073318]/20"
                                    placeholder="Type to filter..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto py-1 custom-scrollbar">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleSelect(opt)}
                                        className="w-full px-4 py-2 text-left text-[13px] flex items-center justify-between hover:bg-[#073318]/5 transition-colors group"
                                    >
                                        <span className={value === opt.id ? "text-[#073318] font-bold" : "text-gray-700 font-medium"}>
                                            {opt.accountName || opt.ledgerName}
                                        </span>
                                        {value === opt.id && <Check size={14} className="text-[#073318]" />}
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-3 text-[13px] text-gray-400 text-center italic">
                                    No matches found
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AccountSearchDropdown;
