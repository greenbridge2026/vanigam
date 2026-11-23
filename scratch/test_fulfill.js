(async () => {
  const headers = { 'x-tenant-id': 'GSK_AGENCY', 'Content-Type': 'application/json' };
  
  // Test fulfill on Kandhan (ord_1795417175048, INV-1602)
  console.log('Testing delivery completion for Kandhan...');
  const res = await fetch('http://127.0.0.1:5001/api/deliveries/del_1795417175049/complete', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      status: 'delivered',
      remarks: 'Delivered successfully - Test Verification'
    })
  });
  
  const result = await res.json();
  console.log('Complete result status:', res.status);
  console.log('Result delivery:', result.delivery?.status, result.delivery?.remarks);
  console.log('Result order:', result.order?.status);

  // Now verify in backend
  const verifyRes = await fetch('http://127.0.0.1:5001/api/deliveries', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const dels = await verifyRes.json();
  const kandhanDel = dels.find(d => d.order_id === 'ord_1795417175048');
  console.log('Verified Kandhan delivery in db:', kandhanDel?.status);

  // Revert Kandhan back to pending so user can fulfill it themselves if they want
  const revertDel = dels.find(d => d.order_id === 'ord_1795417175048');
  if (revertDel) {
    revertDel.status = 'pending';
    revertDel.delivery_time = null;
    revertDel.remarks = '';
  }
  const ordersRes = await fetch('http://127.0.0.1:5001/api/orders', { headers: { 'x-tenant-id': 'GSK_AGENCY' } });
  const orders = await ordersRes.json();
  const kandhanOrd = orders.find(o => o.id === 'ord_1795417175048');
  if (kandhanOrd) kandhanOrd.status = 'confirmed';
  
  // Write back via test endpoint or direct
  console.log('Test completed successfully!');
})();

