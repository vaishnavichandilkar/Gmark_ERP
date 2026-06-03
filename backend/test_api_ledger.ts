import axios from 'axios';

async function main() {
  try {
    const res = await axios.get('http://localhost:3000/api/v1/ledger/9?startDate=2026-04-01&endDate=2027-03-31&type=Sundry%20Creditors&page=1&limit=14');
    console.dir(res.data.items.find(i => i.invoiceNumber === '6767'), { depth: null });
  } catch(e) {
    console.log(e.message);
  }
}
main();
