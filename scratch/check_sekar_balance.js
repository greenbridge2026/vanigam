async function checkSekarBalance() {
  const shopId = 's_1785742146163_import_22';
  const resS = await fetch('http://localhost:5001/api/shops', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const shops = await resS.json();
  const shop = shops.find(s => s.id === shopId);
  console.log('Shop Sekar Tea Stall:', {
    id: shop.id,
    name: shop.name_en,
    outstanding_amount: shop.outstanding_amount
  });

  const resP = await fetch('http://localhost:5001/api/payments', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const payments = await resP.json();
  const inv1505Pays = payments.filter(p => p.order_id === 'ord_1793168563999');
  console.log('Payments attached to INV-1505:', inv1505Pays);
}

checkSekarBalance();
