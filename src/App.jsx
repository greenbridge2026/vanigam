import React, { useState, useEffect } from 'react';
import { translations } from './translations';
import api from './api';

// Components
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import RouteMgr from './components/RouteMgr';
import ShopMgr from './components/ShopMgr';
import ProductMgr from './components/ProductMgr';
import PurchaseMgr from './components/PurchaseMgr';
import StockMgr from './components/StockMgr';
import OrderTaking from './components/OrderTaking';
import DeliveryMgr from './components/DeliveryMgr';
import Reports from './components/Reports';
import Billing from './components/Billing';
import VehicleLoading from './components/VehicleLoading';
import UserMgr from './components/UserMgr';
import RecycleBin from './components/RecycleBin';
import VehicleDirectSales from './components/VehicleDirectSales';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import BulkPrintLayout from './components/BulkPrintLayout';
import OutstandingCollection from './components/OutstandingCollection';

function formatNotificationTime(dateStr, lang = 'en') {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = Math.max(0, now - date);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let relative = '';
  if (diffSec < 45) {
    relative = lang === 'ta' ? 'இப்பொழுது' : 'Just now';
  } else if (diffMin < 60) {
    relative = lang === 'ta' ? `${diffMin} நிமிடங்களுக்கு முன்` : `${diffMin}m ago`;
  } else if (diffHour < 24) {
    relative = lang === 'ta' ? `${diffHour} மணி நேரத்திற்கு முன்` : `${diffHour}h ago`;
  } else {
    relative = lang === 'ta' ? `${diffDay} நாட்களுக்கு முன்` : `${diffDay}d ago`;
  }

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const isToday = date.toDateString() === now.toDateString();
  const dateFormatted = isToday ? (lang === 'ta' ? 'இன்று' : 'Today') : date.toLocaleDateString();

  return `${relative} • ${dateFormatted} ${timeString}`;
}

const sortNotifications = (list) => {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
};

