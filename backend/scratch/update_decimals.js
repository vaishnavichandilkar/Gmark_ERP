const fs = require('fs');

const files = [
    'd:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/finance/LedgerView.jsx',
    'd:/USERS/vaishnavi/Desktop/weighting_scale/frontend/src/pages/dashboard/finance/Finance.jsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace toLocaleString('en-IN', { minimumFractionDigits: 2 }) with both min and max
    content = content.replace(/toLocaleString\('en-IN',\s*\{\s*minimumFractionDigits:\s*2\s*\}\)/g, "toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");

    // Replace toLocaleString('en-IN') with both min and max
    content = content.replace(/toLocaleString\('en-IN'\)/g, "toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");

    // Replace toLocaleString() with both min and max (be careful not to match toLocaleDateString)
    content = content.replace(/\.toLocaleString\(\)/g, ".toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
});
