import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import { sanitizeTamilBeverageTerms } from '../translations';

export default function PurchaseMgr({ t, lang }) {
  const [products, setProducts] = useState(() => api.getCached('products') || []);
  const [purchases, setPurchases] = useState(() => api.getCached('purchases') || []);
  const [loading, setLoading] = useState(() => !api.getCached('products') || api.getCached('products').length === 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState(null);

  // Form Fields
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [productId, setProductId] = useState('');
  const [cases, setCases] = useState(0);
  const [bottles, setBottles] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState('');

  // New Product Modal State
  const [isNewProdModalOpen, setIsNewProdModalOpen] = useState(false);
  const [newProdNameEn, setNewProdNameEn] = useState('');
  const [newProdNameTa, setNewProdNameTa] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdSize, setNewProdSize] = useState('');
  const [newProdCaseRule, setNewProdCaseRule] = useState('24');
  const [newProdPurchasePrice, setNewProdPurchasePrice] = useState('');
  const [newProdWholesalePrice, setNewProdWholesalePrice] = useState('');
  const [newProdRetailPrice, setNewProdRetailPrice] = useState('');
  const [newProdMrp, setNewProdMrp] = useState('');
  const [newProdGst, setNewProdGst] = useState('12');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodData, purchData] = await Promise.all([api.getProducts(), api.getPurchases()]);
        setProducts(prodData || []);
        setPurchases(purchData || []);
      } catch (err) {
        console.error('Failed to load purchase/product lists', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedProduct = products.find(p => p.id === productId);

  const handleProductChange = (id) => {
    if (id === '__CREATE_NEW__') {
      setIsNewProdModalOpen(true);
      return;
    }
    setProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod && !purchasePrice) {
      setPurchasePrice(prod.purchase_price || '');
    } else if (!id) {
      setPurchasePrice('');
    }
  };

  const handleEditTrigger = (p) => {
    setEditingId(p.id);
    setSupplier(p.supplier || '');
    setPurchaseDate(p.purchase_date ? p.purchase_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setProductId(p.product_id);
    setCases(p.cases || 0);
    setBottles(p.bottles || 0);
    setPurchasePrice(p.purchase_price || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSupplier('');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setProductId('');
    setCases(0);
    setBottles(0);
    setPurchasePrice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId) return alert(lang === 'ta' ? 'தயவுசெய்து முதலில் தயாரிப்பைத் தேர்ந்தெடுக்கவும்' : 'Select a product first');
    if (Number(cases) <= 0 && Number(bottles) <= 0) return alert(lang === 'ta' ? 'அளவு பூஜ்ஜியத்தை விட அதிகமாக இருக்க வேண்டும்' : 'Quantity must be greater than zero');

    setIsSubmitting(true);
    const payload = {
      supplier: supplier || 'Supplier',
      purchase_date: new Date(purchaseDate).toISOString(),
      product_id: productId,
      cases: Number(cases || 0),
      bottles: Number(bottles || 0),
      purchase_price: Number(purchasePrice || 0)
    };

    try {
      if (editingId) {
        const updated = await api.updatePurchase(editingId, payload);
        setPurchases(purchases.map(p => p.id === editingId ? updated : p));
        alert(lang === 'ta' ? 'கொள்முதல் பதிவு வெற்றிகரமாக மாற்றப்பட்டது!' : 'Purchase entry updated successfully!');
      } else {
        const added = await api.createPurchase(payload);
        if (added && !added.duplicatePrevented) {
          setPurchases([added, ...purchases]);
          alert(lang === 'ta' ? 'சரக்கு கொள்முதல் வெற்றிகரமாக சேர்க்கப்பட்டது!' : 'Purchase stock added successfully!');
        } else if (added && added.duplicatePrevented) {
          alert(lang === 'ta' ? 'இந்த கொள்முதல் பதிவு ஏற்கனவே சேர்க்கப்பட்டது (நகல் தவிர்க்கப்பட்டது).' : 'This purchase was already recorded (duplicate prevented).');
        }
      }

      // Reload products list to show immediately updated stock counts across the ERP
      const updatedProds = await api.getProducts();
      setProducts(updatedProds || []);

      handleCancelEdit();
    } catch (err) {
      alert(err.message || 'Failed to save purchase stock entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewProduct = async (e) => {
    e.preventDefault();
    if (!newProdNameEn.trim() && !newProdNameTa.trim()) {
      alert(lang === 'ta' ? 'தயாரிப்பு பெயர் தேவை' : 'Product name is required');
      return;
    }

    let finalEn = newProdNameEn.trim();
    let finalTa = newProdNameTa.trim();

    if (finalEn && !finalTa) {
      try {
        finalTa = await api.translate(finalEn, 'en', 'ta');
        if (finalTa) finalTa = sanitizeTamilBeverageTerms(finalTa);
      } catch (err) {
        console.warn('Auto translation failed:', err);
      }
    } else if (finalTa && !finalEn) {
      try {
        finalEn = await api.translate(finalTa, 'ta', 'en');
      } catch (err) {
        console.warn('Auto translation failed:', err);
      }
    }

    const caseRuleNum = Number(newProdCaseRule) || 24;
    const newProductPayload = {
      name_en: finalEn || finalTa,
      name_ta: finalTa || finalEn,
      brand: newProdBrand.trim() || 'General',
      category: newProdCategory.trim() || '',
      size: newProdSize.trim() || 'Standard',
      case_qty_rule: caseRuleNum,
      purchase_price: Number(newProdPurchasePrice) || 0,
      wholesale_price: Number(newProdWholesalePrice) || 0,
      retail_price: Number(newProdRetailPrice) || 0,
      mrp: Number(newProdMrp) || 0,
      gst: Number(newProdGst) || 0,
      min_stock: 0,
      status: 'active',
      current_stock_bottles: 0 // New product starts at 0, purchase entry will add the incoming stock!
    };

    setIsCreatingProduct(true);
    try {
      const created = await api.createProduct(newProductPayload);
      const updatedProds = await api.getProducts();
      setProducts(updatedProds || []);

      // Auto-select the newly created product in purchase entry form
      if (created && created.id) {
        setProductId(created.id);
        setPurchasePrice(created.purchase_price || newProdPurchasePrice || '');
      }

      // Reset modal fields and close modal
      setNewProdNameEn('');
      setNewProdNameTa('');
      setNewProdBrand('');
      setNewProdCategory('');
      setNewProdSize('');
      setNewProdCaseRule('24');
      setNewProdPurchasePrice('');
      setNewProdWholesalePrice('');
      setNewProdRetailPrice('');
      setNewProdMrp('');
      setNewProdGst('12');
      setIsNewProdModalOpen(false);

      alert(lang === 'ta' 
        ? `"${finalTa || finalEn}" தயாரிப்பு வெற்றிகரமாக உருவாக்கப்பட்டு தேர்ந்தெடுக்கப்பட்டது!` 
        : `Product "${finalEn || finalTa}" created successfully and selected for purchase entry!`
      );
    } catch (err) {
      alert(err.message || 'Failed to create product in Product Management');
    } finally {
      setIsCreatingProduct(false);
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
      setProducts(prodData || []);
      alert(lang === 'ta' ? 'கொள்முதல் நீக்கப்பட்டு இருப்பு சரிசெய்யப்பட்டது.' : 'Purchase log deleted and stock rolled back.');
    } catch (err) {
      alert(err.message || 'Failed to delete purchase record');
    } finally {
      setDeleteTargetId(null);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Loading Purchase Module...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📥 {t('purchase_entry')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Log incoming supplier inventory to automatically increment product stock counts in Product Management</p>
      </div>

      {/* Form Card (Normal view when not editing) */}
      {!editingId && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{t('enter_purchases')}</h2>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsNewProdModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.35rem 0.75rem', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
            >
              ➕ {lang === 'ta' ? 'புதிய பொருள் உருவாக்க' : 'Create New Product'}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>{t('supplier')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={supplier} 
                  onChange={e => setSupplier(e.target.value)} 
                  required 
                  placeholder="e.g. Coca-Cola Bottlers Chennai" 
                />
              </div>

              <div className="form-group">
                <label>{t('purchase_date')}</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={purchaseDate} 
                  onChange={e => setPurchaseDate(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label style={{ margin: 0 }}>{t('select_products')}</label>
                  <button 
                    type="button" 
                    onClick={() => setIsNewProdModalOpen(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    + {lang === 'ta' ? 'புதிய பொருள்?' : 'New Product?'}
                  </button>
                </div>
                <select 
                  className="form-select" 
                  value={productId} 
                  onChange={e => handleProductChange(e.target.value)} 
                  required
                >
                  <option value="">-- {lang === 'ta' ? 'தயாரிப்பைத் தேர்ந்தெடுக்கவும்' : 'Select Product'} --</option>
                  <option value="__CREATE_NEW__" style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>
                    ➕ {lang === 'ta' ? 'புதிய தயாரிப்பை உருவாக்கவும்...' : 'Create New Product...'}
                  </option>
                  {products.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>
                      {lang === 'ta' ? p.name_ta : p.name_en} ({p.size}) - {lang === 'ta' ? 'இருப்பு:' : 'Stock:'} {Math.floor((p.current_stock_bottles || 0) / (p.case_qty_rule || 24))} C
                    </option>
                  ))}
                </select>

                {/* Live Stock Display */}
                {selectedProduct && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>📦 {lang === 'ta' ? 'தற்போதைய இருப்பு:' : 'Current Stock:'}</span>
                    <strong style={{ color: (selectedProduct.current_stock_bottles || 0) > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {Math.floor((selectedProduct.current_stock_bottles || 0) / (selectedProduct.case_qty_rule || 24))} {lang === 'ta' ? 'பெட்டிகள்' : 'Cases'} ({(selectedProduct.current_stock_bottles || 0)} {lang === 'ta' ? 'பாட்டில்கள்' : 'Bottles'})
                    </strong>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>{t('purchase_price')} (₹ per Case)</label>
                <input 
                  type="number" 
                  step="any"
                  className="form-input" 
                  value={purchasePrice} 
                  onChange={e => setPurchasePrice(e.target.value)} 
                  required 
                  placeholder="0.00" 
                />
              </div>

              <div className="form-group">
                <label>{t('qty_cases')}</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={cases} 
                  onChange={e => setCases(e.target.value)} 
                  min="0" 
                />
              </div>

              <div className="form-group">
                <label>{t('qty_bottles')}</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={bottles} 
                  onChange={e => setBottles(e.target.value)} 
                  min="0" 
                />
              </div>
            </div>

            <div className="btn-group" style={{ marginTop: '1.25rem' }}>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSubmitting}
                style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                {isSubmitting ? '⏳ Processing...' : `📥 ${t('submit_purchase')}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Purchase Popup Modal */}
      {editingId && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '650px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0 }}>
                ✏️ {lang === 'ta' ? 'கொள்முதல் பதிவை மாற்றுதல்' : 'Edit Purchase Entry'}
              </h2>
              <button 
                type="button" 
                onClick={handleCancelEdit}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

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
                    {products.filter(p => p.status === 'active' || p.id === productId).map(p => (
                      <option key={p.id} value={p.id}>{lang === 'ta' ? p.name_ta : p.name_en} ({p.size})</option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                      📦 {lang === 'ta' ? 'இருப்பு:' : 'Stock:'} {Math.floor((selectedProduct.current_stock_bottles || 0) / (selectedProduct.case_qty_rule || 24))} C ({(selectedProduct.current_stock_bottles || 0)} B)
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>{t('purchase_price')} (₹ per Case)</label>
                  <input type="number" step="any" className="form-input" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required placeholder="0.00" />
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
              <div className="btn-group" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Product in Product Management Modal */}
      {isNewProdModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '750px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0 }}>
                  ✨ {lang === 'ta' ? 'புதிய தயாரிப்பை உருவாக்கவும்' : 'Create New Product in Product Management'}
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {lang === 'ta' 
                    ? 'தயாரிப்பு விவரங்களை உள்ளிட்டு சேமிக்கவும். பின்னர் உடனடியாக கொள்முதல் செய்யலாம்.' 
                    : 'Create product in Product Management to instantly select it for purchase entry.'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsNewProdModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewProduct}>
              <div className="form-grid">
                <div className="form-group">
                  <label>{t('product_name_en')} *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newProdNameEn} 
                    onChange={e => setNewProdNameEn(e.target.value)} 
                    placeholder="e.g. Sprite 500ml" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>{t('product_name_ta')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newProdNameTa} 
                    onChange={e => setNewProdNameTa(e.target.value)} 
                    placeholder="எ.கா. ஸ்ப்ரைட் 500மி.லி" 
                  />
                </div>

                <div className="form-group">
                  <label>{t('brand')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newProdBrand} 
                    onChange={e => setNewProdBrand(e.target.value)} 
                    placeholder="e.g. Coca-Cola, Bovonto" 
                  />
                </div>

                <div className="form-group">
                  <label>{t('size')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newProdSize} 
                    onChange={e => setNewProdSize(e.target.value)} 
                    placeholder="e.g. 200ml, 500ml, 1L" 
                  />
                </div>

                <div className="form-group">
                  <label>{t('case_qty_rule')} (Bottles per Case) *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={newProdCaseRule} 
                    onChange={e => setNewProdCaseRule(e.target.value)} 
                    min="1" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>{t('purchase_price')} (₹ per Case) *</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="form-input" 
                    value={newProdPurchasePrice} 
                    onChange={e => setNewProdPurchasePrice(e.target.value)} 
                    placeholder="0.00" 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>{t('wholesale_price')} (₹ per Case)</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="form-input" 
                    value={newProdWholesalePrice} 
                    onChange={e => setNewProdWholesalePrice(e.target.value)} 
                    placeholder="0.00" 
                  />
                </div>

                <div className="form-group">
                  <label>{t('retail_price')} (₹ per Case)</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="form-input" 
                    value={newProdRetailPrice} 
                    onChange={e => setNewProdRetailPrice(e.target.value)} 
                    placeholder="0.00" 
                  />
                </div>

                <div className="form-group">
                  <label>{t('mrp')} (₹ per Bottle)</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="form-input" 
                    value={newProdMrp} 
                    onChange={e => setNewProdMrp(e.target.value)} 
                    placeholder="0.00" 
                  />
                </div>

                <div className="form-group">
                  <label>{t('gst_rate')} (%)</label>
                  <select 
                    className="form-select" 
                    value={newProdGst} 
                    onChange={e => setNewProdGst(e.target.value)}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                    <option value="40">40%</option>
                  </select>
                </div>
              </div>

              <div className="btn-group" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsNewProdModalOpen(false)}
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isCreatingProduct}
                >
                  {isCreatingProduct ? '⏳ Creating...' : (lang === 'ta' ? '✅ தயாரிப்பை உருவாக்கி தேர்ந்தெடுக்கவும்' : '✅ Create & Select Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => handleEditTrigger(p)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                          ✏️ Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteTrigger(p.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                          🗑️ Delete
                        </button>
                      </div>
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
