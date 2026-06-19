# Wooden House — Sitio Web

Plataforma e-commerce completa para la venta y gestión de muebles de baño a medida.
Incluye catálogo, carrito, cuentas de cliente, proceso de pago, cotizaciones, sistema de ofertas/marketing y paneles de administrador y empleado.

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Utilidades JS | Bootstrap 5.3.3 bundle (solo para compatibilidad; dropdowns y nav son custom CSS/JS) |
| Backend | PHP 8+ |
| Base de datos | MySQL 8 / MariaDB 10.4+ |
| Autenticación | Firebase Auth SDK v10 modular (dynamic import) |
| Base de datos RT | Firebase Firestore SDK v10 compat |
| Almacenamiento | Firebase Storage SDK v10 compat |
| Cloud Functions | Firebase Functions v2 (Node.js 22) |
| Pasarela 1 | Stripe JS v3 + PHP vía cURL |
| Pasarela 2 | PayPal JS SDK v5 + REST API v2 |
| Correos | Firebase Cloud Functions → Brevo API (correos transaccionales) |
| Iconos | Font Awesome 6.5.1 (cdnjs.cloudflare.com) |
| Exportación Excel | SheetJS (xlsx) 0.20.3 — genera archivos `.xlsx` reales |
| QR (2FA setup) | api.qrserver.com — imagen generada sin librería JS |
| Servidor | Apache 2.4+ con mod_rewrite |
| Control versiones | Git + GitHub |

---

## Estructura del proyecto

