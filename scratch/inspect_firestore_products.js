import { db } from '../backend/firebaseAdmin.js';

async function inspectFirestoreProducts() {
  try {
    const docRef = db.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products');
    const snap = await docRef.get();
    if (snap.exists) {
      const products = snap.data().data || [];
      console.log(`Total products in Firestore for GSK_AGENCY: ${products.length}`);
      const matching7up = products.filter(p => {
        const name = ((p.name_en || '') + ' ' + (p.name_ta || '')).toLowerCase();
        return name.includes('7up') || name.includes('7 up') || name.includes('7 அப்');
      });
      console.log('Matching 7up products:', JSON.stringify(matching7up, null, 2));
    } else {
      console.log('Document tenants/GSK_AGENCY/tables/products does not exist');
    }
  } catch (err) {
    console.error('Error reading Firestore:', err);
  }
}

inspectFirestoreProducts();
