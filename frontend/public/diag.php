<?php

declare(strict_types=1);

header('Content-Type: text/plain; charset=UTF-8');

echo "diag.php reachable: YES\n";
echo 'script_filename: ' . ($_SERVER['SCRIPT_FILENAME'] ?? 'n/a') . "\n";
echo 'document_root: ' . ($_SERVER['DOCUMENT_ROOT'] ?? 'n/a') . "\n";
echo 'request_uri: ' . ($_SERVER['REQUEST_URI'] ?? 'n/a') . "\n";

echo "\nFile checks:\n";
$files = [
    __DIR__ . '/index.html',
    __DIR__ . '/index.php',
    __DIR__ . '/probe.txt',
];

foreach ($files as $file) {
    echo basename($file) . ' exists=' . (is_file($file) ? 'yes' : 'no') . ' size=' . (is_file($file) ? (string)filesize($file) : 'n/a') . "\n";
}
