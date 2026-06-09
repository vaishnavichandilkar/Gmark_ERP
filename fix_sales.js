const fs = require('fs');

const files = [
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-order/AddSO.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/AddSalesInvoice.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/AddChallan.jsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  const oldBlock = `        const shouldCap = isSellerMsme || isCustomerMsme;

        if (shouldCap && formData.credit_days) {
            const val = parseInt(formData.credit_days, 10);
            if (!isNaN(val) && val > 45) {
                setFormData(prev => ({ ...prev, credit_days: '45' }));
                if (isSellerMsme) {
                    toast.error(
                        "As you are registered under MSME/Udyam with Registration Type Manufacturing/Service, the maximum credit period allowed for your customers is 45 days. Credit Days has been adjusted to 45.",
                        { id: "msme-customer-warning" }
                    );
                } else {
                    toast.error(
                        "This customer is registered under MSME/Udyam with Registration Type Manufacturing/Service. As per MSME rules, maximum credit period allowed is 45 days. Credit Days has been adjusted to 45.",
                        { id: "msme-customer-warning" }
                    );
                }
            }
        }
    }, [formData.customer_id, formData.credit_days, customers, isSellerMsme]);`;

  const newBlock = `        if (isCustomerMsme && formData.credit_days) {
            const val = parseInt(formData.credit_days, 10);
            if (!isNaN(val) && val > 45) {
                setFormData(prev => ({ ...prev, credit_days: '45' }));
                toast.error(
                    "This customer is registered under MSME/Udyam with Registration Type Manufacturing/Service. As per MSME rules, maximum credit period allowed is 45 days. Credit Days has been adjusted to 45.",
                    { id: "msme-customer-warning" }
                );
            }
        }
    }, [formData.customer_id, formData.credit_days, customers]);`;

  content = content.replace(oldBlock, newBlock);

  // We can also remove isSellerMsme definition if we want, but it might be used elsewhere.
  // Let's just do the replace.

  fs.writeFileSync(f, content);
  console.log("Updated", f);
});
