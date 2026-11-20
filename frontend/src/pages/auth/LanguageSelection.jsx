import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../../layout/auth/AuthLayout';
import Button from '../../components/common/Button';
import { ArrowLeft } from 'lucide-react';
import logo from '../../assets/images/bizdrona_logo.png';
import { getSafeUser } from '../../utils/user';

const LanguageSelection = () => {
    const { t, i18n } = useTranslation('auth');
    const navigate = useNavigate();

    // If already logged in, redirect to appropriate dashboard
    useEffect(() => {
        const token = localStorage.getItem('token');
        const refreshToken = localStorage.getItem('refreshToken');
        const user = getSafeUser();

        if ((token || refreshToken) && user?.role) {
            const role = (user.role || '').toString().toUpperCase();
            if (role === 'SUPERADMIN') {
                navigate('/superadmin/dashboard', { replace: true });
                return;
            }
            if (role === 'SELLER') {
                if (user.approvalStatus !== 'APPROVED' || user.isFirstApprovalLogin) {
                    navigate('/application-status', { replace: true });
                    return;
                }
                navigate('/seller/reports', { replace: true });
                return;
            }
        }
    }, [navigate]);

    // Default to 'en' (English), or previously chosen language
    const [selectedLang, setSelectedLang] = useState(() => {
        return localStorage.getItem('selectedLanguage') || 'en';
    });

    useEffect(() => {
        const initialLang = localStorage.getItem('selectedLanguage') || 'en';
        if (i18n.language !== initialLang) {
            i18n.changeLanguage(initialLang);
        }
    }, [i18n]);

    const languages = [
        { code: 'en', name: t('language_selection.english.name') || 'English', desc: t('language_selection.english.description') || 'Simplify business management, improve efficiency' },
        { code: 'hi', name: t('language_selection.hindi.name') || 'हिंदी', desc: t('language_selection.hindi.description') || 'व्यवसाय प्रबंधन को सरल बनाएं, कार्यक्षमता बढ़ाएं' },
        { code: 'mr', name: t('language_selection.marathi.name') || 'मराठी', desc: t('language_selection.marathi.description') || 'व्यवसाय व्यवस्थापन सुलभ, कार्यक्षमतेला नवी दिशा' }
    ];

    const handleAccept = () => {
        const lang = selectedLang || 'en';
        i18n.changeLanguage(lang);
        localStorage.setItem('selectedLanguage', lang);
        localStorage.setItem('i18nextLng', lang);
        localStorage.setItem('languageConfirmed', 'true');
        navigate('/landing');
    };

    return (
        <AuthLayout maxWidth="max-w-[550px]">
            <div className="flex flex-col items-start w-full">
                {/* Back button to landing */}
                <button
                    onClick={() => navigate('/landing')}
                    aria-label="Back to landing"
                    className="p-2 -ml-2 mb-2 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center self-start focus:outline-none"
                >
                    <ArrowLeft size={20} />
                </button>

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
