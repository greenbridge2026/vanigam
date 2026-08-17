import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';
import { translateShopName, translateRouteName } from '../translations';

export default function DeliveryMgr({ t, lang, onBillSelected, session, onBulkPrint }) {
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
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
  const [cashAmount, setCashAmount] = useState(0);
  const [gpayAmount, setGpayAmount] = useState(0);
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
        cases: 1,
        bottles: 0,
        rate: defaultRate,
        amount: defaultRate
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
        items: editItems,
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
        const [dData, oData, sData, rData] = await Promise.all([
          api.getDeliveries(),
          api.getOrders(),
          api.getShops(),
          api.getRoutes()
        ]);
        setDeliveries(dData);
        setOrders(oData);
        setShops(sData);
        setRoutes(rData);
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
            setCashAmount(matchedOrder ? matchedOrder.net_amount : 0);
            setGpayAmount(0);
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
    
    setActiveDelivery({ del, order, shop });
    setRemarks('');
    setCashAmount(order ? order.net_amount : 0);
    setGpayAmount(0);
    setGpayTxn('');
    setFulfillmentType('delivered');
    setReason('');
  };

  const handleFulfillOrder = async (status, selectedReason, customRemarks) => {
    if (!activeDelivery) return;
    setSubmitting(true);
    try {
      const { del, order, shop } = activeDelivery;
      
      // 1. Process Collection Payment if status is delivered and collected amount is entered
      if (status === 'delivered') {
        const totalAmt = Number(cashAmount || 0) + Number(gpayAmount || 0);
        if (totalAmt > 0) {
          const paymentsToSubmit = [];
          if (Number(cashAmount) > 0) {
            paymentsToSubmit.push({
              shop_id: shop.id,
              order_id: order.id,
              collected_amount: Number(cashAmount),
              payment_mode: 'cash',
              transaction_number: '',
              reference_number: '',
              payment_date: new Date().toISOString()
            });
          }
          if (Number(gpayAmount) > 0) {
            paymentsToSubmit.push({
              shop_id: shop.id,
              order_id: order.id,
              collected_amount: Number(gpayAmount),
              payment_mode: 'gpay',
              transaction_number: gpayTxn || `TXN-${Date.now()}`,
              reference_number: '',
              payment_date: new Date().toISOString()
            });
          }
          await api.createPayment({ payments: paymentsToSubmit });
        }
      }

      // 2. Mark Delivery complete on backend
      await api.completeDelivery(del.id, {
        status,
        reason: selectedReason,
        remarks: customRemarks
      });

      alert(
        status === 'delivered'
          ? 'Delivery recorded successfully! / விநியோகம் பதிவு செய்யப்பட்டது!'
          : status === 'returned'
          ? 'Order marked as Returned. Stock and outstanding reverted. / ஆர்டர் திரும்பப் பெறப்பட்டது.'
          : 'Order marked as Not Delivered. Stock and outstanding reverted. / ஆர்டர் விநியோகிக்கப்படவில்லை.'
      );

      // Reload dataset
      const [dData, oData, sData] = await Promise.all([
        api.getDeliveries(),
        api.getOrders(),
        api.getShops()
      ]);
      setDeliveries(dData);
      setOrders(oData);
      setShops(sData);
      
      setActiveDelivery(null);
      setNonDeliveryModalOpen(false);
    } catch (err) {
      alert('Error updating delivery logistics: ' + (err.message || err));
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

    return true;
  });

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Delivery Logistics...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🚚 {t('deliveries')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Fulfill orders, collect outstanding payments, and issue final shop receipts</p>
      </div>

      <div className="delivery-mgr-grid">
        
        {/* Deliveries list */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('assigned_orders')}</h2>
              <select
                className="form-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: '150px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', margin: 0 }}
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
                style={{ width: '180px', padding: '0.4rem 0.75rem', fontSize: '0.9rem', margin: 0 }}
              >
                <option value="all">{lang === 'ta' ? 'அனைத்து வழிகள்' : 'All Routes'}</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {lang === 'ta' ? r.name_ta : r.name_en}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{lang === 'ta' ? 'முதல்' : 'From'}:</span>
                <input
                  type="date"
                  className="form-select"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{ 
                    padding: '0.4rem 0.5rem', 
                    fontSize: '0.9rem', 
                    width: '145px', 
                    margin: 0,
                    height: '38px',
                    lineHeight: '1.2',
                    background: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{lang === 'ta' ? 'வரை' : 'To'}:</span>
                <input
                  type="date"
                  className="form-select"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={{ 
                    padding: '0.4rem 0.5rem', 
                    fontSize: '0.9rem', 
                    width: '145px', 
                    margin: 0,
                    height: '38px',
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
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', margin: 0, height: '38px' }}
                >
                  {lang === 'ta' ? 'அழி' : 'Clear'}
                </button>
              )}
            </div>
            {selectedDeliveryIds.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBulkPrintTrigger}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 1rem',
                  fontSize: '0.85rem'
                }}
              >
                🖨️ {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டவற்றை அச்சிடு' : 'Print Selected'} ({selectedDeliveryIds.length})
              </button>
            )}
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>
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
                  <th>Amount Due</th>
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
                  
                  let statusBg = 'rgba(245, 158, 11, 0.1)';
                  let statusColor = 'var(--warning)';
                  let statusLabel = t('pending');

                  if (d.status === 'delivered') {
                    statusBg = 'rgba(16, 185, 129, 0.1)';
                    statusColor = 'var(--success)';
                    statusLabel = t('delivered');
                  } else if (d.status === 'not_delivered') {
                    statusBg = 'rgba(239, 68, 68, 0.1)';
                    statusColor = 'var(--danger)';
                    statusLabel = t('not_delivered');
                  } else if (d.status === 'returned') {
                    statusBg = 'rgba(59, 130, 246, 0.1)';
                    statusColor = 'var(--accent-blue)';
                    statusLabel = t('returned');
                  }

                  const isSelected = activeDelivery && activeDelivery.del.id === d.id;
                  return (
                    <tr 
                      key={d.id} 
                      style={{ 
                        opacity: d.status !== 'pending' ? 0.7 : 1,
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
                      <td>₹{order.net_amount}</td>
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
                          {(!session || session.role === 'admin' || session.role === 'salesman') && (
                            <button
                              type="button"
                              className="language-btn"
                              onClick={() => handleStartEditOrder(order)}
                              style={{ padding: '0.4rem 0.6rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title={lang === 'ta' ? 'பில் திருத்துக' : 'Edit Invoice'}
                            >
                              ✏️
                            </button>
                          )}
                          {d.status === 'pending' ? (
                            <>
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

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                  <span>Shop Outstanding:</span>
                  <strong style={{ color: 'var(--warning)' }}>₹{activeDelivery.shop.outstanding_amount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Current Order Amount:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>₹{activeDelivery.order.net_amount}</strong>
                </div>
              </div>

              {fulfillmentType === 'delivered' ? (
                <>
                  {/* Outstanding collections input */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>💵 {t('payment_collection')}</h3>
                    
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', display: 'block' }}>💵 {t('cash')} Amount (₹)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="form-input"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                        value={cashAmount || ''}
                        onChange={e => setCashAmount(Math.max(0, parseInt(e.target.value.replace(/\D/g, '')) || 0))}
                        placeholder="Cash Collected Amount"
                      />
                    </div>

                    {/* Live calculation for collection */}
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span>Invoice Total:</span>
                        <strong style={{ color: 'var(--accent-cyan)' }}>₹{activeDelivery.order.net_amount}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span>Total Collected:</span>
                        <strong style={{ color: 'var(--success)' }}>
                          ₹{Number(cashAmount || 0) + Number(gpayAmount || 0)}
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '0.2rem', marginTop: '0.2rem' }}>
                        <span>Remaining Balance:</span>
                        <strong style={{ color: (activeDelivery.order.net_amount - (Number(cashAmount || 0) + Number(gpayAmount || 0))) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          ₹{activeDelivery.order.net_amount - (Number(cashAmount || 0) + Number(gpayAmount || 0))}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <label>{t('remarks')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="e.g. Received intact, signature verified"
                    />
                  </div>

                  <div className="btn-group" style={{ marginTop: '1rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setActiveDelivery(null)}>
                      {t('cancel')}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => handleFulfillOrder('delivered', '', remarks)} disabled={submitting}>
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
                            value={item.cases}
                            onChange={e => handleEditItemChange(idx, 'cases', Math.max(0, parseInt(e.target.value) || 0))}
                            style={{ width: '70px', textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={item.bottles}
                            onChange={e => handleEditItemChange(idx, 'bottles', Math.max(0, parseInt(e.target.value) || 0))}
                            style={{ width: '70px', textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={item.rate}
                            onChange={e => handleEditItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
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
                  value={editDiscount}
                  onChange={e => setEditDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
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
    </div>
  );
}
