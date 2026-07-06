const payload = {
  name: "Asif",
  mobile: "7299119880",
  role: "salesman",
  username: "asif123",
  password: "123",
  active: true
};

fetch('http://localhost:5001/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(async res => {
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', data);
})
.catch(err => {
  console.error('Error:', err);
});