```
Wooden House/
├── public/                          # Raíz pública (DocumentRoot del servidor)
│   ├── index.php                    # Página de inicio
│   ├── catalogo.php                 # Catálogo de productos
│   ├── detalle_producto.php         # Detalle de un producto
│   ├── carrito-checkout.php         # Carrito + forma de pago (completo/anticipo) + fecha de entrega
│   ├── pago.php                     # Proceso de pago (Stripe + PayPal) + modo "pagar saldo pendiente"
│   ├── solicitudes.php              # Cotizaciones y citas (seguimiento es módulo aparte)
│   ├── seguimiento.php              # Seguimiento público de pedidos/cotizaciones/citas por folio
│   ├── mi-cuenta.php                # Portal del cliente registrado (pedidos, perfil)
│   ├── invitacion.php               # Página pública de activación de cuenta para empleados invitados
│   ├── login.php                    # Redirige a /inicio; AuthModal maneja el login
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── .htaccess                    # URLs limpias + CSP estricta + HTTPS + caché + compresión
│   ├── admin/
│   │   └── panel_administrador.php  # Panel completo del administrador
│   ├── empleado/
│   │   └── panel_empleado.php       # Panel del empleado
│   └── assets/
│       ├── css/
│       │   ├── variables.css        # Variables globales — paleta ámbar premium
│       │   ├── styles.css           # Estilos compartidos (header, footer, nav)
│       │   ├── animations.css       # Animaciones, reveal, skeleton, lightbox
│       │   ├── index.css
│       │   ├── catalogo.css
│       │   ├── carrito.css          # Incluye estilos del selector de fechas
│       │   ├── pago.css
│       │   ├── solicitudes.css      # Incluye decision cards y status badges
│       │   ├── login.css
│       │   ├── detalle_producto.css
│       │   ├── panel_administrador.css
│       │   ├── panel_empleado.css
│       │   ├── modal-auth.css       # Modal de login/registro + barra móvil inferior
│       │   ├── mi-cuenta.css        # Estilos del portal del cliente
│       │   └── terminos.css
│       ├── js/
│       │   ├── utils.js             # Funciones compartidas
│       │   ├── firebase-config.js   # Inicialización Firebase (Auth+Firestore+Storage)
│       │   ├── event-delegation.js  # Delegación central de eventos + lightbox de imágenes
│       │   ├── page-init.js         # Inicialización (alertas, Escape modal, URL params)
│       │   ├── animations.js        # IntersectionObserver scroll-reveal + ripple
│       │   ├── index.js             # Inicio (FAQ, animaciones)
│       │   ├── catalogo.js          # Carga de productos, filtros y carrito
│       │   ├── detalle_producto.js  # Galería, tabs, agregar al carrito
│       │   ├── carrito.js           # Gestión del carrito (sessionStorage)
│       │   ├── checkout.js          # Selector de fechas y validación
│       │   ├── pago.js              # Stripe Elements + PayPal Buttons
│       │   ├── solicitudes.js       # Cotizaciones, citas y seguimiento (tabs)
│       │   ├── panel_administrador.js  # Panel admin con auto-polling 30s + gestión 2FA
│       │   ├── panel_empleado.js    # Panel empleado con auto-polling 30s + gestión 2FA
│       │   ├── modal-auth.js        # Modal de autenticación + overlay verificación 2FA
│       │   └── mi-cuenta.js         # Lógica del portal del cliente
│       └── img/
│           ├── logo-header.png
│           └── logo-login.png
│
├── api/                             # Endpoints REST (PHP)
│   ├── _helpers.php                 # Funciones comunes de API (auth, sanitize, JSON)
│   ├── auth.php                     # Verificación tokens Firebase JWT + flags 2FA (personal + clientes)
│   ├── clientes.php                 # CRUD clientes registrados (e-commerce)
│   ├── ofertas.php                  # CRUD ofertas, descuentos y códigos promo
│   ├── productos.php                # CRUD productos + imágenes + especificaciones
│   ├── categorias.php               # CRUD categorías
│   ├── pedidos.php                  # CRUD pedidos + cambio de estado
│   ├── disponibilidad.php           # Fechas disponibles según capacidad real
│   ├── capacidad.php                # Gestión de slots de producción (admin)
│   ├── cotizaciones.php             # CRUD cotizaciones + flujo de 8 estados de producción
│   ├── citas.php                    # CRUD citas y calendario
│   ├── invitaciones.php             # Sistema de invitaciones de personal (crear/validar/activar)
│   ├── empleados.php                # CRUD empleados (Firebase Auth + MySQL)
│   ├── notificaciones.php           # Notificaciones vía Firestore REST
│   ├── pagos.php                    # Stripe + PayPal: crear, capturar, webhooks
│   ├── reportes.php                 # Reportes: resumen, pedidos, productos, ingresos, clientes
│   ├── calendario.php               # Disponibilidad del calendario de citas
│   └── .htaccess                    # CORS + bloqueo de acceso directo + preflight OPTIONS
│
├── includes/                        # Helpers PHP del servidor
│   ├── config.php                   # Constantes de configuración (lee .env)
│   ├── db.php                       # Conexión MySQL (PDO singleton)
│   ├── auth.php                     # Verificación de token Firebase + sesión PHP + revocación 2FA
│   ├── functions.php                # Helpers generales (sanitize, logs, Firestore)
│   ├── notifications.php            # Escritura en Firestore → Cloud Functions envían correos
│   ├── stripe.php                   # Wrapper de la API de Stripe vía cURL
│   └── paypal.php                   # Wrapper de la API de PayPal + verificación de webhooks
│
├── database/
│   ├── schema.sql                   # Estructura completa actualizada (15 tablas + migraciones integradas)
│   ├── seed.sql                     # Datos de prueba + festivos 2026
│   ├── invitaciones_migration.sql   # Migración: tabla invitaciones_personal (ya aplicada en servidor)
│   └── cotizaciones_produccion_migration.sql  # Migración: flujo de producción cotizaciones (ya aplicada)
│
├── firebase/
│   ├── firebase.json                # Configuración: Firestore, Storage, Functions, Hosting, Emulators
│   ├── firestore.rules              # Reglas de seguridad Firestore (colección notificaciones)
│   ├── firestore.indexes.json       # Índices compuestos para consultas ordenadas
│   ├── storage.rules                # Reglas de seguridad Storage (imágenes de productos)
│   └── functions/
│       ├── package.json             # Dependencias (firebase-admin, firebase-functions, nodemailer, axios)
│       └── index.js                 # Cloud Functions (Firestore triggers → correos vía Brevo):
│                                    #   · nuevo_pedido          — confirma pedido al cliente + CC empleados
│                                    #   · nueva_cita            — confirma cita al cliente + CC empleados
│                                    #   · nueva_cotizacion      — avisa al admin de nueva solicitud
│                                    #   · cotizacion_respondida — precio y propuesta al cliente
│                                    #   · cotizacion_en_produccion — orden de fabricación (cliente + empleados)
│                                    #   · cotizacion_lista      — avisa al cliente que está listo
│                                    #   · cotizacion_entregada  — confirmación de entrega al cliente
│                                    #   · invitacion_personal   — enlace de activación al empleado invitado
│                                    #   · estado_pedido         — notifica cambio de estado al cliente
│                                    #   · limpiarNotificacionesAntiguas — scheduled (cada 24 h)
│
├── logs/                            # Logs del servidor (excluidos de Git)
├── .htaccess                        # Redirige a HTTPS + bloquea carpetas internas
├── .env                             # Variables de entorno (excluido de Git)
├── .env.example                     # Plantilla de variables de entorno
├── .gitignore
└── README.md
```

---

## URLs del sitio (URLs limpias)

| URL visible | Archivo real |
|-------------|-------------|
| `/` o `/inicio` | `public/index.php` |
| `/catalogo` | `public/catalogo.php` |
| `/detalle/42` | `public/detalle_producto.php?id=42` |
| `/carrito` | `public/carrito-checkout.php` |
| `/pago` | `public/pago.php` |
| `/solicitudes` | `public/solicitudes.php` |
| `/seguimiento` | `public/solicitudes.php` |
| `/login` | `public/login.php` |
| `/mi-cuenta` | `public/mi-cuenta.php` |
| `/terminos` | `public/terminos.php` |
| `/invitacion` | `public/invitacion.php` |
| `/admin/` | `public/admin/panel_administrador.php` |
| `/empleado/` | `public/empleado/panel_empleado.php` |

> Requiere Apache con `mod_rewrite` activo y `AllowOverride All`.

---

## Base de datos — Tablas

