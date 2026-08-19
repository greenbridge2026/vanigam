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

async function main() {
  const sysSnap = await firestoreDb.collection('system').doc('config').get();
  let tenantList = ['default'];
  if (sysSnap.exists) {
    const sysData = sysSnap.data();
    if (sysData.tenants) {
      tenantList = sysData.tenants.map(t => t.id);
    }
  }
  console.log('Discovered Tenants:', tenantList);

  for (const tenantId of tenantList) {
    const ordersSnap = await firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('orders').get();
    if (ordersSnap.exists) {
      const orders = ordersSnap.data().data || [];
      console.log(`Tenant ${tenantId} has ${orders.length} orders`);
      const target = orders.find(o => o.invoice_number === 'INV-1041' || (o.invoice_number && o.invoice_number.includes('1041')));
      if (target) {
        console.log(`FOUND INV-1041 in tenant: ${tenantId}`);
        console.log('ORDER:', JSON.stringify(target, null, 2));

        const shopsSnap = await firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('shops').get();
        if (shopsSnap.exists) {
          const shops = shopsSnap.data().data || [];
          const shop = shops.find(s => s.id === target.shop_id);
          console.log('SHOP DATA:', JSON.stringify(shop, null, 2));
        }

        const paymentsSnap = await firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('payments').get();
        if (paymentsSnap.exists) {
          const payments = paymentsSnap.data().data || [];
          const orderPayments = payments.filter(p => p.order_id === target.id || p.shop_id === target.shop_id);
          console.log('PAYMENTS:', JSON.stringify(orderPayments, null, 2));
        }
      }
    }
  }
  process.exit(0);
}

main();
