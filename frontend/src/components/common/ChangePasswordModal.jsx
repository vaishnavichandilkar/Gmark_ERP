import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import logo from '../../assets/images/bizdrona_logo.png';

const ChangePasswordModal = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation(['auth', 'common']);
    const [isVisible, setIsVisible] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const modalRef = useRef(null);

    // Handle animations and scroll lock logic
    useEffect(() => {
        const mainEl = document.querySelector('main');

        if (isOpen) {
            setIsVisible(true);
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            if (mainEl) {
                // Ensure existing dataset isn't unnecessarily overwritten
                if (!mainEl.dataset.originalOverflow) {
                    mainEl.dataset.originalOverflow = mainEl.style.overflow || '';
                }
                mainEl.style.overflow = 'hidden';
            }
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            if (mainEl) mainEl.style.overflow = mainEl.dataset.originalOverflow || '';
            return () => clearTimeout(timer);
        }

        // Cleanup function for unmount
        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            if (mainEl) mainEl.style.overflow = mainEl.dataset.originalOverflow || '';
        }
    }, [isOpen]);

    // Close on click outside or ESC
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isVisible && !isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/30 backdrop-blur-[2px] transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            <div
                ref={modalRef}
                className={`bg-white w-full max-w-[480px] flex flex-col rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.2)] overflow-hidden transition-all duration-300 ease-in-out transform origin-center p-8 ${isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'}`}
            >
                {/* Header Section */}
                <div className="flex flex-col mb-8 mt-2">
                    <img src={logo} alt="Logo" className="h-6 w-auto object-contain self-start mb-6" />
                    <h2 className="text-[26px] font-bold text-gray-900 tracking-tight leading-tight">{t('change_pwd_title')}</h2>
                    <p className="text-[15px] text-gray-500 mt-2 font-medium">{t('change_pwd_desc')}</p>
                </div>

                {/* Form Section */}
                <div className="flex flex-col space-y-5">
                    {/* Current Password */}
                    <div className="flex flex-col">
                        <label className="text-[14px] font-semibold text-gray-700 mb-2">{t('current_pwd')}</label>
                        <div className="relative">
                            <input
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder={t('enter_current_pwd')}
                                className="w-full border border-gray-200 rounded-[10px] px-4 py-3.5 text-[15px] text-gray-800 outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534] transition-all placeholder:text-gray-400 shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <span className="text-[13px] text-gray-500 mt-2 ml-1">{t('pwd_min_chars')}</span>
                    </div>

                    {/* New Password */}
                    <div className="flex flex-col">
                        <label className="text-[14px] font-semibold text-gray-700 mb-2">{t('new_pwd')}</label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? "text" : "password"}
                                placeholder={t('enter_new_pwd')}
                                className="w-full border border-gray-200 rounded-[10px] px-4 py-3.5 text-[15px] text-gray-800 outline-none focus:border-[#166534] focus:ring-1 focus:ring-[#166534] transition-all placeholder:text-gray-400 shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col mt-8 space-y-4">
                    <button
                        onClick={onSuccess}
                        className="w-full bg-[#166534] hover:bg-[#14532d] text-white font-semibold py-3.5 rounded-[12px] transition-colors shadow-sm text-[15px]"
                    >
                        {t('change_password', { ns: 'dashboard' })}
                    </button>

                    <button
                        onClick={onClose}
                        className="flex items-center justify-center w-full py-2 text-[14px] font-semibold text-gray-500 hover:text-gray-800 transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        {t('back_to_dashboard')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
