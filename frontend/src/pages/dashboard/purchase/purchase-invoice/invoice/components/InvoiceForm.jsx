import SupplierDropdown from '../../shared/SupplierDropdown';

const InvoiceForm = ({ formData, setFormData, handleSupplierChange, handlePOChange, suppliers, pos }) => {
    const [supplierSearch, setSupplierSearch] = React.useState(formData.supplier_name || '');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = React.useState(false);

    // Sync supplier search if form data gets updated remotely
    React.useEffect(() => {
        setSupplierSearch(formData.supplier_name || '');
    }, [formData.supplier_name]);

    return (
        <div className="bg-white rounded-[24px] border border-[#E5E7EB] shadow-sm p-8 mb-8 font-outfit">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-[#073318] rounded-full" />
                <h2 className="text-[18px] font-bold text-[#111827]">Supplier Details</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                <div className="space-y-2 lg:col-span-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Supplier Name <span className="text-red-500">*</span></label>
                    <SupplierDropdown 
                        suppliers={suppliers}
                        supplierSearch={supplierSearch}
                        setSupplierSearch={setSupplierSearch}
                        isSupplierDropdownOpen={isSupplierDropdownOpen}
                        setIsSupplierDropdownOpen={setIsSupplierDropdownOpen}
                        handleSelectSupplier={(supplier) => handleSupplierChange(supplier.accountName)}
                        errors={{}}
                    />
                </div>

                <div className="space-y-2 lg:col-span-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Address</label>
                    <input
                        type="text"
                        placeholder="Auto-filled from supplier"
                        value={formData.address || ''}
                        readOnly
                        className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Credit Days</label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Auto-filled from supplier"
                        value={formData.credit_days === 0 ? '' : formData.credit_days}
                        onChange={(e) => setFormData({ ...formData, credit_days: parseInt(e.target.value) || 0 })}
                        className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">GST Number</label>
                    <input
                        type="text"
                        placeholder="Auto-filled from supplier"
                        value={formData.gst_no || ''}
                        readOnly
                        className="w-full h-[48px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none cursor-not-allowed"
                    />
                </div>

                {/* PO Number */}
                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">PO Number (Optional)</label>
                    <select 
                        className="w-full px-5 py-3 bg-gray-50/50 border border-transparent rounded-2xl focus:ring-2 focus:ring-[#073318]/10 focus:border-[#073318]/30 transition-all font-medium text-gray-700 h-[48px]"
                        value={formData.po_number || ""}
                        onChange={(e) => handlePOChange(e.target.value)}
                    >
                        <option value="">Select PO</option>
                        {pos.map(p => <option key={p.id} value={p.poNumber}>{p.poNumber}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Booking Date <span className="text-red-500">*</span></label>
                    <input
                        type="date"
                        value={formData.booking_date}
                        onChange={(e) => setFormData({ ...formData, booking_date: e.target.value })}
                        className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Supplier Invoice No. <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        placeholder="Enter physical invoice no"
                        value={formData.supplier_invoice_number || ''}
                        onChange={(e) => setFormData({ ...formData, supplier_invoice_number: e.target.value })}
                        className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[14px] font-semibold text-[#374151]">Supplier Invoice Date <span className="text-red-500">*</span></label>
                    <input
                        type="date"
                        value={formData.supplier_invoice_date || ''}
                        onChange={(e) => setFormData({ ...formData, supplier_invoice_date: e.target.value })}
                        className="w-full h-[48px] bg-white border border-[#E5E7EB] rounded-[10px] px-4 text-[14px] outline-none focus:border-[#073318]"
                    />
                </div>
            </div>
        </div>
    );
};

export default InvoiceForm;
