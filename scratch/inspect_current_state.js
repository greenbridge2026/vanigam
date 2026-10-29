async function inspect() {
  const resO = await fetch('http://localhost:5001/api/orders', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const orders = await resO.json();
  const resD = await fetch('http://localhost:5001/api/deliveries', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const deliveries = await resD.json();

  const o1505 = orders.find(o => o.invoice_number === 'INV-1505');
  console.log('Order INV-1505:', {
    id: o1505.id,
    invoice_number: o1505.invoice_number,
    status: o1505.status,
    order_date: o1505.order_date,
    delivery_date: o1505.delivery_date
  });

  const d1505 = deliveries.filter(d => d.order_id === o1505.id);
  console.log('Deliveries for INV-1505:', d1505);

  // Check if there are other deliveries with this id or order_id
  const matchingDels = deliveries.filter(d => d.id === 'del_1793168563999' || d.order_id === 'ord_1793168563999');
  console.log('Matching dels by id or order_id:', matchingDels);

  // Check how many orders are delivered vs pending
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  console.log(`Total orders: ${orders.length}, Delivered: ${deliveredOrders.length}, Pending: ${pendingOrders.length}`);

  // Check deliveries count
  const deliveredDels = deliveries.filter(d => d.status === 'delivered');
  const pendingDels = deliveries.filter(d => d.status === 'pending');
  console.log(`Total deliveries: ${deliveries.length}, Delivered: ${deliveredDels.length}, Pending: ${pendingDels.length}`);
}

inspect();
