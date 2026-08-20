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

async function updateSettings(tenantId) {
  const docRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('settings');
  const snap = await docRef.get();
  const current = snap.exists ? (snap.data().data || {}) : {};
  
  const updated = {
    ...current,
    company_name: current.company_name || "GSK Agency",
    company_address: current.company_address || "Cooldrinks Shop - Tindivanam",
    company_gst: current.company_gst || "33CWRPK4071L1Z2",
    upi_mobile: "gskumar9345@okicici"
  };

  await docRef.set({ data: updated }, { merge: true });
  console.log(`Updated settings for tenant ${tenantId} to upi_mobile = gskumar9345@okicici`);
}

async function main() {
  const tenants = ['GSK_AGENCY', 'default', 'TEST_COMPANY', 'demo_tenant'];
  for (const tId of tenants) {
    try {
      await updateSettings(tId);
    } catch (e) {
      console.error(`Error updating settings for ${tId}:`, e);
    }
  }
  process.exit(0);
}

main();
