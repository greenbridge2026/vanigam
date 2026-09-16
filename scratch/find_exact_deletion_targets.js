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

// Helper to simulate stock calculation like backend/server.js does
async function analyzeGskProducts() {
  const tDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('products').get();
  const pData = tDoc.data()?.data || [];
  
  const purchasesDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('purchases').get();
  const purchases = purchasesDoc.data()?.data || [];

  const oiDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('order_items').get();
  const orderItems = oiDoc.data()?.data || [];

  const ordersDoc = await firestoreDb.collection('tenants').doc('GSK_AGENCY').collection('tables').doc('orders').get();
  const orders = ordersDoc.data()?.data || [];
  
  const validOrderIds = new Set(orders.filter(o => o.status !== 'cancelled').map(o => o.id));

  console.log(`Analyzing ${pData.length} products in GSK_AGENCY...`);

  const results = pData.map((p, idx) => {
    // Calculate stock bottles
    let totalPurchasedBottles = 0;
    const caseQty = Number(p.case_qty_rule || p.bottles_per_case || 24);

    if (p.stock_bottles_total !== undefined && p.stock_bottles_total !== null) {
      totalPurchasedBottles += Number(p.stock_bottles_total);
    } else {
      totalPurchasedBottles += (Number(p.stock_cases || 0) * caseQty) + Number(p.stock_bottles || 0);
    }

    purchases.forEach(pur => {
      (pur.items || []).forEach(item => {
        if (item.product_id === p.id) {
          totalPurchasedBottles += (Number(item.cases || 0) * caseQty) + Number(item.bottles || 0);
        }
      });
    });

    let totalSoldBottles = 0;
    orderItems.forEach(oi => {
      if (oi.product_id === p.id && validOrderIds.has(oi.order_id)) {
        totalSoldBottles += (Number(oi.cases || 0) * caseQty) + Number(oi.bottles || 0);
      }
    });

    const currentStockBottles = Math.max(0, totalPurchasedBottles - totalSoldBottles);
    const stockCases = Math.floor(currentStockBottles / caseQty);
    const stockBottlesRem = currentStockBottles % caseQty;

    return {
      index: idx,
      id: p.id,
      name: p.name,
      name_en: p.name_en,
      name_ta: p.name_ta,
      brand: p.brand,
      size: p.size,
      price: p.price_per_case,
      is_deleted: p.is_deleted,
      status: p.status,
      currentStockBottles,
      stockCases,
      stockBottlesRem
    };
  });

  console.log('\n--- 1. CANDIDATES FOR "7up 2.25 - ALL LINES SHOULD BE DELETED" ---');
  results.filter(r => {
    const b = (r.brand || '').toLowerCase();
    const s = (r.size || '').toLowerCase();
    const nTa = (r.name_ta || '').toLowerCase();
    const nEn = (r.name_en || r.name || '').toLowerCase();
    return s.includes('2.25') || nTa.includes('7அப்') || nEn.includes('7up') || nTa.includes('7up');
  }).forEach(r => {
    console.log(`[Idx ${r.index}] ID: ${r.id} | NameEn: "${r.name_en||r.name}" | NameTa: "${r.name_ta}" | Brand: "${r.brand}" | Size: "${r.size}" | Stock: ${r.stockCases}C, ${r.stockBottlesRem}B (${r.currentStockBottles} total bttls) | Deleted: ${r.is_deleted}`);
  });

  console.log('\n--- 2. CANDIDATES FOR "Lehar soda pepsi | 750ml - out of stock line item to be removed" ---');
  results.filter(r => {
    const b = (r.brand || '').toLowerCase();
    const s = (r.size || '').toLowerCase();
    const nTa = (r.name_ta || '').toLowerCase();
    const nEn = (r.name_en || r.name || '').toLowerCase();
    return (b.includes('pepsi') || nEn.includes('lehar') || nTa.includes('லெஹர்')) && (s.includes('750ml') || s.includes('750 ml'));
  }).forEach(r => {
    console.log(`[Idx ${r.index}] ID: ${r.id} | NameEn: "${r.name_en||r.name}" | NameTa: "${r.name_ta}" | Brand: "${r.brand}" | Size: "${r.size}" | Stock: ${r.stockCases}C, ${r.stockBottlesRem}B (${r.currentStockBottles} total bttls) | Deleted: ${r.is_deleted}`);
  });

  console.log('\n--- 3. CANDIDATES FOR "Pulpy Coca Cola | 250 ml with 70 stocks - this line to be removed" ---');
  results.filter(r => {
    const b = (r.brand || '').toLowerCase();
    const s = (r.size || '').toLowerCase();
    const nTa = (r.name_ta || '').toLowerCase();
    const nEn = (r.name_en || r.name || '').toLowerCase();
    return (b.includes('coca') || nEn.includes('pulpy') || nTa.includes('பல்பி')) && (s.includes('250ml') || s.includes('250 ml'));
  }).forEach(r => {
    console.log(`[Idx ${r.index}] ID: ${r.id} | NameEn: "${r.name_en||r.name}" | NameTa: "${r.name_ta}" | Brand: "${r.brand}" | Size: "${r.size}" | Stock: ${r.stockCases}C, ${r.stockBottlesRem}B (${r.currentStockBottles} total bttls) | Deleted: ${r.is_deleted}`);
  });
}

analyzeGskProducts().then(() => process.exit(0)).catch(console.error);
