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
  initializeApp({ credential: cert(serviceAccount) });
}

const firestoreDb = getFirestore();

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  const getTable = async (t) => (await tablesRef.doc(t).get()).data()?.data || [];

  const shops = await getTable('shops');
  const shop = shops.find(s => s.id === 's_1786604089214');
  const orders = await getTable('orders');
  const payments = JSON.parse(JSON.stringify(await getTable('payments')));

  // Test modified payment links:
  // 1. Link pay_1787735437153_0 (8000) -> 7200 to INV-1043 (ord_1787735413364), 800 to INV-1049 (ord_1787808183393)
  // 2. Link pay_1787758869313_0 (5000) -> INV-1048 (ord_1787758856211)
  // 3. Link pay_1787806553307_0 (5800) -> INV-1048 (ord_1787758856211)
  // 4. Link pay_1787808255129_0 (3000) -> INV-1049 (ord_1787808183393)
  // 5. Link pay_1787808356542_0 (5000) -> 3600 to INV-1050 (ord_1787808309885), 1400 to INV-1049 (ord_1787808183393)

  payments.forEach(p => {
    if (p.id === 'pay_1787734527982_0') {
      p.order_id = 'ord_1787734489636'; // INV-1042 (10000)
    }
    if (p.id === 'pay_1787734561481_0') {
      p.order_id = 'ord_1787734489636'; // INV-1042 (800)
    }
    if (p.id === 'pay_1787735437153_0') {
      p.order_id = 'ord_1787735413364'; // INV-1043 (7200)
      p.collected_amount = 7200;
    }
    if (p.id === 'pay_1787758869313_0') {
      p.order_id = 'ord_1787758856211'; // INV-1048 (5000)
    }
    if (p.id === 'pay_1787806553307_0') {
      p.order_id = 'ord_1787758856211'; // INV-1048 (5800)
    }
    if (p.id === 'pay_1787808255129_0') {
      p.order_id = 'ord_1787808183393'; // INV-1049 (3000)
    }
    if (p.id === 'pay_1787808356542_0') {
      p.order_id = 'ord_1787808309885'; // INV-1050 (3600)
      p.collected_amount = 3600;
    }
  });

  // Extra 1400 from INV-1050 overpayment linked to INV-1049
  payments.push({
    id: 'pay_1787808356542_extra',
    shop_id: shop.id,
    order_id: 'ord_1787808183393', // INV-1049
    collected_amount: 1400,
    payment_mode: 'cash',
    payment_date: '2026-08-27T05:25:56.415Z'
  });

  const shopOrders = orders.filter(o => o.shop_id === shop.id);
  const shopPayments = payments.filter(p => p.shop_id === shop.id);

  console.log('\n--- SIMULATED ORDERS FOR ABC COOL BAR ---');
  shopOrders.forEach(o => {
    const info = calculateOrderPaymentInfo(o, shop, shopOrders, shopPayments);
    if (['INV-1042', 'INV-1043', 'INV-1044', 'INV-1045', 'INV-1046', 'INV-1047', 'INV-1048', 'INV-1049', 'INV-1050'].includes(o.invoice_number)) {
      console.log(`Invoice: ${o.invoice_number} | Net: ${o.net_amount} | DirectPaid: ${info.directPaid} | UnassignedAlloc: ${info.unassignedAllocated} | TotalPaid: ${info.totalPaid} | RemainingDue: ${info.remainingDue}`);
    }
  });

  process.exit(0);
}

main().catch(console.error);
