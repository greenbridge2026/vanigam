async function inspectSprsProducts() {
  const res = await fetch('http://localhost:5001/api/products', { headers: { 'x-tenant-id': 'SPRS' } });
  const products = await res.json();
  console.log(`SPRS has ${products.length} products:`);
  products.forEach(p => {
    console.log(`- [${p.id}] ${p.brand} - ${p.name_en} (${p.size}): status = "${p.status}"`);
  });
}

inspectSprsProducts();
