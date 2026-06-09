const fs = require('fs');

const files = [
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-order/AddSO.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/AddSalesInvoice.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/AddChallan.jsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  // We need to find the customer Msme logic and add isSellerMsme checking.
  // First, let's restore isSellerMsme inside the useEffect dependencies if we removed it.
  
  // Replace the capping condition:
  const oldBlock = `        if (isCustomerMsme && formData.credit_days) {
            const val = parseInt(formData.credit_days, 10);
            if (!isNaN(val) && val > 45) {
                setFormData(prev => ({ ...prev, credit_days: '45' }));
                toast.error(
                    "This customer is registered under MSME/Udyam with Registration Type Manufacturing/Service. As per MSME rules, maximum credit period allowed is 45 days. Credit Days has been adjusted to 45.",
                    { id: "msme-customer-warning" }
                );
            }
        }`;

  const newBlock = `        if (isSellerMsme && isCustomerMsme && formData.credit_days) {
            const val = parseInt(formData.credit_days, 10);
            if (!isNaN(val) && val > 45) {
                setFormData(prev => ({ ...prev, credit_days: '45' }));
                toast.error(
                    "As you and this customer are both registered under MSME/Udyam (Manufacturing/Service), maximum credit period allowed is 45 days. Credit Days has been adjusted.",
                    { id: "msme-customer-warning" }
                );
            }
        }`;

  content = content.replace(oldBlock, newBlock);

  // We also need to add isSellerMsme into the component if we removed it!
  // Wait, I DID NOT remove isSellerMsme definition from those files because I only replaced the condition.
  // Let's make sure it's in the dependency array
  content = content.replace(/    \}, \[formData\.customer_id, formData\.credit_days, customers\]\);/,
    `    }, [formData.customer_id, formData.credit_days, customers, isSellerMsme]);`);

  fs.writeFileSync(f, content);
  console.log("Updated", f);
});
