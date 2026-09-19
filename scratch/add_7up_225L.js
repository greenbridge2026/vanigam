import { db } from '../backend/firebaseAdmin.js';

async function add7Up225L() {
  try {
    const tenantId = 'GSK_AGENCY';
    const docRef = db.collection('tenants').doc(tenantId).collection('tables').doc('products');
    const snap = await docRef.get();
    
    let products = [];
    if (snap.exists) {
      products = snap.data().data || [];
    }

    // Check if 7 Up 2.25L already exists
    const existingIndex = products.findIndex(p => {
      const name = ((p.name_en || '') + ' ' + (p.name_ta || '')).toLowerCase();
      const size = (p.size || '').toLowerCase();
      return (name.includes('7up') || name.includes('7 up') || name.includes('7 அப்')) && (name.includes('2.25') || size.includes('2.25'));
    });

    const newProduct = {
      id: existingIndex !== -1 ? products[existingIndex].id : `p_${Date.now()}_7up_225`,
      name_en: "7 Up",
      name_ta: "7 அப்",
      brand: "Pepsi",
      category: "Soft Drinks",
      size: "2.25L",
      case_qty_rule: 9,
      purchase_price: 670,
      wholesale_price: 700,
      retail_price: 720,
      current_stock_bottles: 99 * 9, // 99 cases
      min_stock: 9,
      status: "active",
      mrp: 100,
      gst: 40
    };

    if (existingIndex !== -1) {
      products[existingIndex] = newProduct;
      console.log('Updated existing 7 Up 2.25L product in Firestore');
    } else {
      products.push(newProduct);
      console.log('Added new 7 Up 2.25L product to Firestore');
    }

    await docRef.set({ data: products }, { merge: true });

    // Update metadata last_updated timestamp
    const metaRef = db.collection('tenants').doc(tenantId).collection('tables').doc('_metadata');
    await metaRef.set({ last_updated: Date.now() }, { merge: true });

    console.log('Successfully saved 7 Up 2.25L in Firestore for GSK_AGENCY!');
  } catch (err) {
    console.error('Error adding 7 Up 2.25L:', err);
  }
}

add7Up225L();
