import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccount = JSON.parse(fs.readFileSync('backend/serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const dbFs = getFirestore();

async function checkChunks() {
  const tables = ['orders', 'deliveries', 'payments'];
  for (const t of tables) {
    const docRef = dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc(t);
    const snap = await docRef.get();
    if (snap.exists) {
      const d = snap.data();
      console.log(`Table ${t}:`, {
        is_chunked: d.is_chunked,
        total_chunks: d.total_chunks,
        total_records: d.total_records,
        hasDataDirect: !!d.data,
        dataLength: d.data ? d.data.length : 0
      });
    } else {
      console.log(`Table ${t}: NOT FOUND`);
    }
  }

  // Also list all doc IDs in tables collection for GSK_AGENCY
  const allDocs = await dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').get();
  console.log('All doc IDs in tables:', allDocs.docs.map(doc => doc.id));
}

checkChunks();
