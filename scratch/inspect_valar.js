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
  console.log('Tenants found:', tenantsSnap.docs.map(d => d.id));

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    console.log(`\n================ Tenant: ${tenantId} ================`);
    const tablesSnap = await firestoreDb.collection('tenants').doc(tenantId).collection('tables').get();
    
    let orders = [];
    let shops = [];
    let payments = [];

    tablesSnap.forEach(doc => {
      if (doc.id === 'orders') orders = doc.data().data || [];
      if (doc.id === 'shops') shops = doc.data().data || [];
      if (doc.id === 'payments') payments = doc.data().data || [];
    });

    const shop = shops.find(s => (s.name_en || '').toLowerCase().includes('valar') || (s.name_ta || '').includes('வளர்'));
    if (shop) {
      console.log('Found Shop:', shop);
      const shopOrders = orders.filter(o => o.shop_id === shop.id);
      console.log(`Orders (${shopOrders.length}):`);
      shopOrders.forEach(o => {
        console.log(`  Inv: ${o.invoice_number} | Net: ${o.net_amount} | PrevOut: ${o.previous_outstanding} | Date: ${o.order_date}`);
      });
      const shopPayments = payments.filter(p => p.shop_id === shop.id);
      console.log(`Payments (${shopPayments.length}):`);
      shopPayments.forEach(p => {
        console.log(`  PayID: ${p.id} | OrderID: ${p.order_id} | Amount: ${p.collected_amount} | Date: ${p.payment_date || p.created_at}`);
      });
    }
  }

  process.exit(0);
}

main().catch(console.error);
