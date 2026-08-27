import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const API_BASE = '/api';

function apiFetch(url, options = {}, targetTenantId = null) {
  const headers = { ...options.headers };
  const tenantId = targetTenantId || localStorage.getItem('tenantId') || 'GSK_AGENCY';
  headers['x-tenant-id'] = tenantId;
  
  const sessionStr = localStorage.getItem('session');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      if (session && session.id) {
        headers['x-user-id'] = session.id;
      }
    } catch (e) {
      console.error('Failed to parse session in apiFetch:', e);
    }
  }

  return fetch(url, { ...options, headers });
}

// Robust response parser that reads body stream once as text and parses JSON safely
async function parseJsonResponse(res, defaultErrMsg = 'API Request Failed') {
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // text is not valid JSON
    }
  }

  if (!res.ok) {
    const errorMsg = (parsed && (parsed.error || parsed.message)) || text || `${defaultErrMsg} (Status ${res.status})`;
    throw new Error(errorMsg);
  }

  return parsed;
}

// Helper to load table data from Firestore directly (for real-time fallback/speed)
async function getTableData(tableName, fallbackUrl, targetTenantId = null) {
  const tenantId = targetTenantId || localStorage.getItem('tenantId') || 'GSK_AGENCY';
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'tenants', tenantId, 'tables', tableName);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().data || [];
      }
      return [];
    } catch (err) {
      console.warn(`Firestore read failed for "${tableName}", falling back to REST API:`, err);
    }
  }
  const res = await apiFetch(fallbackUrl, {}, tenantId);
  return parseJsonResponse(res, `Failed to load ${tableName}`);
}

