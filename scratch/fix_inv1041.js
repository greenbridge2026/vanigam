import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'backend/serviceAccountKey.json';
let resolvedPath = path.resolve(__dirname, '..', saPath);
if (!fs.existsSync(resolvedPath)) {
  resolvedPath = path.resolve(__dirname, '../backend', saPath);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const firestoreDb = getFirestore();

async function fixTenant(tenantId) {
  console.log(`Fixing tenant: ${tenantId}`);
  const docRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('orders');
  const snap = await docRef.get();
  if (!snap.exists) return;

  const orders = snap.data().data || [];
  let updated = false;

  orders.forEach(order => {
    if (order.invoice_number === 'INV-1041') {
      console.log('Updating INV-1041 previous_outstanding to 24395');
      order.previous_outstanding = 24395;
      updated = true;
    }
  });

  if (updated) {
    await docRef.set({ data: orders }, { merge: true });
    console.log(`Saved updated orders for tenant ${tenantId}`);
  }
}

async function main() {
  await fixTenant('GSK_AGENCY');
  await fixTenant('default');
  process.exit(0);
}

main();
