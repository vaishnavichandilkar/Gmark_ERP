import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

/**
 * A custom dropdown component for filter sidebars to avoid native select alignment issues on mobile.
 */
const FilterDropdown = ({ label, options, value, onChange, placeholder = "Select option", name }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options.find((opt) => opt.value === "");

  return (
    <div className="space-y-2.5 w-full relative" ref={dropdownRef}>
      {label && <label className="text-[14px] font-medium text-[#4B5563]">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full h-[46px] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] text-left flex items-center justify-between bg-white font-medium transition-all ${
            isOpen ? "border-[#073318] ring-1 ring-[#073318]/10" : "hover:border-gray-300"
          }`}
        >
          <span className={!value ? "text-gray-400" : "text-[#111827]"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            size={18}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-gray-100 rounded-[12px] shadow-[0_10px_25px_rgba(0,0,0,0.1)] z-[100] py-1 animate-in fade-in zoom-in-95 duration-200">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange({ target: { name, value: option.value } });
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-[14px] flex items-center justify-between transition-colors ${
                  value === option.value ? "bg-[#073318]/5 text-[#073318] font-bold" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {option.label}
                {value === option.value && <Check size={16} className="text-[#073318]" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterDropdown;
