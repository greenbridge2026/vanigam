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

function newCalculateOrderPaymentInfo(order, shop, allShopOrders, allPayments) {
  if (!order) {
    return { netAmount: 0, directPaid: 0, unassignedAllocated: 0, totalPaid: 0, remainingDue: 0 };
  }

  const netAmount = Number(order.net_amount || 0);

  // 1. Direct payments explicitly linked to this order
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

  // 2. Allocate overall shop outstanding starting from the LATEST order backwards (Newest -> Oldest)
  const shopBal = shop ? Math.max(0, Number(shop.outstanding_amount || 0)) : 0;

  // Filter valid shop orders and sort descending by order_date (newest first)
  const validShopOrders = (allShopOrders || [])
    .filter(o => o.shop_id === order.shop_id && o.status !== 'cancelled')
    .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());

  let remainingShopBal = shopBal;
  let orderRemainingDue = 0;

  for (const pOrd of validShopOrders) {
    if (remainingShopBal <= 0) {
      if (pOrd.id === order.id) {
        orderRemainingDue = 0;
      }
      continue;
    }

    const pOrdNet = Number(pOrd.net_amount || 0);
    const pOrdDirect = (allPayments || []).filter(p => p.order_id === pOrd.id).reduce((s, p) => s + (Number(p.collected_amount) || 0), 0);

    if (pOrdDirect >= pOrdNet) {
      if (pOrd.id === order.id) {
        orderRemainingDue = 0;
      }
      continue;
    }

    const pOrdNeeded = pOrdNet - pOrdDirect;
    const dueForThisOrder = Math.min(pOrdNeeded, remainingShopBal);

    if (pOrd.id === order.id) {
      orderRemainingDue = dueForThisOrder;
    }

    remainingShopBal -= dueForThisOrder;
  }

  const totalPaid = Math.max(0, netAmount - orderRemainingDue);
  const unassignedAllocated = Math.max(0, totalPaid - directPaid);

  return {
    netAmount,
    directPaid,
    unassignedAllocated,
    totalPaid,
    remainingDue: orderRemainingDue
  };
}

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  const getTable = async (t) => (await tablesRef.doc(t).get()).data()?.data || [];

  const shops = await getTable('shops');
  const shop = shops.find(s => s.id === 's_1786604089214'); // ABC Cool bar
  const orders = await getTable('orders');
  const payments = await getTable('payments');

  const shopOrders = orders.filter(o => o.shop_id === shop.id);
  const shopPayments = payments.filter(p => p.shop_id === shop.id);

  console.log(`--- TEST_1 ABC COOL BAR UNTOUCHED DATA RESULTS ---`);
  console.log(`Shop Outstanding Amount in DB: ${shop.outstanding_amount}`);

  // Sort orders chronologically to display
  shopOrders.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));

  shopOrders.forEach(o => {
    const info = newCalculateOrderPaymentInfo(o, shop, shopOrders, shopPayments);
    const status = info.remainingDue <= 0 ? 'Delivered (Paid)' : (info.totalPaid > 0 ? 'Pending (Partially Paid)' : 'Pending');
    console.log(`Inv: ${o.invoice_number} | Date: ${o.order_date.substring(0, 10)} | Net: ${o.net_amount} | TotalPaid: ${info.totalPaid} | RemainingDue: ${info.remainingDue} | Status: ${status}`);
  });

  process.exit(0);
}

main().catch(console.error);
