import React, { useState, useEffect } from 'react';
import api from '../api';

export default function OrderTaking({ t, lang, onOrderCreated }) {
  const [routes, setRoutes] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Selected fields
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedShop, setSelectedShop] = useState('');
  const [cart, setCart] = useState({}); // key: product_id, val: { cases: 0, bottles: 0 }
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [rData, sData, pData] = await Promise.all([
          api.getRoutes(),
          api.getShops(),
          api.getProducts()
        ]);
        setRoutes(rData);
        setShops(sData);
        setProducts(pData);
      } catch (err) {
        console.error('Failed to load order taking metadata', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter shops by selected route and active status
  const routeShops = shops.filter(s => s.route_id === selectedRoute && s.status === 'active');
  const shopObj = shops.find(s => s.id === selectedShop);

  const handleQtyChange = (prodId, type, val) => {
    const value = Math.max(0, parseInt(val) || 0);
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    const currentCartItem = cart[prodId] || { cases: 0, bottles: 0 };
    const updatedItem = { ...currentCartItem, [type]: value };

    // Calculate total bottles requested
    const requestedBottles = (updatedItem.cases * prod.case_qty_rule) + updatedItem.bottles;

    // Check against available stock
    if (requestedBottles > prod.current_stock_bottles) {
      alert(`${t('insufficient_stock')} Available: ${prod.current_stock_bottles} bottles.`);
      return; // block change
    }

    setCart({
      ...cart,
      [prodId]: updatedItem
    });
  };

  const getProductPrice = (prod) => {
    if (!shopObj) return 0;
    return shopObj.shop_type === 'wholesale' ? prod.wholesale_price : prod.retail_price;
  };

  const calculateSubtotal = () => {
    let subtotal = 0;
    Object.keys(cart).forEach(id => {
      const prod = products.find(p => p.id === id);
      const cartItem = cart[id];
      if (prod && cartItem) {
        const rate = getProductPrice(prod);
        const bottlesRate = rate / prod.case_qty_rule;
        subtotal += (cartItem.cases * rate) + (cartItem.bottles * bottlesRate);
      }
    });
    return Math.round(subtotal);
  };

  const handlePlaceOrder = async () => {
    if (!selectedShop) return alert('Select a shop / கடையைத் தேர்வு செய்க');
    
    // Structure order items
    const items = Object.keys(cart)
      .map(id => ({
        product_id: id,
        cases: cart[id].cases,
        bottles: cart[id].bottles
      }))
      .filter(item => item.cases > 0 || item.bottles > 0);

    if (items.length === 0) return alert('Add at least one item to order / ஆர்டரில் ஏதேனும் பொருள் சேர்க்கவும்');

    setSubmitting(true);
    const orderPayload = {
      shop_id: selectedShop,
      route_id: selectedRoute,
      salesman_id: 'u2', // Hardcoded for demo/role session
      items,
      discount: Number(discount)
    };

    try {
      const result = await api.createOrder(orderPayload);
      alert('Order Placed Successfully! / ஆர்டர் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!');
      // Callback to view billing invoice
      if (onOrderCreated) {
        onOrderCreated(result.order.id);
      }
    } catch (err) {
      alert(err.message || 'Error processing order transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const formatStock = (totalBottles, caseRule) => {
    const cases = Math.floor(totalBottles / caseRule);
    const bottles = totalBottles % caseRule;
    
    let result = [];
    if (cases > 0) result.push(`${cases} C`);
    if (bottles > 0) result.push(`${bottles} B`);
    return result.join(', ') || (lang === 'ta' ? 'சரக்கு இல்லை' : 'Out of Stock');
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Order Desk...</div>;

  const subtotal = calculateSubtotal();
  const netTotal = Math.max(0, subtotal - Number(discount));

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🛒 {t('order_taking')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Log instant store orders, apply discounts, and assign to logistics routes</p>
      </div>

      {/* Selector Box */}
      <div className="glass-card">
        <div className="form-grid">
          <div className="form-group">
            <label>{t('route_mgmt')}</label>
            <select
              className="form-select"
              value={selectedRoute}
              onChange={e => { setSelectedRoute(e.target.value); setSelectedShop(''); setCart({}); }}
            >
              <option value="">-- Select Route --</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('select_shop')}</label>
            <select
              className="form-select"
              value={selectedShop}
              onChange={e => { setSelectedShop(e.target.value); setCart({}); }}
              disabled={!selectedRoute}
            >
              <option value="">-- {t('select_shop')} --</option>
              {routeShops.map(s => (
                <option key={s.id} value={s.id}>
                  {lang === 'ta' ? s.name_ta : s.name_en} ({s.shop_type === 'wholesale' ? t('wholesale') : t('retail')})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Shop Info Summary */}
      {shopObj && (
        <div className="glass-card" style={{ borderColor: 'var(--accent-cyan-glow)', background: 'rgba(6,182,212,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ color: 'var(--accent-cyan)' }}>{lang === 'ta' ? shopObj.name_ta : shopObj.name_en}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📍 Address: {shopObj.address} | Contact: {shopObj.contact_person}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-muted)' }}>Previous Outstanding:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--warning)' }}>₹{shopObj.outstanding_amount}</span>
            </div>
          </div>
        </div>
      )}

      {selectedShop ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Products Catalog */}
          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>📦 {t('select_products')}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {products.filter(p => p.status === 'active').map(p => {
                const isOutOfStock = p.current_stock_bottles === 0;
                const pricePerCase = getProductPrice(p);
                const pricePerBottle = pricePerCase / p.case_qty_rule;
                
                const itemCart = cart[p.id] || { cases: 0, bottles: 0 };

                return (
                  <div key={p.id} className={`order-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.05rem', color: isOutOfStock ? 'var(--text-muted)' : 'var(--text-main)' }}>
                        {lang === 'ta' ? p.name_ta : p.name_en} ({p.size})
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {t('available')}: <strong style={{ color: isOutOfStock ? 'var(--danger)' : 'var(--success)' }}>{formatStock(p.current_stock_bottles, p.case_qty_rule)}</strong>
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginTop: '0.25rem' }}>
                        Rate: ₹{pricePerCase} / Case (₹{pricePerBottle.toFixed(1)} / Bottle)
                      </p>
                    </div>

                    <div className="order-product-actions">
                      <div className="form-group" style={{ gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('cases')}</span>
                        <input
                          type="number"
                          className="form-input"
                          value={itemCart.cases || ''}
                          onChange={e => handleQtyChange(p.id, 'cases', e.target.value)}
                          disabled={isOutOfStock}
                          min="0"
                          placeholder="Cases"
                        />
                      </div>
                      <div className="form-group" style={{ gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('bottles')}</span>
                        <input
                          type="number"
                          className="form-input"
                          value={itemCart.bottles || ''}
                          onChange={e => handleQtyChange(p.id, 'bottles', e.target.value)}
                          disabled={isOutOfStock}
                          min="0"
                          placeholder="Bottles"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout Cart */}
          <div className="glass-card">
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>🛒 Checkout Summary</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              {Object.keys(cart).map(id => {
                const prod = products.find(p => p.id === id);
                const item = cart[id];
                if (!prod || (!item.cases && !item.bottles)) return null;

                const rate = getProductPrice(prod);
                const bottlesRate = rate / prod.case_qty_rule;
                const cost = (item.cases * rate) + (item.bottles * bottlesRate);

                return (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{lang === 'ta' ? prod.name_ta : prod.name_en}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {item.cases > 0 ? `${item.cases} C ` : ''}
                        {item.bottles > 0 ? `${item.bottles} B` : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: '700' }}>₹{Math.round(cost)}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span>Subtotal:</span>
                <strong>₹{subtotal}</strong>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>{t('discount')}</label>
                <input
                  type="number"
                  className="form-input"
                  value={discount || ''}
                  onChange={e => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', color: 'var(--accent-cyan)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <strong>{t('net_total')}:</strong>
                <strong>₹{netTotal}</strong>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={handlePlaceOrder}
                disabled={submitting || netTotal === 0}
              >
                {submitting ? '...' : t('place_order')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          🔍 Please select route and shop to build order lines.
        </div>
      )}
    </div>
  );
}
