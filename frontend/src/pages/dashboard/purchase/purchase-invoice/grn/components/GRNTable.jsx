import React, { useState, useMemo } from 'react';
import { Search, Trash2, Plus, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import grnService from '@/services/grnService';

const GRNTable = ({ items, setItems, products, errors, handleAddNewProduct, gstType, isPoSelected, poNumber, linkedPoItems, type = 'GRN', supplierName }) => {
    const isGRN = type === 'GRN';
    const [tableSearch, setTableSearch] = useState('');
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState(null);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

    const filteredProducts = useMemo(() => {
        const query = tableSearch.toLowerCase();
        const addedProductIds = items.map(item => item.productId).filter(id => id);
        
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

        // Update with decimal limit for discounts
        let finalValue = value;
        if (field === 'discountAmount' || field === 'discountPercent') {
            if (value.includes('.') && value.split('.')[1].length > 2) {
                const [int, dec] = value.split('.');
                finalValue = `${int}.${dec.slice(0, 2)}`;
            }
        }
        item[field] = finalValue;

        // Recalculate
        if (['quantity', 'rate', 'taxPercent', 'discountPercent', 'discountAmount', 'totalPoQty'].includes(field)) {
            const qty      = parseFloat(field === 'quantity'        ? finalValue : item.quantity)        || 0;
            const rate     = parseFloat(field === 'rate'            ? finalValue : item.rate)            || 0;
            const taxPct   = parseFloat(field === 'taxPercent'      ? finalValue : item.taxPercent)      || 0;
            const totalPO  = parseFloat(field === 'totalPoQty'      ? finalValue : item.totalPoQty)      || 0;
            const receivedPO = parseFloat(item.receivedPoQty)                                          || 0;

            const baseAmount = qty * rate;

            let discPct = parseFloat(field === 'discountPercent' ? finalValue : item.discountPercent) || 0;
            let discAmt = parseFloat(field === 'discountAmount'  ? finalValue : item.discountAmount)  || 0;

            if (field === 'discountPercent') {
                discAmt = (baseAmount * discPct) / 100;
            } else if (field === 'discountAmount') {
                discPct = baseAmount > 0 ? (discAmt / baseAmount) * 100 : 0;
            } else {
                // If quantity or rate changed, preserve the discount percentage and update the amount
                discAmt = (baseAmount * discPct) / 100;
            }

            const befTax = (baseAmount - discAmt);
            const isApplicable = gstType?.type !== 'NONE';
            const taxAmt = isApplicable ? (befTax * taxPct) / 100 : 0;
            
            // Update item fields - preserve the string finalValue for the field currently being changed to support intermediate typing states (like "10.")
            if (field !== 'quantity')        item.quantity        = qty;
            if (field !== 'rate')            item.rate            = rate;
            if (field !== 'taxPercent')      item.taxPercent      = taxPct;
            if (field !== 'discountPercent') item.discountPercent = parseFloat(discPct.toFixed(2));
            if (field !== 'discountAmount')  item.discountAmount  = parseFloat(discAmt.toFixed(2));

            item.beforeTaxAmount = parseFloat(befTax.toFixed(2));
            item.taxAmount = parseFloat(taxAmt.toFixed(2));
            item.totalAmount = parseFloat((befTax + taxAmt).toFixed(2));

            // Remaining Qty Logic: if total is 0, remaining is always 0
            item.remainingQty = totalPO > 0 
                ? parseFloat(Math.max(0, totalPO - receivedPO - qty).toFixed(2))
                : 0;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const handleSelectProduct = async (product, rowIndex = null) => {
        const qty = 1;
        const rate = parseFloat(product.purchaseRate) || 0;
        const taxPct = (parseFloat(product.tax_rate) || (product.hsn?.gst_rate ? parseFloat(product.hsn.gst_rate) : 0));
        const baseAmount = qty * rate;
        const taxAmt = gstType?.type === 'NONE' ? 0 : (baseAmount * taxPct) / 100;
        const total = parseFloat((baseAmount + taxAmt).toFixed(2));

        let poQty = 0;
        let receivedCount = 0;
        if (supplierName && isPoSelected && poNumber) {
            try {
                const history = await grnService.getReceivedQty(supplierName, product.product_code || product.productCode, poNumber);
                receivedCount = history.receivedPoQty || 0;

                // Find total qty in linked PO items if available
                if (Array.isArray(linkedPoItems)) {
                    const poItem = linkedPoItems.find(i => 
                        (i.productCode === (product.product_code || product.productCode)) ||
                        (i.productId === product.id)
                    );
                    if (poItem) {
                        poQty = parseFloat(poItem.quantity) || 0;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch received history", e);
            }
        }

        const updatedItems = [...items];
        let finalTargetIndex = rowIndex;

        if (finalTargetIndex === null) {
            const emptyIndex = updatedItems.findIndex(i => !i.productId);
            finalTargetIndex = emptyIndex === -1 ? updatedItems.length : emptyIndex;
        }

        const newItem = {
            id: updatedItems[finalTargetIndex]?.id || Date.now(),
            productId: product.id,
            productCode: product.product_code,
            productName: product.product_name,
            quantity: qty,
            rate: rate,
            uom: product.uom?.gst_uom || 'Nos', 
            hsnCode: product.hsn_code || '',
            taxPercent: taxPct,
            discountAmount: 0,
            discountPercent: 0,
            beforeTaxAmount: baseAmount,
            taxAmount: taxAmt,
            totalAmount: total,
            printDescription: product.print_description || product.product_name,
            totalPoQty: poQty,
            receivedPoQty: receivedCount,
            remainingQty: Math.max(0, poQty - receivedCount - qty).toFixed(2)
        };

        if (finalTargetIndex < updatedItems.length) {
            updatedItems[finalTargetIndex] = newItem;
        } else {
            updatedItems.push(newItem);
        }

        // Auto-add an empty row
        if (!updatedItems.some(i => !i.productId)) {
            updatedItems.push({ 
                id: Date.now() + 1, productId: null, productCode: '', productName: '', quantity: 0, rate: 0, 
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0, 
                taxAmount: 0, totalAmount: 0, printDescription: '', totalPoQty: 0, receivedPoQty: 0, remainingQty: 0 
            });
        }

        setItems(updatedItems);
        setIsProductSearchOpen(false);
        setTableSearch('');
        setActiveRowIndex(null);
    };

    const removeItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        if (newItems.length === 0) {
            newItems.push({ 
                id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0, 
                uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0, 
                taxAmount: 0, totalAmount: 0, printDescription: '', totalPoQty: 0, receivedPoQty: 0, remainingQty: 0 
            });
        }
        setItems(newItems);
    };

    const handleAddManualRow = () => {
        setItems([...items, { 
            id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0, 
            uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0, 
            taxAmount: 0, totalAmount: 0, printDescription: '', totalPoQty: 0, receivedPoQty: 0, remainingQty: 0 
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
                                    onClick={() => handleSelectProduct(p)}
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
                <table className="w-full min-w-[1800px] border-collapse">
                    <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                            <th className="px-4 py-4 w-[50px] text-center text-[13px] font-bold text-[#4B5563]">#</th>
                            <th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563] border-l border-[#F3F4F6]">Select</th>
                            <th className="px-4 py-4 w-[160px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Product Code</th>
                            <th className="px-4 py-4 w-[350px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Product Name</th>
                            <th className="px-4 py-4 w-[300px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Print Description</th>
                            {isGRN && (
                                <>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">total po qty</th>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">previous po qty</th>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">received qty</th>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">remaining qty</th>
                                </>
                            )}
                            {!isGRN && (
                                <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Qty</th>
                            )}
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Rate</th>
                            <th className="px-4 py-4 w-[120px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">UOM</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Discount (₹)</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Discount (%)</th>
                            <th className="px-4 py-4 w-[140px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">HSN Code</th>
                            <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Tax (%)</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Bef. Tax Amount</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Tax Amount</th>
                            <th className="px-4 py-4 w-[150px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Amount</th>
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
                                        <input type="text" value={item.productCode} readOnly className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-[#6B7280] outline-none cursor-not-allowed" />
                                    </td>

                                    {/* Product Name */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] relative">
                                        <input
                                            type="text"
                                            value={item.productName}
                                            readOnly={!!item.productId}
                                            onFocus={() => { if(!item.productId) { setActiveRowIndex(index); setIsProductSearchOpen(true); } }}
                                            onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                            placeholder="Select product..."
                                            className={`w-full h-[36px] bg-transparent border-none px-2 text-[14px] font-bold outline-none ${!item.productName ? 'italic font-normal text-gray-400' : ''}`}
                                        />
                                    </td>

                                    {/* Print Description */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input
                                            type="text"
                                            value={item.printDescription || ''}
                                            onChange={(e) => handleItemChange(index, 'printDescription', e.target.value)}
                                            placeholder="Description for print..."
                                            className="w-full h-[36px] bg-white border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-semibold outline-none focus:border-[#073318]"
                                        />
                                    </td>

                                    {isGRN && (
                                        <>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <input
                                                    type="number"
                                                    value={item.totalPoQty || 0}
                                                    readOnly
                                                    className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-gray-500 outline-none cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <input type="text" value={item.receivedPoQty || 0} readOnly className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-gray-500 outline-none cursor-not-allowed" />
                                            </td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.quantity === 0 ? '' : item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                    className={`w-full h-[36px] bg-white border rounded-[8px] px-2 text-[13px] font-bold text-right outline-none focus:border-[#073318] transition-all shadow-sm ${errors?.itemErrors?.[index]?.quantity ? 'border-red-500 shadow-red-50' : 'border-[#E5E7EB]'}`}
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <input type="text" value={item.remainingQty || 0} readOnly className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-emerald-700 outline-none" />
                                            </td>
                                        </>
                                    )}
                                    {!isGRN && (
                                        <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.quantity === 0 ? '' : item.quantity}
                                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                className={`w-full h-[36px] bg-white border rounded-[8px] px-2 text-[13px] font-bold text-right outline-none focus:border-[#073318] transition-all shadow-sm ${errors?.itemErrors?.[index]?.quantity ? 'border-red-500 shadow-red-50' : 'border-[#E5E7EB]'}`}
                                            />
                                        </td>
                                    )}

                                    {/* Rate */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.rate === 0 ? '' : item.rate}
                                            onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                            readOnly={isPoSelected}
                                            className={`w-full h-[36px] border rounded-[8px] px-2 text-[13px] font-bold text-right outline-none transition-all shadow-sm ${isPoSelected ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-[#E5E7EB]' : 'bg-white text-[#111827] focus:border-[#073318] border-[#E5E7EB]'} ${errors?.itemErrors?.[index]?.rate ? 'border-red-500' : ''}`}
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
                                                step="0.01"
                                                min="0"
                                                value={item.discountAmount === 0 ? '' : item.discountAmount}
                                                onChange={(e) => handleItemChange(index, 'discountAmount', e.target.value)}
                                                readOnly={isPoSelected}
                                                className={`w-full h-[36px] border border-[#E5E7EB] rounded-[8px] pl-5 pr-2 text-[13px] font-bold text-right outline-none ${isPoSelected ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-[#111827] focus:border-[#073318]'}`}
                                            />
                                        </div>
                                    </td>

                                    {/* Discount % */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <div className="relative">
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-800">%</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={item.discountPercent === 0 ? '' : item.discountPercent}
                                                onChange={(e) => handleItemChange(index, 'discountPercent', e.target.value)}
                                                readOnly={isPoSelected}
                                                className={`w-full h-[36px] border border-[#E5E7EB] rounded-[8px] pr-5 pl-2 text-[13px] font-bold text-right outline-none ${isPoSelected ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-emerald-800 focus:border-[#073318]'}`}
                                            />
                                        </div>
                                    </td>

                                    {/* HSN Code */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input type="text" value={item.hsnCode} readOnly className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-gray-500 outline-none" />
                                    </td>

                                    {/* Tax % */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <div className="relative">
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-800">%</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.taxPercent === 0 ? '' : item.taxPercent}
                                                onChange={(e) => handleItemChange(index, 'taxPercent', e.target.value)}
                                                readOnly={isPoSelected}
                                                className={`w-full h-[36px] border border-[#E5E7EB] rounded-[8px] pr-5 pl-2 text-[13px] font-black text-right outline-none transition-all ${isPoSelected ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-emerald-800 focus:border-[#073318]'}`}
                                            />
                                        </div>
                                    </td>

                                    {/* Bef Tax Amount */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-right text-[13px] font-bold text-gray-600 px-4">
                                        {parseFloat(item.beforeTaxAmount || 0).toFixed(2)}
                                    </td>

                                    {/* Tax Amount */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-right text-[13px] font-bold text-gray-600 px-4">
                                        {parseFloat(item.taxAmount || 0).toFixed(2)}
                                    </td>

                                    {/* Amount */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] text-right text-[14px] font-black text-[#073318] px-4">
                                        ₹{parseFloat(item.totalAmount || 0).toFixed(2)}
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
                                                <td colSpan={11} className={`px-4 py-3 border-l border-emerald-100 text-center italic text-[11px] font-bold ${selectedSuggestionIndex === pIdx ? 'text-emerald-100' : 'text-emerald-500'}`}>
                                                    Select this product to add to the list
                                                </td>
                                                <td className={`px-4 py-3 border-l border-emerald-100 text-right font-black ${selectedSuggestionIndex === pIdx ? 'text-white' : 'text-emerald-900'}`}>₹{p.purchaseRate || 0}</td>
                                                <td className="sticky right-0 bg-transparent"></td>
                                            </tr>
                                        ))}
                                        <tr className="bg-white border-t border-gray-100 text-center">
                                            <td colSpan={18} className="px-4 py-4 bg-emerald-50/10">
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
                            {isGRN && (
                                <>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="px-4 py-4 text-right text-[14px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                        {items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                </>
                            )}
                            {!isGRN && (
                                <td className="px-4 py-4 text-right text-[14px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                    {items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toFixed(2)}
                                </td>
                            )}
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="border-l border-[#F3F4F6]"></td>
                            <td className="px-4 py-4 text-right text-[13px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                {items.reduce((sum, item) => sum + (parseFloat(item.beforeTaxAmount) || 0), 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-4 text-right text-[13px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                {items.reduce((sum, item) => sum + (parseFloat(item.taxAmount) || 0), 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-4 text-right text-[15px] font-black text-[#073318] border-l border-[#F3F4F6]">
                                ₹ {items.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0).toFixed(2)}
                            </td>
                            <td className="sticky right-0 bg-[#F9FAFB] border-l border-[#F3F4F6]"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default GRNTable;
