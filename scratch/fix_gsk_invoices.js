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

async function fixTenantInvoices(tenantId) {
  console.log(`Checking tenant document: tenants/${tenantId}/tables/orders ...`);
  const ordersDocRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables').doc('orders');
  const docSnap = await ordersDocRef.get();

  if (!docSnap.exists) {
    console.log(`Document tenants/${tenantId}/tables/orders does NOT exist.`);
    return;
  }

  const dataObj = docSnap.data();
  const orders = dataObj.data || [];
  console.log(`Found ${orders.length} orders in tenants/${tenantId}/tables/orders`);

  if (orders.length === 0) return;

  // Sort orders by order_date or creation ID
  orders.sort((a, b) => {
    const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
    const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    return (a.id || '').localeCompare(b.id || '');
  });

  let changedCount = 0;
  orders.forEach((order, index) => {
    const expected = `INV-${1001 + index}`;
    if (order.invoice_number !== expected) {
      console.log(`[${index}] Order ${order.id} (${order.order_date?.slice(0, 10)}): "${order.invoice_number}" -> "${expected}"`);
      order.invoice_number = expected;
      changedCount++;
    }
  });

  if (changedCount > 0) {
    await ordersDocRef.set({ data: orders }, { merge: true });
    console.log(`🎉 SUCCESS! Re-indexed and saved ${changedCount} orders for tenant "${tenantId}" in Firestore!`);
  } else {
    console.log(`All invoice numbers already starting at INV-1001 sequentially for tenant "${tenantId}"!`);
  }
}

async function main() {
  const tenants = ['GSK_Agency', 'default', 'TEST_COMPANY', 'demo_tenant'];
  for (const tId of tenants) {
    try {
      await fixTenantInvoices(tId);
    } catch (e) {
      console.error(`Error processing tenant ${tId}:`, e);
    }
  }

  // Also check local json files if any exist
  const backendFiles = fs.readdirSync(path.join(__dirname, '../backend'));
  for (const f of backendFiles) {
    if (f.startsWith('db') && f.endsWith('.json')) {
      const p = path.join(__dirname, '../backend', f);
      try {
        const content = fs.readFileSync(p, 'utf8');
        const dbJson = JSON.parse(content);
        if (Array.isArray(dbJson.orders) && dbJson.orders.length > 0) {
          dbJson.orders.sort((a, b) => {
            const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
            const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;
            return (a.id || '').localeCompare(b.id || '');
          });
          let fileChanged = 0;
          dbJson.orders.forEach((o, i) => {
            const exp = `INV-${1001 + i}`;
            if (o.invoice_number !== exp) {
              o.invoice_number = exp;
              fileChanged++;
            }
          });
          if (fileChanged > 0) {
            fs.writeFileSync(p, JSON.stringify(dbJson, null, 2), 'utf8');
            console.log(`Updated ${fileChanged} orders in local file ${f}`);
          }
        }
      } catch (err) {}
    }
  }

  process.exit(0);
}

main();
