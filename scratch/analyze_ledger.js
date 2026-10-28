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

async function analyzeLedger() {
  const doc = await dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('stock_ledger').get();
  if (!doc.exists) {
    console.log('No stock_ledger doc');
    return;
  }
  const data = doc.data().data || [];
  console.log(`Total rows: ${data.length}`);

  // Breakdown by transaction_type
  const types = {};
  data.forEach(r => {
    types[r.transaction_type] = (types[r.transaction_type] || 0) + 1;
  });
  console.log('Transaction types:', types);

  // Breakdown by date
  const timestamps = data.map(r => r.timestamp).filter(Boolean).sort();
  console.log('Oldest timestamp:', timestamps[0]);
  console.log('Newest timestamp:', timestamps[timestamps.length - 1]);

  // Check average bytes per row
  const totalBytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
  console.log(`Total bytes: ${totalBytes} (~${(totalBytes / data.length).toFixed(1)} bytes/row)`);
}

analyzeLedger().catch(console.error);
