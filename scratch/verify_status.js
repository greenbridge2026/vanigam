(async () => {
  const headers = { 'x-tenant-id': 'GSK_AGENCY' };
  const resOrders = await fetch('http://127.0.0.1:5001/api/orders', { headers });
  const orders = await resOrders.json();
  const resShops = await fetch('http://127.0.0.1:5001/api/shops', { headers });
  const shops = await resShops.json();

  console.log('Total orders:', orders.length);
  const targetInvoices = ['INV-1599', 'INV-1600', 'INV-1601', 'INV-1602', 'INV-1603'];
  orders.filter(o => targetInvoices.includes(o.invoice_number)).forEach(o => {
    const shop = shops.find(s => s.id === o.shop_id);
    console.log(`${o.invoice_number} | Shop: ${shop ? shop.name_en : o.shop_id} | Total: ₹${o.total_amount} | Net: ₹${o.net_amount} | Status: ${o.status} | ID: ${o.id}`);
  });

  const resDel = await fetch('http://127.0.0.1:5001/api/deliveries', { headers });
  const dels = await resDel.json();
  console.log('Total deliveries:', dels.length);
  const relDels = dels.filter(d => ['ord_1795417148861', 'ord_1795417150000', 'ord_1795417175048', 'ord_1795417378655'].includes(d.order_id));
  console.log('Target deliveries:', relDels.map(d => ({ id: d.id, order_id: d.order_id, status: d.status })));
})();

