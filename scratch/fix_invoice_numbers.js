(async () => {
  const { db } = await import('../backend/firebaseAdmin.js');
  const tenantId = 'GSK_AGENCY';
  console.log('Fixing invoice numbers for tenant:', tenantId);

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

  const saveDoc = async (tableName, tableData) => {
    const CHUNK_SIZE = 450;
    const docRef = db.collection('tenants').doc(tenantId).collection('tables').doc(tableName);
    if (tableData.length <= CHUNK_SIZE) {
      await docRef.set({ data: tableData, is_chunked: false, updated_at: new Date().toISOString() });
    } else {
      const totalChunks = Math.ceil(tableData.length / CHUNK_SIZE);
      const batch = db.batch();
      batch.set(docRef, { is_chunked: true, total_chunks: totalChunks, updated_at: new Date().toISOString() });
      for (let i = 0; i < totalChunks; i++) {
        const chunkData = tableData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = db.collection('tenants').doc(tenantId).collection('tables').doc(`${tableName}__chunk_${i}`);
        batch.set(chunkRef, { data: chunkData, chunk_index: i });
      }
      await batch.commit();
    }
    console.log(`Saved ${tableName}: ${tableData.length} records`);
  };

  const orders = await fetchDoc('orders');
  const deliveries = await fetchDoc('deliveries');
  const bills = await fetchDoc('bills');
  const outstandingHistory = await fetchDoc('outstanding_history');
  const deliveryAuditTrail = await fetchDoc('delivery_audit_trail');

  // 1. Sakthi Cool Drinks: ord_1795417148861 -> INV-1600
  const sakthiOrder = orders.find(o => o.id === 'ord_1795417148861');
  if (sakthiOrder) {
    console.log(`Sakthi Order old inv: ${sakthiOrder.invoice_number} -> new: INV-1600`);
    sakthiOrder.invoice_number = 'INV-1600';
  }

  // 2. Rafik Maligai: ord_1795417150000 -> INV-1601
  const rafikOrder = orders.find(o => o.id === 'ord_1795417150000');
  if (rafikOrder) {
    console.log(`Rafik Order old inv: ${rafikOrder.invoice_number} -> new: INV-1601`);
    rafikOrder.invoice_number = 'INV-1601';
  }

  // 3. Kandhan: ord_1795417175048 -> INV-1602
  const kandhanOrder = orders.find(o => o.id === 'ord_1795417175048');
  if (kandhanOrder) {
    console.log(`Kandhan Order old inv: ${kandhanOrder.invoice_number} -> new: INV-1602`);
    kandhanOrder.invoice_number = 'INV-1602';
  }

  // 4. Jaya Surya: ord_1795417378655 -> INV-1603
  const jayaSuryaOrder = orders.find(o => o.id === 'ord_1795417378655');
  if (jayaSuryaOrder) {
    console.log(`Jaya Surya Order old inv: ${jayaSuryaOrder.invoice_number} -> new: INV-1603`);
    jayaSuryaOrder.invoice_number = 'INV-1603';
  }

  // Ensure deliveries exist and have correct statuses & IDs
  // Sakthi Delivery
  let sakthiDel = deliveries.find(d => d.order_id === 'ord_1795417148861' || d.id === 'del_1795417148861');
  if (!sakthiDel) {
    deliveries.push({
      id: 'del_1795417148861',
      order_id: 'ord_1795417148861',
      delivery_man_id: 'u3',
      status: 'pending',
      delivery_time: null,
      remarks: ''
    });
  }

  // Rafik Delivery
  let rafikDel = deliveries.find(d => d.order_id === 'ord_1795417150000' || d.id === 'del_ord_1795417150000');
  if (!rafikDel) {
    deliveries.push({
      id: 'del_ord_1795417150000',
      order_id: 'ord_1795417150000',
      delivery_man_id: 'u3',
      status: 'pending',
      delivery_time: null,
      remarks: ''
    });
  }

  // Kandhan Delivery
  let kandhanDel = deliveries.find(d => d.order_id === 'ord_1795417175048' || d.id === 'del_1795417175048');
  if (!kandhanDel) {
    deliveries.push({
      id: 'del_1795417175048',
      order_id: 'ord_1795417175048',
      delivery_man_id: 'u3',
      status: 'pending',
      delivery_time: null,
      remarks: ''
    });
  }

  // Jaya Surya Delivery
  let jayaDel = deliveries.find(d => d.order_id === 'ord_1795417378655' || d.id === 'del_1795417378655');
  if (!jayaDel) {
    deliveries.push({
      id: 'del_1795417378655',
      order_id: 'ord_1795417378655',
      delivery_man_id: 'u3',
      status: 'pending',
      delivery_time: null,
      remarks: ''
    });
  }

  // Update bills if any
  bills.forEach(b => {
    if (b.order_id === 'ord_1795417148861') {
      b.invoice_number = 'INV-1600';
      b.pdf_path = '/invoices/INV-1600.pdf';
    } else if (b.order_id === 'ord_1795417150000') {
      b.invoice_number = 'INV-1601';
      b.pdf_path = '/invoices/INV-1601.pdf';
    } else if (b.order_id === 'ord_1795417175048') {
      b.invoice_number = 'INV-1602';
      b.pdf_path = '/invoices/INV-1602.pdf';
    } else if (b.order_id === 'ord_1795417378655') {
      b.invoice_number = 'INV-1603';
      b.pdf_path = '/invoices/INV-1603.pdf';
    }
  });

  // Update outstanding history descriptions
  outstandingHistory.forEach(h => {
    if (h.description && h.description.includes('ord_1795417148861')) {
      h.description = 'Order INV-1600 placed and confirmed';
    }
    if (h.description && h.description.includes('ord_1795417150000')) {
      h.description = 'Order INV-1601 placed and confirmed';
    }
    if (h.id === 'oh_1795417174770') {
      h.description = 'Order INV-1602 placed and confirmed';
    }
    if (h.id === 'oh_1795417378306') {
      h.description = 'Order INV-1603 placed and confirmed';
    }
  });

  // Save all updated tables to Firestore
  await saveDoc('orders', orders);
  await saveDoc('deliveries', deliveries);
  await saveDoc('bills', bills);
  await saveDoc('outstanding_history', outstandingHistory);

  console.log('✅ All invoice numbers and delivery records successfully synchronized in Firestore!');
})().catch(console.error);

