import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const serviceAccountPath = path.join(process.cwd(), 'backend', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});
const dbFs = getFirestore();

const CHUNK_THRESHOLD_BYTES = 500 * 1024; // 500 KB safe threshold

async function migrateTenant(tenantId) {
  console.log(`\n=== Checking & Migrating Tenant: ${tenantId} ===`);
  const tablesRef = dbFs.collection('tenants').doc(tenantId).collection('tables');
  const snap = await tablesRef.get();

  for (const doc of snap.docs) {
    if (doc.id === '_metadata' || doc.id.includes('__chunk_')) continue;

    const dataObj = doc.data();
    if (!dataObj) continue;

    // If already chunked, skip
    if (dataObj.is_chunked) {
      console.log(`Table ${doc.id} is already chunked (${dataObj.total_chunks} chunks).`);
      continue;
    }

    const tableData = dataObj.data;
    if (!Array.isArray(tableData) || tableData.length === 0) continue;

    const jsonStr = JSON.stringify(tableData);
    const bytes = Buffer.byteLength(jsonStr, 'utf8');

    if (bytes > CHUNK_THRESHOLD_BYTES) {
      console.log(`Table "${doc.id}" size (${(bytes / 1024).toFixed(1)} KB, ${tableData.length} items) exceeds ${(CHUNK_THRESHOLD_BYTES / 1024)} KB limit! Splitting into chunks...`);

      const bytesPerItem = bytes / tableData.length;
      // Target each chunk to be ~350 KB
      const targetChunkItems = Math.max(50, Math.floor((350 * 1024) / bytesPerItem));
      
      const chunks = [];
      for (let i = 0; i < tableData.length; i += targetChunkItems) {
        chunks.push(tableData.slice(i, i + targetChunkItems));
      }

      console.log(`Splitting "${doc.id}" into ${chunks.length} chunks (~${targetChunkItems} items each)...`);

      const batch = dbFs.batch();
      const timestamp = Date.now();

      // Master doc
      batch.set(doc.ref, {
        is_chunked: true,
        total_chunks: chunks.length,
        total_records: tableData.length,
        updated_at: timestamp
      });

      // Chunk docs
      for (let i = 0; i < chunks.length; i++) {
        const chunkRef = tablesRef.doc(`${doc.id}__chunk_${i}`);
        const chunkBytes = Buffer.byteLength(JSON.stringify(chunks[i]), 'utf8');
        console.log(`  Writing chunk ${i}: ${chunks[i].length} items, ${(chunkBytes / 1024).toFixed(1)} KB`);
        batch.set(chunkRef, {
          data: chunks[i],
          chunk_index: i,
          total_chunks: chunks.length
        });
      }

      await batch.commit();
      console.log(`Successfully migrated and chunked "${doc.id}"!`);
    } else {
      console.log(`Table "${doc.id}": ${(bytes / 1024).toFixed(1)} KB (${tableData.length} items) - OK`);
    }
  }
}

async function run() {
  const tenantsSnap = await dbFs.collection('tenants').get();
  const tenantIds = tenantsSnap.docs.map(d => d.id);
  if (!tenantIds.includes('GSK_AGENCY')) tenantIds.push('GSK_AGENCY');

  for (const tid of tenantIds) {
    await migrateTenant(tid);
  }
  console.log('\nAll tenants checked & migrated successfully!');
}

run().catch(console.error);
