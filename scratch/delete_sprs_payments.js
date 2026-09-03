import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});
const dbFs = getFirestore();

async function deleteSprsPayments() {
  console.log('--- Deleting Payments for Tenant SPRS ---');
  
  // 1. Delete payments doc in tenants/SPRS/tables/payments
  const payRef = dbFs.collection('tenants').doc('SPRS').collection('tables').doc('payments');
  const paySnap = await payRef.get();
  const deletedCount = paySnap.exists ? (paySnap.data().data || []).length : 0;
  
  await payRef.set({ data: [] });
  console.log(`✅ Cleared ${deletedCount} payment records in tenants/SPRS/tables/payments`);

  // 2. Clear outstanding_history in tenants/SPRS/tables/outstanding_history
  const ohRef = dbFs.collection('tenants').doc('SPRS').collection('tables').doc('outstanding_history');
  await ohRef.set({ data: [] });
  console.log('✅ Cleared outstanding_history in tenants/SPRS/tables/outstanding_history');

  // 3. Clear delivery_audit_trail in tenants/SPRS/tables/delivery_audit_trail
  const datRef = dbFs.collection('tenants').doc('SPRS').collection('tables').doc('delivery_audit_trail');
  await datRef.set({ data: [] });
  console.log('✅ Cleared delivery_audit_trail in tenants/SPRS/tables/delivery_audit_trail');

  // 4. Update _metadata in tenants/SPRS/tables/_metadata
  const metaRef = dbFs.collection('tenants').doc('SPRS').collection('tables').doc('_metadata');
  await metaRef.set({ last_updated: Date.now() });

  // 5. Also check db.json if backend is serving SPRS from local db.json
  const dbJsonPath = path.join(process.cwd(), 'backend', 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
    if (dbData.payments && dbData.payments.length > 0) {
      dbData.payments = [];
      dbData.outstanding_history = [];
      fs.writeFileSync(dbJsonPath, JSON.stringify(dbData, null, 2), 'utf8');
      console.log('✅ Also cleared payments in backend/db.json');
    }
  }

  console.log('🎉 SPRS Daily Collection Reports data successfully deleted!');
}

deleteSprsPayments().catch(console.error);
