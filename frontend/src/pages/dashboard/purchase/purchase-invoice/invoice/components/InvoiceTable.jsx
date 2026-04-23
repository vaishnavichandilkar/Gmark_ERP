import React from 'react';
import { Trash2 } from 'lucide-react';
import ProductDropdown from '../../shared/ProductDropdown';

const InvoiceTable = ({
    items,
    setItems,
    products,
    tableSearch,
    setTableSearch,
    isProductSearchOpen,
    setIsProductSearchOpen,
    activeRowIndex,
    setActiveRowIndex,
    handleQuickAddProduct
}) => {

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        
        let finalValue = value;
        if (field === 'discount_amount') {
            const valStr = value.toString();
            if (valStr.includes('.') && valStr.split('.')[1].length > 2) {
                const [int, dec] = valStr.split('.');
                finalValue = parseFloat(`${int}.${dec.slice(0, 2)}`);
            }
        }
        
        newItems[index][field] = finalValue;
        setItems(newItems);
    };

    const removeItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        if (newItems.length === 0) {
            setItems([{
                id: Date.now(), product_id: null, product_code: '', product_name: '', quantity: 1, rate: 0, uom: 'Nos', discount_amount: 0, discount_percent: 0, hsn: '', tax_percent: 0, before_tax: 0, tax_amount: 0, total_amount: 0, description: ''
            }]);
        } else {
            setItems(newItems);
        }
    };

    return (
        <div className="font-outfit mt-8">
            {/* Inline Product Search */}
            <div className="mb-6">
                 <ProductDropdown 
                    products={products}
                    tableSearch={tableSearch}
                    setTableSearch={setTableSearch}
                    isProductSearchOpen={isProductSearchOpen}
                    setIsProductSearchOpen={setIsProductSearchOpen}
                    activeRowIndex={activeRowIndex}
                    setActiveRowIndex={setActiveRowIndex}
                    handleQuickAddProduct={handleQuickAddProduct}
                    addedProductIds={items.map(i => i.product_id).filter(Boolean)}
                 />
            </div>

            <div className="overflow-x-auto min-h-[400px] bg-white pb-[100px] custom-scrollbar border border-[#E5E7EB] rounded-[24px] shadow-sm">
                <table className="w-full min-w-[1500px] border-collapse bg-white">
                    <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                            <th className="px-4 py-4 w-[60px] text-center text-[13px] font-semibold text-[#4B5563]">#</th>
                            {[
                                { label: "Product Code", width: "160px" },
                                { label: "Product Name", width: "350px" },
                                { label: "Quantity", width: "120px" },
                                { label: "Rate", width: "120px" },
                                { label: "UOM", width: "120px" },
                                { label: "Discount", width: "120px" },
                                { label: "Amount", width: "160px" },
                                { label: "Action", width: "80px" }
                            ].map((col, i) => (
                                <th key={i} className="px-4 py-4 text-left text-[13px] font-medium text-[#6B7280] border-l border-[#F3F4F6]" style={{ width: col.width }}>{col.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-gray-50/30 transition-colors group">
                                <td className="px-4 py-3 text-center text-[13px] font-medium text-gray-400 group-hover:bg-emerald-50/50">{idx + 1}</td>
                                
                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top">
                                    <input type="text" value={item.product_code} readOnly className="w-full h-[44px] bg-transparent text-[14px] font-bold text-gray-700 outline-none cursor-not-allowed uppercase" placeholder="---" />
                                </td>
                                
                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top">
                                    <input type="text" value={item.product_name} readOnly className="w-full h-[44px] bg-transparent text-[14px] font-bold text-[#111827] outline-none cursor-not-allowed" placeholder="Select product..." />
                                    {item.product_name && <div className="text-[11px] text-gray-400 font-medium mt-1">HSN: {item.hsn || '---'} | Tax: {item.tax_percent || 0}%</div>}
                                </td>

                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top">
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={item.quantity === 0 ? '' : item.quantity} 
                                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318] shadow-sm transition-all"
                                        placeholder="0"
                                    />
                                </td>

                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top">
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={item.rate === 0 ? '' : item.rate} 
                                        onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                                        className="w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318] shadow-sm transition-all"
                                        placeholder="0.00"
                                    />
                                </td>

                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top">
                                    <input type="text" value={item.uom} readOnly className="w-full h-[44px] bg-transparent text-[14px] font-bold text-gray-500 outline-none cursor-not-allowed" placeholder="---" />
                                </td>

                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        value={item.discount_amount === 0 ? '' : item.discount_amount} 
                                        onChange={(e) => handleItemChange(idx, 'discount_amount', e.target.value)}
                                        className="w-full h-[44px] bg-white border border-[#E5E7EB] rounded-[10px] px-3 text-[14px] font-bold text-[#111827] outline-none focus:border-[#073318] focus:ring-1 focus:ring-[#073318] shadow-sm transition-all"
                                        placeholder="0.00"
                                    />
                                </td>

                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top">
                                    <div className="h-[44px] flex items-center text-[15px] font-black text-[#073318]">
                                        {((item.quantity * item.rate) - (item.discount_amount || 0)).toFixed(2)}
                                    </div>
                                </td>

                                <td className="px-4 py-3 border-l border-[#F3F4F6] align-top text-center group-hover:bg-red-50/30 transition-colors">
                                    <button 
                                        onClick={() => removeItem(idx)}
                                        className="w-[44px] h-[44px] flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 rounded-[10px] transition-all mx-auto"
                                    >
                                        <Trash2 size={18} strokeWidth={2.5} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InvoiceTable;
