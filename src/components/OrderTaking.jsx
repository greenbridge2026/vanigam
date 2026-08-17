import React, { useState, useEffect } from 'react';
import api from '../api';
import { translateShopName, translateRouteName, translateProductName } from '../translations';

export default function OrderTaking({ t, lang, onOrderCreated }) {
  const [routes, setRoutes] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);

  // Selected fields
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedShop, setSelectedShop] = useState('');
  const [cart, setCart] = useState({}); // key: product_id, val: { cases: 0, bottles: 0 }
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Catalog search & Brand Tabs
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedBrandTab, setSelectedBrandTab] = useState('all');

  useEffect(() => {
    async function loadData() {
      try {
        const [rData, sData, pData, oData, oiData] = await Promise.all([
          api.getRoutes(),
          api.getShops(),
          api.getProducts(),
          api.getOrders(),
          api.getOrderItems()
        ]);
        setRoutes(rData || []);
        setShops(sData || []);
        setProducts(pData || []);
        setOrders(oData || []);
        setOrderItems(oiData || []);
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
  const activeProducts = products.filter(p => p.status === 'active');

  function parseVolumeInMl(sizeStr) {
    if (!sizeStr) return 999999;
    const str = String(sizeStr).toLowerCase().trim();
    
    const numMatch = str.match(/([\d.]+)/);
    if (!numMatch) return 999999;
    
    const val = parseFloat(numMatch[1]);
    if (isNaN(val)) return 999999;

    const isLiters = /l(?:iter|itre)?/i.test(str) && !/ml/i.test(str);

    // Decimal or small numbers (< 15 like 1.2, 1.7, 1.5, 2.25, 1) are in Liters (1200ml, 1700ml, etc.)
    if (val < 15 || isLiters) {
      return val * 1000;
    }
    
    // Numbers >= 15 (e.g. 200, 250, 400, 500, 600, 750) are in ml
    return val;
  }

  // Filter Catalog Products by Tab & Search, and sort by size volume (200ml, 400ml, 500ml...)
  const getFilteredCatalogProducts = () => {
    const filtered = activeProducts.filter(p => {
      // 1. Search filter (brand or name)
      if (catalogSearch) {
        const query = catalogSearch.toLowerCase();
        const nameMatch = (p.name_en || '').toLowerCase().includes(query) || (p.name_ta || '').toLowerCase().includes(query);
        const brandMatch = (p.brand || '').toLowerCase().includes(query);
        const sizeMatch = (p.size || '').toLowerCase().includes(query);
        if (!nameMatch && !brandMatch && !sizeMatch) return false;
      }

      // 2. Brand Tab filter
      if (selectedBrandTab === 'all') return true;
      const brand = (p.brand || '').toLowerCase();
      if (selectedBrandTab === 'pepsi') return brand.includes('pepsi');
      if (selectedBrandTab === 'coca-cola') return brand.includes('coca') || brand.includes('coke') || brand.includes('sprite') || brand.includes('thums') || brand.includes('fanta');
      if (selectedBrandTab === 'bovonto') return brand.includes('bovonto');
      if (selectedBrandTab === 'frooti') return brand.includes('frooti') || brand.includes('appy');
      if (selectedBrandTab === 'others') {
        const isKnown = brand.includes('pepsi') || brand.includes('coca') || brand.includes('coke') || brand.includes('sprite') || brand.includes('thums') || brand.includes('fanta') || brand.includes('bovonto') || brand.includes('frooti') || brand.includes('appy');
        return !isKnown;
      }
      return true;
    });

    // Sort by size volume ascending (200ml, 400ml, 500ml...)
    return filtered.sort((a, b) => {
      const volA = parseVolumeInMl(a.size);
      const volB = parseVolumeInMl(b.size);
      if (volA !== volB) return volA - volB;
      return (a.name_en || '').localeCompare(b.name_en || '');
    });
  };

  const filteredCatalogProducts = getFilteredCatalogProducts();

  // Helper for live quantity changing in cart
  const handleCartQtyChange = (prodId, field, valStr) => {
    const value = Math.max(0, parseInt(valStr) || 0);
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;

    const currentItem = cart[prodId] || { cases: 0, bottles: 0 };
    const updatedItem = { ...currentItem, [field]: value };
    const totalRequested = (updatedItem.cases * prod.case_qty_rule) + updatedItem.bottles;

    if (totalRequested > prod.current_stock_bottles) {
      alert(`Insufficient Stock! Available: ${formatStock(prod.current_stock_bottles, prod.case_qty_rule)} (${prod.current_stock_bottles} B)`);
      return;
    }

    if (updatedItem.cases === 0 && updatedItem.bottles === 0) {
      const newCart = { ...cart };
      delete newCart[prodId];
      setCart(newCart);
    } else {
      setCart({
        ...cart,
        [prodId]: updatedItem
      });
    }
  };

  const handleRemoveFromCart = (prodId) => {
    const newCart = { ...cart };
    delete newCart[prodId];
    setCart(newCart);
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
        cases: cart[id].cases || 0,
        bottles: cart[id].bottles || 0
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

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Loading Order Desk...</div>;

  const subtotal = calculateSubtotal();
  const netTotal = Math.max(0, subtotal - Number(discount));

  const brandTabsList = [
    { id: 'all', label: lang === 'ta' ? 'அனைத்தும்' : 'All Products' },
    { id: 'pepsi', label: 'Pepsi' },
    { id: 'coca-cola', label: 'Coca-Cola' },
    { id: 'bovonto', label: 'Bovonto' },
    { id: 'frooti', label: 'Frooti' },
    { id: 'others', label: lang === 'ta' ? 'இதர பிராண்டுகள்' : 'Others' }
  ];

  return (
    <div>
      <div style={{ marginBottom: '0.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.15rem' }}>🛒 {t('order_taking')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Quick Order entry with live-synced smart cart panel</p>
      </div>

      {/* Selectors Bar */}
      <div className="glass-card" style={{ marginBottom: '0.75rem', padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '220px', margin: 0 }}>
            <label style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{t('route_mgmt')}</label>
            <select
              className="form-select"
              value={selectedRoute}
              onChange={e => { setSelectedRoute(e.target.value); setSelectedShop(''); setCart({}); }}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
            >
              <option value="">-- {lang === 'ta' ? 'வழித்தடத்தை தேர்வு செய்க' : 'Select Route'} --</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{translateRouteName(r, lang)}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '220px', margin: 0 }}>
            <label style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{t('select_shop')}</label>
            <select
              className="form-select"
              value={selectedShop}
              onChange={e => { setSelectedShop(e.target.value); setCart({}); }}
              disabled={!selectedRoute}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
            >
              <option value="">-- {t('select_shop')} --</option>
              {routeShops.map(s => (
                <option key={s.id} value={s.id}>
                  {translateShopName(s, lang)} ({s.shop_type === 'wholesale' ? t('wholesale') : t('retail')})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Shop Info Summary */}
      {shopObj && (
        <div className="glass-card" style={{ marginBottom: '0.75rem', borderColor: 'var(--accent-cyan-glow)', background: 'rgba(6,182,212,0.02)', padding: '0.75rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ color: 'var(--accent-cyan)', margin: 0, fontSize: '1.1rem' }}>{translateShopName(shopObj, lang)}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>📍 Address: {shopObj.address} | Contact: {shopObj.contact_person}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--text-muted)' }}>Previous Outstanding:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--danger)' }}>₹{shopObj.outstanding_amount}</span>
            </div>
          </div>
        </div>
      )}

      {selectedShop ? (
        <div className="order-taking-layout" style={{ gap: '1rem' }}>
          
          {/* LEFT: Quick Catalog Entry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Search & Add Items Catalog */}
            <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--accent-cyan)', fontWeight: '700', marginBottom: '0.75rem' }}>
                🔍 {lang === 'ta' ? 'பொருட்களைத் தேடி அளவை உள்ளிடவும்' : 'Search & Enter Quantities'}
              </h3>

              {/* Brand Tabs */}
              <div className="brand-tabs-container" style={{ marginBottom: '0.75rem' }}>
                {brandTabsList.map(tab => (
                  <button
                    key={tab.id}
                    className={`brand-tab-btn ${selectedBrandTab === tab.id ? 'active' : ''}`}
                    onClick={() => setSelectedBrandTab(tab.id)}
                    style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Product Search Bar */}
              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder={lang === 'ta' ? 'பெயர் அல்லது பிராண்ட் மூலம் தேடவும்...' : 'Search by name, brand, size...'}
                  style={{ width: '100%', paddingLeft: '2.5rem', padding: '0.4rem 2.5rem 0.4rem 2.5rem', fontSize: '0.85rem' }}
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                />
                <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
              </div>

              {/* Filtered Catalog List */}
              <div className="table-container" style={{ maxHeight: 'calc(100vh - 350px)', minHeight: '300px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Stock</th>
                      <th style={{ width: '90px' }}>Cases</th>
                      <th style={{ width: '90px' }}>Bottles</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalogProducts.map(p => {
                      const rate = getProductPrice(p);
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{translateProductName(p, lang)}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.brand} | {p.size}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ 
                              fontSize: '0.8rem', 
                              fontWeight: '600', 
                              color: p.current_stock_bottles === 0 ? 'var(--danger)' : 'var(--text-muted)'
                            }}>
                              {formatStock(p.current_stock_bottles, p.case_qty_rule)}
                            </span>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0"
                              min="0"
                              style={{ padding: '0.35rem 0.5rem', width: '80px', fontSize: '0.85rem' }}
                              value={cart[p.id]?.cases !== undefined ? (cart[p.id].cases || '') : ''}
                              onChange={e => handleCartQtyChange(p.id, 'cases', e.target.value)}
                              disabled={p.current_stock_bottles === 0}
                              onWheel={(e) => e.target.blur()}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="0"
                              min="0"
                              style={{ padding: '0.35rem 0.5rem', width: '80px', fontSize: '0.85rem' }}
                              value={cart[p.id]?.bottles !== undefined ? (cart[p.id].bottles || '') : ''}
                              onChange={e => handleCartQtyChange(p.id, 'bottles', e.target.value)}
                              disabled={p.current_stock_bottles === 0}
                              onWheel={(e) => e.target.blur()}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>
                            ₹{rate}/C
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCatalogProducts.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No products found matching filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* RIGHT: Live Smart Cart & Checkout */}
          <div className="sticky-checkout-summary">
            <div className="glass-card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--accent-cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🛒 {lang === 'ta' ? 'கூடை விவரம்' : 'Live Order Cart'}
                </h2>
                <span style={{ 
                  background: 'rgba(6, 182, 212, 0.1)', 
                  color: 'var(--accent-cyan)', 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '12px', 
                  fontSize: '0.8rem',
                  fontWeight: '700'
                }}>
                  {Object.keys(cart).length} Items
                </span>
              </div>

              {/* Cart List */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.85rem', 
                maxHeight: '260px', 
                overflowY: 'auto',
                borderBottom: '1px solid var(--border-color)', 
                paddingBottom: '1rem', 
                marginBottom: '1rem' 
              }}>
                {Object.keys(cart).map(id => {
                  const prod = products.find(p => p.id === id);
                  const item = cart[id];
                  if (!prod || (!item.cases && !item.bottles)) return null;

                  const rate = getProductPrice(prod);
                  const cost = (item.cases * rate) + (item.bottles * (rate / prod.case_qty_rule));

                  return (
                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                      <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700' }}>{translateProductName(prod, lang)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(prod.id)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              cursor: 'pointer', 
                              fontSize: '0.8rem',
                              color: 'var(--danger)',
                              padding: 0
                            }}
                            title="Remove"
                          >
                            🗑️
                          </button>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                          {item.cases > 0 ? `${item.cases} Cases ` : ''}
                          {item.bottles > 0 ? `${item.bottles} Bottles ` : ''}
                          | @ ₹{rate}/C
                        </div>
                      </div>
                      <div style={{ fontWeight: '700', minWidth: '60px', textAlign: 'right' }}>₹{Math.round(cost)}</div>
                    </div>
                  );
                })}
                {Object.keys(cart).length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.9rem' }}>
                    Cart is empty. Add quantities on the left.
                  </div>
                )}
              </div>

              {/* Price Details & Place Order */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                  <strong>₹{subtotal}</strong>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t('discount')} (Rs)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={discount || ''}
                    onChange={e => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    placeholder="0"
                    style={{ padding: '0.5rem 0.75rem' }}
                    onWheel={(e) => e.target.blur()}
                  />
                </div>

                <div style={{ 
                  display: 'flex', 
                  justify: 'space-between', 
                  fontSize: '1.25rem', 
                  color: 'var(--success)', 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '0.75rem', 
                  marginTop: '0.5rem' 
                }}>
                  <strong>{t('net_total')}:</strong>
                  <strong>₹{netTotal}</strong>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem', padding: '0.85rem' }}
                  onClick={handlePlaceOrder}
                  disabled={submitting || netTotal === 0}
                >
                  {submitting ? '...' : t('place_order')}
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          🔍 {lang === 'ta' ? 'ஆர்டர் வரிகளை உருவாக்க வழித்தடம் மற்றும் கடையைத் தேர்வு செய்க.' : 'Please select route and shop to build order lines.'}
        </div>
      )}
    </div>
  );
}
