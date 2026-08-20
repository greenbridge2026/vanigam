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
  const tenantsSnap = await firestoreDb.collection('tenants').get();
  console.log('Tenants:', tenantsSnap.docs.map(d => d.id));

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
    const shopsDoc = await tablesRef.doc('shops').get();
    const ordersDoc = await tablesRef.doc('orders').get();
    const paymentsDoc = await tablesRef.doc('payments').get();

    if (!shopsDoc.exists) continue;

    let shops = shopsDoc.data().data || [];
    let orders = ordersDoc.exists ? (ordersDoc.data().data || []) : [];
    let payments = paymentsDoc.exists ? (paymentsDoc.data().data || []) : [];

    console.log(`\nTenant ${tenantId}:`);
    let shopModified = false;

    shops.forEach(s => {
      const name = s.name_en || s.name_ta || '';
      if (name.toLowerCase().includes('valar') || name.includes('வளர்')) {
        console.log(`Found Shop: ${name} (ID: ${s.id})`);
        console.log(`Current outstanding_amount: ${s.outstanding_amount}`);

        const sOrders = orders.filter(o => o.shop_id === s.id && o.status !== 'cancelled');
        const sPayments = payments.filter(p => p.shop_id === s.id);

        const totalOrdersNet = sOrders.reduce((sum, o) => sum + (Number(o.net_amount) || 0), 0);
        const totalPayments = sPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);

        console.log(`Total Orders Net: ₹${totalOrdersNet}`);
        console.log(`Total Payments Collected: ₹${totalPayments}`);

        sOrders.forEach(o => {
          const oPays = payments.filter(p => p.order_id === o.id);
          const oPaid = oPays.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);
          console.log(`  Order ${o.invoice_number} (Date: ${o.order_date}): Net ₹${o.net_amount}, Paid ₹${o.paid_amount || oPaid}, Remaining ₹${o.net_amount - oPaid}`);
        });

        // Recalculate true outstanding amount for this shop
        // If shop had no opening balance, true outstanding = totalOrdersNet - totalPayments
        const calculatedOutstanding = Math.max(0, totalOrdersNet - totalPayments);
        console.log(`Calculated True Outstanding: ₹${calculatedOutstanding}`);

        if (s.outstanding_amount !== calculatedOutstanding) {
          console.log(`Updating shop ${s.name_en} outstanding_amount from ₹${s.outstanding_amount} to ₹${calculatedOutstanding}`);
          s.outstanding_amount = calculatedOutstanding;
          shopModified = true;
        }
      }
    });

    if (shopModified) {
      await tablesRef.doc('shops').set({ data: shops });
      await tablesRef.doc('_metadata').set({ last_updated: Date.now() }, { merge: true });
      console.log(`Successfully updated shops collection for tenant ${tenantId}`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
