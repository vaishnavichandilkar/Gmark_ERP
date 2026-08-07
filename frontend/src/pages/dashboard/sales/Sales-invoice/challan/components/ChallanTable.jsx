import React, { useState, useMemo, useEffect } from 'react';
import { Search, Trash2, Plus, AlertCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import challanService from '@/services/challanService';
import { getStandardGstUom } from '@/utils/uomUtils';
import { useTranslation } from 'react-i18next';

const ChallanTable = ({ items, setItems, products, errors, handleAddNewProduct, gstType, isSoSelected, soNumber, linkedSoItems = [], type = 'Challan', customerName }) => {
    const { t } = useTranslation(['modules', 'common']);
    const isChallan = type === 'Challan';
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

    // Sync items with gstType changes
    useEffect(() => {
        if (!items || items.length === 0) return;

        const updatedItems = items.map(item => {
            const qty = parseFloat(item.quantity) || 0;
            const rate = parseFloat(item.rate) || 0;
            const taxPct = parseFloat(item.taxPercent) || 0;
            const discAmt = parseFloat(item.discountAmount) || 0;
            
            const baseAmount = qty * rate;
            const befTax = Math.max(0, baseAmount - discAmt);
            const isApplicable = gstType?.applicable !== false;
            const taxAmt = isApplicable ? (befTax * taxPct) / 100 : 0;
            
            return {
                ...item,
                beforeTaxAmount: parseFloat(befTax.toFixed(2)),
                taxAmount: parseFloat(taxAmt.toFixed(2)),
                totalAmount: parseFloat((befTax + taxAmt).toFixed(2))
            };
        });

        const hasChange = JSON.stringify(updatedItems) !== JSON.stringify(items);
        if (hasChange) {
            setItems(updatedItems);
        }
    }, [gstType?.applicable, gstType?.type, setItems, items]); // Watch items to ensure SO load triggers calculation

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        // Update the specific field with decimal limit for discounts
        let finalValue = value;
        if (field === 'printDescription') {
            const originalPrefix = item.originalPrintDescription || '';
            if (originalPrefix && !value.startsWith(originalPrefix)) {
                if (value.length < originalPrefix.length) {
                    finalValue = originalPrefix;
                } else {
                    finalValue = originalPrefix + value.substring(originalPrefix.length);
                }
            }
        }
        if (field === 'discountAmount' || field === 'discountPercent') {
            if (value.includes('.') && value.split('.')[1].length > 2) {
                const [int, dec] = value.split('.');
                finalValue = `${int}.${dec.slice(0, 2)}`;
            }
        }
        item[field] = finalValue;

        let qty       = parseFloat(field === 'quantity'       ? finalValue : item.quantity)       || 0;
        const rate      = parseFloat(field === 'rate'           ? finalValue : item.rate)            || 0;
        const taxPct    = parseFloat(field === 'taxPercent'     ? finalValue : item.taxPercent)      || 0;
        const totalSO   = parseFloat(field === 'totalSoQty'     ? finalValue : item.totalSoQty)      || 0;
        const givenSO   = parseFloat(item.givenSoQty)                                           || 0;

        const maxAllowed = totalSO - givenSO;
        if (totalSO > 0 && qty > maxAllowed) {
            toast.error(`Quantity cannot exceed remaining SO quantity of ${maxAllowed}`);
            qty = Math.max(0, maxAllowed);
            if (field === 'quantity') {
                finalValue = qty;
            }
            item.quantity = qty;
        }

        // Recalculate if any dependent field changed
        if (['quantity', 'rate', 'taxPercent', 'discountPercent', 'discountAmount', 'totalSoQty'].includes(field)) {
            const baseAmount = qty * rate;

            let discPct = parseFloat(field === 'discountPercent' ? finalValue : item.discountPercent) || 0;
            let discAmt = parseFloat(field === 'discountAmount'  ? finalValue : item.discountAmount)  || 0;

            if (field === 'discountPercent') {
                discAmt = parseFloat(((baseAmount * discPct) / 100).toFixed(2));
            } else if (field === 'discountAmount') {
                discPct = baseAmount > 0 ? parseFloat(((discAmt / baseAmount) * 100).toFixed(2)) : 0;
            } else {
                // If quantity or rate changed, preserve the discount percentage and update the amount
                discAmt = parseFloat(((baseAmount * discPct) / 100).toFixed(2));
            }

            // Clamp discount
            if (discAmt > baseAmount) {
                toast.error('Discount cannot exceed the base amount');
                discAmt = baseAmount;
                discPct = 100;
            }

            const befTax = parseFloat(Math.max(0, baseAmount - discAmt).toFixed(2));
            const isApplicable = gstType?.applicable !== false;
            const taxAmt = isApplicable ? parseFloat(((befTax * taxPct) / 100).toFixed(2)) : 0;

            // Preserve the original string value for the field currently being changed
            if (field !== 'quantity')        item.quantity        = qty;
            if (field !== 'rate')            item.rate            = rate;
            if (field !== 'taxPercent')      item.taxPercent      = taxPct;
            if (field !== 'discountPercent') item.discountPercent = parseFloat(parseFloat(discPct).toFixed(2));
            if (field !== 'discountAmount')  item.discountAmount  = parseFloat(parseFloat(discAmt).toFixed(2));

            item.beforeTaxAmount = befTax;
            item.taxAmount       = taxAmt;
            item.totalAmount     = parseFloat((befTax + taxAmt).toFixed(2));

            // Remaining Qty = Total SO Qty - (Given SO Qty + Current Challan Qty)
            item.remainingQty = totalSO > 0
                ? parseFloat(Math.max(0, totalSO - givenSO - qty).toFixed(2))
                : 0;
        }

        newItems[index] = item;
        setItems(newItems);
    };

    const handleSelectProduct = async (product, rowIndex = null) => {
        const rate = parseFloat(product.sale_rate || product.saleRate || product.purchaseRate || 0);
        const taxPct = parseFloat(product.tax_rate ?? product.taxRate ?? product.hsn?.gst_rate ?? 0);

        let soQty = 0;
        let givenCount = 0;
        if (customerName && isSoSelected && soNumber) {
            try {
                const history = await challanService.getReceivedQty(customerName, product.product_code || product.productCode, soNumber);
                givenCount = history.givenSoQty || history.totalQty || 0;
                
                // Find total qty in linked SO items if available
                if (Array.isArray(linkedSoItems)) {
                    const soItem = linkedSoItems.find(i => 
                        (i.productCode === (product.product_code || product.productCode)) ||
                        (i.productId === product.id)
                    );
                    if (soItem) {
                        soQty = parseFloat(soItem.quantity) || 0;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch given history", e);
            }
        }

        let qty = 1;
        if (soQty > 0) {
            const maxAllowed = soQty - givenCount;
            if (qty > maxAllowed) {
                qty = Math.max(0, maxAllowed);
                toast.error(`Quantity adjusted to remaining SO quantity of ${qty}`);
            }
        }

        const baseAmount = qty * rate;
        const isApplicable = gstType?.applicable !== false;
        const taxAmt = isApplicable ? (baseAmount * taxPct) / 100 : 0;
        const total = parseFloat((baseAmount + taxAmt).toFixed(2));

        const updatedItems = [...items];
        let finalTargetIndex = rowIndex;

        if (finalTargetIndex === null) {
            const emptyIndex = updatedItems.findIndex(i => !i.productId);
            finalTargetIndex = emptyIndex === -1 ? updatedItems.length : emptyIndex;
        }

        const printDesc = product.print_description || product.description || product.product_name || '';
        const newItem = {
            id: updatedItems[finalTargetIndex]?.id || Date.now(),
            productId: product.id,
            productCode: product.product_code || product.productCode,
            productName: product.product_name || product.productName,
            quantity: qty,
            rate: rate,
            uom: product.uom?.gst_uom || product.uom?.unit_name || 'Nos',
            hsnCode: product.hsn_code || product.hsnCode || '',
            taxPercent: taxPct,
            discountAmount: 0,
            discountPercent: 0,
            beforeTaxAmount: baseAmount,
            taxAmount: taxAmt,
            totalAmount: total,
            printDescription: printDesc,
            originalPrintDescription: printDesc,
            totalSoQty: soQty,
            givenSoQty: givenCount,
            remainingQty: Math.max(0, soQty - givenCount - qty).toFixed(2)
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
                taxAmount: 0, totalAmount: 0, printDescription: '', totalSoQty: 0, givenSoQty: 0, remainingQty: 0
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
                taxAmount: 0, totalAmount: 0, printDescription: '', totalSoQty: 0, givenSoQty: 0, remainingQty: 0
            });
        }
        setItems(newItems);
    };

    const handleAddManualRow = () => {
        setItems([...items, {
            id: Date.now(), productId: null, productCode: '', productName: '', quantity: 0, rate: 0,
            uom: '', discountAmount: 0, discountPercent: 0, hsnCode: '', taxPercent: 0, beforeTaxAmount: 0,
            taxAmount: 0, totalAmount: 0, printDescription: '', totalSoQty: 0, givenSoQty: 0, remainingQty: 0
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
            <div className="flex items-center justify-between">
                <div className="relative max-w-[550px] w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('modules:search_by_anything', 'Search By Anything...')}
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
                                                <span>Price: <span className="text-emerald-700 font-black">₹{p.sale_rate || 0}</span></span>
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
            </div>

            {/* Items Table with Extra Selection Column */}
            <div className="overflow-x-auto border border-[#E5E7EB] rounded-[16px] shadow-sm bg-white custom-grn-scrollbar">
                <table className="w-full min-w-[1800px] border-collapse">
                    <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                            <th className="px-4 py-4 w-[50px] text-center text-[13px] font-bold text-[#4B5563]">#</th>
                            <th className="px-4 py-4 w-[60px] text-center text-[13px] font-bold text-[#4B5563] border-l border-[#F3F4F6]">Select</th>
                            <th className="px-4 py-4 w-[160px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:product_code', 'Product Code')}</th>
                            <th className="px-4 py-4 w-[350px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:product_name', 'Product Name')}</th>
                            <th className="px-4 py-4 w-[300px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:print_description', 'Print Description')}</th>
                            {isChallan && (
                                <>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:total_so_qty', 'total so qty')}</th>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:given_so_qty', 'given so qty')}</th>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:challan_qty', 'challan qty')}</th>
                                    <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:remaining_qty', 'remaining qty')}</th>
                                </>
                            )}
                            {!isChallan && (
                                <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">Qty</th>
                            )}
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:rate', 'Rate')}</th>
                            <th className="px-4 py-4 w-[120px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:uom', 'UOM')}</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:discount_rupee', 'Discount (₹)')}</th>
                            <th className="px-4 py-4 w-[120px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:discount_percent', 'Discount (%)')}</th>
                            <th className="px-4 py-4 w-[140px] text-left text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:hsn_code', 'HSN Code')}</th>
                            <th className="px-4 py-4 w-[110px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:tax_percent_col', 'Tax (%)')}</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:bef_tax_amount', 'Bef. Tax Amount')}</th>
                            <th className="px-4 py-4 w-[140px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:tax_amount', 'Tax Amount')}</th>
                            <th className="px-4 py-4 w-[150px] text-right text-[13px] font-bold text-[#6B7280] border-l border-[#F3F4F6]">{t('modules:amount', 'Amount')}</th>
                            <th className="px-4 py-4 w-[80px] text-center text-[13px] font-bold text-gray-500 border-l border-[#F3F4F6] sticky right-0 bg-white z-10">{t('common:action', 'Action')}</th>
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
                                        <input 
                                            type="text" 
                                            value={item.productCode} 
                                            readOnly={!!item.productId} 
                                            onFocus={() => { if (!item.productId) { setActiveRowIndex(index); setIsProductSearchOpen(true); } }}
                                            onChange={(e) => { setTableSearch(e.target.value); setActiveRowIndex(index); setIsProductSearchOpen(true); }}
                                            placeholder="Code..."
                                            className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold outline-none ${item.productId ? 'text-[#6B7280] cursor-not-allowed' : 'text-[#111827]'}`} 
                                        />
                                    </td>

                                    {/* Product Name */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6] relative">
                                        <input
                                            type="text"
                                            value={item.productName}
                                            readOnly={!!item.productId}
                                            onFocus={() => { if (!item.productId) { setActiveRowIndex(index); setIsProductSearchOpen(true); } }}
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

                                    {isChallan && (
                                        <>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <input
                                                    type="number"
                                                    value={item.totalSoQty || 0}
                                                    readOnly
                                                    className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-gray-500 outline-none cursor-not-allowed"
                                                />
                                            </td>
                                            <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                                <input type="number" min="0" value={item.givenSoQty || 0} readOnly className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] px-2 text-[13px] font-bold text-right text-gray-500 outline-none cursor-not-allowed" />
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
                                    {!isChallan && (
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
                                            readOnly={isSoSelected}
                                            className={`w-full h-[36px] border rounded-[8px] px-2 text-[13px] font-bold text-right outline-none transition-all shadow-sm ${isSoSelected ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-[#E5E7EB]' : 'bg-white text-[#111827] focus:border-[#073318] border-[#E5E7EB]'} ${errors?.itemErrors?.[index]?.rate ? 'border-red-500' : ''}`}
                                        />
                                    </td>

                                    {/* UOM */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input
                                            type="text"
                                            value={getStandardGstUom(item.uom)}
                                            readOnly={!!item.productId}
                                            onFocus={() => { if (!item.productId) { setActiveRowIndex(index); setIsProductSearchOpen(true); } }}
                                            placeholder="UOM"
                                            className={`w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold outline-none ${item.productId ? 'text-gray-500' : 'text-emerald-800'}`}
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
                                                readOnly={isSoSelected}
                                                className={`w-full h-[36px] border border-[#E5E7EB] rounded-[8px] pl-5 pr-2 text-[13px] font-bold text-right outline-none ${isSoSelected ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-[#111827] focus:border-[#073318]'}`}
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
                                                readOnly={isSoSelected}
                                                className={`w-full h-[36px] border border-[#E5E7EB] rounded-[8px] pr-5 pl-2 text-[13px] font-bold text-right outline-none ${isSoSelected ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-emerald-800 focus:border-[#073318]'}`}
                                            />
                                        </div>
                                    </td>

                                    {/* HSN Code */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <input 
                                            type="text" 
                                            value={item.hsnCode} 
                                            readOnly={!!item.productId} 
                                            onFocus={() => { if (!item.productId) { setActiveRowIndex(index); setIsProductSearchOpen(true); } }}
                                            placeholder={t('modules:hsn', 'HSN')}
                                            className="w-full h-[36px] bg-transparent border-none px-2 text-[13px] font-bold text-gray-500 outline-none" 
                                        />
                                    </td>

                                    {/* Tax % */}
                                    <td className="px-2 py-2 border-l border-[#F3F4F6]">
                                        <div className="relative">
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-800">%</span>
                                            <input
                                                type="number"
                                                value={item.taxPercent === 0 || item.taxPercent === '0' ? '0' : (item.taxPercent || '')}
                                                readOnly
                                                className="w-full h-[36px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[8px] pr-5 pl-2 text-[13px] font-black text-right text-emerald-800 outline-none cursor-not-allowed"
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
                                                className={`product-suggestion-row cursor-pointer transition-all duration-200 border-b border-white/10 ${selectedSuggestionIndex === pIdx ? '!bg-[#044e36] !text-white shadow-inner' : '!bg-[#07835B] hover:!bg-[#056d4b] !text-white'}`}
                                                onMouseEnter={() => setSelectedSuggestionIndex(pIdx)}
                                            >
                                                <td className="px-4 py-3 text-center">
                                                    {selectedSuggestionIndex === pIdx ? (
                                                        <div className="flex items-center justify-center">
                                                            <div className="w-2.5 h-2.5 bg-white rounded-full ring-4 ring-white/20"></div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-2 h-2 bg-white/30 rounded-full mx-auto"></div>
                                                    )}
                                                </td>
                                                <td colSpan={2} className="px-4 py-3 border-l border-white/10 font-mono text-[13px] font-black text-white">{p.product_code}</td>
                                                <td className="px-4 py-3 border-l border-white/10 font-black uppercase text-[14px] tracking-tight text-white">{p.product_name}</td>
                                                <td colSpan={11} className="px-4 py-3 border-l border-white/10 text-center italic text-[11px] font-bold text-white/90">
                                                    Select this product to add to the list
                                                </td>
                                                <td className="px-4 py-3 border-l border-white/10 text-right font-black text-white">₹{p.sale_rate || 0}</td>
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
                            {isChallan && (
                                <>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                    <td className="px-4 py-4 text-right text-[14px] font-black text-[#111827] border-l border-[#F3F4F6]">
                                        {items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border-l border-[#F3F4F6]"></td>
                                </>
                            )}
                            {!isChallan && (
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

export default ChallanTable;
