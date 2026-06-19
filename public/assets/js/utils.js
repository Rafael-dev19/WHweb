// ── VALIDACIONES ──────────────────────────────────────

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
}

function isValidCurrency(value) {
  return !isNaN(parseFloat(value)) && parseFloat(value) > 0;
}

// ── FORMATEO ──────────────────────────────────────────

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatNumber(number) {
  return new Intl.NumberFormat('es-MX').format(number);
}

function getFromStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    return false;
  }
}

function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing from localStorage:', error);
    return false;
  }
}

// ── API HELPERS ───────────────────────────────────────

async function apiRequest(endpoint, options = {}) {
  const API_BASE = '/api';

  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const config = { ...defaultOptions, ...options };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error en la petición');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ── SEGURIDAD: HTML SEGURO ────────────────────────────
// Sanitiza HTML antes de inyectarlo en el DOM.
// Usa DOMPurify si está disponible (cargado en páginas con contenido
// dinámico de usuario); si no, escapa entidades como fallback seguro.

function safeHtml(dirty) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
  }
  // Fallback: escape de entidades HTML (sin interpretar etiquetas)
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(dirty).replace(/[&<>"']/g, c => map[c]);
}

// Versión asíncrona para innerHTML cuando DOMPurify no está precargado
function setInnerHTMLSafe(element, html) {
  if (typeof DOMPurify !== 'undefined') {
    element.innerHTML = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  } else {
    // Sin DOMPurify: construir el DOM manualmente para evitar XSS
    const tmp = document.createElement('template');
    tmp.innerHTML = html;
    element.replaceChildren(...tmp.content.childNodes);
  }
}

// ── DOM HELPERS ───────────────────────────────────────

function showLoader(message = 'Cargando...') {
  const loader = document.createElement('div');
  loader.id = 'global-loader';
  loader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    color: white;
  `;
  // Construir con DOM API en lugar de innerHTML para evitar XSS en el mensaje
  const icon = document.createElement('div');
  icon.style.cssText = 'font-size: 48px; margin-bottom: 20px; color: #8b7355;';
  icon.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  const texto = document.createElement('div');
  texto.style.fontSize = '18px';
  texto.textContent = message;   // textContent no interpreta HTML
  loader.append(icon, texto);
  document.body.appendChild(loader);
  return loader;
}

function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.remove();
  }
}

function showNotification(message, type = 'info', duration = 4000) {
  const colors = {
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3'
  };

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: ${colors[type] || colors.info};
    color: white;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideInRight 0.3s ease;
    max-width: 400px;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function createElement(tag, className, content = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.innerHTML = content;
  return element;
}

// ── DEBOUNCE ──────────────────────────────────────────

function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ── URL HELPERS ───────────────────────────────────────

function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function setUrlParam(param, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  window.history.pushState({}, '', url);
}

// ── STRING HELPERS ────────────────────────────────────

function truncate(str, maxLength = 100) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ── ARRAY HELPERS ─────────────────────────────────────

function groupBy(array, key) {
  return array.reduce((result, item) => {
    (result[item[key]] = result[item[key]] || []).push(item);
    return result;
  }, {});
}

function unique(array) {
  return [...new Set(array)];
}

function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── EXPORT (para ES6 modules si es necesario) ─────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isValidEmail,
    isValidPhone,
    formatCurrency,
    formatDate,
    formatDateTime,
    getFromStorage,
    saveToStorage,
    removeFromStorage,
    apiRequest,
    showLoader,
    hideLoader,
    showNotification,
    debounce,
    getUrlParam,
    truncate,
    slugify,
    groupBy,
    unique
  };
}

