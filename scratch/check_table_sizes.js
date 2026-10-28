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

async function checkSizes() {
  const tenantId = 'GSK_AGENCY';
  console.log(`Checking doc sizes for tenant: ${tenantId}...`);
  const snap = await dbFs.collection('tenants').doc(tenantId).collection('tables').get();
  
  let report = [];
  for (const doc of snap.docs) {
    const rawData = doc.data();
    const str = JSON.stringify(rawData);
    const bytes = Buffer.byteLength(str, 'utf8');
    const count = Array.isArray(rawData.data) ? rawData.data.length : (rawData.data ? 'object' : 0);
    report.push({ id: doc.id, count, bytes, kb: (bytes / 1024).toFixed(1), mb: (bytes / (1024 * 1024)).toFixed(2) });
  }

  report.sort((a, b) => b.bytes - a.bytes);
  console.table(report);

  // Check stock_ledger details
  const ledgerDoc = snap.docs.find(d => d.id === 'stock_ledger');
  if (ledgerDoc) {
    const ledger = ledgerDoc.data().data || [];
    console.log(`Stock ledger total records: ${ledger.length}`);
    if (ledger.length > 0) {
      console.log('Sample record keys:', Object.keys(ledger[0]));
      console.log('Sample record:', ledger[0]);
      console.log('Last record:', ledger[ledger.length - 1]);
    }
  }
}

checkSizes().catch(console.error);
