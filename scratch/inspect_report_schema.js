import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function inspect() {
  const tenantId = 'GSK_AGENCY';
  const tables = ['products', 'orders', 'order_items', 'purchases', 'shops', 'routes'];
  for (const t of tables) {
    const docRef = db.doc(`tenants/${tenantId}/tables/${t}`);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data().data || [];
      console.log(`=== TABLE: ${t} (Count: ${data.length}) ===`);
      if (data.length > 0) {
        console.log('Sample item:', JSON.stringify(data[0], null, 2));
      }
    } else {
      console.log(`=== TABLE: ${t} NOT FOUND ===`);
    }
  }
}

inspect().catch(console.error);
