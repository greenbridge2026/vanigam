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

async function inspectLeharAndPulpyStock() {
  const pDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products').get();
  const products = pDoc.data()?.data || [];

  const purDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('purchases').get();
  const purchases = purDoc.data()?.data || [];

  const oiDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('order_items').get();
  const orderItems = oiDoc.data()?.data || [];

  const ordDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('orders').get();
  const orders = ordDoc.data()?.data || [];
  const validOrderIds = new Set(orders.filter(o => o.status !== 'cancelled').map(o => o.id));

  const targetIds = [
    'p_1785909892252_import_53', // Lehar Soda (Pepsi | 750 ml)
    'p_1785912446218',           // Lehar soda (pepsi | 750ml)
    'p_1785909892252_import_57', // Pulpy Orange (Coca-Cola | 250 ml)
    'p_1785914769511_import_2'   // Pulpy (Coca Cola | 250 ml)
  ];

  targetIds.forEach(id => {
    const prod = products.find(p => p.id === id);
    if (!prod) {
      console.log(`Product ID ${id} not found.`);
      return;
    }

    console.log(`\n=== PRODUCT ID: ${id} ===`);
    console.log(`  name: "${prod.name}" | name_en: "${prod.name_en}" | name_ta: "${prod.name_ta}"`);
    console.log(`  brand: "${prod.brand}" | size: "${prod.size}" | price: ${prod.price_per_case}`);
    console.log(`  initial stock_cases: ${prod.stock_cases} | stock_bottles: ${prod.stock_bottles} | stock_bottles_total: ${prod.stock_bottles_total}`);

    // Count purchases
    let purchasedBottles = 0;
    const caseQty = Number(prod.case_qty_rule || prod.bottles_per_case || 24);
    if (prod.stock_bottles_total !== undefined && prod.stock_bottles_total !== null) {
      purchasedBottles += Number(prod.stock_bottles_total);
    } else {
      purchasedBottles += (Number(prod.stock_cases || 0) * caseQty) + Number(prod.stock_bottles || 0);
    }

    purchases.forEach(pur => {
      (pur.items || []).forEach(item => {
        if (item.product_id === id) {
          console.log(`  Purchased: ${item.cases} cases, ${item.bottles} bottles in purchase ${pur.id}`);
          purchasedBottles += (Number(item.cases || 0) * caseQty) + Number(item.bottles || 0);
        }
      });
    });

    let soldBottles = 0;
    orderItems.forEach(oi => {
      if (oi.product_id === id && validOrderIds.has(oi.order_id)) {
        soldBottles += (Number(oi.cases || 0) * caseQty) + Number(oi.bottles || 0);
      }
    });

    const netBottles = purchasedBottles - soldBottles;
    console.log(`  Total Purchased Bottles: ${purchasedBottles}`);
    console.log(`  Total Sold Bottles: ${soldBottles}`);
    console.log(`  Net Current Stock: ${netBottles} bottles (${Math.floor(netBottles / caseQty)} Cases, ${netBottles % caseQty} Bottles)`);
  });
}

inspectLeharAndPulpyStock().then(() => process.exit(0)).catch(console.error);
