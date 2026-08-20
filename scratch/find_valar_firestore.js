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

  const valar = shops.find(s => (s.name_en || '').toLowerCase().includes('valar') || (s.name_ta || '').includes('வளர்'));
  console.log('Valar Maligai Shop Object:', valar);

  if (valar) {
    const valarOrders = orders.filter(o => o.shop_id === valar.id);
    console.log(`\nOrders for Valar Maligai (${valarOrders.length}):`);
    valarOrders.forEach(o => {
      console.log(`  Inv: ${o.invoice_number} | ID: ${o.id} | Net: ₹${o.net_amount} | PrevOut: ₹${o.previous_outstanding} | Status: ${o.status} | Date: ${o.order_date}`);
    });

    const valarPayments = payments.filter(p => p.shop_id === valar.id);
    console.log(`\nPayments for Valar Maligai (${valarPayments.length}):`);
    valarPayments.forEach(p => {
      console.log(`  PayID: ${p.id} | OrderID: ${p.order_id} | Mode: ${p.payment_mode} | Amt: ₹${p.collected_amount} | Date: ${p.payment_date || p.created_at}`);
    });

    const totalOrdersNet = valarOrders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + (Number(o.net_amount) || 0), 0);
    const totalPaymentsSum = valarPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);

    console.log(`\nTotal Orders Net: ₹${totalOrdersNet}`);
    console.log(`Total Payments Sum: ₹${totalPaymentsSum}`);
    console.log(`Current Shop outstanding_amount: ₹${valar.outstanding_amount}`);

    const correctOutstanding = Math.max(0, totalOrdersNet - totalPaymentsSum);
    console.log(`Calculated Correct Outstanding: ₹${correctOutstanding}`);

    if (valar.outstanding_amount !== correctOutstanding) {
      valar.outstanding_amount = correctOutstanding;
      await tablesRef.doc('shops').set({ data: shops });
      await tablesRef.doc('_metadata').set({ last_updated: Date.now() }, { merge: true });
      console.log(`\n✅ UPDATED Valar Maligai outstanding_amount to ₹${correctOutstanding} in Firestore!`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
