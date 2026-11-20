import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Calendar, Landmark, CreditCard, User, ClipboardList, 
    CheckCircle2, ChevronDown, Check, Sparkles, RefreshCcw, 
    AlertCircle, FileText, Search, CreditCard as PayIcon, X
} from 'lucide-react';
import voucherService from '../../../services/voucherService';
import axiosInstance from '../../../services/axiosInstance';
import toast from 'react-hot-toast';

const OneTabSettlement = ({ activeSubTab }) => {
    const { t } = useTranslation(['modules', 'common']);
    const subTabLabels = {
        'Sundry Creditors': t('modules:sundry_creditors'),
        'Sundry Debtors': t('modules:sundry_debtors')
    };
    // Determine Type: 'Receipt' (Sundry Debtors) or 'Payment' (Sundry Creditors)
    const type = activeSubTab === 'Sundry Creditors' ? 'Payment' : 'Receipt';

    // List & Search States
    const [rawInvoices, setRawInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [bankCashOptions, setBankCashOptions] = useState([]);
    const [loadingBankCash, setLoadingBankCash] = useState(false);

    // Modal Control State
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [selectedParty, setSelectedParty] = useState(null); // { ledgerId, partyName, balanceAmount }

    // Modal-Specific Outstanding Transactions
    const [debitTransactions, setDebitTransactions] = useState([]);
    const [creditTransactions, setCreditTransactions] = useState([]);
    const [loadingPartyInvoices, setLoadingPartyInvoices] = useState(false);
    
    // Selections
    const [debitSelections, setDebitSelections] = useState({}); // { id: { checked: boolean, amount: string } }
    const [creditSelections, setCreditSelections] = useState({}); // { id: { checked: boolean, amount: string } }

    const [autoAllocateAmount, setAutoAllocateAmount] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [onAccountAmount, setOnAccountAmount] = useState('');

    // Settle Modal Inputs
    const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
    const [bankCashLedgerId, setBankCashLedgerId] = useState('');
    const [paymentMode, setPaymentMode] = useState('NET_BANKING');
    const [narration, setNarration] = useState('');
    const [isUserEditingNarration, setIsUserEditingNarration] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);

    const paymentModeOptions = [
        { label: 'Debit Card', value: 'DEBIT_CARD' },
        { label: 'Credit Card', value: 'CREDIT_CARD' },
        { label: 'Net Banking', value: 'NET_BANKING' },
        { label: 'Cheque', value: 'CHEQUE' },
        { label: 'UPI', value: 'UPI' },
        { label: 'Cash', value: 'CASH' }
    ];

    // Colors & Theme Styling - standardized to forest green [#073318] to match Ledger branding
    const theme = {
        primaryBg: 'bg-[#073318]',
        primaryText: 'text-[#073318]',
        lightBg: 'bg-[#073318]/5',
        borderColor: 'border-[#073318]/20',
        glow: 'shadow-[0_4px_14px_rgba(7,51,24,0.15)]',
        hoverBg: 'hover:bg-[#073318]/90',
        accent: 'emerald',
        tableHeaderBg: 'bg-[#073318]/10 text-[#073318]'
    };

    // 1. Fetch all outstanding invoices
    const fetchAllOutstanding = async () => {
        setLoading(true);
        try {
            const voucherParam = type === 'Receipt' ? 'receipt' : 'payment';
            const response = await axiosInstance.get(`/invoices/pending-all?voucherType=${voucherParam}`);
            setRawInvoices(response.data || []);
        } catch (err) {
            console.error('Failed to fetch raw outstanding invoices:', err);
            toast.error('Failed to load outstanding data');
        } finally {
            setLoading(false);
        }
    };

    // 2. Fetch Bank/Cash accounts
    const fetchBankCashAccounts = async () => {
        setLoadingBankCash(true);
        try {
            const res = await voucherService.getBankCashAccounts();
            setBankCashOptions(res || []);
            if (res?.length > 0) {
                setBankCashLedgerId(res[0].id);
            }
        } catch (err) {
            console.error('Failed to load Bank/Cash accounts:', err);
        } finally {
            setLoadingBankCash(false);
        }
    };

    useEffect(() => {
        fetchAllOutstanding();
        fetchBankCashAccounts();
    }, [activeSubTab]);

    // 3. Group raw invoices by ledgerId (Account)
    const groupedParties = useMemo(() => {
        const groups = {};
        rawInvoices.forEach(inv => {
            const id = inv.ledgerId;
            if (!groups[id]) {
                groups[id] = {
                    ledgerId: id,
                    partyName: inv.partyName,
                    totalAmount: 0,
                    paidAmount: 0,
                    balanceAmount: 0,
                    invoicesCount: 0
                };
            }
            groups[id].totalAmount += inv.totalAmount;
            groups[id].paidAmount += inv.paidAmount;
            groups[id].balanceAmount += inv.balanceAmount;
            groups[id].invoicesCount += 1;
        });

        const list = Object.values(groups);
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(g => g.partyName && g.partyName.toLowerCase().includes(q));
    }, [rawInvoices, searchQuery]);

    // 4. Load specific party invoices inside Modal
    const handleOpenSettleModal = async (party) => {
        setSelectedParty(party);
        setSettleDate(new Date().toISOString().split('T')[0]);
        setPaymentMode('NET_BANKING');
        setIsUserEditingNarration(false);
        setDebitTransactions([]);
        setCreditTransactions([]);
        setDebitSelections({});
        setCreditSelections({});
        setAutoAllocateAmount('');
        setAdvanceAmount('');
        setOnAccountAmount('');

        setIsSettleModalOpen(true);
        setLoadingPartyInvoices(true);

        try {
            const voucherParam = type === 'Receipt' ? 'receipt' : 'payment';
            const response = await axiosInstance.get(`/invoices/pending-double/${party.ledgerId}?voucherType=${voucherParam}`);
            const { debitTransactions: debits, creditTransactions: credits } = response.data;
            setDebitTransactions(debits || []);
            setCreditTransactions(credits || []);

            // Do not pre-select and pre-fill transactions by default
            const initialDebits = {};
            debits?.forEach(tx => {
                initialDebits[tx.id] = {
                    checked: false,
                    amount: ''
                };
            });
            setDebitSelections(initialDebits);

            const initialCredits = {};
            credits?.forEach(tx => {
                initialCredits[tx.id] = {
                    checked: false,
                    amount: ''
                };
            });
            setCreditSelections(initialCredits);
        } catch (err) {
            console.error('Failed to load party pending transactions:', err);
            toast.error('Failed to load pending transactions for this account');
        } finally {
            setLoadingPartyInvoices(false);
        }
    };

    // 5. Handle Modal Checkbox check/uncheck
    const handleDebitCheck = (id, maxBalance, checked) => {
        setDebitSelections(prev => {
            const currentAmount = prev[id]?.amount || '';
            const newAmount = checked ? (currentAmount || maxBalance.toString()) : '';
            return {
                ...prev,
                [id]: { checked, amount: newAmount }
            };
        });
    };

    const handleDebitAmountChange = (id, maxBalance, value) => {
        const floatVal = parseFloat(value);
        setDebitSelections(prev => ({
            ...prev,
            [id]: {
                checked: value !== '' && floatVal > 0,
                amount: value
            }
        }));
    };

    const handleCreditCheck = (id, maxBalance, checked) => {
        setCreditSelections(prev => {
            const currentAmount = prev[id]?.amount || '';
            const newAmount = checked ? (currentAmount || maxBalance.toString()) : '';
            return {
                ...prev,
                [id]: { checked, amount: newAmount }
            };
        });
    };

    const handleCreditAmountChange = (id, maxBalance, value) => {
        const floatVal = parseFloat(value);
        setCreditSelections(prev => ({
            ...prev,
            [id]: {
                checked: value !== '' && floatVal > 0,
                amount: value
            }
        }));
    };

    // 6. FIFO Auto-Allocation inside Modal
    const handleFIFOAllocation = () => {
        const total = parseFloat(autoAllocateAmount);
        if (isNaN(total) || total <= 0) {
            toast.error('Please enter a valid amount for FIFO allocation');
            return;
        }

        let remainingAmount = total;
        const newSelected = {};
        
        // Pick which side to sort and allocate (debits for Debtors/Receipt, credits for Creditors/Payment)
        const targets = type === 'Receipt' ? debitTransactions : creditTransactions;
        
        // Sort oldest first
        const sorted = [...targets].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sorted.forEach(inv => {
            if (remainingAmount <= 0) {
                newSelected[inv.id] = { checked: false, amount: '' };
                return;
            }

            if (remainingAmount >= inv.balanceAmt) {
                newSelected[inv.id] = { checked: true, amount: inv.balanceAmt.toString() };
                remainingAmount -= inv.balanceAmt;
            } else {
                newSelected[inv.id] = { checked: true, amount: remainingAmount.toFixed(2) };
                remainingAmount = 0;
            }
        });

        if (type === 'Receipt') {
            setDebitSelections(newSelected);
        } else {
            setCreditSelections(newSelected);
        }

        if (remainingAmount > 0) {
            setOnAccountAmount(remainingAmount.toFixed(2));
            toast.success(`Allocated ₹${(total - remainingAmount).toLocaleString('en-IN')} to invoices. Set remaining ₹${remainingAmount.toLocaleString('en-IN')} On Account!`);
        } else {
            setOnAccountAmount('');
            toast.success('FIFO allocation applied!');
        }
    };

    // 7. Dynamic grand total calculations inside Modal
    const debitTotal = useMemo(() => {
        return Object.values(debitSelections)
            .filter(item => item.checked)
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }, [debitSelections]);

    const creditTotal = useMemo(() => {
        return Object.values(creditSelections)
            .filter(item => item.checked)
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    }, [creditSelections]);

    const grandTotal = useMemo(() => {
        const adv = parseFloat(advanceAmount) || 0;
        const onAcc = parseFloat(onAccountAmount) || 0;
        const diff = type === 'Receipt' 
            ? debitTotal - creditTotal
            : creditTotal - debitTotal;
        return Math.max(0, diff + adv + onAcc);
    }, [debitTotal, creditTotal, advanceAmount, onAccountAmount, type]);

    // 8. Auto narration removed per user request

    // 9. Handle Modal Confirm Settle Submission
    const handleConfirmSettlement = async (e) => {
        e.preventDefault();
        if (!bankCashLedgerId) {
            toast.error('Please select a Bank or Cash account');
            return;
        }
        
        if (debitTotal !== creditTotal) {
            toast.error('Debit amount and Credit amount must match to settle against each other');
            return;
        }

        const invoiceSettlements = [];
        
        // Grab checked invoices from the invoice side (debit for Receipt/Debtors, credit for Payment/Creditors)
        const invoiceSelections = type === 'Receipt' ? debitSelections : creditSelections;
        const invoiceList = type === 'Receipt' ? debitTransactions : creditTransactions;
        
        for (const [idStr, val] of Object.entries(invoiceSelections)) {
            if (!val.checked) continue;
            const amt = parseFloat(val.amount);
            const originalInv = invoiceList.find(i => String(i.id) === String(idStr));
            const maxVal = originalInv ? originalInv.balanceAmt : 0;

            if (isNaN(amt) || amt <= 0) {
                toast.error('All invoice settle amounts must be greater than 0');
                return;
            }
            if (amt > maxVal) {
                toast.error(`Settle amount for invoice ${originalInv?.refNo || idStr} cannot exceed outstanding balance of ₹${maxVal}`);
                return;
            }

            if (originalInv && originalInv.invoiceId) {
                invoiceSettlements.push({
                    invoiceId: originalInv.invoiceId,
                    settlementType: 'AGAINST_REFERENCE',
                    settledAmount: amt
                });
            }
        }

        // Handle the matching side settlements (credits for Receipt/Debtors, debits for Payment/Creditors)
        const matchingSelections = type === 'Receipt' ? creditSelections : debitSelections;
        const matchingList = type === 'Receipt' ? creditTransactions : debitTransactions;
        
        for (const [idStr, val] of Object.entries(matchingSelections)) {
            if (!val.checked) continue;
            const amt = parseFloat(val.amount);
            const originalMatch = matchingList.find(m => String(m.id) === String(idStr));
            const maxVal = originalMatch ? originalMatch.balanceAmt : 0;

            if (isNaN(amt) || amt <= 0) {
                toast.error('All matching settle amounts must be greater than 0');
                return;
            }
            if (amt > maxVal) {
                toast.error(`Settle amount for unapplied record ${originalMatch?.refNo || idStr} cannot exceed balance of ₹${maxVal}`);
                return;
            }

            if (originalMatch && (originalMatch.settlementId || originalMatch.voucherId)) {
                invoiceSettlements.push({
                    voucherId: originalMatch.voucherId,
                    settlementId: originalMatch.settlementId || null,
                    settlementType: 'ABSORB_VOUCHER',
                    settledAmount: amt
                });
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                voucherDate: settleDate,
                bankCashLedgerId: Number(bankCashLedgerId), // Required by backend but amount is 0
                paymentMode: paymentMode,
                narration: narration,
                items: [{
                    accountId: selectedParty.ledgerId,
                    amount: 0, // Cross-settlement involves no new cash
                    accountType: type === 'Receipt' ? 'CUSTOMER' : 'SUPPLIER',
                    settlements: invoiceSettlements
                }]
            };

            let response;
            if (type === 'Receipt') {
                response = await voucherService.createReceiptVoucher(payload);
            } else {
                response = await voucherService.createPaymentVoucher(payload);
            }

            toast.success(`Settlement recorded successfully! Voucher No: ${response.voucherNumber || response.id}`);
            setIsSettleModalOpen(false);
            setSelectedParty(null);
            fetchAllOutstanding();

            // Refresh Ledger reports
            window.dispatchEvent(new CustomEvent('voucherAdded', { detail: { type } }));
        } catch (error) {
            console.error('Error saving settlement voucher:', error);
            const msg = error.response?.data?.message;
            toast.error(Array.isArray(msg) ? msg[0] : (msg || 'Failed to complete settlement transaction'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-[1300px] mx-auto font-outfit">
            
            {/* Top Filter Bar */}
            <div className="bg-white p-6 rounded-[24px] border border-[#E5E7EB] shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder={t('modules:search_account_ledger_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none focus:ring-2 focus:ring-current text-[14px] font-semibold text-gray-800 focus:bg-white transition-all"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchAllOutstanding}
                        disabled={loading}
                        className={`h-11 px-5 rounded-xl border border-[#E5E7EB] text-[13.5px] font-bold text-gray-600 bg-white hover:bg-gray-50 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50`}
                    >
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                        {t('modules:refresh_list')}
                    </button>
                </div>
            </div>

            {/* Grouped Parties Table */}
            <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ClipboardList size={18} className={theme.primaryText} />
                        <h3 className="text-[16px] font-bold text-gray-800 uppercase tracking-wider">
                            {t('modules:outstanding_accounts_title', { type: subTabLabels[activeSubTab] || activeSubTab })}
                        </h3>
                    </div>
                </div>

                {loading ? (
                    <div className="py-24 flex flex-col items-center gap-3">
                        <div className={`w-10 h-10 border-4 ${theme.borderColor} border-t-current rounded-full animate-spin`} />
                        <p className="font-bold text-gray-400 text-[14px]">{t('modules:fetching_outstanding')}</p>
                    </div>
                ) : groupedParties.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-gray-500 max-w-md mx-auto">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme.lightBg} ${theme.primaryText}`}>
                            <CheckCircle2 size={24} />
                        </div>
                        <p className="font-bold text-gray-800 text-[15px]">{t('modules:no_outstanding_accounts')}</p>
                        <p className="text-[13px] text-gray-400 font-medium">{t('modules:all_accounts_settled', { type: subTabLabels[activeSubTab] || activeSubTab })}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[14px]">
                            <thead>
                                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-gray-500 font-bold text-[12px] tracking-wider uppercase">
                                    <th className="px-6 py-4">{t('modules:account')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                                {groupedParties.map((party) => (
                                    <tr key={party.ledgerId} className="hover:bg-gray-50/50 transition-colors">
                                        <td 
                                            className="px-6 py-4.5 font-bold text-gray-900 text-[15px] cursor-pointer hover:underline transition-all"
                                            onClick={() => handleOpenSettleModal(party)}
                                        >
                                            {party.partyName}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Settle Modal with Invoices selection */}
            <AnimatePresence>
                {isSettleModalOpen && selectedParty && (
                    <>
                        {/* Overlay backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSettleModalOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999]"
                        />

                        {/* Modal Body */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] bg-white rounded-[24px] border border-[#E5E7EB] shadow-[0_25px_60px_rgba(0,0,0,0.18)] z-[1000] overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="flex items-start sm:items-center justify-between px-6 py-5 border-b border-[#F3F4F6] bg-white">
                                <div>
                                    <h3 className="text-[20px] font-bold text-[#111827] tracking-tight">
                                        {t('modules:settle_account')}: {selectedParty.partyName}
                                    </h3>
                                    <p className="text-[14px] text-[#6B7280] font-medium mt-1">
                                        {t('modules:settle_transactions_desc')}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setIsSettleModalOpen(false)}
                                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Scroll Container */}
                            <div className="max-h-[80vh] overflow-y-auto bg-[#F9FAFB]">
                                <form onSubmit={handleConfirmSettlement} className="p-6 space-y-6 font-outfit">
                                    
                                    {/* Outstanding Transactions (Debit vs Credit) */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                        
                                        {/* Left Column: Debit Transactions */}
                                        <div className="space-y-3">
                                            <div className="bg-[#073318]/5 text-[#073318] font-bold text-[12.5px] px-3.5 py-1.5 rounded-lg border border-[#073318]/15 uppercase tracking-wider text-center">
                                                {t('modules:debit')} {t('modules:transaction', 'Transaction')}
                                            </div>
                                            {loadingPartyInvoices ? (
                                                <div className="py-12 text-center text-gray-400 text-[13px] flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                                                    <span>{t('common:loading')}</span>
                                                </div>
                                            ) : debitTransactions.length === 0 ? (
                                                <p className="text-center text-gray-400 py-12 text-[13px] font-semibold italic bg-gray-50 border border-dashed rounded-xl">{t('modules:no_debit_found')}</p>
                                            ) : (
                                                <div className="border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm max-h-[280px] overflow-y-auto bg-white">
                                                    <table className="w-full border-collapse text-[12.5px] text-left">
                                                        <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#6B7280] font-bold z-10 text-[11px] uppercase">
                                                            <tr>
                                                                <th className="px-3 py-4 w-[40px] text-center">
                                                                    <Check size={14} className="inline-block" />
                                                                </th>
                                                                <th className="px-3 py-4 text-left">{t('modules:date_col')}</th>
                                                                <th className="px-2 py-4 text-left">{t('common:type')}</th>
                                                                <th className="px-2 py-4 text-right">{t('modules:total_amount_col')}</th>
                                                                <th className="px-2 py-4 text-right">{t('modules:cumulative_balance')}</th>
                                                                <th className="px-3 py-4 text-right w-[125px]">{t('modules:settlement_amount_col')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="font-medium text-gray-700">
                                                            {debitTransactions.map((tx) => {
                                                                const isChecked = debitSelections[tx.id]?.checked || false;
                                                                const val = debitSelections[tx.id]?.amount || '';

                                                                return (
                                                                    <tr key={tx.id} className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${isChecked ? theme.lightBg : 'bg-white'}`}>
                                                                        <td className="px-3 py-4 text-center">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                checked={isChecked} 
                                                                                onChange={(e) => handleDebitCheck(tx.id, tx.balanceAmt, e.target.checked)}
                                                                                className="w-4 h-4 rounded border-gray-300 text-[#073318] focus:ring-[#073318] cursor-pointer accent-[#073318]"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-4 text-[#4B5563] font-medium whitespace-nowrap">{tx.date}</td>
                                                                        <td className="px-2 py-4">
                                                                            <div className="font-bold text-gray-900">{tx.type}</div>
                                                                            <div className="text-[11px] text-gray-500 font-semibold truncate max-w-[100px]" title={tx.refNo}>
                                                                                {tx.refNo}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-2 py-4 text-right font-bold text-[#111827]">₹{tx.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="px-2 py-4 text-right font-extrabold text-[#111827]">₹{tx.balanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="px-3 py-2">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                placeholder="0.00"
                                                                                value={val}
                                                                                onChange={(e) => handleDebitAmountChange(tx.id, tx.balanceAmt, e.target.value)}
                                                                                className={`w-full h-8 px-2 border rounded-md text-right font-bold text-[12px] outline-none transition-all ${
                                                                                    isChecked 
                                                                                        ? 'border-[#073318] bg-white text-[#073318] focus:ring-1 focus:ring-[#073318] shadow-sm font-extrabold' 
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
                                            )}
                                        </div>

                                        {/* Right Column: Credit Transactions */}
                                        <div className="space-y-3">
                                            <div className="bg-[#073318]/5 text-[#073318] font-bold text-[12.5px] px-3.5 py-1.5 rounded-lg border border-[#073318]/15 uppercase tracking-wider text-center">
                                                {t('modules:credit_transaction')}
                                            </div>
                                            {loadingPartyInvoices ? (
                                                <div className="py-12 text-center text-gray-400 text-[13px] flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                                    <span>{t('common:loading')}</span>
                                                </div>
                                            ) : creditTransactions.length === 0 ? (
                                                <p className="text-center text-gray-400 py-12 text-[13px] font-semibold italic bg-gray-50 border border-dashed rounded-xl">{t('modules:no_credit_transactions_found')}</p>
                                            ) : (
                                                <div className="border border-[#E5E7EB] rounded-[16px] overflow-hidden shadow-sm max-h-[280px] overflow-y-auto bg-white">
                                                    <table className="w-full border-collapse text-[12.5px] text-left">
                                                        <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#6B7280] font-bold z-10 text-[11px] uppercase">
                                                            <tr>
                                                                <th className="px-3 py-4 w-[40px] text-center">
                                                                    <Check size={14} className="inline-block" />
                                                                </th>
                                                                <th className="px-3 py-4 text-left">{t('common:date')}</th>
                                                                <th className="px-2 py-4 text-left">{t('common:type')}</th>
                                                                <th className="px-2 py-4 text-right">{t('modules:total_amt')}</th>
                                                                <th className="px-2 py-4 text-right">{t('modules:balance_amt')}</th>
                                                                <th className="px-3 py-4 text-right w-[125px]">{t('modules:settlement_amount_col')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="font-medium text-gray-700">
                                                            {creditTransactions.map((tx) => {
                                                                const isChecked = creditSelections[tx.id]?.checked || false;
                                                                const val = creditSelections[tx.id]?.amount || '';

                                                                return (
                                                                    <tr key={tx.id} className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${isChecked ? theme.lightBg : 'bg-white'}`}>
                                                                        <td className="px-3 py-4 text-center">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                checked={isChecked} 
                                                                                onChange={(e) => handleCreditCheck(tx.id, tx.balanceAmt, e.target.checked)}
                                                                                className="w-4 h-4 rounded border-gray-300 text-[#073318] focus:ring-[#073318] cursor-pointer accent-[#073318]"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-4 text-[#4B5563] font-medium whitespace-nowrap">{tx.date}</td>
                                                                        <td className="px-2 py-4">
                                                                            <div className="font-bold text-gray-900">{tx.type}</div>
                                                                            <div className="text-[11px] text-gray-500 font-semibold truncate max-w-[100px]" title={tx.refNo}>
                                                                                {tx.refNo}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-2 py-4 text-right font-bold text-[#111827]">₹{tx.totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="px-2 py-4 text-right font-extrabold text-[#111827]">₹{tx.balanceAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                        <td className="px-3 py-2">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                placeholder="0.00"
                                                                                value={val}
                                                                                onChange={(e) => handleCreditAmountChange(tx.id, tx.balanceAmt, e.target.value)}
                                                                                className={`w-full h-8 px-2 border rounded-md text-right font-bold text-[12px] outline-none transition-all ${
                                                                                    isChecked 
                                                                                        ? 'border-[#073318] bg-white text-[#073318] focus:ring-1 focus:ring-[#073318] shadow-sm font-extrabold' 
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
                                            )}
                                        </div>

                                    </div>

                                    {/* Summary */}
                                    <div className="space-y-4">
                                        <div className={`p-4.5 rounded-2xl border flex justify-between items-center ${
                                            debitTotal > 0 && debitTotal === creditTotal 
                                                ? 'bg-emerald-50 border-emerald-200' 
                                                : 'bg-red-50 border-red-200'
                                        }`}>
                                            <div className="flex flex-col">
                                                <span className={`font-bold uppercase tracking-wider text-[11px] ${debitTotal > 0 && debitTotal === creditTotal ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {t('modules:settlement_match')}
                                                </span>
                                                <span className="text-[13px] font-medium text-gray-700 mt-1">
                                                    {t('modules:debit')}: <strong className="text-gray-900">₹{debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> | 
                                                    {t('modules:credit')}: <strong className="text-gray-900">₹{creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                                </span>
                                            </div>
                                            
                                            {debitTotal > 0 && debitTotal === creditTotal ? (
                                                <div className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-100 px-3 py-1.5 rounded-lg text-[13px]">
                                                    <CheckCircle2 size={16} />
                                                    <span>{t('modules:matched')}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-red-600 font-bold bg-red-100 px-3 py-1.5 rounded-lg text-[13px]">
                                                    <AlertCircle size={16} />
                                                    <span>{t('modules:diff', 'Diff')}: ₹{Math.abs(debitTotal - creditTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsSettleModalOpen(false)}
                                            className="flex-1 h-11 rounded-xl border border-[#E5E7EB] text-[13.5px] font-bold text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
                                        >
                                            {t('common:cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || debitTotal === 0 || debitTotal !== creditTotal}
                                            className={`flex-[2] h-11 rounded-xl text-white text-[13.5px] font-bold flex items-center justify-center gap-2 transition-all ${theme.primaryBg} ${theme.glow} ${theme.hoverBg} active:scale-95 disabled:opacity-50`}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    {t('common:processing')}
                                                </>
                                            ) : (
                                                <>{t('modules:confirm_settlement')}</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
};

export default OneTabSettlement;
