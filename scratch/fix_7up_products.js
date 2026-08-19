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

function sanitize(str) {
  if (!str) return str;
  let res = str;
  res = res.replace(/7\s*வரை/gi, '7 அப்');
  res = res.replace(/7up/gi, '7 அப்');
  res = res.replace(/7\s*up/gi, '7 அப்');
  return res;
}

async function fixTenantProducts(tenantId) {
  console.log(`Checking products for tenant: ${tenantId}...`);
  const docRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('products');
  const snap = await docRef.get();
  if (!snap.exists) return;

  const products = snap.data().data || [];
  let updatedCount = 0;

  products.forEach(p => {
    const oldTa = p.name_ta;
    if (oldTa && /7\s*வரை|7up|7\s*up/i.test(oldTa)) {
      p.name_ta = sanitize(oldTa);
      console.log(`Updated product ${p.name_en}: "${oldTa}" -> "${p.name_ta}"`);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await docRef.set({ data: products }, { merge: true });
    console.log(`Saved ${updatedCount} updated products for tenant ${tenantId}`);
  } else {
    console.log(`No products needed fixing for tenant ${tenantId}`);
  }
}

async function main() {
  const tenants = ['GSK_AGENCY', 'default', 'TEST_1', 'SPRS', 'TEST_COMPANY', 'demo_tenant'];
  for (const tId of tenants) {
    try {
      await fixTenantProducts(tId);
    } catch (e) {
      console.error(`Error fixing tenant ${tId}:`, e);
    }
  }
  process.exit(0);
}

main();
