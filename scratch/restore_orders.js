(async () => {
  const { db } = await import('../backend/firebaseAdmin.js');
  const tenantId = 'GSK_AGENCY';
  console.log('Restoring orders for tenant:', tenantId);

  // 1. Fetch current tables from Firestore
  const fetchDoc = async (tableName) => {
    const snap = await db.collection('tenants').doc(tenantId).collection('tables').doc(tableName).get();
    if (!snap.exists) return [];
    const data = snap.data();
    if (data.is_chunked) {
      const chunks = [];
      for (let i = 0; i < data.total_chunks; i++) {
        const c = await db.collection('tenants').doc(tenantId).collection('tables').doc(`${tableName}__chunk_${i}`).get();
        if (c.exists) chunks.push(...c.data().data);
      }
      return chunks;
    }
    return data.data !== undefined ? data.data : data;
  };

  const orders = await fetchDoc('orders');
  const orderItems = await fetchDoc('order_items');
  const deliveries = await fetchDoc('deliveries');
  const shops = await fetchDoc('shops');
  const outstandingHistory = await fetchDoc('outstanding_history');
  const stockLedger = await fetchDoc('stock_ledger');

  console.log(`Current counts: orders=${orders.length}, orderItems=${orderItems.length}, deliveries=${deliveries.length}, shops=${shops.length}`);

  // 2. Adjust Kandhan and Jaya Surya invoice numbers
  const kandhanOrder = orders.find(o => o.id === 'ord_1795417175048');
  if (kandhanOrder) {
    console.log(`Updating Kandhan order from ${kandhanOrder.invoice_number} to INV-1602`);
    kandhanOrder.invoice_number = 'INV-1602';
  }
  const kandhanDelivery = deliveries.find(d => d.order_id === 'ord_1795417175048');
  if (kandhanDelivery) {
    kandhanDelivery.invoice_number = 'INV-1602';
  }
  const kandhanOh = outstandingHistory.find(h => h.id === 'oh_1795417174770');
  if (kandhanOh) {
    kandhanOh.description = 'Order INV-1602 placed and confirmed';
  }

  const jayaSuryaOrder = orders.find(o => o.id === 'ord_1795417378655');
  if (jayaSuryaOrder) {
    console.log(`Updating Jaya Surya order from ${jayaSuryaOrder.invoice_number} to INV-1603`);
    jayaSuryaOrder.invoice_number = 'INV-1603';
  }
  const jayaSuryaDelivery = deliveries.find(d => d.order_id === 'ord_1795417378655');
  if (jayaSuryaDelivery) {
    jayaSuryaDelivery.invoice_number = 'INV-1603';
  }
  const jayaSuryaOh = outstandingHistory.find(h => h.id === 'oh_1795417378306');
  if (jayaSuryaOh) {
    jayaSuryaOh.description = 'Order INV-1603 placed and confirmed';
  }

  // 3. Create Sakthi Cool Drinks order (INV-1600)
  const sakthiShop = shops.find(s => s.id === 's_1785742146163_import_46');
  const sakthiOrderId = 'ord_1795417148861';
  let existingSakthi = orders.find(o => o.id === sakthiOrderId || o.invoice_number === 'INV-1600');
  if (!existingSakthi) {
    console.log('Adding Sakthi Cool Drinks order INV-1600...');
    const sakthiOrder = {
      id: sakthiOrderId,
      invoice_number: 'INV-1600',
      route_id: 'r_1785742105638',
      shop_id: 's_1785742146163_import_46',
      salesman_id: 'u1',
      order_date: '2026-11-23T06:59:08.861Z',
      delivery_date: '2026-11-23T06:59:08.861Z',
      invoice_date: '2026-11-23T06:59:08.861Z',
      total_amount: 0,
      discount: 0,
      net_amount: 0,
      previous_outstanding: Number(sakthiShop?.outstanding_amount || 6000),
      status: 'confirmed',
      delivery_man_id: 'u3'
    };
    orders.push(sakthiOrder);

    deliveries.push({
      id: 'del_1795417148861',
      order_id: sakthiOrderId,
      delivery_man_id: 'u3',
      status: 'pending',
      delivery_time: null,
      remarks: ''
    });
  }

  // 4. Create Rafik Maligai order (INV-1601) with exact 8 line items from printed bill
  const rafikShop = shops.find(s => s.id === 's_1785742146163_import_1');
  const rafikOrderId = 'ord_1795417150000';
  let existingRafik = orders.find(o => o.id === rafikOrderId || (o.shop_id === 's_1785742146163_import_1' && o.order_date.includes('2026-11-23')));
  if (!existingRafik) {
    console.log('Adding Rafik Maligai order INV-1601 with 8 items...');
    const rafikOrder = {
      id: rafikOrderId,
      invoice_number: 'INV-1601',
      route_id: 'r_1785742105638',
      shop_id: 's_1785742146163_import_1',
      salesman_id: 'u1',
      order_date: '2026-11-23T06:59:20.000Z',
      delivery_date: '2026-11-23T06:59:20.000Z',
      invoice_date: '2026-11-23T06:59:20.000Z',
      total_amount: 8450,
      discount: 0,
      net_amount: 8450,
      previous_outstanding: 9120,
      status: 'confirmed',
      delivery_man_id: 'u3'
    };
    orders.push(rafikOrder);

    // 8 items from printed bill
    const rafikItems = [
      { id: 'oi_1795417150000_0', order_id: rafikOrderId, product_id: 'p_1785909892252_import_30', cases: 1, bottles: 0, rate: 700, amount: 700 },
      { id: 'oi_1795417150000_1', order_id: rafikOrderId, product_id: 'p_1785909892252_import_31', cases: 1, bottles: 0, rate: 700, amount: 700 },
      { id: 'oi_1795417150000_2', order_id: rafikOrderId, product_id: 'p_1789795928517_7up_225', cases: 1, bottles: 0, rate: 720, amount: 720 },
      { id: 'oi_1795417150000_3', order_id: rafikOrderId, product_id: 'p_1785342948684_import_7', cases: 1, bottles: 0, rate: 760, amount: 760 },
      { id: 'oi_1795417150000_4', order_id: rafikOrderId, product_id: 'p_1785909892252_import_40', cases: 2, bottles: 0, rate: 960, amount: 1920 },
      { id: 'oi_1795417150000_5', order_id: rafikOrderId, product_id: 'p_1785909892252_import_41', cases: 2, bottles: 0, rate: 960, amount: 1920 },
      { id: 'oi_1795417150000_6', order_id: rafikOrderId, product_id: 'p_1785909892252_import_57', cases: 2, bottles: 0, rate: 650, amount: 1300 },
      { id: 'oi_1795417150000_7', order_id: rafikOrderId, product_id: 'p_1785909892252_import_25', cases: 1, bottles: 0, rate: 430, amount: 430 }
    ];
    rafikItems.forEach(item => orderItems.push(item));

    deliveries.push({
      id: 'del_1795417150000',
      order_id: rafikOrderId,
      delivery_man_id: 'u3',
      status: 'pending',
      delivery_time: null,
      remarks: ''
    });

    outstandingHistory.push({
      id: 'oh_1795417150000',
      shop_id: 's_1785742146163_import_1',
      change_amount: 8450,
      balance_amount: 17570,
      description: 'Order INV-1601 placed and confirmed',
      date: '2026-11-23T06:59:20.000Z'
    });

    if (rafikShop) {
      rafikShop.outstanding_amount = 17570;
    }
  }

  // Sort orders by order_date or invoice number
  orders.sort((a, b) => {
    const numA = parseInt((a.invoice_number || '').replace('INV-', ''), 10) || 0;
    const numB = parseInt((b.invoice_number || '').replace('INV-', ''), 10) || 0;
    return numA - numB;
  });

  console.log('Writing restored data to Firestore in chunks...');
  const CHUNK_THRESHOLD_BYTES = 500 * 1024;
  const timestamp = Date.now();

  const writeTable = async (tableName, tableData) => {
    const tableRef = db.collection('tenants').doc(tenantId).collection('tables').doc(tableName);
    const dataStr = JSON.stringify(tableData);
    const byteLen = Buffer.byteLength(dataStr, 'utf8');

    if (Array.isArray(tableData) && byteLen > CHUNK_THRESHOLD_BYTES) {
      const itemsCount = tableData.length;
      const bytesPerItem = itemsCount > 0 ? (byteLen / itemsCount) : 1;
      const targetChunkItems = Math.max(50, Math.floor((350 * 1024) / bytesPerItem));
      const chunks = [];
      for (let i = 0; i < tableData.length; i += targetChunkItems) {
        chunks.push(tableData.slice(i, i + targetChunkItems));
      }

      const batch = db.batch();
      batch.set(tableRef, {
        is_chunked: true,
        total_chunks: chunks.length,
        total_records: tableData.length,
        updated_at: timestamp
      });
      for (let i = 0; i < chunks.length; i++) {
        const chunkRef = db.collection('tenants').doc(tenantId).collection('tables').doc(`${tableName}__chunk_${i}`);
        batch.set(chunkRef, { data: chunks[i], chunk_index: i, total_chunks: chunks.length });
      }
      await batch.commit();
      console.log(`Saved ${tableName} in ${chunks.length} chunks`);
    } else {
      await tableRef.set({ data: tableData });
      console.log(`Saved ${tableName} as single doc (${tableData.length} records)`);
    }
  };

  await writeTable('orders', orders);
  await writeTable('order_items', orderItems);
  await writeTable('deliveries', deliveries);
  await writeTable('shops', shops);
  await writeTable('outstanding_history', outstandingHistory);

  // Update metadata
  await db.collection('tenants').doc(tenantId).collection('tables').doc('_metadata').set({
    last_updated: timestamp
  }, { merge: true });

  console.log('SUCCESS! All restored orders and tables persisted to Firestore.');
})();