| Tabla | Descripción |
|-------|-------------|
| `usuarios_personal` | Admins y empleados (espejo de Firebase Auth) + campos `totp_secreto`, `totp_activo`, `sesiones_revocadas_desde` |
| `clientes` | Clientes registrados en la tienda (Firebase Auth) + `sesiones_revocadas_desde` |
| `invitaciones_personal` | Tokens de invitación para que empleados creen su propia contraseña (expiran en 48 h) |
| `ofertas` | Descuentos, cupones y promociones de marketing |
| `categorias` | Categorías de productos |
| `productos` | Productos con precio, stock y etiqueta |
| `imagenes_producto` | Galería de imágenes por producto (URLs de Firebase Storage) |
| `especificaciones_producto` | Specs técnicas clave-valor por producto |
| `pedidos` | Pedidos con token de seguimiento y fecha estimada |
| `detalle_pedido` | Líneas de cada pedido (productos + cantidades) |
| `pagos` | Registro de transacciones Stripe y PayPal |
| `cotizaciones` | Solicitudes de cotización — flujo completo de 8 estados de producción |
| `citas` | Citas agendadas (medición e instalación) |
| `capacidad_produccion` | Slots de producción y entrega por semana |
| `dias_bloqueados` | Festivos y cierres del taller |
| `carritos_guardados` | Recuperación de carritos abandonados |

### Inicializar la base de datos

```bash
# 1. Crear la base de datos
mysql -u root -p -e "CREATE DATABASE wooden_house CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Crear estructura completa (ya incluye todas las migraciones)
mysql -u usuario -p wooden_house < database/schema.sql

# 3. Cargar datos de prueba + festivos 2026
mysql -u usuario -p wooden_house < database/seed.sql
```

> **Nota:** Las migraciones `invitaciones_migration.sql` y `cotizaciones_produccion_migration.sql` ya están integradas en `schema.sql`. Solo son necesarias para actualizar instalaciones existentes.

---

## Autenticación 2FA para personal (2026-06-18)

Todo el personal (administrador y empleado) debe completar la verificación de dos factores (TOTP RFC 6238) al iniciar sesión.

### Flujo de login con 2FA

1. El admin/empleado ingresa su correo y contraseña en el modal de auth.
2. El backend verifica el token Firebase en `api/auth.php?action=cliente-login`.
3. Si `totp_activo = 1`: la respuesta incluye `"2fa_required": true` → `modal-auth.js` muestra un overlay de verificación TOTP antes de redirigir.
4. Si `totp_activo = 0` (primer acceso): la respuesta incluye `"2fa_setup": true` → redirige al panel con `?setup_2fa=1`.

### Configuración inicial de 2FA (primer acceso)

Al entrar al panel con `?setup_2fa=1`, se abre automáticamente la sección **Seguridad**, que muestra:

- Un código QR generado por `api.qrserver.com` a partir del `otpauth://` URI del secreto TOTP.
- El secreto en texto (para ingreso manual en Google Authenticator, Authy, etc.).
- Campo para ingresar el primer código de 6 dígitos y confirmar el setup.

El endpoint `GET /api/auth.php?action=2fa-setup` genera el secreto y retorna el `qr_url`. El endpoint `POST /api/auth.php?action=2fa-check` verifica el código ingresado y activa el 2FA.

### Campos en BD (`usuarios_personal`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `totp_secreto` | `VARCHAR(64) NULL` | Secreto Base32 del TOTP (solo se almacena al activar) |
| `totp_activo` | `TINYINT(1) DEFAULT 0` | 1 = 2FA activo y requerido en cada login |
| `sesiones_revocadas_desde` | `TIMESTAMP NULL` | Revocar todas las sesiones anteriores a esta fecha |

---

## Sistema de invitaciones de personal (2026-06-18)

El flujo anterior de creación de empleados tenía dos problemas graves: el admin conocía la contraseña del empleado, y llamar a `createUserWithEmailAndPassword()` desde el panel del admin cerraba la sesión del admin en Firebase. Fue reemplazado por un sistema de invitaciones.

### Flujo

1. El admin abre "Invitar Empleado" en su panel, ingresa nombre, correo y rol.
2. `POST /api/invitaciones.php?action=crear` genera un token de 64 caracteres, lo guarda en `invitaciones_personal` con 48 h de expiración y envía el correo de invitación al empleado.
3. El empleado recibe el correo con el enlace `https://dominio.com/invitacion.php?token=xxx`.
4. En `invitacion.php`, el empleado ve su nombre y correo pre-cargados (solo lectura) y crea su propia contraseña.
5. `POST /api/invitaciones.php?action=activar` crea la cuenta en Firebase Auth, registra al empleado en `usuarios_personal` y marca la invitación como usada.
6. Al entrar al panel por primera vez, `?setup_2fa=1` fuerza la configuración del autenticador TOTP.

### Seguridad del flujo

- El admin **nunca conoce ni toca** la contraseña del empleado.
- El token de invitación es de un solo uso — se invalida al activar.
- Tokens expirados o ya usados devuelven error 404.
- Si el backend falla después de crear la cuenta Firebase, el JS hace `cred.user.delete()` para evitar inconsistencias.

---

## Flujo de producción de cotizaciones (2026-06-18)

Las cotizaciones tienen un ciclo de vida completo de 8 estados que cubre desde la solicitud del cliente hasta la entrega física del mueble.

### Estados y transiciones

```
nueva → en_revision → respondida → aceptada → en_produccion → lista → entregada
                                  ↘                                   ↗
                                   cancelada (desde cualquier estado)
```

