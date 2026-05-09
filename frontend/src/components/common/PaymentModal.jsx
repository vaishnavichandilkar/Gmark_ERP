import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ChevronDown, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';

const PaymentModal = ({ isOpen, onClose, type = 'Payment', initialData = null }) => {
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        bankCash: 'Bank Account',
        entries: [{ id: Date.now(), account: initialData?.account || '', amount: '' }],
        narration: '',
        paymentMode: 'Online / Transfer'
    });

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const bankCashOptions = ['Bank Account', 'Cash in Hand'];
    const paymentModeOptions = ['Online / Transfer', 'Cheque', 'UPI / QR', 'Cash'];

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSuccess(true);
            setTimeout(() => {
                setIsSuccess(false);
                onClose();
            }, 2000);
        }, 1500);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEntryChange = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            entries: prev.entries.map(entry => 
                entry.id === id ? { ...entry, [field]: value } : entry
            )
        }));
    };

    const handleAddRow = () => {
        setFormData(prev => ({
            ...prev,
            entries: [...prev.entries, { id: Date.now(), account: '', amount: '' }]
        }));
    };

    const handleRemoveRow = (id) => {
        if (formData.entries.length > 1) {
            setFormData(prev => ({
                ...prev,
                entries: prev.entries.filter(entry => entry.id !== id)
            }));
        }
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        setActiveDropdown(null);
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-[800px] overflow-visible font-['Plus_Jakarta_Sans'] border border-[#E5E7EB]"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white rounded-t-[16px]">
                    <h2 className="text-[18px] font-bold text-gray-800 tracking-wide">
                        {type} Voucher
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6">
                    {isSuccess ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
                            <h3 className="text-[20px] font-bold text-gray-900">Voucher Saved Successfully</h3>
                        </div>
                    ) : (
                    <div className="space-y-6">
                        {/* Header Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F9FAFB] p-6 rounded-xl border border-[#E5E7EB]">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider">Voucher Date</label>
                                <div className="relative">
                                    <input 
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        className="w-full h-11 px-4 bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[15px] transition-all"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider">Bank / Cash Account</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActiveDropdown(activeDropdown === 'bankCash' ? null : 'bankCash')}
                                        className="w-full h-11 px-4 bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[15px] flex items-center justify-between transition-all"
                                    >
                                        <span className={formData.bankCash ? 'text-gray-800' : 'text-gray-400'}>
                                            {formData.bankCash || 'Select Account'}
                                        </span>
                                        <ChevronDown size={18} className={`text-[#6B7280] transition-transform duration-200 ${activeDropdown === 'bankCash' ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    <AnimatePresence>
                                        {activeDropdown === 'bankCash' && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute top-12 left-0 right-0 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 py-2 overflow-hidden"
                                                >
                                                    {bankCashOptions.map((opt) => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => handleSelectChange('bankCash', opt)}
                                                            className={`w-full px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-gray-50 ${formData.bankCash === opt ? 'text-[#073318] bg-[#073318]/5' : 'text-gray-700'}`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {/* Ledger Table Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[15px] font-bold text-[#111827] tracking-tight">Ledger Account</h3>
                                <button 
                                    type="button" 
                                    onClick={handleAddRow}
                                    className="text-[13px] font-bold text-[#073318] hover:underline"
                                >
                                    + Add Row
                                </button>
                            </div>
                            
                            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#F3F4F6] border-b border-[#E5E7EB]">
                                            <th className="px-6 py-3 text-left text-[12px] font-bold text-[#6B7280] tracking-wider">Account</th>
                                            <th className="px-6 py-3 text-right text-[12px] font-bold text-[#6B7280] tracking-wider w-[200px]">Amount (₹)</th>
                                            <th className="w-[50px]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {formData.entries.map((entry, index) => (
                                            <tr key={entry.id} className="border-b border-[#F3F4F6] last:border-0 group">
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="text"
                                                        placeholder="Search account..."
                                                        value={entry.account}
                                                        onChange={(e) => handleEntryChange(entry.id, 'account', e.target.value)}
                                                        className="w-full h-10 px-3 bg-[#F9FAFB] border border-transparent rounded-lg focus:bg-white focus:border-[#073318] outline-none text-[14px] transition-all"
                                                        required
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={entry.amount}
                                                        onChange={(e) => handleEntryChange(entry.id, 'amount', e.target.value)}
                                                        className="w-full h-10 px-3 bg-[#F9FAFB] border border-transparent rounded-lg focus:bg-white focus:border-[#073318] outline-none text-[14px] text-right font-bold text-[#073318] transition-all"
                                                        required
                                                    />
                                                </td>
                                                <td className="px-2 text-center">
                                                    {formData.entries.length > 1 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveRow(entry.id)}
                                                            className="p-2 text-red-400 hover:text-red-600 transition-colors flex items-center justify-center w-full"
                                                            title="Remove Row"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider">Narration</label>
                                <textarea 
                                    name="narration"
                                    placeholder="Enter details..."
                                    value={formData.narration}
                                    onChange={handleChange}
                                    className="w-full h-24 px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[14px] resize-none transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider">Payment Mode</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setActiveDropdown(activeDropdown === 'paymentMode' ? null : 'paymentMode')}
                                        className="w-full h-11 px-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[15px] flex items-center justify-between transition-all"
                                    >
                                        <span className={formData.paymentMode ? 'text-gray-800' : 'text-gray-400'}>
                                            {formData.paymentMode || 'Select Mode'}
                                        </span>
                                        <ChevronDown size={18} className={`text-[#6B7280] transition-transform duration-200 ${activeDropdown === 'paymentMode' ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    <AnimatePresence>
                                        {activeDropdown === 'paymentMode' && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute top-12 left-0 right-0 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 py-2 overflow-hidden"
                                                >
                                                    {paymentModeOptions.map((opt) => (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => handleSelectChange('paymentMode', opt)}
                                                            className={`w-full px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-gray-50 ${formData.paymentMode === opt ? 'text-[#073318] bg-[#073318]/5' : 'text-gray-700'}`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {!isSuccess && (
                        <div className="mt-8 flex justify-end gap-3 px-2 pb-2">
                            <button 
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl border border-[#E5E7EB] font-bold text-[#6B7280] hover:bg-gray-50 transition-all text-[14px]"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="px-8 py-2.5 rounded-xl bg-[#073318] text-white font-bold hover:bg-[#0a4422] transition-all text-[14px] flex items-center gap-2 shadow-[0_4px_14px_rgba(7,51,24,0.25)] active:scale-95"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>Save</>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </motion.div>
        </div>,
        document.body
    );
};

export default PaymentModal;
