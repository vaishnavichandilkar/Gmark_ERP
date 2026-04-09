import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, User, Globe, ChevronDown, LayoutDashboard, FileBarChart, Database, ShoppingCart, TrendingUp, Settings as SettingsIcon } from 'lucide-react';
import logo from '../../assets/images/ERP_Logo2.png';
import ProfilePopup from '../../components/common/ProfilePopup';
import LogoutModal from '../../components/common/LogoutModal';
import StatusPopup from '../../components/common/StatusPopup';
import EditProfileModal from '../../components/common/EditProfileModal';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import { getProfileApi } from '../../services/authService';
import { useTranslation } from 'react-i18next';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
    const { t } = useTranslation(['dashboard', 'common', 'modules', 'terms']);
    const location = useLocation();
    const navigate = useNavigate();

    // Popup states
    const [activePopupType, setActivePopupType] = useState(null);
    const [isLogoutOpen, setIsLogoutOpen] = useState(false);
    const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

    React.useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const data = await getProfileApi();
                setUserData(data);
                localStorage.setItem('user', JSON.stringify(data));
            } catch (err) {
                console.error('Failed to fetch profile', err);
            }
        };

        fetchUserProfile();
    }, []);

    // Determine Breadcrumbs dynamically
    const renderBreadcrumbs = () => {
        const path = location.pathname.replace(/\/$/, "");
        const segments = path.split('/').filter(Boolean);

        let IconComponent = LayoutDashboard;
        const pathSegments = segments.filter(seg => seg !== 'seller' && seg !== 'dashboard');

        if (pathSegments.length > 0) {
            switch (pathSegments[0]) {
                case 'reports': IconComponent = FileBarChart; break;
                case 'masters': IconComponent = Database; break;
                case 'purchase': IconComponent = ShoppingCart; break;
                case 'sales': IconComponent = TrendingUp; break;
                case 'settings': IconComponent = SettingsIcon; break;
                default: IconComponent = LayoutDashboard; break;
            }
        }

        let breadcrumbElements = (
            <span className="font-bold text-[#111827]">{t('terms:dashboard')}</span>
        );

        if (pathSegments.length > 0) {
            const formattedSegments = pathSegments.map((segment, index) => {
                const isSales = pathSegments[0] === 'sales';

                // Special handling for 'add' and 'edit' segments to show verbose labels
                if (segment === 'add' || segment === 'edit' || segment === 'view') {
                    const parent = pathSegments[index - 1];
                    if (parent) {
                        let parentKey = parent.replace(/-/g, '_');
                        if (parentKey === 'category') parentKey = 'category_master';
                        
                        const action = segment === 'add' ? 'add' : (segment === 'edit' ? 'edit' : 'view');
                        // Map entity names (e.g., group_master -> group, order -> po/order)
                        let entity = parentKey.replace('_master', '');
                        
                        if (entity === 'order') {
                            entity = isSales ? 'so' : 'po';
                        }
                        if (entity === 'invoice') {
                            entity = isSales ? 'sales_invoice' : 'purchase_invoice';
                        }
                        
                        const verboseKey = `${action}_${entity}`;
                        const translated = t(`modules:${verboseKey}`, { defaultValue: '' });
                        if (translated) return translated;
                    }
                }

                let key = segment.replace(/-/g, '_');
                if (key === 'category') key = 'category_master';
                
                // If it's the 'order' segment under 'sales', use 'sales_order'
                if (key === 'order' && isSales) {
                    key = 'sales_order';
                }

                const translated = t(`modules:${key}`, { defaultValue: '' }) || t(`common:${key}`, { defaultValue: '' });
                if (translated) return translated;
                return segment.split(/[_-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
            });

            breadcrumbElements = formattedSegments.map((segment, index) => {
                const isLast = index === formattedSegments.length - 1;
                return (
                    <span key={index} className="flex items-center">
                        <span className={isLast ? "font-bold text-[#111827]" : "text-[#4B5563]"}>
                            {segment}
                        </span>
                        {!isLast && <span className="mx-1.5 font-normal text-[#4B5563]">&gt;</span>}
                    </span>
                );
            });
        }

        return (
            <div className="flex items-center text-[#111827] text-[14px] lg:text-[16px] font-semibold tracking-tight overflow-hidden">
                <div className="hidden md:flex items-center">
                    {breadcrumbElements}
                </div>
                <div className="md:hidden truncate">
                    {pathSegments.length > 0 ? (
                        <span className="font-bold text-[#111827]">
                            {t(`modules:${pathSegments[pathSegments.length - 1].replace(/-/g, '_')}`, { defaultValue: '' }) || 
                             t(`common:${pathSegments[pathSegments.length - 1].replace(/-/g, '_')}`, { defaultValue: '' }) || 
                             pathSegments[pathSegments.length - 1]}
                        </span>
                    ) : (
                        <span className="font-bold text-[#111827]">{t('terms:dashboard')}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <header className="h-[64px] lg:h-[72px] bg-white border-b border-[#E5E7EB] px-3 md:px-6 flex items-center justify-between shrink-0">
            {/* Left Box: Menu button + Title/Logo */}
            <div className="flex items-center gap-1.5 md:gap-4 overflow-hidden flex-1">
                <button
                    onClick={() => setSidebarOpen(prev => !prev)}
                    className="p-2 text-[#4B5563] hover:text-[#111827] focus:outline-none hover:bg-gray-100/80 rounded-lg transition-all active:scale-95 shrink-0"
                >
                    <Menu className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                </button>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <img 
                        src={logo} 
                        alt="Logo" 
                        className="h-8 w-auto lg:hidden shrink-0" 
                        onError={(e) => { e.target.style.display = 'none' }}
                    />
                    <div className="flex items-center min-w-0">
                        {renderBreadcrumbs()}
                    </div>
                </div>
            </div>

            {/* Right Box: Setup icons */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">

                {/* Rightmost Action icons */}
                <div className="flex items-center gap-2 md:gap-4 relative">
                    <div>
                        <LanguageSwitcher />
                    </div>

                    <button
                        onClick={() => setActivePopupType(activePopupType === 'profile' ? null : 'profile')}
                        data-profile-trigger="true"
                        className={`bg-[#65A30D] text-white w-[32px] h-[32px] md:w-[38px] md:h-[38px] rounded-full flex items-center justify-center font-semibold border-2 border-white transition-all duration-200 ease-in-out overflow-hidden
                            ${activePopupType === 'profile'
                                ? 'scale-105 shadow-[0_0_15px_rgba(22,101,52,0.4)] z-[60] relative'
                                : 'shadow-sm hover:scale-105 relative z-10'
                            }`}
                    >
                        {userData?.profileImage ? (
                            <img src={`http://localhost:3000/${userData.profileImage}`} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <User size={18} md:size={22} className="mt-0.5" strokeWidth={1.5} />
                        )}
                    </button>
                </div>
            </div>


            {/* Popups */}
            <StatusPopup isOpen={activePopupType === 'status'} activeTrigger={activePopupType} onClose={() => setActivePopupType(null)} />
            <ProfilePopup
                isOpen={activePopupType === 'profile'}
                activeTrigger={activePopupType}
                onClose={() => setActivePopupType(null)}
                user={userData}
                onMyProfile={() => setIsEditProfileOpen(true)}
                onLogout={() => setIsLogoutOpen(true)}
            />

            <LogoutModal
                isOpen={isLogoutOpen}
                onClose={() => setIsLogoutOpen(false)}
                onConfirm={() => {
                    setIsLogoutOpen(false);
                    // Clear tokens and user data
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    localStorage.removeItem('languageConfirmed');
                    // Redirect to landing page
                    navigate('/');
                }}
            />

            <EditProfileModal
                isOpen={isEditProfileOpen}
                onClose={() => setIsEditProfileOpen(false)}
                user={userData}
                onUpdateSuccess={(updatedUser) => setUserData(updatedUser)}
            />
        </header>
    );
};

export default Header;
