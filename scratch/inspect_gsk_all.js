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

async function inspectGskAll() {
  const docRef = firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products');
  const snap = await docRef.get();
  if (!snap.exists) {
    console.log('No products doc found');
    return;
  }

  const products = snap.data().data || [];
  console.log(`Total products in GSK_AGENCY: ${products.length}\n`);

  products.forEach((p, idx) => {
    console.log(JSON.stringify({ idx, id: p.id, name: p.name, brand: p.brand, size: p.size, stock_cases: p.stock_cases, stock_bottles: p.stock_bottles, stock_bottles_total: p.stock_bottles_total, price_per_case: p.price_per_case }));
  });
}

inspectGskAll().then(() => process.exit(0)).catch(console.error);
