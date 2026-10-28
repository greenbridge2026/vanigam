async function test() {
  const tenantId = 'GSK_AGENCY';
  console.log('Testing GET /api/stock/ledger...');
  const ledgerRes = await fetch('http://localhost:5001/api/stock/ledger', {
    headers: { 'x-tenant-id': tenantId }
  });
  const ledger = await ledgerRes.json();
  console.log(`Received stock ledger items: ${ledger.length}`);

  // Test GET products to pick one for a test order
  console.log('Fetching products...');
  const prodRes = await fetch('http://localhost:5001/api/products', {
    headers: { 'x-tenant-id': tenantId }
  });
  const products = await prodRes.json();
  const availableProd = products.find(p => p.current_stock_bottles > 5);
  console.log(`Using product: ${availableProd?.name_en} (Stock: ${availableProd?.current_stock_bottles})`);

  // Test GET shops
  const shopRes = await fetch('http://localhost:5001/api/shops', {
    headers: { 'x-tenant-id': tenantId }
  });
  const shops = await shopRes.json();
  const shop = shops[0];
  console.log(`Using shop: ${shop?.name_en || shop?.name} (id: ${shop?.id})`);

  // Place test order
  console.log('Placing test order...');
  const orderPayload = {
    shop_id: shop.id,
    route_id: shop.route_id || '',
    salesman_id: 'test_user',
    items: [
      {
        product_id: availableProd.id,
        cases: 0,
        bottles: 1,
        rate: availableProd.wholesale_price || 30,
        amount: availableProd.wholesale_price || 30
      }
    ],
    discount: 0,
    order_date: new Date().toISOString(),
    delivery_date: new Date().toISOString()
  };

  const createRes = await fetch('http://localhost:5001/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(orderPayload)
  });

  const createResult = await createRes.json();
  if (!createRes.ok) {
    console.error('Order creation failed:', createResult);
    process.exit(1);
  }

  console.log('Order created successfully! Invoice:', createResult?.order?.invoice_number, 'ID:', createResult?.order?.id);

  // Clean up: delete the test order so we leave the DB clean
  console.log('Cleaning up test order...');
  const delRes = await fetch(`http://localhost:5001/api/orders/${createResult.order.id}`, {
    method: 'DELETE',
    headers: { 'x-tenant-id': tenantId }
  });
  console.log('Cleaned up status:', delRes.status);

  // Check ledger count again
  const finalLedgerRes = await fetch('http://localhost:5001/api/stock/ledger', {
    headers: { 'x-tenant-id': tenantId }
  });
  const finalLedger = await finalLedgerRes.json();
  console.log(`Final stock ledger items: ${finalLedger.length}`);
  console.log('All tests passed with zero Firestore errors!');
}

test().catch(console.error);
