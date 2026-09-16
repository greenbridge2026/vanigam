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

async function checkDirectStock() {
  const pDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products').get();
  const products = pDoc.data()?.data || [];

  console.log(`=== CHECKING DIRECT PRODUCT FIELDS FOR ALL ${products.length} PRODUCTS IN GSK_AGENCY ===\n`);

  products.forEach((p, idx) => {
    const isTarget = 
      (p.size && p.size.includes('2.25')) ||
      (p.brand && (p.brand.toLowerCase().includes('pepsi') || p.brand.toLowerCase().includes('coca'))) ||
      (p.name_en && (p.name_en.toLowerCase().includes('lehar') || p.name_en.toLowerCase().includes('pulpy') || p.name_en.toLowerCase().includes('7up')));

    if (isTarget) {
      console.log(`[Idx ${idx}] ID: ${p.id}`);
      console.log(`  name_en: "${p.name_en}" | name_ta: "${p.name_ta}" | name: "${p.name}"`);
      console.log(`  brand: "${p.brand}" | size: "${p.size}" | case_qty_rule: ${p.case_qty_rule}`);
      console.log(`  current_stock_bottles: ${p.current_stock_bottles} | status: ${p.status} | is_deleted: ${p.is_deleted}`);
      console.log('------------------------------------------------------------');
    }
  });
}

checkDirectStock().then(() => process.exit(0)).catch(console.error);
