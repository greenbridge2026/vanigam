async function check() {
  const tenants = ['GSK_AGENCY', 'TEST_1', 'default'];
  for (const tid of tenants) {
    try {
      const res = await fetch('http://localhost:5001/api/orders', {
        headers: { 'x-tenant-id': tid }
      });
      const orders = await res.json();
      console.log(`Tenant ${tid}: ${orders.length} orders`);
      const o = orders.find(x => x.invoice_number === 'INV-1505');
      if (o) {
        console.log(`\n=== Found INV-1505 in tenant ${tid} ===`);
        console.log('Order:', o);
        const resD = await fetch('http://localhost:5001/api/deliveries', {
          headers: { 'x-tenant-id': tid }
        });
        const dels = await resD.json();
        const d = dels.find(x => x.order_id === o.id);
        console.log('Delivery:', d);

        const resP = await fetch('http://localhost:5001/api/payments', {
          headers: { 'x-tenant-id': tid }
        });
        const pays = await resP.json();
        console.log('Order Payments:', pays.filter(p => p.order_id === o.id));
        console.log('Shop Payments:', pays.filter(p => p.shop_id === o.shop_id));

        const resS = await fetch('http://localhost:5001/api/shops', {
          headers: { 'x-tenant-id': tid }
        });
        const shops = await resS.json();
        const s = shops.find(x => x.id === o.shop_id);
        console.log('Shop:', s);
      }
    } catch (e) {
      console.error(`Error for tenant ${tid}:`, e.message);
    }
  }
}

check();
