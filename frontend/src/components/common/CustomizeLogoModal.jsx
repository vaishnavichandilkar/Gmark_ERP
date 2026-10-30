import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, Trash2, Check, Image as ImageIcon, RotateCcw, AlertCircle, Sparkles, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
    uploadInvoiceLogo, 
    removeInvoiceLogo, 
    getLocalLogoSettings, 
    saveLocalLogoSettings,
    setFixedCompanyLogo,
    getFixedCompanyLogo
} from '@/services/businessService';
import { getImageUrl } from '@/utils/url';

const CustomizeLogoModal = ({
    isOpen,
    onClose,
    currentLogoUrl,
    shopName = "ARDHYA AGRO SERVICE",
    onLogoUpdated
}) => {
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const initialSettings = getLocalLogoSettings();
    const [shape, setShape] = useState(initialSettings.shape || 'contain'); // 'contain' | 'circle' | 'rounded'
    const [size, setSize] = useState(initialSettings.size || 'md'); // 'sm' | 'md' | 'lg'

    useEffect(() => {
        if (isOpen) {
            setSelectedFile(null);
            const savedSettings = getLocalLogoSettings();
            setShape(savedSettings.shape || 'contain');
            setSize(savedSettings.size || 'md');

            if (currentLogoUrl) {
                setPreviewUrl(currentLogoUrl.startsWith('data:') ? currentLogoUrl : getImageUrl(currentLogoUrl));
            } else {
                const cached = getFixedCompanyLogo();
                setPreviewUrl(cached ? (cached.startsWith('data:') ? cached : getImageUrl(cached)) : null);
            }
        }
    }, [isOpen, currentLogoUrl]);

    if (!isOpen) return null;

    const handleFile = (file) => {
        if (!file) return;

        // Validation
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please upload a valid image file (PNG, JPG, SVG, WEBP).');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB.');
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let finalUrl = previewUrl;
            const newSettings = { shape, size, isFixedDefault: true };

            if (selectedFile) {
                const res = await uploadInvoiceLogo(selectedFile, null, newSettings);
                if (res?.logoUrl) {
                    finalUrl = res.logoUrl;
                }
            } else if (previewUrl && previewUrl.startsWith('data:')) {
                const res = await uploadInvoiceLogo(null, previewUrl, newSettings);
                if (res?.logoUrl) {
                    finalUrl = res.logoUrl;
                }
            } else {
                // Settings update on existing logo
                await uploadInvoiceLogo(null, previewUrl, newSettings);
            }

            // Save settings locally as permanent default
            saveLocalLogoSettings(newSettings);
            if (previewUrl) {
                setFixedCompanyLogo(previewUrl);
            }

            toast.success('Logo saved and permanently fixed as default for all invoices!');
            if (onLogoUpdated) {
                onLogoUpdated({
                    logoUrl: previewUrl,
                    serverUrl: finalUrl,
                    settings: newSettings
                });
            }
            onClose();
        } catch (error) {
            console.error('Failed to save logo:', error);
            // Even if network fails, permanently lock locally
            if (previewUrl) {
                const newSettings = { shape, size, isFixedDefault: true };
                setFixedCompanyLogo(previewUrl);
                saveLocalLogoSettings(newSettings);
                toast.success('Logo permanently fixed as default for your invoices!');
                if (onLogoUpdated) {
                    onLogoUpdated({
                        logoUrl: previewUrl,
                        settings: newSettings
                    });
                }
                onClose();
            } else {
                toast.error(error.response?.data?.message || 'Failed to update invoice logo');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        setIsRemoving(true);
        try {
            await removeInvoiceLogo();
        } catch (err) {
            console.warn('Backend removal warning (proceeding with local reset):', err);
        }
        setFixedCompanyLogo(null);
        const defaultSettings = { shape: 'contain', size: 'md', isFixedDefault: false };
        saveLocalLogoSettings(defaultSettings);
        setSelectedFile(null);
        setPreviewUrl(null);
        toast.success('Fixed logo removed. Restored default placeholder.');
        if (onLogoUpdated) {
            onLogoUpdated({
                logoUrl: null,
                settings: defaultSettings
            });
        }
        setIsRemoving(false);
        onClose();
    };

    const getSizePx = () => {
        if (size === 'sm') return 44;
        if (size === 'lg') return 68;
        return 56; // md (default)
    };

    const getLogoContainerClass = () => {
        const sizeClasses = {
            sm: 'w-[44px] h-[44px]',
            md: 'w-[56px] h-[56px]',
            lg: 'w-[68px] h-[68px]',
        };
        const shapeClasses = {
            circle: 'rounded-full overflow-hidden border border-gray-300 shadow-sm bg-white',
            rounded: 'rounded-xl overflow-hidden border border-gray-300 shadow-sm bg-white',
            contain: 'rounded-none bg-transparent',
        };
        return `${sizeClasses[size]} ${shapeClasses[shape]} flex items-center justify-center transition-all duration-200`;
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div 
                className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 bg-[#073318] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <ImageIcon size={18} className="text-emerald-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-[17px] font-bold leading-tight">Customize Invoice Logo</h2>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 text-[11px] font-semibold border border-emerald-400/30">
                                    <ShieldCheck size={12} /> Fixed Default
                                </span>
                            </div>
                            <p className="text-[12px] text-emerald-100/80">Sets the permanent company logo on all invoices & orders</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors text-white/80 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 text-gray-800">

                    {/* Live Preview Card */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles size={13} className="text-[#073318]" /> Live Invoice Header Preview
                            </label>
                            <span className="text-[11px] text-gray-400">Shows exactly how it appears on printed PDF</span>
                        </div>
                        
                        <div className="p-4 border-2 border-black rounded-lg bg-white shadow-sm">
                            <div className="border border-black p-3 relative flex items-center justify-center min-h-[75px]">
                                <div className="absolute left-4 flex items-center justify-center">
                                    <div className={getLogoContainerClass()}>
                                        {previewUrl ? (
                                            <img
                                                src={previewUrl}
                                                alt="Invoice Logo"
                                                className={`w-full h-full ${shape === 'contain' ? 'object-contain' : 'object-cover'}`}
                                            />
                                        ) : (
                                            <div className="w-14 h-14 bg-[#014A36] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-inner">
                                                LOGO
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-[18px] font-black uppercase text-center tracking-wide text-gray-900 ml-16 truncate max-w-[280px]">
                                    {shopName || "COMPANY NAME"}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Upload Dropzone */}
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                            className="hidden"
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />

                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2
                                ${isDragging ? 'border-[#073318] bg-emerald-50/50 scale-[0.99]' : 'border-gray-200 hover:border-[#073318] hover:bg-gray-50/60 bg-gray-50/30'}
                            `}
                        >
                            <div className="w-12 h-12 rounded-full bg-emerald-100/60 text-[#073318] flex items-center justify-center mb-1">
                                <UploadCloud size={24} />
                            </div>
                            <div className="text-[14px] font-semibold text-gray-800">
                                Click or drag & drop your logo here
                            </div>
                            <p className="text-[12px] text-gray-500">
                                Supports PNG, JPG, WEBP, or SVG (Transparent PNG recommended, Max 5MB)
                            </p>
                            {selectedFile && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                                    <Check size={13} /> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Customization Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* Shape Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                                Logo Display Shape
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'contain', label: 'Original', desc: 'No crop' },
                                    { id: 'circle', label: 'Circle', desc: 'Classic circle' },
                                    { id: 'rounded', label: 'Rounded', desc: 'Modern box' }
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setShape(item.id)}
                                        className={`px-3 py-2 rounded-xl text-center border-2 transition-all text-xs font-bold
                                            ${shape === item.id 
                                                ? 'border-[#073318] bg-emerald-50 text-[#073318]' 
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'}
                                        `}
                                    >
                                        <div>{item.label}</div>
                                        <div className="text-[10px] font-normal text-gray-500">{item.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Size Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                                Logo Size
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'sm', label: 'Small', px: '44px' },
                                    { id: 'md', label: 'Medium', px: '56px' },
                                    { id: 'lg', label: 'Large', px: '68px' }
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSize(item.id)}
                                        className={`px-3 py-2 rounded-xl text-center border-2 transition-all text-xs font-bold
                                            ${size === item.id 
                                                ? 'border-[#073318] bg-emerald-50 text-[#073318]' 
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'}
                                        `}
                                    >
                                        <div>{item.label}</div>
                                        <div className="text-[10px] font-normal text-gray-500">{item.px}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Information Note */}
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-xl flex items-start gap-3 text-[12px] text-emerald-950 leading-relaxed shadow-sm">
                        <ShieldCheck size={20} className="shrink-0 mt-0.5 text-emerald-700" />
                        <div>
                            <strong>Permanent Fixed Default:</strong> Once added and saved, this logo is automatically fixed as the permanent default on all your future <strong>Invoices</strong>, <strong>Sales Orders</strong>, and <strong>Purchase Orders</strong> across the system.
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
                    <div>
                        {previewUrl && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={isRemoving || isSaving}
                                className="px-3.5 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={14} />
                                {isRemoving ? 'Resetting...' : 'Reset to Default'}
                            </button>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || isRemoving || (!selectedFile && !previewUrl)}
                            className="px-5 py-2 bg-[#073318] hover:bg-[#062913] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving & Fixing as Default...
                                </>
                            ) : (
                                <>
                                    <Check size={14} />
                                    Save as Permanent Default Logo
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomizeLogoModal;
