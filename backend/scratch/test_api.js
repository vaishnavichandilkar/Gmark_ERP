const axios = require('axios');
const FormData = require('form-data');

async function test() {
  try {
    // We'll just fetch next number or something to see if there's a 500.
    // Or maybe we can just query the nest logs?
    // Let's read the nest console output. The user is running 'npm run start:dev' in a terminal.
    // It's writing to stdout. Is there a way to get the last lines of the terminal? No.
    console.log("Cannot read terminal directly.");
  } catch(e) {
    console.log(e);
  }
}
test();
