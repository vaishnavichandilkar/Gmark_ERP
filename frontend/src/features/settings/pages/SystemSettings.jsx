import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, Image as ImageIcon, Sparkles, Building, Settings2 } from 'lucide-react';
import { updateLanguageApi } from '../../../services/authService';
import CustomizeLogoModal from '../../../components/common/CustomizeLogoModal';
import { getBusinessProfile, getLocalLogoSettings } from '../../../services/businessService';
import { getImageUrl } from '../../../utils/url';

const SystemSettings = () => {
    const { t, i18n } = useTranslation(['modules', 'common']);
    const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem('selectedLanguage') || 'hi');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
    const [logoUrl, setLogoUrl] = useState(null);
    const [shopName, setShopName] = useState('');
    const [logoSettings, setLogoSettings] = useState(getLocalLogoSettings());

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await getBusinessProfile();
                if (data) {
                    const raw = data.logoUrl || localStorage.getItem('custom_invoice_logo');
                    setLogoUrl(raw ? (raw.startsWith('data:') ? raw : getImageUrl(raw)) : null);
                    setShopName(data.shopDetail?.shopName || 'ARDHYA AGRO SERVICE');
                }
            } catch (err) {
                const cached = localStorage.getItem('custom_invoice_logo');
                if (cached) setLogoUrl(cached.startsWith('data:') ? cached : getImageUrl(cached));
            }
        };
        fetchProfile();
    }, []);

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

            {/* Invoice & Business Logo Customization Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                            <ImageIcon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Invoice & Business Logo</h2>
                            <p className="text-sm text-gray-500">Customize the company logo displayed at the top of printed invoices and documents</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsLogoModalOpen(true)}
                        className="px-5 py-2.5 bg-[#073318] hover:bg-[#062913] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                    >
                        <Settings2 size={15} />
                        {logoUrl ? 'Customize Logo' : 'Add Logo'}
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                        {/* Logo Preview */}
                        <div className="w-20 h-20 shrink-0 flex items-center justify-center p-1 bg-white rounded-xl border border-gray-200 shadow-sm">
                            {logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt="Invoice Logo"
                                    className={`max-w-full max-h-full ${logoSettings.shape === 'circle' ? 'rounded-full object-cover' : 'object-contain'}`}
                                />
                            ) : (
                                <div className="w-14 h-14 bg-[#014A36] rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    LOGO
                                </div>
                            )}
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-base font-bold text-gray-900 mb-1">{shopName || 'Company / Shop Name'}</h3>
                            <p className="text-xs text-gray-500 mb-2">
                                {logoUrl 
                                    ? `Custom logo active (${logoSettings.shape} style, ${logoSettings.size} size)` 
                                    : 'Default dark green circle placeholder currently in use'}
                            </p>
                            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
                                <Sparkles size={12} />
                                Synchronized with Sales Invoices, Sales Orders & Purchase Orders
                            </div>
                        </div>

                        <div>
                            <button
                                onClick={() => setIsLogoModalOpen(true)}
                                className="px-4 py-2 border border-gray-300 hover:bg-white text-gray-700 text-xs font-bold rounded-lg transition-colors"
                            >
                                Change Appearance
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <CustomizeLogoModal
                isOpen={isLogoModalOpen}
                onClose={() => setIsLogoModalOpen(false)}
                currentLogoUrl={logoUrl}
                shopName={shopName}
                onLogoUpdated={(data) => {
                    const resolved = data.logoUrl ? (data.logoUrl.startsWith('data:') ? data.logoUrl : getImageUrl(data.logoUrl)) : null;
                    setLogoUrl(resolved);
                    if (data.settings) setLogoSettings(data.settings);
                }}
            />
        </div>
    );
};

export default SystemSettings;
