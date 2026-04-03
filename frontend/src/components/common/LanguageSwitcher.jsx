import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'हिन्दी' },
        { code: 'mr', name: 'मराठी' }
    ];

    const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('i18nextLng', lng);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 p-2 rounded-lg hover:bg-gray-100 transition-colors text-[#4B5563] hover:text-[#111827]"
            >
                <Globe size={18} strokeWidth={1.5} />
                <span className="text-[14px] font-medium hidden sm:block">{currentLanguage.name}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-200 z-50 overflow-hidden ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => {
                            changeLanguage(lang.code);
                            setIsOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[14px] font-medium hover:bg-[#F3F4F6] transition-colors ${i18n.language === lang.code ? 'text-[#166534] bg-[#166534]/5' : 'text-[#4B5563]'
                            }`}
                    >
                        {lang.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default LanguageSwitcher;
