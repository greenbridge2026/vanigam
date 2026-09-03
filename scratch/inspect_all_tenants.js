import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account key not found');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});
const dbFs = getFirestore();

async function inspectAllTenants() {
  console.log('--- Inspecting All Tenants in Firestore ---');
  const tenantsSnap = await dbFs.collection('tenants').get();
  for (const doc of tenantsSnap.docs) {
    console.log(`\nTenant ID: ${doc.id}`);
    const tablesSnap = await dbFs.collection('tenants').doc(doc.id).collection('tables').get();
    for (const tDoc of tablesSnap.docs) {
      if (tDoc.id === 'payments') {
        const payments = tDoc.data().data || [];
        console.log(`  Payments count: ${payments.length}`);
        const matches = payments.filter(p => [51630, 35000, 6000].includes(Number(p.collected_amount)));
        if (matches.length > 0) {
          console.log(`  MATCHES IN TENANT ${doc.id}:`, JSON.stringify(matches, null, 2));
        }
      }
      if (tDoc.id === 'shops') {
        const shops = tDoc.data().data || [];
        const sprs = shops.filter(s => JSON.stringify(s).toLowerCase().includes('sprs'));
        if (sprs.length > 0) {
          console.log(`  SPRS SHOPS IN TENANT ${doc.id}:`, JSON.stringify(sprs, null, 2));
        }
      }
    }
  }
}

inspectAllTenants().catch(console.error);
