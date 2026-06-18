import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, User, Mail, Loader2 } from 'lucide-react';
import axiosInstance from '../../services/axiosInstance';
import { updateProfileApi } from '../../services/authService';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/url';

const EditProfileModal = ({ isOpen, onClose, user, onUpdateSuccess }) => {
    const { t } = useTranslation(['dashboard', 'common']);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        profileImage: user?.profileImage || ''
    });
    const [previewImage, setPreviewImage] = useState(user?.profileImage || null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                profileImage: user.profileImage || ''
            });
            setPreviewImage(user.profileImage || null);
        }
    }, [user, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result);
        };
        reader.readAsDataURL(file);

        // Upload to server
        const uploadFormData = new FormData();
        uploadFormData.append('image', file);
        uploadFormData.append('phone_number', user?.phone || '');

        try {
            const response = await axiosInstance.post('/profile/upload-image', uploadFormData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Update formData with the new path from server
            setFormData(prev => ({ ...prev, profileImage: response.data.profile_image }));
        } catch (err) {
            console.error('Failed to upload image', err);
            setError(t('upload_image_error'));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic Email Validation
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError(t('valid_email_error'));
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const updatedUser = await updateProfileApi({
                name: formData.name,
                email: formData.email,
                profileImage: formData.profileImage
            });

            // Update local storage user data
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({
                ...currentUser,
                name: updatedUser.name,
                email: updatedUser.email,
                profileImage: updatedUser.profileImage
            }));

            if (onUpdateSuccess) onUpdateSuccess(updatedUser);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || t('update_profile_error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const hasInitialEmail = !!user?.email;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-[480px] rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <h2 className="text-[20px] font-bold text-gray-900 font-['Plus_Jakarta_Sans']">{t('edit_profile')}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center mb-10">
                        <div className="relative group">
                            <div className="w-[120px] h-[120px] rounded-full bg-[#65A30D] flex items-center justify-center overflow-hidden border-4 border-white shadow-lg ring-1 ring-gray-100 transition-transform duration-300 group-hover:scale-[1.02]">
                                {previewImage ? (
                                    <img src={getImageUrl(previewImage)} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white text-[48px] font-bold">{formData.name?.charAt(0) || 'U'}</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 w-10 h-10 bg-[#0B3D2E] text-white rounded-full flex items-center justify-center border-2 border-white shadow-md hover:bg-[#092E22] transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[#0B3D2E]"
                            >
                                <Camera size={18} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                        <p className="mt-3 text-[13px] text-gray-500 font-medium font-['Plus_Jakarta_Sans']">{t('click_camera_update')}</p>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-6">
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-[13px] rounded-lg text-center font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-700 ml-1 font-['Plus_Jakarta_Sans']">{t('display_name')}</label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder={t('enter_name_placeholder')}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-[14px] focus:bg-white focus:border-[#0B3D2E] focus:ring-4 focus:ring-[#0B3D2E]/5 outline-none transition-all placeholder:text-gray-400"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-700 ml-1 font-['Plus_Jakarta_Sans']">
                                {t('email_label')} {hasInitialEmail && `(${t('permanently_linked')})`}
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder={hasInitialEmail ? "" : t('no_email_registered')}
                                    disabled={hasInitialEmail}
                                    className={`w-full pl-11 pr-4 py-3 border rounded-xl text-[14px] outline-none transition-all
                                        ${hasInitialEmail
                                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                                            : 'bg-gray-50 border-gray-200 focus:bg-white focus:border-[#0B3D2E] focus:ring-4 focus:ring-[#0B3D2E]/5 placeholder:text-gray-400'}`}
                                />
                            </div>
                            {!hasInitialEmail && (
                                <p className="text-[11px] text-[#0B3D2E] font-medium ml-1">
                                    {t('email_once_note')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-4 mt-10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-[15px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-['Plus_Jakarta_Sans']"
                        >
                            {t('cancel_btn')}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 text-[15px] font-semibold text-white bg-[#0B3D2E] hover:bg-[#092E22] disabled:opacity-70 rounded-xl transition-all shadow-md shadow-[#0B3D2E]/20 flex items-center justify-center gap-2 font-['Plus_Jakarta_Sans']"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    {t('saving_btn')}
                                </>
                            ) : t('save_changes_btn')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfileModal;
