import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { calculateOrderPaymentInfo } from '../src/utils/paymentUtils.js';

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
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const firestoreDb = getFirestore();

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');

  const getTable = async (tableName) => {
    const doc = await tablesRef.doc(tableName).get();
    return doc.exists ? (doc.data().data || []) : [];
  };

  const shops = await getTable('shops');
  const shop = shops.find(s => s.id === 's_1786604089214');
  const orders = await getTable('orders');
  const payments = await getTable('payments');

  const shopOrders = orders.filter(o => o.shop_id === shop.id);
  const shopPayments = payments.filter(p => p.shop_id === shop.id);

  console.log(`Shop: ${shop.name_en || shop.name_ta || shop.id}`);
  console.log(`Current Shop Outstanding Amount in DB: ${shop.outstanding_amount}`);

  console.log('\n--- Payments Breakdown ---');
  let totalPayments = 0;
  shopPayments.forEach(p => {
    totalPayments += Number(p.collected_amount || 0);
    console.log(`Payment ${p.id} | Date: ${p.payment_date} | Amount: ${p.collected_amount} | OrderID: ${p.order_id || 'UNASSIGNED'}`);
  });
  console.log(`Total Payments Collected: ${totalPayments}`);

  console.log('\n--- Orders & Calculated Payment Info ---');
  let totalNet = 0;
  shopOrders.forEach(o => {
    totalNet += Number(o.net_amount || 0);
    const info = calculateOrderPaymentInfo(o, shop, shopOrders, shopPayments);
    console.log(`Invoice: ${o.invoice_number} | Date: ${o.order_date} | Net: ${o.net_amount} | DirectPaid: ${info.directPaid} | UnassignedAlloc: ${info.unassignedAllocated} | TotalPaid: ${info.totalPaid} | RemainingDue: ${info.remainingDue}`);
  });
  console.log(`Total Net Amount of All Orders: ${totalNet}`);

  process.exit(0);
}

main().catch(console.error);
