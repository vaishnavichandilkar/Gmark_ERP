import React, { useState, useEffect, useRef } from 'react';

export const toLocalISOString = (d) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const formatDisplayDateDDMMYYYY = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
};

export const CustomCombobox = ({ value, options, onChange, placeholder, maxLength, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={wrapperRef} className="relative flex items-center">
            <input 
                type="text" 
                value={value}
                placeholder={placeholder}
                maxLength={maxLength}
                onChange={onChange}
                onFocus={() => setIsOpen(true)}
                className={`${className} pr-4`}
            />
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="absolute right-1 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </button>
            {isOpen && (
                <ul className="absolute top-full left-0 mt-1 max-h-48 overflow-y-auto w-full bg-white border border-gray-200 rounded-md shadow-xl z-50 py-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {options.map(opt => (
                        <li 
                            key={opt}
                            onMouseDown={(e) => { e.preventDefault(); }} 
                            onClick={() => {
                                onChange({ target: { value: String(opt) } });
                                setIsOpen(false);
                            }}
                            className={`px-1 py-1.5 text-xs hover:bg-emerald-50 cursor-pointer text-center ${String(value) === String(opt) ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-gray-700 font-medium'}`}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export const CustomDateSelect = ({ value, onChange }) => {
    const [year, month, day] = value ? value.split('-') : ['', '', ''];

    const handleDayChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        onChange(`${year || new Date().getFullYear()}-${month || '01'}-${val}`);
    };
    
    const handleMonthChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        onChange(`${year || new Date().getFullYear()}-${val}-${day || '01'}`);
    };
    
    const handleYearChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 4) val = val.slice(0, 4);
        onChange(`${val}-${month || '01'}-${day || '01'}`);
    };

    const days = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'));
    const months = Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0'));
    const years = Array.from({length: 15}, (_, i) => String(2020 + i));

    return (
        <div className="flex gap-1.5 items-center">
            <CustomCombobox 
                value={day} 
                options={days}
                placeholder="DD"
                maxLength={2}
                onChange={handleDayChange}
                className="w-[3.3rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
            <CustomCombobox 
                value={month} 
                options={months}
                placeholder="MM"
                maxLength={2}
                onChange={handleMonthChange}
                className="w-[3.3rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
            <CustomCombobox 
                value={year} 
                options={years}
                placeholder="YYYY"
                maxLength={4}
                onChange={handleYearChange}
                className="w-[4.2rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
        </div>
    );
};

export default CustomDateSelect;
