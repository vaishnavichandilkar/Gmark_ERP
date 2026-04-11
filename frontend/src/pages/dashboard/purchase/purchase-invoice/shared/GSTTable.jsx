import React, { useMemo } from 'react';

const GSTTable = ({ items }) => {
    // Auto calculate based on product tax
    const calculations = useMemo(() => {
        let baseAmount = 0;
        let totalTax = 0;

        items.forEach(item => {
            if (!item.product_name) return; // Skip empty rows
            const qty = parseFloat(item.quantity) || 0;
            const rate = parseFloat(item.rate) || 0;
            const discount = parseFloat(item.discount_amount) || 0;
            const taxPercent = parseFloat(item.tax_percent) || 0;

            const itemBase = (qty * rate) - discount;
            const itemTax = itemBase * (taxPercent / 100);

            baseAmount += itemBase;
            totalTax += itemTax;
        });

        // Split intro CGST/SGST equally for generic handling
        const halfTax = totalTax / 2;
        const grandTotal = baseAmount + totalTax;

        return {
            baseAmount: baseAmount.toFixed(2),
            cgst: halfTax.toFixed(2),
            sgst: halfTax.toFixed(2),
            totalTax: totalTax.toFixed(2),
            grandTotal: grandTotal.toFixed(2)
        };
    }, [items]);

    return (
        <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-sm overflow-hidden font-outfit mt-8">
            <div className="p-6 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center gap-3">
                <div className="w-1.5 h-6 bg-[#073318] rounded-full" />
                <h2 className="text-[18px] font-bold text-[#111827]">GST Summary</h2>
            </div>
            
            <div className="overflow-x-auto min-h-[auto] bg-white custom-scrollbar">
                <table className="w-full min-w-[600px] border-collapse bg-white">
                    <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                            <th className="px-6 py-4 text-left text-[13px] font-semibold text-[#4B5563]">Account Name</th>
                            <th className="px-6 py-4 text-right text-[13px] font-semibold text-[#4B5563]">Amount (₹)</th>
                            <th className="px-6 py-4 text-right text-[13px] font-semibold text-[#4B5563]">Cumulative Balance (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 1. Material Purchase */}
                        <tr className="border-b border-[#F3F4F6] hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-[14px] font-semibold text-[#374151]">Material Purchase</td>
                            <td className="px-6 py-4 text-[14px] font-bold text-[#073318] text-right">{calculations.baseAmount}</td>
                            <td className="px-6 py-4 text-[14px] font-bold text-gray-500 text-right">{calculations.baseAmount}</td>
                        </tr>
                        
                        {/* 2. CGST */}
                        <tr className="border-b border-[#F3F4F6] hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-[14px] font-semibold text-[#374151]">CGST</td>
                            <td className="px-6 py-4 text-[14px] font-bold text-[#073318] text-right">{calculations.cgst}</td>
                            <td className="px-6 py-4 text-[14px] font-bold text-gray-500 text-right">
                                {(parseFloat(calculations.baseAmount) + parseFloat(calculations.cgst)).toFixed(2)}
                            </td>
                        </tr>

                        {/* 3. SGST */}
                        <tr className="border-b border-[#F3F4F6] hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-[14px] font-semibold text-[#374151]">SGST</td>
                            <td className="px-6 py-4 text-[14px] font-bold text-[#073318] text-right">{calculations.sgst}</td>
                            <td className="px-6 py-4 text-[14px] font-bold text-gray-500 text-right">
                                {(parseFloat(calculations.baseAmount) + parseFloat(calculations.totalTax)).toFixed(2)}
                            </td>
                        </tr>

                        {/* 4. Grand Total */}
                         <tr className="bg-emerald-50/50">
                            <td className="px-6 py-5 text-[15px] font-black text-[#073318]">Grand Total</td>
                            <td className="px-6 py-5 text-[16px] font-black text-[#073318] text-right">
                                {calculations.grandTotal}
                            </td>
                            <td className="px-6 py-5 text-[16px] font-black text-[#073318] text-right">
                                {calculations.grandTotal}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GSTTable;
