import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function Reports({ t, lang, onBillSelected, session }) {
  const [activeTab, setActiveTab] = useState('daily_sales');
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReportsData() {
      try {
        const [ord, items, prod, sh, rt, pay, purch, del] = await Promise.all([
          api.getOrders(),
          api.getOrderItems(),
          api.getProducts(),
          api.getShops(),
          api.getRoutes(),
          api.getPayments(),
          api.getPurchases(),
          api.getDeliveries()
        ]);
        setOrders(ord);
        setOrderItems(items);
        setProducts(prod);
        setShops(sh);
        setRoutes(rt);
        setPayments(pay);
        setPurchases(purch);
        setDeliveries(del);
      } catch (err) {
        console.error('Failed to load reports datasets', err);
      } finally {
        setLoading(false);
      }
    }
    loadReportsData();
  }, []);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState(null);

  const handleCancelOrderTrigger = (id) => {
    setCancelTargetId(id);
    setConfirmOpen(true);
  };

  const executeCancelOrder = async () => {
    setConfirmOpen(false);
    if (!cancelTargetId) return;
    try {
      await api.deleteOrder(cancelTargetId);
      setOrders(orders.filter(o => o.id !== cancelTargetId));
      // Reload details to keep state fresh
      const [items, prod, sh, pay, del] = await Promise.all([
        api.getOrderItems(),
        api.getProducts(),
        api.getShops(),
        api.getPayments(),
        api.getDeliveries()
      ]);
      setOrderItems(items);
      setProducts(prod);
      setShops(sh);
      setPayments(pay);
      setDeliveries(del);
      alert('Order successfully cancelled. / ஆர்டர் வெற்றிகரமாக ரத்து செய்யப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancelTargetId(null);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Analytical Reports...</div>;

  // Filter items matching global search
  const query = searchQuery.toLowerCase();
  
  // Custom Filter Function per report item
  const matchesSearch = (item, type) => {
    if (!searchQuery) return true;
    
    if (type === 'order') {
      const shopObj = shops.find(s => s.id === item.shop_id);
      const routeObj = routes.find(r => r.id === item.route_id);
      const sName = shopObj ? `${shopObj.name_en} ${shopObj.name_ta}` : '';
      const rName = routeObj ? `${routeObj.name_en} ${routeObj.name_ta}` : '';
      return (
        item.invoice_number.toLowerCase().includes(query) ||
        sName.toLowerCase().includes(query) ||
        rName.toLowerCase().includes(query) ||
        (shopObj?.mobile || '').includes(query) ||
        (shopObj?.gst_number || '').toLowerCase().includes(query)
      );
    }
    
    if (type === 'payment') {
      const shopObj = shops.find(s => s.id === item.shop_id);
      const sName = shopObj ? `${shopObj.name_en} ${shopObj.name_ta}` : '';
      return (
        sName.toLowerCase().includes(query) ||
        item.transaction_number.toLowerCase().includes(query) ||
        item.payment_mode.toLowerCase().includes(query)
      );
    }

    if (type === 'shop') {
      const routeObj = routes.find(r => r.id === item.route_id);
      const rName = routeObj ? `${routeObj.name_en} ${routeObj.name_ta}` : '';
      const sName = `${item.name_en} ${item.name_ta}`;
      return (
        sName.toLowerCase().includes(query) ||
        rName.toLowerCase().includes(query) ||
        item.mobile.includes(query) ||
        (item.gst_number || '').toLowerCase().includes(query) ||
        item.contact_person.toLowerCase().includes(query)
      );
    }

    if (type === 'product') {
      const pName = `${item.name_en} ${item.name_ta}`;
      return pName.toLowerCase().includes(query) || item.brand.toLowerCase().includes(query);
    }

    if (type === 'purchase') {
      const prod = products.find(p => p.id === item.product_id);
      const pName = prod ? `${prod.name_en} ${prod.name_ta}` : '';
      return pName.toLowerCase().includes(query) || item.supplier.toLowerCase().includes(query);
    }

    return true;
  };

  const renderReportContent = () => {
    switch (activeTab) {
      
      // 1. Daily Sales
      case 'daily_sales': {
        const filtered = orders.filter(o => matchesSearch(o, 'order'));
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice No</th>
                  <th>Shop</th>
                  <th>Discount</th>
                  <th>Net Total</th>
                  <th>Status</th>
                  <th>Bill</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const shop = shops.find(s => s.id === o.shop_id);
                  return (
                    <tr key={o.id}>
                      <td>{new Date(o.order_date).toLocaleDateString()}</td>
                      <td><strong>{o.invoice_number}</strong></td>
                      <td>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : 'Shop'}</td>
                      <td>₹{o.discount}</td>
                      <td style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>₹{o.net_amount}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px',
                          background: o.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: o.status === 'delivered' ? 'var(--success)' : 'var(--warning)',
                          border: `1px solid ${o.status === 'delivered' ? 'var(--success)' : 'var(--warning)'}`
                        }}>
                          {o.status === 'delivered' ? t('delivered') : t('pending')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button className="language-btn" onClick={() => onBillSelected(o.id)}>View</button>
                           {session?.role === 'admin' && (
                             <button className="btn btn-danger" onClick={() => handleCancelOrderTrigger(o.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                               Cancel
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
        );
      }

      // 2. Route-wise Sales
      case 'route_sales': {
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Route Name</th>
                  <th>Assigned Sales Rep</th>
                  <th>Total Orders Placed</th>
                  <th>Gross Value Sold</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(r => {
                  const routeOrders = orders.filter(o => o.route_id === r.id);
                  const total = routeOrders.reduce((sum, o) => sum + o.net_amount, 0);
                  return (
                    <tr key={r.id}>
                      <td><strong>{lang === 'ta' ? r.name_ta : r.name_en}</strong></td>
                      <td>👤 {t('salesman')}</td>
                      <td>{routeOrders.length} Orders</td>
                      <td style={{ color: 'var(--success)', fontWeight: '700' }}>₹{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // 3. Salesman-wise Sales
      case 'salesman_sales': {
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Salesperson Name</th>
                  <th>Role</th>
                  <th>Total Orders Registered</th>
                  <th>Net Booking Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>👤 <strong>Salesman Karthik</strong></td>
                  <td>Field Sales Rep</td>
                  <td>{orders.length} Orders</td>
                  <td style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>₹{orders.reduce((sum, o) => sum + o.net_amount, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }

      // 4. Delivery Report
      case 'delivery_report': {
        const filtered = deliveries.filter(d => {
          const ord = orders.find(o => o.id === d.order_id);
          return ord ? matchesSearch(ord, 'order') : true;
        });

        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Shop</th>
                  <th>Delivery Date & Time</th>
                  <th>Status</th>
                  <th>Logistics Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const ord = orders.find(o => o.id === d.order_id);
                  const shop = ord ? shops.find(s => s.id === ord.shop_id) : null;
                  return (
                    <tr key={d.id}>
                      <td><strong>{ord?.invoice_number}</strong></td>
                      <td>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : ''}</td>
                      <td>{d.delivery_time ? new Date(d.delivery_time).toLocaleString() : '--'}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px',
                          background: d.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: d.status === 'delivered' ? 'var(--success)' : 'var(--warning)',
                          border: `1px solid ${d.status === 'delivered' ? 'var(--success)' : 'var(--warning)'}`
                        }}>
                          {d.status === 'delivered' ? t('delivered') : t('pending')}
                        </span>
                      </td>
                      <td style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{d.remarks || '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // 5. Collection Report
      case 'collection_report': {
        const filtered = payments.filter(p => matchesSearch(p, 'payment'));
        const totalCollect = filtered.reduce((sum, p) => sum + p.collected_amount, 0);

        return (
          <div>
            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Amount Collected:</span>
              <h3 style={{ fontSize: '1.75rem', color: 'var(--success)', fontWeight: '800' }}>₹{totalCollect}</h3>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shop</th>
                    <th>Reference Invoice</th>
                    <th>Payment Mode</th>
                    <th>Txn / Ref No</th>
                    <th>Collected Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const shop = shops.find(s => s.id === p.shop_id);
                    const ord = orders.find(o => o.id === p.order_id);
                    return (
                      <tr key={p.id}>
                        <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td><strong>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : ''}</strong></td>
                        <td>{ord?.invoice_number || 'Outstanding Pay'}</td>
                        <td>
                          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                            {p.payment_mode}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.transaction_number}</td>
                        <td style={{ color: 'var(--success)', fontWeight: '700' }}>₹{p.collected_amount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // 6. Outstanding Report
      case 'outstanding_report': {
        const filtered = shops.filter(s => s.outstanding_amount > 0 && matchesSearch(s, 'shop'));
        const sumOutstanding = filtered.reduce((sum, s) => sum + s.outstanding_amount, 0);

        return (
          <div>
            <div style={{ padding: '1rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Cumulative Outstandings:</span>
              <h3 style={{ fontSize: '1.75rem', color: 'var(--warning)', fontWeight: '800' }}>₹{sumOutstanding}</h3>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Shop Name</th>
                    <th>Contact Info</th>
                    <th>Shop Type</th>
                    <th>Unpaid Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td><strong>{lang === 'ta' ? s.name_ta : s.name_en}</strong></td>
                      <td>
                        <div>{s.contact_person}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>📞 {s.mobile}</div>
                      </td>
                      <td>
                        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{s.shop_type}</span>
                      </td>
                      <td style={{ color: 'var(--danger)', fontWeight: '700' }}>₹{s.outstanding_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // 7. Stock Report
      case 'stock_report': {
        const filtered = products.filter(p => matchesSearch(p, 'product'));
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Brand / Size</th>
                  <th>Case Ratio</th>
                  <th>Available Stock (Bottles)</th>
                  <th>Min Limit Alert</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isOut = p.current_stock_bottles === 0;
                  const isLow = p.current_stock_bottles <= p.min_stock;
                  return (
                    <tr key={p.id}>
                      <td><strong>{lang === 'ta' ? p.name_ta : p.name_en}</strong></td>
                      <td>{p.brand} | {p.size}</td>
                      <td>{p.case_qty_rule} Bottles/Case</td>
                      <td style={{ fontWeight: '700' }}>{p.current_stock_bottles} bottles</td>
                      <td>{p.min_stock} bottles</td>
                      <td>
                        {isOut ? (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--danger)' }}>
                            OUT
                          </span>
                        ) : isLow ? (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--warning)' }}>
                            LOW
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--success)' }}>
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // 8. Purchase Report
      case 'purchase_report': {
        const filtered = purchases.filter(p => matchesSearch(p, 'purchase'));
        return (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>Cases Purchased</th>
                  <th>Rate/Case</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const prod = products.find(pr => pr.id === p.product_id);
                  return (
                    <tr key={p.id}>
                      <td>{new Date(p.purchase_date).toLocaleDateString()}</td>
                      <td><strong>{p.supplier}</strong></td>
                      <td>{prod ? (lang === 'ta' ? prod.name_ta : prod.name_en) : ''}</td>
                      <td>{p.cases} Cases, {p.bottles} Bottles</td>
                      <td>₹{p.purchase_price}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      // 9. Profit Report
      case 'profit_report': {
        // Calculate Profit: Revenue - Purchase Cost of all sold quantities
        let totalCost = 0;
        let totalRevenue = 0;

        orderItems.forEach(item => {
          const p = products.find(prod => prod.id === item.product_id);
          if (p) {
            const totalQtyBottles = (item.cases * p.case_qty_rule) + item.bottles;
            const cost = totalQtyBottles * (p.purchase_price / p.case_qty_rule);
            totalCost += cost;
            totalRevenue += item.amount;
          }
        });

        const grossProfit = Math.round(totalRevenue - totalCost);
        const marginPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Net Sales Revenue:</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>₹{Math.round(totalRevenue)}</h3>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Cost of Goods Sold (COGS):</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-muted)' }}>₹{Math.round(totalCost)}</h3>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('gross_profit')}:</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>₹{grossProfit} ({marginPct}%)</h3>
              </div>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Total Bottles Sold</th>
                    <th>Sales Revenue</th>
                    <th>Product Cost Value</th>
                    <th>Estimated Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const soldQty = orderItems
                      .filter(oi => oi.product_id === p.id)
                      .reduce((sum, oi) => sum + (oi.cases * p.case_qty_rule + oi.bottles), 0);
                    
                    const revenue = orderItems
                      .filter(oi => oi.product_id === p.id)
                      .reduce((sum, oi) => sum + oi.amount, 0);

                    const cost = soldQty * (p.purchase_price / p.case_qty_rule);
                    const profit = Math.round(revenue - cost);

                    if (soldQty === 0) return null;

                    return (
                      <tr key={p.id}>
                        <td><strong>{lang === 'ta' ? p.name_ta : p.name_en}</strong></td>
                        <td>{soldQty} bottles ({Math.floor(soldQty/p.case_qty_rule)} Cases)</td>
                        <td>₹{revenue}</td>
                        <td>₹{Math.round(cost)}</td>
                        <td style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '700' }}>
                          ₹{profit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const tabs = [
    { id: 'daily_sales', label: t('daily_sales') },
    { id: 'route_sales', label: t('route_sales') },
    { id: 'salesman_sales', label: t('salesman_sales') },
    { id: 'delivery_report', label: 'Delivery logs' },
    { id: 'collection_report', label: t('collection_report') },
    { id: 'outstanding_report', label: t('outstanding_report') },
    { id: 'stock_report', label: t('stock_report') },
    { id: 'purchase_report', label: t('purchase_report') },
    { id: 'profit_report', label: t('profit_report') }
  ];

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>📈 Operational Intelligence Reports</h1>
        <p style={{ color: 'var(--text-muted)' }}>Query and verify active ledgers, profitability indexes, and collection reports</p>
      </div>

      {/* Global Search Bar */}
      <div className="search-wrapper">
        <span>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('search_placeholder')}
        />
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }} className="reports-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`language-btn ${activeTab === tab.id ? 'active' : ''}`}
            style={{
              background: activeTab === tab.id ? 'var(--accent-cyan)' : '',
              color: activeTab === tab.id ? '#0f172a' : ''
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render selected report */}
      <div className="glass-card">
        {renderReportContent()}
      </div>
      <ConfirmModal
        isOpen={confirmOpen}
        title={t('confirm_title')}
        message={t('confirm_delete_msg')}
        confirmText={t('confirm_ok')}
        cancelText={t('confirm_cancel')}
        onConfirm={executeCancelOrder}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