export const api = {
  // Auth
  async login(tenantId, username, password) {
    localStorage.setItem('tenantId', tenantId);
    const res = await apiFetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, username, password })
    });
    return parseJsonResponse(res, 'Login failed');
  },

  // System / Super Admin
  async getTenants() {
    const res = await apiFetch(`${API_BASE}/system/tenants`);
    return parseJsonResponse(res, 'Failed to fetch tenants');
  },
  async createTenant(tenantData) {
    const res = await apiFetch(`${API_BASE}/system/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenantData)
    });
    return parseJsonResponse(res, 'Failed to create tenant');
  },
  async updateTenantStatus(id, active) {
    const res = await apiFetch(`${API_BASE}/system/tenants/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    return parseJsonResponse(res, 'Failed to update tenant status');
  },
  async deleteTenant(id) {
    const res = await apiFetch(`${API_BASE}/system/tenants/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to delete tenant');
  },

  async getUsers(targetTenantId = null) {
    return getTableData('users', `${API_BASE}/users`, targetTenantId);
  },

  // Routes
  async getRoutes() {
    return getTableData('routes', `${API_BASE}/routes`);
  },
  async createRoute(routeData) {
    const res = await apiFetch(`${API_BASE}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    return parseJsonResponse(res, 'Failed to create route');
  },
  async updateRoute(id, routeData) {
    const res = await apiFetch(`${API_BASE}/routes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routeData)
    });
    return parseJsonResponse(res, 'Failed to update route');
  },
  async deleteRoute(id) {
    const res = await apiFetch(`${API_BASE}/routes/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to delete route');
  },

  // Shops
  async getShops() {
    return getTableData('shops', `${API_BASE}/shops`);
  },
  async createShop(shopData) {
    const res = await apiFetch(`${API_BASE}/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData)
    });
    const added = await parseJsonResponse(res, 'Failed to create shop');
    if (isFirebaseConfigured && db) {
      try {
        const tenantId = localStorage.getItem('tenantId') || 'default';
        const shops = await this.getShops();
        shops.push(added);
        const docRef = doc(db, 'tenants', tenantId, 'tables', 'shops');
        await setDoc(docRef, { data: shops }, { merge: true });
      } catch (e) {
        console.warn('Syncing created shop to Firestore client failed:', e);
      }
    }
    return added;
  },
  async updateShop(id, shopData) {
    const res = await apiFetch(`${API_BASE}/shops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData)
    });
    const updated = await parseJsonResponse(res, 'Failed to update shop');
    if (isFirebaseConfigured && db) {
      try {
        const tenantId = localStorage.getItem('tenantId') || 'default';
        const shops = await this.getShops();
        const idx = shops.findIndex(s => s.id === id);
        if (idx !== -1) {
          shops[idx] = updated;
        } else {
          shops.push(updated);
        }
        const docRef = doc(db, 'tenants', tenantId, 'tables', 'shops');
        await setDoc(docRef, { data: shops }, { merge: true });
      } catch (e) {
        console.warn('Syncing updated shop to Firestore client failed:', e);
      }
    }
    return updated;
  },

  // Products
  async getProducts() {
    return getTableData('products', `${API_BASE}/products`);
  },
  async createProduct(productData) {
    const res = await apiFetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return parseJsonResponse(res, 'Failed to create product');
  },
  async updateProduct(id, productData) {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    return parseJsonResponse(res, 'Failed to update product');
  },
  async importProducts(productsList) {
    const res = await apiFetch(`${API_BASE}/products/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productsList)
    });
    return parseJsonResponse(res, 'Failed to import products');
  },
  async autoTranslateProducts() {
    const res = await apiFetch(`${API_BASE}/products/auto-translate-all`, {
      method: 'POST'
    });
    return parseJsonResponse(res, 'Failed to auto translate products');
  },
  async importShops(routeId, shopsList) {
    const res = await apiFetch(`${API_BASE}/shops/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId, shops: shopsList })
    });
    return parseJsonResponse(res, 'Failed to import shops');
  },

  // Purchases
  async getPurchases() {
    return getTableData('purchases', `${API_BASE}/purchases`);
  },
  async createPurchase(purchaseData) {
    const res = await apiFetch(`${API_BASE}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    return parseJsonResponse(res, 'Failed to record purchase');
  },
  async updatePurchase(id, purchaseData) {
    const res = await apiFetch(`${API_BASE}/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    return parseJsonResponse(res, 'Failed to update purchase entry');
  },

  // Stock Ledger
  async getStockLedger() {
    return getTableData('stock_ledger', `${API_BASE}/stock/ledger`);
  },

  async getOrders() {
    const orders = await getTableData('orders', `${API_BASE}/orders`);
    if (orders && orders.length > 0) {
      orders.sort((a, b) => {
        const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
        const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return (a.id || '').localeCompare(b.id || '');
      });

      let changed = false;
      orders.forEach((order, index) => {
        const expectedInvoiceNum = `INV-${1001 + index}`;
        if (order.invoice_number !== expectedInvoiceNum) {
          order.invoice_number = expectedInvoiceNum;
          changed = true;
        }
      });

      if (changed && isFirebaseConfigured && db) {
        try {
          const tenantId = localStorage.getItem('tenantId') || 'default';
          const docRef = doc(db, 'tenants', tenantId, 'tables', 'orders');
          await setDoc(docRef, { data: orders }, { merge: true });
        } catch (e) {
          console.warn('Auto-sync reindexed orders to Firestore failed:', e);
        }
      }
    }
    return orders;
  },
  async getOrderItems() {
    return getTableData('order_items', `${API_BASE}/orders/items`);
  },
  async createOrder(orderData) {
    const res = await apiFetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    return parseJsonResponse(res, 'Failed to place order');
  },
  async updateOrder(id, orderData) {
    const res = await apiFetch(`${API_BASE}/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    return parseJsonResponse(res, 'Failed to update order/invoice');
  },

  // Deliveries
  async getDeliveries() {
    return getTableData('deliveries', `${API_BASE}/deliveries`);
  },
  async completeDelivery(id, payload) {
    const res = await apiFetch(`${API_BASE}/deliveries/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return parseJsonResponse(res, 'Failed to complete delivery');
  },
  async getDeliveryAuditTrail() {
    return getTableData('delivery_audit_trail', `${API_BASE}/delivery-audit-trail`);
  },
  async getSettings() {
    const res = await apiFetch(`${API_BASE}/settings`);
    return parseJsonResponse(res, 'Failed to fetch settings');
  },
  async updateSettings(settings) {
    const res = await apiFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return parseJsonResponse(res, 'Failed to update settings');
  },

  // Payments & Collections
  async getPayments() {
    return getTableData('payments', `${API_BASE}/payments`);
  },
  async createPayment(paymentData) {
    const res = await apiFetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });
    return parseJsonResponse(res, 'Failed to register payment');
  },
  async getOutstandingHistory() {
    return getTableData('outstanding_history', `${API_BASE}/outstanding/history`);
  },

  // Notifications
  async getNotifications() {
    return getTableData('notifications', `${API_BASE}/notifications`);
  },
  async markNotificationsRead() {
    const res = await apiFetch(`${API_BASE}/notifications/mark-read`, {
      method: 'POST'
    });
    return parseJsonResponse(res, 'Failed to mark notifications read');
  },

  // Reports
  async getReportSummary() {
    const res = await apiFetch(`${API_BASE}/reports/summary`);
    return parseJsonResponse(res, 'Failed to fetch report summary');
  },

  // Corrections & Cancellations
  async deleteShop(id) {
    const res = await apiFetch(`${API_BASE}/shops/${id}`, {
      method: 'DELETE'
    });
    const result = await parseJsonResponse(res, 'Failed to delete shop');
    if (isFirebaseConfigured && db) {
      try {
        const tenantId = localStorage.getItem('tenantId') || 'default';
        const shops = await this.getShops();
        const updatedShops = shops.filter(s => s.id !== id);
        const docRef = doc(db, 'tenants', tenantId, 'tables', 'shops');
        await setDoc(docRef, { data: updatedShops }, { merge: true });
      } catch (e) {
        console.warn('Syncing deleted shop to Firestore client failed:', e);
      }
    }
    return result;
  },
  async deleteProduct(id) {
    const res = await apiFetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to delete product');
  },
  async bulkDeleteProducts(ids) {
    const res = await apiFetch(`${API_BASE}/products/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    return parseJsonResponse(res, 'Failed to bulk delete products');
  },

  async deletePurchase(id) {
    const res = await apiFetch(`${API_BASE}/purchases/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to delete purchase');
  },
  async deleteOrder(id) {
    const res = await apiFetch(`${API_BASE}/orders/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to cancel/delete order');
  },

  // User Access Management
  async createUser(userData, targetTenantId = null) {
    const res = await apiFetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    }, targetTenantId);
    return parseJsonResponse(res, 'Failed to create user access');
  },
  async updateUser(id, userData, targetTenantId = null) {
    const res = await apiFetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    }, targetTenantId);
    return parseJsonResponse(res, 'Failed to update user access');
  },
  async deleteUser(id, targetTenantId = null) {
    const res = await apiFetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE'
    }, targetTenantId);
    return parseJsonResponse(res, 'Failed to delete user access');
  },

  // Recycle Bin
  async getRecycleBin() {
    return getTableData('recycle_bin', `${API_BASE}/recycle-bin`);
  },
  async restoreRecycleBinItem(id) {
    const res = await apiFetch(`${API_BASE}/recycle-bin/${id}/restore`, {
      method: 'POST'
    });
    return parseJsonResponse(res, 'Failed to restore item');
  },
  async purgeRecycleBinItem(id) {
    const res = await apiFetch(`${API_BASE}/recycle-bin/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to purge item');
  },

  // Vehicle Direct Sales
  async getVehicles() {
    return getTableData('vehicles', `${API_BASE}/vehicles`);
  },
  async createVehicle(vehicleData) {
    const res = await apiFetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    return parseJsonResponse(res, 'Failed to create vehicle');
  },
  async updateVehicle(id, vehicleData) {
    const res = await apiFetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    });
    return parseJsonResponse(res, 'Failed to update vehicle');
  },
  async deleteVehicle(id) {
    const res = await apiFetch(`${API_BASE}/vehicles/${id}`, {
      method: 'DELETE'
    });
    return parseJsonResponse(res, 'Failed to delete vehicle');
  },
  async getVehicleStock() {
    return getTableData('vehicle_stock', `${API_BASE}/vehicles/stock`);
  },
  async getVehicleDispatches() {
    return getTableData('vehicle_dispatches', `${API_BASE}/vehicles/dispatches`);
  },
  async updateVehicleDispatch(id, dispatchData) {
    const res = await apiFetch(`${API_BASE}/vehicles/dispatches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatchData)
    });
    return parseJsonResponse(res, 'Failed to update vehicle dispatch');
  },
  async dispatchVehicleStock(dispatchData) {
    const res = await apiFetch(`${API_BASE}/vehicles/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dispatchData)
    });
    return parseJsonResponse(res, 'Failed to dispatch vehicle stock');
  },
  async getVehicleSales() {
    return getTableData('vehicle_sales', `${API_BASE}/vehicles/sales`);
  },
  async createVehicleSale(saleData) {
    const res = await apiFetch(`${API_BASE}/vehicles/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });
    return parseJsonResponse(res, 'Failed to record direct sale');
  },
  async getVehicleReconciliations() {
    return getTableData('vehicle_reconciliations', `${API_BASE}/vehicles/reconciliations`);
  },
  async reconcileVehicleStock(reconcileData) {
    const res = await apiFetch(`${API_BASE}/vehicles/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reconcileData)
    });
    return parseJsonResponse(res, 'Failed to reconcile vehicle stock');
  },

  async translate(text, from, to) {
    const res = await apiFetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to })
    });
    const data = await parseJsonResponse(res, 'Failed to translate');
    return data ? data.translatedText : '';
  }
};

export default api;
