import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const saPath = 'backend/serviceAccountKey.json';
let resolvedPath = path.resolve(__dirname, '..', saPath);
const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const firestoreDb = getFirestore();

async function main() {
  const tenantId = 'GSK_AGENCY';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  
  const shopsDoc = await tablesRef.doc('shops').get();
  const shops = shopsDoc.data().data || [];

  const archana = shops.find(s => (s.name_en || '').toLowerCase().includes('archana') || (s.name_ta || '').includes('அர்ச்சனா'));

  if (archana) {
    console.log(`Setting New Archana outstanding_amount to ₹19,410...`);
    archana.outstanding_amount = 19410;
    await tablesRef.doc('shops').set({ data: shops });
    await tablesRef.doc('_metadata').set({ last_updated: Date.now() }, { merge: true });
    console.log(`✅ Successfully updated New Archana outstanding_amount to ₹19,410 in Firestore!`);
  }

  process.exit(0);
}

main().catch(console.error);
