import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, ChevronDown, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import voucherService from '../../services/voucherService';
import AccountSearchDropdown from './AccountSearchDropdown';
import toast from 'react-hot-toast';
import SettlementModal from './SettlementModal';
import DateInput from './DateInput';
import { toDisplayDate, toIsoDate } from '../../utils/dateUtils';

const PaymentModal = ({ isOpen, onClose, type = 'Payment', initialData = null }) => {
    const [formData, setFormData] = useState({
        date: toDisplayDate(new Date()),
        bankCashLedgerId: '',
        entries: [{ id: Date.now(), accountId: '', accountName: '', amount: '' }],
        narration: '',
        paymentMode: 'Net banking'
    });

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [bankCashOptions, setBankCashOptions] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [allActiveAccounts, setAllActiveAccounts] = useState([]);
    const [isSettlementOpen, setIsSettlementOpen] = useState(false);
    const [activeEntryId, setActiveEntryId] = useState(null);
    const [searchFilter, setSearchFilter] = useState('');
    const getRowOptions = (filterMode) => {
        if (filterMode === 'Customer' || filterMode === 'Supplier') {
            return [...customers, ...suppliers];
        }
        if (filterMode === 'BankCash') {
            if (type === 'Contra' && formData.bankCashLedgerId) {
                return bankCashOptions.filter(opt => Number(opt.id) !== Number(formData.bankCashLedgerId));
            }
            return bankCashOptions;
        }
        if (filterMode === 'All') return allActiveAccounts;
        return [...customers, ...suppliers];
    };

    const paymentModeOptions = [
        { label: 'Debit Card', value: 'DEBIT_CARD' },
        { label: 'Credit Card', value: 'CREDIT_CARD' },
        { label: 'Net Banking', value: 'NET_BANKING' },
        { label: 'Cheque', value: 'CHEQUE' },
        { label: 'UPI', value: 'UPI' },
        { label: 'Cash', value: 'CASH' }
    ];

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Bank/Cash accounts
                const bankCashRes = await voucherService.getBankCashAccounts();
                setBankCashOptions(bankCashRes || []);
                
                let initialLedgerId = '';
                if (type === 'Journal') {
                    const allActiveRes = await voucherService.getActiveAccounts();
                    setAllActiveAccounts(allActiveRes || []);
                    if (allActiveRes?.length > 0) {
                        initialLedgerId = allActiveRes[0].id;
                    }
                } else {
                    // Fetch both Customer and Supplier accounts concurrently
                    const [customersRes, suppliersRes] = await Promise.all([
                        voucherService.getCustomers(),
                        voucherService.getSuppliers()
                    ]);
                    setCustomers(customersRes || []);
                    setSuppliers(suppliersRes || []);
                    if (bankCashRes?.length > 0) {
                        initialLedgerId = bankCashRes[0].id;
                    }
                }

                if (initialLedgerId && !formData.bankCashLedgerId) {
                    setFormData(prev => ({ ...prev, bankCashLedgerId: initialLedgerId }));
                }
            } catch (err) {
                console.error('Failed to fetch voucher data', err);
                toast.error('Failed to load accounts');
            }
        };

        if (isOpen) {
            if (initialData && initialData.id) {
                // Edit Mode!
                setFormData({
                    date: initialData.voucherDate ? toDisplayDate(initialData.voucherDate) : toDisplayDate(new Date()),
                    bankCashLedgerId: initialData.bankCashLedgerId || '',
                    entries: initialData.items?.map(item => {
                        const settlements = item.settlements || [];
                        const summaryParts = [];
                        settlements.forEach(s => {
                            if (s.settlementType === 'ADVANCE') {
                                summaryParts.push(`Advance - ₹${s.settledAmount}`);
                            } else if (s.settlementType === 'ON_ACCOUNT') {
                                summaryParts.push(`On Account - ₹${s.settledAmount}`);
                            } else if (s.settlementType === 'AGAINST_REFERENCE') {
                                summaryParts.push(`Against Ref: [₹${s.settledAmount}]`);
                            }
                        });
                        const fallbackType = type === 'Receipt' ? 'CUSTOMER' : (type === 'Journal' ? 'LEDGER' : (type === 'Contra' ? 'BANK' : 'SUPPLIER'));
                        const fMode = type === 'Journal' ? 'All' : (type === 'Contra' ? 'BankCash' : (type === 'Receipt' || item.accountType === 'CUSTOMER' ? 'Customer' : 'Supplier'));
                        
                        return {
                            id: item.id || Date.now() + Math.random(),
                            accountId: `${item.accountId}-${item.accountType || fallbackType}`,
                            accountName: item.account?.accountName || '',
                            amount: item.amount || '',
                            filterMode: fMode,
                            settlementType: settlements.length > 0 ? (settlements.length === 1 ? settlements[0].settlementType : 'MIXED') : null,
                            settlements: settlements.map(s => ({
                                invoiceId: s.invoiceId,
                                settlementType: s.settlementType,
                                settledAmount: s.settledAmount
                            })),
                            settlementSummary: summaryParts.join('; ')
                        };
                    }) || [],
                    narration: initialData.narration || '',
                    paymentMode: initialData.paymentMode || 'NET_BANKING'
                });
            } else {
                setFormData({
                    date: toDisplayDate(new Date()),
                    bankCashLedgerId: '',
                    entries: [{ 
                        id: Date.now(), 
                        accountId: initialData?.accountId ? `${initialData.accountId}-${initialData.accountType || (type === 'Receipt' ? 'CUSTOMER' : (type === 'Journal' ? 'LEDGER' : (type === 'Contra' ? 'BANK' : 'SUPPLIER')))}` : '', 
                        accountName: initialData?.account || '', 
                        amount: '',
                        filterMode: type === 'Receipt' ? 'Customer' : (type === 'Journal' ? 'All' : (type === 'Contra' ? 'BankCash' : 'Supplier'))
                    }],
                    narration: '',
                    paymentMode: 'NET_BANKING'
                });
            }
            setIsSuccess(false);
            setIsSubmitting(false);
            fetchData();
        }
    }, [isOpen, initialData, type]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.bankCashLedgerId) {
            toast.error('Please select a Bank/Cash account');
            return;
        }

        const validEntries = formData.entries.filter(e => e.accountId && e.amount);
        if (validEntries.length === 0) {
            toast.error('Please add at least one valid entry');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                voucherDate: toIsoDate(formData.date),
                bankCashLedgerId: Number(formData.bankCashLedgerId),
                paymentMode: formData.paymentMode,
                narration: formData.narration,
                items: validEntries.map(e => {
                    const parts = String(e.accountId).split('-');
                    return {
                        accountId: Number(parts[0]),
                        amount: Number(e.amount),
                        accountType: parts[1] || (type === 'Receipt' ? 'CUSTOMER' : (type === 'Journal' ? 'CUSTOMER' : 'SUPPLIER')),
                        settlements: e.settlements || []
                    };
                })
            };

            if (initialData && initialData.id) {
                if (type === 'Receipt') {
                    await voucherService.updateReceiptVoucher(initialData.id, payload);
                } else if (type === 'Journal') {
                    await voucherService.updateJournalVoucher(initialData.id, payload);
                } else if (type === 'Contra') {
                    await voucherService.updateContraVoucher(initialData.id, payload);
                } else {
                    await voucherService.updatePaymentVoucher(initialData.id, payload);
                }
            } else {
                if (type === 'Receipt') {
                    await voucherService.createReceiptVoucher(payload);
                } else if (type === 'Journal') {
                    await voucherService.createJournalVoucher(payload);
                } else if (type === 'Contra') {
                    await voucherService.createContraVoucher(payload);
                } else {
                    await voucherService.createPaymentVoucher(payload);
                }
            }

            // Dispatch event for UI updates
            const event = new CustomEvent('voucherAdded', { 
                detail: { type, formData } 
            });
            window.dispatchEvent(event);

            setIsSuccess(true);
            toast.success(`${type} Voucher saved successfully`);
            
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error) {
            console.error('Error saving voucher:', error);
            const msg = error.response?.data?.message;
            toast.error(Array.isArray(msg) ? msg[0] : (msg || `Failed to save ${type} voucher`));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEntryChange = (id, field, value, extra = {}) => {
        setFormData(prev => {
            const updatedEntries = prev.entries.map(entry => {
                if (entry.id === id) {
                    const clearedFields = field === 'accountId' ? {
                        settlementType: null,
                        settlements: [],
                        settlementSummary: ''
                    } : {};

                    let updatedSettlement = {};
                    if (field === 'amount' && (entry.settlementType === 'ADVANCE' || entry.settlementType === 'ON_ACCOUNT')) {
                        const amtNum = parseFloat(value) || 0;
                        const label = entry.settlementType === 'ADVANCE' 
                            ? (type === 'Receipt' ? 'Advance Receipt' : (type === 'Journal' ? 'Advance Journal' : 'Advance Payment'))
                            : (type === 'Receipt' ? 'On Account Receipt' : (type === 'Journal' ? 'On Account Journal' : 'On Account Payment'));
                        
                        updatedSettlement = {
                            settlements: [{ settlementType: entry.settlementType, settledAmount: amtNum }],
                            settlementSummary: `${label} - ₹${value}`
                        };
                    }

                    return { ...entry, [field]: value, ...clearedFields, ...updatedSettlement, ...extra };
                }
                return entry;
            });

            let newNarration = prev.narration;
            if (field === 'amount') {
                const summaries = updatedEntries
                    .map(e => e.settlementSummary)
                    .filter(Boolean)
                    .join('; ');
                newNarration = summaries || prev.narration;
            }

            return {
                ...prev,
                entries: updatedEntries,
                narration: newNarration
            };
        });
    };

    const handleAmountClick = (entry) => {
        if (type === 'Contra' || type === 'Journal') return;
        if (!entry.accountId) {
            toast.error(`Please select a ${type === 'Receipt' ? 'Customer' : 'Supplier'} first`);
            return;
        }
        setActiveEntryId(entry.id);
        setIsSettlementOpen(true);
    };

    const handleSaveSettlement = ({ settlementType, amount, settlements, narration }) => {
        setFormData(prev => {
            const updatedEntries = prev.entries.map(entry => {
                if (entry.id === activeEntryId) {
                    return {
                        ...entry,
                        amount,
                        settlementType,
                        settlements,
                        settlementSummary: narration
                    };
                }
                return entry;
            });

            const summaries = updatedEntries
                .map(e => e.settlementSummary)
                .filter(Boolean)
                .join('; ');

            return {
                ...prev,
                entries: updatedEntries,
                narration: summaries || prev.narration
            };
        });
    };

    const handleAddRow = () => {
        setFormData(prev => ({
            ...prev,
            entries: [...prev.entries, { 
                id: Date.now(), 
                accountId: '', 
                accountName: '', 
                amount: '',
                filterMode: type === 'Receipt' ? 'Customer' : (type === 'Journal' ? 'All' : (type === 'Contra' ? 'BankCash' : 'Supplier'))
            }]
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
        setFormData(prev => {
            let updatedEntries = prev.entries;
            if (type === 'Contra' && name === 'bankCashLedgerId') {
                updatedEntries = prev.entries.map(entry => {
                    if (entry.accountId) {
                        const [idStr] = String(entry.accountId).split('-');
                        if (Number(idStr) === Number(value)) {
                            return {
                                ...entry,
                                accountId: '',
                                accountName: '',
                                settlementType: null,
                                settlements: [],
                                settlementSummary: ''
                            };
                        }
                    }
                    return entry;
                });
            }
            return {
                ...prev,
                [name]: value,
                entries: updatedEntries
            };
        });
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
                        {initialData?.id ? 'Edit' : 'New'} {type} Voucher
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
                            <h3 className="text-[20px] font-bold text-gray-900">{type} Voucher {initialData?.id ? 'Updated' : 'Saved'} Successfully</h3>
                        </div>
                    ) : (
                    <div className="space-y-6">
                        {/* Header Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F9FAFB] p-6 rounded-xl border border-[#E5E7EB]">
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider">Voucher Date</label>
                                <div className="relative">
                                    <DateInput 
                                        value={formData.date}
                                        onChange={(val) => setFormData(prev => ({ ...prev, date: val }))}
                                        className="w-full h-11 px-4 bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[15px] transition-all"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider">
                                    {type === 'Contra' ? 'Bank / Cash Account(Giver)' : (type === 'Journal' ? 'Account (First Party)' : 'Bank / Cash Account')}
                                </label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveDropdown(activeDropdown === 'bankCash' ? null : 'bankCash');
                                            setSearchFilter('');
                                        }}
                                        className="w-full h-11 px-4 bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[15px] flex items-center justify-between transition-all"
                                    >
                                        <span className={formData.bankCashLedgerId ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                                            {((type === 'Journal' ? allActiveAccounts : bankCashOptions).find(o => Number(o.id) === Number(formData.bankCashLedgerId))?.ledgerName || 'Select Account')}
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
                                                    className="absolute top-12 left-0 right-0 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-50 py-2 overflow-hidden max-h-[300px] flex flex-col"
                                                >
                                                    {type === 'Journal' && (
                                                        <div className="px-3 pb-2 border-b border-gray-100">
                                                            <input
                                                                type="text"
                                                                placeholder="Search Account..."
                                                                value={searchFilter}
                                                                onChange={(e) => setSearchFilter(e.target.value)}
                                                                className="w-full h-9 px-3 bg-gray-50 border border-[#E5E7EB] rounded-lg text-[13px] outline-none focus:border-[#073318] focus:ring-2 focus:ring-[#073318]/5"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="overflow-y-auto flex-1 max-h-[220px]">
                                                        {(() => {
                                                            const optionsToRender = type === 'Journal' ? allActiveAccounts : bankCashOptions;
                                                            const filteredOptions = optionsToRender.filter(o => 
                                                                String(o.ledgerName).toLowerCase().includes(searchFilter.toLowerCase())
                                                            );
                                                            if (filteredOptions.length === 0) {
                                                                return <div className="px-4 py-3 text-center text-gray-400 text-sm">No accounts found</div>;
                                                            }
                                                            return filteredOptions.map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    type="button"
                                                                    onClick={() => handleSelectChange('bankCashLedgerId', opt.id)}
                                                                    className={`w-full px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-gray-50 ${Number(formData.bankCashLedgerId) === Number(opt.id) ? 'text-[#073318] bg-[#073318]/5' : 'text-gray-700'}`}
                                                                >
                                                                    {opt.ledgerName}
                                                                </button>
                                                            ));
                                                        })()}
                                                    </div>
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
                            
                            <div className="border border-[#E5E7EB] rounded-xl overflow-visible shadow-sm">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#F3F4F6] border-b border-[#E5E7EB]">
                                            <th className="px-6 py-3 text-left text-[12px] font-bold text-[#6B7280] tracking-wider">
                                                {type === 'Contra' ? 'Bank / Cash Account(Receiver)' : (type === 'Journal' ? 'Account (2nd Party)' : 'Account')}
                                            </th>
                                            <th className="px-6 py-3 text-right text-[12px] font-bold text-[#6B7280] tracking-wider w-[200px]">Amount (₹)</th>
                                            <th className="w-[50px]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white">
                                        {formData.entries.map((entry, index) => (
                                            <tr key={entry.id} className="border-b border-[#F3F4F6] last:border-0 group">
                                                <td className="px-4 py-3">
                                                    <AccountSearchDropdown 
                                                        value={entry.accountId}
                                                        options={getRowOptions(entry.filterMode)}
                                                        onChange={(id, name) => handleEntryChange(entry.id, 'accountId', id, { accountName: name })}
                                                        placeholder={type === 'Contra' ? "Search Bank/Cash Account..." : (type === 'Journal' ? "Search Account (2nd Party)..." : "Search Customer/Supplier...")}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input 
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={entry.amount}
                                                        readOnly={type !== 'Contra' && type !== 'Journal' && entry.settlementType === 'AGAINST_REFERENCE'}
                                                        onClick={(type !== 'Contra' && type !== 'Journal' && (!entry.settlementType || entry.settlementType === 'AGAINST_REFERENCE')) ? () => handleAmountClick(entry) : undefined}
                                                        onChange={(e) => handleEntryChange(entry.id, 'amount', e.target.value)}
                                                        className={`w-full h-10 px-3 border border-transparent rounded-lg outline-none text-[14px] text-right font-bold text-[#073318] transition-all ${
                                                            (type === 'Contra' || type === 'Journal')
                                                            ? 'bg-[#F9FAFB] focus:bg-white focus:border-[#073318]'
                                                            : entry.settlementType === 'AGAINST_REFERENCE'
                                                            ? 'bg-[#073318]/5 border-[#073318]/20 cursor-pointer hover:bg-[#073318]/10' 
                                                            : entry.settlementType
                                                            ? 'bg-[#073318]/5 border-[#073318]/20 focus:bg-white focus:border-[#073318]'
                                                            : 'bg-[#F9FAFB] focus:bg-white focus:border-[#073318]'
                                                        }`}
                                                        required
                                                    />
                                                    {type !== 'Contra' && type !== 'Journal' && entry.settlementType && (
                                                        <div 
                                                            onClick={() => handleAmountClick(entry)}
                                                            className="text-[10px] text-gray-500 mt-1 font-semibold text-right leading-tight max-w-[200px] ml-auto cursor-pointer hover:text-[#073318] transition-colors"
                                                            title="Click to edit settlement details"
                                                        >
                                                            <span className="text-[#073318] capitalize font-bold block">
                                                                {entry.settlementType.toLowerCase().replace('_', ' ')}
                                                            </span>
                                                            <span className="block truncate" title={entry.settlementSummary}>
                                                                {entry.settlementSummary}
                                                            </span>
                                                        </div>
                                                    )}
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
                                        <span className={formData.paymentMode ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                                            {paymentModeOptions.find(o => o.value === formData.paymentMode)?.label || 'Select Mode'}
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
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => handleSelectChange('paymentMode', opt.value)}
                                                            className={`w-full px-4 py-2.5 text-left text-[14px] font-medium transition-colors hover:bg-gray-50 ${formData.paymentMode === opt.value ? 'text-[#073318] bg-[#073318]/5' : 'text-gray-700'}`}
                                                        >
                                                            {opt.label}
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
                                        {initialData?.id ? 'Updating...' : 'Saving...'}
                                    </>
                                ) : (
                                    <>{initialData?.id ? 'Update' : 'Save'}</>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </motion.div>
            <AnimatePresence>
                {isSettlementOpen && (
                    <SettlementModal
                        isOpen={isSettlementOpen}
                        onClose={() => setIsSettlementOpen(false)}
                        type={type}
                        ledgerId={formData.entries.find(e => e.id === activeEntryId)?.accountId ? Number(String(formData.entries.find(e => e.id === activeEntryId)?.accountId).split('-')[0]) : null}
                        ledgerName={formData.entries.find(e => e.id === activeEntryId)?.accountName}
                        accountType={formData.entries.find(e => e.id === activeEntryId)?.accountId ? String(formData.entries.find(e => e.id === activeEntryId)?.accountId).split('-')[1] : null}
                        initialData={formData.entries.find(e => e.id === activeEntryId)}
                        voucherId={initialData?.id}
                        onSave={handleSaveSettlement}
                    />
                )}
            </AnimatePresence>
        </div>,
        document.body
    );
};

export default PaymentModal;
