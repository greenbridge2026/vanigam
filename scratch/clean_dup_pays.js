import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('backend/serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const dbFs = getFirestore();

async function cleanDuplicatePayments() {
  const pDocRef = dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('payments');
  const snap = await pDocRef.get();
  if (!snap.exists) return;
  const payments = snap.data().data || [];
  
  const toRemove = new Set(['pay_1793253327853_0', 'pay_1793253347708_0']);
  const cleaned = payments.filter(p => !toRemove.has(p.id));
  console.log(`Original: ${payments.length}, Cleaned: ${cleaned.length}`);

  await pDocRef.update({ data: cleaned });

  // Update metadata
  const metaRef = dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('_metadata');
  await metaRef.set({ last_updated: Date.now() }, { merge: true });
  console.log('Cleaned duplicate payments successfully!');
}

cleanDuplicatePayments().catch(console.error);
