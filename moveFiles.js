const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'frontend', 'src', 'pages', 'dashboard', 'purchase');
const destPath = path.join(basePath, 'order');

const filesToMove = ['AddPO.jsx', 'PurchaseOrder.jsx', 'ViewPO.jsx', 'POPrintPreview.jsx'];

filesToMove.forEach(file => {
    const src = path.join(basePath, file);
    const dest = path.join(destPath, file);
    try {
        fs.renameSync(src, dest);
        console.log(`Moved ${file}`);
    } catch (e) {
        console.error(`Error moving ${file}:`, e.message);
    }
});
