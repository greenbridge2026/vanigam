import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function RouteMgr({ t, lang }) {
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingRoute, setEditingRoute] = useState(null);
  
  // Form fields
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [salesmanId, setSalesmanId] = useState('');
  const [deliveryManId, setDeliveryManId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [rData, uData] = await Promise.all([api.getRoutes(), api.getUsers()]);
        setRoutes(rData);
        setUsers(uData);
      } catch (err) {
        console.error('Failed to load routes/users', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const salesmanList = users.filter(u => u.role === 'salesman' && u.active);
  const deliveryList = users.filter(u => u.role === 'delivery' && u.active);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name_en: nameEn,
      name_ta: nameTa,
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
      alert('Error saving route data');
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
                required
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
                required
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
