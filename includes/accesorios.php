<?php
// accesorios.php — Accesorios del catálogo de baño 2026 (RECURSOS/Catalogo
// Wooden House.pdf, págs. 10-14). Una sola fuente para el sitio del cliente,
// el pedido manual, la API y los paneles: el precio de los adicionales se
// calcula SIEMPRE aquí en el servidor, nunca con lo que mande el navegador.
//
// Ovalines y monomandos estándar ya vienen incluidos en el precio del
// paquete (el cliente solo elige cuál). Los adicionales sí suman al precio.

const WH_OVALINES = [
    // Línea incluida (cerámica)
    ['codigo' => 'T003',  'medidas' => '46 × 46 × 16 cm',     'linea' => 'incluido'],
    ['codigo' => 'T212',  'medidas' => '44 × 34 × 12.5 cm',   'linea' => 'incluido'],
    ['codigo' => 'T030',  'medidas' => '33.5 × 29 × 11.5 cm', 'linea' => 'incluido'],
    ['codigo' => 'T025',  'medidas' => '40 × 40 × 15.5 cm',   'linea' => 'incluido'],
    ['codigo' => 'T022',  'medidas' => '48 × 37 × 13 cm',     'linea' => 'incluido'],
    ['codigo' => 'T049',  'medidas' => '42 × 42 × 12 cm',     'linea' => 'incluido'],
    ['codigo' => 'T031',  'medidas' => '52 × 43 × 15.5 cm',   'linea' => 'incluido'],
    ['codigo' => 'T211',  'medidas' => '48 × 37 × 13.5 cm',   'linea' => 'incluido'],
    ['codigo' => 'T271',  'medidas' => '33 × 33 × 13 cm',     'linea' => 'incluido'],
    ['codigo' => 'T267',  'medidas' => '28.5 × 28.5 × 11.5 cm', 'linea' => 'incluido'],
    ['codigo' => 'T029',  'medidas' => '40 × 40 × 15.5 cm',   'linea' => 'incluido'],
    ['codigo' => 'T234B', 'medidas' => '57.5 × 39 × 10 cm',   'linea' => 'incluido'],
    // Línea económica (misma calidad estructural, acabados más sencillos)
    ['codigo' => 'DQ-LAV-207', 'medidas' => '45.5 × 32 × 13.5 cm', 'linea' => 'economica'],
    ['codigo' => 'DQ-LAV-214', 'medidas' => '40 × 30 × 13 cm',     'linea' => 'economica'],
    ['codigo' => 'DQ-LAV-216', 'medidas' => '48 × 37 × 13 cm',     'linea' => 'economica'],
    ['codigo' => 'DQ-LAV-218', 'medidas' => '48 × 37 × 13 cm',     'linea' => 'economica'],
    ['codigo' => 'DQ-LAV-226', 'medidas' => '35 × 35 × 14 cm',     'linea' => 'economica'],
];

const WH_MONOMANDOS = [
    ['codigo' => 'YM-25L',       'acabado' => 'Plateado'],
    ['codigo' => 'YM-213-FX',    'acabado' => 'Plateado'],
    ['codigo' => 'YM-T15L-B',    'acabado' => 'Plateado'],
    ['codigo' => 'YM-T17L',      'acabado' => 'Plateado'],
    ['codigo' => 'YM-13-LWKH',   'acabado' => 'Negro mate'],
    ['codigo' => 'YM-313-LWKH',  'acabado' => 'Negro mate'],
    ['codigo' => 'YM-T15L-BKH',  'acabado' => 'Negro mate'],
    ['codigo' => 'YM-T315L-BKH', 'acabado' => 'Negro mate'],
    ['codigo' => 'YM-BLACK-G29', 'acabado' => 'Negro mate'],
    ['codigo' => 'YM-25L-KH',    'acabado' => 'Negro mate'],
    ['codigo' => 'YM-1302-DOR',  'acabado' => 'Dorado'],
];

// Personalizaciones con precio fijo (pág. 14). Espejo LED ("desde $1,500,
// varios tamaños"), color especial y cubiertas de piedra (por metro lineal)
// varían según el proyecto: se cotizan, no se suman solos.
const WH_ADICIONALES = [
    'entrepano'      => ['nombre' => 'Entrepaño adicional',       'detalle' => 'Repisa interna extra',     'precio' => 300],
    'cajon'          => ['nombre' => 'Cajón adicional',           'detalle' => 'Con corredera incluida',   'precio' => 500],
    'puerta'         => ['nombre' => 'Puerta con bisagra',        'detalle' => 'Cierre lento incluido',    'precio' => 250],
    'laca'           => ['nombre' => 'Acabado premium / laca',    'detalle' => 'Alta resistencia',         'precio' => 800],
    'ovalin_premium' => ['nombre' => 'Ovalín premium específico', 'detalle' => 'Modelos importados',       'precio' => 300],
];

// Cubiertas de piedra por metro lineal instalado (pág. 13).
const WH_CUBIERTAS_ML = ['granito' => 3800, 'marmol' => 3800, 'cuarzo' => 4800];

function whAccesoriosParaJs(): array {
    return [
        'ovalines'    => WH_OVALINES,
        'monomandos'  => WH_MONOMANDOS,
        'adicionales' => WH_ADICIONALES,
        'cubiertas_ml' => WH_CUBIERTAS_ML,
    ];
}

function whOvalinValido(string $codigo): bool {
    return in_array($codigo, array_column(WH_OVALINES, 'codigo'), true);
}

function whMonomandoValido(string $codigo): bool {
    return in_array($codigo, array_column(WH_MONOMANDOS, 'codigo'), true);
}

// Normaliza la lista de adicionales elegidos y devuelve [claves, costo total].
function whAdicionalesElegidos($lista): array {
    $claves = [];
    foreach ((is_array($lista) ? $lista : []) as $k) {
        if (is_string($k) && isset(WH_ADICIONALES[$k]) && !in_array($k, $claves, true)) $claves[] = $k;
    }
    $costo = array_sum(array_map(fn($k) => WH_ADICIONALES[$k]['precio'], $claves));
    return [$claves, (float)$costo];
}

// Texto legible para paneles/correos: "Cajón adicional, Laca".
function whAdicionalesTexto(array $claves): string {
    return implode(', ', array_map(fn($k) => WH_ADICIONALES[$k]['nombre'] ?? $k, $claves));
}
