import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../layout/auth/AuthLayout';
import logo from '../../assets/images/ERP_Logo2.png';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { loginWithPasswordApi } from '../../services/authService';
import { handleLoginSuccess } from '../../utils/authUtils';
import { useTranslation } from 'react-i18next';

const CustomInput = ({ label, type = 'text', value, onChange, onBlur, placeholder, name, className = '', prefix, suffix, error, optional, onKeyDown, ...rest }) => {
    const { t } = useTranslation(['auth', 'common']);
    return (
        <div className={`flex flex-col w-full ${className}`}>
            {label && (
                <label className="text-[14px] text-[#374151] mb-2 font-['Plus_Jakarta_Sans'] font-medium block">
                    {label}{' '}{optional ? <span className="text-[#9CA3AF] font-normal">{t('auth:optional')}</span> : <span className="text-red-500">*</span>}
                </label>
            )}
            <div className="relative w-full flex items-center">
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    className={`w-full h-[56px] px-[16px] ${suffix ? 'pr-[48px]' : ''} text-[15px] border ${error ? 'border-red-500 hover:border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-[#D1D5DB] focus:border-[#0F3D2E] focus:ring-[#0F3D2E]'} rounded-[8px] outline-none bg-[#FFFFFF] font-['Plus_Jakarta_Sans'] transition-all duration-300 focus:ring-1 placeholder:text-[#9CA3AF] text-[#111827] ${rest.readOnly ? 'bg-gray-100 cursor-not-allowed opacity-80' : ''}`}
                    {...rest}
                />
                {suffix && (
                    <div className="absolute right-3 flex items-center text-[#6B7280]">
                        {suffix}
                    </div>
                )}
            </div>
            {typeof error === 'string' && error && (
                <div className="mt-1.5 text-red-500 text-[13px] font-medium animate-in fade-in slide-in-from-top-1 duration-300">
                    {error}
                </div>
            )}
        </div>
    );
};

const SignIn = () => {
    const { t } = useTranslation('auth');
    const navigate = useNavigate();

    // Password mode state
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [agreed, setAgreed] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePasswordLogin = async () => {
        if (!identifier.trim()) {
            setError('Please enter your username');
            return;
        }
        if (!password) {
            setError('Please enter your password');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            const response = await loginWithPasswordApi(identifier.trim(), password);
            await handleLoginSuccess(response, navigate);
        } catch (err) {
            let backendMessage = err.response?.data?.message;
            if (Array.isArray(backendMessage)) {
                backendMessage = backendMessage[0];
            }

            if (backendMessage === 'Invalid credentials') {
                setError('Invalid username or password. Please check your credentials and try again.');
            } else if (backendMessage === 'Password not set for this account. Please use OTP login.') {
                setError('Password is not set for this account. Please contact your administrator.');
            } else if (!err.response) {
                setError('Cannot connect to backend server. Please verify the backend is running on the configured port.');
            } else {
                setError(backendMessage || 'Invalid username or password.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (identifier.trim() && password && agreed && !isLoading) {
                handlePasswordLogin();
            }
        }
    };

    return (
        <AuthLayout hideLeftPanel={true}>
            <div className="relative text-left w-full box-border flex flex-col pt-0">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 mb-4 text-gray-900 rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center self-start focus:outline-none"
                >
                    <ArrowLeft size={20} />
                </button>

                <img
                    src={logo}
                    alt="ERP Logo"
                    className="h-18 w-auto mb-2 md:mb-4 block object-contain self-start"
                    onError={(e) => { e.target.style.display = 'none'; }}
                />
                <h2 className="text-[30px] font-['Geist_Sans'] font-bold mb-1 leading-tight text-gray-900">
                    {t('welcome_back')}<br />
                    {t('user_suffix')}
                </h2>
                <p className="text-[14px] font-['Plus_Jakarta_Sans'] font-medium mb-6 text-gray-500">
                    Log in with your Username & Password.
                </p>

                {error && (
                    <div className="p-3.5 mb-4 rounded-[8px] bg-red-50 border border-red-200 text-red-700 text-[14px] font-medium font-['Plus_Jakarta_Sans'] flex items-center gap-2 animate-in fade-in duration-300">
                        <span className="shrink-0 font-bold text-red-600">⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                <div className="flex flex-col gap-4 w-full">
                    <CustomInput
                        label="Username"
                        placeholder="Enter your username"
                        name="identifier"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => {
                            setIdentifier(e.target.value);
                            if (error) setError('');
                        }}
                        onKeyDown={handleKeyDown}
                        error={error ? true : false}
                    />
                    <CustomInput
                        label="Password"
                        placeholder="Enter your password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError('');
                        }}
                        onKeyDown={handleKeyDown}
                        error={error ? true : false}
                        suffix={
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="focus:outline-none cursor-pointer border-none bg-transparent p-1"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        }
                    />

                    <div className="flex items-center">
                        <label className="flex items-start cursor-pointer group">
                            <input
                                type="checkbox"
                                name="agreed"
                                className="mt-[3px] shrink-0 mr-3 peer accent-[#0F3D2E] text-[#0F3D2E] w-[18px] h-[18px] rounded-[4px] border-[#D1D5DB] cursor-pointer"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                            />
                            <span className="text-[14px] font-['Plus_Jakarta_Sans'] text-gray-500 mt-1 cursor-pointer">
                                {t('agree_prefix')} <a href="#" className="text-green-900 underline font-semibold hover:text-[#073318] transition-colors">{t('tc')}</a> {t('and')} <a href="#" className="text-green-900 underline font-semibold hover:text-[#0F3D2E] transition-colors">{t('privacy_policy')}</a> {t('agree_suffix')}
                            </span>
                        </label>
                    </div>

                    <button
                        disabled={!identifier.trim() || !password || !agreed || isLoading}
                        onClick={handlePasswordLogin}
                        className="w-full text-center items-center justify-center h-[56px] bg-[#0F3D2E] text-white text-[16px] font-['Plus_Jakarta_Sans'] font-medium rounded-[8px] hover:bg-[#0a291f] disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </div>
            </div>
        </AuthLayout>
    );
};

export default SignIn;
