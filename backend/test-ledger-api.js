const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/v1/ledger/creditors');
    console.log('Creditors:', res.data);
  } catch (e) {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
  }
}

test();
