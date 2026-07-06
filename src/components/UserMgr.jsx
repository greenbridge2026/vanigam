import React, { useState, useEffect } from 'react';
import api from '../api';
import ConfirmModal from './ConfirmModal';

export default function UserMgr({ t, lang }) {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('salesman');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  
  // Visibility States
  const [showPass, setShowPass] = useState({});
  const [showFormPassword, setShowFormPassword] = useState(false);

  const togglePasswordVisibility = (id) => {
    setShowPass(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await api.getUsers();
        setUsers(data);
      } catch (err) {
        console.error('Failed to load user list', err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !username || !password) return alert('Please enter all required fields');

    const payload = {
      name,
      mobile,
      role,
      username: username.toLowerCase().trim(),
      password,
      active
    };

    try {
      if (editingUser) {
        const updated = await api.updateUser(editingUser.id, payload);
        setUsers(users.map(u => u.id === editingUser.id ? updated : u));
        alert(t('user_updated_msg'));
      } else {
        const added = await api.createUser(payload);
        setUsers([...users, added]);
        alert(t('user_created_msg'));
      }
      resetForm();
    } catch (err) {
      alert(err.message || 'Error processing staff access');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setName(user.name);
    setMobile(user.mobile || '');
    setRole(user.role);
    setUsername(user.username);
    setPassword(user.password);
    setActive(user.active);
  };

  const toggleActiveStatus = async (user) => {
    const newStatus = !user.active;
    try {
      const updated = await api.updateUser(user.id, { active: newStatus });
      setUsers(users.map(u => u.id === user.id ? updated : u));
    } catch (err) {
      alert('Failed to update active status');
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
      await api.deleteUser(deleteTargetId);
      setUsers(users.filter(u => u.id !== deleteTargetId));
      alert('User access deleted successfully. / பயனர் அணுகல் நீக்கப்பட்டது.');
    } catch (err) {
      alert(err.message || 'Failed to delete user access');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setName('');
    setMobile('');
    setRole('salesman');
    setUsername('');
    setPassword('');
    setActive(true);
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading Staff Manager...</div>;

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>👥 {t('staff_mgmt')}</h1>
        <p style={{ color: 'var(--text-muted)' }}>Generate staff access profiles and manage credentials for Admin, Salesmen, and Delivery Men</p>
      </div>

      {/* Form Card */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>
          {editingUser ? t('edit_user') : t('add_user')}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('full_name')} *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="e.g. Salesman Ram"
              />
            </div>
            <div className="form-group">
              <label>{t('mobile_number')}</label>
              <input
                type="text"
                className="form-input"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="10-digit number"
              />
            </div>
            <div className="form-group">
              <label>{t('role')}</label>
              <select
                className="form-select"
                value={role}
                onChange={e => setRole(e.target.value)}
              >
                <option value="admin">{t('admin')}</option>
                <option value="salesman">{t('salesman')}</option>
                <option value="delivery">{t('delivery_man')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('username')} *</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                disabled={editingUser !== null}
                placeholder="e.g. ram123"
              />
            </div>
             <div className="form-group">
               <label>{t('password')} *</label>
               <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                 <input
                   type={showFormPassword ? 'text' : 'password'}
                   className="form-input"
                   style={{ width: '100%', paddingRight: '2.5rem' }}
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                   required
                   placeholder="Enter password"
                 />
                 <button
                   type="button"
                   onClick={() => setShowFormPassword(!showFormPassword)}
                   style={{
                     position: 'absolute',
                     right: '10px',
                     background: 'none',
                     border: 'none',
                     cursor: 'pointer',
                     color: 'var(--accent-cyan)',
                     fontSize: '1.1rem',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center'
                   }}
                   title={showFormPassword ? 'Hide password' : 'Show password'}
                 >
                   {showFormPassword ? '🙈' : '👁️'}
                 </button>
               </div>
             </div>
            <div className="form-group">
              <label>{t('user_status')}</label>
              <select
                className="form-select"
                value={active ? 'active' : 'inactive'}
                onChange={e => setActive(e.target.value === 'active')}
              >
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </div>
          </div>
          <div className="btn-group">
            {editingUser && (
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

      {/* Staff List Table */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Active Staff Access Accounts</h2>
        <div className="table-container">
          <table className="custom-table">
            <thead>
               <tr>
                 <th>{t('full_name')}</th>
                 <th>{t('username')}</th>
                 <th>{t('password')}</th>
                 <th>{t('role')}</th>
                 <th>{t('mobile_number')}</th>
                 <th>{t('user_status')}</th>
                 <th style={{ textAlign: 'right' }}>Actions</th>
               </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.6 }}>
                   <td><strong>{u.name}</strong></td>
                   <td><code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{u.username}</code></td>
                   <td>
                     <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' }}>
                       <span>{showPass[u.id] ? u.password : '••••••'}</span>
                       <button
                         type="button"
                         onClick={() => togglePasswordVisibility(u.id)}
                         style={{
                           background: 'none',
                           border: 'none',
                           cursor: 'pointer',
                           padding: 0,
                           color: 'var(--accent-cyan)',
                           fontSize: '1.05rem',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center'
                         }}
                         title={showPass[u.id] ? 'Hide password' : 'Show password'}
                       >
                         {showPass[u.id] ? '🙈' : '👁️'}
                       </button>
                     </div>
                   </td>
                   <td>
                     <span className={`role-badge ${u.role}`}>
                       {t(u.role)}
                     </span>
                   </td>
                  <td>{u.mobile || 'N/A'}</td>
                  <td>
                    <span
                      onClick={() => toggleActiveStatus(u)}
                      style={{
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: u.active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: u.active ? 'var(--success)' : 'var(--danger)',
                        border: `1px solid ${u.active ? 'var(--success)' : 'var(--danger)'}`
                      }}
                    >
                      {u.active ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button className="language-btn" onClick={() => handleEdit(u)}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDeleteTrigger(u.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  );
}
