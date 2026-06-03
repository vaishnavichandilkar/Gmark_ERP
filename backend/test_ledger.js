async function test() {
    const res = await fetch('http://localhost:3000/api/v1/ledger/detailed/9?startDate=&endDate=&page=1&limit=50', {
        headers: { 'user-id': '2' }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.ledgerItems, null, 2));
}
test();
