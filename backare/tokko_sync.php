<?php

declare(strict_types=1);

require __DIR__ . '/config/database.php';
require __DIR__ . '/core/helpers.php';
require __DIR__ . '/core/integrations.php';

try {
    $result = tokko_sync();
    echo json_encode(['success' => true, 'data' => $result], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $e) {
    log_error($e);
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_PRETTY_PRINT) . PHP_EOL;
    exit(1);
}
