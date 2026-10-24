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
  const deliveriesDoc = await tablesRef.doc('deliveries').get().catch(() => ({ data: () => ({}) }));

  const shops = shopsDoc.data()?.data || [];
  const orders = ordersDoc.data()?.data || [];
  const payments = paymentsDoc.data()?.data || [];
  const deliveries = deliveriesDoc.data()?.data || [];

  const rafik = shops.find(s => 
    (s.name_en || '').toLowerCase().includes('rafik') || 
    (s.name_ta || '').includes('ரபீக்') ||
    (s.mobile || '').includes('9790021052')
  );

  console.log('=== RAFIK SHOP RECORD ===');
  console.log(rafik);

  if (!rafik) {
    console.log('Shop not found!');
    process.exit(0);
  }

  const shopOrders = orders.filter(o => o.shop_id === rafik.id);
  console.log(`\n=== ORDERS FOR RAFIK (${shopOrders.length}) ===`);
  let totalOrderNetAmount = 0;
  shopOrders.sort((a, b) => new Date(a.order_date || 0) - new Date(b.order_date || 0));
  shopOrders.forEach(o => {
    totalOrderNetAmount += Number(o.net_amount || 0);
    console.log(`Order: ${o.invoice_number || o.id} | Date: ${o.order_date} | Status: ${o.status} | Net: ₹${o.net_amount} | PrevOut: ₹${o.previous_outstanding} | TotalBill: ₹${o.total_amount}`);
  });
  console.log(`Total Order Net Amount: ₹${totalOrderNetAmount}`);

  const shopPayments = payments.filter(p => p.shop_id === rafik.id || shopOrders.some(o => o.id === p.order_id));
  console.log(`\n=== PAYMENTS FOR RAFIK (${shopPayments.length}) ===`);
  let totalCollected = 0;
  shopPayments.forEach(p => {
    totalCollected += Number(p.collected_amount || 0);
    console.log(`PayID: ${p.id} | OrderID: ${p.order_id} | Mode: ${p.payment_mode} | Amt: ₹${p.collected_amount} | Date: ${p.payment_date || p.created_at}`);
  });
  console.log(`Total Payments Collected: ₹${totalCollected}`);

  console.log(`\n=== CALCULATION COMPARISON ===`);
  console.log(`Shop Record outstanding_amount: ₹${rafik.outstanding_amount}`);
  console.log(`Opening Balance in shop record: ₹${rafik.opening_balance || 0}`);
  console.log(`Net Orders - Total Payments: ₹${totalOrderNetAmount} - ₹${totalCollected} = ₹${totalOrderNetAmount - totalCollected}`);

  // Breakdown of each order unpaid
  console.log(`\n=== PER-ORDER UNPAID BREAKDOWN ===`);
  let sumRemaining = 0;
  shopOrders.forEach(o => {
    const orderPays = payments.filter(p => p.order_id === o.id);
    const paidForOrder = orderPays.reduce((sum, p) => sum + Number(p.collected_amount || 0), 0);
    const remaining = Number(o.net_amount || 0) - paidForOrder;
    if (remaining > 0) {
      sumRemaining += remaining;
      console.log(`UNPAID: ${o.invoice_number} (${o.order_date}) -> Net: ₹${o.net_amount}, Paid: ₹${paidForOrder}, Due: ₹${remaining}, Status: ${o.status}`);
    } else {
      console.log(`PAID: ${o.invoice_number} (${o.order_date}) -> Net: ₹${o.net_amount}, Paid: ₹${paidForOrder}, Status: ${o.status}`);
    }
  });
  console.log(`Sum of Unpaid Invoices: ₹${sumRemaining}`);

  process.exit(0);
}

main().catch(console.error);
