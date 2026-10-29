import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('backend/serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const dbFs = getFirestore();

async function fixProductStatuses() {
  const tenants = ['SPRS', 'GSK_AGENCY', 'TEST_1'];
  for (const tid of tenants) {
    const pDocRef = dbFs.collection('tenants').doc(tid).collection('tables').doc('products');
    const snap = await pDocRef.get();
    if (!snap.exists) continue;
    const products = snap.data().data || [];
    let changed = 0;
    products.forEach(p => {
      if (p.status && p.status.toLowerCase() === 'active' && p.status !== 'active') {
        p.status = 'active';
        changed++;
      }
    });

    if (changed > 0) {
      console.log(`Updating ${changed} products in tenant ${tid} to status 'active'...`);
      await pDocRef.update({ data: products });
      const metaRef = dbFs.collection('tenants').doc(tid).collection('tables').doc('_metadata');
      await metaRef.set({ last_updated: Date.now() }, { merge: true });
      console.log(`Updated successfully for ${tid}!`);
    } else {
      console.log(`Tenant ${tid}: No status mismatches found.`);
    }
  }
}

fixProductStatuses().catch(console.error);
