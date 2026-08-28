import fetch from 'node-fetch';

async function testLogin() {
  const res = await fetch('http://localhost:5001/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'TEST_1',
      username: 'admin',
      password: '123'
    })
  });
  console.log(`HTTP Status: ${res.status}`);
  const data = await res.json();
  console.log('Response:', data);
}

testLogin().catch(console.error);
