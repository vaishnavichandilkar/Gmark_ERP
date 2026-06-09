import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../../layout/auth/AuthLayout';
import Button from '../../components/common/Button';
import logo from '../../assets/images/ERP_Logo2.png';

const LanguageSelection = () => {
    const { t, i18n } = useTranslation('auth');
    const navigate = useNavigate();
    const [selectedLang, setSelectedLang] = useState('hi');

    const languages = [
        { code: 'mr', name: t('language_selection.marathi.name'), desc: t('language_selection.marathi.description') },
        { code: 'hi', name: t('language_selection.hindi.name'), desc: t('language_selection.hindi.description') },
        { code: 'en', name: t('language_selection.english.name'), desc: t('language_selection.english.description') }
    ];

    const handleAccept = () => {
        if (selectedLang) {
            i18n.changeLanguage(selectedLang);
            localStorage.setItem('selectedLanguage', selectedLang);
            localStorage.setItem('i18nextLng', selectedLang);
            // We set a flag to indicate language is confirmed for this "session"
            // To handle "clear on server restart", we would ideally check a server-side timestamp.
            // For now, we'll store it in localStorage as requested for persistence across browser closes.
            localStorage.setItem('languageConfirmed', 'true');
            navigate('/landing');
        }
    };

    return (
        <AuthLayout maxWidth="max-w-[550px]">
            <div className="flex flex-col items-start w-full">
                <img
                    src={logo}
                    alt="ERP Logo"
                    className="h-10 mb-8"
                    onError={(e) => { e.target.style.display = 'none' }}
                />

                <div className="mb-8">
                    <h1 className="text-[32px] font-bold text-gray-900 mb-2 font-['Geist_Sans']">
                        {t('language_selection.title') || 'Hello! 👋'}
                    </h1>
                    <p className="text-gray-500 font-medium font-['Plus_Jakarta_Sans']">
                        {t('language_selection.subtitle') || 'Which language would you like to continue with?'}
                    </p>
                </div>

                <div className="flex flex-col gap-4 w-full mb-8">
                    {languages.map((lang) => (
                        <label
                            key={lang.code}
                            className={`
                                flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                                ${selectedLang === lang.code ? 'border-[#0B3D2E] bg-[#F8FAF0]' : 'border-gray-100 hover:border-gray-200'}
                            `}
                        >
                            <div className="relative flex items-center justify-center mr-4">
                                <input
                                    type="radio"
                                    name="language"
                                    value={lang.code}
                                    checked={selectedLang === lang.code}
                                    onChange={() => {
                                        setSelectedLang(lang.code);
                                        i18n.changeLanguage(lang.code);
                                    }}
                                    className="sr-only"
                                />
                                <div className={`
                                    w-5 h-5 rounded-full border-2 flex items-center justify-center
                                    ${selectedLang === lang.code ? 'border-[#0B3D2E]' : 'border-gray-300'}
                                `}>
                                    {selectedLang === lang.code && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#0B3D2E]" />
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[16px] font-bold text-gray-900 font-['Geist_Sans'] leading-tight">
                                    {lang.name}
                                </span>
                                <span className="text-[14px] text-gray-500 font-medium font-['Plus_Jakarta_Sans'] mt-0.5">
                                    {lang.desc}
                                </span>
                            </div>
                        </label>
                    ))}
                </div>

                <Button
                    variant="primary"
                    disabled={!selectedLang}
                    onClick={handleAccept}
                    className={`
                        w-full py-4 text-[16px] font-bold transition-all duration-300
                        ${!selectedLang ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#0B3D2E] hover:bg-[#092E22]'}
                    `}
                    style={!selectedLang ? { backgroundColor: '#B2C3BB' } : {}}
                >
                    {t('language_selection.accept') || 'Accept'}
                </Button>
            </div>
        </AuthLayout>
    );
};

export default LanguageSelection;
