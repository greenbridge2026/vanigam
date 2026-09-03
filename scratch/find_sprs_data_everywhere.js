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

async function findSprsData() {
  console.log('--- Searching All "tables" Subcollections in Firestore ---');
  const querySnap = await dbFs.collectionGroup('tables').get();
  console.log(`Total "tables" documents found across all paths: ${querySnap.size}`);

  for (const doc of querySnap.docs) {
    const fullPath = doc.ref.path;
    console.log(`\nDocument Path: ${fullPath}`);
    const data = doc.data();
    if (data && data.data && Array.isArray(data.data)) {
      console.log(`  Items count: ${data.data.length}`);

      // Search for payments matching 51630, 35000, 6000
      if (doc.id === 'payments') {
        const matches = data.data.filter(p => [51630, 35000, 6000].includes(Number(p.collected_amount)));
        if (matches.length > 0) {
          console.log(`  🎯 MATCHING PAYMENTS IN ${fullPath}:`, JSON.stringify(matches, null, 2));
        }
      }

      // Search for SPRS shops or references
      const sprsItems = data.data.filter(item => JSON.stringify(item).toLowerCase().includes('sprs'));
      if (sprsItems.length > 0) {
        console.log(`  🎯 SPRS ITEMS IN ${fullPath} (${sprsItems.length} items):`, JSON.stringify(sprsItems, null, 2));
      }
    }
  }
}

findSprsData().catch(console.error);
