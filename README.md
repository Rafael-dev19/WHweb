# Wooden House — Sitio web y paneles internos

Tienda en línea y sistema de trabajo interno de **Wooden House**, taller de muebles de baño, cocinas y clósets a la medida (Tlaquepaque, Jalisco).

- **Sitio público:** catálogo de muebles de baño con precio por ancho, carrito, pago en línea, cotizaciones, citas de medición y seguimiento por folio.
- **Paneles del personal:** pedidos de punta a punta (venta → diseño → taller → instalación), cotizaciones, citas, calendario de producción, catálogo, reportes y notificaciones por persona (campanita + push).

> Versión actual: **2.5.x** — actualizado el 2026-10-14.

---

## Índice

1. [Roles y paneles](#roles-y-paneles)
2. [Flujo de un pedido](#flujo-de-un-pedido)
3. [Tecnologías](#tecnologías)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [URLs del sitio](#urls-del-sitio)
6. [Base de datos](#base-de-datos)
7. [Instalación local](#instalación-local)
8. [Variables de entorno (.env)](#variables-de-entorno-env)
9. [Firebase](#firebase)
10. [Servidor de producción y despliegue](#servidor-de-producción-y-despliegue)
11. [Notificaciones](#notificaciones)
12. [Seguridad](#seguridad)
13. [Reglas para código nuevo](#reglas-para-código-nuevo)
14. [API](#api)

---

## Roles y paneles

Todo el personal entra con Firebase Auth (correo y contraseña). Las cuentas se crean **solo por invitación**: el jefe o el administrador invita, y la persona crea su propia contraseña en `/invitacion`.

| Rol | Panel | Qué hace | ¿Ve montos? | ¿Recibe push? |
|-----|-------|----------|:-----------:|:-------------:|
| `jefe` | `/admin` | Todo: pedidos, cobros, cotizaciones, catálogo, personal, reportes | ✅ | ✅ |
| `ventas` | `/ventas` | Pedidos (crear, editar, cobrar), cotizaciones, citas, clientes | ✅ | ✅ |
| `administrador` | `/admin` | Soporte técnico: catálogo, personal, configuración | ❌ | ❌ |
| `disenador` | `/disenador` | Diseña cada pedido y entrega el `.skp` + carpeta de cortes del CNC; puede crear y editar pedidos | ❌ | ✅ |
| `empleado` (área `taller`) | `/empleado` | Fabrica; descarga los archivos de corte | ❌ | ✅ |
| `empleado` (área `instalacion`) | `/empleado` | Entrega e instala; marca el pedido como finalizado | ❌ | ✅ |

- **Montos:** solo el jefe y ventas ven cifras. Para los demás roles la API **quita** los importes del JSON (`ocultarMontosPedido()` en `api/pedidos.php`) y manda en su lugar `estado_pago` (`liquidado` / `saldo_pendiente` / `sin_pago`). Ver `puedeVerMontos()` en `includes/auth.php`.
- Los **clientes** también usan Firebase Auth, pero se guardan en la tabla `clientes` y solo acceden al sitio público y a `/mi-cuenta`.

---

## Flujo de un pedido

```
pendiente ──► anticipo_pagado / pagado ──► listo_para_produccion ──► en_produccion
 (sin pago)      (cobro en línea o manual)       (diseñador)             (taller)

──► alistando_pedido ──► en_camino_instalacion ──► finalizado        (o cancelado)
       (taller)              (instalación)          (instalación, solo si ya se pagó todo)
```

1. **Origen:** el cliente compra en el carrito (Stripe o PayPal, pago completo o anticipo), o el jefe/ventas/diseñador lo **carga a mano** con "Crear pedido" (encargos por WhatsApp o teléfono). Un pedido manual incluye:
   - tipo de proyecto (baño, cocina o clóset), entrega (instalación, solo envío o recoger) y fecha acordada;
   - teléfonos extra y dirección (también se acepta un link de Google Maps);
   - muebles del catálogo con ancho, cubierta, color y accesorios;
   - modelos **fuera de catálogo** con hasta **10 fotos** cada uno;
   - descripción, nota de voz y fotos de referencia;
   - el pago recibido (solo jefe/ventas).
2. **Editar pedido:** desde el detalle, el botón "Editar pedido" abre el mismo formulario ya lleno. Los pagos ya registrados no cambian, y el total no puede quedar por debajo de lo ya cobrado (`action=editar_manual`).
3. **Diseño:** para marcar el pedido como listo para producción, el diseñador debe subir:
   - el **proyecto SketchUp (`.skp`)**, obligatorio;
   - la **carpeta de cortes del CNC** (`.nc`, también `.tap` o `.dxf`), obligatoria y con los nombres de archivo originales;
   - un render en imagen, opcional.
4. **Taller:** descarga cada archivo con su nombre original, o la carpeta completa en `.zip` (`api/pedidos.php?action=descargar_diseno`).
5. **Instalación:** ve la dirección (con botón al mapa), los teléfonos y si falta cobrar algo.

---

## Tecnologías

| Capa | Tecnología |
|------|------------|
| Backend | PHP 8.2 (sin framework), PDO |
| Base de datos | MariaDB 10.4+ / MySQL 8 (`utf8mb4`) |
| Frontend | HTML, CSS y JavaScript sin framework; tema claro/oscuro |
| Iconos | Lucide 1.55.0, servido desde el propio sitio (`public/assets/vendor/`) |
| Autenticación | Firebase Auth (personal y clientes) |
| Archivos | Firebase Storage (fotos, notas de voz, `.skp`, cortes del CNC, PDFs) |
| Cola de correos/push | Firestore (colección `notificaciones`) → Cloud Functions |
| Cloud Functions | Firebase Functions v7, Node.js 22 |
| Correos | Brevo API (desde Cloud Functions) |
| Push | Firebase Cloud Messaging (Web Push) |
| Tiempo real en paneles | Server-Sent Events (`api/eventos.php`) |
| Pagos | Stripe (JS v3 + API por cURL) y PayPal (JS SDK + REST v2) |
| Reportes | SheetJS (`.xlsx`) |
| Servidor | Ubuntu + Apache 2.4 (`mod_rewrite`, `mod_headers`), detrás de Cloudflare |

---

## Estructura del proyecto

```
Wooden House/
├── public/                         # DocumentRoot del servidor
│   ├── index.php, catalogo.php, detalle_producto.php
│   ├── carrito-checkout.php        # Carrito + entrega/instalación + fecha + forma de pago
│   ├── pago.php                    # Stripe / PayPal (también "pagar saldo pendiente")
│   ├── solicitudes.php             # Cotizaciones y citas
│   ├── seguimiento.php             # Seguimiento público por folio
│   ├── mi-cuenta.php               # Portal del cliente
│   ├── invitacion.php              # Activación de cuenta del personal invitado
│   ├── notificaciones-push.php     # Paso para activar push entre el login y el panel
│   ├── acceso-denegado.php, terminos.php, privacidad.php, login.php
│   ├── sitemap.php (→ /sitemap.xml), robots.txt, firebase-messaging-sw.js
│   ├── _modal_pedido_manual.php    # Modal "Crear / Editar pedido" (jefe, ventas, diseñador)
│   ├── _modal_cotizacion_manual.php
│   ├── _dev_login.php              # SOLO local (en .gitignore; Apache lo bloquea fuera de localhost)
│   ├── admin/panel_administrador.php   # jefe y administrador
│   ├── ventas/panel_ventas.php
│   ├── disenador/panel_disenador.php
│   ├── empleado/panel_empleado.php     # taller e instalación
│   └── assets/
│       ├── css/                    # variables.css, styles.css, panel_*.css, …
│       ├── js/
│       │   ├── panel_*.js          # Lógica de cada panel
│       │   ├── pedido-manual.js    # Crear / editar pedido
│       │   ├── archivos-diseno.js  # Entregables del diseñador (igual en los 4 paneles)
│       │   ├── event-delegation.js # data-call / data-args (sin handlers inline)
│       │   ├── push-notifications.js, sse-notificaciones.js
│       │   ├── metodo-cobro.js, voice-recorder.js, maps-picker.js, theme-toggle.js
│       │   └── firebase-config.js, utils.js, carrito.js, checkout.js, pago.js, …
│       ├── vendor/lucide-1.55.0.min.js
│       └── img/
├── api/                            # Endpoints JSON (Apache los expone con un Alias /api)
├── includes/                       # Código compartido del servidor (no público)
│   ├── env.php / config.php        # Lee .env y define constantes
│   ├── db.php                      # PDO
│   ├── auth.php                    # Sesión, roles, puedeVerMontos(), estadoPagoPedido()
│   ├── csp.php                     # Content-Security-Policy con nonce por petición
│   ├── assets.php                  # av(): versión de JS/CSS por hash del contenido
│   ├── firebase_admin.php          # Cuenta de servicio de Firebase (OAuth, Firestore, claims)
│   ├── notifications.php           # Campanita por persona, correos y push
│   ├── accesorios.php              # Catálogo de ovalines, monomandos y adicionales
│   ├── security.php, functions.php, stripe.php, paypal.php
├── database/
│   ├── schema.sql                  # Esquema completo y actual (solo para bases NUEVAS)
│   └── seed.sql                    # Datos de ejemplo (catálogo anterior al 2026)
├── firebase/
│   ├── firestore.rules             # Cerradas: solo el servidor (cuenta de servicio) escribe
│   ├── storage.rules               # Subida solo para personal (claim staff) con tipos y tamaños fijos
│   ├── firestore.indexes.json, firebase.json
│   └── functions/index.js          # onNuevaNotificacion (correos + push) y limpieza diaria
├── router.php                      # Solo para `php -S` en local (emula el Alias /api)
├── .htaccess                       # HTTPS + bloquea includes/, database/, logs/, firebase/
├── .env.example                    # Plantilla de configuración
├── PRODUCT.md, DESIGN.md           # Producto y sistema visual
└── README.md
```

---

## URLs del sitio

| URL | Archivo |
|-----|---------|
| `/` · `/inicio` | `index.php` (y `/index.php` redirige a `/`) |
| `/catalogo` | `catalogo.php` |
| `/detalle/42` | `detalle_producto.php?id=42` |
| `/carrito` · `/pago` | `carrito-checkout.php` · `pago.php` |
| `/solicitudes` · `/seguimiento` | `solicitudes.php` · `seguimiento.php` |
| `/mi-cuenta` · `/login` | `mi-cuenta.php` · `login.php` |
| `/terminos` · `/privacidad` | `terminos.php` · `privacidad.php` |
| `/admin` · `/ventas` · `/disenador` · `/empleado` | paneles |
| `/sitemap.xml` | `sitemap.php` |

Además, `www.` redirige con 301 al dominio sin `www`. Los paneles, `/mi-cuenta`, `/carrito`, `/pago` e `/invitacion` llevan `noindex` y están en `Disallow` de `robots.txt`.

---

## Base de datos

`database/schema.sql` contiene el **esquema completo al día** (25 tablas). Se usa **solo para crear una base nueva** (desarrollo local o servidor nuevo), porque **borra y vuelve a crear todas las tablas**.

| Grupo | Tablas |
|-------|--------|
| Personal | `usuarios_personal`, `invitaciones_personal`, `auditoria_seguridad_personal`, `dispositivos_push`, `notificaciones_personal` |
| Clientes | `clientes`, `carritos_guardados` |
| Catálogo | `categorias`, `productos`, `imagenes_producto`, `especificaciones_producto`, `producto_medidas` (precio por ancho), `ofertas` |
| Pedidos | `pedidos`, `detalle_pedido`, `pagos`, `pedido_adjuntos`, `pedido_imagenes_diseno` |
| Citas y cotizaciones | `citas`, `cotizaciones`, `cotizador_items_catalogo`, `cotizacion_respuesta_items`, `cotizacion_imagenes` |
| Calendario | `capacidad_produccion`, `dias_bloqueados` |

Cada tabla tiene un comentario en `schema.sql` que explica para qué sirve y qué significan sus columnas menos obvias.

### Cambios en una base con datos (producción)

**Nunca** se corre `schema.sql` en producción. Para un cambio de estructura:

1. Escribe un archivo `database/migracion_AAAA_MM<letra>_<tema>.sql` que contenga **solo** los `ALTER`/`CREATE` nuevos.
2. Si el código debe funcionar antes de que corra la migración, revisa si la columna existe (ver `columnasPedidoManual()` en `api/pedidos.php`) y guarda el dato en otro lado mientras tanto.
3. Corre la migración en producción:
   ```bash
   mysql -u USUARIO -p wooden_house < database/migracion_….sql
   ```
4. Aplica el mismo cambio en `schema.sql`, para que una base nueva quede igual.

---

## Instalación local

Entorno usado: **XAMPP** en Windows (Apache en `127.0.0.1:8080`, MariaDB, PHP 8.2).

```bash
# 1. Base de datos nueva
mysql -u root < database/schema.sql
mysql -u root wooden_house < database/seed.sql        # opcional: datos de ejemplo

# 2. Configuración
cp .env.example .env                                   # y llenar los valores (ver abajo)

# 3. Apache: DocumentRoot → public/, con AllowOverride All y un Alias /api → api/
#    (sin Apache: php -S 127.0.0.1:8080 -t public router.php)
```

- **Probar los paneles sin Firebase:** `http://127.0.0.1:8080/_dev_login.php?rol=ventas` (también `jefe`, `administrador`, `disenador`, y `empleado&area=taller` o `empleado&area=instalacion`). Solo funciona en local, y el archivo está en `.gitignore`.
- Si MariaDB no arranca desde el panel de XAMPP: `mysql\bin\mysqld --defaults-file=mysql\bin\my.ini --console`.
- La subida a Firebase Storage necesita una sesión real de Firebase: con `_dev_login` se puede probar todo menos subir archivos.

---

## Variables de entorno (.env)

El archivo `.env` contiene **secretos reales**: nunca se sube a git ni se comparte. La plantilla está en `.env.example`.

| Grupo | Variables |
|-------|-----------|
| App | `APP_ENV`, `APP_DEBUG`, `APP_URL`, `CORS_ALLOWED_ORIGINS` |
| Base de datos | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` |
| Firebase | `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FCM_VAPID_KEY`, `FIREBASE_SERVICE_ACCOUNT_FILE`, `PUSH_CLEANUP_SECRET` |
| Stripe | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox`/`live`), `PAYPAL_WEBHOOK_ID` |
| Correos | `BREVO_API_KEY`, `ADMIN_EMAIL`, `DESARROLLADOR_EMAIL`, `EMAIL_PEDIDOS`, `EMAIL_CITAS`, `EMAIL_COTIZACIONES`, `EMAIL_VENTAS` |
| Negocio | `COSTO_INSTALACION`, `COSTO_ENVIO`, `LIMITE_DIA` (muebles por día), `MARGEN_HABILES` (días hábiles mínimos para la primera fecha de entrega) |
| Datos del sitio | `SITE_PHONE`, `SITE_EMAIL`, `SITE_ADDRESS` |

`FIREBASE_SERVICE_ACCOUNT_FILE` es la **ruta** al JSON de la cuenta de servicio de Firebase, que debe estar **fuera de la carpeta web y de git**. En producción: `/etc/woodenhouse/firebase-service-account.json`.

---

## Firebase

Proyecto: `woodenhouse-898de`.

- **Auth:** correo/contraseña para el personal y los clientes. Al iniciar sesión, el servidor marca al personal con el claim `staff: true` (`firebaseMarcarPersonal()`). Storage usa ese claim para permitir subidas.
- **Firestore:** reglas **cerradas**; solo el servidor escribe, con la cuenta de servicio. La colección `notificaciones` funciona como cola: PHP escribe un documento y la Cloud Function manda el correo y/o el push.
- **Storage:** solo el personal sube archivos, cada tipo en su carpeta, con su formato y su tamaño máximo:
  - `productos/`: fotos del catálogo (5 MB).
  - `pedidos/<carpeta>/adjuntos` y `modelos`: fotos y notas de voz (15 MB).
  - `proyectos/pedidos/<id>/`: `.skp` (60 MB), cortes `.nc`/`.tap`/`.dxf` (25 MB) e imágenes.
  - `cotizaciones/…`: fotos del cliente (5 MB), propuesta (10 MB) y PDF (8 MB).
- **Functions** (`firebase/functions/index.js`):
  - `onNuevaNotificacion` envía los correos con Brevo y los push con FCM;
  - `limpiarNotificacionesAntiguas` corre cada día.

```bash
cd firebase
firebase deploy --only "firestore:rules,storage"   # reglas
firebase deploy --only "functions"                  # funciones
```

> En PowerShell, la lista separada por comas **debe ir entre comillas**. Sin ellas, solo se despliega lo primero de la lista.

---

## Servidor de producción y despliegue

- **Servidor:** Ubuntu + Apache, `DocumentRoot /var/www/html/public`, con un `Alias /api` hacia `/var/www/html/api`. El sitio por defecto de Apache (`000-default`) está deshabilitado.
- **Cloudflare** (proxy) termina el HTTPS. El firewall (`ufw`) solo acepta los puertos 80 y 443 desde los rangos de IP de Cloudflare.
- **Caché:** `av()` versiona cada JS y CSS por el **contenido** del archivo, así que al subir un archivo cambiado el navegador baja la versión nueva aunque el programa de subida conserve la fecha. Si algo se ve viejo, purga una vez la caché de Cloudflare.

### Orden al subir una actualización

1. Si hay cambios de base de datos, corre primero la migración (`database/migracion_….sql`).
2. Sube los archivos (`api/`, `includes/`, `public/`). Nunca subas `.env`, `.git/`, `node_modules/`, `DIAGRAMAS/` ni `RECURSOS/`.
3. Si cambiaron las reglas o las funciones de Firebase, despliégalas.
4. Prueba con un pedido de prueba el flujo que cambió.

### Webhooks de pago

- **Stripe:** `https://<dominio>/api/pagos.php?action=stripe_webhook`
  - eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
  - el signing secret va en `STRIPE_WEBHOOK_SECRET`
- **PayPal:** `https://<dominio>/api/pagos.php?action=paypal_webhook`
  - eventos: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `CHECKOUT.ORDER.VOIDED`
  - el ID del webhook va en `PAYPAL_WEBHOOK_ID`

---

## Notificaciones

| Canal | Para quién | Cómo |
|-------|-----------|------|
| **Campanita del panel** | Cada persona ve **solo las suyas** (por rol, por área del empleado o dirigidas a ella) | `notificarPanel()` → tabla `notificaciones_personal`, en tiempo real por SSE |
| **Push** | jefe, ventas, diseñador y empleados (**nunca** el administrador) | FCM; el dispositivo queda ligado a la cuenta que tiene la sesión abierta y se da de baja al cerrar sesión |
| **Correo** | Cliente: confirmaciones y cambios de estado. Jefe y ventas: copia completa. Diseño, taller e instalación: aviso corto | Firestore → Cloud Function → Brevo |

Algunos avisos:
- pedido nuevo;
- pedido listo para producción, listo para entregar o modificado;
- cotización nueva o confirmada;
- cita nueva.

---

## Seguridad

- **CSP con nonce** (`includes/csp.php`): ningún script inline se ejecuta sin el `nonce` de la petición. Solo `pago.php` conserva `'unsafe-inline'`, por los SDK de pago.
- **Sesiones:** inactividad de 15 min y límite absoluto. Con `sesiones_revocadas_desde` se cierran todas las sesiones de una cuenta.
- **CSRF:** cookie `XSRF-TOKEN` más la cabecera `X-CSRF-Token` en todo `POST`/`PUT`/`DELETE`.
- **Límites de peticiones** en el login, la creación y edición de pedidos, las descargas y los formularios públicos (con campo trampa contra bots).
- **Privacidad del folio:** la búsqueda pública por folio no muestra nombre ni montos.
- **Montos ocultos** en la API para los roles que no deben verlos (no basta con no pintarlos).
- **URLs de archivos:** solo se aceptan las de Firebase Storage del proyecto. La descarga de entregables solo baja del bucket propio, para que el servidor no sirva de puente hacia cualquier sitio.
- **Archivos sensibles bloqueados por Apache:** `.env`, `.sql`, `.log`, `firebase-adminsdk*.json`, copias `~`/`.swp`, y las carpetas `includes/`, `database/`, `logs/` y `firebase/`.
- La cuenta de servicio de Firebase vive fuera de la carpeta web.

---

## Reglas para código nuevo

1. **Sin JavaScript inline:**
   - nada de `onclick=`, `onchange=` u `onerror=`;
   - usa `data-call="funcion"` con `data-args='[…]'` (o `data-onchange` / `data-oninput`), que maneja `event-delegation.js`;
   - un `<script>` inline lleva `nonce="<?= cspNonce() ?>"`.
2. **Recursos versionados:** incluye JS y CSS con `av('js/archivo.js')` para que la caché se renueve sola.
3. **Montos:** antes de mostrar o devolver cifras, revisa `puedeVerMontos()` / `window.WH_VE_MONTOS`.
4. **Responsivo:** todo el sitio y los 4 paneles deben funcionar en celular. Prueba cada cambio a 390 px de ancho.
5. **Iconos** con Lucide: `<i data-lucide="nombre"></i>` y después `lucide.createIcons()`.
6. **Secciones plegables** con `<details class="wh-collapse">` (o `wh-subcollapse`): la pastilla "Mostrar ⌄ / Ocultar ⌃" sale sola.
7. **Textos guardados con `sanitize()`** (htmlspecialchars): al ponerlos en un `<input>` hay que decodificarlos (ver `_pmTexto()` en `pedido-manual.js`).
8. **Cambios de base de datos:** escribe una migración y actualiza `schema.sql` (ver [Base de datos](#base-de-datos)).

---

## API

Todas las respuestas son JSON: `{ success: true, … }` o `{ success: false, error }`.

| Endpoint | Acceso | Para qué |
|----------|--------|----------|
| `pedidos.php` | Público (checkout, folio) / personal | Listar, ver, cambiar estado y fecha. Acciones: `crear_manual`, `editar_manual`, `agregar_adjunto`, `descargar_diseno` |
| `pagos.php` | Público / webhooks / jefe y ventas | Stripe, PayPal y pagos manuales |
| `productos.php`, `categorias.php` | Público (GET) / gestión | Catálogo, fotos, especificaciones y precio por ancho |
| `cotizaciones.php`, `cotizador_catalogo.php` | Público (POST) / gestión | Solicitudes, respuesta con partidas y PDF, conversión a pedido |
| `citas.php`, `calendario.php` | Público (POST) / personal | Citas de medición e instalación |
| `disponibilidad.php`, `capacidad.php`, `dias_bloqueados.php` | Público (GET) / gestión | Fechas de entrega posibles |
| `clientes.php` | Cliente / gestión | Perfil e historial |
| `empleados.php`, `invitaciones.php` | Gestión / público (activar) | Personal e invitaciones |
| `notificaciones.php`, `eventos.php`, `push_tokens.php` | Personal | Campanita, tiempo real (SSE) y push |
| `reportes.php` | Jefe | Ventas, pedidos, productos y clientes |
| `ofertas.php` | Público (activas) / gestión | Cupones y promociones |
| `auth.php` | — | Login con token de Firebase (personal y clientes) |

El historial de cambios por versión está en el log de git (`git log`).
