const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, 'frontend', 'src', 'pages', 'dashboard', 'purchase');
const destPath = path.join(basePath, 'order');

const filesToMove = ['AddPO.jsx', 'PurchaseOrder.jsx', 'ViewPO.jsx', 'POPrintPreview.jsx'];

let log = '';
try {
    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
        log += `Created directory: ${destPath}\n`;
    }

    filesToMove.forEach(file => {
        const src = path.join(basePath, file);
        const dest = path.join(destPath, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
            log += `Successfully moved ${file}\n`;
        } else {
            log += `Source file not found: ${src}\n`;
        }
    });

} catch (e) {
    log += `Error: ${e.message}\n`;
}

fs.writeFileSync(path.join(__dirname, 'log.txt'), log);
