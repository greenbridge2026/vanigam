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

const targetIdsToDelete = new Set([
  'p_1789547925833',           // 2.25 7up (992 C)
  'p_1787892609997',           // 7up 2.25 (Out of Stock)
  'p_1788194019585',           // 7up 2.25 (Out of Stock)
  'p_1788194027154',           // 7up 2.25 (Out of Stock)
  'p_1789101268314',           // 7up 2.25 (175 C, 6 B)
  'p_1785912446218',           // Lehar soda pepsi | 750ml (Out of Stock)
  'p_1785914769511_import_2'   // Pulpy Coca Cola | 250 ml (70 C)
]);

async function deleteTargetProducts() {
  console.log('=== REMOVING TARGET PRODUCTS FOR GSK_AGENCY ===\n');

  // 1. Firestore Update
  const docRef = firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products');
  const snap = await docRef.get();
  
  if (snap.exists) {
    const products = snap.data().data || [];
    console.log(`Initial product count in Firestore GSK_AGENCY: ${products.length}`);
    
    const filteredProducts = products.filter(p => !targetIdsToDelete.has(p.id));
    const removedCount = products.length - filteredProducts.length;

    console.log(`Filter results: Removed ${removedCount} items. New count: ${filteredProducts.length}`);

    await docRef.set({ data: filteredProducts }, { merge: true });

    // Update metadata timestamp
    const metaRef = firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('_metadata');
    await metaRef.set({ last_updated: Date.now() }, { merge: true });

    console.log('Successfully updated Firestore GSK_AGENCY products collection & _metadata.');
  }

  // 2. Local JSON Files Update if present
  const backendDir = path.join(__dirname, '../backend');
  const files = fs.readdirSync(backendDir).filter(f => f.startsWith('db_') && f.endsWith('.json'));

  for (const f of files) {
    const filePath = path.join(backendDir, f);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data.products)) {
        const origCount = data.products.length;
        data.products = data.products.filter(p => !targetIdsToDelete.has(p.id));
        if (data.products.length !== origCount) {
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
          console.log(`Updated local JSON file ${f}: Removed ${origCount - data.products.length} products.`);
        }
      }
    } catch (e) {
      console.error(`Error updating local DB file ${f}:`, e.message);
    }
  }

  // 3. Make HTTP call to running backend server if alive to clear in-memory cache
  try {
    const res = await fetch('http://localhost:5001/api/products', {
      headers: { 'x-tenant-id': 'GSK_AGENCY' }
    });
    if (res.ok) {
      const liveProds = await res.json();
      console.log(`Verified live backend API (/api/products) for GSK_AGENCY: returned ${liveProds.length} products.`);
    }
  } catch (e) {
    console.log('Live backend server call check:', e.message);
  }
}

deleteTargetProducts().then(() => process.exit(0)).catch(console.error);
