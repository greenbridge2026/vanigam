import React, { useState, useEffect } from 'react';
import api from '../api';
import { translateShopName, translateRouteName } from '../translations';
import {
  ShoppingCart,
  DollarSign,
  Clock,
  AlertTriangle,
  Truck,
  CheckCircle2,
  Package,
  Plus,
  ArrowRight,
  TrendingUp,
  Receipt,
  Banknote
} from 'lucide-react';

export default function Dashboard({ t, lang, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState(() => api.getCached('products') || []);
  const [routes, setRoutes] = useState(() => api.getCached('routes') || []);
  const [orders, setOrders] = useState(() => api.getCached('orders') || []);
  const [shops, setShops] = useState(() => api.getCached('shops') || []);
  const [loading, setLoading] = useState(() => !api.getCached('orders') || !api.getCached('products'));

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

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
        <p style={{ fontSize: '1rem' }}>{lang === 'ta' ? 'டாஷ்போர்டு ஏற்றப்படுகிறது...' : 'Loading Dashboard Overview...'}</p>
      </div>
    );
  }

  // Stock alerts
  const activeProducts = products.filter(p => (p.status || 'active').toLowerCase() === 'active');
  const lowStockProds = activeProducts.filter(p => p.current_stock_bottles > 0 && p.current_stock_bottles <= p.min_stock);
  const outOfStockProds = activeProducts.filter(p => p.current_stock_bottles === 0);
  const totalStockAlerts = lowStockProds.length + outOfStockProds.length;

  // Pending deliveries
  const pendingDeliveries = orders.filter(o => o.status === 'pending');

  // Today's fulfillment metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => (o.order_date || '').startsWith(todayStr));
  const deliveredToday = todayOrders.filter(o => o.status === 'delivered').length;
  const pendingToday = todayOrders.filter(o => o.status === 'pending').length;
  const totalToday = todayOrders.length;
  const fulfillmentPct = totalToday > 0 ? Math.round((deliveredToday / totalToday) * 100) : 0;

  // Route breakdown
  const routeStats = routes.map(r => {
    const routeOrders = orders.filter(o => o.route_id === r.id);
    const amount = routeOrders.reduce((sum, o) => sum + (o.net_amount || 0), 0);
    return {
      id: r.id,
      name: lang === 'ta' ? (r.name_ta || r.name_en) : r.name_en,
      count: routeOrders.length,
      amount
    };
  }).filter(rs => rs.count > 0 || rs.amount > 0);

  const maxRouteAmount = Math.max(...routeStats.map(rs => rs.amount), 1);

  return (
    <div className="clean-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      {/* Top Banner & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
            {lang === 'ta' ? 'வணிகச் சுருக்கம்' : 'Business Dashboard'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            {new Date().toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            {' • '}
            {lang === 'ta' ? 'அன்றாட செயல்பாடுகள் மற்றும் விநியோக நிலை' : 'Real-time performance and pending activities'}
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate && onNavigate('orders')}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={15} />
            <span>{lang === 'ta' ? '+ புதிய ஆர்டர்' : '+ New Order'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (onNavigate) {
                localStorage.setItem('activeTab', 'orders');
                localStorage.setItem('orderTakingSubTab', 'rough_bill');
                onNavigate('orders');
              }
            }}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Receipt size={15} />
            <span>{lang === 'ta' ? 'ரஃப் பில்' : 'Rough Bill'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('outstanding_collection')}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Banknote size={15} />
            <span>{lang === 'ta' ? 'வசூல்' : 'Collections'}</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Business Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Today's Sales */}
        <div
          className="glass-card stat-card"
          onClick={() => onNavigate && onNavigate('reports')}
          style={{ cursor: 'pointer', padding: '1.1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              {lang === 'ta' ? 'இன்றைய விற்பனை' : "Today's Sales"}
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-main)' }}>
              ₹{(summary?.todaySales || 0).toLocaleString()}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
              {summary?.todayOrdersCount || 0} {lang === 'ta' ? 'ஆர்டர்கள் இன்று' : 'orders logged today'}
            </span>
          </div>
          <div style={{ padding: '0.55rem', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Card 2: Delivery Fulfillment */}
        <div
          className="glass-card stat-card"
          onClick={() => onNavigate && onNavigate('deliveries', 'pending')}
          style={{ cursor: 'pointer', padding: '1.1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              {lang === 'ta' ? 'விநியோக நிலை' : 'Deliveries'}
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--text-main)' }}>
              {deliveredToday} / {totalToday}
            </h3>
            <span style={{ fontSize: '0.75rem', color: pendingToday > 0 ? 'var(--warning)' : 'var(--success)', marginTop: '0.2rem', display: 'block' }}>
              {pendingToday > 0 
                ? `${pendingToday} ${lang === 'ta' ? 'விநியோகத்திற்கு உள்ளன' : 'pending dispatch'}`
                : (lang === 'ta' ? 'அனைத்தும் முடிந்தது' : '100% fulfilled today')}
            </span>
          </div>
          <div style={{ padding: '0.55rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <Truck size={18} />
          </div>
        </div>

        {/* Card 3: Outstanding Receivables */}
        <div
          className="glass-card stat-card"
          onClick={() => onNavigate && onNavigate('outstanding_collection')}
          style={{ cursor: 'pointer', padding: '1.1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              {lang === 'ta' ? 'நிலுவைத் தொகை' : 'Outstanding Balance'}
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: 'var(--warning)' }}>
              ₹{(summary?.totalOutstanding || 0).toLocaleString()}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
              {lang === 'ta' ? 'வசூலிக்க வேண்டிய தொகை' : 'Unpaid balance from outlets'}
            </span>
          </div>
          <div style={{ padding: '0.55rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <Clock size={18} />
          </div>
        </div>

        {/* Card 4: Inventory Alerts */}
        <div
          className="glass-card stat-card"
          onClick={() => onNavigate && onNavigate('products')}
          style={{ cursor: 'pointer', padding: '1.1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        >
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
              {lang === 'ta' ? 'இருப்பு எச்சரிக்கை' : 'Stock Alerts'}
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.35rem', color: totalStockAlerts > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {totalStockAlerts}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
              {totalStockAlerts === 0
                ? (lang === 'ta' ? 'போதுமான இருப்பு உள்ளது' : 'All items well stocked')
                : `${outOfStockProds.length} ${lang === 'ta' ? 'தீர்ந்தது' : 'out of stock'}, ${lowStockProds.length} ${lang === 'ta' ? 'குறைவு' : 'low'}`}
            </span>
          </div>
          <div style={{ padding: '0.55rem', borderRadius: '8px', background: totalStockAlerts > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: totalStockAlerts > 0 ? 'var(--danger)' : 'var(--success)' }}>
            <Package size={18} />
          </div>
        </div>
      </div>

      {/* Pending Activities & Operations */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Section 1: Pending Deliveries */}
        <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }}>
              <Truck size={17} style={{ color: 'var(--accent-cyan)' }} />
              <span>{lang === 'ta' ? 'விநியோகத்திற்கு நிலுவையிலுள்ளவை' : 'Pending Deliveries'}</span>
              <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                {pendingDeliveries.length}
              </span>
            </h2>

            {pendingDeliveries.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('deliveries', 'pending')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <span>{lang === 'ta' ? 'அனைத்தும் பார்' : 'View All'}</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>

          {pendingDeliveries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '500' }}>
                {lang === 'ta' ? 'நிலுவை விநியோகங்கள் எதுவும் இல்லை!' : 'All clear! No pending deliveries'}
              </p>
              <p style={{ fontSize: '0.78rem' }}>
                {lang === 'ta' ? 'அனைத்து ஆர்டர்களும் வெற்றிகரமாக அனுப்பப்பட்டுள்ளன.' : 'All customer orders are dispatched or fulfilled.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '340px', overflowY: 'auto' }}>
              {pendingDeliveries.slice(0, 5).map((o) => {
                const shop = shops.find(s => s.id === o.shop_id);
                const route = routes.find(r => r.id === o.route_id);
                const shopName = translateShopName(shop, lang) || 'Outlet';
                const routeName = translateRouteName(route, lang) || 'Route';

                return (
                  <div
                    key={o.id}
                    onClick={() => onNavigate && onNavigate('deliveries', 'pending', null, o.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.65rem 0.85rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.86rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shopName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {routeName} • <span style={{ fontFamily: 'monospace' }}>{o.invoice_number}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                        ₹{(o.net_amount || 0).toLocaleString()}
                      </div>
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        {lang === 'ta' ? 'நிலுவை' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Stock Attention & Route Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Stock Alerts Card */}
          {totalStockAlerts > 0 && (
            <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '10px', borderLeft: '3px solid var(--danger)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <AlertTriangle size={16} />
                  <span>{lang === 'ta' ? 'சரக்கு இருப்பு எச்சரிக்கை' : 'Stock Attention Required'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('purchases')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  {lang === 'ta' ? '+ கொள்முதல் செய்' : '+ Log Purchase'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '140px', overflowY: 'auto' }}>
                {outOfStockProds.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize: '0.78rem', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{lang === 'ta' ? (p.name_ta || p.name_en) : p.name_en} ({p.size})</span>
                    <strong>{lang === 'ta' ? 'இருப்பில்லை (0)' : 'Out of Stock (0)'}</strong>
                  </div>
                ))}
                {lowStockProds.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{lang === 'ta' ? (p.name_ta || p.name_en) : p.name_en} ({p.size})</span>
                    <span>{p.current_stock_bottles} {lang === 'ta' ? 'பாட்டில்கள்' : 'left'} (min: {p.min_stock})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Performance Snapshot */}
          <div className="glass-card" style={{ padding: '1.25rem', borderRadius: '10px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>
                {lang === 'ta' ? 'வழித்தட விற்பனை சுருக்கம்' : 'Route-wise Sales Overview'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {routeStats.length} {lang === 'ta' ? 'வழிகள்' : 'active routes'}
              </span>
            </div>

            {routeStats.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                {lang === 'ta' ? 'விற்பனை விவரங்கள் இல்லை' : 'No route order data yet'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {routeStats.slice(0, 4).map(rs => {
                  const pct = Math.round((rs.amount / maxRouteAmount) * 100);
                  return (
                    <div
                      key={rs.id}
                      onClick={() => onNavigate && onNavigate('deliveries', null, rs.id)}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: '500' }}>{rs.name}</span>
                        <span style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>
                          ₹{rs.amount.toLocaleString()} ({rs.count} {lang === 'ta' ? 'ஆர்டர்கள்' : 'orders'})
                        </span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'var(--accent-cyan)',
                            borderRadius: '999px'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
