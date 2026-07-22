import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function RouteMgr({ t, lang }) {
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [editingRoute, setEditingRoute] = useState(null);
  const [selectedRouteForShops, setSelectedRouteForShops] = useState(null);
  
  // Form fields
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [activeField, setActiveField] = useState(null);
  const [salesmanId, setSalesmanId] = useState('');
  const [deliveryManId, setDeliveryManId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [rData, uData, sData] = await Promise.all([
          api.getRoutes(),
          api.getUsers(),
          api.getShops()
        ]);
        setRoutes(rData);
        setUsers(uData);
        setShops(sData);
      } catch (err) {
        console.error('Failed to load routes/users/shops', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Auto-translate English to Tamil
  useEffect(() => {
    if (activeField !== 'en') return;
    if (!nameEn.trim()) {
      setNameTa('');
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameEn, 'en', 'ta');
        if (translated) setNameTa(translated);
      } catch (err) {
        console.error('Auto-translation to Tamil failed:', err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [nameEn, activeField]);

  // Auto-translate Tamil to English
  useEffect(() => {
    if (activeField !== 'ta') return;
    if (!nameTa.trim()) {
      setNameEn('');
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const translated = await api.translate(nameTa, 'ta', 'en');
        if (translated) setNameEn(translated);
      } catch (err) {
        console.error('Auto-translation to English failed:', err);
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [nameTa, activeField]);

  const salesmanList = users.filter(u => u.role === 'salesman' && u.active);
  const deliveryList = users.filter(u => u.role === 'delivery' && u.active);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nameEn.trim() && !nameTa.trim()) {
      alert(lang === 'ta' ? 'பெயர் தேவை' : 'Name is required');
      return;
    }

    let finalEn = nameEn.trim();
    let finalTa = nameTa.trim();

    // Auto-translate on submit if one is missing
    if (finalEn && !finalTa) {
      try {
        finalTa = await api.translate(finalEn, 'en', 'ta');
      } catch (err) {
        console.warn('Failed to translate to Tamil on submit', err);
      }
    } else if (finalTa && !finalEn) {
      try {
        finalEn = await api.translate(finalTa, 'ta', 'en');
      } catch (err) {
        console.warn('Failed to translate to English on submit', err);
      }
    }

    const payload = {
      name_en: finalEn,
      name_ta: finalTa,
      salesman_id: salesmanId,
      delivery_man_id: deliveryManId
    };

    try {
      if (editingRoute) {
        const updated = await api.updateRoute(editingRoute.id, payload);
        setRoutes(routes.map(r => r.id === editingRoute.id ? updated : r));
      } else {
        const added = await api.createRoute(payload);
        setRoutes([...routes, added]);
      }
      resetForm();
    } catch (err) {
      alert(err.message || 'Error saving route data');
    }
  };

  const handleEdit = (route) => {
    setEditingRoute(route);
    setNameEn(route.name_en);
    setNameTa(route.name_ta);
    setSalesmanId(route.salesman_id || '');
    setDeliveryManId(route.delivery_man_id || '');
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
      await api.deleteRoute(deleteTargetId);
      setRoutes(routes.filter(r => r.id !== deleteTargetId));
      alert('Route moved to Recycle Bin. / வழித்தடம் குப்பைத் தொட்டிக்கு நகர்த்தப்பட்டது.');
    } catch (err) {
      alert('Failed to delete route: ' + (err.message || err));
    } finally {
      setDeleteTargetId(null);
    }
  };

  const resetForm = () => {
    setEditingRoute(null);
    setNameEn('');
    setNameTa('');
    setSalesmanId('');
    setDeliveryManId('');
    setActiveField(null);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Route Manager...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🗺️ {t('route_mgmt')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage wholesale routes and assign field sales/delivery staff</p>
      </div>

      {/* Form Card */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
          {editingRoute ? t('edit_route') : t('add_route')}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('route_name_en')}</label>
              <input
                type="text"
                className="form-input"
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                onFocus={() => setActiveField('en')}
                placeholder="e.g. Trichy Road Route"
              />
            </div>
            <div className="form-group">
              <label>{t('route_name_ta')}</label>
              <input
                type="text"
                className="form-input"
                value={nameTa}
                onChange={e => setNameTa(e.target.value)}
                onFocus={() => setActiveField('ta')}
                placeholder="எ.கா. திருச்சி சாலை வழித்தடம்"
              />
            </div>
            <div className="form-group">
              <label>{t('assign_salesman')}</label>
              <select
                className="form-select"
                value={salesmanId}
                onChange={e => setSalesmanId(e.target.value)}
              >
                <option value="">-- {t('assign_salesman')} --</option>
                {salesmanList.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>{t('assign_delivery')}</label>
              <select
                className="form-select"
                value={deliveryManId}
                onChange={e => setDeliveryManId(e.target.value)}
              >
                <option value="">-- {t('assign_delivery')} --</option>
                {deliveryList.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="btn-group">
            {editingRoute && (
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

      {/* Routes List */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Active Route Assignments</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>{t('route_name_en')}</th>
                <th>{t('route_name_ta')}</th>
                <th>{t('assign_salesman')}</th>
                <th>{t('assign_delivery')}</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map(r => {
                const salesmanName = users.find(u => u.id === r.salesman_id)?.name || 'Unassigned';
                const deliveryName = users.find(u => u.id === r.delivery_man_id)?.name || 'Unassigned';
                return (
                  <tr key={r.id}>
                    <td><strong>{r.name_en}</strong></td>
                    <td><strong>{r.name_ta}</strong></td>
                    <td style={{ color: r.salesman_id ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>👤 {salesmanName}</td>
                    <td style={{ color: r.delivery_man_id ? 'var(--success)' : 'var(--text-muted)' }}>🚚 {deliveryName}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button className="language-btn" onClick={() => setSelectedRouteForShops(r)} style={{ borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.05)' }} title={lang === 'ta' ? 'கடைகளைக் காட்டு' : 'Show Shops'}>
                          👁️ {lang === 'ta' ? 'கடைகள்' : 'Shops'}
                        </button>
                        <button className="language-btn" onClick={() => handleEdit(r)} style={{ borderStyle: 'dashed' }}>
                          ✏️ Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDeleteTrigger(r.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {routes.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {t('no_routes')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shops under Route Modal */}
      {selectedRouteForShops && (
        <div className="modal-overlay">
          <div className="glass-card modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700' }}>
                🏢 {lang === 'ta' ? selectedRouteForShops.name_ta : selectedRouteForShops.name_en} - {lang === 'ta' ? 'கடைகள்' : 'Shops'} ({shops.filter(s => s.route_id === selectedRouteForShops.id).length})
              </h3>
              <button 
                onClick={() => setSelectedRouteForShops(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, marginBottom: '1.5rem' }} className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>{lang === 'ta' ? 'கடையின் பெயர்' : 'Shop Name'}</th>
                    <th>{lang === 'ta' ? 'தொடர்பு நபர்' : 'Contact'}</th>
                    <th>{lang === 'ta' ? 'கைபேசி எண்' : 'Mobile'}</th>
                    <th>{lang === 'ta' ? 'வகை' : 'Type'}</th>
                    <th style={{ textAlign: 'right' }}>{lang === 'ta' ? 'நிலுவை தொகை' : 'Outstanding'}</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.filter(s => s.route_id === selectedRouteForShops.id).map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong>{lang === 'ta' ? s.name_ta : s.name_en}</strong>
                      </td>
                      <td>{s.contact_person}</td>
                      <td>{s.mobile}</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: s.shop_type === 'wholesale' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: s.shop_type === 'wholesale' ? 'var(--accent-cyan)' : 'var(--success)',
                          border: s.shop_type === 'wholesale' ? '1px solid var(--accent-cyan)' : '1px solid var(--success)'
                        }}>
                          {s.shop_type === 'wholesale' ? (lang === 'ta' ? 'மொத்த விற்பனை' : 'Wholesale') : (lang === 'ta' ? 'சில்லறை விற்பனை' : 'Retail')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: s.outstanding_amount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        ₹{s.outstanding_amount}
                      </td>
                    </tr>
                  ))}
                  {shops.filter(s => s.route_id === selectedRouteForShops.id).length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {lang === 'ta' ? 'இந்த வழித்தடத்தில் கடைகள் எதுவும் இல்லை.' : 'No shops found under this route.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRouteForShops(null)}>
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
