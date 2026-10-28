import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';
import { calculateOrderGstBreakdown } from '../utils/gstUtils';
import { translateShopName, translateRouteName, translateProductName } from '../translations';
import RoughBill from './RoughBill';

export default function OrderTaking({ t, lang, currentUser, onOrderCreated, editingOrder, onOrderUpdated, onCancelEdit, initialSubTab = 'regular', onSubTabChange }) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab || 'regular');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSubTabSwitch = (tab) => {
    setActiveSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  const [routes, setRoutes] = useState(() => api.getCached('routes') || []);
  const [shops, setShops] = useState(() => api.getCached('shops') || []);
  const [products, setProducts] = useState(() => api.getCached('products') || []);
  const [orders, setOrders] = useState(() => api.getCached('orders') || []);
  const [orderItems, setOrderItems] = useState(() => api.getCached('order_items') || []);

  // Selected fields
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedShop, setSelectedShop] = useState('');
  const [cart, setCart] = useState({}); // key: product_id, val: { cases: 0, bottles: 0 }
  const [discount, setDiscount] = useState(0);
  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const [orderDate, setOrderDate] = useState(getTodayDateStr);
  const [loading, setLoading] = useState(() => !api.getCached('products') || api.getCached('products').length === 0);
  const [submitting, setSubmitting] = useState(false);
  const [orderPlacedPopupInfo, setOrderPlacedPopupInfo] = useState(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  const handleCloseOrderPlacedPopup = () => {
    if (orderPlacedPopupInfo && typeof orderPlacedPopupInfo.onConfirm === 'function') {
      try {
        orderPlacedPopupInfo.onConfirm();
      } catch (err) {
        console.error('Error executing popup onConfirm:', err);
      }
    }
    setOrderPlacedPopupInfo(null);
  };

  // Keyboard shortcut: Escape or Enter closes the order placed popup
  useEffect(() => {
    if (!orderPlacedPopupInfo) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        handleCloseOrderPlacedPopup();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orderPlacedPopupInfo]);

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
      if (editingOrder.order_date) {
        setOrderDate(editingOrder.order_date.split('T')[0]);
      }
      if (editingOrder.delivery_date) {
        setDeliveryDate(editingOrder.delivery_date.split('T')[0]);
      } else if (editingOrder.order_date) {
        setDeliveryDate(editingOrder.order_date.split('T')[0]);
      }

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

  const handleConfirmOrder = async (orderId) => {
    setConfirmingOrderId(orderId);
    try {
      await api.confirmOrder(orderId);
      alert(lang === 'ta' ? 'ஆர்டர் உறுதிசெய்யப்பட்டு விநியோகப் பக்கத்திற்கு நகர்த்தப்பட்டது!' : 'Order confirmed successfully! Moved to Deliveries.');
      const [oData, pData, oiData] = await Promise.all([
        api.getOrders(),
        api.getProducts(),
        api.getOrderItems()
      ]);
      setOrders(oData || []);
      setProducts(pData || []);
      setOrderItems(oiData || []);
    } catch (err) {
      alert(err.message || 'Failed to confirm order');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  const handleCancelPendingOrder = async (orderId) => {
    const reason = window.prompt(lang === 'ta' ? 'ஆர்டரை ரத்து செய்வதற்கான காரணத்தை உள்ளிடவும்:' : 'Enter reason for cancelling order:');
    if (reason === null) return;
    setCancellingOrderId(orderId);
    try {
      await api.cancelOrder(orderId, reason);
      alert(lang === 'ta' ? 'ஆர்டர் ரத்து செய்யப்பட்டது.' : 'Order cancelled.');
      const [oData, pData] = await Promise.all([
        api.getOrders(),
        api.getProducts()
      ]);
      setOrders(oData || []);
      setProducts(pData || []);
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancellingOrderId(null);
    }
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
      const orderDateIso = orderDate ? new Date(orderDate).toISOString() : new Date().toISOString();
      const deliveryDateIso = orderDateIso;

      if (editingOrder) {
        await api.updateOrder(editingOrder.id, {
          shop_id: selectedShop,
          route_id: selectedRoute,
          items,
          discount: Number(discount || 0),
          order_date: orderDateIso,
          delivery_date: deliveryDateIso,
          invoice_date: deliveryDateIso
        });
        const invNum = editingOrder.invoice_number || `ORD-${editingOrder.id}`;
        setOrderPlacedPopupInfo({
          title: lang === 'ta' ? 'ஆர்டர் புதுப்பிக்கப்பட்டது' : 'Order Updated',
          message: lang === 'ta'
            ? `விலைப்பட்டியல் #${invNum} வெற்றிகரமாக புதுப்பிக்கப்பட்டது!`
            : `Order #${invNum} updated successfully!`,
          onConfirm: () => {
            setOrderPlacedPopupInfo(null);
            if (onOrderUpdated) {
              onOrderUpdated();
            }
          }
        });
      } else {
        const tempOrderId = `ord_${Date.now()}`;
        const cachedOrders = api.getCached('orders') || [];

        // Find lowest available candidate starting from INV-1001
        const usedNumbers = new Set();
        cachedOrders.forEach(o => {
          if (o.invoice_number) {
            const match = String(o.invoice_number).match(/INV-(\d+)/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num)) usedNumbers.add(num);
            }
          }
        });

        let candidate = 1001;
        while (usedNumbers.has(candidate)) {
          candidate++;
        }
        const invoiceNum = `INV-${candidate}`;

        // Map items with deterministic IDs matching client and server
        const orderItemsList = items.map((it, idx) => {
          const prod = products.find(p => p.id === it.product_id) || {};
          const rate = shopObj?.shop_type === 'wholesale' ? prod.wholesale_price : prod.retail_price;
          const totalQty = (Number(it.cases || 0) * (prod.case_qty_rule || 1)) + Number(it.bottles || 0);
          const amount = Math.round(totalQty * (rate / (prod.case_qty_rule || 1)));
          const itemId = `oi_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
          return {
            id: itemId,
            order_id: tempOrderId,
            product_id: it.product_id,
            cases: Number(it.cases || 0),
            bottles: Number(it.bottles || 0),
            rate: rate,
            amount: amount
          };
        });

        const totalAmount = orderItemsList.reduce((sum, item) => sum + item.amount, 0);
        const discountAmt = Number(discount || 0);
        const netAmount = Math.max(0, totalAmount - discountAmt);

        const isSalesman = currentUser?.role === 'salesman' || currentUser?.role === 'sales';
        const initialStatus = isSalesman ? 'pending_confirmation' : 'pending';

        const optimisticOrder = {
          id: tempOrderId,
          invoice_number: invoiceNum,
          route_id: selectedRoute || (shopObj ? shopObj.route_id : ''),
          shop_id: selectedShop,
          salesman_id: currentUser?.id || 'u2',
          order_date: orderDateIso,
          delivery_date: deliveryDateIso,
          invoice_date: deliveryDateIso,
          total_amount: totalAmount,
          discount: discountAmt,
          net_amount: netAmount,
          previous_outstanding: Number(shopObj?.outstanding_amount || 0),
          status: initialStatus,
          delivery_man_id: (api.getCached('routes') || []).find(r => r.id === (selectedRoute || shopObj?.route_id))?.delivery_man_id || ''
        };

        const tempDeliveryId = `del_${Date.now()}`;
        const optimisticDelivery = {
          id: tempDeliveryId,
          order_id: tempOrderId,
          delivery_man_id: optimisticOrder.delivery_man_id,
          status: 'pending',
          delivery_time: null,
          remarks: ''
        };

        const orderPayload = {
          id: tempOrderId,
          invoice_number: invoiceNum,
          delivery_id: tempDeliveryId,
          shop_id: selectedShop,
          route_id: selectedRoute || (shopObj ? shopObj.route_id : ''),
          salesman_id: currentUser?.id || 'u2',
          is_salesman: isSalesman,
          status: initialStatus,
          require_confirmation: isSalesman,
          items: orderItemsList,
          discount: discountAmt,
          order_date: orderDateIso,
          delivery_date: deliveryDateIso,
          invoice_date: deliveryDateIso
        };

        // 1. If NOT salesman, immediately deduct product stock in local state & cache for instant 0ms reduction
        if (!isSalesman) {
          const updatedProds = products.map(p => {
            const cartItem = cart[p.id];
            if (cartItem) {
              const deducted = (Number(cartItem.cases || 0) * p.case_qty_rule) + Number(cartItem.bottles || 0);
              return { ...p, current_stock_bottles: Math.max(0, p.current_stock_bottles - deducted) };
            }
            return p;
          });
          setProducts(updatedProds);
          api.setCached('products', updatedProds);
        }

        // 2. Populate orders & order_items in clientCache immediately
        api.setCached('orders', [optimisticOrder, ...cachedOrders.filter(o => o.id !== tempOrderId)]);
        setOrders(prev => [optimisticOrder, ...prev.filter(o => o.id !== tempOrderId)]);
        const cachedItems = api.getCached('order_items') || [];
        api.setCached('order_items', [...orderItemsList, ...cachedItems.filter(i => i.order_id !== tempOrderId)]);
        setOrderItems(prev => [...orderItemsList, ...prev.filter(i => i.order_id !== tempOrderId)]);

        if (!isSalesman) {
          const cachedDeliveries = api.getCached('deliveries') || [];
          api.setCached('deliveries', [optimisticDelivery, ...cachedDeliveries.filter(d => d.order_id !== tempOrderId)]);
        }

        // 3. Clear cart and input states
        setCart({});
        setDiscount(0);

        // 4. Instantly notify user
        if (isSalesman) {
          setOrderPlacedPopupInfo({
            title: lang === 'ta' ? 'ஆர்டர் அனுப்பப்பட்டது' : 'Order Placed (Pending Confirmation)',
            message: lang === 'ta'
              ? `விலைப்பட்டியல் #${invoiceNum} நிர்வாகி (Admin) ஒப்புதலுக்காக அனுப்பப்பட்டுள்ளது. நிர்வாகி இருப்பை உறுதி செய்த பின்னரே விநியோகப் பக்கத்திற்கு செல்லும்.`
              : `Order #${invoiceNum} placed by Salesman! Status: Pending Confirmation. Admin will review available stock and confirm before it moves to Deliveries.`,
            onConfirm: () => {
              setOrderPlacedPopupInfo(null);
            }
          });
        } else if (onOrderCreated) {
          onOrderCreated(tempOrderId, optimisticOrder, orderItemsList);
        }

        // 5. Commit to backend asynchronously in background with safety rollback
        api.createOrder(orderPayload).then(result => {
          if (result && result.products) {
            setProducts(result.products);
            api.setCached('products', result.products);
          }
          if (result && result.order) {
            const latestOrders = (api.getCached('orders') || []).filter(o => o.id !== tempOrderId && o.id !== result.order.id);
            api.setCached('orders', [result.order, ...latestOrders]);
            if (result.items) {
              const latestItems = (api.getCached('order_items') || []).filter(i => i.order_id !== tempOrderId && i.order_id !== result.order.id);
              api.setCached('order_items', [...result.items, ...latestItems]);
            }
          }
          if (result && result.delivery) {
            const latestDeliveries = (api.getCached('deliveries') || []).filter(d => d.id !== tempDeliveryId && d.order_id !== tempOrderId && d.id !== result.delivery.id);
            api.setCached('deliveries', [result.delivery, ...latestDeliveries]);
          }
        }).catch(err => {
          console.error('Order creation error in background:', err);
          alert(err.message || (lang === 'ta' ? 'ஆர்டர் சமர்ப்பிப்பதில் பிழை' : 'Error processing order transaction'));
        });
        return;
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

  // Compute live GST breakdown for current order cart
  const cartItemsArray = Object.keys(cart).map(id => {
    const prod = products.find(p => p.id === id);
    const item = cart[id];
    const rate = prod ? getProductPrice(prod) : 0;
    return {
      product_id: id,
      cases: Number(item?.cases || 0),
      bottles: Number(item?.bottles || 0),
      rate
    };
  }).filter(it => it.cases > 0 || it.bottles > 0);

  const gstBreakdown = calculateOrderGstBreakdown({
    items: cartItemsArray,
    products,
    discount: Number(discount || 0),
    customerGstin: shopObj?.gst_number || '',
    companyGstin: '33CWRPK4071L1Z2'
  });

  const handleExportCartExcel = () => {
    if (gstBreakdown.items.length === 0) return alert('No items in cart to export');
    const wb = XLSX.utils.book_new();
    const rows = [
      ['ORDER CART / ESTIMATE - GSK AGENCY'],
      ['Shop:', shopObj ? (lang === 'ta' ? shopObj.name_ta || shopObj.name_en : shopObj.name_en) : 'Not selected'],
      ['Route:', selectedRouteDisplayName],
      ['Date:', new Date().toLocaleDateString()],
      [''],
      ['S.No', 'Product Name', 'Size', 'Cases', 'Bottles', 'Rate (₹)', 'Taxable (₹)', 'GST %', 'CGST (₹)', 'SGST (₹)', 'Total (₹)']
    ];

    gstBreakdown.items.forEach((it, idx) => {
      const p = it.product;
      rows.push([
        idx + 1,
        p ? (lang === 'ta' ? p.name_ta || p.name_en : p.name_en) : 'Product',
        p?.size || '-',
        it.cases,
        it.bottles,
        it.rate,
        it.taxableAmount,
        `${it.gstRate}%`,
        it.cgstAmount,
        it.sgstAmount,
        it.grandTotal
      ]);
    });

    rows.push([
      'TOTAL', '', '',
      gstBreakdown.items.reduce((s, it) => s + it.cases, 0),
      gstBreakdown.items.reduce((s, it) => s + it.bottles, 0),
      '',
      gstBreakdown.taxableAmount,
      '',
      gstBreakdown.totalCgst,
      gstBreakdown.totalSgst,
      gstBreakdown.grandTotalIncGst
    ]);

    rows.push(['']);
    rows.push(['Gross Amount (₹):', gstBreakdown.grossTotal]);
    rows.push(['Discount (-):', -gstBreakdown.discount]);
    rows.push(['Taxable Amount (₹):', gstBreakdown.taxableAmount]);
    rows.push(['Total CGST (₹):', gstBreakdown.totalCgst]);
    rows.push(['Total SGST (₹):', gstBreakdown.totalSgst]);
    rows.push(['Total GST (₹):', gstBreakdown.totalGst]);
    rows.push(['Grand Total Inc. GST (₹):', gstBreakdown.grandTotalIncGst]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Order_Estimate');
    XLSX.writeFile(wb, `Order_Estimate_${shopObj ? shopObj.name_en.replace(/\s+/g, '_') : 'Cart'}.xlsx`);
  };

  const handleExportCartCSV = () => {
    if (gstBreakdown.items.length === 0) return alert('No items in cart to export');
    const csvRows = [
      `"ORDER ESTIMATE - GSK AGENCY"`,
      `"Shop:","${shopObj ? shopObj.name_en.replace(/"/g, '""') : ''}"`,
      `"Date:","${new Date().toLocaleDateString()}"`,
      '',
      'S.No,Product_Name,Size,Cases,Bottles,Rate,Taxable_Amount,GST_Rate,CGST_Amount,SGST_Amount,Total_Amount'
    ];

    gstBreakdown.items.forEach((it, idx) => {
      const p = it.product;
      csvRows.push([
        idx + 1,
        `"${p ? p.name_en.replace(/"/g, '""') : 'Product'}"`,
        `"${p?.size || ''}"`,
        it.cases,
        it.bottles,
        it.rate,
        it.taxableAmount,
        `${it.gstRate}%`,
        it.cgstAmount,
        it.sgstAmount,
        it.grandTotal
      ].join(','));
    });

    csvRows.push([
      '"TOTAL"', '""', '""',
      gstBreakdown.items.reduce((s, it) => s + it.cases, 0),
      gstBreakdown.items.reduce((s, it) => s + it.bottles, 0),
      '""',
      gstBreakdown.taxableAmount,
      '""',
      gstBreakdown.totalCgst,
      gstBreakdown.totalSgst,
      gstBreakdown.grandTotalIncGst
    ].join(','));

    csvRows.push('');
    csvRows.push(`"Gross Amount:","${gstBreakdown.grossTotal}"`);
    csvRows.push(`"Discount:","-${gstBreakdown.discount}"`);
    csvRows.push(`"Taxable Amount:","${gstBreakdown.taxableAmount}"`);
    csvRows.push(`"Total CGST:","${gstBreakdown.totalCgst}"`);
    csvRows.push(`"Total SGST:","${gstBreakdown.totalSgst}"`);
    csvRows.push(`"Total GST:","${gstBreakdown.totalGst}"`);
    csvRows.push(`"Grand Total Inc. GST:","${gstBreakdown.grandTotalIncGst}"`);

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Order_Estimate_${shopObj ? shopObj.name_en.replace(/\s+/g, '_') : 'Cart'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      {/* Top Modal / Popup: Order Placed with OK */}
      {orderPlacedPopupInfo && (
        <div
          id="order-placed-popup-overlay"
          onClick={handleCloseOrderPlacedPopup}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: '60px'
          }}
        >
          <div
            id="order-placed-popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              background: 'var(--bg-card, #0f172a)',
              border: '2px solid var(--accent-cyan, #06b6d4)',
              borderRadius: '14px',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.7), 0 0 25px rgba(6, 182, 212, 0.35)',
              padding: '1.75rem 2rem',
              width: '90%',
              maxWidth: '460px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'fadeInDown 0.25s ease-out'
            }}
          >
            {/* Top right close button */}
            <button
              type="button"
              id="order-placed-popup-close-x"
              onClick={handleCloseOrderPlacedPopup}
              style={{
                position: 'absolute',
                top: '12px',
                right: '14px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '1.3rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px 8px',
                borderRadius: '6px'
              }}
              title={lang === 'ta' ? 'மூடு' : 'Close'}
            >
              ✕
            </button>

            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '2px solid var(--accent-cyan, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              marginBottom: '0.85rem'
            }}>
              ✅
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main, #ffffff)' }}>
              {orderPlacedPopupInfo.title}
            </h3>
            <p style={{ margin: '0 0 1.35rem 0', fontSize: '0.92rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.45 }}>
              {orderPlacedPopupInfo.message}
            </p>
            <button
              type="button"
              id="order-placed-popup-ok-btn"
              onClick={handleCloseOrderPlacedPopup}
              className="btn btn-primary"
              style={{
                minWidth: '130px',
                padding: '0.65rem 2.2rem',
                fontSize: '0.98rem',
                fontWeight: 800,
                cursor: 'pointer',
                borderRadius: '8px',
                background: 'var(--accent-cyan, #06b6d4)',
                borderColor: 'var(--accent-cyan, #06b6d4)',
                color: '#0f172a'
              }}
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      )}

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

      {/* Sub Menu under Order Taking */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }} className="no-print">
        <button
          type="button"
          onClick={() => handleSubTabSwitch('regular')}
          className={`btn ${activeSubTab === 'regular' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            fontSize: '0.88rem',
            fontWeight: '700',
            padding: '0.45rem 1.1rem',
            borderRadius: '20px',
            background: activeSubTab === 'regular' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)',
            color: activeSubTab === 'regular' ? '#0f172a' : 'var(--text-main)',
            border: activeSubTab === 'regular' ? 'none' : '1px solid var(--border-color)',
            cursor: 'pointer'
          }}
        >
          🛒 {lang === 'ta' ? 'வழக்கமான ஆர்டர் (Regular Order)' : 'Regular Sales Order'}
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSwitch('rough_bill')}
          className={`btn ${activeSubTab === 'rough_bill' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            fontSize: '0.88rem',
            fontWeight: '700',
            padding: '0.45rem 1.1rem',
            borderRadius: '20px',
            background: activeSubTab === 'rough_bill' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)',
            color: activeSubTab === 'rough_bill' ? '#0f172a' : 'var(--text-main)',
            border: activeSubTab === 'rough_bill' ? 'none' : '1px solid var(--border-color)',
            cursor: 'pointer'
          }}
        >
          🧾 {lang === 'ta' ? 'ரஃப் பில் (Rough Bill - Walk-in)' : 'Rough Bill (Walk-in Quick Billing)'}
        </button>

        <button
          type="button"
          onClick={() => handleSubTabSwitch('confirmation')}
          className={`btn ${activeSubTab === 'confirmation' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            fontSize: '0.88rem',
            fontWeight: '700',
            padding: '0.45rem 1.1rem',
            borderRadius: '20px',
            background: activeSubTab === 'confirmation' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)',
            color: activeSubTab === 'confirmation' ? '#0f172a' : 'var(--text-main)',
            border: activeSubTab === 'confirmation' ? 'none' : '1px solid var(--border-color)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <span>⚡ {lang === 'ta' ? 'ஆர்டர் உறுதிப்படுத்தல்' : 'Order Confirmation'}</span>
          {(orders || []).filter(o => o.status === 'pending_confirmation').length > 0 && (
            <span style={{
              background: activeSubTab === 'confirmation' ? '#b91c1c' : 'var(--warning)',
              color: '#fff',
              padding: '1px 7px',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: '800'
            }}>
              {(orders || []).filter(o => o.status === 'pending_confirmation').length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'rough_bill' ? (
        <RoughBill t={t} lang={lang} onBack={() => handleSubTabSwitch('regular')} />
      ) : activeSubTab === 'confirmation' ? (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚡ {lang === 'ta' ? 'நிர்வாகி ஆர்டர் உறுதிப்படுத்தல் & இருப்பு சரிபார்ப்பு' : 'Admin Order Confirmation & Stock Validation'}
              </h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {lang === 'ta'
                  ? 'விற்பனையாளர்கள் எடுத்த ஆர்டர்களை மதிப்பாய்வு செய்து, இருப்பு இருப்பதை உறுதிசெய்து, விநியோகப் பக்கத்திற்கு அனுப்பவும்.'
                  : 'Review orders placed by salesmen, validate warehouse stock, and confirm orders to move to Deliveries.'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: 'var(--warning)', border: '1px solid var(--warning)', fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                ⏳ {(orders || []).filter(o => o.status === 'pending_confirmation').length} {lang === 'ta' ? 'உறுதிப்படுத்தல் நிலுவையில்' : 'Pending Confirmation'}
              </span>
            </div>
          </div>

          {(orders || []).filter(o => o.status === 'pending_confirmation').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                {lang === 'ta' ? 'உறுதிப்படுத்த நிலுவையில் உள்ள ஆர்டர்கள் எதுவும் இல்லை' : 'No Pending Orders Awaiting Confirmation'}
              </h3>
              <p style={{ fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto' }}>
                {lang === 'ta'
                  ? 'விற்பனையாளர்கள் புதிய ஆர்டர்களை எடுக்கும்போது, அவை இங்கே காண்பிக்கப்படும்.'
                  : 'When salesmen place orders from the field, they will appear here for review and confirmation before moving to Deliveries.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {(orders || []).filter(o => o.status === 'pending_confirmation').map(ord => {
                const shop = shops.find(s => s.id === ord.shop_id);
                const route = routes.find(r => r.id === ord.route_id);
                const itemsForOrder = orderItems.filter(oi => oi.order_id === ord.id);

                let hasShortage = false;
                const itemsAnalysis = itemsForOrder.map(item => {
                  const prod = products.find(p => p.id === item.product_id);
                  const caseRule = prod?.case_qty_rule || 24;
                  const reqBottles = (Number(item.cases || 0) * caseRule) + Number(item.bottles || 0);
                  const availBottles = prod ? Number(prod.current_stock_bottles || 0) : 0;
                  const isItemShort = availBottles < reqBottles;
                  if (isItemShort) hasShortage = true;

                  const shortageDiff = Math.max(0, reqBottles - availBottles);
                  const shortageCases = Math.floor(shortageDiff / caseRule);
                  const shortageRemBottles = shortageDiff % caseRule;

                  return {
                    ...item,
                    product: prod,
                    caseRule,
                    reqBottles,
                    availBottles,
                    isItemShort,
                    shortageDiff,
                    shortageCases,
                    shortageRemBottles
                  };
                });

                return (
                  <div key={ord.id} className="glass-card" style={{ padding: '1.25rem', border: hasShortage ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1.5px solid rgba(16, 185, 129, 0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                            {ord.invoice_number || ord.id}
                          </span>
                          <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--warning)', fontWeight: '700' }}>
                            ⏳ {lang === 'ta' ? 'உறுதிப்படுத்தல் நிலுவையில்' : 'Pending Confirmation'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <strong>{shop ? (lang === 'ta' ? shop.name_ta || shop.name_en : shop.name_en) : 'Unknown Shop'}</strong>
                          {route && ` • ${lang === 'ta' ? route.name_ta || route.name_en : route.name_en}`}
                          {ord.order_date && ` • 📅 ${new Date(ord.order_date).toLocaleDateString('en-GB')}`}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--success)' }}>
                          ₹{ord.net_amount || ord.total_amount || 0}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {itemsForOrder.length} {lang === 'ta' ? 'பொருட்கள்' : 'items'}
                        </div>
                      </div>
                    </div>

                    {/* Items table with Live Stock Comparison */}
                    <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                      <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{lang === 'ta' ? 'தயாரிப்பு' : 'Product'}</th>
                            <th>{lang === 'ta' ? 'ஆர்டர் அளவு' : 'Ordered Qty'}</th>
                            <th>{lang === 'ta' ? 'மொத்த பாட்டில்கள்' : 'Total Bottles'}</th>
                            <th>{lang === 'ta' ? 'கிடைக்கும் இருப்பு' : 'Available Stock'}</th>
                            <th>{lang === 'ta' ? 'இருப்பு நிலை' : 'Stock Status'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsAnalysis.map((item, idx) => {
                            const pName = item.product ? (lang === 'ta' ? item.product.name_ta || item.product.name_en : item.product.name_en) : 'Product';
                            const pSize = item.product ? item.product.size : '';
                            return (
                              <tr key={item.id || idx}>
                                <td>{idx + 1}</td>
                                <td>
                                  <strong>{pName}</strong> <span style={{ color: 'var(--accent-cyan)' }}>({pSize})</span>
                                </td>
                                <td>
                                  {item.cases > 0 ? `${item.cases} C ` : ''}
                                  {item.bottles > 0 ? `${item.bottles} B` : ''}
                                </td>
                                <td>{item.reqBottles} Bottles</td>
                                <td>
                                  {Math.floor(item.availBottles / item.caseRule)} Cases ({item.availBottles} Bottles)
                                </td>
                                <td>
                                  {item.isItemShort ? (
                                    <span className="badge badge-danger" style={{ fontWeight: '700' }}>
                                      ⚠️ Shortage: {item.shortageCases > 0 ? `${item.shortageCases} C, ` : ''}{item.shortageRemBottles} B short
                                    </span>
                                  ) : (
                                    <span className="badge badge-success" style={{ fontWeight: '700' }}>
                                      ✅ In Stock
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Stock Alert Summary */}
                    {hasShortage ? (
                      <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                        <strong>⚠️ {lang === 'ta' ? 'இருப்பு பற்றாக்குறை உள்ளது!' : 'Insufficient Stock Shortage Detected:'}</strong>
                        <div style={{ marginTop: '0.25rem' }}>
                          {lang === 'ta'
                            ? 'சில பொருட்களுக்கு போதுமான இருப்பு இல்லை. தயவுசெய்து கொள்முதல் பதிவில் (Purchase Entry) சரக்கை சேர்த்த பிறகு இந்த ஆர்டரை உறுதி செய்யவும்.'
                            : 'Stock shortage detected. Confirmation is blocked to prevent overselling. Add inventory via Purchase Entry before confirming.'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', padding: '0.6rem 1rem', borderRadius: '6px', marginBottom: '1rem', color: '#86efac', fontSize: '0.85rem' }}>
                        <strong>✅ {lang === 'ta' ? 'அனைத்து பொருட்களுக்கும் போதுமான இருப்பு உள்ளது.' : 'All items are available in stock.'}</strong>
                        <span> {lang === 'ta' ? 'இந்த ஆர்டரை உறுதி செய்து உடனடியாக விநியோகத்திற்கு நகர்த்தலாம்.' : 'Ready to confirm. Will automatically move to Deliveries page.'}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleCancelPendingOrder(ord.id)}
                        disabled={cancellingOrderId === ord.id}
                        style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        {cancellingOrderId === ord.id ? 'Cancelling...' : `❌ ${lang === 'ta' ? 'ஆர்டர் ரத்து செய்' : 'Cancel Order'}`}
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleConfirmOrder(ord.id)}
                        disabled={hasShortage || confirmingOrderId === ord.id}
                        style={{
                          background: hasShortage ? 'rgba(255,255,255,0.1)' : 'var(--success)',
                          borderColor: hasShortage ? 'var(--border-color)' : 'var(--success)',
                          color: hasShortage ? 'var(--text-muted)' : '#000',
                          cursor: hasShortage ? 'not-allowed' : 'pointer',
                          fontWeight: '800'
                        }}
                      >
                        {confirmingOrderId === ord.id 
                          ? '⏳ Confirming...' 
                          : `⚡ ${lang === 'ta' ? 'ஆர்டரை உறுதி செய் (விநியோகத்திற்கு நகர்த்து)' : 'Confirm Order (Move to Deliveries)'}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.15rem' }}>
              {editingOrder ? `✏️ ${lang === 'ta' ? 'விலைப்பட்டியல் திருத்துக' : 'Edit Invoice'}` : `🛒 ${t('order_taking')}`}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {editingOrder ? (lang === 'ta' ? 'விலைப்பட்டியலின் பொருள்களை திருத்தவும்' : 'Modify items, quantities or discount for this pending invoice') : 'Quick Order entry with live-synced smart cart panel'}
            </p>
          </div>

      {/* Selectors Bar */}
      <div className="glass-card" style={{ marginBottom: '0.75rem', padding: '0.75rem 1.25rem', position: 'relative', zIndex: 40 }}>
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
                      const inCartBottles = ((Number(cart[p.id]?.cases) || 0) * p.case_qty_rule) + (Number(cart[p.id]?.bottles) || 0);
                      const remainingBottles = Math.max(0, p.current_stock_bottles - inCartBottles);
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{translateProductName(p, lang)}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.brand} | {p.size}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span style={{ 
                                fontSize: '0.82rem', 
                                fontWeight: '700', 
                                color: remainingBottles === 0 ? 'var(--danger)' : 'var(--text-main)'
                              }}>
                                {formatStock(remainingBottles, p.case_qty_rule)}
                              </span>
                              {inCartBottles > 0 && (
                                <span style={{ fontSize: '0.7rem', color: '#eab308', fontWeight: '600' }}>
                                  ({lang === 'ta' ? 'கூடையில்' : 'in cart'}: -{formatStock(inCartBottles, p.case_qty_rule)})
                                </span>
                              )}
                            </div>
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

              {/* Complete Price Details & GST Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gross Amount:</span>
                  <strong>₹{gstBreakdown.grossTotal}</strong>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '600' }}>{t('discount')} (Rs)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={discount || ''}
                    onChange={e => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    placeholder="0"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                    onWheel={(e) => e.target.blur()}
                  />
                </div>

                {/* Taxable Amount Before GST */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#0284c7', background: 'rgba(2, 132, 199, 0.08)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  <span>Taxable Amount Before GST:</span>
                  <strong>₹{gstBreakdown.taxableAmount}</strong>
                </div>

                {/* CGST & SGST Split Display */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  <span>CGST:</span>
                  <strong>₹{gstBreakdown.totalCgst}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--success)' }}>
                  <span>SGST:</span>
                  <strong>₹{gstBreakdown.totalSgst}</strong>
                </div>

                {gstBreakdown.totalIgst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--warning)' }}>
                    <span>IGST:</span>
                    <strong>₹{gstBreakdown.totalIgst}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f59e0b', borderTop: '1px dashed var(--border-color)', paddingTop: '0.35rem' }}>
                  <span>Total GST:</span>
                  <strong>₹{gstBreakdown.totalGst}</strong>
                </div>

                {/* Grand Total Including GST */}
                <div style={{ 
                  display: 'flex', 
                  justify: 'space-between', 
                  fontSize: '1.25rem', 
                  color: 'var(--success)', 
                  borderTop: '2px solid var(--border-color)', 
                  paddingTop: '0.6rem', 
                  marginTop: '0.25rem' 
                }}>
                  <strong>Grand Total (Inc. GST):</strong>
                  <strong>₹{gstBreakdown.grandTotalIncGst}</strong>
                </div>

                {/* Order Exports Toolstrip */}
                {cartItemsArray.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={handleExportCartExcel}
                      style={{ flex: 1, padding: '0.3rem', fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      📊 Excel
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCartCSV}
                      style={{ flex: 1, padding: '0.3rem', fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      📑 CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{ flex: 1, padding: '0.3rem', fontSize: '0.72rem', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🖨️ Print
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.6rem', padding: '0.85rem' }}
                  onClick={handlePlaceOrder}
                  disabled={submitting || netTotal === 0}
                >
                  {submitting ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }}></span>
                      {editingOrder ? (lang === 'ta' ? 'சேமிக்கிறது...' : 'Saving Invoice...') : (lang === 'ta' ? 'பூட்டப்படுகிறது...' : 'Locking Stock & Placing...')}
                    </span>
                  ) : (
                    editingOrder ? `💾 ${lang === 'ta' ? 'மாற்றங்களை சேமி' : 'Update Invoice'}` : `⚡ ${t('place_order')}`
                  )}
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
        </>
      )}
    </div>
  );
}
