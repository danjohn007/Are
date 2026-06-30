<?php
declare(strict_types=1);

if (isset($_GET['are_version_check'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'file' => '/public_html/backare/index.php',
        'version' => 'ARE_IDS_40600_41099_48647_53159_58279',
        'time' => date('c')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

require __DIR__ . '/config/database.php';
require __DIR__ . '/core/helpers.php';
require __DIR__ . '/core/security.php';
require __DIR__ . '/core/integrations.php';
apply_security_headers();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
apply_rate_limit();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_path();

if ((bool)(app_config()['app']['log_requests'] ?? false)) {
    log_info('Incoming request', [
        'method' => $method,
        'path' => $path,
        'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]);
}


function repair_property_row_description_if_needed(array $row): array
{
    // Antes se refrescaba SIEMPRE contra Tokko al abrir el detalle; eso podía tardar 30s-1min.
    // Ahora solo se consulta Tokko si la descripción local está vacía/cortada.
    $current = trim((string)($row['description'] ?? ''));
    $currentLength = mb_strlen($current, 'UTF-8');
    $needsRepair = $current === ''
        || $currentLength < 260
        || (function_exists('tokko_description_is_probably_cut') && tokko_description_is_probably_cut($current));

    if (!$needsRepair) {
        return $row;
    }

    if (function_exists('tokko_refresh_property_row_from_tokko')) {
        $row = tokko_refresh_property_row_from_tokko($row);
        $current = trim((string)($row['description'] ?? ''));
        $currentLength = mb_strlen($current, 'UTF-8');
        $needsRepair = $current === ''
            || $currentLength < 260
            || (function_exists('tokko_description_is_probably_cut') && tokko_description_is_probably_cut($current));

        if (!$needsRepair) {
            return $row;
        }
    }

    $details = decode_json_field($row['details_json'] ?? null, []);
    $publicUrl = $details['public_url'] ?? null;

    if (!is_string($publicUrl) || !filter_var($publicUrl, FILTER_VALIDATE_URL)) {
        return $row;
    }

    $publicDescription = tokko_fetch_public_description($publicUrl);
    $publicLength = mb_strlen($publicDescription, 'UTF-8');

    if ($publicLength <= max($currentLength + 40, 260) || !tokko_description_is_valid($publicDescription)) {
        return $row;
    }

    try {
        $stmt = db()->prepare('UPDATE properties SET description = :description, updated_at = NOW() WHERE id = :id');
        $stmt->execute([
            ':description' => $publicDescription,
            ':id' => (int)$row['id'],
        ]);
        $row['description'] = $publicDescription;
        clear_property_list_cache();
    } catch (Throwable $e) {
        log_error($e);
    }

    return $row;
}


function output_remote_property_asset(array $row, int $index): void
{
    $photos = decode_json_field($row['photos_json'] ?? null, []);
    if (!$photos && !empty($row['image_url'])) {
        $photos = [[
            'image' => $row['image_url'],
            'thumb' => $row['image_url'],
            'original' => $row['image_url'],
        ]];
    }

    $photo = $photos[$index] ?? null;
    if (!is_array($photo)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'Imagen no encontrada']);
        exit;
    }

    $url = $photo['original'] ?? $photo['image'] ?? $photo['thumb'] ?? null;
    if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'URL de imagen inválida']);
        exit;
    }

    $headers = [];
    $body = false;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (ARE PDF Image Proxy)',
            CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$headers) {
                $len = strlen($header);
                $parts = explode(':', $header, 2);
                if (count($parts) === 2) {
                    $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return $len;
            },
        ]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($status < 200 || $status >= 300) {
            $body = false;
        }
    } else {
        $ctx = stream_context_create(['http' => [
            'timeout' => 20,
            'header' => "User-Agent: Mozilla/5.0 (ARE PDF Image Proxy)
",
        ]]);
        $body = @file_get_contents($url, false, $ctx);
    }

    if (!is_string($body) || $body === '') {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => 'No se pudo cargar la imagen remota']);
        exit;
    }

    $contentType = $headers['content-type'] ?? null;
    if (!is_string($contentType) || stripos($contentType, 'image/') !== 0) {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $contentType = match ($ext) {
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => 'image/jpeg',
        };
    }

    header('Content-Type: ' . $contentType);
    header('Cache-Control: public, max-age=86400');
    header('Content-Length: ' . strlen($body));
    echo $body;
    exit;
}



function public_are_real_estate_filter_sql(string $alias = ''): string
{
    $prefix = $alias !== '' ? rtrim($alias, '.') . '.' : '';

    // Regla pública definitiva:
    // El sitio ARE debe mostrar únicamente inventario cuya sucursal sea ARE Real Estate.
    // No se filtra por título, tags o descripción, porque esos campos pueden contener
    // textos comerciales y provocar falsos positivos. La fuente confiable es branch_name
    // y, como respaldo, el bloque details_json.branch que guardamos desde Tokko.
    $branch  = "LOWER(COALESCE({$prefix}branch_name, ''))";
    $details = "LOWER(COALESCE({$prefix}details_json, ''))";

    return "(
        (
            {$branch} LIKE '%are real estate%'
            OR {$branch} LIKE '%are real state%'
            OR {$details} LIKE '%\"name\":\"are real estate\"%'
            OR {$details} LIKE '%\"display_name\":\"are real estate\"%'
            OR {$details} LIKE '%\"name\": \"are real estate\"%'
            OR {$details} LIKE '%\"display_name\": \"are real estate\"%'
            OR {$details} LIKE '%\"name\":\"are real state\"%'
            OR {$details} LIKE '%\"display_name\":\"are real state\"%'
            OR {$details} LIKE '%\"name\": \"are real state\"%'
            OR {$details} LIKE '%\"display_name\": \"are real state\"%'
        )
        AND {$branch} NOT LIKE '%are homes%'
        AND {$branch} NOT LIKE '%arehomes%'
        AND {$branch} NOT LIKE '%are-homes%'
    )";
}

function is_public_are_real_estate_row(array $row): bool
{
    $branch = strtolower(trim((string)($row['branch_name'] ?? '')));
    $details = strtolower((string)($row['details_json'] ?? ''));

    $isHomes = str_contains($branch, 'are homes')
        || str_contains($branch, 'arehomes')
        || str_contains($branch, 'are-homes');

    if ($isHomes) {
        return false;
    }

    return str_contains($branch, 'are real estate')
        || str_contains($branch, 'are real state')
        || str_contains($details, '"name":"are real estate"')
        || str_contains($details, '"display_name":"are real estate"')
        || str_contains($details, '"name": "are real estate"')
        || str_contains($details, '"display_name": "are real estate"')
        || str_contains($details, '"name":"are real state"')
        || str_contains($details, '"display_name":"are real state"')
        || str_contains($details, '"name": "are real state"')
        || str_contains($details, '"display_name": "are real state"');
}

