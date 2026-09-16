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

async function inspectGskProducts() {
  const tenants = ['GSK_AGENCY', 'gsk_agency', 'GSK', 'gsk', 'default'];
  
  for (const tId of tenants) {
    console.log(`\n=== Checking Tenant: ${tId} ===`);
    
    // Check Firestore
    const docRef = firestoreDb.collection('tenants').doc(tId).collection('tables').doc('products');
    const snap = await docRef.get();
    if (snap.exists) {
      const products = snap.data().data || [];
      console.log(`Firestore [${tId}] Products count: ${products.length}`);
      products.forEach((p, idx) => {
        console.log(`  [${idx}] ID: ${p.id} | Name: "${p.name}" | Brand: "${p.brand}" | Size: "${p.size}" | StockCases: ${p.stock_cases} | StockBottles: ${p.stock_bottles} | TotalBottles: ${p.stock_bottles_total} | Price: ${p.price_per_case}`);
      });
    } else {
      console.log(`Firestore [${tId}] doc does not exist.`);
    }

    // Check Local JSON DB
    const localPath = path.join(__dirname, `../backend/db_${tId}.json`);
    if (fs.existsSync(localPath)) {
      const localData = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      const localProducts = localData.products || [];
      console.log(`Local File [${tId}] Products count: ${localProducts.length}`);
      localProducts.forEach((p, idx) => {
        console.log(`  [${idx}] ID: ${p.id} | Name: "${p.name}" | Brand: "${p.brand}" | Size: "${p.size}" | StockCases: ${p.stock_cases} | StockBottles: ${p.stock_bottles} | TotalBottles: ${p.stock_bottles_total} | Price: ${p.price_per_case}`);
      });
    }
  }
}

inspectGskProducts().then(() => process.exit(0)).catch(console.error);
