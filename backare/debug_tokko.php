<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
// Temporary diagnostic file — DELETE after use
if (($_GET['secret'] ?? '') !== 'are2026debug') {
    http_response_code(403);
    die('Forbidden');
}
echo "PHP OK\n";

header('Content-Type: application/json; charset=utf-8');

$dir = __DIR__;

// Load config
$cfg = require $dir . '/config/config.php';
$db_cfg = $cfg['db'];
$tokko_cfg = $cfg['tokko'];

// DB connection
try {
    $dsn = "mysql:host={$db_cfg['host']};port={$db_cfg['port']};dbname={$db_cfg['dbname']};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_cfg['user'], $db_cfg['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $dbCounts = $pdo->query("SELECT listing_kind, COUNT(*) as total FROM properties GROUP BY listing_kind")->fetchAll(PDO::FETCH_ASSOC);
    $devSample = $pdo->query("SELECT id, tokko_id, title, LEFT(tags_json,300) as tags FROM properties WHERE listing_kind='development' LIMIT 3")->fetchAll(PDO::FETCH_ASSOC);
    $dbOk = true;
} catch (Exception $e) {
    $dbCounts = [];
    $devSample = [];
    $dbOk = $e->getMessage();
}

// Fetch Tokko
$devUrl = $tokko_cfg['development_url'] . '?key=' . $tokko_cfg['api_key'] . '&limit=2&offset=0';
$ctx = stream_context_create(['http' => ['timeout' => 10]]);
$raw = @file_get_contents($devUrl, false, $ctx);
$decoded = $raw ? json_decode($raw, true) : null;
$firstItems = array_slice($decoded['objects'] ?? $decoded['results'] ?? [], 0, 2);
$tokkoTotal = $decoded['meta']['total_count'] ?? null;

// Check stamp file
$stamp = @file_get_contents($dir . '/logs/last_sync.stamp') ?: '(no stamp)';

echo json_encode([
    'db_ok'       => $dbOk,
    'db_counts'   => $dbCounts,
    'dev_sample'  => $devSample,
    'stamp'       => $stamp,
    'tokko_total' => $tokkoTotal,
    'tokko_url'   => $devUrl,
    'tokko_fetch' => $raw !== false ? 'ok' : 'FAILED',
    'first_items' => $firstItems,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
