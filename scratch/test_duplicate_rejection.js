import fetch from 'node-fetch';

async function testDuplicateCheck() {
  try {
    const payload = {
      name_en: "7 Up",
      name_ta: "7 அப்",
      brand: "Pepsi",
      size: "2.25L",
      case_qty_rule: 9,
      purchase_price: 670,
      wholesale_price: 700,
      retail_price: 720,
      current_stock_bottles: 99 * 9
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
    console.error('Error testing duplicate check:', err);
  }
}

testDuplicateCheck();
