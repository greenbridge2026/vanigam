import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { translateShopName, translateRouteName, translateProductName } from '../translations';

export default function OrderTaking({ t, lang, onOrderCreated, editingOrder, onOrderUpdated, onCancelEdit }) {
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

  // Route dropdown & keyboard navigation states
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
  const [routeHighlightedIndex, setRouteHighlightedIndex] = useState(0);
  const routeDropdownRef = useRef(null);
  const routeContainerRef = useRef(null);

  // Shop dropdown & keyboard navigation states
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
  const [shopHighlightedIndex, setShopHighlightedIndex] = useState(0);
  const shopDropdownRef = useRef(null);
  const shopContainerRef = useRef(null);
  const shopInputRef = useRef(null);

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

  // Pre-fill fields when editing an order
  useEffect(() => {
    if (editingOrder) {
      setSelectedRoute(editingOrder.route_id || '');
      setSelectedShop(editingOrder.shop_id || '');
      setDiscount(editingOrder.discount || 0);

      async function loadEditingCart() {
        try {
          const oiData = await api.getOrderItems();
          const existing = oiData.filter(oi => oi.order_id === editingOrder.id);
          const initialCart = {};
          existing.forEach(oi => {
            initialCart[oi.product_id] = {
              cases: oi.cases || 0,
              bottles: oi.bottles || 0
            };
          });
          setCart(initialCart);
        } catch (err) {
          console.error('Failed to load items for order editing:', err);
        }
      }
      loadEditingCart();
    }
  }, [editingOrder]);

  // Click outside listener for route and shop dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (routeContainerRef.current && !routeContainerRef.current.contains(e.target)) {
        setIsRouteDropdownOpen(false);
      }
      if (shopContainerRef.current && !shopContainerRef.current.contains(e.target)) {
        setIsShopDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll highlighted route into view
  useEffect(() => {
    if (isRouteDropdownOpen && routeDropdownRef.current) {
      const activeEl = routeDropdownRef.current.children[routeHighlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [routeHighlightedIndex, isRouteDropdownOpen]);

  // Auto-scroll highlighted shop into view
  useEffect(() => {
    if (isShopDropdownOpen && shopDropdownRef.current) {
      const activeEl = shopDropdownRef.current.children[shopHighlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [shopHighlightedIndex, isShopDropdownOpen]);

  // Filtered routes list for route autocomplete
  const filteredRoutesList = [
    { id: '', name_en: lang === 'ta' ? '-- அனைத்து வழித்தடங்கள் --' : '-- All Routes --', name_ta: '-- அனைத்து வழித்தடங்கள் --' },
    ...routes.filter(r => {
      if (!routeSearchQuery.trim()) return true;
      const q = routeSearchQuery.toLowerCase().trim();
      const nameEn = (r.name_en || '').toLowerCase();
      const nameTa = (r.name_ta || '').toLowerCase();
      return nameEn.includes(q) || nameTa.includes(q);
    })
  ];

  const selectedRouteObj = routes.find(r => r.id === selectedRoute);
  const selectedRouteDisplayName = selectedRoute
    ? (selectedRouteObj ? translateRouteName(selectedRouteObj, lang) : '')
    : (lang === 'ta' ? '-- வழித்தடத்தை தேர்வு செய்க --' : '-- Select Route --');

  // Select route and automatically shift focus to shop search dropdown
  const selectRouteAndFocusShop = (routeId) => {
    setSelectedRoute(routeId);
    setSelectedShop('');
    setCart({});
    setIsRouteDropdownOpen(false);
    setRouteSearchQuery('');

    setTimeout(() => {
      if (shopInputRef.current) {
        shopInputRef.current.focus();
        setIsShopDropdownOpen(true);
        setShopSearchQuery('');
        setShopHighlightedIndex(0);
      }
    }, 50);
  };

  // Keyboard navigation handler for route search
  const handleRouteKeyDown = (e) => {
    if (!isRouteDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsRouteDropdownOpen(true);
      setRouteHighlightedIndex(0);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRouteHighlightedIndex(prev => (prev < filteredRoutesList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRouteHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredRoutesList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredRoutesList.length > 0 && routeHighlightedIndex >= 0 && routeHighlightedIndex < filteredRoutesList.length) {
        const selected = filteredRoutesList[routeHighlightedIndex];
        selectRouteAndFocusShop(selected.id);
      }
    } else if (e.key === 'Escape') {
      setIsRouteDropdownOpen(false);
    }
  };

  // Filter shops by selected route and active status
  const routeShops = selectedRoute ? shops.filter(s => s.route_id === selectedRoute && s.status === 'active') : shops.filter(s => s.status === 'active');
  const filteredRouteShops = routeShops.filter(s => {
    if (!shopSearchQuery.trim()) return true;
    const q = shopSearchQuery.toLowerCase().trim();
    const nameEn = (s.name_en || s.name || '').toLowerCase();
    const nameTa = (s.name_ta || '').toLowerCase();
    const mob = s.mobile || '';
    const addr = (s.address || '').toLowerCase();
    const routeObj = routes.find(r => r.id === s.route_id);
    const routeEn = routeObj ? (routeObj.name_en || '').toLowerCase() : '';
    const routeTa = routeObj ? (routeObj.name_ta || '').toLowerCase() : '';
    return nameEn.includes(q) || nameTa.includes(q) || mob.includes(q) || addr.includes(q) || routeEn.includes(q) || routeTa.includes(q);
  });

  const selectedShopObj = shops.find(s => s.id === selectedShop);
  const selectedShopDisplayName = selectedShop
    ? (selectedShopObj ? `${translateShopName(selectedShopObj, lang)} (${selectedShopObj.shop_type === 'wholesale' ? t('wholesale') : t('retail')})` : '')
    : (lang === 'ta' ? '-- கடையைத் தேர்வு செய்க --' : '-- Select Shop --');

  // Keyboard navigation handler for shop search
  const handleShopKeyDown = (e) => {
    if (!isShopDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsShopDropdownOpen(true);
      setShopHighlightedIndex(0);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShopHighlightedIndex(prev => (prev < filteredRouteShops.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShopHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredRouteShops.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredRouteShops.length > 0 && shopHighlightedIndex >= 0 && shopHighlightedIndex < filteredRouteShops.length) {
        const selected = filteredRouteShops[shopHighlightedIndex];
        setSelectedShop(selected.id);
        if (!selectedRoute) {
          setSelectedRoute(selected.route_id);
        }
        setCart({});
        setIsShopDropdownOpen(false);
        setShopSearchQuery('');
      }
    } else if (e.key === 'Escape') {
      setIsShopDropdownOpen(false);
    }
  };

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
      const name = ((p.name_en || '') + ' ' + (p.name_ta || '')).toLowerCase();
      const cat = (p.category || '').toLowerCase();

      if (selectedBrandTab === 'pepsi') return brand.includes('pepsi');
      if (selectedBrandTab === 'coca-cola') return brand.includes('coca') || brand.includes('coke') || brand.includes('sprite') || brand.includes('thums') || brand.includes('fanta') || brand.includes('limca') || brand.includes('maaza');
      if (selectedBrandTab === 'bovonto') return brand.includes('bovonto');
      if (selectedBrandTab === 'frooti') return brand.includes('frooti') || brand.includes('appy') || brand.includes('parle');
      if (selectedBrandTab === 'kc-brands') return brand.includes('k.c') || brand.includes('kc');
      if (selectedBrandTab === 'daily-brands') return brand.includes('daily');
      if (selectedBrandTab === 'others') {
        const isWater = brand.includes('water') || brand.includes('bisleri') || brand.includes('aqua') || name.includes('water') || name.includes('bisleri') || name.includes('aqua') || cat.includes('water');
        return isWater;
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
        cases: Number(cart[id].cases || 0),
        bottles: Number(cart[id].bottles || 0)
      }))
      .filter(item => item.cases > 0 || item.bottles > 0);

    if (items.length === 0) return alert('Add at least one item to order / ஆர்டரில் ஏதேனும் பொருள் சேர்க்கவும்');

    setSubmitting(true);
    try {
      if (editingOrder) {
        await api.updateOrder(editingOrder.id, {
          shop_id: selectedShop,
          route_id: selectedRoute,
          items,
          discount: Number(discount || 0)
        });
        alert(lang === 'ta' ? 'விலைப்பட்டியல் வெற்றிகரமாக மாற்றப்பட்டது!' : 'Invoice updated successfully!');
        if (onOrderUpdated) {
          onOrderUpdated();
        }
      } else {
        const orderPayload = {
          shop_id: selectedShop,
          route_id: selectedRoute || (shopObj ? shopObj.route_id : ''),
          salesman_id: 'u2',
          items,
          discount: Number(discount || 0)
        };
        const result = await api.createOrder(orderPayload);
        alert(lang === 'ta' ? 'ஆர்டர் வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!' : 'Order Placed Successfully!');
        if (onOrderCreated && result && result.order) {
          onOrderCreated(result.order.id);
        }
      }
    } catch (err) {
      alert(err.message || (lang === 'ta' ? 'ஆர்டர் சமர்ப்பிப்பதில் பிழை' : 'Error processing order transaction'));
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
    { id: 'kc-brands', label: 'K.C Brands' },
    { id: 'daily-brands', label: 'Daily Brands' },
    { id: 'others', label: lang === 'ta' ? 'இதர (தண்ணீர் பாட்டில்கள்)' : 'Others (Water)' }
  ];

  return (
    <div>
      {editingOrder && (
        <div style={{
          background: 'rgba(6, 182, 212, 0.12)',
          border: '1px solid var(--accent-cyan)',
          borderRadius: 'var(--radius)',
          padding: '0.75rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>✏️</span>
            <div>
              <strong style={{ color: 'var(--accent-cyan)', fontSize: '1rem' }}>
                {lang === 'ta' ? 'விலைப்பட்டியல் திருத்துகிறது' : 'Editing Invoice'}: {editingOrder.invoice_number}
              </strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {lang === 'ta' ? 'கடை' : 'Shop'}: {translateShopName(shops.find(s => s.id === editingOrder.shop_id), lang)}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="language-btn"
            onClick={onCancelEdit}
            style={{ fontSize: '0.85rem', padding: '0.35rem 0.8rem' }}
          >
            ✕ {lang === 'ta' ? 'ரத்து செய்' : 'Cancel Edit'}
          </button>
        </div>
      )}

      <div style={{ marginBottom: '0.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.15rem' }}>
          {editingOrder ? `✏️ ${lang === 'ta' ? 'விலைப்பட்டியல் திருத்துக' : 'Edit Invoice'}` : `🛒 ${t('order_taking')}`}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {editingOrder ? (lang === 'ta' ? 'விலைப்பட்டியலின் பொருள்களை திருத்தவும்' : 'Modify items, quantities or discount for this pending invoice') : 'Quick Order entry with live-synced smart cart panel'}
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="glass-card" style={{ marginBottom: '0.75rem', padding: '0.75rem 1.25rem', position: 'relative', zIndex: 500 }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Route Management Searchable Dropdown */}
          <div className="form-group" style={{ flex: 1, minWidth: '240px', margin: 0, position: 'relative' }} ref={routeContainerRef}>
            <label style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>
              {t('route_mgmt')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder={lang === 'ta' ? '🔍 வழித்தடத்தை தேடுக...' : '🔍 Search route...'}
                value={isRouteDropdownOpen ? routeSearchQuery : selectedRouteDisplayName}
                onFocus={() => {
                  setIsRouteDropdownOpen(true);
                  setRouteSearchQuery('');
                  setRouteHighlightedIndex(0);
                }}
                onChange={e => {
                  setRouteSearchQuery(e.target.value);
                  setIsRouteDropdownOpen(true);
                  setRouteHighlightedIndex(0);
                }}
                onKeyDown={handleRouteKeyDown}
                style={{ fontSize: '0.9rem', width: '100%', paddingRight: '2rem', padding: '0.45rem 0.75rem' }}
              />
              <button
                type="button"
                onClick={() => setIsRouteDropdownOpen(!isRouteDropdownOpen)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0
                }}
              >
                ▼
              </button>
            </div>

            {/* Interactive Route Dropdown Popup */}
            {isRouteDropdownOpen && (
              <div
                ref={routeDropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 9999,
                  marginTop: '4px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  background: '#ffffff',
                  border: '2px solid var(--accent-cyan)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                  padding: '4px 0'
                }}
              >
                {filteredRoutesList.length === 0 ? (
                  <div style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                    {lang === 'ta' ? 'வழித்தடங்கள் எதுவும் இல்லை' : 'No matching routes'}
                  </div>
                ) : (
                  filteredRoutesList.map((r, idx) => {
                    const isHighlighted = idx === routeHighlightedIndex;
                    const isSelected = selectedRoute === r.id;
                    const rName = r.id === '' ? (lang === 'ta' ? '-- அனைத்து வழித்தடங்கள் --' : '-- All Routes --') : (lang === 'ta' ? (r.name_ta || r.name_en) : (r.name_en || r.name_ta));

                    return (
                      <div
                        key={r.id || 'all'}
                        onMouseEnter={() => setRouteHighlightedIndex(idx)}
                        onClick={() => {
                          selectRouteAndFocusShop(r.id);
                        }}
                        style={{
                          padding: '0.6rem 0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease',
                          background: isHighlighted
                            ? 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)'
                            : isSelected
                            ? '#e0f2fe'
                            : '#ffffff',
                          color: isHighlighted ? '#ffffff' : '#0f172a',
                          borderBottom: '1px solid #f1f5f9',
                          borderLeft: isHighlighted ? '4px solid #0284c7' : '4px solid transparent',
                          fontWeight: isHighlighted ? '700' : isSelected ? '600' : 'normal'
                        }}
                      >
                        <div style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>🗺️ {rName}</span>
                          {isSelected && (
                            <span style={{ fontSize: '0.7rem', background: isHighlighted ? 'rgba(255,255,255,0.3)' : '#0284c7', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Select Shop Searchable Dropdown */}
          <div className="form-group" style={{ flex: 1, minWidth: '260px', margin: 0, position: 'relative' }} ref={shopContainerRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label style={{ fontWeight: '600', fontSize: '0.85rem', margin: 0 }}>{t('select_shop')}</label>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                ({filteredRouteShops.length} {lang === 'ta' ? 'கடைகள்' : 'shops'})
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                ref={shopInputRef}
                type="text"
                className="form-input"
                placeholder={lang === 'ta' ? '🔍 கடை பெயர் / மொபைல் தேடுக...' : '🔍 Search shop name / mobile...'}
                value={isShopDropdownOpen ? shopSearchQuery : selectedShopDisplayName}
                onFocus={() => {
                  setIsShopDropdownOpen(true);
                  setShopSearchQuery('');
                  setShopHighlightedIndex(0);
                }}
                onChange={e => {
                  setShopSearchQuery(e.target.value);
                  setIsShopDropdownOpen(true);
                  setShopHighlightedIndex(0);
                }}
                onKeyDown={handleShopKeyDown}
                style={{ fontSize: '0.9rem', width: '100%', paddingRight: '2rem', padding: '0.45rem 0.75rem' }}
              />
              <button
                type="button"
                onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0
                }}
              >
                ▼
              </button>
            </div>

            {/* Interactive Shop Dropdown Popup */}
            {isShopDropdownOpen && (
              <div
                ref={shopDropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 9999,
                  marginTop: '4px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  background: '#ffffff',
                  border: '2px solid var(--accent-cyan)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
                  padding: '4px 0'
                }}
              >
                {filteredRouteShops.length === 0 ? (
                  <div style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                    {lang === 'ta' ? 'கடைகள் எதுவும் கிடைக்கவில்லை' : 'No matching shops'}
                  </div>
                ) : (
                  filteredRouteShops.map((s, idx) => {
                    const isHighlighted = idx === shopHighlightedIndex;
                    const isSelected = selectedShop === s.id;
                    const routeObj = routes.find(r => r.id === s.route_id);
                    const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'Unassigned';

                    return (
                      <div
                        key={s.id}
                        onMouseEnter={() => setShopHighlightedIndex(idx)}
                        onClick={() => {
                          setSelectedShop(s.id);
                          if (!selectedRoute) {
                            setSelectedRoute(s.route_id);
                          }
                          setCart({});
                          setIsShopDropdownOpen(false);
                          setShopSearchQuery('');
                        }}
                        style={{
                          padding: '0.65rem 0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease',
                          background: isHighlighted
                            ? 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)'
                            : isSelected
                            ? '#e0f2fe'
                            : '#ffffff',
                          color: isHighlighted ? '#ffffff' : '#0f172a',
                          borderBottom: '1px solid #f1f5f9',
                          borderLeft: isHighlighted ? '4px solid #0284c7' : '4px solid transparent'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: isHighlighted ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{translateShopName(s, lang)}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 'normal' }}>
                              ({s.shop_type === 'wholesale' ? t('wholesale') : t('retail')})
                            </span>
                            {isSelected && (
                              <span style={{ fontSize: '0.7rem', background: isHighlighted ? 'rgba(255,255,255,0.3)' : '#0284c7', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                Selected
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: isHighlighted ? 'rgba(255,255,255,0.92)' : '#475569', marginTop: '2px' }}>
                            🗺️ {routeName} {s.mobile ? `| 📞 ${s.mobile}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: '800',
                              color: isHighlighted ? '#ffffff' : s.outstanding_amount > 0 ? '#d97706' : '#16a34a',
                              background: isHighlighted ? 'rgba(0,0,0,0.25)' : '#f8fafc',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: isHighlighted ? '1px solid rgba(255,255,255,0.4)' : '1px solid #e2e8f0'
                            }}
                          >
                            ₹{Number(s.outstanding_amount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
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
                  {submitting ? '...' : (editingOrder ? `💾 ${lang === 'ta' ? 'மாற்றங்களை சேமி' : 'Update Invoice'}` : `⚡ ${t('place_order')}`)}
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
