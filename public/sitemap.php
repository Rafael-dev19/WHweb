<?php
/**
 * sitemap.php — Sitemap XML dinámico
 * Servido en https://muebleswh.com/sitemap.xml via .htaccess
 */
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/xml; charset=utf-8');
header('X-Robots-Tag: noindex');

$baseUrl  = APP_URL;
$hoy      = date('Y-m-d');
$lastmodTerminos = date('Y-m-d', filemtime(__DIR__ . '/terminos.php'));

// Páginas estáticas
$estaticas = [
    ['loc' => '/',            'lastmod' => $hoy,             'freq' => 'weekly',  'pri' => '1.0'],
    ['loc' => '/catalogo',    'lastmod' => $hoy,             'freq' => 'daily',   'pri' => '0.9'],
    ['loc' => '/seguimiento', 'lastmod' => $hoy,             'freq' => 'monthly', 'pri' => '0.6'],
    ['loc' => '/terminos',    'lastmod' => $lastmodTerminos, 'freq' => 'yearly',  'pri' => '0.3'],
    ['loc' => '/privacidad',  'lastmod' => $hoy,             'freq' => 'yearly',  'pri' => '0.3'],
];

// Productos activos con su imagen principal
$productos = dbRows(
    "SELECT p.id,
            DATE(p.fecha_actualizacion) AS lastmod,
            ip.url_imagen
     FROM productos p
     LEFT JOIN imagenes_producto ip
            ON ip.producto_id = p.id AND ip.es_principal = 1
     WHERE p.activo = 1
     ORDER BY p.id ASC"
);

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n";
echo '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n\n";

// Páginas estáticas
foreach ($estaticas as $p) {
    echo "  <url>\n";
    echo "    <loc>{$baseUrl}{$p['loc']}</loc>\n";
    echo "    <lastmod>{$p['lastmod']}</lastmod>\n";
    echo "    <changefreq>{$p['freq']}</changefreq>\n";
    echo "    <priority>{$p['pri']}</priority>\n";
    echo "  </url>\n\n";
}

// Productos
foreach ($productos as $p) {
    $loc     = htmlspecialchars("{$baseUrl}/detalle/{$p['id']}");
    $lastmod = $p['lastmod'] ?: $hoy;
    echo "  <url>\n";
    echo "    <loc>{$loc}</loc>\n";
    echo "    <lastmod>{$lastmod}</lastmod>\n";
    echo "    <changefreq>monthly</changefreq>\n";
    echo "    <priority>0.8</priority>\n";
    if (!empty($p['url_imagen'])) {
        $imgUrl = htmlspecialchars($p['url_imagen']);
        echo "    <image:image>\n";
        echo "      <image:loc>{$imgUrl}</image:loc>\n";
        echo "    </image:image>\n";
    }
    echo "  </url>\n\n";
}

echo '</urlset>' . "\n";
