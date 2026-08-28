import fetch from 'node-fetch';

async function testDeliveryComplete() {
  const resDevs = await fetch('http://localhost:5001/api/deliveries', {
    headers: { 'x-tenant-id': 'TEST_1' }
  });
  const deliveries = await resDevs.json();
  console.log(`Fetched ${deliveries.length} deliveries.`);

  if (deliveries.length > 0) {
    const target = deliveries[0];
    console.log(`Testing complete endpoint for delivery ID: ${target.id}`);
    const res = await fetch(`http://localhost:5001/api/deliveries/${target.id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'TEST_1'
      },
      body: JSON.stringify({
        status: 'delivered',
        remarks: 'Delivered test'
      })
    });
    console.log(`HTTP Status: ${res.status}`);
    const body = await res.json();
    console.log('Response Body:', body);
  }
}

testDeliveryComplete().catch(console.error);
