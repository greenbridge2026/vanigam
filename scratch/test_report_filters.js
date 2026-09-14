import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function testFilters() {
  const tenantId = 'GSK_AGENCY';
  
  const [pSnap, oSnap, oiSnap, purSnap, sSnap, rSnap] = await Promise.all([
    db.doc(`tenants/${tenantId}/tables/products`).get(),
    db.doc(`tenants/${tenantId}/tables/orders`).get(),
    db.doc(`tenants/${tenantId}/tables/order_items`).get(),
    db.doc(`tenants/${tenantId}/tables/purchases`).get(),
    db.doc(`tenants/${tenantId}/tables/shops`).get(),
    db.doc(`tenants/${tenantId}/tables/routes`).get()
  ]);

  const products = pSnap.exists ? pSnap.data().data || [] : [];
  const orders = oSnap.exists ? oSnap.data().data || [] : [];
  const orderItems = oiSnap.exists ? oiSnap.data().data || [] : [];
  const purchases = purSnap.exists ? purSnap.data().data || [] : [];
  const shops = sSnap.exists ? sSnap.data().data || [] : [];
  const routes = rSnap.exists ? rSnap.data().data || [] : [];

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

  const normalizeSize = (s) => {
    if (!s) return 'Standard';
    let clean = s.trim();
    // Normalize ml spacing e.g. 400ml -> 400 ml, 750ml -> 750 ml, 350ml -> 350 ml
    clean = clean.replace(/(\d+)\s*ml/i, '$1 ml');
    clean = clean.replace(/(\d+)\s*l$/i, '$1 L');
    if (clean === '2.25') return '2.25 L';
    if (clean === '1.2') return '1.2 L';
    return clean;
  };

  function runAggregation(filters = {}) {
    const { dateFrom, dateTo, brandFilter, sizeFilter, routeFilter, shopTypeFilter } = filters;

    // Filter orders
    const filteredOrders = orders.filter(o => {
      if (o.status === 'cancelled') return false;
      const oDate = o.order_date ? o.order_date.slice(0, 10) : '';
      if (dateFrom && (!oDate || oDate < dateFrom)) return false;
      if (dateTo && (!oDate || oDate > dateTo)) return false;

      const shop = shops.find(s => s.id === o.shop_id);
      const rId = o.route_id || (shop ? shop.route_id : '');
      if (routeFilter && rId !== routeFilter) return false;

      if (shopTypeFilter) {
        if (!shop || (shop.shop_type || '').toLowerCase() !== shopTypeFilter.toLowerCase()) return false;
      }
      return true;
    });

    const filteredOrderIds = new Set(filteredOrders.map(o => o.id));
    const relevantItems = orderItems.filter(oi => filteredOrderIds.has(oi.order_id));

    // Filter purchases
    const filteredPurchases = purchases.filter(p => {
      const pDate = p.purchase_date ? p.purchase_date.slice(0, 10) : '';
      if (dateFrom && (!pDate || pDate < dateFrom)) return false;
      if (dateTo && (!pDate || pDate > dateTo)) return false;
      return true;
    });

    const groupedData = {};

    products.forEach(p => {
      const normBrand = normalizeBrand(p.brand);
      const normSize = normalizeSize(p.size);

      if (brandFilter && normBrand !== brandFilter) return;
      if (sizeFilter && normSize !== sizeFilter) return;

      if (!groupedData[normBrand]) groupedData[normBrand] = {};
      if (!groupedData[normBrand][normSize]) {
        groupedData[normBrand][normSize] = {
          brand: normBrand,
          size: normSize,
          caseQtyRule: p.case_qty_rule || 24,
          casesSold: 0,
          bottlesSold: 0,
          salesAmount: 0,
          currentStockBottles: 0,
          purchaseTotalBottles: 0,
          productIds: []
        };
      }

      groupedData[normBrand][normSize].productIds.push(p.id);
      groupedData[normBrand][normSize].currentStockBottles += (p.current_stock_bottles || 0);
    });

    let grandCasesSold = 0;
    let grandBottlesSold = 0;
    let grandSalesAmount = 0;
    let grandCurrentStockBottles = 0;
    let grandPurchaseBottles = 0;

    Object.keys(groupedData).forEach(b => {
      Object.keys(groupedData[b]).forEach(s => {
        const row = groupedData[b][s];
        const pIds = new Set(row.productIds);

        relevantItems.forEach(oi => {
          if (pIds.has(oi.product_id)) {
            const c = Number(oi.cases || 0);
            const bot = Number(oi.bottles || 0);
            const totalBot = (c * row.caseQtyRule) + bot;
            row.bottlesSold += totalBot;
            row.casesSold += c + (bot / row.caseQtyRule);

            let amt = Number(oi.amount || 0);
            if (!amt && oi.rate) {
              amt = (c * Number(oi.rate)) + (bot * (Number(oi.rate) / row.caseQtyRule));
            }
            row.salesAmount += amt;
          }
        });

        filteredPurchases.forEach(pur => {
          if (pIds.has(pur.product_id)) {
            const c = Number(pur.cases || 0);
            const bot = Number(pur.bottles || 0);
            row.purchaseTotalBottles += (c * row.caseQtyRule) + bot;
          }
        });

        grandCasesSold += row.casesSold;
        grandBottlesSold += row.bottlesSold;
        grandSalesAmount += row.salesAmount;
        grandCurrentStockBottles += row.currentStockBottles;
        grandPurchaseBottles += row.purchaseTotalBottles;
      });
    });

    return {
      brandCount: Object.keys(groupedData).length,
      grandCasesSold: Math.round(grandCasesSold * 100) / 100,
      grandBottlesSold,
      grandSalesAmount: Math.round(grandSalesAmount),
      grandCurrentStockBottles,
      grandPurchaseBottles
    };
  }

  console.log('1. NO FILTERS:', runAggregation());
  console.log('2. BRAND = Pepsi:', runAggregation({ brandFilter: 'Pepsi' }));
  console.log('3. SIZE = 400 ml:', runAggregation({ sizeFilter: '400 ml' }));
  console.log('4. ROUTE = r_1785742105638:', runAggregation({ routeFilter: 'r_1785742105638' }));
  console.log('5. SHOP TYPE = retail:', runAggregation({ shopTypeFilter: 'retail' }));
  console.log('6. DATE RANGE 2026-08-01 to 2026-08-10:', runAggregation({ dateFrom: '2026-08-01', dateTo: '2026-08-10' }));
  console.log('7. BRAND = Pepsi & SIZE = 400 ml & SHOP TYPE = retail:', runAggregation({ brandFilter: 'Pepsi', sizeFilter: '400 ml', shopTypeFilter: 'retail' }));
}

testFilters().catch(console.error);
