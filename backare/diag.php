<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain; charset=utf-8');

if (($_GET['secret'] ?? '') !== 'are2026debug') { http_response_code(403); die('Forbidden'); }

// ── Quick translation test mode ────────────────────────────────────────────
// ── Fix English descriptions already in DB ───────────────────────────────
if (isset($_GET['fix_english'])) {
    @set_time_limit(0);
    require_once __DIR__ . '/config/database.php';
    require_once __DIR__ . '/core/integrations.php';
    $pdo = db();
    $rows = $pdo->query("SELECT id, tokko_id, description FROM properties WHERE description IS NOT NULL AND description != '' ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    $total = count($rows);
    $fixed = 0;
    $skipped = 0;
    $failed  = 0;
    echo "Found {$total} properties with descriptions.\n\n";
    foreach ($rows as $row) {
        $desc = $row['description'];
        if (!tokko_is_english($desc)) {
            $skipped++;
            continue;
        }
        echo "[ID {$row['id']} | {$row['tokko_id']}]\n";
        echo "  EN: " . mb_substr($desc, 0, 120) . "...\n";
        $translated = tokko_translate_to_spanish($desc);
        if (!empty($translated) && strtolower(trim($translated)) !== strtolower(trim($desc))) {
            $pdo->prepare('UPDATE properties SET description = ?, updated_at = NOW() WHERE id = ?')
                ->execute([$translated, $row['id']]);
            echo "  ES: " . mb_substr($translated, 0, 120) . "...\n";
            $fixed++;
        } else {
            echo "  [!] Translation failed or unchanged\n";
            $failed++;
        }
        echo "\n";
        @ob_flush(); @flush();
    }
    echo "\n=== DONE: {$fixed} translated, {$skipped} already Spanish, {$failed} failed ===\n";
    exit;
}

if (isset($_GET['test_translate'])) {
    require_once __DIR__ . '/core/integrations.php';
    $sample = $_GET['text'] ?? 'This beautiful property is located in a quiet area with 3 bedrooms and 2 bathrooms.';
    echo "=== TRANSLATION TEST ===\n\n";
    echo "Input: {$sample}\n\n";
    $isEng = tokko_is_english($sample);
    echo "tokko_is_english() → " . ($isEng ? 'true (will translate)' : 'false (will NOT translate)') . "\n\n";

    echo "=== RAW API DEBUG ===\n";
    echo "curl_init available: " . (function_exists('curl_init') ? 'YES' : 'NO') . "\n";

    // Test Lingva (primary)
    echo "\n--- Lingva Test ---\n";
    $lingvaUrl = 'https://lingva.ml/api/v1/en/es/' . rawurlencode(mb_substr($sample, 0, 200));
    echo "URL: {$lingvaUrl}\n";
    if (function_exists('curl_init')) {
        $ch = curl_init($lingvaUrl);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0]);
        $rawL = curl_exec($ch);
        echo "HTTP: " . curl_getinfo($ch, CURLINFO_HTTP_CODE) . " | errno: " . curl_errno($ch) . " | error: " . curl_error($ch) . "\n";
        curl_close($ch);
        echo "Response: " . ($rawL ?: '(empty)') . "\n";
    }

    // Test MyMemory (fallback)
    echo "\n--- MyMemory Test ---\n";
    $mmUrl = 'https://api.mymemory.translated.net/get?' . http_build_query(['q' => mb_substr($sample, 0, 200), 'langpair' => 'en|es', 'de' => 'sync@are-inmobiliaria.com']);
    echo "URL: {$mmUrl}\n";
    if (function_exists('curl_init')) {
        $ch = curl_init($mmUrl);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0]);
        $rawM = curl_exec($ch);
        echo "HTTP: " . curl_getinfo($ch, CURLINFO_HTTP_CODE) . " | errno: " . curl_errno($ch) . " | error: " . curl_error($ch) . "\n";
        curl_close($ch);
        echo "Response: " . ($rawM ?: '(empty)') . "\n";
    }

    echo "\n=== FINAL RESULT ===\n";
    if ($isEng) {
        $translated = tokko_translate_to_spanish($sample);
        echo $translated . "\n";
    } else {
        echo "(not detected as English, no translation attempted)\n";
    }
    exit;
}

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


