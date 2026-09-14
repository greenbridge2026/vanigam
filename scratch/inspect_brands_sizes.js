import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function inspectBrandsSizes() {
  const tenantId = 'GSK_AGENCY';
  const productsSnap = await db.doc(`tenants/${tenantId}/tables/products`).get();
  const products = productsSnap.exists ? productsSnap.data().data || [] : [];
  
  const brands = new Set();
  const sizes = new Set();
  const brandSizeMap = {};

  products.forEach(p => {
    const b = (p.brand || 'Unbranded').trim();
    const s = (p.size || 'Other').trim();
    brands.add(b);
    sizes.add(s);
    if (!brandSizeMap[b]) brandSizeMap[b] = new Set();
    brandSizeMap[b].add(s);
  });

  console.log('Brands:', Array.from(brands));
  console.log('Sizes:', Array.from(sizes));
  console.log('\nBrand -> Sizes map:');
  Object.keys(brandSizeMap).forEach(b => {
    console.log(`  ${b}: [${Array.from(brandSizeMap[b]).join(', ')}]`);
  });
}

inspectBrandsSizes().catch(console.error);
