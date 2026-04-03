import React from 'react';
import illustration from '../../assets/images/ERP_Logo1.png';
import { useTranslation } from 'react-i18next';

const AuthLayout = ({ children, maxWidth = 'max-w-[480px]', hideLeftPanel = false, disableRightScroll = false, justify = 'center' }) => {
    const { t } = useTranslation('auth');
    return (
        <div className="flex w-full min-h-screen flex-col md:flex-row h-auto md:h-screen overflow-auto md:overflow-hidden bg-[#F8FAF0]">
            {/* Left Panel - Fixed */}
            <div
                className={`
                    hidden md:flex 
                    w-full md:w-[33.05%] basis-full md:basis-[33.05%] md:max-w-[33.05%] 
                    h-auto md:h-full 
                    flex-col justify-center pt-8 md:pt-8 text-white relative overflow-hidden
                `}
                style={{
                    background: 'linear-gradient(to bottom, #f3f7ea 0%, #cde57a 12%, #a6d61f 65%, #0f3d1f 100%)'
                }}
            >
                <div className="w-full h-full flex flex-col justify-center relative z-10">
                    <div className="px-6 md:px-10 flex-1 flex flex-col justify-center">
                        <div>
                            <h1 className="text-[33px] font-['Geist_Sans'] font-bold mb-6 leading-tight tracking-tight text-gray-900">
                                {t('powering_your')} <span className="bg-[#073318] px-2 py-0.5 rounded ml-0.5 text-white shadow-sm inline-block">{t('business')}</span><br />
                                <span className="bg-[#073318] px-2 py-0.5 rounded mr-0.5 text-white shadow-sm inline-block mt-1">{t('operations')}</span>
                            </h1>

                            <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium opacity-90 max-w-[90%] mb-12 leading-relaxed text-gray-800">
                                {t('streamline_desc')}
                            </p>
                        </div>
                    </div>

                    {/* Illustration */}
                    <img
                        src={illustration}
                        alt="ERP Illustration"
                        className="mt-auto w-full h-auto drop-shadow-[0_10px_15px_rgba(0,0,0,0.2)] block object-contain object-bottom"
                    />
                </div>
            </div>

            {/* Right Panel - Scrollable */}
            <div className={`flex-1 w-full md:w-[66.95%] basis-full md:basis-[66.95%] md:max-w-[66.95%] min-h-screen md:min-h-0 h-auto md:h-full overflow-visible ${disableRightScroll ? 'md:overflow-hidden' : 'md:overflow-y-auto'} bg-white flex flex-col items-center font-sans`}>
                <div className={`w-full p-6 md:p-8 box-border grow flex flex-col ${justify === 'center' ? 'justify-center' : 'justify-start pt-12 md:pt-16'} min-h-min ${maxWidth}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;



