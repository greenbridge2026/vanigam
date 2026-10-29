async function removeDuplicates() {
  const tid = 'GSK_AGENCY';
  const resD = await fetch('http://localhost:5001/api/deliveries', { headers: { 'x-tenant-id': tid } });
  
  // We can call delete endpoint or update via internal DB
  // Let's check if there is a delete payment endpoint
  const resP = await fetch('http://localhost:5001/api/payments', { headers: { 'x-tenant-id': tid } });
  const payments = await resP.json();

  const toRemove = ['pay_1793253327853_0', 'pay_1793253347708_0'];
  for (const pid of toRemove) {
    const resDel = await fetch(`http://localhost:5001/api/payments/${pid}`, {
      method: 'DELETE',
      headers: { 'x-tenant-id': tid }
    });
    console.log(`Deleted ${pid}: status ${resDel.status}`);
  }
}

removeDuplicates();
