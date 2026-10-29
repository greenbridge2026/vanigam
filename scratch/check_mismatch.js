async function checkMismatch() {
  const resO = await fetch('http://localhost:5001/api/orders', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const orders = await resO.json();
  const resD = await fetch('http://localhost:5001/api/deliveries', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const deliveries = await resD.json();

  console.log('--- Deliveries that are pending ---');
  const pendingDels = deliveries.filter(d => d.status === 'pending');
  for (const d of pendingDels) {
    const o = orders.find(ord => ord.id === d.order_id);
    console.log(`Del ID: ${d.id}, Order ID: ${d.order_id}, Del Status: ${d.status}, Order Status: ${o?.status}, Inv: ${o?.invoice_number}`);
  }

  console.log('\n--- Orders that are pending ---');
  const pendingOrds = orders.filter(o => o.status === 'pending');
  for (const o of pendingOrds) {
    const d = deliveries.find(del => del.order_id === o.id);
    console.log(`Order ID: ${o.id}, Inv: ${o.invoice_number}, Order Status: ${o.status}, Del Status: ${d?.status}`);
  }
}

checkMismatch();
