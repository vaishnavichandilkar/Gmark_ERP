import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { updateLanguageApi } from '../../../services/authService';

const SystemSettings = () => {
    const { t, i18n } = useTranslation(['modules', 'common']);
    const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem('selectedLanguage') || 'hi');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const languages = [
        { code: 'mr', name: 'Marathi', desc: 'मराठी - प्रादेशिक भाषा' },
        { code: 'hi', name: 'Hindi', desc: 'हिन्दी - राष्ट्रभाषा' },
        { code: 'en', name: 'English', desc: 'English - Global Language' }
    ];

    const handleLanguageChange = async (langCode) => {
        setIsLoading(true);
        setMessage({ type: '', text: '' });
        try {
            // 1. Update Database
            await updateLanguageApi(langCode);

            // 2. Update LocalStorage
            localStorage.setItem('selectedLanguage', langCode);
            localStorage.setItem('i18nextLng', langCode);

            // 3. Update UI
            i18n.changeLanguage(langCode);
            setSelectedLanguage(langCode);

            setMessage({ type: 'success', text: t('modules:lang_updated_success') });

            // Optional: Hard reload to ensure all components refresh if needed
            // setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            console.error("Failed to update language:", error);
            setMessage({ type: 'error', text: t('modules:lang_updated_error') });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('modules:system_settings')}</h1>
                <p className="text-gray-500">{t('modules:system_settings_desc')}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                        <Globe size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{t('modules:language_preference')}</h2>
                        <p className="text-sm text-gray-500">{t('modules:language_pref_desc')}</p>
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                                disabled={isLoading}
                                className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left relative
                                    ${selectedLanguage === lang.code
                                        ? 'border-[#0F3D2E] bg-green-50/30'
                                        : 'border-gray-100 hover:border-gray-200 bg-white'}
                                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                {selectedLanguage === lang.code && (
                                    <div className="absolute top-3 right-3 w-5 h-5 bg-[#0F3D2E] rounded-full flex items-center justify-center text-white">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                )}
                                <span className={`text-base font-bold mb-1 ${selectedLanguage === lang.code ? 'text-[#0F3D2E]' : 'text-gray-900'}`}>
                                    {lang.name}
                                </span>
                                <span className="text-xs text-gray-500 leading-relaxed font-medium">
                                    {lang.desc}
                                </span>
                            </button>
                        ))}
                    </div>

                    {message.text && (
                        <div className={`mt-6 p-4 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-1
                            ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}
                        `}>
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;
