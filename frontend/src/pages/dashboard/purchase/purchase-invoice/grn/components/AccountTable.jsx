import React, { useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';

const AccountTable = ({ items }) => {
    const tableData = useMemo(() => {
        // Only consider items with a product selected
        const validItems = items.filter(item => item.product_id);
        
        const subtotal = validItems.reduce((sum, item) => sum + (parseFloat(item.before_tax) || 0), 0);
        const taxTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0);
        
        // Calculate GST split
        const cgst = taxTotal / 2;
        const sgst = taxTotal / 2;
        const total = subtotal + taxTotal;

        // Try to find the common tax rate for labels, default to 18 (9+9)
        const sampleTaxRate = validItems.length > 0 ? (parseFloat(validItems[0].tax_percent) || 18) : 18;
        const splitRate = sampleTaxRate / 2;

        return [
            { 
                account: `Material Purchase (G.S.T.)`, 
                amount: subtotal > 0 ? subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00', 
                balance: subtotal > 0 ? subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' 
            },
            { 
                account: '', 
                amount: '', 
                balance: subtotal > 0 ? subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' 
            },
            { 
                account: `c - gst ${splitRate}%`, 
                amount: cgst > 0 ? cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00', 
                balance: (subtotal + cgst) > 0 ? (subtotal + cgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' 
            },
            { 
                account: `s - gst ${splitRate}%`, 
                amount: sgst > 0 ? sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00', 
                balance: (subtotal + taxTotal) > 0 ? (subtotal + taxTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' 
            },
            { 
                account: '', 
                amount: '', 
                balance: total > 0 ? total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00' 
            },
        ];
    }, [items]);

    const grandTotalValue = items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);

    return (
        <div className="mt-4 border border-[#E5E7EB] rounded-[16px] overflow-hidden bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] font-outfit">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                        <th className="px-6 py-4 text-left text-[13px] font-bold text-[#64748B] uppercase tracking-wider w-[50%]">
                            <div className="flex items-center gap-2">Accounts <ChevronsUpDown size={14} className="text-gray-300"/></div>
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
                    {tableData.map((row, idx) => (
                        <tr key={idx} className={`border-b border-[#F1F5F9] transition-colors h-[48px] ${row.account ? 'hover:bg-gray-50' : 'bg-gray-50/30'}`}>
                            <td className={`px-6 py-3 ${row.account ? 'font-semibold text-[#334155] uppercase text-[12px] tracking-wide' : ''}`}>{row.account}</td>
                            <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9]">{row.amount}</td>
                            <td className="px-6 py-3 text-right font-black text-[#0F172A] border-l border-[#F1F5F9] text-gray-400">{row.balance}</td>
                        </tr>
                    ))}
                    <tr className="bg-[#073318] h-[56px]">
                        <td className="px-6 py-3 font-black text-white uppercase tracking-[2px] text-[15px]">Grand Total</td>
                        <td className="px-6 py-3 text-right font-black text-white text-[18px] border-l border-[#ffffff20]">
                            ₹{grandTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3 border-l border-[#ffffff20]"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default AccountTable;
