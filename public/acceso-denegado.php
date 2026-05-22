<?php
require_once dirname(__DIR__) . '/includes/config.php';

$area = htmlspecialchars(trim($_GET['area'] ?? ''), ENT_QUOTES, 'UTF-8');

$titulo  = 'Acceso restringido';
$icono   = 'fa-lock';
$mensaje = 'Necesitas iniciar sesión con una cuenta autorizada para acceder a esta área.';
$detalle = 'Si ya tienes una cuenta, inicia sesión con tus credenciales de personal.';

if ($area === 'admin') {
    $titulo  = 'Área exclusiva de administradores';
    $mensaje = 'Esta sección es exclusiva para administradores del sistema.';
    $detalle = 'Si eres administrador, inicia sesión con tu cuenta de personal para continuar.';
} elseif ($area === 'empleado') {
    $titulo  = 'Área exclusiva de empleados';
    $mensaje = 'Esta sección es exclusiva para el personal de Wooden House.';
    $detalle = 'Si eres parte del equipo, inicia sesión con tu cuenta de personal para continuar.';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso restringido — Wooden House</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #1a1a1a;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #e0d8cc;
      padding: 20px;
    }

    .ad-card {
      background: #252525;
      border: 1px solid #3a3020;
      border-radius: 16px;
      max-width: 520px;
      width: 100%;
      padding: 48px 40px;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    }

    .ad-logo {
      margin-bottom: 28px;
    }
    .ad-logo img {
      height: 64px;
      object-fit: contain;
    }

    .ad-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(139, 105, 20, 0.15);
      border: 2px solid rgba(201, 169, 110, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
      color: #c9a96e;
    }

    .ad-badge {
      display: inline-block;
      background: rgba(192, 57, 43, 0.15);
      border: 1px solid rgba(192, 57, 43, 0.4);
      color: #e07070;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 16px;
    }

    .ad-titulo {
      font-size: 22px;
      font-weight: 700;
      color: #e8dcc8;
      margin-bottom: 12px;
      line-height: 1.3;
    }

    .ad-mensaje {
      font-size: 15px;
      color: #b0a090;
      line-height: 1.6;
      margin-bottom: 8px;
    }

    .ad-detalle {
      font-size: 13px;
      color: #7a7060;
      line-height: 1.5;
      margin-bottom: 32px;
    }

    .ad-acciones {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn-login {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #c9a96e, #a07830);
      color: #1a1008;
      font-weight: 700;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn-login:hover { opacity: 0.88; transform: translateY(-1px); }

    .btn-inicio {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      color: #c9a96e;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      border: 1px solid rgba(201, 169, 110, 0.35);
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .btn-inicio:hover {
      background: rgba(201, 169, 110, 0.08);
      border-color: rgba(201, 169, 110, 0.6);
    }

    .ad-footer {
      margin-top: 32px;
      font-size: 12px;
      color: #5a5040;
    }

    @media (max-width: 480px) {
      .ad-card { padding: 36px 24px; }
      .ad-acciones { flex-direction: column; align-items: center; }
      .btn-login, .btn-inicio { width: 100%; justify-content: center; }
    }
  </style>
</head>
<body>

  <div class="ad-card">
    <div class="ad-logo">
      <a href="/inicio">
        <img src="/assets/img/logo-header.png" alt="Wooden House">
      </a>
    </div>

    <div class="ad-icon">
      <i class="fa-solid <?= $icono ?>"></i>
    </div>

    <div class="ad-badge">Acceso restringido</div>

    <h1 class="ad-titulo"><?= $titulo ?></h1>
    <p class="ad-mensaje"><?= $mensaje ?></p>
    <p class="ad-detalle"><?= $detalle ?></p>

    <div class="ad-acciones">
      <a href="/inicio?auth=1" class="btn-login">
        <i class="fa-solid fa-right-to-bracket"></i>
        Iniciar sesión
      </a>
      <a href="/inicio" class="btn-inicio">
        <i class="fa-solid fa-house"></i>
        Ir al inicio
      </a>
    </div>

    <p class="ad-footer">
      ¿Eres cliente? <a href="/catalogo" style="color:#8a7860; text-decoration:none;">Ver catálogo →</a>
    </p>
  </div>

</body>
</html>