| Estado | Descripción | Correo disparado |
|--------|-------------|-----------------|
| `nueva` | El cliente envió la solicitud | Admin notificado en panel |
| `en_revision` | El admin está analizando la solicitud | — |
| `respondida` | El admin envió precio y propuesta al cliente | Cliente recibe precio, descripción y fecha estimada |
| `aceptada` | El cliente aceptó la propuesta | — |
| `en_produccion` | Se inicia la fabricación | Cliente recibe enlace de seguimiento; empleados reciben orden de fabricación |
| `lista` | El mueble está terminado | Cliente notificado para coordinar entrega |
| `entregada` | Entregado al cliente | Confirmación de entrega al cliente |
| `cancelada` | Cancelada en cualquier punto | — |

### Campos añadidos a `cotizaciones`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `precio_cotizado` | `DECIMAL(10,2) NULL` | Precio que el admin establece al responder |
| `descripcion_respuesta` | `TEXT NULL` | Descripción formal de qué se fabricará |
| `fecha_entrega_estimada` | `DATE NULL` | Fecha comprometida de entrega |
| `token_seguimiento` | `VARCHAR(64) NULL UNIQUE` | Se asigna al pasar a `en_produccion`; permite seguimiento público |

### Validaciones al cambiar a `respondida`

`api/cotizaciones.php` requiere, antes de marcar como `respondida`:
- `precio_cotizado > 0`
- `strlen(descripcion_respuesta) >= 10`

Si no se cumplen, devuelve `422` con mensaje de error descriptivo.

---

## Sistema de disponibilidad de fechas

El carrito consulta disponibilidad real antes de mostrar semanas de entrega:

- `GET /api/disponibilidad.php` — devuelve semanas disponibles según capacidad y pedidos existentes
- `GET|POST|PUT|DELETE /api/capacidad.php` — gestión de slots por semana (solo admin)
- La tabla `capacidad_produccion` define cuántos pedidos caben por semana
- La tabla `dias_bloqueados` contiene festivos y cierres (Semana Santa, etc.)
- Si la API falla, el checkout calcula 8 semanas estimadas como fallback

---

## Auto-actualización en tiempo real (Paneles)

Tanto el panel de administrador como el de empleado se actualizan **automáticamente cada 30 segundos** sin necesidad de recargar la página:

- La función `_autoRefreshAdmin()` / `_autoRefresh()` detecta la sección visible y recarga solo esos datos
- El polling se **pausa** automáticamente cuando la pestaña no está activa (visibilitychange)
- Al **volver a la pestaña** se dispara una actualización inmediata y se reinicia el ciclo
- El intervalo se **cancela en logout** para no dejar procesos huérfanos

| Sección | Función que se refresca |
|---------|------------------------|
| Dashboard | `refreshKPIsFromAPI()` |
| Pedidos | `cargarPedidosAPI()` |
| Catálogo | `cargarProductosAPI()` + `renderCatalogo()` |
| Empleados | `cargarEmpleadosAPI()` |
| Reportes | `cargarReportesAPI()` |
| Citas | `renderCalendar()` |
| Cotizaciones | `cargarCotizacionesAPI()` |

---

## Configuración inicial

### 1. Variables de entorno

Copiar `.env.example` a `.env` y completar:

```env
# Base de datos
DB_HOST=localhost
DB_NAME=wooden_house
DB_USER=tu_usuario
DB_PASS=tu_contraseña

# Firebase (backend PHP)
FIREBASE_PROJECT_ID=woodenhouse-898de
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=woodenhouse-898de.firebaseapp.com
FIREBASE_STORAGE_BUCKET=woodenhouse-898de.firebasestorage.app

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...          # Registrar endpoint en developer.paypal.com primero
PAYPAL_MODE=sandbox            # Cambiar a 'live' en producción

# Email SMTP (Brevo, Gmail, etc.)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=tu@correo.com
SMTP_PASS=tu_smtp_password
EMAIL_FROM=noreply@woodenhouse.com.mx
EMAIL_FROM_NAME=Wooden House
ADMIN_EMAIL=contacto@woodenhouse.com.mx

# URL base del sitio (usada en enlaces de correos de invitación, etc.)
APP_URL=https://woodenhouse.com.mx
```

### 2. Firebase — Consola web

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar **Authentication** → Correo/contraseña
   - Al registrarse, el sistema envía automáticamente un correo de verificación vía `sendEmailVerification()`
3. Habilitar **Firestore** → Modo producción → desplegar `firebase/firestore.rules`
4. Habilitar **Storage** → desplegar `firebase/storage.rules`
5. Actualizar `public/assets/js/firebase-config.js` con las credenciales del proyecto

```bash
# Desplegar solo las reglas de seguridad (sin funciones ni hosting)
cd firebase
firebase deploy --only firestore:rules,storage
```

### 3. Firebase Cloud Functions

```bash
npm install -g firebase-tools
cd firebase
firebase login
firebase use woodenhouse-898de

# Instalar dependencias de las Functions
cd functions && npm install && cd ..

# Configurar variables de entorno de las Functions
firebase functions:config:set \
  brevo.api_key="tu_brevo_api_key" \
  email.from="noreply@woodenhouse.com.mx" \
  email.from_name="Wooden House" \
  email.admin="contacto@woodenhouse.com.mx"

# Desplegar todas las functions
firebase deploy --only functions
```

