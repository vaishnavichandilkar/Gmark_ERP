const fs = require('fs');
const path = require('path');

const enNew = {
  "sales": "Sales",
  "salesDescription": "Create and monitor sales orders, customer invoices, and stock procurement activities.",
  "salesOrder": "Sales Order",
  "salesInvoice": "Sales Invoice",
  "invoice": "Invoice",
  "challan": "Challan",
  "addSI": "Add SI",
  "searchByAnything": "Search by anything",
  "import": "Import",
  "export": "Export",
  "invoiceNo": "Invoice No",
  "customerName": "Customer Name",
  "customerType": "Customer Type",
  "bookingDate": "Booking Date",
  "invoiceDate": "Invoice Date",
  "challanDate": "Challan Date",
  "challanNo": "Challan No",
  "soNo": "SO No"
};

const hiNew = {
  "sales": "बिक्री",
  "salesDescription": "बिक्री आदेश, ग्राहक चालान और स्टॉक गतिविधियों का प्रबंधन करें।",
  "salesOrder": "बिक्री आदेश",
  "salesInvoice": "बिक्री चालान",
  "invoice": "चालान",
  "challan": "चालान",
  "addSI": "नया चालान जोड़ें",
  "searchByAnything": "कुछ भी खोजें",
  "import": "इम्पोर्ट",
  "export": "एक्सपोर्ट",
  "invoiceNo": "चालान संख्या",
  "customerName": "ग्राहक का नाम",
  "customerType": "ग्राहक प्रकार",
  "bookingDate": "बुकिंग तिथि",
  "invoiceDate": "चालान तिथि",
  "challanDate": "चालान तिथि",
  "challanNo": "चालान संख्या",
  "soNo": "SO संख्या"
};

const mrNew = {
  "sales": "विक्री",
  "salesDescription": "विक्री ऑर्डर, ग्राहक चलन आणि स्टॉक क्रियाकलाप व्यवस्थापित करा.",
  "salesOrder": "विक्री ऑर्डर",
  "salesInvoice": "विक्री चलन",
  "invoice": "चलन",
  "challan": "चलन",
  "addSI": "चलन जोडा",
  "searchByAnything": "काहीही शोधा",
  "import": "आयात करा",
  "export": "निर्यात करा",
  "invoiceNo": "चलन क्रमांक",
  "customerName": "ग्राहक नाव",
  "customerType": "ग्राहक प्रकार",
  "bookingDate": "बुकिंग तारीख",
  "invoiceDate": "चलन तारीख",
  "challanDate": "चालान तारीख",
  "challanNo": "चलन क्रमांक",
  "soNo": "SO क्रमांक"
};

function updateLocales(lang, newObj) {
    const p = path.join(__dirname, `src/i18n/locales/${lang}/modules.json`);
    if(fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        Object.assign(data, newObj);
        fs.writeFileSync(p, JSON.stringify(data, null, 4));
        console.log(`Updated ${lang} locales`);
    } else {
        console.log(`File not found: ${p}`);
    }
}

updateLocales('en', enNew);
updateLocales('hi', hiNew);
updateLocales('mr', mrNew);
