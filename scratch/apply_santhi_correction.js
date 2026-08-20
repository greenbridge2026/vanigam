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

async function fixTenantData(tenantId) {
  console.log(`\n==========================================`);
  console.log(`Processing Tenant: "${tenantId}"`);
  
  const tenantRef = firestoreDb.collection('tenants').doc(tenantId).collection('tables');
  
  const [shopsSnap, ordersSnap, paymentsSnap] = await Promise.all([
    tenantRef.doc('shops').get(),
    tenantRef.doc('orders').get(),
    tenantRef.doc('payments').get()
  ]);

  if (!shopsSnap.exists || !ordersSnap.exists) {
    console.log(`Tenant ${tenantId} table docs not found.`);
    return;
  }

  const shops = shopsSnap.data().data || [];
  const orders = ordersSnap.data().data || [];
  let payments = paymentsSnap.exists ? (paymentsSnap.data().data || []) : [];

  // Find Santhi Plastic shop
  const santhiShop = shops.find(s => 
    (s.name_en && s.name_en.toLowerCase().includes('santhi plastic')) || 
    (s.name && s.name.toLowerCase().includes('santhi plastic')) ||
    (s.name_ta && s.name_ta.includes('சாந்தி'))
  );

  if (!santhiShop) {
    console.log(`Santhi Plastic shop not found in tenant "${tenantId}".`);
    return;
  }

  console.log(`Found Santhi Plastic Shop: ID = ${santhiShop.id}, current outstanding_amount = ${santhiShop.outstanding_amount}`);

  // 1. Reset shop ledger outstanding_amount to 0
  santhiShop.outstanding_amount = 0;

  // 2. Find INV-1010 and INV-1041
  // First, sort orders by date to get correct invoice numbering if needed
  orders.sort((a, b) => {
    const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
    const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    return (a.id || '').localeCompare(b.id || '');
  });

  orders.forEach((o, idx) => {
    o.invoice_number = `INV-${1001 + idx}`;
  });

  const inv1010 = orders.find(o => o.invoice_number === 'INV-1010' || o.shop_id === santhiShop.id && o.net_amount === 9000);
  const inv1041 = orders.find(o => o.invoice_number === 'INV-1041' || o.shop_id === santhiShop.id && o.net_amount === 67610);

  // Fix INV-1010 -> Fully Paid
  if (inv1010) {
    console.log(`Found INV-1010 (ID: ${inv1010.id}): net_amount = ${inv1010.net_amount}`);
    // Remove old payments for inv1010
    payments = payments.filter(p => p.order_id !== inv1010.id);
    // Add full payment for INV-1010
    payments.push({
      id: `PAY-INV1010-FULL-${Date.now()}`,
      shop_id: santhiShop.id,
      order_id: inv1010.id,
      collected_amount: inv1010.net_amount || 9000,
      payment_mode: 'cash',
      transaction_number: 'CORRECTION-INV1010',
      reference_number: '',
      payment_date: new Date().toISOString()
    });
    console.log(`Added full payment of ₹${inv1010.net_amount || 9000} for INV-1010.`);
  } else {
    console.log(`INV-1010 not found directly.`);
  }

  // Fix INV-1041 -> Pay 43,215
  if (inv1041) {
    console.log(`Found INV-1041 (ID: ${inv1041.id}): net_amount = ${inv1041.net_amount}`);
    // Remove old payments for inv1041
    payments = payments.filter(p => p.order_id !== inv1041.id);
    // Add payment of 43215 for INV-1041
    payments.push({
      id: `PAY-INV1041-PARTIAL-${Date.now()}`,
      shop_id: santhiShop.id,
      order_id: inv1041.id,
      collected_amount: 43215,
      payment_mode: 'cash',
      transaction_number: 'CORRECTION-INV1041',
      reference_number: '',
      payment_date: new Date().toISOString()
    });
    console.log(`Added payment of ₹43,215 for INV-1041. Remaining due on INV-1041: ₹${(inv1041.net_amount || 67610) - 43215}`);
  } else {
    console.log(`INV-1041 not found directly.`);
  }

  // Save updated collections back to Firestore
  await tenantRef.doc('shops').set({ data: shops }, { merge: true });
  await tenantRef.doc('orders').set({ data: orders }, { merge: true });
  await tenantRef.doc('payments').set({ data: payments }, { merge: true });

  console.log(`Saved updated shops, orders, and payments for tenant "${tenantId}" in Firestore.`);
}

