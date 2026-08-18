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

async function main() {
  const collections = await firestoreDb.listCollections();
  for (const col of collections) {
    console.log('Collection:', col.id);
    const snap = await col.get();
    snap.forEach(doc => {
      console.log(`  Doc: ${doc.id}`);
      if (doc.id === 'orders') {
        const data = doc.data().data || [];
        console.log(`    -> Orders count: ${data.length}`);
        data.slice(0, 5).forEach((o, i) => {
          console.log(`       [${i}] ID: ${o.id}, Invoice: ${o.invoice_number}, Date: ${o.order_date}`);
        });
      }
    });
  }

  // Also check nested root docs
  const tablesRef = firestoreDb.collection('tables');
  const tablesSnap = await tablesRef.get();
  console.log(`\nTables subdocs count: ${tablesSnap.docs.length}`);
  tablesSnap.forEach(doc => {
    const data = doc.data().data || [];
    console.log(`Table Doc: ${doc.id} (data length: ${Array.isArray(data) ? data.length : 'object'})`);
    if (doc.id === 'orders') {
      data.slice(0, 10).forEach((o, i) => {
        console.log(`   Order [${i}]: ${o.invoice_number} | Shop: ${o.shop_id} | Date: ${o.order_date}`);
      });
    }
  });

  process.exit(0);
}

main();
