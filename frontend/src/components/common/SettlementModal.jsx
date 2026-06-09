import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, FileText } from 'lucide-react';
import axiosInstance from '../../services/axiosInstance';
import toast from 'react-hot-toast';

const SettlementModal = ({ 
    isOpen, 
    onClose, 
    type = 'Payment', 
    ledgerId, 
    ledgerName, 
    accountType,
    initialData = null,
    onSave 
}) => {
    const [selectedTypes, setSelectedTypes] = useState(['ON_ACCOUNT']); // array of 'ADVANCE', 'AGAINST_REFERENCE', 'ON_ACCOUNT'
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [onAccountAmount, setOnAccountAmount] = useState('');
    const [invoices, setInvoices] = useState([]);
    const [selectedInvoices, setSelectedInvoices] = useState({}); // { invoiceId: { checked: boolean, amount: number } }
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset state
            setAdvanceAmount('');
            setOnAccountAmount('');
            setInvoices([]);
            setSelectedInvoices({});
            setIsLoading(false);

            if (initialData) {
                const types = [];
                const settlements = initialData.settlements || [];
                
                if (settlements.length > 0) {
                    const againstRefMapped = {};
                    settlements.forEach(s => {
                        if (s.settlementType === 'ADVANCE') {
                            if (!types.includes('ADVANCE')) types.push('ADVANCE');
                            setAdvanceAmount(s.settledAmount || '');
                        } else if (s.settlementType === 'ON_ACCOUNT') {
                            if (!types.includes('ON_ACCOUNT')) types.push('ON_ACCOUNT');
                            setOnAccountAmount(s.settledAmount || '');
                        } else if (s.settlementType === 'AGAINST_REFERENCE') {
                            if (!types.includes('AGAINST_REFERENCE')) types.push('AGAINST_REFERENCE');
                            againstRefMapped[s.invoiceId] = { checked: true, amount: s.settledAmount };
                        }
                    });
                    setSelectedTypes(types.length > 0 ? types : ['ON_ACCOUNT']);
                    setSelectedInvoices(againstRefMapped);
                } else {
                    const singleType = initialData.settlementType || 'ON_ACCOUNT';
                    setSelectedTypes([singleType]);
                    if (singleType === 'ADVANCE') {
                        setAdvanceAmount(initialData.amount || '');
                    } else if (singleType === 'ON_ACCOUNT') {
                        setOnAccountAmount(initialData.amount || '');
                    }
                }
            } else {
                setSelectedTypes(['ON_ACCOUNT']);
            }

            if (ledgerId) {
                fetchPendingInvoices();
            }
        }
    }, [isOpen, ledgerId, initialData]);

    const fetchPendingInvoices = async () => {
        setIsLoading(true);
        try {
            const normalizedRole = String(accountType || '').toUpperCase() || (type === 'Receipt' ? 'CUSTOMER' : 'SUPPLIER');
            const isCustomer = ['CUSTOMER', 'DEBTOR'].includes(normalizedRole);
            const voucherParam = isCustomer ? 'receipt' : 'payment';
            const response = await axiosInstance.get(`/invoices/pending/${ledgerId}?voucherType=${voucherParam}`);
            setInvoices(response.data || []);
            
            if (initialData) {
                const settlements = initialData.settlements || [];
                const againstRefMapped = {};
                settlements.forEach(s => {
                    if (s.settlementType === 'AGAINST_REFERENCE') {
                        againstRefMapped[s.invoiceId] = { checked: true, amount: s.settledAmount };
                    }
                });
                setSelectedInvoices(prev => ({ ...prev, ...againstRefMapped }));
            }
        } catch (error) {
            console.error('Error fetching pending invoices:', error);
            toast.error('Failed to load pending invoices');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleSettleAmountChange = (invoiceId, maxBalance, value) => {
        setSelectedInvoices(prev => {
            const copy = { ...prev };
            copy[invoiceId] = { 
                checked: value !== '' && parseFloat(value) > 0, 
                amount: value 
            };
            return copy;
        });
    };

    const handleSave = () => {
        let finalAmount = 0;
        let settlements = [];
        let narrationParts = [];

        if (selectedTypes.includes('ADVANCE')) {
            const amt = parseFloat(advanceAmount);
            if (!amt || amt <= 0) {
                toast.error('Please enter a valid Advance amount');
                return;
            }
            finalAmount += amt;
            settlements.push({ settlementType: 'ADVANCE', settledAmount: amt });
            narrationParts.push(`Advance - ₹${amt}`);
        }

        if (selectedTypes.includes('ON_ACCOUNT')) {
            const amt = parseFloat(onAccountAmount);
            if (!amt || amt <= 0) {
                toast.error('Please enter a valid On Account amount');
                return;
            }
            finalAmount += amt;
            settlements.push({ settlementType: 'ON_ACCOUNT', settledAmount: amt });
            narrationParts.push(`On Account - ₹${amt}`);
        }

        if (selectedTypes.includes('AGAINST_REFERENCE')) {
            const activeEntries = Object.entries(selectedInvoices).filter(([_, item]) => item.checked);
            if (activeEntries.length === 0) {
                toast.error('Please select at least one invoice for Against Reference');
                return;
            }

            const details = [];
            for (const [invIdStr, item] of activeEntries) {
                const invId = parseInt(invIdStr);
                const amt = parseFloat(item.amount);
                const originalInv = invoices.find(i => i.invoiceId === invId);
                const maxBalance = originalInv ? originalInv.balanceAmount : 0;

                if (!amt || amt <= 0) {
                    toast.error('Settle amount must be greater than 0');
                    return;
                }
                if (amt > maxBalance) {
                    toast.error(`Settle amount for invoice ${originalInv?.invoiceNo || invId} cannot exceed balance of ₹${maxBalance}`);
                    return;
                }

                details.push({
                    invoiceId: invId,
                    invoiceNo: originalInv?.invoiceNo || `INV-${invId}`,
                    settlementType: 'AGAINST_REFERENCE',
                    settledAmount: amt,
                    totalAmount: originalInv?.totalAmount || 0,
                    paidAmount: originalInv?.paidAmount || 0,
                    pendingAmount: Math.max(0, (originalInv?.balanceAmount || 0) - amt)
                });
                finalAmount += amt;
            }

            const refNarration = details
                .map(d => `${d.invoiceNo} (₹${d.settledAmount})`)
                .join(', ');
            narrationParts.push(`Against Ref: [${refNarration}]`);

            details.forEach(d => {
                settlements.push({
                    invoiceId: d.invoiceId,
                    settlementType: d.settlementType,
                    settledAmount: d.settledAmount
                });
            });
        }

        const primaryType = selectedTypes.length === 1 ? selectedTypes[0] : 'MIXED';

        onSave({
            settlementType: primaryType,
            amount: finalAmount,
            settlements,
            narration: narrationParts.join(' | ')
        });
        onClose();
    };

    const getAgainstRefTotal = () => {
        return Object.entries(selectedInvoices)
            .filter(([_, item]) => item.checked)
            .reduce((sum, [_, item]) => sum + (parseFloat(item.amount) || 0), 0);
    };

    const grandTotal = (
        (selectedTypes.includes('ADVANCE') ? (parseFloat(advanceAmount) || 0) : 0) + 
        (selectedTypes.includes('ON_ACCOUNT') ? (parseFloat(onAccountAmount) || 0) : 0) + 
        (selectedTypes.includes('AGAINST_REFERENCE') ? getAgainstRefTotal() : 0)
    );

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
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
                className="relative bg-white rounded-[16px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] w-full max-w-[700px] overflow-hidden font-['Plus_Jakarta_Sans'] border border-[#E5E7EB] flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white">
                    <div>
                        <h2 className="text-[17px] font-bold text-gray-800 tracking-wide">
                            Settlement Details
                        </h2>
                        <p className="text-[12px] font-medium text-gray-500 mt-0.5">
                            Account: <span className="text-[#073318] font-bold">{ledgerName}</span>
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Selectable Settlement Type Cards */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { id: 'ADVANCE', label: 'Advance' },
                            { id: 'AGAINST_REFERENCE', label: 'Against Reference' },
                            { id: 'ON_ACCOUNT', label: 'On Account' }
                        ].map((card) => {
                            const isSelected = selectedTypes.includes(card.id);
                            return (
                                <button
                                    key={card.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedTypes(prev => {
                                            if (prev.includes(card.id)) {
                                                if (prev.length === 1) {
                                                    toast.error("At least one settlement type must be selected");
                                                    return prev;
                                                }
                                                return prev.filter(t => t !== card.id);
                                            } else {
                                                return [...prev, card.id];
                                            }
                                        });
                                    }}
                                    className={`p-4 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-2 ${
                                        isSelected 
                                        ? 'border-[#073318] bg-[#073318]/5 text-[#073318] shadow-sm font-bold' 
                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                        isSelected ? 'border-[#073318] bg-[#073318]' : 'border-gray-300 bg-white'
                                    }`}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className="text-[13px]">{card.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Stacked Input Sections */}
                    <div className="space-y-6">
                        {/* Advance Amount Card */}
                        {selectedTypes.includes('ADVANCE') && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#F9FAFB] p-5 rounded-xl border border-[#E5E7EB] space-y-2 shadow-sm"
                            >
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider block">
                                    Enter Advance Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={advanceAmount}
                                    onChange={(e) => setAdvanceAmount(e.target.value)}
                                    className="w-full h-11 px-4 bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[15px] font-bold text-[#073318] transition-all"
                                    required
                                />
                            </motion.div>
                        )}

                        {/* On Account Amount Card */}
                        {selectedTypes.includes('ON_ACCOUNT') && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#F9FAFB] p-5 rounded-xl border border-[#E5E7EB] space-y-2 shadow-sm"
                            >
                                <label className="text-[13px] font-bold text-[#6B7280] tracking-wider block">
                                    Enter On Account Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={onAccountAmount}
                                    onChange={(e) => setOnAccountAmount(e.target.value)}
                                    className="w-full h-11 px-4 bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318] outline-none text-[15px] font-bold text-[#073318] transition-all"
                                    required
                                />
                            </motion.div>
                        )}

                        {/* Against Reference Table */}
                        {selectedTypes.includes('AGAINST_REFERENCE') && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <h3 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
                                    <FileText size={16} className="text-gray-500" /> Pending Invoices (Against Reference)
                                </h3>

                                {isLoading ? (
                                    <div className="py-8 flex justify-center items-center">
                                        <div className="w-6 h-6 border-2 border-[#073318] border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : invoices.length === 0 ? (
                                    <div className="py-8 text-center text-gray-400 italic text-[13px] border border-dashed border-gray-200 rounded-xl">
                                        No pending invoices found for this ledger.
                                    </div>
                                ) : (
                                    <div className="border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto max-h-[250px]">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="bg-[#F3F4F6] border-b border-[#E5E7EB] sticky top-0 z-10">
                                                        <th className="px-4 py-2.5 text-left text-[12px] font-bold text-[#6B7280] tracking-wider">Invoice No</th>
                                                        <th className="px-4 py-2.5 text-left text-[12px] font-bold text-[#6B7280] tracking-wider">Date</th>
                                                        <th className="px-4 py-2.5 text-right text-[12px] font-bold text-[#6B7280] tracking-wider">Total</th>
                                                        <th className="px-4 py-2.5 text-right text-[12px] font-bold text-[#6B7280] tracking-wider">Paid</th>
                                                        <th className="px-4 py-2.5 text-right text-[12px] font-bold text-[#6B7280] tracking-wider">Balance</th>
                                                        <th className="px-4 py-2.5 text-right text-[12px] font-bold text-[#6B7280] tracking-wider w-[120px]">Settle (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-[#F3F4F6]">
                                                    {invoices.map((inv) => {
                                                        const isChecked = selectedInvoices[inv.invoiceId]?.checked || false;
                                                        const settleVal = selectedInvoices[inv.invoiceId]?.amount !== undefined 
                                                            ? selectedInvoices[inv.invoiceId].amount 
                                                            : '';
                                                        return (
                                                            <tr key={inv.invoiceId} className={`hover:bg-gray-50 text-[13px] ${isChecked ? 'bg-[#073318]/5' : ''}`}>
                                                                <td className="px-4 py-3 font-medium text-gray-900">{inv.invoiceNo}</td>
                                                                <td className="px-4 py-3 text-gray-500">{inv.invoiceDate}</td>
                                                                <td className="px-4 py-3 text-right text-gray-600">₹{inv.totalAmount}</td>
                                                                <td className="px-4 py-3 text-right text-gray-600">₹{inv.paidAmount}</td>
                                                                <td className="px-4 py-3 text-right font-bold text-gray-900">₹{inv.balanceAmount}</td>
                                                                <td className="px-4 py-3">
                                                                    <input
                                                                        type="number"
                                                                        placeholder="0.00"
                                                                        value={settleVal}
                                                                        onChange={(e) => handleSettleAmountChange(inv.invoiceId, inv.balanceAmount, e.target.value)}
                                                                        className={`w-full h-8 px-2 border rounded text-right font-bold text-[12px] outline-none transition-all ${
                                                                            isChecked 
                                                                            ? 'border-[#073318] bg-white text-[#073318] focus:ring-1 focus:ring-[#073318]' 
                                                                            : 'border-gray-200 bg-white text-gray-700 focus:border-[#073318] focus:ring-1 focus:ring-[#073318]'
                                                                        }`}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="bg-[#F9FAFB] px-6 py-3 border-t border-[#E5E7EB] flex items-center justify-between font-bold text-[14px]">
                                            <span className="text-gray-600">Against Reference Total</span>
                                            <span className="text-[#073318] text-[16px]">₹{getAgainstRefTotal()}</span>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Grand Total Summary Card */}
                    {selectedTypes.length > 0 && (
                        <div className="bg-[#073318]/5 p-4 rounded-xl border border-[#073318]/10 flex justify-between items-center font-bold text-[14px] mt-6">
                            <span className="text-[#073318] uppercase tracking-wider text-[12px]">Grand Total Settlement</span>
                            <span className="text-[#073318] text-[18px]">
                                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-[16px]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl border border-gray-200 font-bold text-gray-500 hover:bg-gray-100 transition-all text-[13px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-6 py-2 rounded-xl bg-[#073318] text-white font-bold hover:bg-[#0a4422] transition-all text-[13px] active:scale-95 flex items-center gap-1.5 shadow-[0_4px_10px_rgba(7,51,24,0.2)]"
                    >
                        Save Settlement
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default SettlementModal;
