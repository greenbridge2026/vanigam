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

async function inspectTables() {
  console.log('--- Listing All Docs in "tables" Collection ---');
  const snap = await dbFs.collection('tables').get();
  console.log(`Doc count in "tables": ${snap.size}`);
  for (const doc of snap.docs) {
    console.log(`\nDoc ID: ${doc.id}`);
    const data = doc.data();
    if (data.data && Array.isArray(data.data)) {
      console.log(`  Array length: ${data.data.length}`);
      if (doc.id === 'payments') {
        const matches = data.data.filter(p => [51630, 35000, 6000].includes(Number(p.collected_amount)));
        console.log(`  Target payments in tables/payments (${matches.length}):`, JSON.stringify(matches, null, 2));
      }
      if (doc.id === 'shops') {
        const sprs = data.data.filter(s => JSON.stringify(s).toLowerCase().includes('sprs'));
        console.log(`  SPRS shops in tables/shops (${sprs.length}):`, JSON.stringify(sprs, null, 2));
      }
      if (doc.id === 'users') {
        console.log(`  Users list:`, data.data.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role })));
      }
    } else {
      console.log(`  Doc fields:`, Object.keys(data));
    }
  }
}

inspectTables().catch(console.error);
