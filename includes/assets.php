<?php
// assets.php — cache-busting automático para /public/assets/js
// Sin dependencias de sesión: se puede cargar en cualquier página.
function av(string $relPath): string {
    static $base = null;
    if ($base === null) {
        $base = dirname(__DIR__) . '/public/assets/';
    }
    // Versión por CONTENIDO del archivo: antes era la fecha de modificación,
    // y al subir con un programa que conserva la fecha original (WinSCP,
    // FileZilla) la versión no cambiaba — navegador y Cloudflare seguían
    // sirviendo el JS/CSS viejo hasta un mes. Ahora cualquier cambio en el
    // archivo cambia la versión y obliga a descargar el nuevo.
    static $cache = [];
    if (!isset($cache[$relPath])) {
        $ruta = $base . $relPath;
        $cache[$relPath] = is_file($ruta) ? substr(hash_file('crc32b', $ruta), 0, 8) : (string)time();
    }
    return $relPath . '?v=' . $cache[$relPath];
}
