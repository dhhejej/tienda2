// State Management
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let orders = [];

// Sobrescribir fetch globalmente para inyectar token JWT si existe en localStorage
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const token = localStorage.getItem('token');
  if (token) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  return originalFetch(url, options);
};

// DOM Elements
const productList = document.getElementById('product-list');
const ordersList = document.getElementById('orders-list');
const cartBadge = document.getElementById('cart-badge');
const cartDrawer = document.getElementById('cart-drawer');
const cartToggle = document.getElementById('cart-toggle');
const closeCart = document.getElementById('close-cart');
const drawerOverlay = document.getElementById('drawer-overlay');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartSubtotal = document.getElementById('cart-subtotal');
const cartTotal = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const toast = document.getElementById('toast');

const navCatalogBtn = document.getElementById('nav-catalog-btn');
const navOrdersBtn = document.getElementById('nav-orders-btn');
const navAdminBtn = document.getElementById('nav-admin-btn');
const navAuthBtn = document.getElementById('nav-auth-btn');

// Elementos de Autenticación
const authView = document.getElementById('auth-view');
const authLogoutBtn = document.getElementById('auth-logout-btn');
const userDisplayName = document.getElementById('user-display-name');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const goToRegisterBtn = document.getElementById('go-to-register');
const goToLoginBtn = document.getElementById('go-to-login');

// Elementos de la Pasarela de Pago
const paymentModal = document.getElementById('payment-modal');
const closePayment = document.getElementById('close-payment');
const paymentForm = document.getElementById('payment-form');
const cardNumberInput = document.getElementById('card-number');
const cardHolderInput = document.getElementById('card-holder');
const cardExpiryInput = document.getElementById('card-expiry');
const cardCvvInput = document.getElementById('card-cvv');
const previewNumber = document.getElementById('preview-number');
const previewHolder = document.getElementById('preview-holder');
const previewExpiry = document.getElementById('preview-expiry');
const payNowBtn = document.getElementById('pay-now-btn');

const catalogView = document.getElementById('catalog-view');
const ordersView = document.getElementById('orders-view');
const adminView = document.getElementById('admin-view');

const addProductForm = document.getElementById('add-product-form');
const inventoryList = document.getElementById('inventory-list');
const usersList = document.getElementById('users-list');
const userOrdersModal = document.getElementById('user-orders-modal');
const closeUserOrdersModal = document.getElementById('close-user-orders-modal');
const userOrdersModalTitle = document.getElementById('user-orders-modal-title');
const userOrdersContainer = document.getElementById('user-orders-container');


// Fetch Catalog
async function fetchCatalog() {
  try {
    const res = await fetch('/api/products');
    products = await res.json();
    renderCatalog();
    renderInventory();
    updateCartUI();
  } catch (err) {
    showToast('Error cargando los productos');
    console.error(err);
  }
}

// Fetch Orders
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    orders = await res.json();
    renderOrders();
  } catch (err) {
    showToast('Error cargando el historial de órdenes');
    console.error(err);
  }
}

