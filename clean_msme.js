const fs = require('fs');

const files = [
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-order/AddSO.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/invoice/AddSalesInvoice.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/sales/Sales-invoice/challan/AddChallan.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-order/AddPO.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/grn/AddGRN.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/purchase/purchase-invoice/invoice/AddPurchaseInvoice.jsx',
  'D:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/masters/components/AddAccount.jsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/ \|\| \w+\.regType === "Manufacturing\/Service"/g, '');
  // for AddAccount.jsx which might have formData.regType
  content = content.replace(/ \|\| formData\.regType === "Manufacturing\/Service"/g, '');
  fs.writeFileSync(f, content);
  console.log("Cleaned", f);
});
