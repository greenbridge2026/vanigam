import fetch from 'node-fetch';

async function verifyProducts() {
  try {
    const res = await fetch('http://localhost:5001/api/products', {
      headers: {
        'x-tenant-id': 'GSK_AGENCY',
        'x-user-id': 'u1'
      }
    });
    const products = await res.json();
    console.log(`Total products returned from GET /api/products: ${products.length}`);
    const found7Up225 = products.find(p => (p.name_en || '').toLowerCase().includes('7 up') && (p.size || '').includes('2.25'));
    console.log('Found 7 Up 2.25L:', JSON.stringify(found7Up225, null, 2));
  } catch (err) {
    console.error('Error verifying products:', err);
  }
}

verifyProducts();