export default function App() {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('lang') || 'en';
  });
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('session');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || (session?.role === 'delivery' ? 'deliveries' : 'dashboard');
  });
  const [selectedOrderId, setSelectedOrderId] = useState(() => {
    return localStorage.getItem('selectedOrderId') || null;
  });
  const [editingOrder, setEditingOrder] = useState(() => {
    const saved = localStorage.getItem('editingOrder');
    return saved ? JSON.parse(saved) : null;
  });
  const [bulkPrintOrderIds, setBulkPrintOrderIds] = useState(() => {
    const saved = localStorage.getItem('bulkPrintOrderIds');
    return saved ? JSON.parse(saved) : null;
  });
  const [menuHidden, setMenuHidden] = useState(() => window.innerWidth <= 768);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({
    company_name: "GSK Agency",
    company_address: "Cooldrinks Shop - Tindivanam",
    company_gst: "33CWRPK4071L1Z2",
    upi_mobile: "gskumar9345@okicici"
  });

  useEffect(() => {
    async function loadSettings() {
      if (!session) return;
      try {
        const data = await api.getSettings();
        if (data) {
          setSettings(data);
          if (data.company_name) document.title = data.company_name;
        }
      } catch (err) {
        console.error('Failed to load settings in App:', err);
      }
    }
    loadSettings();
  }, [session]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  useEffect(() => {
    if (session) {
      localStorage.setItem('session', JSON.stringify(session));
      localStorage.setItem('tenantId', session.tenantId);
    } else {
      localStorage.removeItem('session');
    }
  }, [session]);

  useEffect(() => {
    if (activeTab) localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedOrderId) {
      localStorage.setItem('selectedOrderId', selectedOrderId);
    } else {
      localStorage.removeItem('selectedOrderId');
    }
  }, [selectedOrderId]);

  useEffect(() => {
    if (editingOrder) {
      localStorage.setItem('editingOrder', JSON.stringify(editingOrder));
    } else {
      localStorage.removeItem('editingOrder');
    }
  }, [editingOrder]);

  useEffect(() => {
    if (bulkPrintOrderIds) {
      localStorage.setItem('bulkPrintOrderIds', JSON.stringify(bulkPrintOrderIds));
    } else {
      localStorage.removeItem('bulkPrintOrderIds');
    }
  }, [bulkPrintOrderIds]);

  // Theme state defaulting to light theme
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (session) {
      let unsubscribe = null;
      let pollingTimer = null;

      const setupRealtimeNotifications = async () => {
        try {
          const { db, isFirebaseConfigured } = await import('./firebase');
          const { doc, onSnapshot } = await import('firebase/firestore');

          if (isFirebaseConfigured && db) {
            unsubscribe = onSnapshot(doc(db, 'tenants', session.tenantId || 'default', 'tables', 'notifications'), (docSnap) => {
              if (docSnap.exists()) {
                const raw = docSnap.data().data || [];
                setNotifications(sortNotifications(raw));
              } else {
                setNotifications([]);
              }
            }, (err) => {
              console.warn('Firestore notifications listener failed, falling back to polling:', err);
              startPolling();
            });
          } else {
            startPolling();
          }
        } catch (err) {
          console.warn('Failed to setup Firebase real-time notifications, falling back to polling:', err);
          startPolling();
        }
      };

      const startPolling = () => {
        loadNotifications();
        pollingTimer = setInterval(loadNotifications, 8000);
      };

      setupRealtimeNotifications();

      return () => {
        if (unsubscribe) unsubscribe();
        if (pollingTimer) clearInterval(pollingTimer);
      };
    }
  }, [session]);

  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    if (session) {
      setCurrentUserName(session.name || session.username);
    } else {
      setCurrentUserName('');
    }
  }, [session]);

  // Real-time synchronization of logged-in user's name
  useEffect(() => {
    if (session && session.role !== 'superadmin') {
      let unsubscribe = null;
      let pollingTimer = null;

      const syncUserSession = (usersList) => {
        const currentUser = usersList.find(u => u.id === session.id);
        if (currentUser) {
          if (currentUser.active === false) {
            alert('Your account has been deactivated. Logging out / உங்கள் கணக்கு முடக்கப்பட்டுள்ளது.');
            setSession(null);
            setActiveTab('dashboard');
            setSelectedOrderId(null);
            return;
          }

          const userPerms = currentUser.permissions || [];
          const sessPerms = session.permissions || [];
          const permsChanged = JSON.stringify([...userPerms].sort()) !== JSON.stringify([...sessPerms].sort());

          if (
            currentUser.name !== session.name ||
            currentUser.role !== session.role ||
            permsChanged
          ) {
            setSession(prev => {
              const updated = {
                ...prev,
                name: currentUser.name,
                role: currentUser.role,
                permissions: userPerms
              };
              localStorage.setItem('session', JSON.stringify(updated));
              return updated;
            });
            setCurrentUserName(currentUser.name);
          }
        }
      };

      const setupRealtimeUsers = async () => {
        try {
          const { db, isFirebaseConfigured } = await import('./firebase');
          const { doc, onSnapshot } = await import('firebase/firestore');

          if (isFirebaseConfigured && db) {
            unsubscribe = onSnapshot(doc(db, 'tenants', session.tenantId || 'default', 'tables', 'users'), (docSnap) => {
              if (docSnap.exists()) {
                syncUserSession(docSnap.data().data || []);
              }
            }, (err) => {
              console.warn('Firestore users listener failed, falling back to polling:', err);
              startPolling();
            });
          } else {
            startPolling();
          }
        } catch (err) {
          console.warn('Failed to setup Firebase real-time users, falling back to polling:', err);
          startPolling();
        }
      };

      const startPolling = () => {
        const poll = async () => {
          try {
            const usersList = await api.getUsers();
            syncUserSession(usersList);
          } catch (err) {
            console.error('Error polling users', err);
          }
        };
        poll();
        pollingTimer = setInterval(poll, 8000);
      };

      setupRealtimeUsers();

      return () => {
        if (unsubscribe) unsubscribe();
        if (pollingTimer) clearInterval(pollingTimer);
      };
    }
  }, [session]);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(sortNotifications(data));
    } catch (err) {
      console.error('Error fetching notifications', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.markNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, status: 'read' })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (n) => {
    setShowNotifications(false);

    // Mark as read in state & server
    if (n.status === 'unread') {
      try {
        await api.markNotificationsRead();
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, status: 'read' } : item));
      } catch (e) {
        console.warn('Error marking notification read:', e);
      }
    }

    const msg = (n.message_en || n.message_ta || '').toLowerCase();
    const type = n.type || '';

    // Extract invoice number (e.g., INV-1001, INV-1002) or order ID from notification
    const invMatch = (n.message_en || '').match(/INV-\d+/i) || (n.message_ta || '').match(/INV-\d+/i);
    const targetInvoice = invMatch ? invMatch[0].toUpperCase() : null;
    const targetOrderId = n.order_id || null;

    try {
      const allOrders = await api.getOrders();
      const matchedOrder = (allOrders || []).find(o =>
        (targetInvoice && o.invoice_number && o.invoice_number.toUpperCase() === targetInvoice) ||
        (targetOrderId && o.id === targetOrderId)
      );

      if (matchedOrder) {
        setSelectedOrderId(matchedOrder.id);
        setActiveTab('billing');
        return;
      }
    } catch (err) {
      console.warn('Failed to load orders for notification click:', err);
    }

    // Route to respective module fallback
    if (type === 'pending_delivery' || msg.includes('delivery') || msg.includes('invoice') || msg.includes('order')) {
      if (msg.includes('pending') || type === 'pending_delivery') {
        localStorage.setItem('deliveryStatusFilter', 'pending');
      }
      setActiveTab('deliveries');
    } else if (type === 'stock_refill' || msg.includes('stock') || msg.includes('refill')) {
      setActiveTab('stock');
    } else if (type === 'payment' || msg.includes('paid') || msg.includes('collection') || msg.includes('outstanding')) {
      setActiveTab('outstanding_collection');
    } else if (msg.includes('purchase')) {
      setActiveTab('purchases');
    } else if (msg.includes('vehicle')) {
      setActiveTab('vehicle_loading');
    } else if (msg.includes('shop')) {
      setActiveTab('shops');
    } else if (msg.includes('route')) {
      setActiveTab('routes');
    } else {
      setActiveTab('deliveries');
    }
  };

  // Translation helper
  const t = (key) => {
    return translations[lang][key] || key;
  };

  const handleLogout = () => {
    setSession(null);
    setActiveTab('dashboard');
    setSelectedOrderId(null);
  };

  if (!session) {
    return (
      <Login
        setSession={setSession}
        t={t}
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={setLang}
      />
    );
  }

  // Sidebar link details
  const getSidebarLinks = () => {
    const role = session.role;
    if (role === 'superadmin') {
      return [{ id: 'dashboard', label: 'Super Admin', icon: '👑' }];
    }

    const allLinks = [
      { id: 'dashboard', label: t('dashboard'), icon: '📊' },
      { id: 'routes', label: t('route_mgmt'), icon: '🗺️' },
      { id: 'shops', label: t('shop_mgmt'), icon: '🏢' },
      { id: 'products', label: t('product_mgmt'), icon: '🥤' },
      { id: 'purchases', label: t('purchase_entry'), icon: '📥' },
      { id: 'stock', label: t('stock_ledger'), icon: '📈' },
      { id: 'orders', label: t('order_taking'), icon: '🛒' },
      { id: 'deliveries', label: t('deliveries'), icon: '🚚' },
      { id: 'vehicle_loading', label: lang === 'ta' ? 'வண்டி ஏற்றுதல்' : 'Vehicle Loading', icon: '📦' },
      { id: 'outstanding_collection', label: t('outstanding_collection'), icon: '💵' },
      { id: 'vehicle_sales', label: t('vehicle_direct_sales'), icon: '🚛' },
      { id: 'reports', label: t('reports'), icon: '📈' },
      { id: 'users', label: t('staff_mgmt'), icon: '👥' },
      { id: 'recycle_bin', label: t('recycle_bin'), icon: '♻️' }
    ];

    const permissions = session.permissions;
    if (permissions && Array.isArray(permissions)) {
      return allLinks.filter(link => permissions.includes(link.id));
    }

    // Legacy fallback based on role
    const links = [{ id: 'dashboard', label: t('dashboard'), icon: '📊' }];
    if (role === 'admin') {
      links.push(...allLinks.slice(1));
    } else if (role === 'salesman') {
      links.push(
        { id: 'shops', label: t('shop_mgmt'), icon: '🏢' },
        { id: 'stock', label: t('stock_ledger'), icon: '📈' },
        { id: 'orders', label: t('order_taking'), icon: '🛒' },
        { id: 'deliveries', label: t('deliveries'), icon: '🚚' },
        { id: 'outstanding_collection', label: t('outstanding_collection'), icon: '💵' },
        { id: 'vehicle_sales', label: t('vehicle_direct_sales'), icon: '🚛' }
      );
    } else if (role === 'delivery') {
      links.push(
        { id: 'deliveries', label: t('deliveries'), icon: '🚚' }
      );
    }

    return links;
  };

  // Handle invoice display redirection
  const handleOrderCreated = (orderId) => {
    setSelectedOrderId(orderId);
    setActiveTab('billing');
  };

  const handleViewBillFromDelivery = (orderId) => {
    setSelectedOrderId(orderId);
    setActiveTab('billing');
  };

  // Content switching switcher
  const renderContent = () => {
    // Page level permission check
    if (session.role !== 'superadmin' && activeTab !== 'dashboard' && activeTab !== 'billing') {
      const permissions = session.permissions;
      if (permissions && Array.isArray(permissions) && !permissions.includes(activeTab)) {
        return (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>🚫 Access Denied / அனுமதி மறுக்கப்பட்டது</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              You do not have permission to access this module. Please contact Super Admin.
            </p>
          </div>
        );
      }
    }

    if (bulkPrintOrderIds && bulkPrintOrderIds.length > 0) {
      return (
        <BulkPrintLayout
          orderIds={bulkPrintOrderIds}
          t={t}
          lang={lang}
          onBack={() => setBulkPrintOrderIds(null)}
        />
      );
    }

    if (activeTab === 'billing' && selectedOrderId) {
      return (
        <Billing
          orderId={selectedOrderId}
          t={t}
          lang={lang}
          onBack={() => {
            setSelectedOrderId(null);
            setActiveTab(session.role === 'delivery' ? 'deliveries' : 'dashboard');
          }}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        if (session.role === 'superadmin') return <SuperAdminDashboard t={t} lang={lang} />;
        return (
          <Dashboard
            t={t}
            lang={lang}
            onNavigate={(tab, status = null, routeId = null, selectOrderId = null) => {
              if (tab === 'deliveries') {
                if (status) localStorage.setItem('deliveryStatusFilter', status);
                if (routeId) localStorage.setItem('deliveryRouteFilter', routeId);
                if (selectOrderId) localStorage.setItem('deliverySelectOrderId', selectOrderId);
              }
              setActiveTab(tab);
            }}
          />
        );
      case 'routes':
        return <RouteMgr t={t} lang={lang} />;
      case 'shops':
        return <ShopMgr t={t} lang={lang} onBillSelected={handleViewBillFromDelivery} />;
      case 'products':
        return <ProductMgr t={t} lang={lang} />;
      case 'purchases':
        return <PurchaseMgr t={t} lang={lang} />;
      case 'stock':
        return <StockMgr t={t} lang={lang} />;
      case 'orders':
        return (
          <OrderTaking
            t={t}
            lang={lang}
            editingOrder={editingOrder}
            onOrderCreated={handleOrderCreated}
            onOrderUpdated={() => {
              setEditingOrder(null);
              setActiveTab('deliveries');
            }}
            onCancelEdit={() => {
              setEditingOrder(null);
              setActiveTab('deliveries');
            }}
          />
        );
      case 'deliveries':
        return (
          <DeliveryMgr
            t={t}
            lang={lang}
            onBillSelected={handleViewBillFromDelivery}
            session={session}
            onBulkPrint={(ids) => setBulkPrintOrderIds(ids)}
            onEditOrder={(order) => {
              setEditingOrder(order);
              setActiveTab('orders');
            }}
          />
        );
      case 'vehicle_loading':
        return <VehicleLoading t={t} lang={lang} session={session} />;
      case 'reports':
        return <Reports t={t} lang={lang} onBillSelected={handleViewBillFromDelivery} session={session} />;
      case 'users':
        return <UserMgr t={t} lang={lang} />;
      case 'recycle_bin':
        return <RecycleBin t={t} lang={lang} />;
      case 'outstanding_collection':
        return <OutstandingCollection t={t} lang={lang} />;
      case 'vehicle_sales':
        return <VehicleDirectSales t={t} lang={lang} onBillSelected={handleViewBillFromDelivery} />;
      default:
        return <Dashboard t={t} lang={lang} />;
    }
  };

  const unreadNotifications = notifications.filter(n => n.status === 'unread');

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar no-print">
        <div className="brand">
          <button className="menu-toggle-btn" onClick={() => setMenuHidden(!menuHidden)} title="Toggle Menu">
            ☰
          </button>
          <span>{t('title')}</span>
        </div>

        <div className="nav-controls">
          {/* Theme Toggle */}
          <button className="theme-toggle-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {/* Instant Translation Switch */}
          <button className="language-btn" onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}>
            🌐 {t('switch_language')}
          </button>

          {/* User Badge */}
          <div className={`role-badge ${session.role}`}>
            {currentUserName || session.name} ({t(session.role)})
          </div>

          {/* Notification bell */}
          <div className="notification-bell" onClick={() => setShowNotifications(!showNotifications)}>
            🔔
            {unreadNotifications.length > 0 && (
              <span className="badge-count">{unreadNotifications.length}</span>
            )}
          </div>

          {/* Notifications List Popup */}
          {showNotifications && (
            <div className="notifications-popup">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🔔</span> {t('notifications')}
                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', borderRadius: '10px' }}>
                      Live Recent
                    </span>
                  </strong>
                </div>
                {unreadNotifications.length > 0 && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>
                    {t('mark_all_read')}
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>{t('no_notifications')}</p>
                ) : (
                  sortNotifications(notifications).map(n => {
                    const isUnread = n.status === 'unread';
                    let typeIcon = '🔔';
                    if (n.type === 'pending_delivery' || (n.message_en && n.message_en.includes('delivery'))) typeIcon = '📦';
                    if (n.type === 'stock_refill' || (n.message_en && n.message_en.includes('stock'))) typeIcon = '🥤';
                    if (n.type === 'payment' || (n.message_en && n.message_en.includes('Paid'))) typeIcon = '💰';

                    return (
                      <div
                        key={n.id}
                        className={`notification-item ${n.type}`}
                        onClick={() => handleNotificationClick(n)}
                        title="Click to view details / பக்கத்திற்கு செல்ல கிளிக் செய்க"
                        style={{
                          background: isUnread ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          borderLeft: isUnread ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '6px',
                          marginBottom: '0.5rem',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '1rem', marginTop: '1px' }}>{typeIcon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: isUnread ? '600' : '400', color: 'var(--text-main)', lineHeight: '1.3' }}>
                              {lang === 'ta' ? (n.message_ta || n.message_en) : (n.message_en || n.message_ta)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: isUnread ? 'var(--accent-cyan)' : 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span>⏱️</span>
                              <span>{formatNotificationTime(n.created_at, lang)}</span>
                              {isUnread && (
                                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', background: 'var(--accent-cyan)', color: '#000', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  NEW
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Settings Option */}
          {session?.role === 'admin' && (
            <button className="language-btn" onClick={() => setShowSettingsModal(true)} title="Settings" style={{ padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              ⚙️ {lang === 'ta' ? 'அமைப்புகள்' : 'Settings'}
            </button>
          )}

          {/* Logout */}
          <button className="logout-btn" onClick={handleLogout}>
            🚪 {t('logout')}
          </button>
        </div>
      </header>

      {/* Main Area */}
      <div className="workspace">
        {/* Mobile Backdrop Overlay */}
        {!menuHidden && (
          <div 
            className="sidebar-backdrop-mobile no-print" 
            onClick={() => setMenuHidden(true)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar no-print ${menuHidden ? 'hidden' : ''}`}>
          {getSidebarLinks().map(link => (
            <button
              key={link.id}
              onClick={() => {
                setActiveTab(link.id);
                setSelectedOrderId(null);
                setEditingOrder(null);
                setBulkPrintOrderIds(null);
                if (window.innerWidth <= 768) {
                  setMenuHidden(true);
                }
              }}
              className={`sidebar-link ${activeTab === link.id ? 'active' : ''}`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          ))}
        </aside>

        {/* Dynamic Panels */}
        <main className="main-content">
          {renderContent()}
        </main>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="glass-card modal-card" style={{ maxWidth: '500px', width: '95%', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                ⚙️ {lang === 'ta' ? 'அமைப்புகள்' : 'Billing & Agency Settings'}
              </h2>
              <button 
                type="button" 
                onClick={() => setShowSettingsModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Company Name / நிறுவனத்தின் பெயர்</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={settings.company_name} 
                  onChange={e => setSettings({ ...settings, company_name: e.target.value })} 
                  placeholder="e.g. GSK Agency"
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Company Address / முகவரி</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={settings.company_address} 
                  onChange={e => setSettings({ ...settings, company_address: e.target.value })} 
                  placeholder="e.g. Cooldrinks Shop - Tindivanam"
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Company GSTIN / ஜிஎஸ்டி எண்</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={settings.company_gst} 
                  onChange={e => setSettings({ ...settings, company_gst: e.target.value })} 
                  placeholder="e.g. 33CWRPK4071L1Z2"
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>UPI Mobile No / யூபிஐ மொபைல் எண்</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={settings.upi_mobile} 
                  onChange={e => setSettings({ ...settings, upi_mobile: e.target.value })} 
                  placeholder="e.g. 9345463415"
                  style={{ width: '100%', marginTop: '0.25rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowSettingsModal(false)}
              >
                {lang === 'ta' ? 'ரத்து செய்' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await api.updateSettings(settings);
                    if (settings.company_name) document.title = settings.company_name;
                    alert(lang === 'ta' ? 'அமைப்புகள் வெற்றிகரமாகச் சேமிக்கப்பட்டன!' : 'Settings successfully updated! / அமைப்புகள் புதுப்பிக்கப்பட்டது!');
                    setShowSettingsModal(false);
                  } catch (err) {
                    alert('Failed to save settings: ' + err.message);
                  }
                }}
              >
                {lang === 'ta' ? 'சேமி' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
