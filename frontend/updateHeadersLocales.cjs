const fs = require('fs');
const path = require('path');

const enNew = {
  "taxableAmount": "Taxable Amount",
  "taxAmount": "Tax Amount",
  "grossAmount": "Gross Amount",
  "status": "Status",
  "action": "Action",
  "show": "Show",
  "perPage": "per page",
  "paginationRange": "{{from}}-{{to}} of {{total}}",
  "pending": "Pending",
  "completed": "Completed",
  "expiringSoon": "Expiring Soon",
  "expired": "Expired",
  "deleted": "Deleted"
};

const hiNew = {
  "taxableAmount": "कर योग्य राशि",
  "taxAmount": "कर राशि",
  "grossAmount": "कुल राशि",
  "status": "स्थिति",
  "action": "कार्रवाई",
  "show": "दिखाएँ",
  "perPage": "प्रति पेज",
  "paginationRange": "{{from}}-{{to}} / {{total}}",
  "pending": "लंबित",
  "completed": "पूर्ण",
  "expiringSoon": "जल्द समाप्त",
  "expired": "समाप्त",
  "deleted": "हटाया गया"
};

const mrNew = {
  "taxableAmount": "करपात्र रक्कम",
  "taxAmount": "कर रक्कम",
  "grossAmount": "एकूण रक्कम",
  "status": "स्थिती",
  "action": "क्रिया",
  "show": "दाखवा",
  "perPage": "प्रति पृष्ठ",
  "paginationRange": "{{from}}-{{to}} पैकी {{total}}",
  "pending": "प्रलंबित",
  "completed": "पूर्ण",
  "expiringSoon": "लवकरच समाप्त",
  "expired": "समाप्त",
  "deleted": "हटवले"
};

function updateLocales(lang, newObj) {
    const p = path.join(__dirname, `src/i18n/locales/${lang}/modules.json`);
    if(fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        Object.assign(data, newObj);
        fs.writeFileSync(p, JSON.stringify(data, null, 4));
        console.log(`Updated ${lang} locales`);
    } else {
        console.log(`Failed to update ${lang} locales`);
    }
}

updateLocales('en', enNew);
updateLocales('hi', hiNew);
updateLocales('mr', mrNew);
