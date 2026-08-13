import React, { useState, useEffect } from 'react';
import { api } from '../api';
import './SuperAdminDashboard.css';

const MODULES = [
  { id: 'dashboard', label: 'Dashboard / முதன்மை பலகை' },
  { id: 'routes', label: 'Route Management / வழித்தட மேலாண்மை' },
  { id: 'shops', label: 'Shop Management / கடை மேலாண்மை' },
  { id: 'products', label: 'Product Management / தயாரிப்பு மேலாண்மை' },
  { id: 'purchases', label: 'Purchase Entry / கொள்முதல் பதிவு' },
  { id: 'stock', label: 'Stock Ledger / இருப்புப் பதிவேடு' },
  { id: 'orders', label: 'Order Taking / ஆர்டர் எடுத்தல்' },
  { id: 'deliveries', label: 'Deliveries / விநியோகங்கள்' },
  { id: 'vehicle_loading', label: 'Vehicle Loading / வண்டி ஏற்றுதல்' },
  { id: 'outstanding_collection', label: 'Outstanding Collection / வரவு வசூல்' },
  { id: 'vehicle_sales', label: 'Vehicle Direct Sales / நேரடி விற்பனை' },
  { id: 'reports', label: 'Reports / அறிக்கைகள்' },
  { id: 'users', label: 'Staff Management / பணியாளர் மேலாண்மை' },
  { id: 'recycle_bin', label: 'Recycle Bin / குப்பைத் தொட்டி' }
];

