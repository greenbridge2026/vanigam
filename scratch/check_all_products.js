async function checkProducts() {
  const tenants = ['GSK_AGENCY', 'SPRS', 'SPRS_AGENCY', 'TEST_1', 'default'];
  for (const tid of tenants) {
    try {
      const res = await fetch('http://localhost:5001/api/products', { headers: { 'x-tenant-id': tid } });
      const products = await res.json();
      console.log(`Tenant ${tid}: ${products.length} products`);
      if (products.length > 0) {
        console.log(`Sample from ${tid}:`, products.slice(0, 5).map(p => ({
          id: p.id,
          brand: p.brand,
          name_en: p.name_en,
          status: p.status,
          current_stock_bottles: p.current_stock_bottles
        })));
      }
    } catch (e) {
      console.log(`Tenant ${tid} error:`, e.message);
    }
  }
}

checkProducts();
