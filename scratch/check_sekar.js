async function checkSekar() {
  const shopId = 's_1785742146163_import_22';
  const resO = await fetch('http://localhost:5001/api/orders', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const orders = await resO.json();
  const resD = await fetch('http://localhost:5001/api/deliveries', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const deliveries = await resD.json();
  const resP = await fetch('http://localhost:5001/api/payments', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const payments = await resP.json();

  const sekarOrders = orders.filter(o => o.shop_id === shopId);
  console.log(`Sekar Tea Stall has ${sekarOrders.length} orders:`);
  for (const o of sekarOrders) {
    const d = deliveries.find(del => del.order_id === o.id);
    const p = payments.filter(pay => pay.order_id === o.id);
    console.log(`- Order: ${o.invoice_number} (${o.id}), Date: ${o.order_date?.split('T')[0]}, Status: ${o.status}, Amount: ${o.net_amount}`);
    console.log(`  Delivery: ${d?.id}, Status: ${d?.status}`);
    console.log(`  Payments (${p.length}):`, p.map(x => `₹${x.collected_amount} on ${x.payment_date?.split('T')[0]}`));
  }
}

checkSekar();
