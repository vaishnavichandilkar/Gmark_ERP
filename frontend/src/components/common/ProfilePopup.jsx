import React, { useState, useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/url';
const ProfilePopup = ({ isOpen, activeTrigger, onClose, user, onMyProfile, onLogout }) => {
    const { t } = useTranslation(['dashboard', 'common']);
    const [isVisible, setIsVisible] = useState(false);
    const popupRef = useRef(null);

    // Handle animations and scroll lock logic
    useEffect(() => {
        const mainEl = document.querySelector('main');

        if (isOpen) {
            setIsVisible(true);
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            if (mainEl) {
                mainEl.style.overflow = 'hidden';
            }
        } else {
            const timer = setTimeout(() => setIsVisible(false), 300);
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            if (mainEl) mainEl.style.overflow = '';
            return () => clearTimeout(timer);
        }

        // Cleanup function for unmount
        return () => {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            if (mainEl) mainEl.style.overflow = '';
        }
    }, [isOpen]);

    // Close on click outside or ESC
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupRef.current && !popupRef.current.contains(event.target) && !event.target.closest('[data-profile-trigger="true"]')) {
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
            className={`fixed inset-0 z-50 flex justify-center items-start pt-[72px] md:pt-[76px] px-3 md:px-0 bg-slate-900/20 backdrop-blur-[2px] transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            md:pr-6 md:justify-end`}
            style={{
                justifyContent: window.innerWidth >= 768 ? 'flex-end' : 'center'
            }}
        >
            <div className="relative flex flex-col items-end w-full md:w-auto">
                {/* Visual Tether Arrow */}
                <div
                    className={`absolute -top-1.5 md:-top-2 right-[12px] md:right-[13px] w-3.5 h-3.5 md:w-4 md:h-4 bg-[#ffffff] transform rotate-45 border-l border-t border-gray-100 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                />

                <div
                    ref={popupRef}
                    className={`bg-white w-full md:w-[320px] flex flex-col rounded-[16px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-300 ease-in-out transform max-h-[85vh] origin-top md:origin-top-right ${isOpen ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-4 md:translate-y-0 scale-95 md:scale-90 opacity-0'}`}
                >
                    {/* User Header Section */}
                    <div className="flex items-center p-5 border-b border-gray-100 bg-white">
                        <div className="w-[46px] h-[46px] rounded-full bg-[#65A30D] text-white flex items-center justify-center font-semibold text-[18px] shrink-0 overflow-hidden">
                            {user?.profileImage ? (
                                <img src={getImageUrl(user.profileImage)} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="block mt-0.5">{user?.name?.charAt(0) || 'U'}</span>
                            )}
                        </div>
                        <div className="ml-3 overflow-hidden">
                            <h3 className="text-[15px] font-semibold text-gray-800 leading-tight truncate">{user?.name || 'User'}</h3>
                            <p className="text-[13px] text-gray-500 mt-0.5 truncate">{user?.email || 'user@example.com'}</p>
                        </div>
                    </div>

                    {/* Action List */}
                    <div className="flex flex-col py-2 bg-white">
                        <button
                            onClick={() => {
                                onClose();
                                onMyProfile();
                            }}
                            className="flex items-center px-5 py-3 hover:bg-gray-50 text-gray-700 hover:text-[#166534] transition-colors group"
                        >
                            <User className="w-[18px] h-[18px] text-gray-400 group-hover:text-[#166534] transition-colors" />
                            <span className="ml-3 text-[14px] font-medium">{t('my_profile')}</span>
                        </button>
                    </div>

                    {/* Footer CTA */}
                    <div className="p-4 pt-2 pb-5 bg-white shrink-0">
                        <button
                            onClick={() => {
                                onClose();
                                onLogout();
                            }}
                            className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 text-[14px] font-semibold rounded-[8px] hover:border-[#166534] hover:text-[#166534] hover:bg-green-50 transition-all shadow-sm flex items-center justify-center"
                        >
                            {t('log_out')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePopup;