> Las Cloud Functions escuchan triggers en la colección `notificaciones` de Firestore. El backend PHP escribe en Firestore; las Functions leen el documento y envían el correo vía Brevo API.

### 4. PayPal Webhook

1. Ir a [developer.paypal.com](https://developer.paypal.com) → My Apps & Credentials → tu app → **Webhooks**
2. Agregar URL: `https://tudominio.com/api/pagos.php?action=paypal_webhook`
3. Seleccionar eventos: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `CHECKOUT.ORDER.VOIDED`
4. Copiar el **Webhook ID** generado al `.env` como `PAYPAL_WEBHOOK_ID`

### 5. Stripe Webhook

1. Ir a [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → Webhooks
2. Agregar URL: `https://tudominio.com/api/pagos.php?action=stripe_webhook`
3. Seleccionar eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copiar el **Signing Secret** al `.env` como `STRIPE_WEBHOOK_SECRET`

### 6. Servidor Apache

```apache
# En httpd.conf o el VirtualHost — apuntar DocumentRoot a /public
<VirtualHost *:443>
    DocumentRoot "/ruta/al/proyecto/Wooden House/public"
    ServerName woodenhouse.com.mx

    <Directory "/ruta/al/proyecto/Wooden House/public">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

```bash
# Habilitar módulos necesarios
a2enmod rewrite headers expires deflate
service apache2 restart
```

---

## Notificaciones por correo — empleados

Los empleados activos (rol `empleado`) reciben copia (CC) de los correos de:

- **Nuevo pedido** — para estar al tanto del trabajo pendiente de producción.
- **Nueva cita** — para preparar las visitas de medición e instalación.
- **Cotización en producción** — cuando el admin aprueba una cotización e inicia fabricación (orden de trabajo).

La función `_obtenerCorreosEmpleados()` en `includes/notifications.php` consulta en tiempo real a todos los empleados activos y devuelve sus correos separados por coma. Si no hay empleados, el campo se omite sin afectar el correo al cliente.

---

## Correcciones de bugs (2026-06-18)

### QR de 2FA — "QRCode is not defined"

**Causa:** La librería `qrcode@1.5.4` cargada desde CDN no siempre expone `QRCode` como global en todos los navegadores.

**Corrección:** Eliminada la dependencia de la librería. El QR ahora se genera como una `<img>` con `src` apuntando a `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=...`. Cero dependencias JS, funciona en todos los navegadores.

---

## Seguridad y mejoras de producción (2026-06-07)

### CSP sin `unsafe-inline` en `script-src`

El CSP en `public/.htaccess` ya **no tiene `'unsafe-inline'` en `script-src`**. Toda ejecución de scripts inline está bloqueada por política. Las consecuencias que se resolvieron:

- **`modal-auth.js`:** todos los `onclick`/`onsubmit` del HTML del modal reemplazados con `addEventListener` en `_initCamposModal()`.
- **`catalogo.js`:** filtros de categoría usan `data-cat-filter`, paginación usa `data-call + data-args`, botones de carrito se enlazan con `addEventListener` post-render; `onerror` en imágenes reemplazado por `data-img-fallback`.
- **`detalle_producto.js`:** thumbnails sin `onclick` — manejados por `event-delegation.js` via `.thumb[data-idx]`.

> **Regla para código nuevo:** No usar `onclick=`, `onsubmit=`, `onerror=` ni ningún handler inline. Usar `data-call`, `data-cat-filter`, `data-dismiss`, `data-auth-action`, o `addEventListener` desde JS externo.

### HTTPS redirect — corrección de ERR_TOO_MANY_REDIRECTS

El servidor usa un proxy/CDN (Cloudflare/Nginx) que termina SSL antes de Apache. La redirección HTTPS anterior causaba un loop infinito porque Apache siempre veía `HTTPS=off`.

**Corrección (`.htaccess` raíz y `public/.htaccess`):**
```apache
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteCond %{HTTP_HOST} !^localhost$ [NC]
RewriteCond %{HTTP_HOST} !^127\.0\.0\.1$
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Rate limits más estrictos

`api/auth.php`:
- Login de personal: 5 intentos / 15 min
- Login de clientes: 5 intentos / 15 min
- Registro de clientes: 3 intentos / 15 min

### Validación de URLs de imágenes (productos)

`api/productos.php` — función `validarUrlImagen()` que verifica:
- Esquema `https` obligatorio
- Host en lista blanca: `firebasestorage.googleapis.com`, `storage.googleapis.com`, `*.firebasestorage.app`
- Máximo 2 048 caracteres

### Firebase Storage rules — lista explícita de MIME

`firebase/storage.rules` — lista explícita en lugar de `image/.*` (que permitía SVG como vector XSS):
```
['image/jpeg', 'image/png', 'image/webp', 'image/gif']
```

### Firebase Firestore rules — validación de campos

`firebase/firestore.rules` — el `allow create` valida estructura, tipos y longitudes:
- `titulo`: string, máximo 200 caracteres
- `mensaje`: string, máximo 1 000 caracteres

---

## Mejoras visuales y UX (2026-06-07)

### Sistema de animaciones global (`animations.css` + `animations.js`)

- **Scroll-reveal:** clases `.wh-reveal`, `.wh-reveal-left`, `.wh-reveal-right`, `.wh-reveal-zoom` activadas por `IntersectionObserver` con umbral 0.12.
- **Hover lift:** `.wh-lift` (8 px) y `.wh-lift-sm` (4 px) aplicados automáticamente a tarjetas y botones.
- **Ripple:** `.wh-btn-ripple` en botones de acción.
- **Skeleton loading:** `.wh-skeleton` para estados de carga.
- Respeta `prefers-reduced-motion`.

### Lightbox de imágenes

Al hacer clic en cualquier imagen con `data-lightbox`:
- Se abre un overlay oscuro con la imagen en tamaño completo.
- **Scroll para zoom** (0.5× a 4×) sobre la imagen.
- Cierre con clic fuera, botón × o tecla Escape.
- Lógica en `event-delegation.js`, CSS en `animations.css`.

### Solicitudes — diferenciación cotización vs cita

`public/solicitudes.php`: tres tarjetas de decisión al inicio:
- Dorada: "Ya sé lo que quiero → Cotización"
- Azul: "Necesito asesoría presencial → Visita a domicilio"
- Verde: "Ya envié una solicitud → Seguimiento"

### Status badges de alta visibilidad

Reemplazado el patrón `background: ${color}30` (invisible sobre fondos oscuros) por clases CSS con fondos sólidos:

| Clase | Uso |
|-------|-----|
| `.status-pending` | Pendiente |
| `.status-progress` | Pagado / En proceso |
| `.status-producing` | En producción |
| `.status-ready` | Listo |
| `.status-completed` | Completado / Entregado |
| `.status-cancelled` | Cancelado |
| `.status-new` | Nueva |
| `.status-replied` | Respondida |

---

## Limpieza de código (2026-05-15)

Eliminados comentarios redundantes (WHAT) de todos los archivos del proyecto — JS, PHP, API y plantillas HTML. Se conservaron únicamente separadores de sección, restricciones de seguridad no obvias, invariantes de concurrencia y comportamientos contraintuitivos de Firebase/navegador.

---

## Correcciones de bugs críticos (v9 — 2026-05-14)

### Bug 1 — Sesión del cliente se cerraba al navegar

**Corrección (`includes/config.php`):** `SESSION_IDLE_TIMEOUT` cambiado de 120 s a 900 s (15 minutos).

### Bug 2 — Correo de confirmación de pedido se enviaba dos veces

**Corrección (`api/pagos.php`):** `UPDATE ... WHERE notificacion_enviada = 0` atómico. Solo el proceso que modifica 1 fila envía el correo.

### Bug 3 — Datos del checkout correspondían a un cliente anterior

**Corrección (`public/assets/js/checkout.js`):** Los campos de identidad siempre se sobreescriben con los datos del cliente autenticado.

### Bugs 4–6 — Contaminación de sesiones entre cliente y empleado

**Corrección (`includes/auth.php`):**
- Claves de sesión separadas: `_usuario_login_time` y `_cliente_login_time`.
- Funciones `_destruirSesionCliente()` y `_destruirSesionPersonal()` independientes.

### Bug 7 — Validación de teléfono en "Mi cuenta" bloqueaba guardado

**Corrección (`public/assets/js/mi-cuenta.js`):** Condición reescrita con precedencia correcta de operadores.

---

## Mejoras de UX y exportación real (v8 — 2026-04-23)

- `exportReportXLSX()` genera un archivo `.xlsx` real con 4 hojas vía SheetJS 0.20.3.
- Logo envuelto en `<a href="/inicio">` en todas las páginas.
- Botón flotante "¿Cómo comprar?" con modal de 4 pasos.
- "Solicitudes" → **"Cotización y Citas"** con subtítulo más descriptivo.

---

## Correcciones y mejoras (v5 — 2026-03-17)

- Sincronización de datos de contacto al perfil del cliente al completar pedido/cotización/cita.
- `credentials: 'same-origin'` agregado a los fetch de POST en `solicitudes.js`.
- Badge "Cliente registrado" en paneles si el registro tiene `cliente_id`.
- Campos `metodo_pago`, `referencia_pago` y `fecha_pago` asignados antes de llamar `notificarNuevoPedido` en PayPal.

---

## Seguridad y correcciones críticas (v7 — 2026-03-27)

- Guardas de acceso server-side en `pago.php` y `solicitudes.php`.
- `SESSION_IDLE_TIMEOUT = 900` + timeout absoluto de 2 horas.
- Cookie de sesión con `lifetime = 0` — eliminada al cerrar el navegador.
- Verificación de correo requerida para agregar al carrito.
- Usuario de BD con permisos mínimos (`SELECT/INSERT/UPDATE/DELETE` únicamente).

---

## Correcciones de responsivo y UX móvil (v6 — 2026-03-27)

- Catálogo: grid de `auto-fill 260px` → `repeat(2,1fr)` → `1fr` según ancho de pantalla.
- Barra de navegación móvil con `position: fixed !important` y capa de composición propia.

---

## Correcciones de bugs aplicadas (v3 — 2026-03-12)

- Login empleado: 404 en primer intento por cookie sin atributo `domain` en localhost.
- Extraído CSS de `terminos.php` a `terminos.css`; script de auth de `carrito-checkout.php` movido a `checkout.js`.

---

## Correcciones de Seguridad (v2)

- Verificación de tipo MIME y magic bytes antes de subir imágenes.
- Sanitización completa de campos en `solicitudes.js`.
- `_destruirSesion()` elimina cookie `XSRF-TOKEN` y regenera el ID de sesión.
- Campo honeypot anti-bot en formularios de cotización y cita.

---

## Seguridad — .htaccess

### `/public/.htaccess` — Content Security Policy

`script-src` sin `'unsafe-inline'`. Todos los handlers inline han sido eliminados del código JS.

| Directiva | Dominios clave permitidos |
|-----------|--------------------------|
| `script-src` | gstatic.com, firebaseapp.com, stripe.com, paypal.com, jsdelivr.net, cdnjs |
| `style-src` | `'unsafe-inline'`, fonts.googleapis.com, cdnjs |
| `connect-src` | *.firebaseio.com, **wss://*.firebaseio.com**, firestore.googleapis.com, www.googleapis.com, identitytoolkit.googleapis.com, securetoken.googleapis.com, accounts.google.com, api.stripe.com, api-m.paypal.com, api.qrserver.com |
| `frame-src` | js.stripe.com, paypal.com, woodenhouse-898de.firebaseapp.com, accounts.google.com |
| `img-src` | firebasestorage.googleapis.com, paypalobjects.com, api.qrserver.com, blob:, data: |
| `worker-src` | 'self' blob: |

> **`wss://*.firebaseio.com`** es crítico para que Firestore Realtime funcione (WebSocket).
> **`api.qrserver.com`** debe estar en `connect-src` e `img-src` para que el QR del 2FA cargue correctamente.

---

## Funcionalidades implementadas

### Frontend público
- Página de inicio: hero, 3 razones, 4 pasos del proceso, proyectos y FAQ
- Catálogo con filtro por categoría, búsqueda en tiempo real, ordenamiento y lightbox de zoom en imágenes
- Detalle de producto con galería, especificaciones en tabs, selector de cantidad y zoom de imagen principal
- Carrito con selector de semanas de entrega basado en disponibilidad real de la API
- Proceso de pago: Stripe Elements (tarjeta) + PayPal Smart Buttons
- Seguimiento de pedidos/cotizaciones/citas por token sin necesidad de login
- Formularios de cotización y cita diferenciados con tarjetas de decisión guía

### Sistema de cuentas de cliente
- Registro e inicio de sesión con Firebase Auth (modular SDK v10, dynamic import)
- Verificación de correo con polling automático; banner persistente hasta confirmar
- Modal de autenticación contextual con event listeners (100% CSP-compatible)
- Portal "Mi Cuenta": historial de pedidos, perfil editable, estadísticas
- Vinculación automática de pedidos/cotizaciones/citas a la cuenta

### Panel Administrador *(auto-polling 30s)*
- Dashboard con KPIs, gráficas de ventas/estados y 8 acciones rápidas
- Gestión completa de pedidos, cotizaciones (flujo 8 estados) y citas
- Gestión de cotizaciones de producción: precio, descripción, fecha estimada, token de seguimiento
- Gestión de productos (CRUD + galería Firebase Storage + especificaciones)
- **Invitar empleados** — el admin genera una invitación por correo; el empleado crea su propia contraseña
- Reportes avanzados exportables a `.xlsx` real (SheetJS) y PDF
- Clientes registrados: historial, total gastado, pedidos y cotizaciones
- **Ofertas & Marketing:** CRUD de descuentos y cupones con vigencia y usos máximos
- **2FA Setup:** sección de seguridad con QR TOTP y verificación de código

### Panel Empleado *(auto-polling 30s)*
- Vista de pedidos con timeline de 4 etapas
- Citas y cotizaciones con cambio de estado inline
- Calendario interactivo sincronizado con la API
- Notificaciones en tiempo real desde Firestore
- **2FA Setup:** sección de seguridad con QR TOTP y verificación de código

### Sistema de notificaciones y correos
- Escritura en Firestore al crear pedidos/cotizaciones/citas y en cada transición de estado
- Listener en tiempo real en los paneles (sin recarga)
- Cloud Functions en Firestore: 10 handlers de correo + 1 función scheduled de limpieza
- Empleados reciben CC en correos de nuevos pedidos y nuevas citas
- Empleados reciben orden de fabricación cuando una cotización entra a producción
- Correo de invitación con enlace de activación único para nuevos empleados

### Seguridad
- **2FA TOTP (RFC 6238)** obligatorio para todo el personal (admin y empleado)
- Sistema de invitaciones: el admin nunca conoce la contraseña del empleado
- `script-src` sin `'unsafe-inline'` — toda ejecución inline bloqueada por CSP
- HTTPS forzado con detección de proxy/CDN (`X-Forwarded-Proto`)
- Rate limiting: 3–5 intentos por 15 min en autenticación
- Tokens JWT de Firebase verificados en cada llamada a la API PHP
- Headers de seguridad HTTP completos (CSP, HSTS, X-Frame-Options, etc.)
- Firestore Rules con validación de estructura, tipos y longitudes
- Storage Rules con lista explícita de MIME types (sin SVG)
- Validación de URLs de imágenes: solo HTTPS + hosts de Firebase Storage en lista blanca
- Validación de imágenes por magic bytes en el panel administrador
- Sanitización completa de campos en JS y PHP
- Campo honeypot anti-bot en formularios públicos
- Session timeout absoluto (2h) y por inactividad (15 min)
- `sesiones_revocadas_desde` para invalidar sesiones antiguas de personal y clientes
- Usuario de BD con permisos mínimos (SELECT/INSERT/UPDATE/DELETE únicamente)

---

## Módulos de la API

| Endpoint | Métodos | Acceso | Descripción |
|----------|---------|--------|-------------|
| `/api/productos.php` | GET POST PUT DELETE | público (GET) / admin | CRUD productos + imágenes |
| `/api/categorias.php` | GET POST PUT DELETE | público (GET) / admin | CRUD categorías |
| `/api/pedidos.php` | GET POST PUT | público (POST) / empleado+ | Crear y gestionar pedidos |
| `/api/disponibilidad.php` | GET | público | Semanas disponibles |
| `/api/capacidad.php` | GET POST PUT DELETE | admin | Slots de producción |
| `/api/cotizaciones.php` | GET POST PUT | público (POST) / admin | Cotizaciones — flujo 8 estados |
| `/api/citas.php` | GET POST PUT DELETE | público (POST) / empleado+ | Citas |
| `/api/invitaciones.php` | GET POST | admin (crear) / público (validar + activar) | Invitaciones de personal |
| `/api/pagos.php` | POST | público / webhook | Stripe + PayPal |
| `/api/reportes.php` | GET | admin | Reportes y estadísticas |
| `/api/notificaciones.php` | GET POST PUT | empleado+ | Notificaciones Firestore |
| `/api/empleados.php` | GET PUT DELETE | admin | Gestión de personal |
| `/api/calendario.php` | GET | empleado+ | Disponibilidad de citas |
| `/api/auth.php` | POST GET | — | Verificación de tokens + 2FA setup/check |
| `/api/clientes.php` | GET PUT | cliente / admin | Perfil y pedidos del cliente |
| `/api/ofertas.php` | GET POST PUT DELETE | público (GET activas) / admin | Ofertas y cupones |

---

## Migración a producción (Hostinger)

### Archivos a subir

```
✅ SÍ subir:
api/, includes/, public/, firebase/, database/schema.sql

❌ NO subir:
.env                  ← se crea manualmente en el servidor
.git/                 ← no es necesario en producción
node_modules/         ← se instala con npm install en el servidor
```

### Base de datos en Hostinger

**Instalación limpia** (recomendado si no hay datos reales):
```bash
# En phpMyAdmin de Hostinger, importar:
database/schema.sql
```

**Migrar datos existentes** desde el servidor actual:
```bash
docker exec wh_db mysqldump -u root -pwhrootbd1234 wooden_house > backup_completo.sql
# Subir backup_completo.sql a phpMyAdmin de Hostinger e importar
```

### Activar Stripe en producción

1. En [dashboard.stripe.com](https://dashboard.stripe.com) → Activar cuenta → completar datos fiscales.
2. Obtener `pk_live_...` y `sk_live_...` en Developers → API Keys.
3. Crear webhook con la URL de producción.
4. Actualizar `.env` con las claves live.

### Activar PayPal en producción

1. En [developer.paypal.com](https://developer.paypal.com) → Live Apps → crear o usar la app live.
2. Obtener `Client ID` y `Secret` del modo Live.
3. Crear webhook con la URL de producción.
4. Cambiar `PAYPAL_MODE=live` en `.env`.

---

## Requisitos del servidor

- **PHP** 8.0 o superior
- **MySQL** 8.0+ o **MariaDB** 10.4+
- **Apache** 2.4+ con módulos: `mod_rewrite`, `mod_headers`, `mod_expires`, `mod_deflate`
- **Extensiones PHP**: `pdo`, `pdo_mysql`, `json`, `mbstring`, `curl`, `openssl`
- **HTTPS** obligatorio en producción (requerido por Firebase Auth, Stripe y PayPal)

---

## Notas de desarrollo

- Los iconos usan **Font Awesome 6.5.1** vía CDN — sin emojis en el código
- **Bootstrap 5.3.3** se carga solo el JS (sin CSS) para no sobreescribir el tema oscuro personalizado
- El carrito persiste en `sessionStorage` con la clave `wh_carrito`
- Los paneles de admin y empleado requieren sesión activa de Firebase Auth **y** 2FA verificado
- Los clientes usan la misma Firebase Auth pero se almacenan en tabla `clientes`, no en `usuarios_personal`
- Las sesiones PHP distinguen entre personal (`usuario_id`, `usuario_rol`) y clientes (`cliente_id`, `cliente_rol`)
- `AuthModal.open(callback)` — abre el modal de auth desde cualquier página; `AuthModal.openRegistro()` lo abre en la pestaña de registro
- `event-delegation.js` maneja todos los eventos del sitio via `data-*` attributes — incluir en toda página nueva
- `animations.js` aplica automáticamente clases de reveal a tarjetas y botones via `IntersectionObserver`
- Los logs del servidor se guardan en `logs/` (ignorado en `.gitignore`)
- El `firebase/` completo está **fuera de `public/`** — no es accesible desde el navegador
- El QR del 2FA se genera como imagen desde `api.qrserver.com` — requiere conexión a internet en el navegador del usuario
- `api/cotizaciones.php` solo aceptable por admin en PUT (los empleados fabrican, no gestionan cotizaciones)
