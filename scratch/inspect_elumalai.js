Promise.all([
  fetch('http://localhost:5001/api/shops', { headers: { 'x-tenant-id': 'GSK_AGENCY' } }).then(r => r.json()),
  fetch('http://localhost:5001/api/orders', { headers: { 'x-tenant-id': 'GSK_AGENCY' } }).then(r => r.json()),
  fetch('http://localhost:5001/api/payments', { headers: { 'x-tenant-id': 'GSK_AGENCY' } }).then(r => r.json()),
  fetch('http://localhost:5001/api/outstanding/history', { headers: { 'x-tenant-id': 'GSK_AGENCY' } }).then(r => r.json())
]).then(([shops, orders, payments, history]) => {
  const shop = shops.find(s => s.id === 's_1786952316529');
  console.log('--- SHOP INFO ---');
  console.log('Name:', shop.name_en, '/', shop.name_ta);
  console.log('Outstanding Amount on record:', shop.outstanding_amount);

  const shopOrders = orders.filter(o => o.shop_id === shop.id && o.status !== 'cancelled');
  console.log('\n--- ORDERS (' + shopOrders.length + ') ---');
  let totalOrderAmt = 0;
  shopOrders.forEach(o => {
    totalOrderAmt += Number(o.net_amount || 0);
    const orderPays = payments.filter(p => p.order_id === o.id);
    const paidForOrder = orderPays.reduce((sum, p) => sum + Number(p.collected_amount || 0), 0);
    console.log(o.invoice_number + ' | Date: ' + (o.order_date ? o.order_date.split('T')[0] : '') + ' | Net: ₹' + o.net_amount + ' | Paid linked: ₹' + paidForOrder + ' | Due: ₹' + (o.net_amount - paidForOrder) + ' | Status: ' + o.status);
  });
  console.log('Total Orders Net Amount: ₹' + totalOrderAmt);

  const shopPayments = payments.filter(p => p.shop_id === shop.id);
  console.log('\n--- PAYMENTS (' + shopPayments.length + ') ---');
  let totalPayments = 0;
  shopPayments.forEach(p => {
    totalPayments += Number(p.collected_amount || 0);
    console.log('Payment ID: ' + p.id + ' | Date: ' + (p.payment_date ? p.payment_date.split('T')[0] : '') + ' | Mode: ' + p.payment_mode + ' | Amount: ₹' + p.collected_amount + ' | Linked Order: ' + (p.order_id || '(Old Balance)'));
  });
  console.log('Total Payments Collected: ₹' + totalPayments);

  const shopHistory = history.filter(h => h.shop_id === shop.id);
  console.log('\n--- OUTSTANDING HISTORY ENTRIES (' + shopHistory.length + ') ---');
  shopHistory.forEach(h => {
    console.log('Date: ' + (h.date ? h.date.split('T')[0] : '') + ' | Change: ₹' + h.change_amount + ' | Balance: ₹' + h.balance_amount + ' | Desc: ' + h.description);
  });
}).catch(console.error);
