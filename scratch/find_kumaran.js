async function findShopAndProduct() {
  const tenants = ['GSK_AGENCY', 'SPRS', 'TEST_1'];
  for (const tid of tenants) {
    const resS = await fetch('http://localhost:5001/api/shops', { headers: { 'x-tenant-id': tid } });
    const shops = await resS.json();
    const kumaran = shops.find(s => (s.name_en || '').toLowerCase().includes('kumaran') || (s.name_ta || '').includes('குமரன்'));
    
    const resP = await fetch('http://localhost:5001/api/products', { headers: { 'x-tenant-id': tid } });
    const products = await resP.json();
    const goli = products.find(p => (p.name_en || '').toLowerCase().includes('goli'));

    console.log(`Tenant ${tid}:`);
    console.log(`  Kumaran Shop:`, kumaran ? { id: kumaran.id, name: kumaran.name_en } : 'NOT FOUND');
    console.log(`  Goli Soda:`, goli ? { id: goli.id, name: goli.name_en, brand: goli.brand, status: goli.status } : 'NOT FOUND');
    console.log(`  Total Products in ${tid}:`, products.length);
    console.log(`  Product statuses:`, [...new Set(products.map(p => p.status))]);
  }
}

findShopAndProduct();
