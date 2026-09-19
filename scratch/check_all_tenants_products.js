import { db } from '../backend/firebaseAdmin.js';

async function listAllTenantsProducts() {
  try {
    const tenantsSnap = await db.collection('tenants').get();
    console.log(`Found ${tenantsSnap.docs.length} tenants in Firestore.`);
    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const productsDoc = await db.collection('tenants').doc(tenantId).collection('tables').doc('products').get();
      if (productsDoc.exists) {
        const products = productsDoc.data().data || [];
        console.log(`Tenant '${tenantId}': ${products.length} products.`);
        const matching = products.filter(p => (p.name_en || '').toLowerCase().includes('7') || (p.size || '').includes('2.25'));
        console.log(`  Matching 7 / 2.25L products (${matching.length}):`, matching.map(m => `${m.name_en} (${m.size})`));
      } else {
        console.log(`Tenant '${tenantId}': No products document.`);
      }
    }
  } catch (err) {
    console.error('Error listing tenants products:', err);
  }
}

listAllTenantsProducts();
