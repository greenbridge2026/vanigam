import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import { translateShopName, translateRouteName } from '../translations';
import { calculateOrderPaymentInfo } from '../utils/paymentUtils';

export default function DeliveryMgr({ t, lang, onBillSelected, session, onBulkPrint, onEditOrder }) {
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState([]);
  const [statusFilter, setStatusFilter] = useState(() => {
    const saved = localStorage.getItem('deliveryStatusFilter');
    localStorage.removeItem('deliveryStatusFilter');
    return saved || 'all';
  });
  const [routeFilter, setRouteFilter] = useState(() => {
    const saved = localStorage.getItem('deliveryRouteFilter');
    localStorage.removeItem('deliveryRouteFilter');
    return saved || 'all';
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrintSheetOpen, setIsPrintSheetOpen] = useState(false);
  const [printScope, setPrintScope] = useState('filtered'); // 'filtered' | 'selected'

  useEffect(() => {
    if (isPrintSheetOpen) {
      document.body.classList.add('print-sheet-active');
    } else {
      document.body.classList.remove('print-sheet-active');
    }
    return () => {
      document.body.classList.remove('print-sheet-active');
    };
  }, [isPrintSheetOpen]);

  const handleToggleSelect = (id) => {
    setSelectedDeliveryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedDeliveryIds.length === filteredDeliveries.length && filteredDeliveries.length > 0) {
      setSelectedDeliveryIds([]);
    } else {
      setSelectedDeliveryIds(filteredDeliveries.map(d => d.id));
    }
  };

  const getPreviousOutstanding = (ord, shp) => {
    if (!ord || !shp) return 0;
    const shopOrders = (orders || []).filter(o => o.shop_id === ord.shop_id && o.status !== 'cancelled');
    const shopPayments = (payments || []).filter(p => p.shop_id === ord.shop_id);
    const currentOrderDate = new Date(ord.order_date).getTime();

    const futureOrders = shopOrders.filter(o => {
      if (o.id === ord.id) return false;
      const oDate = new Date(o.order_date).getTime();
      if (oDate > currentOrderDate) return true;
      if (oDate === currentOrderDate) {
        const numA = parseInt((String(o.invoice_number).match(/\d+/) || [0])[0], 10);
        const numB = parseInt((String(ord.invoice_number).match(/\d+/) || [0])[0], 10);
        return numA > numB;
      }
      return false;
    });

    const futureUnpaidNet = futureOrders.reduce((sum, futOrd) => {
      const futPayments = shopPayments.filter(p => p.order_id === futOrd.id);
      const futPaid = futPayments.reduce((pSum, p) => pSum + (Number(p.collected_amount) || 0), 0);
      return sum + Math.max(0, (Number(futOrd.net_amount) || 0) - futPaid);
    }, 0);

    const shopCurrentBal = Number(shp.outstanding_amount || 0);
    const shopBalAtOrderTime = Math.max(0, shopCurrentBal - futureUnpaidNet);
    const currentPayments = shopPayments.filter(p => p.order_id === ord.id);
    const totalCollected = currentPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);
    const currentInvoiceUnpaid = Math.max(0, Number(ord.net_amount || 0) - totalCollected);

    return Math.max(0, shopBalAtOrderTime - currentInvoiceUnpaid);
  };

  const handleBulkPrintTrigger = () => {
    const selectedOrders = selectedDeliveryIds.map(dId => {
      const del = filteredDeliveries.find(d => d.id === dId);
      return del ? del.order_id : null;
    }).filter(Boolean);
    
    if (selectedOrders.length > 0 && onBulkPrint) {
      onBulkPrint(selectedOrders);
    }
  };

  // Delivery marking states
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [remarks, setRemarks] = useState('');
  
  // Outstanding Collection states
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'gpay' | 'split'
  const [orderPaymentAmount, setOrderPaymentAmount] = useState(0);
  const [prevOutstandingAmount, setPrevOutstandingAmount] = useState(0);
  const [gpayTxn, setGpayTxn] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Order Deletion states
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  // Non-Delivery & Returns states
  const [fulfillmentType, setFulfillmentType] = useState('delivered'); // 'delivered' | 'not_delivered' | 'returned'
  const [reason, setReason] = useState('');
  const [nonDeliveryModalOpen, setNonDeliveryModalOpen] = useState(false);
  const [nonDeliveryType, setNonDeliveryType] = useState('not_delivered'); // 'not_delivered' | 'returned'

  // Order Editing states
  const [products, setProducts] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editDiscount, setEditDiscount] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleStartEditOrder = async (order) => {
    try {
      const [pData, oiData] = await Promise.all([
        api.getProducts(),
        api.getOrderItems()
      ]);
      setProducts(pData);
      
      const currentShop = shops.find(s => s.id === order.shop_id);
      const existingItems = oiData.filter(oi => oi.order_id === order.id);
      
      const formattedItems = existingItems.map(oi => {
        const prod = pData.find(p => p.id === oi.product_id);
        const caseQtyRule = prod ? prod.case_qty_rule : 24;
        const rate = oi.rate !== undefined ? oi.rate : (currentShop && currentShop.shop_type === 'wholesale' ? (prod ? prod.wholesale_price : 0) : (prod ? prod.retail_price : 0));
        const amount = oi.amount !== undefined ? oi.amount : Math.round(((Number(oi.cases || 0) * caseQtyRule) + Number(oi.bottles || 0)) * (rate / caseQtyRule));
        return {
          id: oi.id,
          product_id: oi.product_id,
          cases: oi.cases || 0,
          bottles: oi.bottles || 0,
          rate: rate,
          amount: amount
        };
      });

      setOrderToEdit(order);
      setEditItems(formattedItems.length > 0 ? formattedItems : [
        { id: `oi_new_${Date.now()}`, product_id: pData[0]?.id || '', cases: 1, bottles: 0, rate: pData[0]?.wholesale_price || 0, amount: pData[0]?.wholesale_price || 0 }
      ]);
      setEditDiscount(order.discount || 0);
      setEditModalOpen(true);
    } catch (err) {
      alert('Failed to load invoice items for editing: ' + (err.message || err));
    }
  };

  const handleEditItemChange = (index, field, value) => {
    const updated = [...editItems];
    const item = { ...updated[index], [field]: value };
    const prod = products.find(p => p.id === item.product_id);
    const caseQtyRule = prod ? prod.case_qty_rule : 24;

    if (field === 'product_id') {
      const orderShop = orderToEdit ? shops.find(s => s.id === orderToEdit.shop_id) : null;
      const defaultRate = orderShop && orderShop.shop_type === 'wholesale' ? (prod ? prod.wholesale_price : 0) : (prod ? prod.retail_price : 0);
      item.rate = defaultRate;
    }

    if (field !== 'amount') {
      const cases = Number(item.cases || 0);
      const bottles = Number(item.bottles || 0);
      const rate = Number(item.rate || 0);
      const totalBottles = (cases * caseQtyRule) + bottles;
      item.amount = Math.round(totalBottles * (rate / caseQtyRule));
    }

    updated[index] = item;
    setEditItems(updated);
  };

  const handleAddEditItem = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    const orderShop = orderToEdit ? shops.find(s => s.id === orderToEdit.shop_id) : null;
    const defaultRate = orderShop && orderShop.shop_type === 'wholesale' ? firstProd.wholesale_price : firstProd.retail_price;
    setEditItems(prev => [
      ...prev,
      {
        id: `oi_new_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        product_id: firstProd.id,
        cases: '',
        bottles: '',
        rate: defaultRate,
        amount: 0
      }
    ]);
  };

  const handleRemoveEditItem = (index) => {
    if (editItems.length === 1) {
      alert('Invoice must have at least one product item / பில்லில் குறைந்தபட்சம் ஒரு பொருள் இருக்க வேண்டும்.');
      return;
    }
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveEditedOrder = async () => {
    if (!orderToEdit) return;
    if (editItems.length === 0) {
      alert('Please add at least one product item');
      return;
    }

    setSavingEdit(true);
    try {
      await api.updateOrder(orderToEdit.id, {
        items: editItems.map(item => ({
          ...item,
          cases: Number(item.cases || 0),
          bottles: Number(item.bottles || 0),
          rate: Number(item.rate || 0),
          amount: Number(item.amount || 0)
        })),
        discount: Number(editDiscount || 0)
      });

      alert(lang === 'ta' ? 'விலைப்பட்டியல் வெற்றிகரமாக மாற்றப்பட்டது!' : 'Invoice updated successfully!');

      // Reload dataset
      const [dData, oData, sData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);

      setEditModalOpen(false);
      setOrderToEdit(null);
    } catch (err) {
      alert('Failed to update invoice: ' + (err.message || err));
    } finally {
      setSavingEdit(false);
    }
  };


  useEffect(() => {
    async function loadData() {
      try {
        const [dData, oData, sData, rData, pData] = await Promise.all([
          api.getDeliveries(),
          api.getOrders(),
          api.getShops(),
          api.getRoutes(),
          api.getPayments()
        ]);
        setDeliveries(dData);
        setOrders(oData);
        setShops(sData);
        setRoutes(rData);
        setPayments(pData);
      } catch (err) {
        console.error('Failed to load logistics datasets', err);
      } finally {
        setLoading(false);
        // Auto-select order if passed from dashboard
        const selectId = localStorage.getItem('deliverySelectOrderId');
        if (selectId) {
          localStorage.removeItem('deliverySelectOrderId');
          const matchedDelivery = dData.find(d => d.order_id === selectId);
          if (matchedDelivery) {
            const matchedOrder = oData.find(o => o.id === selectId);
            const matchedShop = matchedOrder ? sData.find(s => s.id === matchedOrder.shop_id) : null;
            setActiveDelivery({ del: matchedDelivery, order: matchedOrder, shop: matchedShop });
            setRemarks('');
            setPaymentMode('cash');
            setOrderPaymentAmount(matchedOrder ? matchedOrder.net_amount : 0);
            setPrevOutstandingAmount(0);
            setGpayTxn('');
            setFulfillmentType('delivered');
            setReason('');
          }
        }
      }
    }
    loadData();
  }, []);

  const handleSelectDelivery = (del) => {
    const order = orders.find(o => o.id === del.order_id);
    const shop = order ? shops.find(s => s.id === order.shop_id) : null;
    
    const directPayments = order ? (payments || []).filter(p => p.order_id === order.id) : [];
    const directPaid = directPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);
    const remainingDue = order ? Math.max(0, Number(order.net_amount || 0) - directPaid) : 0;

    setActiveDelivery({ del, order, shop });
    setRemarks('');
    setPaymentMode('cash');
    setOrderPaymentAmount(remainingDue);
    setPrevOutstandingAmount(0);
    setGpayTxn('');
    setFulfillmentType('delivered');
    setReason('');
  };

  const handleDirectCreditFulfill = async (del) => {
    const order = orders.find(o => o.id === del.order_id);
    if (!order) return;

    if (!window.confirm(lang === 'ta' 
      ? `இந்த பில்லை கடனில் (ரூ. 0 வசூல்) விநியோகிக்க விரும்புகிறீர்களா?\nமுழுத் தொகையும் நிலுவையில் சேர்க்கப்படும்.`
      : `Deliver on credit (₹0 collected)?\nFull invoice amount will remain in Outstanding Collection.`)) {
      return;
    }

    const remarksMsg = 'Delivered on Credit (₹0 Collected)';
    setDeliveries(prev => prev.map(d => d.id === del.id ? { ...d, status: 'delivered', remarks: remarksMsg } : d));
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'delivered' } : o));

    try {
      await api.completeDelivery(del.id, {
        status: 'delivered',
        remarks: remarksMsg
      });

      const [dData, oData, sData, pData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops(),
        api.getPayments()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);
      setPayments(pData);
    } catch (err) {
      console.error('Error fulfilling credit delivery:', err);
      const [dData, oData, sData, pData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops(),
        api.getPayments()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);
      setPayments(pData);
      alert('Error updating credit delivery: ' + (err.message || err));
    }
  };

  const handleFulfillOrder = async (status, selectedReason, customRemarks) => {
    if (!activeDelivery) return;

    const { del, order, shop } = activeDelivery;
    const finalRemarks = customRemarks !== undefined ? customRemarks : remarks;
    const ordAmt = Number(orderPaymentAmount || 0);
    const prevAmt = Number(prevOutstandingAmount || 0);

    // 1. Instantly update local state optimistically for lightning-fast UX
    setDeliveries(prev => prev.map(d => d.id === del.id ? { ...d, status, remarks: finalRemarks, reason: selectedReason } : d));
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));

    if (status === 'delivered' && (ordAmt > 0 || prevAmt > 0)) {
      const newPayItems = [];
      if (ordAmt > 0) {
        newPayItems.push({
          id: `p_opt_${Date.now()}_1`,
          shop_id: shop.id,
          order_id: order.id,
          collected_amount: ordAmt,
          payment_mode: paymentMode === 'split' ? 'cash' : paymentMode,
          payment_date: new Date().toISOString()
        });
      }
      if (prevAmt > 0) {
        newPayItems.push({
          id: `p_opt_${Date.now()}_2`,
          shop_id: shop.id,
          order_id: '',
          collected_amount: prevAmt,
          payment_mode: paymentMode === 'split' ? 'gpay' : paymentMode,
          payment_date: new Date().toISOString()
        });
      }
      setPayments(prev => [...prev, ...newPayItems]);
    }

    // 2. Instantly close modal and reset state
    setActiveDelivery(null);
    setNonDeliveryModalOpen(false);

    // 3. Background asynchronous API persistence
    try {
      if (status === 'delivered' && (ordAmt > 0 || prevAmt > 0)) {
        const paymentsToSubmit = [];
        if (ordAmt > 0) {
          paymentsToSubmit.push({
            shop_id: shop.id,
            order_id: order.id,
            collected_amount: ordAmt,
            payment_mode: paymentMode === 'split' ? 'cash' : paymentMode,
            transaction_number: (paymentMode === 'gpay' || paymentMode === 'split') ? (gpayTxn || `TXN-${Date.now()}`) : '',
            reference_number: '',
            payment_date: new Date().toISOString()
          });
        }
        if (prevAmt > 0) {
          paymentsToSubmit.push({
            shop_id: shop.id,
            order_id: '',
            collected_amount: prevAmt,
            payment_mode: paymentMode === 'split' ? 'gpay' : paymentMode,
            transaction_number: (paymentMode === 'gpay' || paymentMode === 'split') ? (gpayTxn || `TXN-${Date.now()}`) : '',
            reference_number: '',
            payment_date: new Date().toISOString()
          });
        }
        await api.createPayment({ payments: paymentsToSubmit });
      }

      await api.completeDelivery(del.id, {
        status: status,
        reason: selectedReason,
        remarks: finalRemarks
      });

      // Reload dataset in background to ensure sync
      const [dData, oData, sData, pData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops(),
        api.getPayments()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);
      setPayments(pData);
    } catch (err) {
      console.error('Error in background delivery fulfillment:', err);
      // Fallback reload if backend error occurred
      const [dData, oData, sData, pData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops(),
        api.getPayments()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);
      setPayments(pData);
      alert('Error updating delivery logistics: ' + (err.message || err));
    }
  };

  const handleRecordCollectionOnly = async () => {
    if (!activeDelivery) return;
    const prevAmt = Number(prevOutstandingAmount || 0);
    if (prevAmt <= 0) {
      alert(lang === 'ta' ? 'முந்தைய நிலுவைத் தொகையை உள்ளிடவும்!' : 'Please enter a valid previous outstanding payment amount!');
      return;
    }

    setSubmitting(true);
    try {
      const { shop } = activeDelivery;
      await api.createPayment({
        payments: [{
          shop_id: shop.id,
          order_id: '', // General shop outstanding collection
          collected_amount: prevAmt,
          payment_mode: paymentMode === 'split' ? 'gpay' : paymentMode,
          transaction_number: (paymentMode === 'gpay' || paymentMode === 'split') ? (gpayTxn || `TXN-${Date.now()}`) : '',
          reference_number: '',
          payment_date: new Date().toISOString()
        }]
      });

      alert(lang === 'ta' 
        ? `ரூ. ${prevAmt} நிலுவை வசூல் பதிவு செய்யப்பட்டது! விலைப்பட்டியல் நிலுவையில் (Pending) உள்ளது.` 
        : `Outstanding collection of ₹${prevAmt} recorded successfully! Invoice remains open.`
      );

      // Reload dataset
      const [dData, oData, sData, pData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops(),
        api.getPayments()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);
      setPayments(pData);
      
      setActiveDelivery(null);
    } catch (err) {
      alert('Error recording collection: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrderTrigger = (orderId) => {
    setOrderToDelete(orderId);
    setConfirmDeleteOpen(true);
  };

  const executeDeleteOrder = async () => {
    setConfirmDeleteOpen(false);
    if (!orderToDelete) return;
    try {
      await api.deleteOrder(orderToDelete);
      alert(lang === 'ta' ? 'ஆர்டர் வெற்றிகரமாக நீக்கப்பட்டது!' : 'Order deleted successfully!');
      
      const [dData, oData, sData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);

      if (activeDelivery && activeDelivery.order.id === orderToDelete) {
        setActiveDelivery(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete order');
    } finally {
      setOrderToDelete(null);
    }
  };


  const generateUPILink = (pa, pn, am, tn) => {
    // UPI payment URI template
    return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}`;
  };

  const filteredDeliveries = deliveries.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    
    const order = orders.find(o => o.id === d.order_id);
    if (!order) return false;

    if (routeFilter !== 'all' && order.route_id !== routeFilter) return false;

    // Date range filtering
    if (order.order_date) {
      const orderDateStr = order.order_date.split('T')[0];
      if (startDate && orderDateStr < startDate) return false;
      if (endDate && orderDateStr > endDate) return false;
    } else {
      if (startDate || endDate) return false;
    }

    // Search Query Filtering
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const invNum = (order.invoice_number || '').toLowerCase();
      const shop = shops.find(s => s.id === order.shop_id);
      const route = routes.find(r => r.id === order.route_id);
      const shopEn = shop ? (shop.name_en || shop.name || '').toLowerCase() : '';
      const shopTa = shop ? (shop.name_ta || '').toLowerCase() : '';
      const shopMobile = shop ? (shop.mobile || '').toLowerCase() : '';
      const routeEn = route ? (route.name_en || route.name || '').toLowerCase() : '';
      const routeTa = route ? (route.name_ta || '').toLowerCase() : '';
      const delPerson = (d.delivery_man || '').toLowerCase();

      const matches = invNum.includes(q) ||
        shopEn.includes(q) ||
        shopTa.includes(q) ||
        shopMobile.includes(q) ||
        routeEn.includes(q) ||
        routeTa.includes(q) ||
        delPerson.includes(q);

      if (!matches) return false;
    }

    return true;
  }).sort((a, b) => {
    const orderA = orders.find(o => o.id === a.order_id);
    const orderB = orders.find(o => o.id === b.order_id);

    const invNumA = orderA?.invoice_number ? (parseInt(orderA.invoice_number.replace(/\D/g, ''), 10) || 0) : 0;
    const invNumB = orderB?.invoice_number ? (parseInt(orderB.invoice_number.replace(/\D/g, ''), 10) || 0) : 0;

    if (invNumA !== invNumB) {
      return invNumB - invNumA;
    }

    const dateA = orderA?.order_date ? new Date(orderA.order_date).getTime() : 0;
    const dateB = orderB?.order_date ? new Date(orderB.order_date).getTime() : 0;
    return dateB - dateA;
  });

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Delivery Logistics...</div>;

  return (
    <div>
      <div className="no-print" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🚚 {t('deliveries')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Fulfill orders, collect outstanding payments, and issue final shop receipts</p>
      </div>

      <div className="delivery-mgr-grid">
        
        {/* Deliveries list */}
        <div className="glass-card">
          {/* Top Control Bar (Clean 2-row layout for 100% zoom fit) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {/* Row 1: Title, Search, Filters, Print Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', whiteSpace: 'nowrap' }}>{t('assigned_orders')}</h2>
                
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={lang === 'ta' ? '🔍 இன்வாய்ஸ், கடை, போன்...' : '🔍 Search Invoice, Shop, Phone...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '210px', padding: '0.35rem 1.8rem 0.35rem 0.65rem', fontSize: '0.85rem', margin: 0, height: '36px' }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        padding: 0
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ width: '140px', padding: '0.35rem 0.65rem', fontSize: '0.85rem', margin: 0, height: '36px' }}
                >
                  <option value="all">{lang === 'ta' ? 'அனைத்து நிலை' : 'All Statuses'}</option>
                  <option value="pending">{lang === 'ta' ? 'நிலுவையில் உள்ளவை' : 'Pending'}</option>
                  <option value="delivered">{lang === 'ta' ? 'விநியோகிக்கப்பட்டவை' : 'Delivered'}</option>
                  <option value="not_delivered">{lang === 'ta' ? 'விநியோகிக்கப்படாதவை' : 'Not Delivered'}</option>
                  <option value="returned">{lang === 'ta' ? 'திரும்பப் பெறப்பட்டவை' : 'Returned'}</option>
                </select>

                <select
                  className="form-select"
                  value={routeFilter}
                  onChange={e => setRouteFilter(e.target.value)}
                  style={{ width: '170px', padding: '0.35rem 0.65rem', fontSize: '0.85rem', margin: 0, height: '36px' }}
                >
                  <option value="all">{lang === 'ta' ? 'அனைத்து வழிகள்' : 'All Routes'}</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>
                      {lang === 'ta' ? r.name_ta : r.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🖨️ {lang === 'ta' ? 'விநியோகத் தாள் அச்சிடு' : 'Print Delivery Sheet'}
                  {selectedDeliveryIds.length > 0 ? ` (${selectedDeliveryIds.length})` : ` (${filteredDeliveries.length})`}
                </button>
              </div>
            </div>

            {/* Row 2: Date Range Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'முதல்' : 'From'}:</span>
                <input
                  type="date"
                  className="form-select"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ 
                    padding: '0.3rem 0.5rem', 
                    fontSize: '0.85rem', 
                    width: '135px', 
                    margin: 0,
                    height: '34px',
                    lineHeight: '1.2',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{lang === 'ta' ? 'வரை' : 'To'}:</span>
                <input
                  type="date"
                  className="form-select"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ 
                    padding: '0.3rem 0.5rem', 
                    fontSize: '0.85rem', 
                    width: '135px', 
                    margin: 0,
                    height: '34px',
                    lineHeight: '1.2',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)'
                  }}
                />
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  className="language-btn"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', margin: 0, height: '34px' }}
                >
                  {lang === 'ta' ? 'அழி' : 'Clear'}
                </button>
              )}
            </div>
          </div>

          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="custom-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '38px', padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={filteredDeliveries.length > 0 && selectedDeliveryIds.length === filteredDeliveries.length}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                  </th>
                  <th>Invoice No</th>
                  <th>{t('date')}</th>
                  <th>Shop & Route</th>
                  <th>Delivery Person</th>
                  <th>{lang === 'ta' ? 'பில் தொகை' : 'Invoice Amount'}</th>
                  <th>{lang === 'ta' ? 'செலுத்த வேண்டிய நிலுவை தொகை' : 'Outstanding Amount to Pay'}</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map(d => {
                  const order = orders.find(o => o.id === d.order_id);
                  if (!order) return null;
                  const shop = shops.find(s => s.id === order.shop_id);
                  const route = routes.find(r => r.id === order.route_id);
                  
                  const info = calculateOrderPaymentInfo(order, shop, orders, payments);
                  const remainingInvoiceDue = info.remainingDue;
                  const totalPaidSoFar = info.totalPaid;
                  
                  let statusBg = 'rgba(245, 158, 11, 0.1)';
                  let statusColor = 'var(--warning)';
                  let statusLabel = totalPaidSoFar > 0
                    ? (lang === 'ta' ? 'பகுதியளவு நிலுவை (Open)' : 'Pending (Partially Paid)')
                    : t('pending');

                  const isDeliveredStatus = d.status === 'delivered' || order.status === 'delivered' || remainingInvoiceDue <= 0;

                  if (isDeliveredStatus) {
                    statusBg = 'rgba(16, 185, 129, 0.1)';
                    statusColor = 'var(--success)';
                    statusLabel = remainingInvoiceDue > 0
                      ? (lang === 'ta' ? 'விநியோகிக்கப்பட்டது (கடன்)' : 'Delivered (Credit)')
                      : t('delivered');
                  } else if (d.status === 'not_delivered') {
                    statusBg = 'rgba(239, 68, 68, 0.1)';
                    statusColor = 'var(--danger)';
                    statusLabel = t('not_delivered');
                  } else if (d.status === 'returned') {
                    statusBg = 'rgba(59, 130, 246, 0.1)';
                    statusColor = 'var(--accent-blue)';
                    statusLabel = t('returned');
                  }

                  const isFullyClosed = isDeliveredStatus || d.status === 'not_delivered' || d.status === 'returned';
                  const isSelected = activeDelivery && activeDelivery.del.id === d.id;
                  return (
                    <tr 
                      key={d.id} 
                      style={{ 
                        opacity: isFullyClosed ? 0.7 : 1,
                        background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'none',
                        borderLeft: isSelected ? '4px solid var(--accent-cyan)' : 'none'
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={selectedDeliveryIds.includes(d.id)}
                          onChange={() => handleToggleSelect(d.id)}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        />
                      </td>
                      <td><strong>{order.invoice_number}</strong></td>
                      <td>{order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <div style={{ fontWeight: '700' }}>{translateShopName(shop, lang) || 'Shop'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {lang === 'ta' ? 'வழி' : 'Route'}: {translateRouteName(route, lang)}
                        </div>
                      </td>
                      <td>{t('delivery_man')}</td>
                      <td>₹{Number(order.net_amount || 0).toLocaleString()}</td>
                      <td>
                        {(() => {
                          const prevOutstanding = getPreviousOutstanding(order, shop);
                          return (
                            <strong style={{ color: prevOutstanding > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                              ₹{prevOutstanding.toLocaleString()}
                            </strong>
                          );
                        })()}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: statusBg,
                          color: statusColor,
                          border: `1px solid ${statusColor}`
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {!isDeliveredStatus && d.status === 'pending' ? (
                            <>
                              {(!session || session.role === 'admin' || session.role === 'salesman') && (
                                <button
                                  type="button"
                                  className="language-btn"
                                  onClick={() => onEditOrder ? onEditOrder(order) : handleStartEditOrder(order)}
                                  style={{ padding: '0.4rem 0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  title={lang === 'ta' ? 'பில் திருத்துக' : 'Edit Invoice'}
                                >
                                  ✏️
                                </button>
                              )}
                              <button 
                                className="language-btn" 
                                style={{ padding: '0.4rem 0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                                onClick={() => onBillSelected(order.id)}
                                title={lang === 'ta' ? 'பில் பார்க்க' : 'View Bill'}
                              >
                                👁️
                              </button>
                              <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => handleSelectDelivery(d)}>
                                ⚡ {t('fulfill')}
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="language-btn" onClick={() => onBillSelected(order.id)}>
                                📄 View Bill
                              </button>
                              {d.status === 'not_delivered' && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontStyle: 'italic', marginRight: '0.5rem' }}>
                                  ({d.reason})
                                </span>
                              )}
                              {d.status === 'returned' && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontStyle: 'italic', marginRight: '0.5rem' }}>
                                  ({d.reason})
                                </span>
                              )}
                            </>
                          )}
                          {session?.role === 'admin' && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => handleDeleteOrderTrigger(order.id)}
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title={t('delete_order')}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Complete delivery sidebar details */}
        {activeDelivery && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="glass-card modal-card" style={{ border: '1px solid var(--accent-cyan)', maxWidth: '520px', width: '95%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)', margin: 0 }}>
                {t('fulfill')} {lang === 'ta' ? 'விலைப்பட்டியல்' : 'Invoice'}: {activeDelivery.order.invoice_number}
              </h2>
              <button 
                type="button" 
                onClick={() => setActiveDelivery(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="language-btn"
                style={{
                  width: '100%',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--accent-cyan)',
                  background: fulfillmentType === 'delivered' ? 'rgba(6, 182, 212, 0.1)' : 'none',
                  color: fulfillmentType === 'delivered' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onClick={() => setFulfillmentType('delivered')}
              >
                <span>✓</span> {t('delivered')}
              </button>
              <button
                type="button"
                className="language-btn"
                style={{
                  width: '100%',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--danger)',
                  background: fulfillmentType === 'not_delivered' ? 'rgba(239, 68, 68, 0.1)' : 'none',
                  color: fulfillmentType === 'not_delivered' ? 'var(--danger)' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onClick={() => {
                  setFulfillmentType('not_delivered');
                  setNonDeliveryType('not_delivered');
                  setReason('Shop Closed');
                  setNonDeliveryModalOpen(true);
                }}
              >
                <span>✗</span> {t('not_delivered')}
              </button>
              <button
                type="button"
                className="language-btn"
                style={{
                  width: '100%',
                  padding: '0.6rem 1rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--accent-blue)',
                  background: fulfillmentType === 'returned' ? 'rgba(59, 130, 246, 0.1)' : 'none',
                  color: fulfillmentType === 'returned' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onClick={() => {
                  setFulfillmentType('returned');
                  setNonDeliveryType('returned');
                  setReason('Wrong Item');
                  setNonDeliveryModalOpen(true);
                }}
              >
                <span>↺</span> {t('returned')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong style={{ fontSize: '1rem' }}>{translateShopName(activeDelivery.shop, lang)}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>Address: {activeDelivery.shop.address}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0' }}>Contact No: {activeDelivery.shop.mobile}</p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Total Outstanding:</span>
                  <strong style={{ color: 'var(--warning)' }}>₹{Number(activeDelivery.shop.outstanding_amount || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Previous Outstanding:</span>
                  <strong style={{ color: 'var(--text-muted)' }}>₹{Math.max(0, Number(activeDelivery.shop.outstanding_amount || 0) - Number(activeDelivery.order.net_amount || 0))}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Current Order Amount:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>₹{activeDelivery.order.net_amount}</strong>
                </div>
              </div>

              {fulfillmentType === 'delivered' ? (
                <>
                  {/* Payment Collection Options */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>💰 {t('payment_collection')}</h3>

                    {/* Quick Presets */}
                    {(() => {
                      const totalShopBal = Number(activeDelivery.shop.outstanding_amount || 0);
                      const currentOrderNet = Number(activeDelivery.order.net_amount || 0);
                      
                      const orderPayments = (payments || []).filter(p => p.order_id === activeDelivery.order.id);
                      const alreadyPaid = orderPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);
                      const initialInvoiceDue = Math.max(0, currentOrderNet - alreadyPaid);
                      const prevShopBal = Math.max(0, totalShopBal - initialInvoiceDue);

                      return (
                        <>
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="language-btn"
                              style={{
                                flex: 1,
                                padding: '0.45rem 0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                borderColor: (orderPaymentAmount > 0 && prevOutstandingAmount === 0) ? 'var(--success)' : 'var(--border-color)',
                                background: (orderPaymentAmount > 0 && prevOutstandingAmount === 0) ? 'rgba(16, 185, 129, 0.12)' : 'none',
                                color: (orderPaymentAmount > 0 && prevOutstandingAmount === 0) ? 'var(--success)' : 'var(--text-muted)'
                              }}
                              onClick={() => {
                                setOrderPaymentAmount(initialInvoiceDue);
                                setPrevOutstandingAmount(0);
                              }}
                            >
                              🟢 {lang === 'ta' ? 'இந்த பில் நிலுவை மட்டும் (₹' : 'Current Invoice Due Only (₹'}{initialInvoiceDue})
                            </button>
                            {prevShopBal > 0 && (
                              <button
                                type="button"
                                className="language-btn"
                                style={{
                                  flex: 1,
                                  padding: '0.45rem 0.5rem',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  borderColor: prevOutstandingAmount > 0 ? 'var(--warning)' : 'var(--border-color)',
                                  background: prevOutstandingAmount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'none',
                                  color: prevOutstandingAmount > 0 ? 'var(--warning)' : 'var(--text-muted)'
                                }}
                                onClick={() => {
                                  setOrderPaymentAmount(initialInvoiceDue);
                                  setPrevOutstandingAmount(prevShopBal);
                                }}
                              >
                                🟠 {lang === 'ta' ? 'மொத்த நிலுவையும் (₹' : 'Full Outstanding (₹'}{totalShopBal})
                              </button>
                            )}
                            <button
                              type="button"
                              className="language-btn"
                              style={{
                                flex: 1,
                                padding: '0.45rem 0.5rem',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                borderColor: (orderPaymentAmount === 0 && prevOutstandingAmount === 0) ? 'var(--accent-blue)' : 'var(--border-color)',
                                background: (orderPaymentAmount === 0 && prevOutstandingAmount === 0) ? 'rgba(59, 130, 246, 0.12)' : 'none',
                                color: (orderPaymentAmount === 0 && prevOutstandingAmount === 0) ? 'var(--accent-blue)' : 'var(--text-muted)'
                              }}
                              onClick={() => {
                                setOrderPaymentAmount(0);
                                setPrevOutstandingAmount(0);
                              }}
                            >
                              💳 {lang === 'ta' ? 'கடன் விநியோகம் (ரூ. 0)' : 'Credit Delivery (₹0 Paid)'}
                            </button>
                          </div>

                          {/* Payment Mode Select Dropdown */}
                          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.85rem', display: 'block', fontWeight: 600, marginBottom: '0.3rem' }}>
                              💳 {lang === 'ta' ? 'செலுத்தும் முறை (Payment Mode)' : 'Payment Mode'}
                            </label>
                            <select
                              className="form-select"
                              style={{ width: '100%', padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.95rem' }}
                              value={paymentMode}
                              onChange={e => setPaymentMode(e.target.value)}
                            >
                              <option value="cash">💵 {lang === 'ta' ? 'ரொக்கம் (Cash)' : 'Cash'}</option>
                              <option value="gpay">📱 {lang === 'ta' ? 'ஜிபே (GPay / UPI)' : 'GPay'}</option>
                              <option value="split">🔀 {lang === 'ta' ? 'ரொக்கம் + ஜிபே (Split)' : 'Cash + GPay (Split)'}</option>
                            </select>
                          </div>

                          {/* Separate Payment Options */}
                          <div style={{ display: 'grid', gridTemplateColumns: prevShopBal > 0 ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            {/* 1. Current Order Payment */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label style={{ fontSize: '0.85rem', display: 'block', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.3rem' }}>
                                📄 {lang === 'ta' ? 'தற்போதைய பில் கட்டணம் (₹)' : 'Current Invoice Payment (₹)'}
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="form-input"
                                style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700, fontSize: '1.2rem', padding: '0.5rem 0.75rem' }}
                                value={orderPaymentAmount === '' || orderPaymentAmount === 0 ? (orderPaymentAmount === '' ? '' : '0') : orderPaymentAmount}
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setOrderPaymentAmount(val === '' ? '' : parseInt(val, 10));
                                }}
                                placeholder="0"
                              />
                            </div>

                            {/* 2. Previous Outstanding Payment */}
                            {prevShopBal > 0 && (
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.85rem', display: 'block', fontWeight: 700, color: 'var(--warning)', marginBottom: '0.3rem' }}>
                                  💼 {lang === 'ta' ? 'முந்தைய நிலுவைத் தொகை (₹)' : 'Pay Previous Outstanding (₹)'}
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  className="form-input"
                                  style={{ width: '100%', boxSizing: 'border-box', fontWeight: 700, fontSize: '1.2rem', padding: '0.5rem 0.75rem' }}
                                  value={prevOutstandingAmount === '' || prevOutstandingAmount === 0 ? (prevOutstandingAmount === '' ? '' : '0') : prevOutstandingAmount}
                                  onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setPrevOutstandingAmount(val === '' ? '' : parseInt(val, 10));
                                  }}
                                  placeholder="0"
                                />
                              </div>
                            )}
                          </div>

                          {/* GPay Transaction Number */}
                          {(paymentMode === 'gpay' || paymentMode === 'split') && (
                            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                              <input
                                type="text"
                                className="form-input"
                                style={{ width: '100%', boxSizing: 'border-box', fontSize: '0.85rem' }}
                                value={gpayTxn}
                                onChange={e => setGpayTxn(e.target.value)}
                                placeholder="GPay / UPI Txn No (optional)"
                              />
                            </div>
                          )}

                          {/* Live calculation for collection */}
                          {(() => {
                            const totalCollected = Number(orderPaymentAmount || 0) + Number(prevOutstandingAmount || 0);
                            const remainingInvoice = Math.max(0, initialInvoiceDue - Number(orderPaymentAmount || 0));
                            const remainingTotalOutstanding = Math.max(0, totalShopBal - totalCollected);

                            return (
                              <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span>Invoice Bill Total:</span>
                                  <strong style={{ color: 'var(--text-muted)' }}>₹{currentOrderNet}</strong>
                                </div>
                                {alreadyPaid > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span>Previously Paid (Partial):</span>
                                    <strong style={{ color: 'var(--success)' }}>- ₹{alreadyPaid}</strong>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontWeight: '700' }}>
                                  <span>Current Invoice Amount Due:</span>
                                  <strong style={{ color: 'var(--accent-cyan)' }}>₹{initialInvoiceDue}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span>Collecting Now:</span>
                                  <strong style={{ color: 'var(--success)' }}>₹{totalCollected}</strong>
                                </div>

                                {totalCollected > 0 && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '0.25rem' }}>
                                    ({[
                                      Number(orderPaymentAmount) > 0 ? `Invoice: ₹${orderPaymentAmount}` : null,
                                      Number(prevOutstandingAmount) > 0 ? `Prev Outstanding: ₹${prevOutstandingAmount}` : null
                                    ].filter(Boolean).join(' + ')})
                                  </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.3rem', marginTop: '0.25rem' }}>
                                  <span>{lang === 'ta' ? 'மீதமுள்ள பில் தொகை:' : 'Remaining Invoice Balance:'}</span>
                                  <strong style={{ color: remainingInvoice > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                    ₹{remainingInvoice}
                                  </strong>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.3rem', marginTop: '0.25rem' }}>
                                  <span>{lang === 'ta' ? 'செலுத்த வேண்டிய நிலுவை தொகை:' : 'Outstanding Amount to Pay:'}</span>
                                  <strong style={{ color: remainingTotalOutstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                    ₹{remainingTotalOutstanding}
                                  </strong>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </div>

                  <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <label style={{ fontWeight: 600 }}>
                      {t('remarks')}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder={lang === 'ta' ? 'கருத்துரையை உள்ளிடவும் (தேவைப்பட்டால்)...' : 'Enter remarks (optional)...'}
                    />
                  </div>

                  <div className="btn-group" style={{ marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setActiveDelivery(null)}>
                      {t('cancel')}
                    </button>
                    {Number(prevOutstandingAmount || 0) > 0 && (
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--warning)',
                          border: '1px solid var(--warning)',
                          fontSize: '0.85rem'
                        }}
                        onClick={handleRecordCollectionOnly}
                        disabled={submitting}
                      >
                        💼 {submitting ? '...' : (lang === 'ta' ? 'நிலுவை வசூல் மட்டும் (பில் திறந்திருக்கும்)' : 'Collect Outstanding Only (Keep Invoice Open)')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleFulfillOrder('delivered', '', remarks)}
                      disabled={submitting}
                    >
                      ✔ {submitting ? '...' : t('mark_delivered')}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    {fulfillmentType === 'not_delivered'
                      ? 'Mark order as Not Delivered due to a problem (e.g. shop closed).'
                      : 'Mark order as Returned (e.g. damaged goods).'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: fulfillmentType === 'not_delivered' ? 'var(--danger)' : 'var(--accent-blue)',
                        color: '#fff',
                        width: '100%',
                        fontSize: '0.85rem'
                      }}
                      onClick={() => setNonDeliveryModalOpen(true)}
                    >
                      ⚙️ Configure {fulfillmentType === 'not_delivered' ? 'Non-Delivery' : 'Return'} Details
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setActiveDelivery(null)}>
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

      </div>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title={t('confirm_title')}
        message={t('delete_order_confirm')}
        confirmText={t('confirm_ok')}
        cancelText={t('confirm_cancel')}
        onConfirm={executeDeleteOrder}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Non-Delivery / Return Modal */}
      {nonDeliveryModalOpen && activeDelivery && (
        <div className="modal-overlay">
          <div className="glass-card modal-card" style={{ maxWidth: '480px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                {nonDeliveryType === 'not_delivered' ? '✗ Record Non-Delivery' : '↺ Record Return'}
              </h3>
              <button 
                type="button" 
                onClick={() => setNonDeliveryModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <strong>Shop:</strong> {lang === 'ta' ? activeDelivery.shop.name_ta : activeDelivery.shop.name_en}
              </div>
              
              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Reason (Mandatory) / காரணம்</label>
                <select 
                  className="form-select" 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  {nonDeliveryType === 'not_delivered' ? (
                    <>
                      <option value="Shop Closed">{lang === 'ta' ? 'கடை மூடப்பட்டுள்ளது' : 'Shop Closed'}</option>
                      <option value="Payment Issue">{lang === 'ta' ? 'பணம் செலுத்துவதில் சிக்கல்' : 'Payment Issue'}</option>
                      <option value="Other">{lang === 'ta' ? 'மற்றவை' : 'Other'}</option>
                    </>
                  ) : (
                    <>
                      <option value="Wrong Item">{lang === 'ta' ? 'தவறான பொருள்' : 'Wrong Item'}</option>
                      <option value="Damaged Goods">{lang === 'ta' ? 'சேதமடைந்த பொருட்கள்' : 'Damaged Goods'}</option>
                      <option value="Expired">{lang === 'ta' ? 'காலாவதியானது' : 'Expired'}</option>
                      <option value="Other">{lang === 'ta' ? 'மற்றவை' : 'Other'}</option>
                    </>
                  )}
                </select>
              </div>

              {nonDeliveryType === 'not_delivered' && reason === 'Payment Issue' && (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius)', marginTop: '0.5rem' }}>
                  <div style={{ color: 'var(--danger)', fontWeight: '700', marginBottom: '0.25rem' }}>
                    Current Outstanding: ₹{activeDelivery.shop.outstanding_amount}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Customer did not clear outstanding.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                      onClick={() => {
                        setNonDeliveryModalOpen(false);
                        setFulfillmentType('delivered');
                      }}
                    >
                      💵 Collect Payment
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem', background: 'var(--danger)', color: '#fff' }}
                      onClick={() => handleFulfillOrder('not_delivered', 'Payment Issue', remarks)}
                      disabled={submitting}
                    >
                      ✗ Mark Not Delivered
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontWeight: '600' }}>Remarks / குறிப்புகள்</label>
                <textarea
                  className="form-input"
                  style={{ width: '100%', height: '80px', marginTop: '0.25rem', padding: '0.5rem', resize: 'vertical' }}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setNonDeliveryModalOpen(false)}
              >
                Cancel
              </button>
              {!(nonDeliveryType === 'not_delivered' && reason === 'Payment Issue') && (
                <button 
                  type="button" 
                  className="btn" 
                  style={{ background: nonDeliveryType === 'not_delivered' ? 'var(--danger)' : 'var(--accent-blue)', color: '#fff' }}
                  onClick={() => handleFulfillOrder(nonDeliveryType, reason || (nonDeliveryType === 'not_delivered' ? 'Shop Closed' : 'Wrong Item'), remarks)}
                  disabled={submitting}
                >
                  {submitting ? '...' : 'Confirm'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editModalOpen && orderToEdit && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="glass-card modal-card" style={{ maxWidth: '780px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)', margin: 0 }}>
                  ✏️ {lang === 'ta' ? 'விலைப்பட்டியல் திருத்து' : 'Edit Invoice'}: {orderToEdit.invoice_number}
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Shop: {translateShopName(shops.find(s => s.id === orderToEdit.shop_id), lang)}
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Products Table */}
            <div style={{ marginBottom: '1rem', overflowX: 'auto' }}>
              <table className="custom-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Cases</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Bottles</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Rate (₹/Case)</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {editItems.map((item, idx) => {
                    return (
                      <tr key={item.id || idx}>
                        <td>
                          <select
                            className="form-select"
                            value={item.product_id}
                            onChange={e => handleEditItemChange(idx, 'product_id', e.target.value)}
                            style={{ width: '100%', fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {lang === 'ta' ? p.name_ta : p.name_en} ({p.size}) - Stock: {p.current_stock_bottles}b
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            placeholder="0"
                            value={item.cases === 0 ? '' : (item.cases ?? '')}
                            onFocus={e => e.target.select()}
                            onWheel={e => e.target.blur()}
                            onChange={e => {
                              const val = e.target.value;
                              handleEditItemChange(idx, 'cases', val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                            }}
                            style={{ width: '70px', textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            placeholder="0"
                            value={item.bottles === 0 ? '' : (item.bottles ?? '')}
                            onFocus={e => e.target.select()}
                            onWheel={e => e.target.blur()}
                            onChange={e => {
                              const val = e.target.value;
                              handleEditItemChange(idx, 'bottles', val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                            }}
                            style={{ width: '70px', textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            placeholder="0"
                            value={item.rate === 0 ? '' : (item.rate ?? '')}
                            onFocus={e => e.target.select()}
                            onWheel={e => e.target.blur()}
                            onChange={e => {
                              const val = e.target.value;
                              handleEditItemChange(idx, 'rate', val === '' ? '' : Math.max(0, parseFloat(val) || 0));
                            }}
                            style={{ width: '90px', textAlign: 'right', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          ₹{item.amount}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleRemoveEditItem(idx)}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="Remove item"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddEditItem}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              >
                ➕ {lang === 'ta' ? 'பொருள் சேர்க்க' : 'Add Product'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Discount (₹):</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  placeholder="0"
                  value={editDiscount === 0 ? '' : (editDiscount ?? '')}
                  onFocus={e => e.target.select()}
                  onWheel={e => e.target.blur()}
                  onChange={e => {
                    const val = e.target.value;
                    setEditDiscount(val === '' ? '' : Math.max(0, parseFloat(val) || 0));
                  }}
                  style={{ width: '100px', textAlign: 'right', padding: '0.35rem' }}
                />
              </div>
            </div>

            {/* Calculations Summary */}
            {(() => {
              const editSubtotal = editItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
              const editNetTotal = Math.max(0, editSubtotal - Number(editDiscount || 0));
              const diffNet = editNetTotal - (orderToEdit.net_amount || 0);

              return (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.85rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span>Items Subtotal:</span>
                    <strong>₹{editSubtotal}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span>Discount:</span>
                    <span style={{ color: 'var(--danger)' }}>- ₹{editDiscount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.4rem', marginTop: '0.4rem', fontSize: '1.05rem', fontWeight: 'bold' }}>
                    <span>New Net Total:</span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>₹{editNetTotal}</strong>
                  </div>
                  {diffNet !== 0 && (
                    <div style={{ fontSize: '0.8rem', color: diffNet > 0 ? 'var(--warning)' : 'var(--success)', marginTop: '0.3rem', textAlign: 'right' }}>
                      Shop Outstanding Impact: {diffNet > 0 ? `+ ₹${diffNet}` : `- ₹${Math.abs(diffNet)}`}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="btn-group" style={{ justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditModalOpen(false)}
                disabled={savingEdit}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEditedOrder}
                disabled={savingEdit}
              >
                💾 {savingEdit ? '...' : (lang === 'ta' ? 'மாற்றங்களை சேமி' : 'Save Changes')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Direct Delivery Sheet Print Template (Mounted on document.body to ensure direct printing & zero blank page 1) */}
      {ReactDOM.createPortal(
        <div className="delivery-sheet-print-only">
          {(() => {
            const itemsToPrint = selectedDeliveryIds.length > 0
              ? filteredDeliveries.filter(d => selectedDeliveryIds.includes(d.id))
              : filteredDeliveries;

            if (itemsToPrint.length === 0) return null;

            // Chunk items into pages of exactly 20 items each
            const pageChunks = [];
            for (let i = 0; i < itemsToPrint.length; i += 20) {
              pageChunks.push(itemsToPrint.slice(i, i + 20));
            }

            const activeRouteObj = routes.find(r => r.id === routeFilter);
            const activeRouteName = routeFilter !== 'all' ? (activeRouteObj?.name_en || activeRouteObj?.name || 'Filtered Route') : 'All Routes';

            return (
              <div>
                {pageChunks.map((chunk, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="delivery-print-page"
                    style={{
                      pageBreakAfter: pageIdx < pageChunks.length - 1 ? 'always' : 'auto',
                      breakAfter: pageIdx < pageChunks.length - 1 ? 'page' : 'auto',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Page Header (Repeated at top of EVERY page chunk) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px', borderBottom: '2px solid #000000', paddingBottom: '4px' }}>
                      <div>
                        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#000000', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                          GSK AGENCY - DELIVERY SHEET
                        </h1>
                        <div style={{ fontSize: '0.78rem', color: '#1e293b', marginTop: '2px', fontWeight: 'bold' }}>
                          Date: {new Date().toLocaleDateString('en-IN')} | Route: {activeRouteName} | Status: {statusFilter.toUpperCase()}
                          {(startDate || endDate) ? ` | Dates: ${startDate || 'Start'} - ${endDate || 'Today'}` : ''}
                          {searchQuery ? ` | Search: "${searchQuery}"` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 'bold', color: '#000000' }}>
                        Page {pageIdx + 1} of {pageChunks.length} ({itemsToPrint.length} items)
                      </div>
                    </div>

                    {/* Delivery Items Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'Arial, sans-serif' }}>
                      <thead>
                        <tr style={{ background: '#e2e8f0', color: '#000000' }}>
                          <th style={{ border: '1px solid #000000', padding: '4px 5px', textAlign: 'left', width: '13%' }}>Invoice No</th>
                          <th style={{ border: '1px solid #000000', padding: '4px 5px', textAlign: 'left', width: '12%' }}>Date</th>
                          <th style={{ border: '1px solid #000000', padding: '4px 5px', textAlign: 'left', width: '32%' }}>Shop & Route</th>
                          <th style={{ border: '1px solid #000000', padding: '4px 5px', textAlign: 'right', width: '14%' }}>Invoice Amount</th>
                          <th style={{ border: '1px solid #000000', padding: '4px 5px', textAlign: 'right', width: '15%' }}>Outstanding Amount to Pay</th>
                          <th style={{ border: '1px solid #000000', padding: '4px 5px', textAlign: 'center', width: '14%' }}>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((d, itemIdx) => {
                          const order = orders.find(o => o.id === d.order_id);
                          if (!order) return null;
                          const shop = shops.find(s => s.id === order.shop_id);
                          const route = routes.find(r => r.id === order.route_id);
                          
                          // Calculate Previous Outstanding EXCLUDING current invoice
                          const getPreviousOutstanding = (ord, shp) => {
                            if (!ord || !shp) return 0;
                            const shopOrders = (orders || []).filter(o => o.shop_id === ord.shop_id && o.status !== 'cancelled');
                            const shopPayments = (payments || []).filter(p => p.shop_id === ord.shop_id);
                            const currentOrderDate = new Date(ord.order_date).getTime();

                            const futureOrders = shopOrders.filter(o => {
                              if (o.id === ord.id) return false;
                              const oDate = new Date(o.order_date).getTime();
                              if (oDate > currentOrderDate) return true;
                              if (oDate === currentOrderDate) {
                                const numA = parseInt((String(o.invoice_number).match(/\d+/) || [0])[0], 10);
                                const numB = parseInt((String(ord.invoice_number).match(/\d+/) || [0])[0], 10);
                                return numA > numB;
                              }
                              return false;
                            });

                            const futureUnpaidNet = futureOrders.reduce((sum, futOrd) => {
                              const futPayments = shopPayments.filter(p => p.order_id === futOrd.id);
                              const futPaid = futPayments.reduce((pSum, p) => pSum + (Number(p.collected_amount) || 0), 0);
                              return sum + Math.max(0, (Number(futOrd.net_amount) || 0) - futPaid);
                            }, 0);

                            const shopCurrentBal = Number(shp.outstanding_amount || 0);
                            const shopBalAtOrderTime = Math.max(0, shopCurrentBal - futureUnpaidNet);
                            const currentPayments = shopPayments.filter(p => p.order_id === ord.id);
                            const totalCollected = currentPayments.reduce((sum, p) => sum + (Number(p.collected_amount) || 0), 0);
                            const currentInvoiceUnpaid = Math.max(0, Number(ord.net_amount || 0) - totalCollected);

                            return Math.max(0, shopBalAtOrderTime - currentInvoiceUnpaid);
                          };

                          const prevOutstanding = getPreviousOutstanding(order, shop);

                          return (
                            <tr key={d.id} style={{ height: '28px', background: itemIdx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                              <td style={{ border: '1px solid #000000', padding: '3px 5px', fontWeight: 'bold', color: '#000000' }}>
                                {order.invoice_number}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 5px', color: '#000000' }}>
                                {order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN') : 'N/A'}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 5px', color: '#000000' }}>
                                <div style={{ fontWeight: 'bold' }}>
                                  {shop ? (shop.name_en || shop.name) : ''} {shop?.name_ta ? `(${shop.name_ta})` : ''}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#334155' }}>
                                  Route: {route ? (route.name_en || route.name) : 'N/A'}
                                </div>
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 5px', textAlign: 'right', fontWeight: 'bold', color: '#000000' }}>
                                ₹{Number(order.net_amount || 0).toLocaleString('en-IN')}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 5px', textAlign: 'right', fontWeight: 'bold', color: '#000000' }}>
                                ₹{prevOutstanding.toLocaleString('en-IN')}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 5px', background: '#ffffff' }}>
                                {/* Blank every time for manual handwritten entry */}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>,
        document.body
      )}
    </div>
  );
}
