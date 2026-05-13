<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
// Temporary diagnostic file — DELETE after use
if (($_GET['secret'] ?? '') !== 'are2026debug') {
    http_response_code(403);
    die('Forbidden');
}

header('Content-Type: application/json; charset=utf-8');

$dir = __DIR__;

// Load config
$cfg = require $dir . '/config/config.php';
$db_cfg  = $cfg['db'];
$tokko_cfg = $cfg['tokko'];

// ── DB ──────────────────────────────────────────────────────────────────────
try {
    $dsn = "mysql:host={$db_cfg['host']};port={$db_cfg['port']};dbname={$db_cfg['dbname']};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_cfg['user'], $db_cfg['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    $dbCounts = $pdo->query(
        "SELECT listing_kind, COUNT(*) as total FROM properties GROUP BY listing_kind"
    )->fetchAll(PDO::FETCH_ASSOC);

    // All non-unit rows: title, tokko_id, branch_name, listing_kind
    $dbAllRows = $pdo->query(
        "SELECT id, tokko_id, title, listing_kind, branch_name,
                LOWER(branch_name) LIKE '%are homes%' AS filtered_by_branch
         FROM properties WHERE listing_kind != 'unit' ORDER BY listing_kind, title"
    )->fetchAll(PDO::FETCH_ASSOC);

    // Rows currently EXCLUDED by the branch filter
    $dbExcluded = $pdo->query(
        "SELECT id, tokko_id, title, listing_kind, branch_name FROM properties
         WHERE NOT (
             (branch_name IS NOT NULL AND LOWER(branch_name) NOT LIKE '%are homes%')
             OR
             (branch_name IS NULL AND (details_json IS NULL OR LOWER(details_json) NOT LIKE '%\"name\":\"are homes%'))
         )"
    )->fetchAll(PDO::FETCH_ASSOC);

    $dbOk = true;
} catch (Exception $e) {
    $dbCounts  = [];
    $dbAllRows = [];
    $dbExcluded = [];
    $dbOk = $e->getMessage();
}

// ── Tokko raw fetch (first page, property endpoint) ──────────────────────────
$propUrl = rtrim($tokko_cfg['url'] ?? '', '/');
$devUrl  = rtrim($tokko_cfg['development_url'] ?? '', '/');
$apiKey  = $tokko_cfg['api_key'] ?? '';
$ctx = stream_context_create(['http' => ['timeout' => 15]]);

$rawProp = $propUrl ? @file_get_contents($propUrl . '?key=' . urlencode($apiKey) . '&limit=50&offset=0', false, $ctx) : false;
$propDecoded = $rawProp ? json_decode($rawProp, true) : null;
$propTokkoTotal = $propDecoded['meta']['total_count'] ?? null;
$propItems = array_map(fn($i) => [
    'id'          => $i['id'] ?? null,
    'title'       => $i['publication_title'] ?? $i['title'] ?? $i['name'] ?? '?',
    'branch'      => $i['branch']['name'] ?? null,
    'has_dev_parent' => isset($i['development']['id']) ? (int)$i['development']['id'] : null,
], $propDecoded['objects'] ?? $propDecoded['results'] ?? []);

$rawDev = $devUrl ? @file_get_contents($devUrl . '?key=' . urlencode($apiKey) . '&limit=50&offset=0', false, $ctx) : false;
$devDecoded  = $rawDev ? json_decode($rawDev, true) : null;
$devTokkoTotal = $devDecoded['meta']['total_count'] ?? null;
$devItems = array_map(fn($i) => [
    'id'     => $i['id'] ?? null,
    'title'  => $i['publication_title'] ?? $i['title'] ?? $i['name'] ?? '?',
    'branch' => $i['branch']['name'] ?? null,
], $devDecoded['objects'] ?? $devDecoded['results'] ?? []);

// Check stamp file
$stamp = @file_get_contents($dir . '/logs/last_sync.stamp') ?: '(no stamp)';

echo json_encode([
    'last_sync_stamp'         => $stamp,
    'db_ok'                   => $dbOk,
    'db_counts_by_kind'       => $dbCounts,
    'db_all_non_unit_rows'    => $dbAllRows,
    'db_rows_excluded_by_filter' => $dbExcluded,
    'tokko_prop_endpoint'     => $propUrl ?: '(not configured)',
    'tokko_prop_total'        => $propTokkoTotal,
    'tokko_prop_fetch'        => $rawProp !== false ? 'ok' : 'FAILED',
    'tokko_prop_items'        => $propItems,
    'tokko_dev_endpoint'      => $devUrl ?: '(not configured)',
    'tokko_dev_total'         => $devTokkoTotal,
    'tokko_dev_fetch'         => $rawDev !== false ? 'ok' : 'FAILED',
    'tokko_dev_items'         => $devItems,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
