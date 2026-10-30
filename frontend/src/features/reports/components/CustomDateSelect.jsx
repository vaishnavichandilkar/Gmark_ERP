import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

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

export const CustomCombobox = ({ value, options, onChange, placeholder, maxLength, className, dropUp = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [shouldDropUp, setShouldDropUp] = useState(dropUp);
    const wrapperRef = useRef(null);

    const updateDropDirection = () => {
        if (dropUp === true) {
            setShouldDropUp(true);
            return;
        }
        if (wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setShouldDropUp(spaceBelow < 220);
        }
    };

    useEffect(() => {
        setShouldDropUp(dropUp);
    }, [dropUp]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOpen = () => {
        if (!isOpen) {
            updateDropDirection();
        }
        setIsOpen(!isOpen);
    };

    const handleFocus = () => {
        updateDropDirection();
        setIsOpen(true);
    };

    return (
        <div ref={wrapperRef} className="relative flex items-center">
            <input 
                type="text" 
                value={value || ''}
                placeholder={placeholder}
                maxLength={maxLength}
                onChange={onChange}
                onFocus={handleFocus}
                className={`${className} pr-4`}
            />
            <button 
                type="button"
                onClick={toggleOpen}
                className="absolute right-1 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </button>
            {isOpen && (
                <ul className={`absolute ${shouldDropUp ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 max-h-48 overflow-y-auto w-full min-w-[50px] bg-white border border-gray-200 rounded-md shadow-2xl z-[100] py-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent`}>
                    {options.map(opt => (
                        <li 
                            key={opt}
                            onMouseDown={(e) => { e.preventDefault(); }} 
                            onClick={() => {
                                onChange({ target: { value: String(opt) } });
                                setIsOpen(false);
                            }}
                            className={`px-1 py-1.5 text-xs hover:bg-emerald-50 cursor-pointer text-center transition-colors ${String(value) === String(opt) ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-gray-700 font-medium'}`}
                        >
                            {opt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export const CustomDateSelect = ({ value, onChange, dropUp = false, showCalendarButton = true }) => {
    const calendarInputRef = useRef(null);
    const cleanValue = value ? String(value).split('T')[0] : '';
    const [year, month, day] = cleanValue ? cleanValue.split('-') : ['', '', ''];

    const handleDayChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        const y = year || new Date().getFullYear();
        const m = month || '01';
        onChange(`${y}-${m}-${val}`);
    };
    
    const handleMonthChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        const y = year || new Date().getFullYear();
        const d = day || '01';
        onChange(`${y}-${val}-${d}`);
    };
    
    const handleYearChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 4) val = val.slice(0, 4);
        const m = month || '01';
        const d = day || '01';
        onChange(`${val}-${m}-${d}`);
    };

    const handleNativeDateChange = (e) => {
        if (e.target.value) {
            onChange(e.target.value);
        }
    };

    const openCalendarPicker = (e) => {
        e?.stopPropagation?.();
        if (calendarInputRef.current) {
            try {
                calendarInputRef.current.showPicker?.();
            } catch {
                calendarInputRef.current.focus?.();
            }
        }
    };

    const days = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'));
    const months = Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0'));
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 16}, (_, i) => String(currentYear - 5 + i));

    return (
        <div className="flex gap-1.5 items-center">
            <CustomCombobox 
                value={day} 
                options={days}
                placeholder="DD"
                maxLength={2}
                dropUp={dropUp}
                onChange={handleDayChange}
                className="w-[3.3rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
            <CustomCombobox 
                value={month} 
                options={months}
                placeholder="MM"
                maxLength={2}
                dropUp={dropUp}
                onChange={handleMonthChange}
                className="w-[3.3rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />
            <CustomCombobox 
                value={year} 
                options={years}
                placeholder="YYYY"
                maxLength={4}
                dropUp={dropUp}
                onChange={handleYearChange}
                className="w-[4.2rem] px-2 py-1.5 text-xs text-center border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs font-medium text-gray-700 bg-white transition-all"
            />

            {showCalendarButton && (
                <div className="relative flex items-center">
                    <input
                        ref={calendarInputRef}
                        type="date"
                        value={cleanValue || ''}
                        onChange={handleNativeDateChange}
                        className="sr-only pointer-events-none"
                        tabIndex={-1}
                        aria-hidden="true"
                    />
                    <button
                        type="button"
                        onClick={openCalendarPicker}
                        title="Pick date from calendar"
                        className="p-1.5 text-slate-600 hover:text-[#004f3b] hover:bg-emerald-50 rounded-lg border border-slate-300 hover:border-emerald-500 transition-all cursor-pointer bg-white shadow-2xs group active:scale-95"
                    >
                        <Calendar size={14} className="text-slate-600 group-hover:text-[#004f3b]" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default CustomDateSelect;
