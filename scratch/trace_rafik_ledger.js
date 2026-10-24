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
  
  const shopsDoc = await tablesRef.doc('shops').get();
  const ordersDoc = await tablesRef.doc('orders').get();
  const paymentsDoc = await tablesRef.doc('payments').get();
  const deliveriesDoc = await tablesRef.doc('deliveries').get().catch(() => ({ data: () => ({}) }));
  const returnsDoc = await tablesRef.doc('sales_returns').get().catch(() => ({ data: () => ({}) }));

  const shops = shopsDoc.data()?.data || [];
  const orders = ordersDoc.data()?.data || [];
  const payments = paymentsDoc.data()?.data || [];
  const deliveries = deliveriesDoc.data()?.data || [];
  const returns = returnsDoc.data()?.data || [];

  const rafik = shops.find(s => s.id === 's_1785742146163_import_1');
  console.log('Shop Rafik:', rafik);

  const shopOrders = orders.filter(o => o.shop_id === rafik.id);
  const shopPayments = payments.filter(p => p.shop_id === rafik.id || shopOrders.some(o => o.id === p.order_id));
  const shopReturns = returns.filter(r => r.shop_id === rafik.id);

  console.log(`Returns (${shopReturns.length}):`, shopReturns);

  // Check previous_outstanding progression on orders:
  console.log('\n--- Invoices & Prev Outstanding progression ---');
  shopOrders.sort((a,b) => new Date(a.order_date || 0) - new Date(b.order_date || 0));
  shopOrders.forEach(o => {
    console.log(`Date: ${o.order_date?.slice(0,10)} | Inv: ${o.invoice_number} | Net: ₹${o.net_amount} | PrevOut: ₹${o.previous_outstanding} | Status: ${o.status}`);
  });

  // Check deliveries for this shop
  const shopDeliveries = deliveries.filter(d => shopOrders.some(o => o.id === d.order_id));
  console.log(`\nDeliveries (${shopDeliveries.length}):`);
  shopDeliveries.forEach(d => {
    console.log(`Delivery ID: ${d.id} | OrderID: ${d.order_id} | Status: ${d.status} | Collected: ₹${d.collected_amount} | ReturnAmt: ₹${d.return_amount}`);
  });

  // Build combined chronological transactions
  const txns = [];
  shopOrders.forEach(o => {
    txns.push({
      date: new Date(o.order_date || 0),
      type: 'INVOICE',
      ref: o.invoice_number,
      debit: Number(o.net_amount || 0),
      credit: 0,
      notes: `Order ${o.status}`
    });
  });

  shopPayments.forEach(p => {
    txns.push({
      date: new Date(p.payment_date || p.created_at || 0),
      type: 'PAYMENT',
      ref: p.id,
      debit: 0,
      credit: Number(p.collected_amount || 0),
      notes: `${p.payment_mode} (Order: ${p.order_id || 'General'})`
    });
  });

  shopReturns.forEach(r => {
    txns.push({
      date: new Date(r.date || r.created_at || 0),
      type: 'RETURN',
      ref: r.id,
      debit: 0,
      credit: Number(r.refund_amount || r.total_return_amount || 0),
      notes: 'Sales return'
    });
  });

  txns.sort((a, b) => a.date - b.date);

  console.log('\n=== CHRONOLOGICAL LEDGER ===');
  let runningBal = Number(rafik.opening_balance || 0);
  console.log(`Initial Opening Balance: ₹${runningBal}`);
  txns.forEach(t => {
    runningBal += t.debit - t.credit;
    console.log(`${t.date.toISOString().slice(0, 10)} | ${t.type.padEnd(8)} | Ref: ${t.ref.padEnd(16)} | +Debit: ₹${String(t.debit).padStart(5)} | -Credit: ₹${String(t.credit).padStart(5)} | Balance: ₹${runningBal} | ${t.notes}`);
  });

  process.exit(0);
}

main().catch(console.error);
