import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const languages = [
        { code: 'en', name: 'English', short: 'EN' },
        { code: 'hi', name: 'हिन्दी', short: 'हि' },
        { code: 'mr', name: 'मराठी', short: 'म' }
    ];

    const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng).then(() => {
            window.location.reload();
        });
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
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 group
                    ${isOpen 
                        ? 'bg-[#166534]/10 text-[#166534] shadow-sm' 
                        : 'hover:bg-gray-100 text-[#4B5563] hover:text-[#111827]'
                    }`}
            >
                <div className={`p-1 rounded-lg transition-colors duration-300 ${isOpen ? 'bg-[#166534]/20' : 'bg-gray-100 group-hover:bg-white'}`}>
                    <Globe size={18} strokeWidth={2} className="shrink-0" />
                </div>
                <span className="text-[14px] font-semibold hidden sm:block tracking-tight text-inherit">
                    {currentLanguage.name}
                </span>
                <ChevronDown 
                    size={14} 
                    strokeWidth={2.5}
                    className={`transition-transform duration-300 text-inherit/50 ${isOpen ? 'rotate-180 opacity-100' : 'opacity-40'}`} 
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Visual Tether Arrow */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-[calc(100%+4px)] right-[18px] w-3 h-3 bg-white border-l border-t border-gray-100 transform rotate-45 z-[60]"
                        />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8, originX: '90%', originY: 'top' }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="absolute right-0 mt-2 w-[180px] bg-white/95 backdrop-blur-md border border-gray-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden py-1.5"
                        >
                            <div className="px-3 py-2 border-b border-gray-50 mb-1">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Select Language</span>
                            </div>
                            
                            {languages.map((lang) => {
                                const isActive = i18n.language === lang.code;
                                return (
                                    <motion.button
                                        key={lang.code}
                                        whileHover={{ x: 4 }}
                                        onClick={() => {
                                            changeLanguage(lang.code);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 transition-all duration-200 group
                                            ${isActive 
                                                ? 'bg-[#166534]/5 text-[#166534]' 
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors
                                                ${isActive 
                                                    ? 'bg-[#166534] text-white' 
                                                    : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                                                }`}
                                            >
                                                {lang.short}
                                            </div>
                                            <span className={`text-[14px] font-medium ${isActive ? 'font-bold' : ''}`}>
                                                {lang.name}
                                            </span>
                                        </div>
                                        {isActive && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                            >
                                                <Check size={16} strokeWidth={3} className="text-[#166534]" />
                                            </motion.div>
                                        )}
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LanguageSwitcher;
