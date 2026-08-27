// Helper utility to calculate order payment information including direct & unassigned payments

export function calculateOrderPaymentInfo(order, shop, allShopOrders, allPayments) {
  if (!order) {
    return { netAmount: 0, directPaid: 0, unassignedAllocated: 0, totalPaid: 0, remainingDue: 0 };
  }

  const netAmount = Number(order.net_amount || 0);

  // 1. Direct payments explicitly linked to this order
  const directPayments = (allPayments || []).filter(p => p.order_id === order.id);
  const directPaid = directPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);

  // If direct payments already cover or exceed net_amount, remaining due is 0
  if (directPaid >= netAmount) {
    return {
      netAmount,
      directPaid,
      unassignedAllocated: 0,
      totalPaid: directPaid,
      remainingDue: 0
    };
  }

  // 2. Unassigned payments for this shop (order_id === '')
  const unassignedPayments = (allPayments || []).filter(p => p.shop_id === order.shop_id && (!p.order_id || p.order_id === ''));
  let unassignedPool = unassignedPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);

  // Sort shop orders chronologically
  const pendingOrders = (allShopOrders || [])
    .filter(o => o.shop_id === order.shop_id && o.status !== 'cancelled')
    .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

  // Deduct ledger balance prior to pending orders from unassigned pool
  const totalUnpaidInvoicesNet = pendingOrders.reduce((sum, o) => {
    const dPaid = (allPayments || []).filter(p => p.order_id === o.id).reduce((s, p) => s + (Number(p.collected_amount) || 0), 0);
    return sum + Math.max(0, Number(o.net_amount || 0) - dPaid);
  }, 0);

  const shopBal = shop ? Number(shop.outstanding_amount || 0) : 0;
  const ledgerBalance = Math.max(0, shopBal - totalUnpaidInvoicesNet);
  unassignedPool = Math.max(0, unassignedPool - ledgerBalance);

  // Allocate unassigned pool to pending orders FIFO
  let unassignedAllocatedToThisOrder = 0;
  for (const pOrd of pendingOrders) {
    if (unassignedPool <= 0) break;
    const pOrdDirect = (allPayments || []).filter(p => p.order_id === pOrd.id).reduce((s, p) => s + (Number(p.collected_amount) || 0), 0);
    const pOrdNeeded = Math.max(0, Number(pOrd.net_amount || 0) - pOrdDirect);

    const alloc = Math.min(unassignedPool, pOrdNeeded);
    if (pOrd.id === order.id) {
      unassignedAllocatedToThisOrder = alloc;
    }
    unassignedPool -= alloc;
  }

  const totalPaid = directPaid + unassignedAllocatedToThisOrder;
  let remainingDue = Math.max(0, netAmount - totalPaid);

  // Cap remaining due at overall shop outstanding
  if (shop && shopBal >= 0) {
    remainingDue = Math.min(remainingDue, shopBal);
  }

  return {
    netAmount,
    directPaid,
    unassignedAllocated: unassignedAllocatedToThisOrder,
    totalPaid,
    remainingDue
  };
}
