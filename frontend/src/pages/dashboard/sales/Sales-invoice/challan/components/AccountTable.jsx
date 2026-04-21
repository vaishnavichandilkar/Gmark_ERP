import React, { useMemo, useState, useEffect } from 'react';
import { ChevronsUpDown, ChevronDown, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import masterService from '@/services/masterService';

const AccountTable = ({ items, gstType, expenses, setExpenses, mainAccountLabel = "Material Purchase (Excl. G.S.T.)" }) => {
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

    const flatGroups = useMemo(() => {
        const flat = flattenGroups(groups);
        const seen = new Set();
        return flat.filter(g => {
            const name = (g.group_name || '').trim();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
        });
    }, [groups]);

    const materialValues = useMemo(() => {
        const validItems = items.filter(item => item.productCode);
        const subtotal = validItems.reduce((sum, item) => sum + (parseFloat(item.beforeTaxAmount) || 0), 0);
        const taxTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.taxAmount) || 0), 0);
        // Calculate weighted average tax rate across all items for display purposes
        const effectiveRate = subtotal > 0 ? (taxTotal / subtotal * 100) : 0;
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
                taxRate: isPostGst ? 0 : 18, // Default 18% for taxable expenses
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

    // Calculate totals and group taxes by rate
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
                if (exp.isGstApplicable) {
                    taxableExpenseTax += (amt * (parseFloat(exp.taxRate) || 0)) / 100;
                }
            }
        });

        // Group item taxes by rate for detailed display
        const validItems = items.filter(item => item.productCode);
        const taxGroups = {};
        
        validItems.forEach(item => {
            const rate = parseFloat(item.taxPercent) || 0;
            const tax = parseFloat(item.taxAmount) || 0;
            const base = parseFloat(item.beforeTaxAmount) || 0;
            
            if (!taxGroups[rate]) {
                taxGroups[rate] = { rate, tax: 0, base: 0 };
            }
            taxGroups[rate].tax += tax;
            taxGroups[rate].base += base;
        });

        const subtotalWithBeforeGstExpenses = materialValues.subtotal + taxableExpenseSubtotal;
        
        // Calculate total tax based on the combined subtotal and the effective material tax rate
        // This implements: tax = (Material + Expense) * (Material Tax %)
        const effectiveTaxRate = materialValues.subtotal > 0 ? (materialValues.taxTotal / materialValues.subtotal) : 0;
        const totalTaxOnCombined = !gstType.applicable ? 0 : (materialValues.taxTotal + (taxableExpenseSubtotal * effectiveTaxRate));

        const taxInTotalValue = gstType.isRcm ? 0 : totalTaxOnCombined;
        const grandTotal = subtotalWithBeforeGstExpenses + taxInTotalValue + postGstExpenseSubtotal;

        // Redistribute the combined tax into the display groups for C-GST/S-GST/I-GST rows
        const updatedTaxGroups = Object.values(taxGroups).map(group => {
            const groupRatio = materialValues.subtotal > 0 ? (group.base / materialValues.subtotal) : 0;
            // Add proportional share of expense tax to this group
            const groupExpenseTax = taxableExpenseSubtotal * groupRatio * (group.rate / 100);
            return {
                ...group,
                tax: group.tax + (!gstType.applicable ? 0 : groupExpenseTax)
            };
        }).sort((a, b) => b.rate - a.rate);

        const itemTaxTotal = Object.values(taxGroups).reduce((s, g) => s + g.tax, 0);

        return {
            totalTax: totalTaxOnCombined,
            grandTotal,
            subtotalWithBeforeGstExpenses,
            taxableExpenseSubtotal,
            itemTaxTotal,
            taxGroups: updatedTaxGroups
        };
    }, [items, materialValues, expenses, gstType]);

    const beforeGstExpenses = expenses.filter(e => !e.isPostGst);
    const afterGstExpenses = expenses.filter(e => e.isPostGst);

    return (
        <div className="mt-4 border border-[#E5E7EB] rounded-[16px] overflow-hidden bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] font-outfit">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                        <th className="px-6 py-4 text-left text-[13px] font-bold text-[#64748B] uppercase tracking-wider w-[50%]">
                            <div className="flex items-center gap-2">Accounts Summary <ChevronsUpDown size={14} className="text-gray-300" /></div>
                        </th>
                        <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">
                            <div className="flex items-center justify-end gap-2">Amount <ChevronsUpDown size={14} className="text-gray-300" /></div>
                        </th>
                        <th className="px-6 py-4 text-right text-[13px] font-bold text-[#64748B] uppercase tracking-wider border-l border-[#F1F5F9]">
                            <div className="flex items-center justify-end gap-2">Cum. Balance <ChevronsUpDown size={14} className="text-gray-300" /></div>
                        </th>
                    </tr>
                </thead>
                <tbody className="text-[14px]">
                    <tr className="border-b border-[#F1F5F9] transition-all duration-200 hover:bg-gray-50">
                        <td className="px-6 py-6 font-bold text-[#334155] uppercase text-[12px] tracking-wide">
                            {mainAccountLabel}
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
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="number"
                                            value={exp.amount || ''}
                                            placeholder="0.00"
                                            onChange={(e) => handleExpenseChange(exp.id, 'amount', e.target.value)}
                                            className="w-full h-[32px] bg-transparent text-right font-black text-[#0F172A] outline-none border-b border-gray-100 focus:border-emerald-500"
                                        />
                                    </div>
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
                    ) : (
                        totals.taxGroups.map((group, gIdx) => {
                            const label = gstType.type === 'INTRA' ? 'C-GST/S-GST' : 'I-GST';
                            const displayRate = gstType.type === 'INTRA' ? (group.rate / 2).toFixed(2) : group.rate.toFixed(2);
                            
                            if (gstType.type === 'INTRA') {
                                return (
                                    <React.Fragment key={`tax-${group.rate}`}>
                                        <tr className="border-b border-[#F1F5F9] h-[48px]">
                                            <td className="px-6 py-3 font-bold text-[#334155] uppercase text-[12px] tracking-wide">
                                                C-GST ({displayRate}%)
                                            </td>
                                            <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">
                                                {(group.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-3 text-right font-black text-gray-400 border-l border-[#F1F5F9]">
                                                {/* Progressive balance can be complex with multi-row tax, showing N/A or just the subtotal */}
                                                {(totals.subtotalWithBeforeGstExpenses + (totals.taxGroups.slice(0, gIdx).reduce((s, g) => s + g.tax, 0)) + (group.tax/2)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[#F1F5F9] h-[48px]">
                                            <td className="px-6 py-3 font-bold text-[#334155] uppercase text-[12px] tracking-wide">
                                                S-GST ({displayRate}%)
                                            </td>
                                            <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">
                                                {(group.tax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-3 text-right font-black text-gray-400 border-l border-[#F1F5F9]">
                                                {(totals.subtotalWithBeforeGstExpenses + (totals.taxGroups.slice(0, gIdx + 1).reduce((s, g) => s + g.tax, 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            } else {
                                return (
                                    <tr key={`tax-${group.rate}`} className="border-b border-[#F1F5F9] h-[48px]">
                                        <td className="px-6 py-3 font-bold text-[#334155] uppercase text-[12px] tracking-wide">
                                            I-GST ({displayRate}%)
                                        </td>
                                        <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">
                                            {group.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-3 text-right font-black text-gray-400 border-l border-[#F1F5F9]">
                                            {(totals.subtotalWithBeforeGstExpenses + (totals.taxGroups.slice(0, gIdx + 1).reduce((s, g) => s + g.tax, 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                );
                            }
                        })
                    )}

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
