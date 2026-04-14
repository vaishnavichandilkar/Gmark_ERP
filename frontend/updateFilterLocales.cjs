const fs = require('fs');
const path = require('path');

const enNew = {
  "filter": "Filter"
};

const hiNew = {
  "filter": "फ़िल्टर"
};

const mrNew = {
  "filter": "फिल्टर"
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
