import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { toDisplayDate, toIsoDate } from '@/utils/dateUtils';

const DateInput = ({
    value, // Value is expected to be in DD/MM/YYYY format in state
    onChange, // Callback returning updated DD/MM/YYYY value
    placeholder = "DD/MM/YYYY",
    minDate, // Min date string in DD/MM/YYYY or YYYY-MM-DD
    maxDate, // Max date string in DD/MM/YYYY or YYYY-MM-DD
    isLocked = false,
    className = "",
    error,
    label,
    required = false
}) => {
    const hiddenDateInputRef = useRef(null);

    // Restrict typed characters to digits and slashes
    const handleInputChange = (e) => {
        let val = e.target.value;
        val = val.replace(/[^0-9/]/g, '');
        if (val.length > 10) {
            val = val.slice(0, 10);
        }
        onChange(val);
    };

    // Format selection from native picker to DD/MM/YYYY
    const handleDatePickerChange = (e) => {
        const isoVal = e.target.value; // YYYY-MM-DD
        if (isoVal) {
            const formatted = toDisplayDate(isoVal);
            onChange(formatted);
        }
    };

    // Convert minDate and maxDate for the native picker
    const minIso = minDate ? (minDate.includes('/') ? toIsoDate(minDate) : minDate) : undefined;
    const maxIso = maxDate ? (maxDate.includes('/') ? toIsoDate(maxDate) : maxDate) : undefined;

    const openCalendar = () => {
        if (!isLocked) {
            try {
                hiddenDateInputRef.current?.showPicker?.();
            } catch (e) {
                hiddenDateInputRef.current?.focus();
            }
        }
    };

    return (
        <div className="space-y-2 font-outfit relative">
            {label && (
                <label className="text-[14px] font-semibold text-[#374151]">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <div className={`relative ${!isLocked ? 'cursor-pointer' : ''}`} onClick={openCalendar}>
                {/* Hidden native date picker */}
                <input
                    type="date"
                    ref={hiddenDateInputRef}
                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                    value={value && value.includes('/') ? toIsoDate(value) : (value || '')}
                    min={minIso}
                    max={maxIso}
                    onKeyDown={(e) => e.preventDefault()}
                    onChange={handleDatePickerChange}
                    disabled={isLocked}
                />
                
                {/* Text input for manual typing and formatted display */}
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={handleInputChange}
                    onClick={openCalendar}
                    disabled={isLocked}
                    className={`w-full h-[48px] bg-white border rounded-[10px] px-4 pr-12 text-[14px] font-bold outline-none transition-all shadow-sm ${
                        isLocked ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-[#E5E7EB]' : 
                        `focus:border-[#073318] cursor-pointer ${error ? 'border-red-500 focus:border-red-500' : 'border-[#E5E7EB]'}`
                    } ${className}`}
                />
                
                {/* Calendar Icon button trigger */}
                <Calendar
                    size={18}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${
                        isLocked ? 'text-gray-300 pointer-events-none' : 'text-gray-400 cursor-pointer hover:text-[#073318]'
                    }`}
                    onClick={openCalendar}
                />
            </div>
            {error && (
                <p className="text-red-500 text-[12px] mt-1 font-medium italic">
                    *{error}
                </p>
            )}
        </div>
    );
};

export default DateInput;