// Render Products Catalog
function renderCatalog() {
  productList.innerHTML = '';
  products.forEach(p => {
    const inCartQty = getCartItemQty(p.id);
    const availableStock = p.stock - inCartQty;
    const isOutOfStock = availableStock <= 0;

    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-info">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-desc">${escapeHtml(p.description)}</p>
        <div class="product-meta">
          <span class="product-price">$${p.price.toLocaleString('es-MX')} MXN</span>
          <span class="stock-status ${p.stock > 0 ? 'stock-in' : 'stock-out'}">
            ${p.stock > 0 ? `Stock: ${p.stock}` : 'Agotado'}
          </span>
        </div>
      </div>
      <button class="add-to-cart-btn" ${isOutOfStock ? 'disabled' : ''} onclick="addToCart('${p.id}')">
        ${isOutOfStock ? 'Sin Stock' : 'Añadir al Carrito'}
      </button>
    `;
    productList.appendChild(card);
  });
}

// Helper to escape HTML to prevent XSS
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Get item quantity currently in cart
function getCartItemQty(productId) {
  const item = cart.find(item => item.productId === productId);
  return item ? item.quantity : 0;
}

// Add Item to Cart
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const cartItem = cart.find(item => item.productId === productId);
  const currentQty = cartItem ? cartItem.quantity : 0;

  if (currentQty >= product.stock) {
    showToast(`No hay suficiente stock de ${product.name}`);
    return;
  }

  if (cartItem) {
    cartItem.quantity++;
  } else {
    cart.push({
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity: 1
    });
  }

  saveCart();
  updateCartUI();
  renderCatalog();
  showToast(`Añadido: ${product.name}`);
}

// Remove/Decrease quantity in cart
function decreaseCartQty(productId) {
  const cartItem = cart.find(item => item.productId === productId);
  if (!cartItem) return;

  cartItem.quantity--;
  if (cartItem.quantity <= 0) {
    cart = cart.filter(item => item.productId !== productId);
  }

  saveCart();
  updateCartUI();
  renderCatalog();
}

// Increase quantity in cart
function increaseCartQty(productId) {
  const product = products.find(p => p.id === productId);
  const cartItem = cart.find(item => item.productId === productId);
  if (!product || !cartItem) return;

  if (cartItem.quantity >= product.stock) {
    showToast(`Límite de stock alcanzado para ${product.name}`);
    return;
  }

  cartItem.quantity++;
  saveCart();
  updateCartUI();
  renderCatalog();
}

// Save Cart to LocalStorage
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Update Cart Badge and Drawer UI
function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartBadge.innerText = totalItems;

  cartItemsContainer.innerHTML = '';
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<div class="empty-cart-message"><p>Tu carrito está vacío</p></div>';
    checkoutBtn.disabled = true;
    cartSubtotal.innerText = '$0.00';
    cartTotal.innerText = '$0.00';
    return;
  }

  checkoutBtn.disabled = false;
  let subtotal = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;

    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item';
    itemEl.innerHTML = `
      <div class="cart-item-info">
        <h4>${escapeHtml(item.productName)}</h4>
        <p>$${item.price.toLocaleString('es-MX')} MXN c/u • $${itemTotal.toLocaleString('es-MX')} MXN</p>
      </div>
      <div class="cart-item-actions">
        <button class="qty-btn" onclick="decreaseCartQty('${item.productId}')">-</button>
        <span class="qty-val">${item.quantity}</span>
        <button class="qty-btn" onclick="increaseCartQty('${item.productId}')">+</button>
        <button class="remove-item-btn" onclick="removeFromCart('${item.productId}')">&times;</button>
      </div>
    `;
    cartItemsContainer.appendChild(itemEl);
  });

  cartSubtotal.innerText = `$${subtotal.toLocaleString('es-MX')} MXN`;
  cartTotal.innerText = `$${subtotal.toLocaleString('es-MX')} MXN`;
}

// Render Orders History
function renderOrders() {
  ordersList.innerHTML = '';
  if (orders.length === 0) {
    ordersList.innerHTML = '<div class="no-orders-message"><p>No has realizado ninguna compra todavía.</p></div>';
    return;
  }

  orders.forEach(o => {
    const dateStr = new Date(o.createdAt).toLocaleString('es-MX', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const card = document.createElement('div');
    card.className = 'order-card';
    
    let itemsHtml = '';
    o.items.forEach(item => {
      itemsHtml += `
        <div class="order-item-row">
          <span><span class="order-item-qty">${item.quantity}x</span> ${escapeHtml(item.productName)}</span>
          <span>$${(item.price * item.quantity).toLocaleString('es-MX')} MXN</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="order-header">
        <div>
          <span class="order-title">Orden #${o.id.substring(6)}</span>
          <div class="order-date">${dateStr}</div>
        </div>
        <span class="order-status-badge">${o.status}</span>
      </div>
      <div class="order-items-list">
        ${itemsHtml}
      </div>
      <div class="order-total-row">
        <span>Total Pagado</span>
        <span>$${o.total.toLocaleString('es-MX')} MXN</span>
      </div>
    `;
    ordersList.appendChild(card);
  });
}

// Open/Close Cart Drawer
function toggleCartDrawer(open) {
  if (open) {
    cartDrawer.classList.add('open');
    drawerOverlay.classList.add('open');
  } else {
    cartDrawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
  }
}

// Open/Close Payment Modal
function togglePaymentModal(open) {
  if (open) {
    paymentModal.classList.add('open');
    drawerOverlay.classList.add('open');
    
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    payNowBtn.innerText = `Pagar $${subtotal.toLocaleString('es-MX')} MXN y Confirmar Compra`;
  } else {
    paymentModal.classList.remove('open');
    drawerOverlay.classList.remove('open');
    paymentForm.reset();
    resetCardPreview();
  }
}

function resetCardPreview() {
  previewNumber.innerText = '•••• •••• •••• ••••';
  previewHolder.innerText = 'NOMBRE COMPLETO';
  previewExpiry.innerText = 'MM/AA';
}

// Confirm Purchase / Redirect to Stripe Checkout
async function checkout() {
  if (cart.length === 0) return;

  const token = localStorage.getItem('token');
  if (!token) {
    showToast('Inicia sesión para poder realizar tu compra.');
    toggleCartDrawer(false);
    switchView('auth');
    return;
  }

  checkoutBtn.disabled = true;
  checkoutBtn.innerText = 'Redirigiendo a Stripe... 💳';

  try {
    const res = await fetch('/api/payments/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar el pago.');
    }

    // Redirigir a la pasarela segura de Stripe
    window.location.href = data.url;
  } catch (err) {
    showToast(err.message || 'Error al iniciar pasarela de pagos.');
    console.error(err);
    checkoutBtn.innerText = 'Confirmar Compra';
    checkoutBtn.disabled = false;
  }
}


// Process Simulated Payment and Submit Order
async function processPayment(e) {
  e.preventDefault();

  const cardNumber = cardNumberInput.value.replace(/\s/g, '');
  const cardHolder = cardHolderInput.value.trim();
  const cardExpiry = cardExpiryInput.value.trim();
  const cardCvv = cardCvvInput.value.trim();

  if (cardNumber.length !== 16 || isNaN(cardNumber)) {
    showToast('El número de tarjeta debe tener 16 dígitos');
    return;
  }
  if (!cardHolder) {
    showToast('Ingresa el nombre del titular');
    return;
  }
  if (cardExpiry.length !== 5 || !cardExpiry.includes('/')) {
    showToast('Fecha de expiración inválida (MM/AA)');
    return;
  }
  if (cardCvv.length !== 3 || isNaN(cardCvv)) {
    showToast('El CVV debe tener 3 dígitos');
    return;
  }

  payNowBtn.disabled = true;
  payNowBtn.innerText = 'Procesando Pago... 🔒';

  setTimeout(async () => {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error procesando la orden');
      }

      showToast('¡Pago Procesado y Compra Realizada con Éxito!');
      cart = [];
      saveCart();
      updateCartUI();
      togglePaymentModal(false);
      
      await fetchCatalog();
      switchView('orders');
    } catch (err) {
      showToast(err.message || 'Error al procesar el pago');
      console.error(err);
    } finally {
      payNowBtn.innerText = 'Pagar y Confirmar Compra';
      payNowBtn.disabled = false;
    }
  }, 1500);
}

// Remove item completely from cart
function removeFromCart(productId) {
  const item = cart.find(i => i.productId === productId);
  if (!item) return;

  cart = cart.filter(i => i.productId !== productId);
  saveCart();
  updateCartUI();
  renderCatalog();
  showToast(`Removido del carrito: ${item.productName}`);
}

// Show Toast Alert
let toastTimeout;
function showToast(message) {
  clearTimeout(toastTimeout);
  toast.innerText = message;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Switch SPA views
function switchView(viewName) {
  const token = localStorage.getItem('token');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // Si no hay token de sesión Y tampoco es administrador, forzar la vista de login/registro
  if (!token && !isAdmin) {
    viewName = 'auth';
  } else if (viewName === 'auth' && token) {
    // Si ya está logueado y va a auth, mandarlo al catálogo
    viewName = 'catalog';
  }

  if (viewName === 'admin' && !isAdmin) {
    showToast('Acceso restringido al administrador.');
    switchView('catalog');
    return;
  }

  navCatalogBtn.classList.remove('active');
  navOrdersBtn.classList.remove('active');
  navAdminBtn.classList.remove('active');
  navAuthBtn.classList.remove('active');
  
  authView.classList.remove('active');
  catalogView.classList.remove('active');
  ordersView.classList.remove('active');
  adminView.classList.remove('active');

  if (viewName === 'catalog') {
    navCatalogBtn.classList.add('active');
    catalogView.classList.add('active');
    fetchCatalog();
  } else if (viewName === 'orders') {
    navOrdersBtn.classList.add('active');
    ordersView.classList.add('active');
    fetchOrders();
  } else if (viewName === 'admin') {
    navAdminBtn.classList.add('active');
    adminView.classList.add('active');
    fetchCatalog();
    fetchUsers();
  } else if (viewName === 'auth') {
    navAuthBtn.classList.add('active');
    authView.classList.add('active');
  }
}

// Event Listeners
cartToggle.addEventListener('click', () => toggleCartDrawer(true));
closeCart.addEventListener('click', () => toggleCartDrawer(false));
drawerOverlay.addEventListener('click', () => {
  toggleCartDrawer(false);
  togglePaymentModal(false);
  toggleUserOrdersModal(false);
});
checkoutBtn.addEventListener('click', checkout);
closePayment.addEventListener('click', () => togglePaymentModal(false));
paymentForm.addEventListener('submit', processPayment);

// Formateadores e Interactividad de la Tarjeta de Crédito
cardNumberInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');
  let formatted = '';
  for (let i = 0; i < value.length; i++) {
    if (i > 0 && i % 4 === 0) {
      formatted += ' ';
    }
    formatted += value[i];
  }
  e.target.value = formatted;
  previewNumber.innerText = formatted || '•••• •••• •••• ••••';
});

cardHolderInput.addEventListener('input', (e) => {
  let value = e.target.value.toUpperCase();
  e.target.value = value;
  previewHolder.innerText = value || 'NOMBRE COMPLETO';
});

cardExpiryInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4);
  }
  e.target.value = value;
  previewExpiry.innerText = value || 'MM/AA';
});

cardCvvInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

navCatalogBtn.addEventListener('click', () => switchView('catalog'));
navOrdersBtn.addEventListener('click', () => switchView('orders'));
navAdminBtn.addEventListener('click', () => switchView('admin'));
navAuthBtn.addEventListener('click', () => switchView('auth'));
addProductForm.addEventListener('submit', handleAddProductSubmit);

// Render Inventory in Admin Panel
function renderInventory() {
  inventoryList.innerHTML = '';
  if (products.length === 0) {
    inventoryList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem 0;">No hay productos registrados</td></tr>';
    return;
  }
  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${escapeHtml(p.id)}</code></td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>$${p.price.toLocaleString('es-MX')} MXN</td>
      <td>${p.stock} uds</td>
      <td>
        <button class="delete-btn" onclick="deleteProduct('${p.id}')">Eliminar</button>
      </td>
    `;
    inventoryList.appendChild(tr);
  });
}

