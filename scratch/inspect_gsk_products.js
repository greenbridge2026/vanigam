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

async function inspectProducts() {
  console.log('=== Checking Local JSON DB Files ===');
  const backendDir = path.join(process.cwd(), 'backend');
  const files = fs.readdirSync(backendDir).filter(f => f.startsWith('db_') && f.endsWith('.json'));
  
  for (const f of files) {
    const tenantId = f.replace('db_', '').replace('.json', '');
    try {
      const data = JSON.parse(fs.readFileSync(path.join(backendDir, f), 'utf8'));
      console.log(`Local Tenant ID: ${tenantId}`);
      if (data.products && data.products.length > 0) {
        console.log(`  Products count: ${data.products.length}`);
        data.products.forEach((p, idx) => {
          console.log(`    [${idx}] ID: ${p.id} | Name: ${p.name} | Brand: ${p.brand} | Size: ${p.size} | Stock: ${p.stock_cases}C ${p.stock_bottles}B (${p.stock_bottles_total || 0} total bottles) | Price: ${p.price_per_case}`);
        });
      }
    } catch (e) {
      console.error(`Error reading ${f}:`, e.message);
    }
  }

  if (dbFs) {
    console.log('\n=== Checking Firestore DB ===');
    const tenantsSnap = await dbFs.collection('tenants').get();
    console.log(`Total Firestore tenants: ${tenantsSnap.docs.length}`);
    for (const doc of tenantsSnap.docs) {
      const tenantId = doc.id;
      const productsDoc = await dbFs.collection('tenants').doc(tenantId).collection('tables').doc('products').get();
      const agencyDoc = await dbFs.collection('tenants').doc(tenantId).collection('tables').doc('agency_details').get();
      const agencyData = agencyDoc.exists ? agencyDoc.data() : {};
      
      console.log(`\nFirestore Tenant ID: ${tenantId} | Agency Data: ${JSON.stringify(agencyData)}`);
      
      if (productsDoc.exists) {
        const products = productsDoc.data().data || [];
        console.log(`  Products count: ${products.length}`);
        products.forEach((p, idx) => {
          console.log(`    [${idx}] ID: ${p.id} | Name: ${p.name} | Brand: ${p.brand} | Size: ${p.size} | Stock: ${p.stock_cases}C ${p.stock_bottles}B (${p.stock_bottles_total || 0} total bottles) | Price: ${p.price_per_case}`);
        });
      }
    }
  }
}

inspectProducts().catch(console.error);
