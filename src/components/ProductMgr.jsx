import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function ProductMgr({ t, lang }) {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [activeField, setActiveField] = useState(null);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [size, setSize] = useState('');
  const [caseQtyRule, setCaseQtyRule] = useState(24);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [wholesalePrice, setWholesalePrice] = useState(0);
  const [retailPrice, setRetailPrice] = useState(0);
  const [minStock, setMinStock] = useState(24);
  const [status, setStatus] = useState('active');

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products list', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  // Auto-translate English to Tamil
  useEffect(() => {
    if (activeField !== 'en') return;
    if (!nameEn.trim()) {
      setNameTa('');
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameEn, 'en', 'ta');
        if (translated) setNameTa(translated);
      } catch (err) {
        console.error('Auto-translation to Tamil failed:', err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [nameEn, activeField]);

  // Auto-translate Tamil to English
  useEffect(() => {
    if (activeField !== 'ta') return;
    if (!nameTa.trim()) {
      setNameEn('');
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameTa, 'ta', 'en');
        if (translated) setNameEn(translated);
      } catch (err) {
        console.error('Auto-translation to English failed:', err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [nameTa, activeField]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nameEn.trim() && !nameTa.trim()) {
      alert(lang === 'ta' ? 'தயாரிப்பு பெயர் தேவை' : 'Product name is required');
      return;
    }

    let finalEn = nameEn.trim();
    let finalTa = nameTa.trim();

    // Auto-translate on submit if one is missing
    if (finalEn && !finalTa) {
      try {
        finalTa = await api.translate(finalEn, 'en', 'ta');
      } catch (err) {
        console.warn('Failed to translate to Tamil on submit', err);
      }
    } else if (finalTa && !finalEn) {
      try {
        finalEn = await api.translate(finalTa, 'ta', 'en');
      } catch (err) {
        console.warn('Failed to translate to English on submit', err);
      }
    }

    const payload = {
      name_en: finalEn,
      name_ta: finalTa,
      brand,
      category,
      size,
      case_qty_rule: Number(caseQtyRule),
      purchase_price: Number(purchasePrice),
      wholesale_price: Number(wholesalePrice),
      retail_price: Number(retailPrice),
      min_stock: Number(minStock),
      status
    };

    try {
      if (editingProduct) {
        const updated = await api.updateProduct(editingProduct.id, payload);
        setProducts(products.map(p => p.id === editingProduct.id ? updated : p));
      } else {
        const added = await api.createProduct({ ...payload, current_stock_bottles: 0 });
        setProducts([...products, added]);
      }
      resetForm();
    } catch (err) {
      alert(err.message || 'Error saving product settings');
    }
  };

  const handleEdit = (prod) => {
    setEditingProduct(prod);
    setNameEn(prod.name_en);
    setNameTa(prod.name_ta);
    setBrand(prod.brand);
    setCategory(prod.category || '');
    setSize(prod.size);
    setCaseQtyRule(prod.case_qty_rule);
    setPurchasePrice(prod.purchase_price);
    setWholesalePrice(prod.wholesale_price);
    setRetailPrice(prod.retail_price);
    setMinStock(prod.min_stock);
    setStatus(prod.status);
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
      await api.deleteProduct(deleteTargetId);
      setProducts(products.filter(p => p.id !== deleteTargetId));
      alert('Product moved to Recycle Bin. / தயாரிப்பு குப்பைத் தொட்டிக்கு நகர்த்தப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setNameEn('');
    setNameTa('');
    setActiveField(null);
    setBrand('');
    setCategory('');
    setSize('');
    setCaseQtyRule(24);
    setPurchasePrice(0);
    setWholesalePrice(0);
    setRetailPrice(0);
    setMinStock(24);
    setStatus('active');
  };

  const formatStock = (stockBottles, caseRule) => {
    const cases = Math.floor(stockBottles / caseRule);
    const bottles = stockBottles % caseRule;
    
    let result = '';
    if (cases > 0) result += `${cases} ${lang === 'ta' ? 'கேஸ்' : 'Cases'}`;
    if (bottles > 0) result += `${result ? ', ' : ''}${bottles} ${lang === 'ta' ? 'பாட்டில்' : 'Bottles'}`;
    return result || (lang === 'ta' ? 'சரக்கு இல்லை' : '0 Bottles');
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Product Manager...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🥤 {t('product_mgmt')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Define pricing formulas, packaging options, and thresholds for inventory lines</p>
      </div>

      {/* Form Card */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
          {editingProduct ? t('edit_product') : t('add_product')}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('product_name_en')}</label>
              <input type="text" className="form-input" value={nameEn} onChange={e => setNameEn(e.target.value)} onFocus={() => setActiveField('en')} placeholder="e.g. Coca Cola 2.25 Litre" />
            </div>
            <div className="form-group">
              <label>{t('product_name_ta')}</label>
              <input type="text" className="form-input" value={nameTa} onChange={e => setNameTa(e.target.value)} onFocus={() => setActiveField('ta')} placeholder="எ.கா. கோகோ கோலா 2.25 லிட்டர்" />
            </div>
            <div className="form-group">
              <label>{t('brand')}</label>
              <input type="text" className="form-input" value={brand} onChange={e => setBrand(e.target.value)} required placeholder="e.g. Coca Cola" />
            </div>
            <div className="form-group">
              <label>{lang === 'ta' ? 'வகை (Category)' : 'Category'}</label>
              <input type="text" className="form-input" value={category} onChange={e => setCategory(e.target.value)} required placeholder="e.g. Soft Drinks, Juices" />
            </div>
            <div className="form-group">
              <label>{t('size')}</label>
              <input type="text" className="form-input" value={size} onChange={e => setSize(e.target.value)} required placeholder="e.g. 2.25L, 500ml" />
            </div>
            <div className="form-group">
              <label>{t('case_qty')} (Bottles per Case)</label>
              <input type="number" className="form-input" value={caseQtyRule} onChange={e => setCaseQtyRule(e.target.value)} required min="1" placeholder="9 or 24" />
            </div>
            <div className="form-group">
              <label>{t('purchase_price')} (₹ per Case)</label>
              <input type="number" className="form-input" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required min="0" />
            </div>
            <div className="form-group">
              <label>{t('wholesale_price')} (₹ per Case)</label>
              <input type="number" className="form-input" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} required min="0" />
            </div>
            <div className="form-group">
              <label>{t('retail_price')} (₹ per Case)</label>
              <input type="number" className="form-input" value={retailPrice} onChange={e => setRetailPrice(e.target.value)} required min="0" />
            </div>
            <div className="form-group">
              <label>{t('min_stock')} (Bottles Limit)</label>
              <input type="number" className="form-input" value={minStock} onChange={e => setMinStock(e.target.value)} required min="0" />
            </div>
            <div className="form-group">
              <label>{t('status')}</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </div>
          </div>
          <div className="btn-group">
            {editingProduct && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                {t('cancel')}
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              💾 {t('save')}
            </button>
          </div>
        </form>
      </div>

      {/* Product List */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Inventory Setup</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Product details</th>
                <th>Brand / Category / Size</th>
                <th>Case Qty Rule</th>
                <th>Purchase (Case)</th>
                <th>Wholesale (Case)</th>
                <th>Retail (Case)</th>
                <th>Live Stock</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: '700' }}>{lang === 'ta' ? p.name_ta : p.name_en}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {p.id}</div>
                  </td>
                  <td>
                    <div>{p.brand} {p.category && `(${p.category})`}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{p.size}</div>
                  </td>
                  <td><strong>{p.case_qty_rule}</strong> Bottles</td>
                  <td>₹{p.purchase_price}</td>
                  <td style={{ color: 'var(--warning)', fontWeight: '600' }}>₹{p.wholesale_price}</td>
                  <td style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>₹{p.retail_price}</td>
                  <td style={{
                    fontWeight: '700',
                    color: p.current_stock_bottles === 0 ? 'var(--danger)' : p.current_stock_bottles <= p.min_stock ? 'var(--warning)' : 'var(--success)'
                  }}>
                    {formatStock(p.current_stock_bottles, p.case_qty_rule)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button className="language-btn" onClick={() => handleEdit(p)}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDeleteTrigger(p.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  );
}
