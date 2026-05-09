import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomSelect = ({ 
    value, 
    onChange, 
    options = [5, 10, 20, 50], 
    label = '',
    className = '',
    menuPlacement = 'bottom' // 'top' or 'bottom'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative inline-block ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="h-[36px] min-w-[70px] bg-white border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] text-[#4B5563] flex items-center justify-between font-bold hover:border-gray-300 transition-all shadow-sm focus:ring-2 focus:ring-[#073318]/10"
            >
                <span className="mr-2">{value}</span>
                <ChevronDown size={14} className={`text-[#6B7280] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: menuPlacement === 'top' ? -10 : 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: menuPlacement === 'top' ? -10 : 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-[100] left-0 right-0 bg-white border border-[#E5E7EB] rounded-[10px] shadow-xl py-1 overflow-hidden min-w-[70px] ${
                            menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                        }`}
                    >
                        {options.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                    onChange(opt);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-2 text-left text-[13px] font-bold transition-colors hover:bg-gray-50 ${value === opt ? 'text-[#073318] bg-[#073318]/5' : 'text-gray-600'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomSelect;
