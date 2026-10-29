import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const dbFs = getFirestore();

async function check() {
  const tenantsSnap = await dbFs.collection('tenants').get();
  for (const tDoc of tenantsSnap.docs) {
    const tenantId = tDoc.id;
    console.log(`Checking tenant: ${tenantId}`);
    
    // Check tables in this tenant
    const tablesSnap = await dbFs.collection('tenants').doc(tenantId).collection('tables').get();
    let orders = [];
    let deliveries = [];
    let payments = [];
    let shops = [];
    
    for (const doc of tablesSnap.docs) {
      if (doc.id === 'orders') orders = doc.data().data || [];
      if (doc.id === 'deliveries') deliveries = doc.data().data || [];
      if (doc.id === 'payments') payments = doc.data().data || [];
      if (doc.id === 'shops') shops = doc.data().data || [];
      // Also check chunks if any
      if (doc.id.startsWith('orders_chunk_')) {
        orders.push(...(doc.data().data || []));
      }
      if (doc.id.startsWith('deliveries_chunk_')) {
        deliveries.push(...(doc.data().data || []));
      }
    }
    
    const o = orders.find(x => x.invoice_number === 'INV-1505' || (x.id && x.id.includes('1505')));
    if (o) {
      console.log(`FOUND in tenant ${tenantId}:`);
      console.log('Order:', JSON.stringify(o, null, 2));
      const del = deliveries.find(d => d.order_id === o.id || d.id === o.id);
      console.log('Delivery:', JSON.stringify(del, null, 2));
      const sh = shops.find(s => s.id === o.shop_id);
      console.log('Shop:', JSON.stringify(sh, null, 2));
      const ordPays = payments.filter(p => p.order_id === o.id);
      console.log('Order payments:', JSON.stringify(ordPays, null, 2));
      const shopPays = payments.filter(p => p.shop_id === o.shop_id);
      console.log('Shop payments count:', shopPays.length);
    }
  }
}

check().catch(console.error);
