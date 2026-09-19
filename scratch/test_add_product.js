import fetch from 'node-fetch';

async function testAddProduct() {
  try {
    const payload = {
      name_en: "Test Drink 500ml",
      name_ta: "டெஸ்ட் டிரிங்க் 500ml",
      brand: "TestBrand",
      category: "",
      size: "500ml",
      case_qty_rule: 24,
      purchase_price: 300,
      wholesale_price: 350,
      retail_price: 400,
      min_stock: 5,
      status: "active",
      mrp: 20,
      gst: 18,
      current_stock_bottles: 240
    };

    const res = await fetch('http://localhost:5001/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'GSK_AGENCY',
        'x-user-id': 'u1'
      },
      body: JSON.stringify(payload)
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testAddProduct();
