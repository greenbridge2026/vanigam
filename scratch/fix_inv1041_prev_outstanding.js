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

async function fixTenantOrder(tenantId) {
  console.log(`Checking tenant: ${tenantId}`);
  const docRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('orders');
  const snap = await docRef.get();
  if (!snap.exists) return;

  const orders = snap.data().data || [];
  let updated = false;

  orders.forEach(order => {
    if (order.invoice_number === 'INV-1041') {
      console.log(`Updating INV-1041 previous_outstanding from ${order.previous_outstanding} to 0`);
      order.previous_outstanding = 0;
      updated = true;
    }
  });

  if (updated) {
    await docRef.set({ data: orders }, { merge: true });
    console.log(`Saved updated orders for tenant ${tenantId}`);
  }
}

async function fixLocalJsonFiles() {
  const backendDir = path.join(__dirname, '../backend');
  const files = fs.readdirSync(backendDir);

  for (const f of files) {
    if (f.startsWith('db') && f.endsWith('.json')) {
      const p = path.join(backendDir, f);
      try {
        const content = fs.readFileSync(p, 'utf8');
        const dbObj = JSON.parse(content);
        if (Array.isArray(dbObj.orders)) {
          let fileUpdated = false;
          dbObj.orders.forEach(order => {
            if (order.invoice_number === 'INV-1041') {
              console.log(`Local file ${f}: Updating INV-1041 previous_outstanding to 0`);
              order.previous_outstanding = 0;
              fileUpdated = true;
            }
          });
          if (fileUpdated) {
            fs.writeFileSync(p, JSON.stringify(dbObj, null, 2), 'utf8');
          }
        }
      } catch (err) {}
    }
  }
}

async function main() {
  const tenants = ['GSK_AGENCY', 'default', 'TEST_COMPANY', 'demo_tenant'];
  for (const tId of tenants) {
    try {
      await fixTenantOrder(tId);
    } catch (e) {
      console.error(`Error processing tenant ${tId}:`, e);
    }
  }
  await fixLocalJsonFiles();
  console.log('✅ Updated INV-1041 previous_outstanding to 0 successfully!');
  process.exit(0);
}

main();
