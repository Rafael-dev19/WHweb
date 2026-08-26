// public/assets/js/app.js — Estado global y helpers compartidos
const API_BASE_URL = '/api';

const AppState = {
  usuario: null,
  carrito: [],
  carritoTotal: 0,
  carritoCount: 0
};

document.addEventListener('DOMContentLoaded', () => {
  cargarCarritoDesdeStorage();
  actualizarBadgeCarrito();
  verificarSesion();
  inicializarMenuMovil();
});

function cargarCarritoDesdeStorage() {
  try {
    const carritoGuardado = sessionStorage.getItem('wh_carrito');
    if (carritoGuardado) {
      AppState.carrito = JSON.parse(carritoGuardado);
      calcularTotalesCarrito();
    } else {
      AppState.carrito = [];
      AppState.carritoCount = 0;
    }
  } catch (error) {
    console.error('Error al cargar carrito:', error);
    AppState.carrito = [];
    AppState.carritoCount = 0;
  }
}

function guardarCarritoEnStorage() {
  try {
    sessionStorage.setItem('wh_carrito', JSON.stringify(AppState.carrito));
  } catch (error) {
    console.error('Error al guardar carrito:', error);
  }
}

function calcularTotalesCarrito() {
  AppState.carritoCount = AppState.carrito.reduce((total, item) => total + item.cantidad, 0);
  AppState.carritoTotal = AppState.carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
}

function actualizarBadgeCarrito() {
  const badge = document.getElementById('cartCount') || document.querySelector('.cart-badge');
  if (badge) {
    badge.textContent = AppState.carritoCount;
    badge.style.display = AppState.carritoCount > 0 ? 'inline-block' : 'none';
  }
}

function agregarAlCarrito(producto) {
  const existente = AppState.carrito.find(item => item.id === producto.id);

  if (existente) {
    existente.cantidad += producto.cantidad || 1;
  } else {
    AppState.carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: producto.cantidad || 1,
      imagen: producto.imagen || null
    });
  }

  calcularTotalesCarrito();
  guardarCarritoEnStorage();
  actualizarBadgeCarrito();

  showNotification(`<i data-lucide="circle-check"></i> ${producto.nombre} agregado al carrito`, 'success');
}

function eliminarDelCarrito(productoId) {
  const index = AppState.carrito.findIndex(item => item.id === productoId);

  if (index !== -1) {
    const producto = AppState.carrito[index];
    AppState.carrito.splice(index, 1);

    calcularTotalesCarrito();
    guardarCarritoEnStorage();
    actualizarBadgeCarrito();

    showNotification(`<i data-lucide="trash-2"></i> ${producto.nombre} eliminado del carrito`, 'info');
    return true;
  }

  return false;
}

function actualizarCantidadCarrito(productoId, nuevaCantidad) {
  const producto = AppState.carrito.find(item => item.id === productoId);

  if (producto) {
    if (nuevaCantidad <= 0) {
      return eliminarDelCarrito(productoId);
    }

    producto.cantidad = nuevaCantidad;
    calcularTotalesCarrito();
    guardarCarritoEnStorage();
    actualizarBadgeCarrito();
    return true;
  }

  return false;
}

function vaciarCarrito() {
  AppState.carrito = [];
  AppState.carritoCount = 0;
  AppState.carritoTotal = 0;

  guardarCarritoEnStorage();
  actualizarBadgeCarrito();

  showNotification('<i data-lucide="trash-2"></i> Carrito vaciado', 'info');
}

function obtenerCarrito() {
  return {
    items: AppState.carrito,
    total: AppState.carritoTotal,
    count: AppState.carritoCount
  };
}

async function verificarSesion() {
  try {
    const token = localStorage.getItem('wh_token');

    if (!token) {
      AppState.usuario = null;
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/usuarios/me.php`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      AppState.usuario = data.usuario;
      return true;
    } else {
      localStorage.removeItem('wh_token');
      AppState.usuario = null;
      return false;
    }

  } catch (error) {
    console.error('Error al verificar sesión:', error);
    return false;
  }
}

function cerrarSesion() {
  localStorage.removeItem('wh_token');
  AppState.usuario = null;

  showNotification('<i data-lucide="log-out"></i> Sesión cerrada', 'info');

  setTimeout(() => {
    window.location.href = '/login';
  }, 1000);
}

function inicializarMenuMovil() {
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (!menuToggle || !navLinks) return;

  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
    menuToggle.innerHTML = isOpen ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.innerHTML = '<i data-lucide="menu"></i>';
      }
    });
  });
}

async function apiRequest(endpoint, options = {}) {
  const defaultOptions = {
    headers: { 'Content-Type': 'application/json' }
  };

  const token = localStorage.getItem('wh_token');
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: { ...defaultOptions.headers, ...(options.headers || {}) }
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, finalOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}`);
    }

    return data;

  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

window.WoodenHouse = {
  getState: () => AppState,
  agregarAlCarrito,
  eliminarDelCarrito,
  actualizarCantidadCarrito,
  vaciarCarrito,
  obtenerCarrito,
  verificarSesion,
  cerrarSesion,
  getUsuario: () => AppState.usuario,
  apiRequest
};