// Delete Product
async function deleteProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (!confirm(`¿Estás seguro de que deseas eliminar "${product.name}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al eliminar el producto');
    }

    showToast('Producto eliminado exitosamente');
    
    // Quitar del carrito si existía
    cart = cart.filter(item => item.productId !== productId);
    saveCart();

    await fetchCatalog();
  } catch (err) {
    showToast(err.message || 'Error al eliminar el producto');
    console.error(err);
  }
}

// Add Product Form Submit Handler
async function handleAddProductSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('prod-id').value.trim();
  const name = document.getElementById('prod-name').value.trim();
  const description = document.getElementById('prod-desc').value.trim();
  const price = Number(document.getElementById('prod-price').value);
  const stock = Number(document.getElementById('prod-stock').value);

  if (!id || !name || price <= 0 || stock < 0) {
    showToast('Por favor completa todos los campos correctamente');
    return;
  }

  if (products.some(p => p.id === id)) {
    showToast(`El ID "${id}" ya está en uso.`);
    return;
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id, name, description, price, stock })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al guardar el producto');
    }

    showToast('Producto creado con éxito');
    addProductForm.reset();
    
    await fetchCatalog();
  } catch (err) {
    showToast(err.message || 'Error al guardar el producto');
    console.error(err);
  }
}

// Global exposure for HTML click handlers
window.addToCart = addToCart;
window.decreaseCartQty = decreaseCartQty;
window.increaseCartQty = increaseCartQty;
window.deleteProduct = deleteProduct;
window.removeFromCart = removeFromCart;

// Controlar cambio entre formularios en la vista principal de Auth
function showLoginForm() {
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
}

function showRegisterForm() {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
}

// Iniciar Sesión / Cerrar Sesión Acción del Botón del Header
function handleAuthAction() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isAdmin');
  showToast('Sesión cerrada correctamente');
  checkAuthStatus();
}

// Verificar el Estado de Autenticación
function checkAuthStatus() {
  // Procesar primero parámetros admin en URL
  checkAdminAccess();

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  if (isAdmin || (token && userStr)) {
    try {
      if (token && userStr) {
        const user = JSON.parse(userStr);
        userDisplayName.innerText = `Hola, ${user.name}`;
      } else {
        userDisplayName.innerText = `Hola, Servidor`;
      }
      userDisplayName.style.display = 'inline';
      authLogoutBtn.style.display = 'inline-block';
      navAuthBtn.style.display = 'none';
      
      // Mostrar catálogo y carrito
      navCatalogBtn.style.display = 'inline-block';
      cartToggle.style.display = 'flex';

      // Si es admin (por parámetro URL o rol en token), habilitar botones de administración
      const user = userStr ? JSON.parse(userStr) : null;
      if (isAdmin || (user && user.role === 'admin')) {
        navOrdersBtn.style.display = 'inline-block';
        navAdminBtn.style.display = 'inline-block';
      } else {
        navOrdersBtn.style.display = 'none';
        navAdminBtn.style.display = 'none';
      }
      
      // Si la vista actual es la de auth, redirigir al catálogo
      if (authView.classList.contains('active')) {
        switchView('catalog');
      }
    } catch (e) {
      console.error(e);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      checkAuthStatus();
    }
  } else {
    userDisplayName.style.display = 'none';
    authLogoutBtn.style.display = 'none';
    navAuthBtn.style.display = 'inline-block';
    
    // Ocultar catálogo, pedidos, admin y carrito si no hay sesión
    navCatalogBtn.style.display = 'none';
    navOrdersBtn.style.display = 'none';
    navAdminBtn.style.display = 'none';
    cartToggle.style.display = 'none';
    
    switchView('auth');
  }
}

// Auto-login del administrador si usa la URL secreta
async function autoLoginAdmin() {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@tecnonova.com', password: 'adminpassword123' })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('isAdmin', 'true');
      checkAuthStatus();
      showToast('Acceso directo del Administrador autorizado.');
    }
  } catch (e) {
    console.error('Error en autoLoginAdmin:', e);
  }
}

// Admin Access Checker (Acceso oculto por parámetro de URL)
function checkAdminAccess() {
  const params = new URLSearchParams(window.location.search);
  const adminParam = params.get('admin');

  if (adminParam === 'tecnonova-admin') {
    localStorage.setItem('isAdmin', 'true');
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    autoLoginAdmin();
  } else if (adminParam === 'logout') {
    localStorage.removeItem('isAdmin');
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  }

  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  if (isAdmin || (user && user.role === 'admin')) {
    navOrdersBtn.style.display = 'inline-block';
    navAdminBtn.style.display = 'inline-block';
  } else {
    navOrdersBtn.style.display = 'none';
    navAdminBtn.style.display = 'none';
  }
}

// Handlers para los formularios de login y registro
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al iniciar sesión');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.user.role === 'admin') {
      localStorage.setItem('isAdmin', 'true');
    } else {
      localStorage.removeItem('isAdmin');
    }
    
    showToast(`¡Bienvenido, ${data.user.name}!`);
    checkAuthStatus();
    switchView('catalog');
  } catch (err) {
    showToast(err.message || 'Error de autenticación');
    console.error(err);
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error en el registro');
    }

    showToast('¡Registro exitoso! Ya puedes iniciar sesión.');
    showLoginForm();
  } catch (err) {
    showToast(err.message || 'Error al registrarse');
    console.error(err);
  }
}

// Event Listeners de Autenticación
authLogoutBtn.addEventListener('click', handleAuthAction);
goToRegisterBtn.addEventListener('click', (e) => {
  e.preventDefault();
  showRegisterForm();
});
goToLoginBtn.addEventListener('click', (e) => {
  e.preventDefault();
  showLoginForm();
});
loginForm.addEventListener('submit', handleLoginSubmit);
registerForm.addEventListener('submit', handleRegisterSubmit);
closeUserOrdersModal.addEventListener('click', () => toggleUserOrdersModal(false));

// Controlar Modal de Pedidos del Usuario
function toggleUserOrdersModal(open) {
  if (open) {
    userOrdersModal.classList.add('open');
    drawerOverlay.classList.add('open');
  } else {
    userOrdersModal.classList.remove('open');
    drawerOverlay.classList.remove('open');
  }
}

// Obtener y Renderizar Lista de Usuarios (Admin)
async function fetchUsers() {
  try {
    const res = await fetch('/api/auth/users');
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener usuarios');
    }

    renderUsers(data);
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    usersList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0;">Error al cargar los usuarios registrados</td></tr>';
  }
}

function renderUsers(users) {
  usersList.innerHTML = '';
  if (users.length === 0) {
    usersList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0;">No hay usuarios registrados</td></tr>';
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(u.name)}</strong></td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="status-badge" style="background: ${u.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)'}; color: ${u.role === 'admin' ? '#c084fc' : '#60a5fa'};">${escapeHtml(u.role)}</span></td>
      <td>
        <button class="delete-btn" onclick="showUserOrders('${u.id}', '${escapeHtml(u.name)}')" style="background: var(--accent-primary); border-color: var(--accent-primary); color: white; padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 500;">Ver Compras</button>
      </td>
    `;
    usersList.appendChild(tr);
  });
}