async function fixLocalJsonFiles() {
  const backendDir = path.join(__dirname, '../backend');
  const files = fs.readdirSync(backendDir);

  for (const f of files) {
    if (f.startsWith('db') && f.endsWith('.json')) {
      const p = path.join(backendDir, f);
      try {
        const content = fs.readFileSync(p, 'utf8');
        const dbObj = JSON.parse(content);

        let modified = false;

        if (Array.isArray(dbObj.shops)) {
          const santhiShop = dbObj.shops.find(s => 
            (s.name_en && s.name_en.toLowerCase().includes('santhi plastic')) || 
            (s.name && s.name.toLowerCase().includes('santhi plastic'))
          );
          if (santhiShop) {
            santhiShop.outstanding_amount = 0;
            modified = true;
          }
        }

        if (Array.isArray(dbObj.orders)) {
          dbObj.orders.sort((a, b) => {
            const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
            const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;
            return (a.id || '').localeCompare(b.id || '');
          });

          dbObj.orders.forEach((o, idx) => {
            o.invoice_number = `INV-${1001 + idx}`;
          });

          if (!Array.isArray(dbObj.payments)) {
            dbObj.payments = [];
          }

          const santhiShop = (dbObj.shops || []).find(s => 
            (s.name_en && s.name_en.toLowerCase().includes('santhi plastic')) || 
            (s.name && s.name.toLowerCase().includes('santhi plastic'))
          );

          if (santhiShop) {
            const inv1010 = dbObj.orders.find(o => o.invoice_number === 'INV-1010');
            const inv1041 = dbObj.orders.find(o => o.invoice_number === 'INV-1041');

            if (inv1010) {
              dbObj.payments = dbObj.payments.filter(p => p.order_id !== inv1010.id);
              dbObj.payments.push({
                id: `PAY-INV1010-FULL-${Date.now()}`,
                shop_id: santhiShop.id,
                order_id: inv1010.id,
                collected_amount: inv1010.net_amount || 9000,
                payment_mode: 'cash',
                transaction_number: 'CORRECTION-INV1010',
                reference_number: '',
                payment_date: new Date().toISOString()
              });
              modified = true;
            }

            if (inv1041) {
              dbObj.payments = dbObj.payments.filter(p => p.order_id !== inv1041.id);
              dbObj.payments.push({
                id: `PAY-INV1041-PARTIAL-${Date.now()}`,
                shop_id: santhiShop.id,
                order_id: inv1041.id,
                collected_amount: 43215,
                payment_mode: 'cash',
                transaction_number: 'CORRECTION-INV1041',
                reference_number: '',
                payment_date: new Date().toISOString()
              });
              modified = true;
            }
          }
        }

        if (modified) {
          fs.writeFileSync(p, JSON.stringify(dbObj, null, 2), 'utf8');
          console.log(`Updated local JSON file: ${f}`);
        }
      } catch (err) {
        console.error(`Error processing file ${f}:`, err);
      }
    }
  }
}

async function main() {
  const tenants = ['GSK_AGENCY', 'default', 'TEST_COMPANY', 'demo_tenant'];
  for (const tId of tenants) {
    try {
      await fixTenantData(tId);
    } catch (e) {
      console.error(`Error processing tenant ${tId}:`, e);
    }
  }
  await fixLocalJsonFiles();
  console.log('\n✅ Completed applying account corrections for Santhi Plastic ( Wholesale )!');
  process.exit(0);
}

main();
