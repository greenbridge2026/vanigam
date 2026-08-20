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

  console.log(`Recalculating shop outstanding balances for tenant: ${tenantId}...`);
  let modifiedCount = 0;

  shops.forEach(s => {
    const sOrders = orders.filter(o => o.shop_id === s.id && o.status !== 'cancelled');
    
    // Calculate total unpaid amount across all orders for this shop
    const totalUnpaid = sOrders.reduce((sum, o) => {
      const oPayments = payments.filter(p => p.order_id === o.id);
      const paid = oPayments.reduce((pSum, p) => pSum + (Number(p.collected_amount) || 0), 0);
      return sum + Math.max(0, (Number(o.net_amount) || 0) - paid);
    }, 0);

    if (s.outstanding_amount !== totalUnpaid) {
      console.log(`  Shop: ${s.name_en} (${s.id}) | Old Bal: ₹${s.outstanding_amount} -> New Correct Bal: ₹${totalUnpaid}`);
      s.outstanding_amount = totalUnpaid;
      modifiedCount++;
    }
  });

  if (modifiedCount > 0) {
    await tablesRef.doc('shops').set({ data: shops });
    await tablesRef.doc('_metadata').set({ last_updated: Date.now() }, { merge: true });
    console.log(`\n✅ Successfully updated ${modifiedCount} shop outstanding amounts in Firestore!`);
  } else {
    console.log('\nAll shop outstanding amounts are already accurate!');
  }

  process.exit(0);
}

main().catch(console.error);
