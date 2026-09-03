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

async function searchTargetPayments() {
  console.log('--- Searching All Payments Across All Tenants ---');
  const querySnap = await dbFs.collectionGroup('tables').get();

  for (const doc of querySnap.docs) {
    if (doc.id === 'payments') {
      const fullPath = doc.ref.path;
      const data = doc.data();
      const payments = (data && data.data) ? data.data : [];
      
      const august28Payments = payments.filter(p => {
        const pDate = p.payment_date ? p.payment_date.split('T')[0] : '';
        return pDate === '2026-08-28' || [51630, 35000, 6000].includes(Number(p.collected_amount));
      });

      if (august28Payments.length > 0) {
        console.log(`\n🎯 MATCHING PAYMENTS IN ${fullPath} (${august28Payments.length} items):`);
        console.log(JSON.stringify(august28Payments, null, 2));
      }
    }
  }
}

searchTargetPayments().catch(console.error);
