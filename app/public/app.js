// Quản lý trạng thái Frontend
let state = {
  tables: [],
  dishes: [],
  orders: [],
  selectedOrderItems: new Map(), // dishId -> { dish, quantity }
  currentOrderFilter: 'ALL',
  currentDishFilter: 'ALL'
};

// Định dạng tiền tệ VNĐ
function formatMoney(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ';
}

// Khởi chạy ứng dụng khi tải trang
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  startClock();
  fetchAllData();

  // Tự động làm mới dữ liệu sau mỗi 15 giây
  setInterval(fetchSummaryStats, 15000);
});

// Điều hướng Tab
function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// Đồng hồ hệ thống
function startClock() {
  const clockEl = document.getElementById('currentTime');
  function updateTime() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('vi-VN');
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// Lấy tất cả dữ liệu ban đầu
async function fetchAllData() {
  await Promise.all([
    loadTables(),
    loadDishes(),
    loadOrders(),
    fetchSummaryStats()
  ]);
}

// 1. Thống kê KPI tóm tắt
async function fetchSummaryStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      document.getElementById('kpiRevenue').textContent = formatMoney(d.total_revenue);
      document.getElementById('kpiOrders').textContent = d.total_orders;
      document.getElementById('kpiActiveOrders').textContent = d.active_orders;
      document.getElementById('kpiTables').textContent = `${d.tables_occupied} / ${d.tables_total}`;
    }
  } catch (err) {
    console.error('Lỗi lấy thống kê:', err);
  }
}

// 2. Tải danh sách Bàn Ăn
async function loadTables() {
  const container = document.getElementById('tablesContainer');
  try {
    const res = await fetch('/api/tables');
    const json = await res.json();
    if (json.success) {
      state.tables = json.data;
      renderTables();
    }
  } catch (err) {
    container.innerHTML = `<div class="error-state">Lỗi kết nối khi tải bàn ăn: ${err.message}</div>`;
  }
}

