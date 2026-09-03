import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');

let dbFs = null;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount)
  });
  dbFs = getFirestore();
}

async function inspectPayments() {
  console.log('--- Inspecting Payments in db.json ---');
  const dbJsonPath = path.join(process.cwd(), 'backend', 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
    const payments = dbData.payments || [];
    const shops = dbData.shops || [];
    
    console.log(`Total payments in db.json: ${payments.length}`);
    const targetPayments = payments.filter(p => [51630, 35000, 6000].includes(Number(p.collected_amount)));
    console.log('Target payments in db.json:', JSON.stringify(targetPayments, null, 2));

    const sprsShops = shops.filter(s => (s.name_en || '').toUpperCase().includes('SPRS') || (s.name || '').toUpperCase().includes('SPRS') || (s.id || '').toLowerCase().includes('sprs'));
    console.log('SPRS shops in db.json:', JSON.stringify(sprsShops, null, 2));
  }

  if (dbFs) {
    console.log('\n--- Inspecting Payments in Firestore (tenants/GSK_AGENCY) ---');
    const payDoc = await dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('payments').get();
    if (payDoc.exists) {
      const payments = payDoc.data().data || [];
      console.log(`Total payments in Firestore GSK_AGENCY: ${payments.length}`);
      const targetPayments = payments.filter(p => [51630, 35000, 6000].includes(Number(p.collected_amount)));
      console.log('Target payments in Firestore:', JSON.stringify(targetPayments, null, 2));
    }

    const shopDoc = await dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('shops').get();
    if (shopDoc.exists) {
      const shops = shopDoc.data().data || [];
      const sprsShops = shops.filter(s => (s.name_en || '').toUpperCase().includes('SPRS') || (s.name || '').toUpperCase().includes('SPRS') || (s.id || '').toLowerCase().includes('sprs'));
      console.log('SPRS shops in Firestore:', JSON.stringify(sprsShops, null, 2));
    }
  }
}

inspectPayments().catch(console.error);
