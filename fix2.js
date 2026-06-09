const fs = require('fs');
const f1 = 'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/AddChallan.jsx';
const f2 = 'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/AddSalesInvoice.jsx';

[f1, f2].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/        const shouldCap = isSellerMsme \|\| isCustomerMsme;[\s\S]*?    \}, \[formData\.customer_id, formData\.credit_days, customers, isSellerMsme\]\);/,
`        if (isCustomerMsme && formData.credit_days) {
            const val = parseInt(formData.credit_days, 10);
            if (!isNaN(val) && val > 45) {
                setFormData(prev => ({ ...prev, credit_days: '45' }));
                toast.error(
                    "This customer is registered under MSME/Udyam with Registration Type Manufacturing/Service. As per MSME rules, maximum credit period allowed is 45 days. Credit Days has been adjusted to 45.",
                    { id: "msme-customer-warning" }
                );
            }
        }
    }, [formData.customer_id, formData.credit_days, customers]);`);
  fs.writeFileSync(f, c);
  console.log('Fixed', f);
});
