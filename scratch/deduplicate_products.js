import { db } from '../backend/firebaseAdmin.js';

async function deduplicateProducts() {
  try {
    const tenantId = 'GSK_AGENCY';
    const docRef = db.collection('tenants').doc(tenantId).collection('tables').doc('products');
    const snap = await docRef.get();
    
    if (!snap.exists) {
      console.log('No products doc found');
      return;
    }

    const products = snap.data().data || [];
    console.log(`Initial total products count: ${products.length}`);

    const uniqueMap = new Map();
    const deduplicated = [];
    const removedIds = [];

    for (const p of products) {
      const nameKey = (p.name_en || p.name_ta || '').toLowerCase().trim().replace(/\s+/g, '');
      const brandKey = (p.brand || '').toLowerCase().trim().replace(/\s+/g, '');
      const sizeKey = (p.size || '').toLowerCase().trim().replace(/\s+/g, '');
      const key = `${nameKey}_${brandKey}_${sizeKey}`;

      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key);
        // Merge stock into existing product
        existing.current_stock_bottles = (existing.current_stock_bottles || 0) + (p.current_stock_bottles || 0);
        removedIds.push(p.id);
        console.log(`Merged duplicate product: ${p.name_en} (${p.size}) [ID: ${p.id}] into [ID: ${existing.id}]`);
      } else {
        uniqueMap.set(key, { ...p });
        deduplicated.push(uniqueMap.get(key));
      }
    }

    console.log(`Deduplicated count: ${deduplicated.length}. Removed duplicates: ${removedIds.length}`);

    await docRef.set({ data: deduplicated }, { merge: true });

    // Update metadata timestamp
    const metaRef = db.collection('tenants').doc(tenantId).collection('tables').doc('_metadata');
    await metaRef.set({ last_updated: Date.now() }, { merge: true });

    console.log('Successfully updated Firestore with deduplicated products!');
  } catch (err) {
    console.error('Error deduplicating products:', err);
  }
}

deduplicateProducts();
