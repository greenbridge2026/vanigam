import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function ShopMgr({ t, lang, onBillSelected }) {
  const [shops, setShops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [editingShop, setEditingShop] = useState(null);
  const [filterRoute, setFilterRoute] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopForBills, setSelectedShopForBills] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [shopType, setShopType] = useState('retail');
  const [routeId, setRouteId] = useState('');
  const [status, setStatus] = useState('active');
  const [outstanding, setOutstanding] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [sData, rData, oData] = await Promise.all([
          api.getShops(),
          api.getRoutes(),
          api.getOrders()
        ]);
        setShops(sData);
        setRoutes(rData);
        setOrders(oData);
      } catch (err) {
        console.error('Failed to load shop/route/order lists', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name_en: nameEn,
      name_ta: nameTa,
      contact_person: contactPerson,
      mobile,
      gst_number: gstNumber,
      address,
      shop_type: shopType,
      route_id: routeId,
      status,
      outstanding_amount: Number(outstanding || 0)
    };

    try {
      if (editingShop) {
        const updated = await api.updateShop(editingShop.id, payload);
        setShops(shops.map(s => s.id === editingShop.id ? updated : s));
      } else {
        const added = await api.createShop(payload);
        setShops([...shops, added]);
      }
      resetForm();
    } catch (err) {
      alert(err.message || 'Error saving shop details');
    }
  };

  const handleEdit = (shop) => {
    setEditingShop(shop);
    setNameEn(shop.name_en || shop.name);
    setNameTa(shop.name_ta || shop.name);
    setContactPerson(shop.contact_person || '');
    setMobile(shop.mobile);
    setGstNumber(shop.gst_number || '');
    setAddress(shop.address);
    setShopType(shop.shop_type);
    setRouteId(shop.route_id);
    setStatus(shop.status);
    setOutstanding(shop.outstanding_amount || 0);
  };

  const toggleStatus = async (shop) => {
    const newStatus = shop.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await api.updateShop(shop.id, { status: newStatus });
      setShops(shops.map(s => s.id === shop.id ? updated : s));
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const handleDeleteTrigger = (id) => {
    setDeleteTargetId(id);
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    setConfirmOpen(false);
    if (!deleteTargetId) return;
    try {
      await api.deleteShop(deleteTargetId);
      setShops(shops.filter(s => s.id !== deleteTargetId));
      alert('Shop moved to Recycle Bin. / கடை குப்பைத் தொட்டிக்கு நகர்த்தப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to delete shop');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const resetForm = () => {
    setEditingShop(null);
    setNameEn('');
    setNameTa('');
    setContactPerson('');
    setMobile('');
    setGstNumber('');
    setAddress('');
    setShopType('retail');
    setRouteId('');
    setStatus('active');
    setOutstanding(0);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Shop Manager...</div>;

  // Filter & Search Logic
  const filteredShops = shops.filter(s => {
    const matchesRoute = filterRoute ? s.route_id === filterRoute : true;
    
    const nameStr = `${s.name_en} ${s.name_ta} ${s.contact_person} ${s.mobile} ${s.gst_number}`.toLowerCase();
    const matchesSearch = searchQuery ? nameStr.includes(searchQuery.toLowerCase()) : true;

    return matchesRoute && matchesSearch;
  });

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🏢 {t('shop_mgmt')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Register and coordinate retail and wholesale shops across routes</p>
      </div>

      {/* Form Card */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
          {editingShop ? t('edit_shop') : t('add_shop')}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('shop_name')} (English)</label>
              <input type="text" className="form-input" value={nameEn} onChange={e => setNameEn(e.target.value)} required placeholder="e.g. Raja Cool Drinks" />
            </div>
            <div className="form-group">
              <label>{t('shop_name')} (Tamil)</label>
              <input type="text" className="form-input" value={nameTa} onChange={e => setNameTa(e.target.value)} required placeholder="எ.கா. ராஜா குளிர் பானங்கள்" />
            </div>
            <div className="form-group">
              <label>{t('contact_person')}</label>
              <input type="text" className="form-input" value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Owner name" />
            </div>
            <div className="form-group">
              <label>{t('mobile_number')}</label>
              <input type="text" className="form-input" value={mobile} onChange={e => setMobile(e.target.value)} required placeholder="e.g. 9876543210" />
            </div>
            <div className="form-group">
              <label>{t('gst_number')}</label>
              <input type="text" className="form-input" value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="15-digit GSTIN" />
            </div>
            <div className="form-group">
              <label>{t('shop_type')}</label>
              <select className="form-select" value={shopType} onChange={e => setShopType(e.target.value)}>
                <option value="retail">{t('retail')}</option>
                <option value="wholesale">{t('wholesale')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('assigned_route')}</label>
              <select className="form-select" value={routeId} onChange={e => setRouteId(e.target.value)} required>
                <option value="">-- Select Route --</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('status')}</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('outstanding_amount')} (₹)</label>
              <input type="number" className="form-input" value={outstanding} onChange={e => setOutstanding(e.target.value)} placeholder="0" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>{t('address')}</label>
              <input type="text" className="form-input" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Door No, Street Name, Area" />
            </div>
          </div>
          <div className="btn-group">
            {editingShop && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                {t('cancel')}
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              💾 {t('save')}
            </button>
          </div>
        </form>
      </div>

      {/* Filter and List Section */}
      <div className="glass-card">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Registered Shops ({filteredShops.length})</h2>
          
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select className="form-select" value={filterRoute} onChange={e => setFilterRoute(e.target.value)} style={{ minWidth: '180px' }}>
              <option value="">All Routes / அனைத்து வழித்தடங்களும்</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{lang === 'ta' ? r.name_ta : r.name_en}</option>
              ))}
            </select>
            
            <input
              type="text"
              className="form-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search shops..."
              style={{ width: '220px' }}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{t('shop_name')}</th>
                <th>{t('contact_person')} / {t('mobile_number')}</th>
                <th>{t('assigned_route')}</th>
                <th>{t('shop_type')}</th>
                <th>{t('outstanding_amount')}</th>
                <th>{t('status')}</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShops.map(s => {
                const routeObj = routes.find(r => r.id === s.route_id);
                const routeName = routeObj ? (lang === 'ta' ? routeObj.name_ta : routeObj.name_en) : 'None';
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: '700' }}>{lang === 'ta' ? s.name_ta : s.name_en}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GSTIN: {s.gst_number || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{s.address}</div>
                    </td>
                    <td>
                      <div>{s.contact_person}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>📞 {s.mobile}</div>
                    </td>
                    <td><span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px' }}>{routeName}</span></td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontWeight: '700',
                        color: s.shop_type === 'wholesale' ? '#a855f7' : 'var(--accent-cyan)',
                        border: `1px solid ${s.shop_type === 'wholesale' ? '#a855f7' : 'var(--accent-cyan)'}`
                      }}>
                        {s.shop_type === 'wholesale' ? t('wholesale') : t('retail')}
                      </span>
                    </td>
                    <td style={{ fontWeight: '700', color: s.outstanding_amount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      ₹{s.outstanding_amount || 0}
                    </td>
                    <td>
                      <span
                        onClick={() => toggleStatus(s)}
                        style={{
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: s.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: s.status === 'active' ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${s.status === 'active' ? 'var(--success)' : 'var(--danger)'}`
                        }}
                      >
                        {s.status === 'active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button className="language-btn" onClick={() => setSelectedShopForBills(s)} style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.05)' }} title={lang === 'ta' ? 'விலைப்பட்டியல் வரலாறு' : 'Bill History'}>
                          📄 {lang === 'ta' ? 'பில்கள்' : 'Bills'}
                        </button>
                        <button className="language-btn" onClick={() => handleEdit(s)}>
                          ✏️ Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteTrigger(s.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredShops.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No shops found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill History Modal */}
      {selectedShopForBills && (
        <div className="modal-overlay">
          <div className="glass-card modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                📄 {lang === 'ta' ? selectedShopForBills.name_ta : selectedShopForBills.name_en} - {lang === 'ta' ? 'விலைப்பட்டியல் வரலாறு' : 'Bill History'} ({orders.filter(o => o.shop_id === selectedShopForBills.id).length})
              </h3>
              <button 
                onClick={() => setSelectedShopForBills(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1.5rem' }} className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{lang === 'ta' ? 'விலைப்பட்டியல் எண்' : 'Invoice No'}</th>
                    <th>{lang === 'ta' ? 'தேதி' : 'Date'}</th>
                    <th>{lang === 'ta' ? 'மொத்த தொகை' : 'Net Amount'}</th>
                    <th>{lang === 'ta' ? 'நிலை' : 'Status'}</th>
                    <th style={{ textAlign: 'right' }}>{lang === 'ta' ? 'செயல்கள்' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter(o => o.shop_id === selectedShopForBills.id).map(o => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.invoice_number}</strong>
                      </td>
                      <td>
                        {new Date(o.order_date).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td style={{ fontWeight: 'bold' }}>
                        ₹{o.net_amount}
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: o.status === 'delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: o.status === 'delivered' ? 'var(--success)' : 'var(--warning)',
                          border: o.status === 'delivered' ? '1px solid var(--success)' : '1px solid var(--warning)'
                        }}>
                          {o.status === 'delivered' ? (lang === 'ta' ? 'விநியோகிக்கப்பட்டது' : 'Delivered') : (lang === 'ta' ? 'நிலுவையில் உள்ளது' : 'Pending')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {onBillSelected && (
                          <button 
                            className="language-btn" 
                            style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setSelectedShopForBills(null);
                              onBillSelected(o.id);
                            }}
                          >
                            👁️ {lang === 'ta' ? 'பார்வை' : 'View'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.filter(o => o.shop_id === selectedShopForBills.id).length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {lang === 'ta' ? 'இந்த கடைக்கு பில்கள் எதுவும் இல்லை.' : 'No bills found for this shop.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedShopForBills(null)}>
                {lang === 'ta' ? 'மூடுக' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        title={t('confirm_title')}
        message={t('confirm_delete_msg')}
        confirmText={t('confirm_ok')}
        cancelText={t('confirm_cancel')}
        onConfirm={executeDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
