import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function PurchaseMgr({ t, lang }) {
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [productId, setProductId] = useState('');
  const [cases, setCases] = useState(0);
  const [bottles, setBottles] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [prodData, purchData] = await Promise.all([api.getProducts(), api.getPurchases()]);
        setProducts(prodData);
        setPurchases(purchData);
      } catch (err) {
        console.error('Failed to load purchase/product lists', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleProductChange = (id) => {
    setProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod) {
      setPurchasePrice(prod.purchase_price);
    } else {
      setPurchasePrice('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId) return alert('Select a product first');
    if (Number(cases) <= 0 && Number(bottles) <= 0) return alert('Quantity must be greater than zero');

    const payload = {
      supplier,
      purchase_date: new Date(purchaseDate).toISOString(),
      product_id: productId,
      cases: Number(cases),
      bottles: Number(bottles),
      purchase_price: Number(purchasePrice)
    };

    try {
      const added = await api.createPurchase(payload);
      setPurchases([added, ...purchases]);
      
      // Reload products list to show new stock count
      const updatedProds = await api.getProducts();
      setProducts(updatedProds);
      
      // Reset form
      setSupplier('');
      setProductId('');
      setCases(0);
      setBottles(0);
      setPurchasePrice('');
      alert('Purchase stock added successfully! / கொள்முதல் வெற்றிகரமாக சேர்க்கப்பட்டது!');
    } catch (err) {
      alert(err.message || 'Failed to record purchase stock');
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const handleDeleteTrigger = (id) => {
    setDeleteTargetId(id);
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    setConfirmOpen(false);
    if (!deleteTargetId) return;
    try {
      await api.deletePurchase(deleteTargetId);
      setPurchases(purchases.filter(p => p.id !== deleteTargetId));
      // Reload products to refresh live stock counts
      const prodData = await api.getProducts();
      setProducts(prodData);
      alert('Purchase log deleted and stock rolled back. / கொள்முதல் நீக்கப்பட்டு இருப்பு சரிசெய்யப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to delete purchase record');
    } finally {
      setDeleteTargetId(null);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Purchase Module...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📥 {t('purchase_entry')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Log incoming supplier inventory to automatically increment product stock counts</p>
      </div>

      {/* Form Card */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>{t('enter_purchases')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('supplier')}</label>
              <input type="text" className="form-input" value={supplier} onChange={e => setSupplier(e.target.value)} required placeholder="e.g. Coca-Cola Bottlers Chennai" />
            </div>
            <div className="form-group">
              <label>{t('purchase_date')}</label>
              <input type="date" className="form-input" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>{t('select_products')}</label>
              <select className="form-select" value={productId} onChange={e => handleProductChange(e.target.value)} required>
                <option value="">-- Select Product --</option>
                {products.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{lang === 'ta' ? p.name_ta : p.name_en} ({p.size})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('purchase_price')} (₹ per Case)</label>
              <input type="number" className="form-input" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>{t('qty_cases')}</label>
              <input type="number" className="form-input" value={cases} onChange={e => setCases(e.target.value)} min="0" />
            </div>
            <div className="form-group">
              <label>{t('qty_bottles')}</label>
              <input type="number" className="form-input" value={bottles} onChange={e => setBottles(e.target.value)} min="0" />
            </div>
          </div>
          <div className="btn-group">
            <button type="submit" className="btn btn-primary">
              📥 {t('submit_purchase')}
            </button>
          </div>
        </form>
      </div>

      {/* Purchase Log History */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Purchase History Ledger</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Product</th>
                <th>Quantity Received</th>
                <th>Purchase Cost (Case)</th>
                <th>Total Cost</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => {
                const product = products.find(prod => prod.id === p.product_id);
                const pName = product ? (lang === 'ta' ? product.name_ta : product.name_en) : 'Unknown Product';
                const pSize = product ? product.size : '';
                const caseRule = product ? product.case_qty_rule : 1;
                
                // Qty String
                let qtyStr = '';
                if (p.cases > 0) qtyStr += `${p.cases} Cases`;
                if (p.bottles > 0) qtyStr += `${qtyStr ? ', ' : ''}${p.bottles} Bottles`;
                if (!qtyStr) qtyStr = '0';

                // Price Math
                const totalQtyBottles = (p.cases * caseRule) + p.bottles;
                const totalCost = Math.round(totalQtyBottles * (p.purchase_price / caseRule));

                return (
                  <tr key={p.id}>
                    <td>{new Date(p.purchase_date).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN')}</td>
                    <td><strong>{p.supplier}</strong></td>
                    <td>{pName} <span style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>({pSize})</span></td>
                    <td>{qtyStr}</td>
                    <td>₹{p.purchase_price}</td>
                    <td style={{ color: 'var(--success)', fontWeight: '700' }}>₹{totalCost}</td>
                     <td style={{ textAlign: 'right' }}>
                       <button className="btn btn-danger" onClick={() => handleDeleteTrigger(p.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                         🗑️ Delete
                       </button>
                     </td>
                  </tr>
                );
              })}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No purchase history found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ConfirmModal
         isOpen={confirmOpen}
         title={t('confirm_title')}
         message={t('confirm_delete_msg')}
         confirmText={t('confirm_ok')}
         cancelText={t('confirm_cancel')}
         onConfirm={executeDelete}
         onCancel={() => setConfirmOpen(false)}
       />
     </div>
    </div>
  );
}
