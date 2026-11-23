(async () => {
  const tid = 'GSK_AGENCY';
  const headers = { 'x-tenant-id': tid };
  
  const resOrders = await fetch('http://127.0.0.1:5001/api/orders', { headers });
  const orders = await resOrders.json();
  const resShops = await fetch('http://127.0.0.1:5001/api/shops', { headers });
  const shops = await resShops.json();

  console.log('Total orders from API:', orders.length);
  const targetInvoices = ['INV-1598', 'INV-1599', 'INV-1600', 'INV-1601', 'INV-1602', 'INV-1603'];
  orders.filter(o => targetInvoices.includes(o.invoice_number)).forEach(o => {
    const shop = shops.find(s => s.id === o.shop_id);
    console.log(o.invoice_number + ' | Shop: ' + (shop ? shop.name_en : o.shop_id) + ' | Total: ₹' + o.total_amount + ' | Net: ₹' + o.net_amount + ' | Status: ' + o.status + ' | Order ID: ' + o.id);
  });

  // Check Rafik Maligai order items
  const rafikOrder = orders.find(o => o.invoice_number === 'INV-1601');
  if (rafikOrder) {
    const resRafik = await fetch('http://127.0.0.1:5001/api/orders/' + rafikOrder.id, { headers });
    const rafikData = await resRafik.json();
    console.log('Rafik order items count:', (rafikData.items || []).length);
    (rafikData.items || []).forEach(it => {
      console.log('  Item: ' + it.product_id + ' | cases: ' + it.cases + ' | rate: ₹' + it.rate + ' | amount: ₹' + it.amount);
    });
  }

  // Check Deliveries
  const resDel = await fetch('http://127.0.0.1:5001/api/deliveries', { headers });
  const deliveries = await resDel.json();
  const recentDels = deliveries.filter(d => ['ord_1795417148861', 'ord_1795417150000', 'ord_1795417175048', 'ord_1795417378655'].includes(d.order_id));
  console.log('Recent deliveries count:', recentDels.length);
  recentDels.forEach(d => {
    const ord = orders.find(o => o.id === d.order_id);
    const shop = shops.find(s => s.id === ord?.shop_id);
    console.log('  Delivery for ' + (ord?.invoice_number || d.order_id) + ' (' + (shop?.name_en || '') + '): status=' + d.status);
  });
})();

