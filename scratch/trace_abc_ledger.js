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
  const shop = shops.find(s => s.id === 's_1786604089214');
  const orders = (await getTable('orders')).filter(o => o.shop_id === shop.id);
  const payments = (await getTable('payments')).filter(p => p.shop_id === shop.id);

  console.log('--- ALL UNPAID/PARTIAL ORDERS & THEIR PAYMENTS ---');

  // Let's list all orders chronologically
  orders.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));

  for (const o of orders) {
    const oPayments = payments.filter(p => p.order_id === o.id);
    const directPaid = oPayments.reduce((s, p) => s + Number(p.collected_amount || 0), 0);
    console.log(`Order ${o.invoice_number} (ID: ${o.id}) | Date: ${o.order_date} | Net: ${o.net_amount} | DirectPaid: ${directPaid}`);
    if (oPayments.length > 0) {
      oPayments.forEach(p => console.log(`   -> Payment ${p.id}: ${p.collected_amount} (${p.payment_mode})`));
    }
  }

  console.log('\n--- ALL UNASSIGNED / LEDGER PAYMENTS ---');
  const unassigned = payments.filter(p => !p.order_id || p.order_id === 'UNASSIGNED' || p.order_id === 'LEDGER_ONLY');
  let totalUnassigned = 0;
  unassigned.forEach(p => {
    totalUnassigned += Number(p.collected_amount || 0);
    console.log(`Payment ${p.id} | Date: ${p.payment_date} | Amount: ${p.collected_amount} | OrderID: ${p.order_id}`);
  });
  console.log(`Total Unassigned/Ledger Payments: ${totalUnassigned}`);

  process.exit(0);
}

main().catch(console.error);
