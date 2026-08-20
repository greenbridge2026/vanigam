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

initializeApp({
  credential: cert(serviceAccount)
});

const firestoreDb = getFirestore();

async function main() {
  const tenantId = 'GSK_AGENCY';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  
  const shopsDoc = await tablesRef.doc('shops').get();
  const ordersDoc = await tablesRef.doc('orders').get();
  const paymentsDoc = await tablesRef.doc('payments').get();

  const shops = shopsDoc.data().data || [];
  const orders = ordersDoc.data().data || [];
  const payments = paymentsDoc.data().data || [];

  const archana = shops.find(s => (s.name_en || '').toLowerCase().includes('archana') || (s.name_ta || '').includes('அர்ச்சனா'));
  console.log('New Archana Shop Object:', archana);

  if (archana) {
    const aOrders = orders.filter(o => o.shop_id === archana.id);
    console.log(`\nOrders for New Archana (${aOrders.length}):`);
    aOrders.forEach(o => {
      console.log(`  Inv: ${o.invoice_number} | ID: ${o.id} | Net: ₹${o.net_amount} | PrevOut: ₹${o.previous_outstanding} | Status: ${o.status} | Date: ${o.order_date}`);
    });

    const aPayments = payments.filter(p => p.shop_id === archana.id);
    console.log(`\nPayments for New Archana (${aPayments.length}):`);
    aPayments.forEach(p => {
      console.log(`  PayID: ${p.id} | OrderID: ${p.order_id} | Mode: ${p.payment_mode} | Amt: ₹${p.collected_amount}`);
    });
  }

  process.exit(0);
}

main().catch(console.error);
