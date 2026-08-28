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

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  const getTable = async (t) => (await tablesRef.doc(t).get()).data()?.data || [];

  const shops = await getTable('shops');
  const abcShop = shops.find(s => s.id === 's_1786604089214'); // ABC Cool bar

  console.log('--- ABC SHOP IN DB ---');
  console.log(abcShop);

  const orders = await getTable('orders');
  const abcOrders = orders.filter(o => o.shop_id === abcShop.id);
  console.log('\n--- ABC ORDERS IN DB ---');
  abcOrders.forEach(o => {
    console.log(`Order ID: ${o.id} | Inv: ${o.invoice_number} | Date: ${o.order_date} | Net: ${o.net_amount} | Status: ${o.status}`);
  });

  const payments = await getTable('payments');
  const abcPayments = payments.filter(p => p.shop_id === abcShop.id);
  console.log('\n--- ABC PAYMENTS IN DB ---');
  abcPayments.forEach(p => {
    console.log(`Payment ID: ${p.id} | Date: ${p.payment_date} | Amount: ${p.collected_amount} | OrderID: '${p.order_id}' | Mode: ${p.payment_mode}`);
  });

  process.exit(0);
}

main().catch(console.error);
