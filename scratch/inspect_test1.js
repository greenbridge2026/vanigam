import { initializeApp, cert } from 'firebase-admin/app';
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

initializeApp({
  credential: cert(serviceAccount)
});

const firestoreDb = getFirestore();

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');

  const getTable = async (tableName) => {
    const doc = await tablesRef.doc(tableName).get();
    return doc.exists ? (doc.data().data || []) : [];
  };

  const shops = await getTable('shops');
  console.log('--- All Shops ---');
  console.log(JSON.stringify(shops, null, 2));

  const orders = await getTable('orders');
  console.log('\n--- All Orders ---');
  orders.forEach(o => {
    console.log(`ID: ${o.id} | Inv: ${o.invoice_number} | ShopID: ${o.shop_id} | Date: ${o.order_date} | Net: ${o.net_amount} | Status: ${o.status}`);
  });

  const payments = await getTable('payments');
  console.log('\n--- All Payments ---');
  payments.forEach(p => {
    console.log(`ID: ${p.id} | Date: ${p.payment_date} | Amount: ${p.collected_amount} | ShopID: ${p.shop_id} | OrderID: ${p.order_id || 'UNASSIGNED'} | Mode: ${p.payment_mode}`);
  });

  const outstandingHistory = await getTable('outstanding_history');
  console.log('\n--- All Outstanding History ---');
  outstandingHistory.forEach(h => {
    console.log(`ID: ${h.id} | ShopID: ${h.shop_id} | Date: ${h.date} | Type: ${h.type} | Amount: ${h.amount} | Inv: ${h.order_number || ''} | Desc: ${h.description}`);
  });

  process.exit(0);
}

main().catch(console.error);
