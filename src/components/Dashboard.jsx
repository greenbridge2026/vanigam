import React, { useState, useEffect } from 'react';
import api from '../api';

export default function Dashboard({ t, lang }) {
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, prodRes, routeRes, ordRes, shopRes] = await Promise.all([
          api.getReportSummary(),
          api.getProducts(),
          api.getRoutes(),
          api.getOrders(),
          api.getShops()
        ]);
        setSummary(sumRes);
        setProducts(prodRes);
        setRoutes(routeRes);
        setOrders(ordRes);
        setShops(shopRes);
      } catch (err) {
        console.error('Error fetching dashboard summary', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Loading Dashboard...</div>;

  // Calculate route wise orders
  const routeStats = routes.map(r => {
    const routeOrders = orders.filter(o => o.route_id === r.id);
    const amount = routeOrders.reduce((sum, o) => sum + o.net_amount, 0);
    return {
      name: lang === 'ta' ? r.name_ta : r.name_en,
      count: routeOrders.length,
      amount
    };
  });

  const maxRouteAmount = Math.max(...routeStats.map(rs => rs.amount), 1);

  // Filter low stock and out of stock products
  const lowStockProds = products.filter(p => p.current_stock_bottles <= p.min_stock && p.status === 'active');
  const outOfStockProds = products.filter(p => p.current_stock_bottles === 0 && p.status === 'active');

  // Filter pending deliveries for today
  const pendingDeliveries = orders.filter(o => o.status === 'pending');

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🥤 {t('dashboard')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{t('dashboard_summary')}</p>
      </div>

      {/* Main Stats Grid */}
      <div className="dashboard-grid">
        <div className="glass-card stat-card">
          <div className="stat-info">
            <h3>{t('todays_orders')}</h3>
            <p>{summary?.todayOrdersCount || 0}</p>
          </div>
          <div className="stat-icon">🛒</div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-info">
            <h3>{t('total_sales')}</h3>
            <p>₹{summary?.todaySales || 0}</p>
          </div>
          <div className="stat-icon">💰</div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-info">
            <h3>{t('outstanding_amount')}</h3>
            <p>₹{summary?.totalOutstanding || 0}</p>
          </div>
          <div className="stat-icon" style={{ color: 'var(--warning)' }}>⏳</div>
        </div>

        <div className="glass-card stat-card warning-card">
          <div className="stat-info">
            <h3>{t('low_stock_alert')}</h3>
            <p>{lowStockProds.length}</p>
          </div>
          <div className="stat-icon">⚠️</div>
        </div>
      </div>

      {/* Warning/Alert Sections */}
      {outOfStockProds.length > 0 && (
        <div className="glass-card" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            🚨 {t('out_of_stock')}
          </h3>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {outOfStockProds.map(p => (
              <li key={p.id} style={{ color: 'var(--text-main)' }}>
                {lang === 'ta' ? p.name_ta : p.name_en} ({p.size}) - {t('out_of_stock')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lowStockProds.filter(p => p.current_stock_bottles > 0).length > 0 && (
        <div className="glass-card" style={{ borderColor: 'var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
          <h3 style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            ⚠️ {t('low_stock')}
          </h3>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {lowStockProds.filter(p => p.current_stock_bottles > 0).map(p => (
              <li key={p.id} style={{ color: 'var(--text-muted)' }}>
                {lang === 'ta' ? p.name_ta : p.name_en} ({p.size}) - Only <strong>{p.current_stock_bottles}</strong> bottles remaining. (Min limit: {p.min_stock})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Two Columns Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* Route-wise Sales Chart */}
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            📈 {t('route_wise_orders')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {routeStats.map((rs, idx) => {
              const percentage = (rs.amount / maxRouteAmount) * 100;
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: '500' }}>{rs.name}</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>₹{rs.amount} ({rs.count} orders)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))',
                      borderRadius: '999px',
                      transition: 'width 1s ease-in-out'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Deliveries */}
        <div className="glass-card">
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            🚚 {t('pending_deliveries')} ({pendingDeliveries.length})
          </h2>
          {pendingDeliveries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>All clear! No pending deliveries.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto' }}>
              {pendingDeliveries.slice(0, 5).map(o => {
                const shop = shops.find(s => s.id === o.shop_id);
                const route = routes.find(r => r.id === o.route_id);
                return (
                  <div key={o.id} style={{
                    padding: '0.8rem 1rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem' }}>{shop ? (lang === 'ta' ? shop.name_ta : shop.name_en) : 'Shop Name'}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Route: {route ? (lang === 'ta' ? route.name_ta : route.name_en) : ''} | Invoice: {o.invoice_number}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontWeight: '700', color: 'var(--accent-cyan)' }}>₹{o.net_amount}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--warning)', background: 'rgba(245,158,11,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.1)' }}>
                        {t('pending')}
                      </span>
                    </div>
                  </div>
                );
              })}
              {pendingDeliveries.length > 5 && (
                <p style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', textAlign: 'center', cursor: 'pointer', marginTop: '0.5rem' }}>
                  + {pendingDeliveries.length - 5} more pending. Go to Deliveries tab.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
