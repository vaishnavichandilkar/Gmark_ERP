import React, { useState, useMemo } from 'react';
import { Search, Trash2, Plus, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const GRNTable = ({ items, setItems, products, errors, handleAddNewProduct }) => {
    const [tableSearch, setTableSearch] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState(null);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

    const filteredProducts = useMemo(() => {
        const query = tableSearch.toLowerCase();
        const addedProductIds = items.map(item => item.product_id).filter(id => id);
        
        return (products || []).filter(p => {
            if (addedProductIds.includes(p.id)) return false;
            return (
                p.product_name?.toLowerCase().includes(query) ||
                p.product_code?.toLowerCase().includes(query) ||
                p.hsn_code?.toLowerCase().includes(query)
            );
        });
    }, [tableSearch, products, items]);

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        item[field] = value;

        // Recalculate
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const taxPct = parseFloat(item.tax_percent) || 0;
        let discAmt = parseFloat(item.discount_amount) || 0;
        let discPct = parseFloat(item.discount_percent) || 0;

        const baseAmount = qty * rate;

        if (field === 'discount_percent') {
            discAmt = (baseAmount * discPct) / 100;
            item.discount_amount = isNaN(discAmt) ? 0 : parseFloat(discAmt.toFixed(2));
        } else if (field === 'discount_amount') {
            discPct = baseAmount > 0 ? (discAmt / baseAmount) * 100 : 0;
            item.discount_percent = isNaN(discPct) ? 0 : parseFloat(discPct.toFixed(2));
        }

        const befTax = baseAmount - (parseFloat(item.discount_amount) || 0);
        item.before_tax = isNaN(befTax) ? 0 : parseFloat(befTax.toFixed(2));
        
        const taxAmt = (item.before_tax * taxPct) / 100;
        item.tax_amount = isNaN(taxAmt) ? 0 : parseFloat(taxAmt.toFixed(2));
        
        const total = item.before_tax + item.tax_amount;
        item.total_amount = isNaN(total) ? 0 : parseFloat(total.toFixed(2));

        // Remaining Qty Logic
        const totalPO = parseFloat(item.total_po_quantity) || 0;
        const receivedPO = parseFloat(item.received_po_qty) || 0;
        item.remaining_quantity = (totalPO - receivedPO - qty).toFixed(2);

        newItems[index] = item;
        setItems(newItems);
    };

    const handleSelectProduct = (product, rowIndex) => {
        const qty = 1;
        const rate = parseFloat(product.purchaseRate) || 0;
        const taxPct = parseFloat(product.tax_rate) || 0;
        const baseAmount = qty * rate;
        const taxAmt = (baseAmount * taxPct) / 100;
        const total = baseAmount + taxAmt;

        const newItems = [...items];
        newItems[rowIndex] = {
            ...newItems[rowIndex],
            product_id: product.id,
            product_code: product.product_code,
            product_name: product.product_name,
            quantity: qty,
            rate: rate,
            uom: product.unitSymbol || product.unit_name || 'Nos', // Use symbol if available
            hsn: product.hsn_code || '',
            tax_percent: taxPct,
            discount_amount: 0,
            discount_percent: 0,
            before_tax: baseAmount,
            tax_amount: taxAmt,
            total_amount: total,
            print_description: product.print_description || product.product_name,
            total_po_quantity: 0,
            received_po_qty: 0,
            remaining_quantity: 0
        };

        setItems(newItems);
        setIsProductSearchOpen(false);
        setTableSearch('');
        setActiveRowIndex(null);
    };

    const removeItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        if (newItems.length === 0) {
            newItems.push({ 
                id: Date.now(), product_id: null, product_code: '', product_name: '', quantity: 0, rate: 0, 
                uom: '', discount_amount: 0, discount_percent: 0, hsn: '', tax_percent: 0, before_tax: 0, 
                tax_amount: 0, total_amount: 0, print_description: '', total_po_quantity: 0, received_po_qty: 0, remaining_quantity: 0 
            });
        }
        setItems(newItems);
    };

    const handleAddManualRow = () => {
        setItems([...items, { 
            id: Date.now(), product_id: null, product_code: '', product_name: '', quantity: 0, rate: 0, 
            uom: '', discount_amount: 0, discount_percent: 0, hsn: '', tax_percent: 0, before_tax: 0, 
            tax_amount: 0, total_amount: 0, print_description: '', total_po_quantity: 0, received_po_qty: 0, remaining_quantity: 0 
        }]);
    };

    return (
        <div className="flex flex-col gap-6 font-outfit">
            <style>{`
                .custom-grn-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-grn-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
                .custom-grn-scrollbar::-webkit-scrollbar-thumb { background: #A7C0B8; border-radius: 4px; }
                .custom-grn-scrollbar::-webkit-scrollbar-thumb:hover { background: #073318; }
            `}</style>

            {/* Table Search Bar */}
            <div className="relative max-w-[550px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Search By Anything..."
                    value={tableSearch}
                    onFocus={() => { setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                    onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(null); setIsProductSearchOpen(true); }}
                    className={`w-full h-[44px] bg-white border rounded-[12px] pl-11 pr-4 text-[14px] font-medium outline-none transition-all shadow-sm ${errors?.items ? 'border-red-500' : 'border-[#E5E7EB] focus:border-[#073318]'}`}
                />

                {isProductSearchOpen && activeRowIndex === null && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-[#E5E7EB] rounded-[16px] shadow-2xl z-[60] overflow-hidden border-t-4 border-t-emerald-800">
                        <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                            {filteredProducts.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        const emptyIndex = items.findIndex(i => !i.product_id);
                                        handleSelectProduct(p, emptyIndex === -1 ? items.length - 1 : emptyIndex);
                                    }}
                                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-emerald-50 transition-all border-b border-[#F3F4F6] text-left outline-none group"
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[#111827] text-[15px] group-hover:text-emerald-900">{p.product_name}</span>
                                            <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">#{p.product_code}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[12px] text-gray-400 font-medium">
                                            <span>HSN: <span className="text-gray-700 font-bold">{p.hsn_code || 'N/A'}</span></span>
                                            <span>Tax: <span className="text-gray-700 font-bold">{p.tax_rate || 0}%</span></span>
                                            <span>Price: <span className="text-emerald-700 font-black">₹{p.purchaseRate || 0}</span></span>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                                        <Plus size={18} />
                                    </div>
                                </button>
                            ))}
                            <div className="p-3 bg-gray-50 border-t border-[#F3F4F6]">
                                <button 
                                    onClick={handleAddNewProduct}
                                    className="w-full h-[40px] bg-[#073318] text-white text-[13px] font-bold rounded-[8px] hover:bg-[#052611] transition-all flex items-center justify-center gap-2 group shadow-md"
                                >
                                    <Plus size={14} className="group-hover:scale-110 transition-transform" /> 
                                    Add new product
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Items Table with Extra Selection Column */}
            <div className="overflow-x-auto border border-[#E5E7EB] rounded-[16px] shadow-sm bg-white custom-grn-scrollbar">
                <table className="w-full min-w-[2100px] border-collapse">
                    <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                            <th className="px-4 py-4 w-[50px] text-center text-[13px] font-bold text-[#4B5563]">#</th>
                            <th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563] border-l border-[#F3F4F6]">Select</th>
                            <th className="px-4 py-4 w-[160px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Product Code</th>
                            <th className="px-4 py-4 w-[350px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Product Name</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Total PO Qty</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Received PO Qty</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Received Qty (Manual)</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Remaining Qty</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Rate</th>
                            <th className="px-4 py-4 w-[120px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">UOM</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Discount (₹)</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Discount (%)</th>
                            <th className="px-4 py-4 w-[140px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">HSN Code</th>
                            <th className="px-4 py-4 w-[100px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Tax (%)</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Bef. Tax Amount</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Tax Amount</th>
                            <th className="px-4 py-4 w-[150px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Amount</th>
                            <th className="px-4 py-4 w-[300px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Print Description</th>
                            <th className="px-4 py-4 w-[80px] text-center text-[13px] font-bold text-gray-500 border-l border-[#F3F4F6] sticky right-0 bg-white z-10">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <React.Fragment key={item.id}>
                                <tr className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group h-[52px]">
                                    <td className="px-4 py-2 text-center text-[13px] font-bold text-gray-400">{index + 1}</td>
                                    
                                    {/* Selection Column */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-center">
                                        <button 
                                            onClick={() => { setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <Search size={14} />
                                        </button>
                                    </td>

                                    {/* Product Code */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input type="text" value={item.product_code} readOnly className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-[#6B7280] outline-none cursor-not-allowed" />
                                    </td>

                                    {/* Product Name */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] relative">
                                        <input
                                            type="text"
                                            value={item.product_name}
                                            readOnly={!!item.product_id}
                                            onFocus={() => { if(!item.product_id) { setActiveRowIndex(index); setIsProductSearchOpen(true); } }}
                                            onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                            placeholder="Select product..."
                                            className={`w-full h-[36px] bg-transparent border-none px-2 text-[14px] font-bold outline-none ${!item.product_name ? 'italic font-normal text-gray-400' : ''}`}
                                        />
                                    </td>

                                    {/* Total PO Qty */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input type="text" value={item.total_po_quantity || 0} readOnly className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-gray-500 outline-none" />
                                    </td>

                                    {/* Received PO Qty */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input type="text" value={item.received_po_qty || 0} readOnly className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-gray-500 outline-none" />
                                    </td>

                                    {/* Received Qty (Manual) */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input
                                            type="number"
                                            value={item.quantity === 0 ? '' : item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                            className={`w-full h-[36px] bg-white border rounded-[8px] px-2 text-[13px] font-bold text-right outline-none focus:border-[#073318] transition-all shadow-sm ${errors?.itemErrors?.[index]?.quantity ? 'border-red-500 shadow-red-50' : 'border-[#E5E7EB]'}`}
                                        />
                                    </td>

                                    {/* Remaining Qty */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input type="text" value={item.remaining_quantity || 0} readOnly className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-gray-600 outline-none" />
                                    </td>

                                    {/* Rate */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input
                                            type="number"
                                            value={item.rate === 0 ? '' : item.rate}
                                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                            className={`w-full h-[36px] bg-white border rounded-[8px] px-2 text-[13px] font-bold text-right outline-none focus:border-[#073318] transition-all shadow-sm ${errors?.itemErrors?.[index]?.rate ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                                        />
                                    </td>

                                    {/* UOM */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input
                                            type="text"
                                            value={item.uom}
                                            onChange={(e) => handleItemChange(index, 'uom', e.target.value)}
                                            className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-[#6B7280] outline-none focus:border-[#073318]"
                                        />
                                    </td>

                                    {/* Discount Amount */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-400">₹</span>
                                            <input
                                                type="number"
                                                value={item.discount_amount === 0 ? '' : item.discount_amount}
                                                onChange={(e) => handleItemChange(index, 'discount_amount', e.target.value)}
                                                className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] pl-5 pr-2 text-[13px] font-bold text-right outline-none focus:border-[#073318]"
                                            />
                                        </div>
                                    </td>

                                    {/* Discount % */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <div className="relative">
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-800">%</span>
                                            <input
                                                type="number"
                                                value={item.discount_percent === 0 ? '' : item.discount_percent}
                                                onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                                                className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] pr-5 pl-2 text-[13px] font-bold text-right outline-none focus:border-[#073318]"
                                            />
                                        </div>
                                    </td>

                                    {/* HSN Code */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input type="text" value={item.hsn} readOnly className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-gray-500 outline-none" />
                                    </td>

                                    {/* Tax % */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input type="text" value={`${item.tax_percent}%`} readOnly className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-black text-right text-emerald-800 outline-none" />
                                    </td>

                                    {/* Bef Tax Amount */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-right text-[13px] font-bold text-gray-600 px-4">
                                        {item.before_tax.toFixed(2)}
                                    </td>

                                    {/* Tax Amount */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-right text-[13px] font-bold text-gray-600 px-4">
                                        {item.tax_amount.toFixed(2)}
                                    </td>

                                    {/* Amount */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-right text-[14px] font-black text-[#073318] px-4">
                                        ₹{item.total_amount.toFixed(2)}
                                    </td>

                                    {/* Print Description */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input
                                            type="text"
                                            value={item.print_description || ''}
                                            onChange={(e) => handleItemChange(index, 'print_description', e.target.value)}
                                            placeholder="Description for print..."
                                            className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-semibold outline-none focus:border-[#073318]"
                                        />
                                    </td>

                                    {/* Action */}
                                    <td className="px-4 py-2 border-l border-[#F3F4F6] text-center sticky right-0 bg-white group-hover:bg-[#F9FAFB] transition-colors z-10 shadow-[-5px_0_10px_rgba(0,0,0,0.02)]">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={handleAddManualRow} className="text-gray-400 hover:text-emerald-600 transition-colors p-2 rounded-lg hover:bg-emerald-50" title="Add Next Product">
                                                <Plus size={18} />
                                            </button>
                                            <button onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50" title="Delete Row">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>

                                {/* Suggestions Row */}
                                {isProductSearchOpen && activeRowIndex === index && (
                                    <>
                                        {filteredProducts.slice(0, 8).map((p, pIdx) => (
                                            <tr
                                                key={p.id}
                                                onClick={() => handleSelectProduct(p, index)}
                                                className={`cursor-pointer transition-all duration-200 border-b border-emerald-50 ${selectedSuggestionIndex === pIdx ? 'bg-emerald-600 shadow-inner' : 'bg-emerald-50/40 hover:bg-emerald-100'}`}
                                                onMouseEnter={() => setSelectedSuggestionIndex(pIdx)}
                                            >
                                                <td className="px-4 py-3 text-center">
                                                    <div className={`w-2 h-2 rounded-full mx-auto ${selectedSuggestionIndex === pIdx ? 'bg-white ring-4 ring-white/20' : 'bg-emerald-200'}`}></div>
                                                </td>
                                                <td colSpan={2} className={`px-4 py-3 border-l border-emerald-100 font-mono text-[13px] font-black ${selectedSuggestionIndex === pIdx ? 'text-white' : 'text-emerald-800'}`}>{p.product_code}</td>
                                                <td className={`px-4 py-3 border-l border-emerald-100 font-black uppercase text-[14px] tracking-tight ${selectedSuggestionIndex === pIdx ? 'text-white' : 'text-emerald-900'}`}>{p.product_name}</td>
                                                <td colSpan={12} className={`px-4 py-3 border-l border-emerald-100 text-center italic text-[11px] font-bold ${selectedSuggestionIndex === pIdx ? 'text-emerald-100' : 'text-emerald-500'}`}>
                                                    Select this product to add to the list
                                                </td>
                                                <td className={`px-4 py-3 border-l border-emerald-100 text-right font-black ${selectedSuggestionIndex === pIdx ? 'text-white' : 'text-emerald-900'}`}>₹{p.purchaseRate || 0}</td>
                                                <td className="sticky right-0 bg-transparent"></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-white border-t border-gray-100 text-center">
                                            <td colSpan={19} className="px-4 py-4 bg-emerald-50/10">
                                                <button 
                                                    onClick={handleAddNewProduct}
                                                    className="inline-flex h-[40px] px-8 bg-[#073318] text-white text-[13px] font-bold rounded-[8px] hover:bg-[#052611] transition-all items-center gap-3 shadow-lg"
                                                >
                                                    <Plus size={16} /> Add New Product
                                                </button>
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>

                    <tfoot>
                        <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB] font-outfit h-[54px]">
                            <td colSpan={2} className="px-4 py-4 text-[13px] font-black text-[#111827]">Total</td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="px-4 py-4 text-right text-[14px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                {items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toFixed(2)}
                            </td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="px-4 py-4 text-right text-[13px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                {items.reduce((sum, item) => sum + (parseFloat(item.before_tax) || 0), 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-4 text-right text-[13px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                {items.reduce((sum, item) => sum + (parseFloat(item.tax_amount) || 0), 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-4 text-right text-[15px] font-black text-[#073318] border-l border-[#F3F4F6]">
                                ₹ {items.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0).toFixed(2)}
                            </td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="sticky right-0 bg-[#F9FAFB] border-l border-[#F3F4F6]"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default GRNTable;
