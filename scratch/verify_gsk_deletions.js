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

async function verifyDeletions() {
  const pDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products').get();
  const products = pDoc.data()?.data || [];

  console.log(`=== VERIFYING REMAINING PRODUCTS FOR GSK_AGENCY (${products.length} total) ===\n`);

  console.log('1. Checking 7up 2.25 lines:');
  const remaining7up225 = products.filter(p => (p.size || '').includes('2.25') && ((p.name_en||'').toLowerCase().includes('7up') || (p.name_ta||'').includes('7அப்')));
  console.log(`   Remaining count: ${remaining7up225.length}`);
  remaining7up225.forEach(p => console.log(`   - ${p.id} | ${p.name_en} | ${p.brand} | ${p.size}`));

  console.log('\n2. Checking Lehar Soda 750ml lines:');
  const remainingLehar = products.filter(p => (p.size || '').includes('750') && ((p.name_en||'').toLowerCase().includes('lehar') || (p.name_ta||'').includes('லெஹர்')));
  console.log(`   Remaining count: ${remainingLehar.length}`);
  remainingLehar.forEach(p => console.log(`   - ${p.id} | NameEn: "${p.name_en}" | Brand: "${p.brand}" | Size: "${p.size}" | Stock: ${p.current_stock_bottles} bottles`));

  console.log('\n3. Checking Pulpy 250ml lines:');
  const remainingPulpy = products.filter(p => (p.size || '').includes('250') && ((p.name_en||'').toLowerCase().includes('pulpy') || (p.name_ta||'').includes('பல்பி')));
  console.log(`   Remaining count: ${remainingPulpy.length}`);
  remainingPulpy.forEach(p => console.log(`   - ${p.id} | NameEn: "${p.name_en}" | Brand: "${p.brand}" | Size: "${p.size}" | Stock: ${p.current_stock_bottles} bottles`));
}

verifyDeletions().then(() => process.exit(0)).catch(console.error);
