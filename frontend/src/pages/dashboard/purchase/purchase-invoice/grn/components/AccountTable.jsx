import React, { useMemo, useState, useEffect } from 'react';
import { ChevronsUpDown, ChevronDown, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import masterService from '@/services/masterService';

const AccountTable = ({ items, gstType, expenses, setExpenses }) => {
    const [groups, setGroups] = useState([]);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                // Using the specialized dropdown endpoint which is usually flat or better formatted
                const response = await masterService.getGroupDropdown();
                if (response.success) {
                    setGroups(response.data || []);
                } else {
                    // Fallback to getAllGroups if dropdown not available
                    const allGroups = await masterService.getAllGroups();
                    if (allGroups.success) {
                        setGroups(allGroups.data || []);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch groups', err);
            }
        };
        fetchGroups();
    }, []);

    const flattenGroups = (groupsList) => {
        let flat = [];
        groupsList.forEach(g => {
            flat.push(g); // Include the group itself
            if (g.children && g.children.length > 0) {
                flat = flat.concat(flattenGroups(g.children));
            }
        });
        return flat;
    };

    const flatGroups = useMemo(() => flattenGroups(groups), [groups]);

    const materialValues = useMemo(() => {
        const validItems = items.filter(item => item.productCode);
        const subtotal = validItems.reduce((sum, item) => sum + (parseFloat(item.beforeTaxAmount) || 0), 0);
        const taxTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.taxAmount) || 0), 0);
        const effectiveRate = subtotal > 0 ? (taxTotal / subtotal * 100) : 18;
        return { subtotal, taxTotal, effectiveRate };
    }, [items]);

    const handleAddExpense = (isPostGst = false) => {
        setExpenses([
            ...expenses, 
            { 
                id: Date.now(), 
                groupName: '', 
                amount: 0, 
                isGstApplicable: !isPostGst, 
                taxRate: isPostGst ? 0 : materialValues.effectiveRate, 
                isPostGst 
            }
        ]);
    };

    const handleRemoveExpense = (id) => {
        setExpenses(expenses.filter(e => e.id !== id));
    };

    const handleExpenseChange = (id, field, value) => {
        setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const totals = useMemo(() => {
        let taxableExpenseSubtotal = 0;
        let taxableExpenseTax = 0;
        let postGstExpenseSubtotal = 0;
        
        expenses.forEach(exp => {
            const amt = parseFloat(exp.amount) || 0;
            if (exp.isPostGst) {
                postGstExpenseSubtotal += amt;
            } else {
                taxableExpenseSubtotal += amt;
                // Automatically use the effective tax rate from materials
                taxableExpenseTax += (amt * materialValues.effectiveRate) / 100;
            }
        });

        const totalTax = gstType.applicable ? (materialValues.taxTotal + taxableExpenseTax) : 0;
        const subtotalWithBeforeGstExpenses = materialValues.subtotal + taxableExpenseSubtotal;
        
        // Grand total is (Taxable Materials + Taxable Expenses) + Total Tax (if not RCM) + Post-GST Expenses
        const taxInTotalValue = gstType.isRcm ? 0 : totalTax;
        const grandTotal = subtotalWithBeforeGstExpenses + taxInTotalValue + postGstExpenseSubtotal;

        return { 
            totalTax, 
            grandTotal,
            subtotalWithBeforeGstExpenses,
            taxableExpenseSubtotal,
        };
    }, [materialValues, expenses, gstType]);

    const beforeGstExpenses = expenses.filter(e => !e.isPostGst);
    const afterGstExpenses = expenses.filter(e => e.isPostGst);

    return (
        <div className="mt-4 border border-[#E5E7EB] rounded-[16px] overflow-hidden bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] font-outfit">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                        <th className="px-6 py-4 text-left text-[13px] font-bold text-[#64748B] uppercase tracking-wider w-[50%]">
                            <div className="flex items-center gap-2">Accounts Summary <ChevronsUpDown size={14} className="text-gray-300"/></div>
                        </th>
                        <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">
                            <div className="flex items-center justify-end gap-2">Amount <ChevronsUpDown size={14} className="text-gray-300"/></div>
                        </th>
                        <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">
                            <div className="flex items-center justify-end gap-2">Cum. Balance <ChevronsUpDown size={14} className="text-gray-300"/></div>
                        </th>
                    </tr>
                </thead>
                <tbody className="text-[14px]">
                    {/* Material Purchase Row */}
                    <tr className="border-b border-[#F1F5F9] transition-all duration-200 hover:bg-gray-50">
                        <td className="px-6 py-6 font-bold text-[#334155] uppercase text-[12px] tracking-wide">
                            Material Purchase (Excl. G.S.T.)
                        </td>
                        <td className="px-6 py-6 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">
                            {materialValues.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-6 text-right font-black text-[#0F172A] border-l border-[#F1F5F9] text-gray-400">
                            {materialValues.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                    </tr>

                    {/* Expense Rows - BEFORE GST */}
                    {beforeGstExpenses.map((exp, idx) => {
                        const currentBalance = materialValues.subtotal + beforeGstExpenses.slice(0, idx + 1).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                        return (
                            <tr key={exp.id} className="border-b border-[#F1F5F9] transition-all duration-200 hover:bg-gray-50 group">
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-full max-w-[400px]">
                                            <select
                                                value={exp.groupName}
                                                onChange={(e) => handleExpenseChange(exp.id, 'groupName', e.target.value)}
                                                className="w-full h-[40px] bg-white border border-[#E5E7EB] rounded-[10px] pl-4 pr-10 text-[13px] font-bold text-[#4B5563] outline-none focus:border-[#073318] appearance-none cursor-pointer"
                                            >
                                                <option value="">Select group</option>
                                                {flatGroups.map(g => (
                                                    <option key={g.id} value={g.group_name}>{g.group_name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveExpense(exp.id)} 
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Remove Expense"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-3 border-l border-[#F1F5F9]">
                                    <input 
                                        type="number" 
                                        value={exp.amount || ''} 
                                        placeholder="0.00"
                                        onChange={(e) => handleExpenseChange(exp.id, 'amount', e.target.value)}
                                        className="w-full h-[40px] bg-transparent text-right font-black text-[#0F172A] outline-none"
                                    />
                                </td>
                                <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9] text-gray-400">
                                    {currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        );
                    })}

                    {/* Add Expense Button - BEFORE GST */}
                    <tr className="border-b border-[#F1F5F9] bg-gray-50/30 h-[48px]">
                        <td className="px-6 py-2">
                             <button 
                                onClick={() => handleAddExpense(false)}
                                className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 transition-colors uppercase py-1"
                             >
                                <Plus size={14} /> Add Direct Expense (Taxable)
                             </button>
                        </td>
                        <td className="border-l border-[#F1F5F9]"></td>
                        <td className="border-l border-[#F1F5F9]"></td>
                    </tr>

                    {/* GST Rows */}
                    {!gstType.applicable ? (
                        <tr className="border-b border-[#F1F5F9] h-[48px] bg-red-50/10">
                            <td className="px-6 py-3 font-bold text-red-500 uppercase text-[12px] tracking-wide">GST NOT APPLICABLE (Case 4)</td>
                            <td className="px-6 py-3 text-right font-black text-red-500 border-l border-[#F1F5F9]">0.00</td>
                            <td className="px-6 py-3 text-right font-black text-gray-400 border-l border-[#F1F5F9]">
                                {totals.subtotalWithBeforeGstExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    ) : gstType.isRcm ? (
                        <tr className="border-b border-[#F1F5F9] h-[48px] bg-emerald-50/10">
                            <td className="px-6 py-3 font-bold text-emerald-700 uppercase text-[12px] tracking-wide flex items-center gap-2">
                                RCM - Reverse Charge ✅ <span className="text-[10px] text-emerald-500 normal-case font-normal">(Buyer to pay tax)</span>
                            </td>
                            <td className="px-6 py-3 text-right font-black text-emerald-700 border-l border-[#F1F5F9]">
                                {totals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3 text-right font-black text-gray-400 border-l border-[#F1F5F9]">
                                {totals.subtotalWithBeforeGstExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    ) : gstType.type === 'INTRA' ? (
                        <>
                            <tr className="border-b border-[#F1F5F9] h-[48px]">
                                <td className="px-6 py-3 font-bold text-[#334155] uppercase text-[12px] tracking-wide">C-GST</td>
                                <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">
                                    {(totals.totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9] text-gray-400">
                                    {(totals.subtotalWithBeforeGstExpenses + (totals.totalTax / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                            <tr className="border-b border-[#F1F5F9] h-[48px]">
                                <td className="px-6 py-3 font-bold text-[#334155] uppercase text-[12px] tracking-wide">S-GST</td>
                                <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">
                                    {(totals.totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9] text-gray-400">
                                    {(totals.subtotalWithBeforeGstExpenses + totals.totalTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </>
                    ) : gstType.type === 'INTER' ? (
                        <tr className="border-b border-[#F1F5F9] h-[48px]">
                            <td className="px-6 py-3 font-bold text-[#334155] uppercase text-[12px] tracking-wide">I-GST</td>
                            <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">
                                {totals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9] text-gray-400">
                                {(totals.subtotalWithBeforeGstExpenses + totals.totalTax).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    ) : null}

                    {/* Expense Rows - AFTER GST */}
                    {afterGstExpenses.map((exp, idx) => {
                        const baseForAfterGst = totals.subtotalWithBeforeGstExpenses + totals.totalTax;
                        const currentBalance = baseForAfterGst + afterGstExpenses.slice(0, idx + 1).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                        return (
                            <tr key={exp.id} className="border-b border-[#F1F5F9] transition-all duration-200 hover:bg-gray-50 group">
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-full max-w-[400px]">
                                            <select
                                                value={exp.groupName}
                                                onChange={(e) => handleExpenseChange(exp.id, 'groupName', e.target.value)}
                                                className="w-full h-[40px] bg-white border border-[#E5E7EB] rounded-[10px] pl-4 pr-10 text-[13px] font-bold text-[#4B5563] outline-none focus:border-[#073318] appearance-none cursor-pointer"
                                            >
                                                <option value="">Select group</option>
                                                {flatGroups.map(g => (
                                                    <option key={g.id} value={g.group_name}>{g.group_name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveExpense(exp.id)} 
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                            title="Remove Expense"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-3 border-l border-[#F1F5F9]">
                                    <input 
                                        type="number" 
                                        value={exp.amount || ''} 
                                        placeholder="0.00"
                                        onChange={(e) => handleExpenseChange(exp.id, 'amount', e.target.value)}
                                        className="w-full h-[40px] bg-transparent text-right font-black text-[#0F172A] outline-none"
                                    />
                                </td>
                                <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9] text-gray-400">
                                    {currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        );
                    })}

                    {/* Add Expense Button - AFTER GST */}
                    <tr className="border-b border-[#F1F5F9] bg-gray-50/10 h-[48px]">
                        <td className="px-6 py-2">
                             <button 
                                onClick={() => handleAddExpense(true)}
                                className="flex items-center gap-2 text-[11px] font-bold text-gray-600 hover:text-gray-900 transition-colors uppercase py-1"
                             >
                                <Plus size={14} /> Add Post-GST Charge (Non-Taxable)
                             </button>
                        </td>
                        <td className="border-l border-[#F1F5F9]"></td>
                        <td className="border-l border-[#F1F5F9]"></td>
                    </tr>

                    {/* Grand Total Row */}
                    <tr className="bg-[#073318] h-[60px]">
                        <td className="px-6 py-3 font-black text-white uppercase tracking-[2px] text-[15px]">Grand Total</td>
                        <td className="px-6 py-3 text-right font-black text-white text-[20px] border-l border-[#ffffff20]">
                            ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3 border-l border-[#ffffff20]"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default AccountTable;