function property_list_cache_dir(): string
{
    $dir = __DIR__ . '/logs/cache';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function property_list_cache_key(array $parts): string
{
    ksort($parts);
    return 'properties_' . sha1(json_encode($parts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function read_property_list_cache(string $key, int $ttlSeconds): ?string
{
    if ($ttlSeconds < 1) {
        return null;
    }

    $file = property_list_cache_dir() . '/' . $key . '.json';
    if (!is_file($file)) {
        return null;
    }

    if ((time() - (int)@filemtime($file)) > $ttlSeconds) {
        return null;
    }

    $payload = @file_get_contents($file);
    return is_string($payload) && $payload !== '' ? $payload : null;
}

function write_property_list_cache(string $key, string $payload): void
{
    $dir = property_list_cache_dir();
    @file_put_contents($dir . '/' . $key . '.json', $payload, LOCK_EX);
}

function clear_property_list_cache(): void
{
    $dir = property_list_cache_dir();
    foreach (glob($dir . '/properties_*.json') ?: [] as $file) {
        @unlink($file);
    }
}

function respond_cached_json(string $payload, int $maxAgeSeconds = 60): void
{
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=' . $maxAgeSeconds . ', stale-while-revalidate=300');
    header('X-ARE-Cache: HIT');
    echo $payload;
    exit;
}


function are_debug_tokko_fetch_all(string $baseUrl, string $apiKey, array $extraParams = []): array
{
    $baseUrl = trim($baseUrl);
    if ($baseUrl === '' || $apiKey === '') {
        return ['items' => [], 'pages' => [], 'total_reported' => null, 'error' => 'Tokko URL o API key no configurada'];
    }

    $items = [];
    $pages = [];
    $offset = 0;
    $limit = 100;
    $totalReported = null;
    $safety = 0;

    while ($safety < 30) {
        $safety++;
        $separator = str_contains($baseUrl, '?') ? '&' : '?';
        $params = array_merge($extraParams, [
            'key' => $apiKey,
            'limit' => $limit,
            'offset' => $offset,
        ]);
        $url = $baseUrl . $separator . http_build_query($params);

        $ctx = stream_context_create(['http' => ['timeout' => 20]]);
        $raw = @file_get_contents($url, false, $ctx);
        $payload = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

        if (!is_array($payload)) {
            $pages[] = [
                'offset' => $offset,
                'limit' => $limit,
                'ok' => false,
                'items_returned' => 0,
                'raw_preview' => is_string($raw) ? substr($raw, 0, 300) : null,
            ];
            break;
        }

        $pageItems = $payload['objects'] ?? $payload['results'] ?? $payload['data'] ?? [];
        if (!is_array($pageItems)) {
            $pageItems = [];
        }

        $meta = is_array($payload['meta'] ?? null) ? $payload['meta'] : [];
        $totalReported = $totalReported
            ?? ($meta['total_count'] ?? $meta['total'] ?? $payload['total_count'] ?? $payload['total'] ?? null);

        $pages[] = [
            'offset' => $offset,
            'limit' => $limit,
            'ok' => true,
            'items_returned' => count($pageItems),
            'total_reported' => $totalReported,
            'has_next' => !empty($meta['next']),
        ];

        foreach ($pageItems as $item) {
            if (is_array($item)) {
                $items[] = $item;
            }
        }

        if (count($pageItems) === 0) {
            break;
        }

        $offset += count($pageItems);
        if ($totalReported !== null && $offset >= (int)$totalReported) {
            break;
        }

        if (empty($meta['next']) && count($pageItems) < $limit) {
            break;
        }
    }

    return ['items' => $items, 'pages' => $pages, 'total_reported' => $totalReported, 'error' => null];
}

function are_debug_tokko_branch_name(array $item): string
{
    $branch = $item['branch'] ?? null;
    if (is_array($branch)) {
        foreach (['display_name', 'name'] as $key) {
            if (isset($branch[$key]) && is_string($branch[$key]) && trim($branch[$key]) !== '') {
                return trim($branch[$key]);
            }
        }
    }
    return '';
}

function are_debug_tokko_development_summary(array $item, string $source = 'development_endpoint'): array
{
    $branch = $item['branch'] ?? [];
    $location = is_array($item['location'] ?? null) ? $item['location'] : [];

    return [
        'source' => $source,
        'id' => $item['id'] ?? null,
        'name' => $item['publication_title'] ?? $item['title'] ?? $item['name'] ?? $item['fake_address'] ?? null,
        'fake_address' => $item['fake_address'] ?? null,
        'address' => $item['address'] ?? null,
        'branch_id' => is_array($branch) ? ($branch['id'] ?? null) : null,
        'branch_name' => are_debug_tokko_branch_name($item),
        'branch_email' => is_array($branch) ? ($branch['email'] ?? null) : null,
        'display_on_web' => $item['display_on_web'] ?? null,
        'deleted_at' => $item['deleted_at'] ?? null,
        'construction_status' => $item['construction_status'] ?? null,
        'construction_date' => $item['construction_date'] ?? null,
        'location' => $location['full_location'] ?? null,
        'unit_amount' => $item['unit_amount'] ?? null,
    ];
}

function are_debug_group_by_branch(array $rows): array
{
    $out = [];
    foreach ($rows as $row) {
        $branch = trim((string)($row['branch_name'] ?? ''));
        if ($branch === '') {
            $branch = 'SIN SUCURSAL';
        }
        $out[$branch] = ($out[$branch] ?? 0) + 1;
    }
    ksort($out);
    return $out;
}

function are_debug_tokko_development_variant_report(string $devUrl, string $apiKey): array
{
    $variants = function_exists('tokko_development_fetch_variant_params')
        ? tokko_development_fetch_variant_params()
        : [[]];

    $report = [];
    foreach ($variants as $params) {
        $fetch = are_debug_tokko_fetch_all($devUrl, $apiKey, $params);
        $rows = [];
        foreach (($fetch['items'] ?? []) as $item) {
            if (is_array($item)) {
                $rows[] = are_debug_tokko_development_summary($item, 'development_variant');
            }
        }

        $report[] = [
            'params' => $params,
            'total_reported' => $fetch['total_reported'] ?? null,
            'loaded' => count($rows),
            'by_branch' => are_debug_group_by_branch($rows),
            'ids' => array_values(array_filter(array_map(static fn ($row) => $row['id'] ?? null, $rows))),
            'pages' => $fetch['pages'] ?? [],
        ];
    }

    return $report;
}

function are_debug_tokko_probe_development_ids(string $devUrl, string $apiKey, array $ids): array
{
    $out = [];

    foreach (array_values(array_unique(array_map('strval', $ids))) as $id) {
        $id = trim($id);
        if ($id === '' || !ctype_digit($id)) {
            continue;
        }

        $detail = function_exists('tokko_fetch_item_detail') ? tokko_fetch_item_detail($devUrl, $apiKey, $id) : null;
        $out[] = [
            'id' => $id,
            'found' => is_array($detail) && !empty($detail),
            'summary' => (is_array($detail) && !empty($detail)) ? are_debug_tokko_development_summary($detail, 'development_detail_by_id') : null,
        ];
    }

    return $out;
}

try {
    // ─── Health ──────────────────────────────────────────────────────────────
    if ($path === '/health' && $method === 'GET') {
        respond(200, ['success' => true, 'service' => 'are-api', 'ts' => date('c')]);
    }

    // ─── Auth ────────────────────────────────────────────────────────────────
    if ($path === '/auth/login' && $method === 'GET') {
        respond(405, ['success' => false, 'message' => 'Use POST /api/auth/login con cuerpo JSON']);
    }

    if ($path === '/auth/login' && $method === 'POST') {
        $input = json_input();
        if (empty($input['email']) || empty($input['password'])) {
            respond(422, ['success' => false, 'message' => 'Email y contraseña son requeridos']);
        }

        $stmt = db()->prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $input['email']]);
        $user = $stmt->fetch();

        $validPassword = false;
        if ($user) {
            $storedHash = (string)$user['password_hash'];
            $validPassword = password_verify($input['password'], $storedHash);
            if (!$validPassword && str_starts_with($storedHash, '$2')) {
                $validPassword = hash_equals($storedHash, crypt($input['password'], $storedHash));
            }
        }

        if (!$user || !$validPassword) {
            respond(401, ['success' => false, 'message' => 'Credenciales incorrectas']);
        }

        $basePayload = ['id' => (int)$user['id'], 'email' => $user['email'], 'role' => $user['role']];
        $cfg = app_config()['app'];
        $access  = jwt_sign($basePayload, $cfg['access_secret'],  (int)$cfg['access_ttl']);
        $refresh = jwt_sign($basePayload, $cfg['refresh_secret'], (int)$cfg['refresh_ttl']);

        respond(200, [
            'success' => true,
            'data' => [
                'user' => ['id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']],
                'accessToken' => $access,
                'refreshToken' => $refresh,
            ],
        ]);
    }

    if ($path === '/auth/refresh' && $method === 'POST') {
        $input = json_input();
        $token = $input['refreshToken'] ?? '';
        if (!$token) {
            respond(422, ['success' => false, 'message' => 'refreshToken es requerido']);
        }
        $cfg = app_config()['app'];
        $payload = jwt_verify($token, $cfg['refresh_secret']);
        if (!$payload) {
            respond(401, ['success' => false, 'message' => 'Token de refresco inválido']);
        }
        $access = jwt_sign(['id' => $payload['id'], 'email' => $payload['email'], 'role' => $payload['role']], $cfg['access_secret'], (int)$cfg['access_ttl']);
        respond(200, ['success' => true, 'data' => ['accessToken' => $access]]);
    }

    if ($path === '/auth/me' && $method === 'GET') {
        $auth = require_auth();
        $stmt = db()->prepare('SELECT id, name, email, role, created_at FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $auth['id']]);
        respond(200, ['success' => true, 'data' => $stmt->fetch()]);
    }

    // ─── Upload de imagen / documento ─────────────────────────────────────────
    if ($path === '/upload' && $method === 'POST') {
        require_auth();
        if (empty($_FILES['image'])) {
            respond(400, ['success' => false, 'message' => 'No se recibió ningún archivo']);
        }
        $file    = $_FILES['image'];
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        if (!in_array($file['type'], $allowed, true)) {
            respond(400, ['success' => false, 'message' => 'Tipo de archivo no permitido. Use JPG, PNG, WEBP, GIF o PDF.']);
        }
        $maxSize = $file['type'] === 'application/pdf' ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            respond(400, ['success' => false, 'message' => 'El archivo excede el tamaño máximo permitido']);
        }
        $ext       = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $target    = preg_replace('/[^a-z0-9_-]/i', '', (string)($_POST['target'] ?? ''));
        $fixedPdfTargets = ['avisodeprivacidad', 'terminosycondiciones'];

        if ($target && in_array($target, $fixedPdfTargets, true)) {
            if ($file['type'] !== 'application/pdf') {
                respond(400, ['success' => false, 'message' => 'Este documento legal debe subirse en PDF.']);
            }
            $filename = $target . '.pdf';
        } else {
            $prefix = $file['type'] === 'application/pdf' ? 'doc_' : 'img_';
            $filename = uniqid($prefix, true) . '.' . $ext;
        }

        $uploadDir = __DIR__ . '/uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
            respond(500, ['success' => false, 'message' => 'No se pudo guardar el archivo']);
        }
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host     = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $url      = $protocol . '://' . $host . '/backare/uploads/' . $filename;
        if (!empty($target) && in_array($target, $fixedPdfTargets, true)) {
            $url .= '?v=' . time();
        }
        respond(200, ['success' => true, 'data' => ['url' => $url]]);
    }

    // ─── Servicios ───────────────────────────────────────────────────────────
    if ($path === '/services' && $method === 'GET') {
        [$page, $limit, $offset] = pagination();
        $returnAll = isset($_GET['all']) && $_GET['all'] === '1';
        $categoryFilter = isset($_GET['category']) ? trim($_GET['category']) : null;
        $validCategories = ['propietarios', 'usuarios'];

        if ($returnAll) {
            require_admin();
            if ($categoryFilter && in_array($categoryFilter, $validCategories, true)) {
                $rows  = db()->prepare('SELECT * FROM services WHERE category = :cat ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
                $rows->bindValue(':cat', $categoryFilter);
                $total = (int)db()->query("SELECT COUNT(*) FROM services WHERE category = " . db()->quote($categoryFilter))->fetchColumn();
            } else {
                $rows  = db()->prepare('SELECT * FROM services ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
                $total = (int)db()->query('SELECT COUNT(*) FROM services')->fetchColumn();
            }
        } else {
            if ($categoryFilter && in_array($categoryFilter, $validCategories, true)) {
                $rows  = db()->prepare('SELECT * FROM services WHERE active = 1 AND category = :cat ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
                $rows->bindValue(':cat', $categoryFilter);
                $total = (int)db()->query("SELECT COUNT(*) FROM services WHERE active = 1 AND category = " . db()->quote($categoryFilter))->fetchColumn();
            } else {
                $rows  = db()->prepare('SELECT * FROM services WHERE active = 1 ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
                $total = (int)db()->query('SELECT COUNT(*) FROM services WHERE active = 1')->fetchColumn();
            }
        }
        $rows->bindValue(':limit', $limit, PDO::PARAM_INT);
        $rows->bindValue(':offset', $offset, PDO::PARAM_INT);
        $rows->execute();
        respond(200, ['success' => true, 'data' => $rows->fetchAll(), 'meta' => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit)]]);
    }

    if (preg_match('#^/services/(\d+)$#', $path, $m) && $method === 'GET') {
        $stmt = db()->prepare('SELECT * FROM services WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => (int)$m[1]]);
        $service = $stmt->fetch();
        if (!$service) { respond(404, ['success' => false, 'message' => 'Servicio no encontrado']); }
        respond(200, ['success' => true, 'data' => $service]);
    }

    if ($path === '/services' && $method === 'POST') {
        require_admin();
        $input = json_input();
        if (empty($input['name']) || empty($input['slug'])) {
            respond(422, ['success' => false, 'message' => 'name y slug son requeridos']);
        }
        $allowedCategories = ['propietarios', 'usuarios'];
        $inputCategory = $input['category'] ?? 'propietarios';
        if (!in_array($inputCategory, $allowedCategories, true)) {
            $inputCategory = 'propietarios';
        }
        $stmt = db()->prepare('INSERT INTO services (name, slug, description, active, image_url, category, brochure_url, form_schema) VALUES (:name, :slug, :description, :active, :image_url, :category, :brochure_url, :form_schema)');
        $stmt->execute([
            ':name'        => $input['name'],
            ':slug'        => $input['slug'],
            ':description' => $input['description'] ?? null,
            ':active'      => isset($input['active']) ? ((bool)$input['active'] ? 1 : 0) : 1,
            ':image_url'   => $input['image_url'] ?? null,
            ':category'    => $inputCategory,
            ':brochure_url'=> $input['brochure_url'] ?? null,
            ':form_schema' => isset($input['form_schema']) ? json_encode($input['form_schema']) : null,
        ]);
        $id = (int)db()->lastInsertId();
        $fetch = db()->prepare('SELECT * FROM services WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => $id]);
        respond(201, ['success' => true, 'data' => $fetch->fetch()]);
    }

    if (preg_match('#^/services/(\d+)$#', $path, $m) && $method === 'PUT') {
        require_admin();
        $input = json_input();
        $allowedCategoriesUpd = ['propietarios', 'usuarios'];
        $inputCategoryUpd = $input['category'] ?? 'propietarios';
        if (!in_array($inputCategoryUpd, $allowedCategoriesUpd, true)) {
            $inputCategoryUpd = 'propietarios';
        }
        $stmt = db()->prepare('UPDATE services SET name=:name, slug=:slug, description=:description, active=:active, image_url=:image_url, category=:category, brochure_url=:brochure_url, form_schema=:form_schema, updated_at=NOW() WHERE id=:id');
        $stmt->execute([
            ':name'        => $input['name'] ?? '',
            ':slug'        => $input['slug'] ?? '',
            ':description' => $input['description'] ?? null,
            ':active'      => isset($input['active']) ? ((bool)$input['active'] ? 1 : 0) : 1,
            ':image_url'   => $input['image_url'] ?? null,
            ':category'    => $inputCategoryUpd,
            ':brochure_url'=> $input['brochure_url'] ?? null,
            ':form_schema' => isset($input['form_schema']) ? json_encode($input['form_schema']) : null,
            ':id'          => (int)$m[1],
        ]);
        $fetch = db()->prepare('SELECT * FROM services WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => (int)$m[1]]);
        $updated = $fetch->fetch();
        if (!$updated) { respond(404, ['success' => false, 'message' => 'Servicio no encontrado']); }
        respond(200, ['success' => true, 'data' => $updated]);
    }

    if (preg_match('#^/services/(\d+)$#', $path, $m) && $method === 'DELETE') {
        require_admin();
        $stmt = db()->prepare('DELETE FROM services WHERE id = :id');
        $stmt->execute([':id' => (int)$m[1]]);
        if ($stmt->rowCount() < 1) { respond(404, ['success' => false, 'message' => 'Servicio no encontrado']); }
        respond(200, ['success' => true, 'message' => 'Servicio eliminado']);
    }

    // ─── Leads ───────────────────────────────────────────────────────────────
    if ($path === '/leads' && $method === 'POST') {
        $input = json_input();
        if (empty($input['name']) || empty($input['email']) || empty($input['phone'])) {
            respond(422, ['success' => false, 'message' => 'name, email y phone son requeridos']);
        }

        $encEmail = encrypt_value($input['email']);
        $encPhone = encrypt_value($input['phone']);

        $stmt = db()->prepare('INSERT INTO leads (name, email_encrypted, phone_encrypted, message, service_id, property_id, status, source, extra_data) VALUES (:name, :email_encrypted, :phone_encrypted, :message, :service_id, :property_id, :status, :source, :extra_data)');
        $stmt->execute([
            ':name'            => $input['name'],
            ':email_encrypted' => $encEmail,
            ':phone_encrypted' => $encPhone,
            ':message'         => $input['message'] ?? null,
            ':service_id'      => $input['service_id'] ?? null,
            ':property_id'     => $input['property_id'] ?? null,
            ':status'          => $input['status'] ?? 'new',
            ':source'          => $input['source'] ?? 'web',
            ':extra_data'      => isset($input['extra_data']) ? json_encode($input['extra_data']) : null,
        ]);

        $id = (int)db()->lastInsertId();
        $fetch = db()->prepare('SELECT * FROM leads WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => $id]);
        $lead = $fetch->fetch();

        $serviceName = null;
        if (!empty($lead['service_id'])) {
            $q = db()->prepare('SELECT name FROM services WHERE id = :id');
            $q->execute([':id' => $lead['service_id']]);
            $serviceName = $q->fetchColumn() ?: null;
        }
        // Fallback: usar el nombre enviado directamente desde el frontend
        if (!$serviceName && !empty($input['service_name'])) {
            $serviceName = (string)$input['service_name'];
        }

        send_whatsapp($input['phone'], 'Hola ' . $lead['name'] . ', recibimos tu solicitud. Te contactaremos pronto. — ARE');

        // Reenviar el contacto directamente a Tokko Broker CRM
        // Necesitamos el tokko_id real (no el id local) para que Tokko vincule la consulta a la propiedad correcta
        $tokkoRemoteId = null;
        $tokkoListingKind = 'property';
        if (!empty($input['property_id'])) {
            $qProp = db()->prepare('SELECT tokko_id, listing_kind FROM properties WHERE id = :id LIMIT 1');
            $qProp->execute([':id' => (int)$input['property_id']]);
            $propRow = $qProp->fetch();
            if ($propRow) {
                $tokkoListingKind = (string)($propRow['listing_kind'] ?? 'property');
                $tokkoRawId = (string)($propRow['tokko_id'] ?? '');

                // Sync stores ids like "property:12345" or "development:12345"
                if (strpos($tokkoRawId, ':') !== false) {
                    $parts = explode(':', $tokkoRawId, 2);
                    if (isset($parts[1]) && ctype_digit($parts[1])) {
                        $tokkoRemoteId = (int)$parts[1];
                    }
                } elseif (ctype_digit($tokkoRawId)) {
                    $tokkoRemoteId = (int)$tokkoRawId;
                }
            }
        }

        $tokkoMessage = $input['message'] ?? '';

        // Always forward to Tokko so leads appear in "Consultas".
        // When there is no linked property ($tokkoRemoteId === null) the payload omits the
        // `properties` array, which means Tokko receives it as a general inquiry — it should
        // land in "Pendientes" unless a Tokko automation rule moves it (configure those rules
        // directly in Tokko Broker > Configuración > Reglas de automatización).
        $tokkoOk = tokko_send_contact(
            $lead['name'],
            $input['email'],
            $input['phone'],
            $tokkoMessage !== '' ? $tokkoMessage : null,
            $tokkoRemoteId,
            $tokkoListingKind
        );

        $lead['email'] = $input['email'];
        $lead['phone'] = $input['phone'];
        respond(201, ['success' => true, 'data' => $lead, 'tokko_forwarded' => $tokkoOk]);
    }

    if ($path === '/leads' && $method === 'GET') {
        require_admin();
        [$page, $limit, $offset] = pagination();
        $status = $_GET['status'] ?? null;

        if ($status) {
            $stmt  = db()->prepare('SELECT l.*, s.name AS service_name FROM leads l LEFT JOIN services s ON s.id = l.service_id WHERE l.status = :status ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset');
            $count = db()->prepare('SELECT COUNT(*) FROM leads WHERE status = :status');
            $count->execute([':status' => $status]);
            $total = (int)$count->fetchColumn();
            $stmt->bindValue(':status', $status);
        } else {
            $stmt  = db()->prepare('SELECT l.*, s.name AS service_name FROM leads l LEFT JOIN services s ON s.id = l.service_id ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset');
            $total = (int)db()->query('SELECT COUNT(*) FROM leads')->fetchColumn();
        }

        $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['email'] = decrypt_value($row['email_encrypted'] ?? null);
            $row['phone'] = decrypt_value($row['phone_encrypted'] ?? null);
        }

        respond(200, ['success' => true, 'data' => $rows, 'meta' => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit)]]);
    }

    if (preg_match('#^/leads/(\d+)$#', $path, $m) && $method === 'GET') {
        require_admin();
        $stmt = db()->prepare('SELECT l.*, s.name AS service_name FROM leads l LEFT JOIN services s ON s.id = l.service_id WHERE l.id = :id LIMIT 1');
        $stmt->execute([':id' => (int)$m[1]]);
        $lead = $stmt->fetch();
        if (!$lead) { respond(404, ['success' => false, 'message' => 'Lead no encontrado']); }
        $lead['email'] = decrypt_value($lead['email_encrypted'] ?? null);
        $lead['phone'] = decrypt_value($lead['phone_encrypted'] ?? null);
        respond(200, ['success' => true, 'data' => $lead]);
    }

    if (preg_match('#^/leads/(\d+)$#', $path, $m) && $method === 'PATCH') {
        require_admin();
        $input  = json_input();
        $allowed = ['new', 'contacted', 'closed', 'discarded'];
        $status = $input['status'] ?? null;
        if (!$status || !in_array($status, $allowed, true)) {
            respond(400, ['success' => false, 'message' => 'Estado no valido']);
        }
        $stmt = db()->prepare('UPDATE leads SET status=:status, updated_at=NOW() WHERE id=:id');
        $stmt->execute([':status' => $status, ':id' => (int)$m[1]]);
        if ($stmt->rowCount() < 1) { respond(404, ['success' => false, 'message' => 'Lead no encontrado']); }
        respond(200, ['success' => true, 'data' => ['id' => (int)$m[1], 'status' => $status]]);
    }

    if (preg_match('#^/leads/(\d+)$#', $path, $m) && $method === 'PUT') {
        require_admin();
        $input = json_input();
        $stmt = db()->prepare('UPDATE leads SET name=:name, email_encrypted=:email_encrypted, phone_encrypted=:phone_encrypted, message=:message, service_id=:service_id, property_id=:property_id, status=:status, source=:source, extra_data=:extra_data, updated_at=NOW() WHERE id=:id');
        $stmt->execute([
            ':name'            => $input['name'] ?? '',
            ':email_encrypted' => encrypt_value($input['email'] ?? null),
            ':phone_encrypted' => encrypt_value($input['phone'] ?? null),
            ':message'         => $input['message'] ?? null,
            ':service_id'      => $input['service_id'] ?? null,
            ':property_id'     => $input['property_id'] ?? null,
            ':status'          => $input['status'] ?? 'new',
            ':source'          => $input['source'] ?? 'web',
            ':extra_data'      => isset($input['extra_data']) ? json_encode($input['extra_data']) : null,
            ':id'              => (int)$m[1],
        ]);
        $fetch = db()->prepare('SELECT * FROM leads WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => (int)$m[1]]);
        $lead = $fetch->fetch();
        if (!$lead) { respond(404, ['success' => false, 'message' => 'Lead no encontrado']); }
        $lead['email'] = $input['email'] ?? null;
        $lead['phone'] = $input['phone'] ?? null;
        respond(200, ['success' => true, 'data' => $lead]);
    }

    if (preg_match('#^/leads/(\d+)$#', $path, $m) && $method === 'DELETE') {
        require_admin();
        $stmt = db()->prepare('DELETE FROM leads WHERE id = :id');
        $stmt->execute([':id' => (int)$m[1]]);
        if ($stmt->rowCount() < 1) { respond(404, ['success' => false, 'message' => 'Lead no encontrado']); }
        respond(200, ['success' => true, 'message' => 'Lead eliminado']);
    }

    // ─── Propiedades ─────────────────────────────────────────────────────────
    if ($path === '/properties' && $method === 'GET') {
        // Esta ruta debe ser rápida: solo lee la BD/cache local.
        // La sincronización completa con Tokko se hace desde el botón admin /properties/sync/tokko.
        ensure_property_columns();

        $city          = $_GET['city'] ?? null;
        $operation     = $_GET['operation_type'] ?? null;
        $kind          = $_GET['listing_kind'] ?? null;
        $property_type = $_GET['property_type'] ?? null;
        $rawLimit      = $_GET['limit'] ?? null;
        $returnAll     = $rawLimit === null || $rawLimit === '' || strtolower((string)$rawLimit) === 'all';
        $pageParam     = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limitParam    = isset($_GET['limit']) && is_numeric($_GET['limit']) ? max(1, min((int)$_GET['limit'], 500)) : 100;
        $skipCache     = isset($_GET['nocache']) && (string)$_GET['nocache'] === '1';
        $cacheTtl      = 300; // 5 minutos: evita consultas pesadas repetidas al navegar.

        $cacheKey = property_list_cache_key([
            'city' => $city,
            'operation_type' => $operation,
            'listing_kind' => $kind,
            'property_type' => $property_type,
            'limit' => $returnAll ? 'all' : $limitParam,
            'page' => $returnAll ? 1 : $pageParam,
            // v3: el sitio público solo debe mostrar inventario de ARE Real Estate,
            // excluyendo cualquier propiedad/desarrollo de ARE Homes.
            'v' => 'fast-v11-strict-real-estate-filter',
        ]);

        if (!$skipCache) {
            $cached = read_property_list_cache($cacheKey, $cacheTtl);
            if ($cached !== null) {
                respond_cached_json($cached, 60);
            }
        }

        $where  = [];
        $params = [];

        // Filtro público definitivo: propiedades, unidades y desarrollos visibles
        // deben pertenecer a ARE Real Estate. ARE Homes no debe mostrarse en el portal.
        $where[] = public_are_real_estate_filter_sql();

        if ($city) {
            $where[]              = 'city LIKE :city';
            $params[':city']      = '%' . $city . '%';
        }
        if ($operation) {
            $where[]                   = 'operation_type = :operation_type';
            $params[':operation_type'] = $operation;
        }
        if ($kind === 'inventory') {
            // Vista pública de Propiedades: incluye propiedades independientes + unidades.
            $where[] = "listing_kind IN ('property','unit')";
        } elseif ($kind) {
            $where[]                = 'listing_kind = :listing_kind';
            $params[':listing_kind'] = $kind;
        } else {
            // Units are only fetched through inventory or /properties/{id}/units, not the main generic list.
            $where[] = "listing_kind != 'unit'";
        }
        if ($property_type) {
            $where[]                   = 'LOWER(property_type) = LOWER(:property_type)';
            $params[':property_type']  = $property_type;
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $count = db()->prepare("SELECT COUNT(*) FROM properties $whereClause");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $columns = "id, tokko_id, title, description, price, address, city, bedrooms, bathrooms, area,
                    image_url, operation_type, listing_kind, property_type, reference_code,
                    location_full, parent_tokko_id, branch_name, tags_json, details_json, created_at, updated_at";

        if ($returnAll) {
            $page = 1;
            $limit = max($total, 1);
            $stmt = db()->prepare("SELECT $columns FROM properties $whereClause ORDER BY created_at DESC");
            foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
        } else {
            $page = $pageParam;
            $limit = $limitParam;
            $offset = ($page - 1) * $limit;
            $stmt = db()->prepare("SELECT $columns FROM properties $whereClause ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
            foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        }

        $stmt->execute();
        $rows = array_map('normalize_property_row', $stmt->fetchAll());

        $payload = (string)json_encode([
            'success' => true,
            'data'    => $rows,
            'meta'    => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int)ceil($total / max($limit, 1)),
                'cached' => false,
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        write_property_list_cache($cacheKey, $payload);

        http_response_code(200);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: public, max-age=60, stale-while-revalidate=300');
        header('X-ARE-Cache: MISS');
        echo $payload;
        exit;
    }

    if (preg_match('#^/properties/(\d+)/asset/(\d+)$#', $path, $m) && $method === 'GET') {
        $numId = (int)$m[1];
        $assetIndex = (int)$m[2];
        $stmt = db()->prepare('SELECT * FROM properties WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $numId]);
        $row = $stmt->fetch();
        if (!$row) {
            $stmt2 = db()->prepare("SELECT * FROM properties WHERE tokko_id IN (:pid, :did) LIMIT 1");
            $stmt2->execute([
                ':pid' => 'property:' . $numId,
                ':did' => 'development:' . $numId,
            ]);
            $row = $stmt2->fetch();
        }
        if (!$row || !is_public_are_real_estate_row($row)) {
            http_response_code(404);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['success' => false, 'message' => 'Propiedad no encontrada']);
            exit;
        }

        // Refresca fotos desde Tokko antes de generar la ficha. Esto evita 404
        // cuando la BD todavía tiene photos_json vacío o desactualizado.
        if (function_exists('tokko_refresh_property_row_from_tokko')) {
            $row = tokko_refresh_property_row_from_tokko($row);
        }

        output_remote_property_asset($row, $assetIndex);
    }

    if (preg_match('#^/properties/(\d+)/units$#', $path, $m) && $method === 'GET') {
        $numId = (int)$m[1];
        $parent = db()->prepare('SELECT tokko_id FROM properties WHERE id = :id LIMIT 1');
        $parent->execute([':id' => $numId]);
        $parentRow = $parent->fetch();
        // Fallback: try by tokko_id numeric part
        if (!$parentRow) {
            $p2 = db()->prepare(
                "SELECT tokko_id FROM properties WHERE tokko_id IN (:pid, :did) LIMIT 1"
            );
            $p2->execute([':pid' => 'property:' . $numId, ':did' => 'development:' . $numId]);
            $parentRow = $p2->fetch();
        }
        if (!$parentRow) { respond(404, ['success' => false, 'message' => 'Desarrollo no encontrado']); }
        $stmt = db()->prepare("SELECT * FROM properties WHERE parent_tokko_id = :ptid AND " . public_are_real_estate_filter_sql() . " ORDER BY price ASC, title ASC");
        $stmt->execute([':ptid' => $parentRow['tokko_id']]);
        $rows = array_map('normalize_property_row', $stmt->fetchAll());
        respond(200, ['success' => true, 'data' => $rows, 'meta' => ['total' => count($rows)]]);
    }

    if (preg_match('#^/properties/(\d+)$#', $path, $m) && $method === 'GET') {
        $numId = (int)$m[1];
        // First try by DB primary key
        $stmt = db()->prepare('SELECT * FROM properties WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $numId]);
        $row = $stmt->fetch();
        // Fallback: the number might be a Tokko id (e.g. old links after re-sync)
        if (!$row) {
            $stmt2 = db()->prepare(
                "SELECT * FROM properties WHERE tokko_id IN (:pid, :did) LIMIT 1"
            );
            $stmt2->execute([
                ':pid' => 'property:'    . $numId,
                ':did' => 'development:' . $numId,
            ]);
            $row = $stmt2->fetch();
        }
        if (!$row) { respond(404, ['success' => false, 'message' => 'Propiedad no encontrada']); }
        if (!is_public_are_real_estate_row($row)) { respond(404, ['success' => false, 'message' => 'Propiedad no encontrada']); }
        $row = repair_property_row_description_if_needed($row);
        respond(200, ['success' => true, 'data' => normalize_property_row($row)]);
    }

    if ($path === '/properties' && $method === 'POST') {
        require_admin();
        $input = json_input();
        $stmt = db()->prepare('INSERT INTO properties (tokko_id, title, description, price, address, city, bedrooms, bathrooms, area, image_url, operation_type, listing_kind) VALUES (:tokko_id, :title, :description, :price, :address, :city, :bedrooms, :bathrooms, :area, :image_url, :operation_type, :listing_kind)');
        $stmt->execute([
            ':tokko_id'      => $input['tokko_id'] ?? null,
            ':title'         => $input['title'] ?? '',
            ':description'   => $input['description'] ?? null,
            ':price'         => (float)($input['price'] ?? 0),
            ':address'       => $input['address'] ?? null,
            ':city'          => $input['city'] ?? null,
            ':bedrooms'      => (int)($input['bedrooms'] ?? 0),
            ':bathrooms'     => (int)($input['bathrooms'] ?? 0),
            ':area'          => (float)($input['area'] ?? 0),
            ':image_url'     => $input['image_url'] ?? null,
            ':operation_type'=> $input['operation_type'] ?? 'venta',
            ':listing_kind'  => $input['listing_kind'] ?? 'property',
        ]);
        $id = (int)db()->lastInsertId();
        $fetch = db()->prepare('SELECT * FROM properties WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => $id]);
        respond(201, ['success' => true, 'data' => $fetch->fetch()]);
    }

    if (preg_match('#^/properties/(\d+)$#', $path, $m) && $method === 'PUT') {
        require_admin();
        $input = json_input();
        $stmt = db()->prepare('UPDATE properties SET title=:title, description=:description, price=:price, address=:address, city=:city, bedrooms=:bedrooms, bathrooms=:bathrooms, area=:area, image_url=:image_url, operation_type=:operation_type, listing_kind=:listing_kind, updated_at=NOW() WHERE id=:id');
        $stmt->execute([
            ':title'         => $input['title'] ?? '',
            ':description'   => $input['description'] ?? null,
            ':price'         => (float)($input['price'] ?? 0),
            ':address'       => $input['address'] ?? null,
            ':city'          => $input['city'] ?? null,
            ':bedrooms'      => (int)($input['bedrooms'] ?? 0),
            ':bathrooms'     => (int)($input['bathrooms'] ?? 0),
            ':area'          => (float)($input['area'] ?? 0),
            ':image_url'     => $input['image_url'] ?? null,
            ':operation_type'=> $input['operation_type'] ?? 'venta',
            ':listing_kind'  => $input['listing_kind'] ?? 'property',
            ':id'            => (int)$m[1],
        ]);
        $fetch = db()->prepare('SELECT * FROM properties WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => (int)$m[1]]);
        $row = $fetch->fetch();
        if (!$row) { respond(404, ['success' => false, 'message' => 'Propiedad no encontrada']); }
        respond(200, ['success' => true, 'data' => $row]);
    }

    if (preg_match('#^/properties/(\d+)$#', $path, $m) && $method === 'DELETE') {
        require_admin();
        $stmt = db()->prepare('DELETE FROM properties WHERE id = :id');
        $stmt->execute([':id' => (int)$m[1]]);
        if ($stmt->rowCount() < 1) { respond(404, ['success' => false, 'message' => 'Propiedad no encontrada']); }
        respond(200, ['success' => true, 'message' => 'Propiedad eliminada']);
    }

    if ($path === '/properties/sync/tokko' && $method === 'POST') {
        require_admin();
        clear_property_list_cache();
        $result = tokko_sync();
        clear_property_list_cache();

        // Conteo real después de guardar en BD.
        // Guardados = todos los desarrollos recibidos/guardados.
        // Visibles = solo desarrollos de ARE Real Estate, que son los que debe mostrar la web.
        try {
            $result['developments_stored_total'] = (int)db()->query(
                "SELECT COUNT(*) FROM properties WHERE listing_kind = 'development'"
            )->fetchColumn();

            $visibleStmt = db()->query(
                "SELECT COUNT(*) FROM properties WHERE listing_kind = 'development' AND " . public_are_real_estate_filter_sql()
            );
            $result['developments_visible_are_real_estate'] = (int)$visibleStmt->fetchColumn();
            // Compatibilidad con el frontend actual del panel admin.
            // El mensaje antiguo lee developments_detected; debe mostrar los visibles de ARE Real Estate.
            $result['developments_detected'] = $result['developments_visible_are_real_estate'];
        } catch (Throwable $e) {
            $result['developments_count_error'] = $e->getMessage();
        }

        // Reset the auto-sync timer so the next automatic run is 15 minutes from now
        $stampFile = __DIR__ . '/logs/last_sync.stamp';
        @file_put_contents($stampFile, 'v26|' . time(), LOCK_EX);
        respond(200, ['success' => true, 'data' => $result]);
    }

    // Diagnostic completo: trae desarrollos desde Tokko sin usar el filtro público.
    // Uso:
    // /backare/api/properties/debug/tokko-all-developments?secret=are2026debug
    if ($path === '/properties/debug/tokko-all-developments' && $method === 'GET') {
        $secret = $_GET['secret'] ?? '';
        if ($secret !== 'are2026debug') {
            respond(403, ['success' => false, 'message' => 'Forbidden']);
        }

        $cfg = app_config()['tokko'];
        $apiKey = (string)($cfg['api_key'] ?? '');
        $devUrl = (string)($cfg['development_url'] ?? '');
        $propUrl = (string)($cfg['url'] ?? '');

        $configuredExtraIds = function_exists('tokko_are_real_estate_development_ids') ? tokko_are_real_estate_development_ids() : [];
        $queryExtraIds = function_exists('tokko_parse_development_ids') ? tokko_parse_development_ids($_GET['ids'] ?? null) : [];
        $probeIds = array_values(array_unique(array_merge($configuredExtraIds, $queryExtraIds)));

        // 1) Desarrollos directos del endpoint /development/
        $direct = are_debug_tokko_fetch_all($devUrl, $apiKey);
        $directRows = [];
        foreach (($direct['items'] ?? []) as $item) {
            if (is_array($item)) {
                $directRows[] = are_debug_tokko_development_summary($item, 'development_endpoint');
            }
        }

        // 2) Desarrollos detectados dentro del endpoint /property/ como padres de unidades.
        // Esto es importante porque Tokko a veces publica unidades y el desarrollo padre
        // aparece en item.development aunque no siempre sea evidente en /development/.
        $property = are_debug_tokko_fetch_all($propUrl, $apiKey);
        $parents = [];
        foreach (($property['items'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $dev = $item['development'] ?? null;
            if (!is_array($dev) || empty($dev['id'])) {
                continue;
            }
            $id = (string)$dev['id'];
            if (!isset($parents[$id])) {
                $parents[$id] = are_debug_tokko_development_summary($dev, 'property_endpoint_parent');
                $parents[$id]['unit_count_seen_in_property_endpoint'] = 0;
            }
            $parents[$id]['unit_count_seen_in_property_endpoint']++;
        }
        $parentRows = array_values($parents);

        // 3) Unión por ID para ver el universo real que estamos detectando desde la API.
        $merged = [];
        foreach (array_merge($directRows, $parentRows) as $row) {
            $id = (string)($row['id'] ?? '');
            if ($id === '') {
                continue;
            }
            if (!isset($merged[$id])) {
                $merged[$id] = $row;
            } else {
                $merged[$id]['source'] = $merged[$id]['source'] . '+' . $row['source'];
                if (empty($merged[$id]['branch_name']) && !empty($row['branch_name'])) {
                    $merged[$id]['branch_name'] = $row['branch_name'];
                }
                if (isset($row['unit_count_seen_in_property_endpoint'])) {
                    $merged[$id]['unit_count_seen_in_property_endpoint'] = $row['unit_count_seen_in_property_endpoint'];
                }
            }
        }
        $mergedRows = array_values($merged);

        // 4) Estado de la BD local y conteo visible.
        ensure_property_columns();
        $dbAll = db()->query(
            "SELECT id, tokko_id, title, listing_kind, branch_name, parent_tokko_id, created_at, updated_at
             FROM properties
             WHERE listing_kind = 'development'
             ORDER BY branch_name ASC, title ASC"
        )->fetchAll();

        $dbVisibleStmt = db()->query(
            "SELECT id, tokko_id, title, listing_kind, branch_name, parent_tokko_id, created_at, updated_at
             FROM properties
             WHERE listing_kind = 'development' AND " . public_are_real_estate_filter_sql() . "
             ORDER BY title ASC"
        );
        $dbVisible = $dbVisibleStmt->fetchAll();

        $variantReport = are_debug_tokko_development_variant_report($devUrl, $apiKey);
        $idProbe = are_debug_tokko_probe_development_ids($devUrl, $apiKey, $probeIds);

        respond(200, [
            'success' => true,
            'message' => 'Diagnóstico sin filtro público: compara direct_developments, property_parent_developments, merged_detected y db_visible_are_real_estate.',
            'tokko_development_endpoint' => [
                'total_reported' => $direct['total_reported'] ?? null,
                'loaded' => count($directRows),
                'pages' => $direct['pages'] ?? [],
                'by_branch' => are_debug_group_by_branch($directRows),
                'items' => $directRows,
            ],
            'tokko_property_endpoint' => [
                'total_reported' => $property['total_reported'] ?? null,
                'loaded_properties_or_units' => is_array($property['items'] ?? null) ? count($property['items']) : 0,
                'pages' => $property['pages'] ?? [],
                'parent_developments_loaded' => count($parentRows),
                'parent_developments_by_branch' => are_debug_group_by_branch($parentRows),
                'parent_developments' => $parentRows,
            ],
            'merged_detected_developments_from_tokko' => [
                'loaded' => count($mergedRows),
                'by_branch' => are_debug_group_by_branch($mergedRows),
                'items' => $mergedRows,
            ],
            'development_endpoint_variants' => $variantReport,
            'configured_extra_development_ids' => $configuredExtraIds,
            'query_probe_ids' => $queryExtraIds,
            'development_detail_probe_by_id' => $idProbe,
            'database' => [
                'stored_developments_total' => count($dbAll),
                'stored_by_branch' => are_debug_group_by_branch($dbAll),
                'visible_are_real_estate_count' => count($dbVisible),
                'all_stored_developments' => $dbAll,
                'visible_are_real_estate' => $dbVisible,
            ],
        ]);
    }

    // Diagnostic: show raw first item from Tokko development endpoint + DB counts
    if ($path === '/properties/debug/tokko' && $method === 'GET') {
        $secret = $_GET['secret'] ?? '';
        if ($secret !== 'are2026debug') {
            respond(403, ['error' => 'Forbidden']);
        }
        $cfg = app_config()['tokko'];
        $devUrl = $cfg['development_url'] . '?key=' . $cfg['api_key'] . '&limit=2&offset=0';
        $raw = @file_get_contents($devUrl);
        $decoded = $raw ? json_decode($raw, true) : null;
        $firstItems = $decoded['objects'] ?? $decoded['results'] ?? [];
        $dbCounts = db()->query(
            "SELECT listing_kind, COUNT(*) as total FROM properties GROUP BY listing_kind"
        )->fetchAll();
        respond(200, [
            'db_counts'   => $dbCounts,
            'tokko_total' => $decoded['meta']['total_count'] ?? null,
            'first_items' => array_slice($firstItems, 0, 2),
        ]);
    }


    // Diagnostic: inspect one specific Tokko property payload and local extraction.
    // Usage: /backare/api/properties/debug/tokko-item?secret=are2026debug&id=7066959
    if ($path === '/properties/debug/tokko-item' && $method === 'GET') {
        $secret = $_GET['secret'] ?? '';
        if ($secret !== 'are2026debug') {
            respond(403, ['error' => 'Forbidden']);
        }

        $rawId = (string)($_GET['id'] ?? '');
        if ($rawId === '') {
            respond(422, ['success' => false, 'message' => 'Falta parámetro id de Tokko']);
        }

        $cfg = app_config()['tokko'];
        $detail = tokko_fetch_item_detail($cfg['url'] ?? '', $cfg['api_key'] ?? '', $rawId);
        if (!$detail) {
            respond(404, ['success' => false, 'message' => 'Tokko no devolvió detalle para ese ID']);
        }

        $publicData = function_exists('tokko_public_ficha_data_for_item') ? tokko_public_ficha_data_for_item($detail, $detail) : [];
        $description = function_exists('tokko_best_description')
            ? tokko_best_description(tokko_extract_description($detail, $detail), (string)($publicData['description'] ?? ''))
            : tokko_extract_description($detail, $detail);
        $details = tokko_extract_details($detail, $detail, false);
        if (function_exists('tokko_apply_public_ficha_data')) {
            $details = tokko_apply_public_ficha_data($details, is_array($publicData) ? $publicData : []);
        }
        respond(200, [
            'success' => true,
            'tokko_id' => $rawId,
            'description_length' => mb_strlen($description, 'UTF-8'),
            'description_preview' => mb_substr($description, 0, 500, 'UTF-8'),
            'description_full' => $description,
            'tags' => tokko_extract_tags($detail),
            'tag_groups' => $details['tag_groups'] ?? null,
            'public_urls_tested' => function_exists('tokko_public_urls_for_item') ? tokko_public_urls_for_item($detail, $detail) : [],
            'public_data' => $publicData,
            'public_url' => $details['public_url'] ?? null,
            'raw_keys' => array_keys($detail),
            'raw' => $detail,
        ]);
    }

    // Quick diagnostic: count rows per listing_kind (admin only, no sensitive data)
    if ($path === '/properties/debug/counts' && $method === 'GET') {
        require_admin();
        $rows = db()->query(
            "SELECT listing_kind, COUNT(*) as total FROM properties GROUP BY listing_kind"
        )->fetchAll();
        $sample = db()->query(
            "SELECT id, tokko_id, title, listing_kind,
                    LEFT(tags_json,200) as tags_preview,
                    LEFT(details_json,300) as details_preview
             FROM properties WHERE listing_kind='development' LIMIT 3"
        )->fetchAll();
        respond(200, ['counts' => $rows, 'dev_sample' => $sample]);
    }

    // ─── Artículos ───────────────────────────────────────────────────────────
    if ($path === '/articles' && $method === 'GET') {
        [$page, $limit, $offset] = pagination();
        $returnAll = isset($_GET['all']) && $_GET['all'] === '1';
        if ($returnAll) {
            require_admin();
            $stmt  = db()->prepare('SELECT * FROM articles ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
            $total = (int)db()->query('SELECT COUNT(*) FROM articles')->fetchColumn();
        } else {
            $stmt  = db()->prepare('SELECT * FROM articles WHERE published = 1 ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
            $total = (int)db()->query('SELECT COUNT(*) FROM articles WHERE published = 1')->fetchColumn();
        }
        $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        respond(200, ['success' => true, 'data' => $stmt->fetchAll(), 'meta' => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit)]]);
    }

    if (preg_match('#^/articles/(\d+)$#', $path, $m) && $method === 'GET') {
        $stmt = db()->prepare('SELECT * FROM articles WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => (int)$m[1]]);
        $row = $stmt->fetch();
        if (!$row) { respond(404, ['success' => false, 'message' => 'Artículo no encontrado']); }
        respond(200, ['success' => true, 'data' => $row]);
    }

    if ($path === '/articles' && $method === 'POST') {
        require_admin();
        $input = json_input();
        $stmt = db()->prepare('INSERT INTO articles (title, slug, excerpt, content, image_url, external_url, published) VALUES (:title, :slug, :excerpt, :content, :image_url, :external_url, :published)');
        $stmt->execute([
            ':title'        => $input['title'] ?? '',
            ':slug'         => $input['slug'] ?? '',
            ':excerpt'      => $input['excerpt'] ?? null,
            ':content'      => $input['content'] ?? '',
            ':image_url'    => $input['image_url'] ?? null,
            ':external_url' => $input['external_url'] ?? null,
            ':published'    => isset($input['published']) ? ((bool)$input['published'] ? 1 : 0) : 1,
        ]);
        $id = (int)db()->lastInsertId();
        $fetch = db()->prepare('SELECT * FROM articles WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => $id]);
        respond(201, ['success' => true, 'data' => $fetch->fetch()]);
    }

    if (preg_match('#^/articles/(\d+)$#', $path, $m) && $method === 'PUT') {
        require_admin();
        $input = json_input();
        $stmt = db()->prepare('UPDATE articles SET title=:title, slug=:slug, excerpt=:excerpt, content=:content, image_url=:image_url, external_url=:external_url, published=:published, updated_at=NOW() WHERE id=:id');
        $stmt->execute([
            ':title'        => $input['title'] ?? '',
            ':slug'         => $input['slug'] ?? '',
            ':excerpt'      => $input['excerpt'] ?? null,
            ':content'      => $input['content'] ?? '',
            ':image_url'    => $input['image_url'] ?? null,
            ':external_url' => $input['external_url'] ?? null,
            ':published'    => isset($input['published']) ? ((bool)$input['published'] ? 1 : 0) : 1,
            ':id'           => (int)$m[1],
        ]);
        $fetch = db()->prepare('SELECT * FROM articles WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => (int)$m[1]]);
        $row = $fetch->fetch();
        if (!$row) { respond(404, ['success' => false, 'message' => 'Artículo no encontrado']); }
        respond(200, ['success' => true, 'data' => $row]);
    }

    if (preg_match('#^/articles/(\d+)$#', $path, $m) && $method === 'DELETE') {
        require_admin();
        $stmt = db()->prepare('DELETE FROM articles WHERE id = :id');
        $stmt->execute([':id' => (int)$m[1]]);
        if ($stmt->rowCount() < 1) { respond(404, ['success' => false, 'message' => 'Artículo no encontrado']); }
        respond(200, ['success' => true, 'message' => 'Artículo eliminado']);
    }

    // ─── Dashboard ───────────────────────────────────────────────────────────
    if ($path === '/dashboard/metrics' && $method === 'GET') {
        require_admin();

        $totals = db()->query("
            SELECT
                (SELECT COUNT(*) FROM leads) AS total,
                (SELECT COUNT(*) FROM leads WHERE status='new') AS new_count,
                (SELECT COUNT(*) FROM leads WHERE status='contacted') AS contacted_count,
                (SELECT COUNT(*) FROM leads WHERE status='closed') AS closed_count,
                (SELECT COUNT(*) FROM properties) AS total_properties,
                (SELECT COUNT(*) FROM articles WHERE published=1) AS total_articles,
                (SELECT COUNT(*) FROM services WHERE active=1) AS total_active_services
        ")->fetch();

        $byService = db()->query("
            SELECT s.name, COUNT(l.id) AS total
            FROM services s
            LEFT JOIN leads l ON l.service_id = s.id
            GROUP BY s.name
            ORDER BY total DESC
        ")->fetchAll();

        $latest = db()->query("SELECT id, name, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5")->fetchAll();

        // Propiedades visibles al publico: solo ARE Real Estate, excluyendo ARE Homes.
        $publicFilter = "listing_kind = 'property' AND " . public_are_real_estate_filter_sql();

        $propStats = db()->query("
            SELECT
                COUNT(*) AS total_public,
                SUM(CASE WHEN LOWER(operation_type) LIKE '%venta%' THEN 1 ELSE 0 END) AS for_sale,
                SUM(CASE WHEN LOWER(operation_type) LIKE '%alquiler%' OR LOWER(operation_type) LIKE '%renta%' THEN 1 ELSE 0 END) AS for_rent
            FROM properties
            WHERE {$publicFilter}
        ")->fetch();

        $propByType = db()->query("
            SELECT property_type AS name, COUNT(*) AS total
            FROM properties
            WHERE {$publicFilter}
            AND property_type IS NOT NULL AND property_type != ''
            GROUP BY property_type
            ORDER BY total DESC
            LIMIT 8
        ")->fetchAll();

        // Desarrollos visibles en el portal: únicamente ARE Real Estate.
        $totalDevelopments = (int)db()->query(
            "SELECT COUNT(*) FROM properties WHERE listing_kind = 'development' AND " . public_are_real_estate_filter_sql()
        )->fetchColumn();

        respond(200, ['success' => true, 'data' => [
            'totals'           => $totals,
            'byService'        => $byService,
            'latest'           => $latest,
            'propStats'        => $propStats,
            'propByType'       => $propByType,
            'totalDevelopments'=> $totalDevelopments,
        ]]);
    }

    // ─── Site Content ──────────────────────────────────────────────────────────
    if ($path === '/site-content' && $method === 'GET') {
        // Auto-create table if it doesn't exist
        db()->exec("CREATE TABLE IF NOT EXISTS site_content (
            `key` VARCHAR(100) NOT NULL PRIMARY KEY,
            `value` LONGTEXT,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $rows = db()->query("SELECT `key`, `value` FROM site_content")->fetchAll();
        $data = [];
        foreach ($rows as $row) {
            $data[$row['key']] = $row['value'];
        }
        respond(200, ['success' => true, 'data' => $data]);
    }

    if (preg_match('#^/site-content/([a-zA-Z0-9_-]+)$#', $path, $m) && $method === 'PUT') {
        require_admin();
        $allowedKeys = [
            'about_description', 'about_hero_image', 'about_facts',
            'about_team', 'about_timeline', 'about_mission', 'about_vision',
            'about_differentiators', 'about_brochure',
            'legal_privacy', 'legal_terms',
            'tokko_extra_development_ids', 'tokko_are_real_estate_development_ids',
            // Home page
            'home_hero_badge', 'home_hero_title', 'home_hero_subtitle',
            'home_hero_image', 'home_hero_cta_primary', 'home_hero_cta_secondary',
            'home_hero_whatsapp',
            'home_stats', 'home_features',
            'home_why_eyebrow', 'home_why_title', 'home_why_desc',
            'home_featured_title', 'home_featured_desc', 'home_featured_image',
            'home_cta_title', 'home_cta_desc', 'home_cta_button',
        ];
        $key = $m[1];
        if (!in_array($key, $allowedKeys, true)) {
            respond(400, ['success' => false, 'message' => 'Clave no permitida']);
        }
        $input = json_input();
        $value = $input['value'] ?? '';
        db()->exec("CREATE TABLE IF NOT EXISTS site_content (
            `key` VARCHAR(100) NOT NULL PRIMARY KEY,
            `value` LONGTEXT,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $stmt = db()->prepare("INSERT INTO site_content (`key`, `value`) VALUES (:key, :val) ON DUPLICATE KEY UPDATE `value` = :val2, updated_at = NOW()");
        $stmt->execute([':key' => $key, ':val' => $value, ':val2' => $value]);
        respond(200, ['success' => true, 'data' => ['key' => $key]]);
    }

    not_found();

} catch (Throwable $e) {
    log_error($e);
    respond(500, ['success' => false, 'message' => 'Error interno del servidor', 'debug' => (app_config()['app']['debug'] ?? false) ? $e->getMessage() : null]);
}
