import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  PackagePlus,
  Boxes,
  Layers,
  Tag,
  Users,
  Store,
  MapPin,
  Truck,
  CalendarCheck,
  PackageCheck,
  BarChart3,
  FileText,
  Settings,
  Building2,
  UserCheck,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  PanelLeftClose,
  PanelLeft,
  Receipt,
  Banknote
} from 'lucide-react';

export function hasPermission(session, permissionId) {
  if (!session) return false;
  if (session.role === 'superadmin') return true;
  if (session.role === 'admin') return true;

  if (permissionId === 'admin') {
    return session.role === 'admin';
  }

  if (session.permissions && Array.isArray(session.permissions)) {
    return session.permissions.includes(permissionId);
  }

  // Role defaults
  if (session.role === 'salesman') {
    const perms = ['dashboard', 'shops', 'stock', 'orders', 'deliveries', 'outstanding_collection', 'vehicle_sales'];
    return perms.includes(permissionId);
  }
  if (session.role === 'delivery') {
    const perms = ['dashboard', 'deliveries'];
    return perms.includes(permissionId);
  }

  return permissionId === 'dashboard';
}

export default function Sidebar({
  session,
  activeTab,
  orderTakingSubTab,
  onSelectTab,
  lang,
  t,
  menuHidden,
  setMenuHidden,
  isCompact,
  setIsCompact,
  pendingDeliveriesCount = 0,
  stockAlertsCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMenuId, setExpandedMenuId] = useState(null);

  // The 8 Main Menu Headers with submenus
  const menuConfig = useMemo(() => [
    {
      id: 'dashboard',
      labelEn: 'Dashboard',
      labelTa: 'டாஷ்போர்டு',
      icon: LayoutDashboard,
      tab: 'dashboard',
      direct: true,
      permission: 'dashboard'
    },
    {
      id: 'sales',
      labelEn: 'Sales',
      labelTa: 'விற்பனை',
      icon: ShoppingCart,
      submenus: [
        {
          id: 'orders_regular',
          tab: 'orders',
          subTab: 'regular',
          labelEn: 'Regular Order',
          labelTa: 'வழக்கமான ஆர்டர்',
          icon: ShoppingBag,
          permission: 'orders'
        },
        {
          id: 'orders_rough',
          tab: 'orders',
          subTab: 'rough_bill',
          labelEn: 'Rough Bill (Walk-in)',
          labelTa: 'ரஃப் பில் (Rough Bill)',
          icon: Receipt,
          permission: 'orders'
        },
        {
          id: 'vehicle_sales',
          tab: 'vehicle_sales',
          labelEn: 'Vehicle Direct Sales',
          labelTa: 'நேரடி வண்டி விற்பனை',
          icon: Truck,
          permission: 'vehicle_sales'
        },
        {
          id: 'outstanding_collection',
          tab: 'outstanding_collection',
          labelEn: 'Outstanding Collection',
          labelTa: 'நிலுவைத் தொகை வசூல்',
          icon: Banknote,
          permission: 'outstanding_collection'
        }
      ]
    },
    {
      id: 'purchases',
      labelEn: 'Purchases',
      labelTa: 'கொள்முதல்',
      icon: ShoppingBag,
      submenus: [
        {
          id: 'purchases_entry',
          tab: 'purchases',
          labelEn: 'Purchase Entry',
          labelTa: 'கொள்முதல் பதிவு',
          icon: PackagePlus,
          permission: 'purchases'
        }
      ]
    },
    {
      id: 'inventory',
      labelEn: 'Inventory',
      labelTa: 'சரக்கு இருப்பு',
      icon: Boxes,
      badge: stockAlertsCount > 0 ? stockAlertsCount : null,
      submenus: [
        {
          id: 'stock_ledger',
          tab: 'stock',
          labelEn: 'Stock Ledger',
          labelTa: 'சரக்கு பதிவேடு',
          icon: Layers,
          permission: 'stock'
        },
        {
          id: 'products',
          tab: 'products',
          labelEn: 'Products Catalog',
          labelTa: 'பொருட்கள் மேலாண்மை',
          icon: Tag,
          permission: 'products'
        }
      ]
    },
    {
      id: 'customers',
      labelEn: 'Customers',
      labelTa: 'வாடிக்கையாளர்கள்',
      icon: Users,
      submenus: [
        {
          id: 'shops',
          tab: 'shops',
          labelEn: 'Shops & Outlets',
          labelTa: 'கடைகள் மேலாண்மை',
          icon: Store,
          permission: 'shops'
        },
        {
          id: 'routes',
          tab: 'routes',
          labelEn: 'Delivery Routes',
          labelTa: 'வழிகள் மேலாண்மை',
          icon: MapPin,
          permission: 'routes'
        }
      ]
    },
    {
      id: 'deliveries',
      labelEn: 'Deliveries',
      labelTa: 'விநியோகம்',
      icon: Truck,
      badge: pendingDeliveriesCount > 0 ? pendingDeliveriesCount : null,
      submenus: [
        {
          id: 'deliveries_tasks',
          tab: 'deliveries',
          labelEn: 'Deliveries',
          labelTa: 'விநியோகம்',
          icon: CalendarCheck,
          permission: 'deliveries'
        },
        {
          id: 'vehicle_loading',
          tab: 'vehicle_loading',
          labelEn: 'Vehicle Loading',
          labelTa: 'வண்டி ஏற்றுதல்',
          icon: PackageCheck,
          permission: 'vehicle_loading'
        }
      ]
    },
    {
      id: 'reports',
      labelEn: 'Reports',
      labelTa: 'அறிக்கைகள்',
      icon: BarChart3,
      submenus: [
        {
          id: 'all_reports',
          tab: 'reports',
          labelEn: 'Reports & Analytics',
          labelTa: 'அனைத்து அறிக்கைகள்',
          icon: FileText,
          permission: 'reports'
        }
      ]
    },
    {
      id: 'settings',
      labelEn: 'Settings',
      labelTa: 'அமைப்புகள்',
      icon: Settings,
      submenus: [
        {
          id: 'agency_settings',
          tab: 'settings',
          labelEn: 'Agency Profile & UPI',
          labelTa: 'நிறுவன விவரங்கள்',
          icon: Building2,
          permission: 'admin'
        },
        {
          id: 'users',
          tab: 'users',
          labelEn: 'Staff Access & Roles',
          labelTa: 'பணியாளர்கள் மேலாண்மை',
          icon: UserCheck,
          permission: 'users'
        },
        {
          id: 'recycle_bin',
          tab: 'recycle_bin',
          labelEn: 'Recycle Bin',
          labelTa: 'குப்பைத் தொட்டி',
          icon: Trash2,
          permission: 'recycle_bin'
        }
      ]
    }
  ], [stockAlertsCount, pendingDeliveriesCount]);

  // Filter based on role permissions
  const visibleMenus = useMemo(() => {
    return menuConfig
      .map(menu => {
        if (menu.direct) {
          const hasAcc = hasPermission(session, menu.permission);
          return hasAcc ? menu : null;
        }

        // Filter submenus
        const permittedSubmenus = (menu.submenus || []).filter(sub => hasPermission(session, sub.permission));
        if (permittedSubmenus.length === 0) return null;

        return {
          ...menu,
          submenus: permittedSubmenus
        };
      })
      .filter(Boolean);
  }, [menuConfig, session]);

  // Find parent menu for active tab
  useEffect(() => {
    if (activeTab === 'dashboard') {
      setExpandedMenuId(null);
      return;
    }

    for (const menu of visibleMenus) {
      if (menu.submenus) {
        const found = menu.submenus.some(sub => {
          if (sub.tab === activeTab) {
            if (activeTab === 'orders' && sub.subTab) {
              return sub.subTab === orderTakingSubTab;
            }
            return true;
          }
          return false;
        });
        if (found) {
          setExpandedMenuId(menu.id);
          break;
        }
      }
    }
  }, [activeTab, orderTakingSubTab, visibleMenus]);

  // Filter searchable submenus
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];

    const results = [];
    visibleMenus.forEach(menu => {
      if (menu.direct) {
        if (
          menu.labelEn.toLowerCase().includes(q) ||
          menu.labelTa.toLowerCase().includes(q)
        ) {
          results.push({
            id: menu.id,
            parentLabel: '',
            label: lang === 'ta' ? menu.labelTa : menu.labelEn,
            icon: menu.icon,
            tab: menu.tab,
            subTab: null
          });
        }
      } else if (menu.submenus) {
        menu.submenus.forEach(sub => {
          const pLabel = lang === 'ta' ? menu.labelTa : menu.labelEn;
          const sLabel = lang === 'ta' ? sub.labelTa : sub.labelEn;
          if (
            sLabel.toLowerCase().includes(q) ||
            sub.labelEn.toLowerCase().includes(q) ||
            pLabel.toLowerCase().includes(q)
          ) {
            results.push({
              id: `${menu.id}_${sub.id}`,
              parentLabel: pLabel,
              label: sLabel,
              icon: sub.icon,
              tab: sub.tab,
              subTab: sub.subTab,
              menuId: menu.id
            });
          }
        });
      }
    });
    return results;
  }, [searchQuery, visibleMenus, lang]);

  const handleMenuClick = (menu) => {
    if (menu.direct) {
      setExpandedMenuId(null);
      onSelectTab(menu.tab);
      if (window.innerWidth <= 768) setMenuHidden(true);
      return;
    }

    // Toggle menu accordion (allow only one expanded at a time)
    if (expandedMenuId === menu.id) {
      setExpandedMenuId(null);
    } else {
      setExpandedMenuId(menu.id);
      // If it only has 1 submenu, automatically navigate to it for single-click ease
      if (menu.submenus && menu.submenus.length === 1) {
        const single = menu.submenus[0];
        onSelectTab(single.tab, single.subTab);
        if (window.innerWidth <= 768) setMenuHidden(true);
      }
    }
  };

  const handleSubmenuClick = (sub, parentMenuId) => {
    setExpandedMenuId(parentMenuId);
    onSelectTab(sub.tab, sub.subTab);
    if (window.innerWidth <= 768) setMenuHidden(true);
  };

  const handleSearchResultClick = (item) => {
    if (item.menuId) {
      setExpandedMenuId(item.menuId);
    } else {
      setExpandedMenuId(null);
    }
    onSelectTab(item.tab, item.subTab);
    setSearchQuery('');
    if (window.innerWidth <= 768) setMenuHidden(true);
  };

  // Determine if a main menu header is currently active
  const isMenuSectionActive = (menu) => {
    if (menu.direct) return activeTab === menu.tab;
    return (menu.submenus || []).some(sub => {
      if (sub.tab === activeTab) {
        if (activeTab === 'orders' && sub.subTab) {
          return sub.subTab === orderTakingSubTab;
        }
        return true;
      }
      return false;
    });
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {!menuHidden && (
        <div
          className="sidebar-backdrop-mobile no-print"
          onClick={() => setMenuHidden(true)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9998
          }}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`app-sidebar no-print ${menuHidden ? 'mobile-hidden' : ''} ${isCompact ? 'compact' : ''}`}
        style={{
          width: isCompact ? '68px' : '240px',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-color)',
          background: 'var(--bg-sidebar)',
          backdropFilter: 'blur(10px)',
          userSelect: 'none',
          zIndex: 9999
        }}
      >
        {/* Sidebar Header / Quick Action */}
        <div
          style={{
            padding: isCompact ? '0.75rem 0.5rem' : '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCompact ? 'center' : 'space-between',
            borderBottom: '1px solid var(--border-color)',
            minHeight: '52px'
          }}
        >
          {!isCompact && (
            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              {lang === 'ta' ? 'முதன்மை மெனு' : 'Navigation'}
            </span>
          )}

          {/* Compact Toggle Button (Desktop) */}
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={() => setIsCompact(!isCompact)}
            title={isCompact ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.3rem',
              borderRadius: '6px',
              transition: 'var(--transition)'
            }}
          >
            {isCompact ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Quick Menu Search (Shown when not compact) */}
        {!isCompact && (
          <div style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid var(--border-color)' }}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-search, rgba(255, 255, 255, 0.04))',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0 0.5rem'
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder={lang === 'ta' ? 'தேடுக...' : 'Quick search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  padding: '0.45rem 0.4rem',
                  fontFamily: 'inherit'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Menus List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isCompact ? '0.5rem 0.35rem' : '0.65rem 0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem'
          }}
        >
          {/* If Search is Active */}
          {searchQuery ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.25rem 0.5rem', fontWeight: '600' }}>
                {searchResults.length > 0 
                  ? `${searchResults.length} ${lang === 'ta' ? 'முடிவுகள்' : 'results'}`
                  : (lang === 'ta' ? 'முடிவுகள் இல்லை' : 'No menus found')}
              </div>
              {searchResults.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSearchResultClick(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      border: '1px solid transparent',
                      borderRadius: '6px',
                      background: 'rgba(6, 182, 212, 0.05)',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <ItemIcon size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {item.label}
                      </span>
                      {item.parentLabel && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.parentLabel}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // Normal 8 Main Menu Headers
            visibleMenus.map((menu) => {
              const MenuIcon = menu.icon;
              const isSectionActive = isMenuSectionActive(menu);
              const isExpanded = expandedMenuId === menu.id;
              const hasSubmenus = !menu.direct && menu.submenus && menu.submenus.length > 0;
              const label = lang === 'ta' ? menu.labelTa : menu.labelEn;

              return (
                <div key={menu.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Main Menu Button */}
                  <button
                    type="button"
                    onClick={() => handleMenuClick(menu)}
                    title={isCompact ? label : undefined}
                    className={`menu-header-btn ${isSectionActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCompact ? 'center' : 'space-between',
                      width: '100%',
                      padding: isCompact ? '0.65rem 0' : '0.55rem 0.75rem',
                      borderRadius: '8px',
                      background: isSectionActive
                        ? 'rgba(6, 182, 212, 0.12)'
                        : isExpanded
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'transparent',
                      border: isSectionActive
                        ? '1px solid rgba(6, 182, 212, 0.3)'
                        : '1px solid transparent',
                      color: isSectionActive ? 'var(--text-main)' : 'var(--text-muted)',
                      fontWeight: isSectionActive ? '600' : '500',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? '0' : '0.65rem', overflow: 'hidden' }}>
                      <MenuIcon
                        size={17}
                        style={{
                          color: isSectionActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                          flexShrink: 0
                        }}
                      />
                      {!isCompact && (
                        <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {label}
                        </span>
                      )}
                    </div>

                    {/* Right side indicators (Only shown when not compact) */}
                    {!isCompact && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {menu.badge && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              background: 'var(--accent-cyan)',
                              color: '#000',
                              fontWeight: '700'
                            }}
                          >
                            {menu.badge}
                          </span>
                        )}
                        {hasSubmenus && (
                          <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Submenus (Only displayed when expanded, and not compact) */}
                  {!isCompact && hasSubmenus && isExpanded && (
                    <div
                      className="submenu-container"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        paddingLeft: '1.4rem',
                        margin: '3px 0 6px 0',
                        borderLeft: '2px solid rgba(6, 182, 212, 0.25)',
                        marginLeft: '1rem'
                      }}
                    >
                      {menu.submenus.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive =
                          sub.tab === activeTab &&
                          (activeTab !== 'orders' || !sub.subTab || sub.subTab === orderTakingSubTab);
                        const subLabel = lang === 'ta' ? sub.labelTa : sub.labelEn;

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSubmenuClick(sub, menu.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              width: '100%',
                              padding: '0.42rem 0.6rem',
                              borderRadius: '6px',
                              background: isSubActive ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                              border: '1px solid transparent',
                              color: isSubActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                              fontWeight: isSubActive ? '600' : '400',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <SubIcon size={14} style={{ flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {subLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* User Role Footer in Sidebar */}
        <div
          style={{
            padding: isCompact ? '0.65rem 0.25rem' : '0.65rem 0.85rem',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            textAlign: isCompact ? 'center' : 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCompact ? 'center' : 'space-between'
          }}
        >
          {!isCompact ? (
            <div>
              <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'block' }}>
                {session?.name || session?.username}
              </span>
              <span style={{ textTransform: 'capitalize' }}>
                {t(session?.role) || session?.role}
              </span>
            </div>
          ) : (
            <span style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>
              {(session?.name || session?.username || 'U')[0].toUpperCase()}
            </span>
          )}
        </div>
      </aside>
    </>
  );
}

