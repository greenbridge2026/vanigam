import React, { useState, useEffect } from 'react';
import api from '../api';

export default function RecycleBin({ t, lang }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecycleBin();
  }, []);

  const loadRecycleBin = async () => {
    try {
      const data = await api.getRecycleBin();
      setItems(data);
    } catch (err) {
      console.error('Failed to load recycle bin', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.restoreRecycleBinItem(id);
      setItems(items.filter(item => item.id !== id));
      alert('Record restored successfully! / தரவு மீட்டமைக்கப்பட்டது!');
    } catch (err) {
      alert(err.message || 'Failed to restore item');
    }
  };

  const handlePurge = async (id) => {
    if (confirm('Permanently delete this record? This action CANNOT be undone. / இந்த தரவை நிரந்தரமாக நீக்க வேண்டுமா?')) {
      try {
        await api.purgeRecycleBinItem(id);
        setItems(items.filter(item => item.id !== id));
        alert('Record purged permanently. / தரவு நிரந்தரமாக நீக்கப்பட்டது.');
      } catch (err) {
        alert(err.message || 'Failed to purge item');
      }
    }
  };

  const getRecordName = (item) => {
    const data = item.data;
    if (item.table === 'routes') {
      return lang === 'en' ? data.name_en : data.name_ta;
    }
    if (item.table === 'shops') {
      const s = data.shop || data;
      return lang === 'en' ? s.name_en : s.name_ta;
    }
    if (item.table === 'products') {
      const p = data.product || data;
      return lang === 'en' ? p.name_en : p.name_ta;
    }
    if (item.table === 'purchases') {
      const p = data.purchase || data;
      return `Supplier: ${p.supplier_name || 'N/A'} (${p.cases} Cases)`;
    }
    if (item.table === 'orders') {
      const o = data.order || data;
      return `Invoice: ${o.invoice_number} (₹${o.net_amount})`;
    }
    return item.original_id;
  };

  const getDaysRemaining = (expiresAt) => {
    const diffTime = new Date(expiresAt) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Recycle Bin...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>♻️ {t('recycle_bin')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Recover deleted routes, shops, products, purchases, or orders. Deleted items are kept here for 30 days before permanent purging.</p>
      </div>

      {items.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🍃</span>
          <h3>Recycle Bin is Empty / குப்பைத் தொட்டி காலியாக உள்ளது</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>No recently deleted records were found.</p>
        </div>
      ) : (
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Recently Deleted Items</h2>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item Summary</th>
                  <th>Deleted At</th>
                  <th>Retention Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const daysLeft = getDaysRemaining(item.expires_at);
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className={`role-badge ${item.table}`} style={{ textTransform: 'capitalize' }}>
                          {item.table === 'routes' ? '🗺️ Route' :
                           item.table === 'shops' ? '🏢 Shop' :
                           item.table === 'products' ? '🥤 Product' :
                           item.table === 'purchases' ? '📥 Purchase' :
                           item.table === 'orders' ? '🛒 Order' : item.table}
                        </span>
                      </td>
                      <td><strong>{getRecordName(item)}</strong></td>
                      <td>{new Date(item.deleted_at).toLocaleString(lang === 'en' ? 'en-US' : 'ta-IN')}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: daysLeft > 10 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: daysLeft > 10 ? 'var(--success)' : 'var(--warning)',
                          border: `1px solid ${daysLeft > 10 ? 'var(--success)' : 'var(--warning)'}`
                        }}>
                          {daysLeft} Days Left
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button className="language-btn" onClick={() => handleRestore(item.id)}>
                            ♻️ {t('restore')}
                          </button>
                          <button className="btn btn-danger" onClick={() => handlePurge(item.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
