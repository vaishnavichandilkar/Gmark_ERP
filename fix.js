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
  let lines = fs.readFileSync(f, 'utf8').split('\n');
  let changed = false;
  for(let i=0; i<lines.length; i++) {
    if(lines[i].includes('regType === "Manufacturing"') && lines[i].includes('regType === "Service"') && !lines[i].includes('Manufacturing/Service')) {
      const match = lines[i].match(/(\w+)\.regType === "Manufacturing"/);
      if (match) {
        const obj = match[1];
        lines[i] = lines[i].replace('regType === "Service"', 'regType === "Service" || ' + obj + '.regType === "Manufacturing/Service"');
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(f, lines.join('\n'));
    console.log('Fixed ' + f);
  }
});
