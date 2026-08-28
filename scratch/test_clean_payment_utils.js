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

function cleanCalculateOrderPaymentInfo(order, shop, allShopOrders, allPayments) {
  if (!order) {
    return { netAmount: 0, directPaid: 0, unassignedAllocated: 0, totalPaid: 0, remainingDue: 0 };
  }

  const netAmount = Number(order.net_amount || 0);

  const directPayments = (allPayments || []).filter(p => p.order_id === order.id);
  const directPaid = directPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);

  const totalPaid = Math.min(netAmount, directPaid);
  const remainingDue = Math.max(0, netAmount - totalPaid);

  return {
    netAmount,
    directPaid,
    unassignedAllocated: 0,
    totalPaid,
    remainingDue
  };
}

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  const getTable = async (t) => (await tablesRef.doc(t).get()).data()?.data || [];

  const shops = await getTable('shops');
  const orders = await getTable('orders');
  const payments = await getTable('payments');

  console.log('=== TEST_1 ALL SHOPS OUTSTANDING CLEAN TEST ===');

  for (const shop of shops) {
    const rawShopBal = Number(shop.outstanding_amount || 0);

    const invoices = orders
      .filter(o => o.shop_id === shop.id && o.status !== 'cancelled')
      .map(order => {
        const info = cleanCalculateOrderPaymentInfo(order, shop, orders, payments);
        return {
          ...order,
          net_amount: info.netAmount,
          total_collected: info.totalPaid,
          remaining_outstanding: info.remainingDue
        };
      })
      .filter(o => o.remaining_outstanding > 0);

    const invoicesSum = invoices.reduce((sum, inv) => sum + inv.remaining_outstanding, 0);
    const baseOutstanding = Math.max(0, rawShopBal - invoicesSum);
    const totalOutstanding = Math.max(rawShopBal, invoicesSum + baseOutstanding);

    console.log(`\nShop: ${shop.name_en || shop.name_ta || shop.id}`);
    console.log(`  DB outstanding_amount: ₹${rawShopBal}`);
    console.log(`  Invoices Sum: ₹${invoicesSum} (${invoices.length} invoices)`);
    console.log(`  Previous Ledger Outstanding (baseOutstanding): ₹${baseOutstanding}`);
    console.log(`  Total Outstanding: ₹${totalOutstanding}`);

    if (invoices.length > 0) {
      console.log('  Open Invoices:');
      invoices.forEach(inv => {
        console.log(`    - Inv ${inv.invoice_number} | Net: ₹${inv.net_amount} | Paid: ₹${inv.total_collected} | Due: ₹${inv.remaining_outstanding}`);
      });
    }
  }

  process.exit(0);
}

main().catch(console.error);
