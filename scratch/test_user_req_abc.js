import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'backend/serviceAccountKey.json';
let resolvedPath = path.resolve(__dirname, '..', saPath);
if (!fs.existsSync(resolvedPath)) {
  resolvedPath = path.resolve(__dirname, '../backend', saPath);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const firestoreDb = getFirestore();

function calculateOrderPaymentInfo(order, shop, allShopOrders, allPayments) {
  if (!order) {
    return { netAmount: 0, directPaid: 0, unassignedAllocated: 0, totalPaid: 0, remainingDue: 0 };
  }

  const netAmount = Number(order.net_amount || 0);

  const directPayments = (allPayments || []).filter(p => p.order_id === order.id);
  const directPaid = directPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);

  if (directPaid >= netAmount) {
    return {
      netAmount,
      directPaid,
      unassignedAllocated: 0,
      totalPaid: directPaid,
      remainingDue: 0
    };
  }

  const unassignedPayments = (allPayments || []).filter(p => p.shop_id === order.shop_id && (!p.order_id || p.order_id === '' || p.order_id === 'UNASSIGNED'));
  let unassignedPool = unassignedPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);

  const shopOrders = (allShopOrders || [])
    .filter(o => o.shop_id === order.shop_id && o.status !== 'cancelled')
    .sort((a, b) => {
      const tA = a.order_date ? new Date(a.order_date).getTime() : 0;
      const tB = b.order_date ? new Date(b.order_date).getTime() : 0;
      if (tA !== tB) return tA - tB;
      return (a.id || '').localeCompare(b.id || '');
    });

  let unassignedAllocatedToThisOrder = 0;

  for (const pOrd of shopOrders) {
    if (unassignedPool <= 0) break;
    const pOrdNet = Number(pOrd.net_amount || 0);
    const pOrdDirect = (allPayments || []).filter(p => p.order_id === pOrd.id).reduce((s, p) => s + (Number(p.collected_amount) || 0), 0);
    const pOrdNeeded = Math.max(0, pOrdNet - pOrdDirect);

    const alloc = Math.min(unassignedPool, pOrdNeeded);
    if (pOrd.id === order.id) {
      unassignedAllocatedToThisOrder = alloc;
    }
    unassignedPool -= alloc;
  }

  const totalPaid = directPaid + unassignedAllocatedToThisOrder;
  const remainingDue = Math.max(0, netAmount - totalPaid);

  return {
    netAmount,
    directPaid,
    unassignedAllocated: unassignedAllocatedToThisOrder,
    totalPaid,
    remainingDue
  };
}

function getShopOutstandingInfo(shop, orders, payments) {
  const rawShopBal = Number(shop.outstanding_amount || 0);

  const invoices = orders
    .filter(o => o.shop_id === shop.id && o.status !== 'cancelled')
    .map(order => {
      const info = calculateOrderPaymentInfo(order, shop, orders, payments);
      return {
        ...order,
        net_amount: info.netAmount,
        total_collected: info.totalPaid,
        remaining_outstanding: info.remainingDue
      };
    })
    .filter(o => o.remaining_outstanding > 0);

  const invoicesSum = invoices.reduce((sum, inv) => sum + inv.remaining_outstanding, 0);
  const baseOutstanding = Math.max(0, rawShopBal - invoicesSum);
  const totalOutstanding = Math.max(rawShopBal, invoicesSum + baseOutstanding);

  return {
    baseOutstanding,
    invoices,
    invoicesSum,
    totalOutstanding
  };
}

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  const getTable = async (t) => (await tablesRef.doc(t).get()).data()?.data || [];

  const shops = await getTable('shops');
  const orders = await getTable('orders');
  const payments = await getTable('payments');

  console.log('=== SHOPS OUTSTANDING BREAKDOWN TEST ===');
  shops.forEach(s => {
    const info = getShopOutstandingInfo(s, orders, payments);
    console.log(`\nShop: ${s.name_en || s.name_ta || s.id}`);
    console.log(`  Raw Shop Outstanding in DB: ₹${s.outstanding_amount}`);
    console.log(`  Total Outstanding: ₹${info.totalOutstanding}`);
    console.log(`  Invoices Sum: ₹${info.invoicesSum} (${info.invoices.length} invoices)`);
    console.log(`  Previous Ledger Outstanding: ₹${info.baseOutstanding} (Show card? ${info.baseOutstanding > 0 ? 'YES' : 'NO'})`);
    console.log(`  Pending Invoices:`);
    info.invoices.forEach(inv => {
      console.log(`    - Inv ${inv.invoice_number} | Date: ${inv.order_date.substring(0, 10)} | Bill: ₹${inv.net_amount} | Paid: ₹${inv.total_collected} | Due: ₹${inv.remaining_outstanding}`);
    });
  });

  process.exit(0);
}

main().catch(console.error);