// Consultar Historial de Compras de un Usuario Específico (Admin)
async function showUserOrders(userId, userName) {
  try {
    userOrdersModalTitle.innerText = `Pedidos de ${userName}`;
    userOrdersContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem 0;">Cargando historial de compras...</p>';
    toggleUserOrdersModal(true);

    const res = await fetch(`/api/orders?userId=${userId}`);
    const orders = await res.json();

    if (!res.ok) {
      throw new Error(orders.error || 'Error al obtener los pedidos del usuario');
    }

    renderUserOrders(orders);
  } catch (err) {
    showToast(err.message || 'Error al obtener historial del usuario');
    console.error(err);
  }
}

function renderUserOrders(orders) {
  userOrdersContainer.innerHTML = '';
  if (orders.length === 0) {
    userOrdersContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem 0;">Este usuario no tiene compras registradas en el servidor.</p>';
    return;
  }

  orders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card';
    card.style.background = 'rgba(255, 255, 255, 0.02)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.padding = '1.2rem';
    card.style.marginBottom = '1rem';

    const dateStr = new Date(order.createdAt).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let itemsHtml = order.items.map(item => `
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.4rem;">
        <span>${escapeHtml(item.productName)} x ${item.quantity}</span>
        <span>$${(item.price * item.quantity).toLocaleString('es-MX')} MXN</span>
      </div>
    `).join('');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.6rem; margin-bottom: 0.6rem;">
        <div>
          <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); display: block;">${order.id}</span>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${dateStr}</span>
        </div>
        <span class="status-badge status-paid">PAID</span>
      </div>
      <div>
        ${itemsHtml}
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 600; border-top: 1px solid var(--border-color); margin-top: 0.6rem; padding-top: 0.6rem; color: var(--text-primary);">
        <span>Total de la Compra</span>
        <span>$${order.total.toLocaleString('es-MX')} MXN</span>
      </div>
    `;
    userOrdersContainer.appendChild(card);
  });
}

// Exponer globalmente las funciones necesarias en onclick inline
window.showUserOrders = showUserOrders;

// Init
checkAuthStatus();
fetchCatalog();
