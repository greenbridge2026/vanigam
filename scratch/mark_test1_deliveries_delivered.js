import { initializeApp, cert, getApps } from 'firebase-admin/app';
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

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const firestoreDb = getFirestore();

async function main() {
  const tenantId = 'TEST_1';
  const tablesRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  const getTable = async (t) => (await tablesRef.doc(t).get()).data()?.data || [];

  const deliveries = await getTable('deliveries');
  console.log(`Found ${deliveries.length} deliveries for tenant ${tenantId}`);

  let updatedCount = 0;
  deliveries.forEach(d => {
    if (d.status !== 'delivered' && d.status !== 'not_delivered' && d.status !== 'returned') {
      d.status = 'delivered';
      updatedCount++;
    }
  });

  await tablesRef.doc('deliveries').set({ data: deliveries });
  console.log(`Updated ${updatedCount} deliveries to status 'delivered' in Firestore for tenant ${tenantId}`);

  process.exit(0);
}

main().catch(console.error);
