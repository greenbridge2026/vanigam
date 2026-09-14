import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function testReportData() {
  const tenantId = 'GSK_AGENCY';
  
  const [pSnap, oSnap, oiSnap, purSnap] = await Promise.all([
    db.doc(`tenants/${tenantId}/tables/products`).get(),
    db.doc(`tenants/${tenantId}/tables/orders`).get(),
    db.doc(`tenants/${tenantId}/tables/order_items`).get(),
    db.doc(`tenants/${tenantId}/tables/purchases`).get()
  ]);

  const products = pSnap.exists ? pSnap.data().data || [] : [];
  const orders = oSnap.exists ? oSnap.data().data || [] : [];
  const orderItems = oiSnap.exists ? oiSnap.data().data || [] : [];
  const purchases = purSnap.exists ? purSnap.data().data || [] : [];

  console.log(`Loaded ${products.length} products, ${orders.length} orders, ${orderItems.length} order items, ${purchases.length} purchases.`);

  const normalizeBrand = (b) => {
    if (!b) return 'Unbranded';
    const clean = b.trim();
    const lower = clean.toLowerCase();
    if (lower === 'pepsi') return 'Pepsi';
    if (lower === 'coca-cola' || lower === 'coca cola') return 'Coca-Cola';
    if (lower === 'frooti') return 'Frooti';
    if (lower === 'bovonto') return 'Bovonto';
    if (lower === 'k.c brands' || lower === 'kc brands') return 'K.C Brands';
    if (lower === 'daily brands') return 'Daily Brands';
    if (lower === 'fantasy') return 'Fantasy';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const grouped = {};
  products.forEach(p => {
    const b = normalizeBrand(p.brand);
    const s = (p.size || 'Standard').trim();
    if (!grouped[b]) grouped[b] = {};
    if (!grouped[b][s]) {
      grouped[b][s] = {
        brand: b,
        size: s,
        productsCount: 0,
        currentStockBottles: 0,
        productIds: []
      };
    }
    grouped[b][s].productsCount++;
    grouped[b][s].productIds.push(p.id);
    grouped[b][s].currentStockBottles += (p.current_stock_bottles || 0);
  });

  console.log('\n--- Grouped Brand & Size Breakdown ---');
  Object.keys(grouped).sort().forEach(b => {
    console.log(`Brand: ${b}`);
    Object.keys(grouped[b]).sort().forEach(s => {
      const g = grouped[b][s];
      console.log(`  - Size: ${s.padEnd(10)} | Products: ${g.productsCount} | Total Stock Bottles: ${g.currentStockBottles}`);
    });
  });
}

testReportData().catch(console.error);
