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

async function inspectFullProducts() {
  const docRef = firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products');
  const snap = await docRef.get();
  if (!snap.exists) return;

  const products = snap.data().data || [];
  console.log(`=== FULL GSK_AGENCY PRODUCTS (${products.length}) ===\n`);

  products.forEach((p, idx) => {
    console.log(`[Index ${idx}] ID: ${p.id}`);
    console.log(`  name: "${p.name}" | name_ta: "${p.name_ta}"`);
    console.log(`  brand: "${p.brand}" | size: "${p.size}"`);
    console.log(`  stock_cases: ${p.stock_cases} | stock_bottles: ${p.stock_bottles} | stock_bottles_total: ${p.stock_bottles_total}`);
    console.log(`  price_per_case: ${p.price_per_case} | is_deleted: ${p.is_deleted}`);
    console.log('----------------------------------------------------');
  });
}

inspectFullProducts().then(() => process.exit(0)).catch(console.error);
