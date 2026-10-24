import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const saPath = 'backend/serviceAccountKey.json';
let resolvedPath = path.resolve(__dirname, '..', saPath);
const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const firestoreDb = getFirestore();

async function main() {
  const tenantId = 'GSK_AGENCY';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  
  const ordersDoc = await tablesRef.doc('orders').get();
  const orderItemsDoc = await tablesRef.doc('order_items').get();
  const dailyCollsDoc = await tablesRef.doc('daily_collections').get().catch(() => ({ data: () => ({}) }));

  const orders = ordersDoc.data()?.data || [];
  const orderItems = orderItemsDoc.data()?.data || [];
  const dailyColls = dailyCollsDoc.data()?.data || [];

  const rafikOrders = orders.filter(o => o.shop_id === 's_1785742146163_import_1');
  console.log('Orders with full fields:');
  rafikOrders.forEach(o => {
    const items = orderItems.filter(oi => oi.order_id === o.id);
    const itemTotal = items.reduce((s, it) => s + (Number(it.amount) || (Number(it.bottles || 0) * Number(it.price || 0))), 0);
    console.log(`Order: ${o.invoice_number} | total_amount: ${o.total_amount} | net_amount: ${o.net_amount} | discount: ${o.discount} | itemSum: ${itemTotal} | round: ${o.round_off}`);
  });

  const rafikDaily = dailyColls.filter(c => c.shop_id === 's_1785742146163_import_1');
  console.log(`\nDaily Collections for Rafik (${rafikDaily.length}):`);
  rafikDaily.forEach(c => {
    console.log(`Date: ${c.date} | Cash: ${c.cash} | Gpay: ${c.gpay} | Total: ${c.total} | OrderID: ${c.order_id}`);
  });

  process.exit(0);
}

main().catch(console.error);
