async function measure() {
  const endpoints = [
    '/api/routes',
    '/api/shops',
    '/api/products',
    '/api/orders',
    '/api/orders/items',
    '/api/deliveries',
    '/api/stock/ledger'
  ];

  console.log('--- Measuring API Latency ---');
  for (const ep of endpoints) {
    const start = performance.now();
    const res = await fetch(`http://localhost:5001${ep}`, {
      headers: { 'x-tenant-id': 'GSK_AGENCY' }
    });
    const data = await res.json();
    const elapsed = (performance.now() - start).toFixed(1);
    console.log(`${ep.padEnd(25)} -> ${elapsed.padStart(6)} ms (count: ${Array.isArray(data) ? data.length : 'obj'})`);
  }
}

measure().catch(console.error);
