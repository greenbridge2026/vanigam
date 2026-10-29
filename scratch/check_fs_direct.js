import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('backend/serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const dbFs = getFirestore();

async function checkFsDoc() {
  const oSnap = await dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('orders').get();
  const orders = oSnap.data()?.data || [];
  const o = orders.find(x => x.invoice_number === 'INV-1505');
  console.log('Firestore Orders Doc -> INV-1505:', o);

  const dSnap = await dbFs.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('deliveries').get();
  const deliveries = dSnap.data()?.data || [];
  const d = deliveries.find(x => x.order_id === o?.id);
  console.log('Firestore Deliveries Doc -> delivery for INV-1505:', d);
}

checkFsDoc();
