<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain; charset=utf-8');

if (($_GET['secret'] ?? '') !== 'are2026debug') { http_response_code(403); die('Forbidden'); }

$cfg = require __DIR__ . '/config/config.php';
$key     = $cfg['tokko']['api_key'];
$propUrl = $cfg['tokko']['url'];
$devUrl  = $cfg['tokko']['development_url'];

function fetch_all_diag(string $baseUrl, string $key): array {
    $items = []; $offset = 0; $limit = 50;
    do {
        $sep = str_contains($baseUrl, '?') ? '&' : '?';
        $url = $baseUrl . $sep . "key={$key}&limit={$limit}&offset={$offset}";
        $ctx = stream_context_create(['http' => ['timeout' => 20]]);
        $raw = @file_get_contents($url, false, $ctx);
        if (!$raw) break;
        $data  = json_decode($raw, true);
        $page  = $data['objects'] ?? $data['results'] ?? [];
        $total = (int)($data['meta']['total_count'] ?? count($page));
        $items = array_merge($items, $page);
        $offset += count($page);
        if (count($page) < $limit || $offset >= $total) break;
    } while (true);
    return $items;
}

// ── PROPERTY ENDPOINT ────────────────────────────────────────────────────────
echo "=== PROPERTY ENDPOINT ===\n";
echo "URL: {$propUrl}\n";
$propItems = fetch_all_diag($propUrl, $key);
echo "Total items fetched: " . count($propItems) . "\n";

$withDev = 0; $withoutDev = 0; $devIds = [];
foreach ($propItems as $item) {
    if (!empty($item['development']['id']) && is_array($item['development'])) {
        $withDev++;
        $devIds[(string)$item['development']['id']] = $item['development']['publication_title'] ?? $item['development']['name'] ?? '?';
    } else {
        $withoutDev++;
    }
}
echo "  items WITH development.id:    {$withDev}\n";
echo "  items WITHOUT development.id: {$withoutDev}\n";
echo "  Unique development IDs found: " . count($devIds) . "\n";
foreach ($devIds as $id => $name) {
    echo "    devId={$id}  name={$name}\n";
}

// ── DEVELOPMENT ENDPOINT ─────────────────────────────────────────────────────
echo "\n=== DEVELOPMENT ENDPOINT ===\n";
echo "URL: {$devUrl}\n";
$devItems = fetch_all_diag($devUrl, $key);
echo "Total items fetched: " . count($devItems) . "\n";
foreach ($devItems as $item) {
    echo "  id=" . ($item['id'] ?? '?') . "  name=" . ($item['publication_title'] ?? $item['name'] ?? '?') . "\n";
}

// ── DB ───────────────────────────────────────────────────────────────────────
echo "\n=== DB developments ===\n";
$db  = $cfg['db'];
$pdo = new PDO(
    "mysql:host={$db['host']};dbname={$db['dbname']};charset=utf8mb4",
    $db['user'], $db['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$rows = $pdo->query(
    "SELECT tokko_id, title, LEFT(tags_json,200) t FROM properties WHERE listing_kind='development' ORDER BY id"
)->fetchAll(PDO::FETCH_ASSOC);
echo "Count: " . count($rows) . "\n";
foreach ($rows as $r) {
    echo "  {$r['tokko_id']}  {$r['title']}\n";
    echo "    tags: {$r['t']}\n";
}

// ── STAMP ────────────────────────────────────────────────────────────────────
echo "\n=== STAMP ===\n";
$stamp = __DIR__ . '/logs/last_sync.stamp';
echo is_file($stamp) ? trim(file_get_contents($stamp)) . "\n" : "NO STAMP\n";


