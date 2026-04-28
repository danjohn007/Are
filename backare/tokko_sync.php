<?php

declare(strict_types=1);

require __DIR__ . '/config/database.php';
require __DIR__ . '/core/helpers.php';
require __DIR__ . '/core/integrations.php';

date_default_timezone_set('America/Mexico_City');

$lockPath = __DIR__ . '/logs/tokko_sync.lock';
$lockHandle = fopen($lockPath, 'c+');

if ($lockHandle === false) {
    echo json_encode([
        'success' => false,
        'message' => 'No se pudo crear/abrir el lock de sincronizacion.',
    ], JSON_PRETTY_PRINT) . PHP_EOL;
    exit(1);
}

if (!flock($lockHandle, LOCK_EX | LOCK_NB)) {
    echo json_encode([
        'success' => false,
        'message' => 'Ya hay una sincronizacion en curso. Se omite esta ejecucion.',
    ], JSON_PRETTY_PRINT) . PHP_EOL;
    fclose($lockHandle);
    exit(0);
}

try {
    $result = tokko_sync();
    echo json_encode([
        'success' => true,
        'executed_at' => date('c'),
        'data' => $result,
    ], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $e) {
    log_error($e);
    echo json_encode([
        'success' => false,
        'executed_at' => date('c'),
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT) . PHP_EOL;
    exit(1);
} finally {
    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
}
