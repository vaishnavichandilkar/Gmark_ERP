async function test() {
  const pincode = '590014';
  const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
