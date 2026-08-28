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
    return { netAmount, directPaid, unassignedAllocated: 0, totalPaid: directPaid, remainingDue: 0 };
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

  return { netAmount, directPaid, unassignedAllocated: unassignedAllocatedToThisOrder, totalPaid, remainingDue };
}

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  const getTable = async (t) => (await tablesRef.doc(t).get()).data()?.data || [];

  const shops = await getTable('shops');
  const orders = await getTable('orders');
  const payments = await getTable('payments');

  const abcShop = shops.find(s => s.id === 's_1786604089214'); // ABC Cool bar
  if (!abcShop) {
    console.log('ABC shop not found');
    process.exit(0);
  }

  const abcOrders = orders.filter(o => o.shop_id === abcShop.id && o.status !== 'cancelled');
  let invoicesSum = 0;

  abcOrders.forEach(o => {
    const info = calculateOrderPaymentInfo(o, abcShop, orders, payments);
    if (info.remainingDue > 0) {
      invoicesSum += info.remainingDue;
      console.log(`Open Invoice ${o.invoice_number}: Due ₹${info.remainingDue}`);
    }
  });

  console.log(`ABC Shop Old outstanding_amount in DB: ₹${abcShop.outstanding_amount}`);
  console.log(`ABC Shop Calculated Invoices Sum: ₹${invoicesSum}`);

  // Update shop outstanding_amount in DB to match invoicesSum
  abcShop.outstanding_amount = invoicesSum;
  await tablesRef.doc('shops').set({ data: shops });
  console.log(`Updated ABC Shop outstanding_amount to ₹${invoicesSum} in Firestore for tenant TEST_1`);

  process.exit(0);
}

main().catch(console.error);
