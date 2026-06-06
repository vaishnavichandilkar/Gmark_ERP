const fs = require('fs');
const path = require('path');
const ExcelJS = require('d:/USERS/vaishnavi/Desktop/weighting_scale/backend/node_modules/exceljs');

async function createTemplate(tabName, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(tabName);

    // Enable grid lines and freeze first row (header row)
    worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: true }];

    // Set columns with headers
    worksheet.columns = [
        { header: 'Date (DD/MM/YYYY)', key: 'date', width: 22 },
        { header: 'Account Name', key: 'accountName', width: 35 },
        { header: 'Bank/Cash Account', key: 'bankCashAccount', width: 35 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Payment Mode', key: 'paymentMode', width: 20 },
        { header: 'Narration', key: 'narration', width: 40 }
    ];

    // Style headers to match Account Master template
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' } // Light gray header
    };

    // Format first column (Date) explicitly as text to preserve DD/MM/YYYY formatting, and add prompt/validation
    for (let r = 2; r <= 200; r++) {
        const dateCell = worksheet.getCell(`A${r}`);
        dateCell.numFmt = '@'; // Treat as text
        dateCell.dataValidation = {
            type: 'textLength',
            allowBlank: true,
            operator: 'greaterThan',
            formulae: [0],
            showInputMessage: true,
            promptTitle: 'Date Format Required',
            prompt: 'Enter date as DD/MM/YYYY\nFormat: Day/Month/Year\nExample: 05/06/2026'
        };

        const payCell = worksheet.getCell(`E${r}`);
        payCell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"DEBIT_CARD,CREDIT_CARD,NET_BANKING,CHEQUE,UPI,CASH"'],
            showInputMessage: true,
            promptTitle: 'Select Payment Mode',
            prompt: 'Choose one of:\nDEBIT_CARD,\nCREDIT_CARD,\nNET_BANKING, CHEQUE,\nUPI, CASH'
        };
    }

    const outputPath = path.join('d:/USERS/vaishnavi/Desktop/weighting_scale/frontend/public', filename);
    
    // Ensure directories exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    await workbook.xlsx.writeFile(outputPath);
    console.log(`Template generated successfully at: ${outputPath}`);
}

async function main() {
    // 1. Generate Receipts Template
    await createTemplate('Receipts Template', 'Bank_Reconciliation_Receipt_Template.xlsx');
    
    // 2. Generate Payments Template
    await createTemplate('Payments Template', 'Bank_Reconciliation_Payment_Template.xlsx');
}

main().catch(err => {
    console.error('Error generating templates:', err);
    process.exit(1);
});
