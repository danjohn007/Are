<?php

declare(strict_types=1);

$indexFile = __DIR__ . '/index.html';

if (is_file($indexFile)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexFile);
    exit;
}

http_response_code(500);
header('Content-Type: text/plain; charset=UTF-8');
echo 'Frontend index.html not found in this directory.';
