import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function inspectReturns() {
  const tenantId = 'GSK_AGENCY';
  const ordersSnap = await db.doc(`tenants/${tenantId}/tables/orders`).get();
  const orders = ordersSnap.exists ? ordersSnap.data().data || [] : [];
  
  const statuses = new Set(orders.map(o => o.status));
  console.log('Order statuses:', Array.from(statuses));
  
  const returnedOrders = orders.filter(o => o.status === 'returned');
  console.log('Returned orders count:', returnedOrders.length);
  
  // Also check deliveries or audit trail or vehicle loading for returns
  const deliveriesSnap = await db.doc(`tenants/${tenantId}/tables/deliveries`).get();
  const deliveries = deliveriesSnap.exists ? deliveriesSnap.data().data || [] : [];
  console.log('Deliveries count:', deliveries.length);
  if (deliveries.length > 0) {
    console.log('Sample delivery:', JSON.stringify(deliveries[0], null, 2));
  }
}

inspectReturns().catch(console.error);