export default function SuperAdminDashboard({ t, lang }) {
  const [activeSubTab, setActiveSubTab] = useState('tenants'); // 'tenants' or 'users'
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tenant Form
  const [newTenantId, setNewTenantId] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('123456');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // User Management
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // User Form
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [role, setRole] = useState('salesman');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState(['dashboard', 'shops', 'stock', 'orders', 'deliveries', 'outstanding_collection', 'vehicle_sales']);

  // Shared Notifications
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPass, setShowPass] = useState({});
  const [showUserPass, setShowUserPass] = useState({});

  const togglePasswordVisibility = (id) => {
    setShowPass(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleUserPasswordVisibility = (id) => {
    setShowUserPass(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchUsers(selectedTenantId);
    } else {
      setUsers([]);
    }
    resetUserForm();
  }, [selectedTenantId]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await api.getTenants();
      setTenants(data);
      if (data.length > 0 && !selectedTenantId) {
        setSelectedTenantId(data[0].id);
      }
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (tenantId) => {
    try {
      setLoadingUsers(true);
      const data = await api.getUsers(tenantId);
      setUsers(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!newTenantId || !newTenantName) {
      setError('Company Code and Name are required');
      return;
    }

    try {
      await api.createTenant({ id: newTenantId, name: newTenantName, adminUsername, adminPassword });
      setSuccess('Company / Tenant created successfully');
      setNewTenantId('');
      setNewTenantName('');
      setAdminUsername('admin');
      setAdminPassword('123456');
      fetchTenants();
    } catch (err) {
      setError(err.message || 'Failed to create tenant');
    }
  };

  const toggleStatus = async (tenantId, currentStatus) => {
    setError('');
    setSuccess('');
    try {
      await api.updateTenantStatus(tenantId, !currentStatus);
      setSuccess(`Tenant status updated successfully`);
      fetchTenants();
    } catch (err) {
      setError(err.message || 'Failed to update tenant status');
    }
  };

  const handleDeleteTenant = async (tenantId, tenantName) => {
    setError('');
    setSuccess('');
    if (window.confirm(`Are you sure you want to permanently delete the tenant "${tenantName}" (${tenantId})? This action cannot be undone and will delete all associated data.`)) {
      try {
        await api.deleteTenant(tenantId);
        setSuccess(`Tenant ${tenantName} deleted successfully.`);
        fetchTenants();
      } catch (err) {
        setError(err.message || 'Failed to delete tenant');
      }
    }
  };

  // User Actions
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'admin') {
      setPermissions(MODULES.map(m => m.id));
    } else if (newRole === 'salesman') {
      setPermissions(['dashboard', 'shops', 'stock', 'orders', 'deliveries', 'outstanding_collection', 'vehicle_sales']);
    } else if (newRole === 'delivery') {
      setPermissions(['dashboard', 'deliveries']);
    }
  };

  const togglePermission = (moduleId) => {
    setPermissions(prev => {
      if (prev.includes(moduleId)) {
        return prev.filter(p => p !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedTenantId) {
      setError('Please select a company/tenant first');
      return;
    }
    if (!name || !username || !password) {
      setError('Please fill in all required fields');
      return;
    }

    const payload = {
      name,
      mobile,
      role,
      username: username.toLowerCase().trim(),
      password,
      active,
      permissions
    };

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, payload, selectedTenantId);
        setSuccess('User updated successfully');
      } else {
        await api.createUser(payload, selectedTenantId);
        setSuccess('User created successfully');
      }
      resetUserForm();
      fetchUsers(selectedTenantId);
    } catch (err) {
      setError(err.message || 'Failed to save user account');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setName(user.name);
    setMobile(user.mobile || '');
    setRole(user.role);
    setUsername(user.username);
    setPassword(user.password);
    setActive(user.active);
    setPermissions(user.permissions || []);
  };

  const toggleUserActive = async (user) => {
    setError('');
    setSuccess('');
    try {
      await api.updateUser(user.id, { active: !user.active }, selectedTenantId);
      setSuccess(`User status updated successfully`);
      fetchUsers(selectedTenantId);
    } catch (err) {
      setError(err.message || 'Failed to toggle user status');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    setError('');
    setSuccess('');
    if (window.confirm(`Are you sure you want to delete user ${userName}?`)) {
      try {
        await api.deleteUser(userId, selectedTenantId);
        setSuccess('User deleted successfully');
        fetchUsers(selectedTenantId);
      } catch (err) {
        setError(err.message || 'Failed to delete user');
      }
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setName('');
    setMobile('');
    setRole('salesman');
    setUsername('');
    setPassword('');
    setActive(true);
    setPermissions(['dashboard', 'shops', 'stock', 'orders', 'deliveries', 'outstanding_collection', 'vehicle_sales']);
  };

  return (
    <div className="superadmin-dashboard fade-in">
      <h2>👑 Super Admin Dashboard</h2>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeSubTab === 'tenants' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('tenants'); setError(''); setSuccess(''); }}
        >
          🏢 Tenant / Company Management
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'users' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('users'); setError(''); setSuccess(''); }}
        >
          👥 User Access & Permissions
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Tab 1: Tenant Management */}
      {activeSubTab === 'tenants' && (
        <>
          <div className="tenant-creation-card glass-panel">
            <h3>Create New Company / Tenant</h3>
            <form onSubmit={handleCreateTenant} className="tenant-form">
              <div className="form-group">
                <label>Company Code (No spaces)</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newTenantId} 
                  onChange={e => setNewTenantId(e.target.value.replace(/\s/g, '').toUpperCase())} 
                  placeholder="e.g. COMP_A"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Company Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={newTenantName} 
                  onChange={e => setNewTenantName(e.target.value)} 
                  placeholder="e.g. Company A Logistics"
                  required 
                />
              </div>
              <div className="form-group">
                <label>Admin Username</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={adminUsername} 
                  onChange={e => setAdminUsername(e.target.value)} 
                  placeholder="admin"
                  required 
                />
              </div>
              <div className="form-group">
                <label>Admin Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showAdminPassword ? 'text' : 'password'} 
                    className="form-input"
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)} 
                    placeholder="123456"
                    required 
                    style={{ width: '100%', paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                    title={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <button type="submit" className="primary-btn btn">Create Tenant</button>
            </form>
          </div>

          <div className="tenants-list-card glass-panel">
            <h3>Registered Tenants</h3>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading tenants...</p>
            ) : (
              <div className="table-responsive">
                <table className="data-table custom-table">
                  <thead>
                    <tr>
                      <th>Company Code</th>
                      <th>Company Name</th>
                      <th>Admin Password</th>
                      <th>Created At</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(tenant => (
                      <tr key={tenant.id} className={!tenant.active ? 'inactive-row' : ''}>
                        <td><strong>{tenant.id}</strong></td>
                        <td>{tenant.name}</td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' }}>
                            <span>{showPass[tenant.id] ? (tenant.adminPassword || '123') : '••••••'}</span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(tenant.id)}
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
                              title={showPass[tenant.id] ? 'Hide password' : 'Show password'}
                            >
                              {showPass[tenant.id] ? '🙈' : '👁️'}
                            </button>
                          </div>
                        </td>
                        <td>{new Date(tenant.created_at).toLocaleString()}</td>
                        <td>
                          <span className={`status-badge ${tenant.active ? 'active' : 'inactive'}`}>
                            {tenant.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className={`action-btn ${tenant.active ? 'danger-btn' : 'success-btn'}`}
                              onClick={() => toggleStatus(tenant.id, tenant.active)}
                            >
                              {tenant.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button 
                              className="action-btn danger-btn"
                              onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tenants.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center">No tenants registered yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab 2: User Access & Permissions */}
      {activeSubTab === 'users' && (
        <>
          <div className="tenant-selector-card glass-panel" style={{ marginBottom: '2rem' }}>
            <div className="form-group" style={{ maxWidth: '400px' }}>
              <label style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.5rem', display: 'block' }}>
                Select Tenant / Company
              </label>
              <select 
                className="form-select"
                value={selectedTenantId}
                onChange={e => setSelectedTenantId(e.target.value)}
                style={{ width: '100%', fontSize: '1rem', padding: '0.75rem' }}
              >
                <option value="">-- Choose Tenant --</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedTenantId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
              {/* Add Tenant User Form Card (Normal view) */}
              {!editingUser && (
                <div className="glass-panel">
                  <h3>👥 Add Tenant User</h3>
                  <form onSubmit={handleUserSubmit}>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                      <div className="form-group">
                        <label>Full Name *</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={name} 
                          onChange={e => setName(e.target.value)} 
                          placeholder="e.g. Salesman Ram"
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Mobile Number</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={mobile} 
                          onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                          maxLength={10}
                          pattern="[0-9]{10}"
                          inputMode="numeric"
                          placeholder="10-digit number" 
                        />
                      </div>
                      <div className="form-group">
                        <label>Username (Login ID) *</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={username} 
                          onChange={e => setUsername(e.target.value)} 
                          placeholder="e.g. ram123"
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Password *</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={password} 
                          onChange={e => setPassword(e.target.value)} 
                          placeholder="Enter password" 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Role</label>
                        <select 
                          className="form-select"
                          value={role} 
                          onChange={e => handleRoleChange(e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="salesman">Salesman</option>
                          <option value="delivery">Delivery Man</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>User Status</label>
                        <select 
                          className="form-select"
                          value={active ? 'active' : 'inactive'}
                          onChange={e => setActive(e.target.value === 'active')}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    {/* Permissions checklist */}
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                      <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🛡️ Module Permissions Checklist</h4>
                      <div className="permissions-grid">
                        {MODULES.map(m => (
                          <label key={m.id} className="permission-item">
                            <input 
                              type="checkbox"
                              checked={permissions.includes(m.id)}
                              onChange={() => togglePermission(m.id)}
                            />
                            <span>{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="btn-group" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                      <button type="submit" className="primary-btn btn">
                        Create Account
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit Tenant User Popup Modal */}
              {editingUser && (
                <div className="modal-overlay">
                  <div className="glass-card modal-card" style={{ maxWidth: '750px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0 }}>
                        ✏️ Edit Tenant User: {editingUser.name} ({editingUser.username})
                      </h2>
                      <button 
                        type="button" 
                        onClick={resetUserForm}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleUserSubmit}>
                      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                        <div className="form-group">
                          <label>Full Name *</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            placeholder="e.g. Salesman Ram"
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label>Mobile Number</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={mobile} 
                            onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                            maxLength={10}
                            pattern="[0-9]{10}"
                            inputMode="numeric"
                            placeholder="10-digit number" 
                          />
                        </div>
                        <div className="form-group">
                          <label>Username (Login ID) *</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={username} 
                            onChange={e => setUsername(e.target.value)} 
                            placeholder="e.g. ram123"
                            disabled={true}
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label>Password *</label>
                          <input 
                            type="text" 
                            className="form-input"
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="Enter password" 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label>Role</label>
                          <select 
                            className="form-select"
                            value={role} 
                            onChange={e => handleRoleChange(e.target.value)}
                          >
                            <option value="admin">Admin</option>
                            <option value="salesman">Salesman</option>
                            <option value="delivery">Delivery Man</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>User Status</label>
                          <select 
                            className="form-select"
                            value={active ? 'active' : 'inactive'}
                            onChange={e => setActive(e.target.value === 'active')}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      </div>

                      {/* Permissions checklist */}
                      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                        <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🛡️ Module Permissions Checklist</h4>
                        <div className="permissions-grid">
                          {MODULES.map(m => (
                            <label key={m.id} className="permission-item">
                              <input 
                                type="checkbox"
                                checked={permissions.includes(m.id)}
                                onChange={() => togglePermission(m.id)}
                              />
                              <span>{m.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="btn-group" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={resetUserForm}>
                          Cancel
                        </button>
                        <button type="submit" className="primary-btn btn">
                          💾 Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Users List Card */}
              <div className="glass-panel">
                <h3>Staff & Access Profiles ({users.length})</h3>
                {loadingUsers ? (
                  <p style={{ color: 'var(--text-muted)' }}>Loading tenant user profiles...</p>
                ) : (
                  <div className="table-responsive">
                    <table className="custom-table data-table">
                      <thead>
                        <tr>
                          <th>Full Name</th>
                          <th>Username</th>
                          <th>Password</th>
                          <th>Role</th>
                          <th>Mobile</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id} style={{ opacity: u.active ? 1 : 0.6 }}>
                            <td><strong>{u.name}</strong></td>
                            <td><code>{u.username}</code></td>
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace' }}>
                                <span>{showUserPass[u.id] ? u.password : '••••••'}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleUserPasswordVisibility(u.id)}
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
                                  title={showUserPass[u.id] ? 'Hide password' : 'Show password'}
                                >
                                  {showUserPass[u.id] ? '🙈' : '👁️'}
                                </button>
                              </div>
                            </td>
                            <td>
                              <span className={`role-badge ${u.role}`}>
                                {u.role === 'admin' ? 'Admin' : u.role === 'salesman' ? 'Salesman' : 'Delivery Man'}
                              </span>
                            </td>
                            <td>{u.mobile || 'N/A'}</td>
                            <td>
                              <span 
                                className={`status-badge ${u.active ? 'active' : 'inactive'}`}
                                onClick={() => toggleUserActive(u)}
                                style={{ cursor: 'pointer' }}
                                title="Click to toggle status"
                              >
                                {u.active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                <button className="action-btn" onClick={() => handleEditUser(u)}>
                                  ✏️ Edit
                                </button>
                                <button className="action-btn danger-btn" onClick={() => handleDeleteUser(u.id, u.name)}>
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr>
                            <td colSpan="7" className="text-center">No user profiles created for this tenant yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
