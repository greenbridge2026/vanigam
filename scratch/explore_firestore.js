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

async function exploreFirestore() {
  console.log('--- Listing Top Collections ---');
  const collections = await dbFs.listCollections();
  for (const col of collections) {
    console.log(`Collection: ${col.id}`);
    const snap = await col.get();
    console.log(`  Doc count: ${snap.size}`);
    for (const doc of snap.docs) {
      console.log(`    Doc ID: ${doc.id}`);
      // Check subcollections
      const subCols = await doc.ref.listCollections();
      for (const sub of subCols) {
        console.log(`      Subcollection: ${sub.id}`);
        const subSnap = await sub.get();
        console.log(`        SubDoc count: ${subSnap.size}`);
        for (const subDoc of subSnap.docs) {
          console.log(`          SubDoc ID: ${subDoc.id}`);
        }
      }
    }
  }
}

exploreFirestore().catch(console.error);