function renderTables() {
  const container = document.getElementById('tablesContainer');
  if (!state.tables.length) {
    container.innerHTML = '<div class="empty-state">Chưa có dữ liệu bàn ăn</div>';
    return;
  }

  container.innerHTML = state.tables.map(table => {
    const isOccupied = table.status === 'CO_KHACH';
    return `
      <div class="table-card ${isOccupied ? 'occupied' : ''}">
        <div class="table-header">
          <span class="table-title">${table.name}</span>
          <span class="badge ${isOccupied ? 'badge-occupied' : 'badge-vacant'}">
            ${isOccupied ? 'Đang có khách' : 'Bàn trống'}
          </span>
        </div>
        <div class="table-info">
          <div>Sức chứa: <strong>${table.capacity} khách</strong></div>
          ${table.current_order_id ? `
            <div class="table-order-detail">
              <div>Mã đơn: <strong>${table.current_order_code}</strong></div>
              <div>Tổng tiền: <strong style="color: #ea580c;">${formatMoney(table.current_order_total)}</strong></div>
            </div>
          ` : '<div style="margin-top: 0.5rem; color: #94a3b8;">Không có đơn hoạt động</div>'}
        </div>
        <div class="table-actions">
          ${!isOccupied ? `
            <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="openCreateOrderForTable(${table.id})">➕ Đặt Món</button>
          ` : `
            <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="viewOrdersOfTable(${table.id})">🔍 Xem Đơn</button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// 3. Tải danh sách Món Ăn
async function loadDishes() {
  try {
    let url = '/api/dishes';
    if (state.currentDishFilter !== 'ALL') {
      url += `?category=${encodeURIComponent(state.currentDishFilter)}`;
    }
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      state.dishes = json.data;
      renderDishes();
    }
  } catch (err) {
    console.error('Lỗi tải món ăn:', err);
  }
}

function renderDishes() {
  const container = document.getElementById('dishesContainer');
  if (!state.dishes.length) {
    container.innerHTML = '<div class="empty-state">Không có món ăn nào trong danh mục này</div>';
    return;
  }

  container.innerHTML = state.dishes.map(dish => {
    const isAvailable = dish.status === 'CON_HANG';
    return `
      <div class="dish-card">
        <div>
          <div class="dish-header">
            <span class="dish-name">${dish.name}</span>
            <span class="badge ${isAvailable ? 'badge-vacant' : 'badge-occupied'}">
              ${isAvailable ? 'Còn món' : 'Hết món'}
            </span>
          </div>
          <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600;">[${dish.category}]</div>
          <div class="dish-price">${formatMoney(dish.price)}</div>
          <p class="dish-desc">${dish.description || 'Chưa có mô tả chi tiết'}</p>
        </div>
        <div class="dish-footer">
          <button class="btn btn-secondary btn-sm" onclick="toggleDishStatus(${dish.id}, '${dish.status}')">
            ${isAvailable ? 'Đánh dấu Hết' : 'Đánh dấu Còn'}
          </button>
          <button class="btn btn-outline btn-sm" onclick="openCreateOrderWithDish(${dish.id})">
            + Thêm vào đơn
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterDishes(category, btn) {
  state.currentDishFilter = category;
  document.querySelectorAll('#tab-dishes .filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  loadDishes();
}

async function toggleDishStatus(dishId, currentStatus) {
  const newStatus = currentStatus === 'CON_HANG' ? 'HET_HANG' : 'CON_HANG';
  try {
    const res = await fetch(`/api/dishes/${dishId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Đã chuyển trạng thái món sang: ${newStatus === 'CON_HANG' ? 'Còn hàng' : 'Hết hàng'}`, 'success');
      loadDishes();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi cập nhật món: ' + err.message, 'error');
  }
}

// 4. Tải danh sách Đơn Hàng
async function loadOrders() {
  try {
    let url = '/api/orders';
    if (state.currentOrderFilter !== 'ALL') {
      url += `?status=${encodeURIComponent(state.currentOrderFilter)}`;
    }
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      state.orders = json.data;
      renderOrders();
    }
  } catch (err) {
    console.error('Lỗi tải đơn hàng:', err);
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'CHO_XU_LY': return '<span class="badge" style="background:#e0f2fe; color:#0284c7;">Chờ xử lý</span>';
    case 'DANG_CHUAN_BI': return '<span class="badge" style="background:#fef3c7; color:#d97706;">Đang chuẩn bị</span>';
    case 'DA_PHUC_VU': return '<span class="badge" style="background:#f3e8ff; color:#9333ea;">Đã phục vụ</span>';
    case 'DA_THANH_TOAN': return '<span class="badge" style="background:#dcfce7; color:#16a34a;">Đã thanh toán</span>';
    case 'DA_HUY': return '<span class="badge" style="background:#fee2e2; color:#dc2626;">Đã hủy</span>';
    default: return status;
  }
}

function renderOrders() {
  const container = document.getElementById('ordersContainer');
  if (!state.orders.length) {
    container.innerHTML = '<div class="empty-state" style="padding: 2rem; text-align: center; background: white; border-radius: 8px;">Không có đơn hàng nào trong mục này</div>';
    return;
  }

  container.innerHTML = state.orders.map(order => {
    const isCompleted = ['DA_THANH_TOAN', 'DA_HUY'].includes(order.status);
    const items = order.items || [];
    
    return `
      <div class="order-card">
        <div class="order-header-row">
          <div>
            <span class="order-code">${order.order_code}</span>
            <span style="margin-left: 10px; font-weight: 600;">${order.table_name || 'Bàn không xác định'}</span>
          </div>
          <div>
            ${getStatusBadge(order.status)}
            <span class="order-meta" style="margin-left: 10px;">${new Date(order.created_at).toLocaleTimeString('vi-VN')}</span>
          </div>
        </div>

        ${order.notes ? `<div style="font-size: 0.85rem; color: #b45309; background: #fffbeb; padding: 4px 8px; border-radius: 4px;">📝 Ghi chú: ${order.notes}</div>` : ''}

        <table class="order-items-table">
          <thead>
            <tr>
              <th>Món Ăn</th>
              <th style="text-align: center;">SL</th>
              <th style="text-align: right;">Đơn Giá</th>
              <th style="text-align: right;">Thành Tiền</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${i.dish_name}</td>
                <td style="text-align: center;">x${i.quantity}</td>
                <td style="text-align: right;">${formatMoney(i.unit_price)}</td>
                <td style="text-align: right; font-weight: 600;">${formatMoney(i.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="order-footer-row">
          <div class="order-total-display">
            Tổng cộng: <span style="color: #ea580c;">${formatMoney(order.total_amount)}</span>
          </div>

          <div class="order-actions">
            ${order.status === 'CHO_XU_LY' ? `
              <button class="btn btn-secondary btn-sm" onclick="updateOrderStatus(${order.id}, 'DANG_CHUAN_BI')">👨‍🍳 Chuyển Bếp</button>
              <button class="btn btn-secondary btn-sm" style="color: #ef4444;" onclick="updateOrderStatus(${order.id}, 'DA_HUY')">Hủy</button>
            ` : ''}

            ${order.status === 'DANG_CHUAN_BI' ? `
              <button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${order.id}, 'DA_PHUC_VU')">🍽️ Lên Bàn</button>
            ` : ''}

            ${order.status === 'DA_PHUC_VU' ? `
              <button class="btn btn-primary btn-sm" style="background:#16a34a;" onclick="updateOrderStatus(${order.id}, 'DA_THANH_TOAN')">💵 Thanh Toán & Trả Bàn</button>
            ` : ''}

            ${isCompleted ? `
              <span style="font-size: 0.85rem; color: #64748b; font-style: italic;">Đơn hàng đã hoàn tất</span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterOrders(status, btn) {
  state.currentOrderFilter = status;
  document.querySelectorAll('#tab-orders .filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  loadOrders();
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Đã cập nhật trạng thái đơn thành công!`, 'success');
      await Promise.all([loadOrders(), loadTables(), fetchSummaryStats()]);
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi cập nhật trạng thái: ' + err.message, 'error');
  }
}

// 5. Modal Tạo Đơn Hàng Mới & Tính Tiền Tự Động
function openCreateOrderModal(preselectedTableId = null) {
  state.selectedOrderItems.clear();

  // Đổ danh sách bàn vào select
  const select = document.getElementById('orderTableSelect');
  select.innerHTML = '<option value="">-- Chọn bàn ăn --</option>' + 
    state.tables.map(t => `<option value="${t.id}" ${t.id === preselectedTableId ? 'selected' : ''}>${t.name} (${t.status === 'CO_KHACH' ? 'Có khách' : 'Trống'})</option>`).join('');

  // Đổ danh sách món vào dish picker
  renderDishPicker();
  calculateOrderSummary();

  document.getElementById('orderNotes').value = '';
  document.getElementById('orderModal').classList.add('active');
}

function openCreateOrderForTable(tableId) {
  openCreateOrderModal(tableId);
}

function openCreateOrderWithDish(dishId) {
  openCreateOrderModal();
  changeItemQty(dishId, 1);
}

function renderDishPicker() {
  const container = document.getElementById('dishPickerList');
  const availableDishes = state.dishes.filter(d => d.status === 'CON_HANG');

  if (!availableDishes.length) {
    container.innerHTML = '<div style="padding: 1rem; color: red;">Không có món ăn nào khả dụng.</div>';
    return;
  }

  container.innerHTML = availableDishes.map(d => {
    const currentQty = state.selectedOrderItems.get(d.id)?.quantity || 0;
    return `
      <div class="picker-item">
        <div class="picker-item-info">
          <span class="picker-dish-name">${d.name}</span>
          <span class="picker-dish-price">${formatMoney(d.price)}</span>
        </div>
        <div class="picker-controls">
          <button type="button" class="qty-btn" onclick="changeItemQty(${d.id}, -1)">-</button>
          <span class="qty-value" id="qty-val-${d.id}">${currentQty}</span>
          <button type="button" class="qty-btn" onclick="changeItemQty(${d.id}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function changeItemQty(dishId, delta) {
  const dish = state.dishes.find(d => d.id === dishId);
  if (!dish) return;

  const current = state.selectedOrderItems.get(dishId) || { dish, quantity: 0 };
  let newQty = current.quantity + delta;

  if (newQty <= 0) {
    state.selectedOrderItems.delete(dishId);
    newQty = 0;
  } else {
    state.selectedOrderItems.set(dishId, { dish, quantity: newQty });
  }

  const valEl = document.getElementById(`qty-val-${dishId}`);
  if (valEl) valEl.textContent = newQty;

  calculateOrderSummary();
}

// TỰ ĐỘNG TÍNH TOÁN TỔNG TIỀN TRỰC TIẾP TRÊN GIAO DIỆN
function calculateOrderSummary() {
  let totalCount = 0;
  let totalAmount = 0;

  state.selectedOrderItems.forEach(item => {
    totalCount += item.quantity;
    totalAmount += item.quantity * parseFloat(item.dish.price);
  });

  document.getElementById('summaryItemCount').textContent = `${state.selectedOrderItems.size} loại món (${totalCount} phần)`;
  document.getElementById('summaryTotalAmount').textContent = formatMoney(totalAmount);
}

async function submitCreateOrder() {
  const tableId = document.getElementById('orderTableSelect').value;
  const notes = document.getElementById('orderNotes').value.trim();

  if (!tableId) {
    showToast('Vui lòng chọn bàn ăn!', 'warning');
    return;
  }

  if (state.selectedOrderItems.size === 0) {
    showToast('Vui lòng chọn ít nhất một món ăn!', 'warning');
    return;
  }

  const items = [];
  state.selectedOrderItems.forEach((val, dishId) => {
    items.push({
      dish_id: dishId,
      quantity: val.quantity
    });
  });

  const btn = document.getElementById('btnSubmitOrder');
  btn.disabled = true;
  btn.textContent = 'Đang xử lý...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: parseInt(tableId, 10),
        notes,
        items
      })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Tạo đơn hàng ${json.data.order_code} thành công!`, 'success');
      closeModal('orderModal');
      await Promise.all([loadTables(), loadOrders(), fetchSummaryStats()]);
      
      // Chuyển sang tab Đơn hàng để xem ngay
      document.querySelector('.tab-btn[data-tab="orders"]').click();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi khi gửi yêu cầu: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Xác Nhận Tạo Đơn';
  }
}

// 6. Modal Thêm Món Ăn Mới
function openAddDishModal() {
  document.getElementById('dishName').value = '';
  document.getElementById('dishPrice').value = '';
  document.getElementById('dishDesc').value = '';
  document.getElementById('dishModal').classList.add('active');
}

async function submitCreateDish() {
  const name = document.getElementById('dishName').value.trim();
  const category = document.getElementById('dishCategory').value;
  const price = parseFloat(document.getElementById('dishPrice').value);
  const description = document.getElementById('dishDesc').value.trim();

  if (!name || isNaN(price) || price < 0) {
    showToast('Vui lòng nhập tên và giá hợp lệ!', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/dishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, price, description, status: 'CON_HANG' })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Đã thêm món [${name}] vào thực đơn!`, 'success');
      closeModal('dishModal');
      loadDishes();
    } else {
      showToast(json.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi thêm món: ' + err.message, 'error');
  }
}

function viewOrdersOfTable(tableId) {
  document.querySelector('.tab-btn[data-tab="orders"]').click();
  const order = state.orders.find(o => o.table_id === tableId && !['DA_THANH_TOAN', 'DA_HUY'].includes(o.status));
  if (order) {
    showToast(`Đang xem đơn hàng của bàn #${tableId}`, 'info');
  }
}

// Đóng modal
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Toast thông báo
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
