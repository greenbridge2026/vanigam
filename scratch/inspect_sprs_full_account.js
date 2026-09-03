import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});
const dbFs = getFirestore();

async function inspectSprsFull() {
  console.log('--- Inspecting All Collections in tenants/SPRS ---');
  const tablesSnap = await dbFs.collection('tenants').doc('SPRS').collection('tables').get();
  console.log(`Total tables docs in tenants/SPRS: ${tablesSnap.size}`);

  for (const doc of tablesSnap.docs) {
    const data = doc.data();
    const arr = data.data || [];
    console.log(`Table '${doc.id}': ${arr.length} items`);
    if (doc.id === 'payments') {
      console.log('Payments:', JSON.stringify(arr, null, 2));
    }
    if (doc.id === 'shops') {
      console.log('Shops:', JSON.stringify(arr.map(s => ({ id: s.id, name: s.name_en || s.name, outstanding: s.outstanding_amount })), null, 2));
    }
    if (doc.id === 'orders') {
      console.log('Orders:', JSON.stringify(arr.map(o => ({ id: o.id, invoice: o.invoice_number, net: o.net_amount, status: o.status })), null, 2));
    }
  }
}

inspectSprsFull().catch(console.error);
