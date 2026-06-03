async function main() {
  try {
    const res = await fetch('http://localhost:3000/api/v1/ledger/9?startDate=2026-04-01&endDate=2027-03-31&type=Sundry%20Creditors&page=1&limit=14');
    const data = await res.json();
    console.dir(data, { depth: null });
  } catch(e: any) {
    console.log(e.message);
  }
}
main();
