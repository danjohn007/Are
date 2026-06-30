<?php

declare(strict_types=1);

function send_lead_email(string $name, ?string $email, ?string $serviceName, ?string $phone = null, ?string $message_text = null): void
{
    $to = app_config()['app']['mail_to'] ?? '';
    if (!$to) {
        return;
    }

    $subject = '=?UTF-8?B?' . base64_encode('📬 Nuevo Lead — ARE Inmobiliaria') . '?=';

    $html = '
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nuevo Lead</title></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#e67e22;padding:24px 28px">
      <h2 style="margin:0;color:#fff;font-size:20px">📬 Nuevo Lead Recibido</h2>
      <p style="margin:4px 0 0;color:#ffe;font-size:13px">ARE Inmobiliaria — Panel CRM</p>
    </div>
    <div style="padding:28px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#666;width:130px">Nombre</td><td style="padding:8px 0;font-weight:bold">' . htmlspecialchars($name) . '</td></tr>
        <tr><td style="padding:8px 0;color:#666">Correo</td><td style="padding:8px 0">' . htmlspecialchars($email ?? '—') . '</td></tr>
        <tr><td style="padding:8px 0;color:#666">Teléfono</td><td style="padding:8px 0">' . htmlspecialchars($phone ?? '—') . '</td></tr>
        <tr><td style="padding:8px 0;color:#666">Servicio</td><td style="padding:8px 0">' . htmlspecialchars($serviceName ?? '—') . '</td></tr>
        ' . ($message_text ? '<tr><td style="padding:8px 0;color:#666;vertical-align:top">Mensaje</td><td style="padding:8px 0">' . nl2br(htmlspecialchars($message_text)) . '</td></tr>' : '') . '
        <tr><td style="padding:8px 0;color:#666">Fecha</td><td style="padding:8px 0">' . date('d/m/Y H:i') . '</td></tr>
      </table>
      <div style="margin-top:24px;text-align:center">
        <a href="https://idactivos.digital/are/#/admin" style="background:#e67e22;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">Ver en Panel Admin</a>
      </div>
    </div>
  </div>
</body>
</html>';

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: ARE Inmobiliaria <noreply@idactivos.digital>\r\n";
    $headers .= "Reply-To: {$email}\r\n";

    @mail($to, $subject, $html, $headers);
}

function send_whatsapp(?string $to, string $message): void
{
    if (!$to) {
        return;
    }

    $cfg = app_config()['app'];
    if (!$cfg['twilio_sid'] || !$cfg['twilio_token'] || !$cfg['twilio_from']) {
        return;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => 'https://api.twilio.com/2010-04-01/Accounts/' . $cfg['twilio_sid'] . '/Messages.json',
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => $cfg['twilio_sid'] . ':' . $cfg['twilio_token'],
        CURLOPT_POSTFIELDS => http_build_query([
            'From' => $cfg['twilio_from'],
            'To' => str_starts_with($to, 'whatsapp:') ? $to : 'whatsapp:' . $to,
            'Body' => $message,
        ]),
    ]);
    curl_exec($ch);
    curl_close($ch);
}

function generate_basic_pdf(string $title, array $lines): string
{
    $text = $title . "\n" . implode("\n", $lines);
    $safe = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
    $stream = "BT /F1 12 Tf 50 760 Td ({$safe}) Tj ET";

    $objects = [];
    $objects[] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";
    $objects[] = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj";
    $objects[] = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj";
    $objects[] = "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj";
    $objects[] = "5 0 obj << /Length " . strlen($stream) . " >> stream\n{$stream}\nendstream endobj";

    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $obj) {
        $offsets[] = strlen($pdf);
        $pdf .= $obj . "\n";
    }

    $xrefPos = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }
    $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xrefPos}\n%%EOF";

    return $pdf;
}

function ensure_property_columns(): void
{
    static $ensured = false;
    if ($ensured) {
        return;
    }

    // Evita consultar information_schema y reintentar ALTER INDEX en cada visita pública.
    // La primera visita después del deploy valida/crea columnas; luego se revalida una vez al día.
    $stampFile = dirname(__DIR__) . '/logs/property_schema_v4.stamp';
    if (is_file($stampFile) && (time() - (int)@filemtime($stampFile)) < 86400) {
        $ensured = true;
        return;
    }

    $pdo = db();
    $databaseName = (string)$pdo->query('SELECT DATABASE()')->fetchColumn();
    if ($databaseName === '') {
        return;
    }

    $stmt = $pdo->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table');
    $stmt->execute([
        ':schema' => $databaseName,
        ':table' => 'properties',
    ]);

    $existing = array_fill_keys(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []), true);
    $alterations = [];

    $columns = [
        'property_type' => 'ADD COLUMN property_type VARCHAR(120) NULL AFTER listing_kind',
        'reference_code' => 'ADD COLUMN reference_code VARCHAR(80) NULL AFTER property_type',
        'location_full' => 'ADD COLUMN location_full VARCHAR(255) NULL AFTER reference_code',
        'parent_tokko_id' => 'ADD COLUMN parent_tokko_id VARCHAR(80) NULL AFTER location_full',
        'branch_name'    => 'ADD COLUMN branch_name VARCHAR(120) NULL AFTER parent_tokko_id',
        'photos_json' => 'ADD COLUMN photos_json LONGTEXT NULL AFTER image_url',
        'tags_json' => 'ADD COLUMN tags_json LONGTEXT NULL AFTER photos_json',
        'videos_json' => 'ADD COLUMN videos_json LONGTEXT NULL AFTER tags_json',
        'files_json' => 'ADD COLUMN files_json LONGTEXT NULL AFTER videos_json',
        'details_json' => 'ADD COLUMN details_json LONGTEXT NULL AFTER files_json',
    ];

    foreach ($columns as $column => $definition) {
        if (!isset($existing[$column])) {
            $alterations[] = $definition;
        }
    }

    if ($alterations) {
        $pdo->exec('ALTER TABLE properties ' . implode(', ', $alterations));
    }

    // Ensure listing_kind ENUM includes 'unit' (added later in the codebase)
    try {
        $enumRow = $pdo->query(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'listing_kind'"
        )->fetchColumn();
        if ($enumRow !== false && strpos((string)$enumRow, "'unit'") === false) {
            $pdo->exec("ALTER TABLE properties MODIFY COLUMN listing_kind ENUM('property','development','unit') NOT NULL DEFAULT 'property'");
        }
    } catch (\Throwable) {
        // Non-fatal — ignore
    }

    // Indexes used by the public property/development lists.
    // Checked before ALTER to avoid duplicate-index errors on every request.
    try {
        $idxStmt = $pdo->prepare(
            "SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
             AND INDEX_NAME IN ('idx_listing_kind','idx_branch_name','idx_listing_kind_created','idx_parent_tokko_id')"
        );
        $idxStmt->execute();
        $existingIndexes = array_fill_keys(array_map('strval', $idxStmt->fetchAll(PDO::FETCH_COLUMN) ?: []), true);

        if (!isset($existingIndexes['idx_listing_kind'])) {
            $pdo->exec('ALTER TABLE properties ADD INDEX idx_listing_kind (listing_kind)');
        }
        if (!isset($existingIndexes['idx_branch_name'])) {
            $pdo->exec('ALTER TABLE properties ADD INDEX idx_branch_name (branch_name)');
        }
        if (!isset($existingIndexes['idx_listing_kind_created'])) {
            $pdo->exec('ALTER TABLE properties ADD INDEX idx_listing_kind_created (listing_kind, created_at)');
        }
        if (!isset($existingIndexes['idx_parent_tokko_id'])) {
            $pdo->exec('ALTER TABLE properties ADD INDEX idx_parent_tokko_id (parent_tokko_id)');
        }
    } catch (\Throwable) {
        // Non-fatal — ignore
    }

    $logDir = dirname(__DIR__) . '/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0775, true);
    }
    @file_put_contents($stampFile, 'ok|' . time(), LOCK_EX);

    $ensured = true;
}

/**
 * Envía un contacto/lead directamente a Tokko Broker via su API.
 * Falla silenciosamente para no bloquear el guardado local del lead.
 *
 * @param string      $name        Nombre completo del contacto
 * @param string      $email       Correo electrónico
 * @param string      $phone       Teléfono
 * @param string|null $message     Mensaje del contacto
 * @param int|null    $property_id ID de propiedad Tokko (opcional)
 * @return bool  true si Tokko respondió 2xx, false en cualquier otro caso
 */
function tokko_send_contact(
    string $name,
    string $email,
    string $phone,
    ?string $message = null,
    ?int $remote_id = null,
    string $listing_kind = 'property'
): bool {
    $cfg = app_config()['tokko'];
    if (empty($cfg['api_key'])) {
        return false;
    }

    $baseUrl = 'https://www.tokkobroker.com/api/v1/webcontact/';
    $url     = $baseUrl . '?key=' . urlencode($cfg['api_key']);

    // Tokko usa 'text' para el mensaje y 'properties' (array) para vincular propiedad
    $text = $message ?? '';
    $forcePending = (bool)($cfg['force_pending'] ?? false);
    if ($forcePending && $remote_id !== null) {
        $text = trim($text . "\n\nReferencia {$listing_kind} Tokko ID: {$remote_id}");
    }

    $payload = [
        'name'      => $name,
        'email'     => $email,
        'phone'     => $phone,
        'cellphone' => $phone,
        'text'      => $text,
        'tags'      => ['ARE Inmobiliaria', 'web-contacto'],
    ];

    if (!$forcePending && $remote_id !== null) {
        if ($listing_kind === 'development') {
            $payload['developments'] = [$remote_id];
        } else {
            $payload['properties'] = [$remote_id];
        }
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        error_log('[tokko_send_contact] cURL error: ' . $curlErr);
        return false;
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        error_log('[tokko_send_contact] HTTP ' . $httpCode . ' — ' . $response);
        return false;
    }

    return true;
}


function tokko_parse_development_ids(mixed $value): array
{
    if ($value === null || $value === false) {
        return [];
    }

    if (is_array($value)) {
        $rawParts = $value;
    } else {
        $value = trim((string)$value);
        if ($value === '') {
            return [];
        }

        // Acepta: "41099,53159", "https://www.tokkobroker.com/development/41099"
        // y también JSON ["41099","53159"].
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $rawParts = $decoded;
        } else {
            preg_match_all('/(?:development\/)?(\d{3,})/i', $value, $matches);
            $rawParts = $matches[1] ?? preg_split('/[\s,;|]+/', $value);
        }
    }

    $ids = [];
    foreach ($rawParts as $part) {
        if (is_array($part)) {
            foreach (tokko_parse_development_ids($part) as $nested) {
                $ids[] = $nested;
            }
            continue;
        }

        $part = trim((string)$part);
        if ($part === '') {
            continue;
        }

        if (preg_match('/(\d{3,})/', $part, $m)) {
            $ids[] = $m[1];
        }
    }

    $ids = array_values(array_unique(array_filter($ids, static fn ($id) => ctype_digit((string)$id))));
    sort($ids, SORT_NUMERIC);
    return $ids;
}

function tokko_site_content_value(string $key): ?string
{
    try {
        $pdo = db();
        $tableExists = $pdo->query("SHOW TABLES LIKE 'site_content'")->fetchColumn();
        if (!$tableExists) {
            return null;
        }

        $stmt = $pdo->prepare("SELECT `value` FROM site_content WHERE `key` = :key LIMIT 1");
        $stmt->execute([':key' => $key]);
        $value = $stmt->fetchColumn();

        return is_string($value) ? $value : null;
    } catch (\Throwable) {
        return null;
    }
}

function tokko_are_real_estate_development_ids(): array
{
    // Solución mantenible:
    // 1) La sincronización toma automáticamente todo lo que Tokko devuelve por /development/
    //    y todo desarrollo padre encontrado en /property/.
    // 2) Si Tokko NO lista algún desarrollo aunque exista al abrirlo por ID, NO se puede
    //    descubrir automáticamente sin que Tokko lo exponga en algún endpoint.
    // 3) Para esos casos excepcionales no se toca código: se puede guardar una lista en
    //    site_content.tokko_extra_development_ids o en app_config()['tokko']['extra_development_ids'].
    //    Ejemplo en BD: key=tokko_extra_development_ids, value=41099,53159
    $cfg = app_config()['tokko'] ?? [];
    $ids = [];

    foreach ([
        $cfg['extra_development_ids'] ?? null,
        $cfg['are_real_estate_development_ids'] ?? null,
        $cfg['forced_development_ids'] ?? null,
        tokko_site_content_value('tokko_extra_development_ids'),
        tokko_site_content_value('tokko_are_real_estate_development_ids'),
    ] as $source) {
        $ids = array_merge($ids, tokko_parse_development_ids($source));
    }

    return array_values(array_unique($ids));
}

function tokko_real_estate_branch_ids(): array
{
    $cfg = app_config()['tokko'] ?? [];
    $ids = [];

    foreach ([
        $cfg['real_estate_branch_ids'] ?? null,
        $cfg['branch_ids'] ?? null,
        $cfg['branch_id'] ?? null,
        // ID observado en Tokko para ARE Real Estate. Si cambia, se puede sobrescribir
        // desde config.php con real_estate_branch_ids sin volver a modificar este archivo.
        '34646',
    ] as $source) {
        $ids = array_merge($ids, tokko_parse_development_ids($source));
    }

    return array_values(array_unique($ids));
}

function tokko_branch_name_is_real_estate(?string $branchName): bool
{
    $branchName = strtolower(trim((string)$branchName));

    if ($branchName === '') {
        return false;
    }

    if (str_contains($branchName, 'are homes') || str_contains($branchName, 'arehomes') || str_contains($branchName, 'are-homes')) {
        return false;
    }

    return str_contains($branchName, 'are real estate') || str_contains($branchName, 'are real state');
}

function tokko_local_development_ids_to_recheck(PDO $pdo): array
{
    try {
        ensure_property_columns();

        $stmt = $pdo->query("
            SELECT tokko_id
            FROM properties
            WHERE listing_kind = 'development'
              AND (
                LOWER(COALESCE(branch_name, '')) LIKE '%are real estate%'
                OR LOWER(COALESCE(branch_name, '')) LIKE '%are real state%'
              )
        ");

        $ids = [];
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $tokkoId) {
            if (preg_match('/development:(\d+)/', (string)$tokkoId, $m)) {
                $ids[] = $m[1];
            }
        }

        return array_values(array_unique($ids));
    } catch (\Throwable) {
        return [];
    }
}

function tokko_development_fetch_variant_params(): array
{
    $variants = [
        [],
        ['display_on_web' => '1'],
        ['display_on_web' => 'true'],
        ['include_deleted' => '1'],
        ['include_inactive' => '1'],
        ['with_deleted' => '1'],
        ['status' => 'all'],
        ['state' => 'all'],
    ];

    foreach (tokko_real_estate_branch_ids() as $branchId) {
        foreach (['branch', 'branch_id', 'branch__id', 'branch_ids', 'branch_filter'] as $key) {
            $variants[] = [$key => $branchId];
        }
    }

    // Eliminar duplicados conservando orden.
    $seen = [];
    $out = [];
    foreach ($variants as $variant) {
        ksort($variant);
        $key = json_encode($variant);
        if (!isset($seen[$key])) {
            $seen[$key] = true;
            $out[] = $variant;
        }
    }

    return $out;
}

function tokko_fetch_development_items(string $baseUrl, string $apiKey, array $extraKnownIds = []): array
{
    $byId = [];
    $variantStats = [];

    foreach (tokko_development_fetch_variant_params() as $params) {
        $items = tokko_fetch_items($baseUrl, $apiKey, $params);
        $variantStats[] = [
            'params' => $params,
            'loaded' => is_array($items) ? count($items) : 0,
            'ok' => is_array($items),
        ];

        foreach (($items ?? []) as $item) {
            if (!is_array($item) || empty($item['id'])) {
                continue;
            }

            $id = (string)$item['id'];
            if (!isset($byId[$id])) {
                $byId[$id] = $item;
            } else {
                $byId[$id] = tokko_merge_tokko_item($byId[$id], $item);
            }
        }
    }

    foreach (array_values(array_unique($extraKnownIds)) as $id) {
        $id = trim((string)$id);
        if ($id === '' || !ctype_digit($id)) {
            continue;
        }

        $detail = tokko_fetch_item_detail($baseUrl, $apiKey, $id);
        if (is_array($detail) && !empty($detail)) {
            if (!isset($byId[$id])) {
                $byId[$id] = $detail;
            } else {
                $byId[$id] = tokko_merge_tokko_item($byId[$id], $detail);
            }
        }
    }

    // Deja estadísticas disponibles para diagnóstico sin cambiar la firma del retorno.
    $GLOBALS['TOKKO_DEVELOPMENT_FETCH_VARIANT_STATS'] = $variantStats;

    return array_values($byId);
}

function tokko_sync(): array
{
    // La sincronización puede tardar en hosting compartido; no hacemos traducciones automáticas.
    @set_time_limit(0);
    @ini_set('max_execution_time', '0');

    $cfg = app_config()['tokko'];
    if (!$cfg['api_key'] || empty($cfg['url'])) {
        return ['synced' => 0, 'skipped' => true];
    }

    $pdo = db();
    ensure_property_columns();

    $sql = "
        INSERT INTO properties (
            tokko_id, title, description, price, address, city, bedrooms, bathrooms, area, image_url,
            photos_json, tags_json, videos_json, files_json, details_json,
            operation_type, listing_kind, property_type, reference_code, location_full, parent_tokko_id, branch_name
        )
        VALUES (
            :tokko_id, :title, :description, :price, :address, :city, :bedrooms, :bathrooms, :area, :image_url,
            :photos_json, :tags_json, :videos_json, :files_json, :details_json,
            :operation_type, :listing_kind, :property_type, :reference_code, :location_full, :parent_tokko_id, :branch_name
        )
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            description = CASE
                WHEN VALUES(description) IS NULL OR TRIM(VALUES(description)) = '' THEN description
                WHEN description IS NULL OR TRIM(description) = '' THEN VALUES(description)
                WHEN CHAR_LENGTH(VALUES(description)) > CHAR_LENGTH(description) THEN VALUES(description)
                WHEN CHAR_LENGTH(description) < 220 AND CHAR_LENGTH(VALUES(description)) >= CHAR_LENGTH(description) THEN VALUES(description)
                ELSE description
            END,
            price = VALUES(price),
            address = VALUES(address),
            city = VALUES(city),
            bedrooms = VALUES(bedrooms),
            bathrooms = VALUES(bathrooms),
            area = VALUES(area),
            image_url = VALUES(image_url),
            photos_json = VALUES(photos_json),
            tags_json = VALUES(tags_json),
            videos_json = VALUES(videos_json),
            files_json = VALUES(files_json),
            details_json = VALUES(details_json),
            operation_type = VALUES(operation_type),
            listing_kind = VALUES(listing_kind),
            property_type = VALUES(property_type),
            reference_code = VALUES(reference_code),
            location_full = VALUES(location_full),
            parent_tokko_id = VALUES(parent_tokko_id),
            branch_name = VALUES(branch_name),
            updated_at = NOW()
    ";

    $stmt = $pdo->prepare($sql);
    $synced = 0;
    $errors = [];
    $seenPropertyIds = [];
    $devEndpointFetched = false;
    $devEndpointLoadedCount = 0;

    // ── STEP 1: Fetch all property items ─────────────────────────────────────
    // Property endpoint returns standalone properties AND units belonging to a
    // development (those have item['development']['id']).
    // Units → collected into $devMap (one row per dev, tags merged across all units)
    // Standalone → inserted directly as regular properties
    $propUrl   = $cfg['url'] ?? '';
    $devUrl    = $cfg['development_url'] ?? '';
    $propItems = $propUrl ? tokko_fetch_items($propUrl, $cfg['api_key']) : null;

    if ($propItems === null && $propUrl) {
        $errors[] = 'Unable to fetch property endpoint: ' . $propUrl;
        $propItems = [];
    }

    $devMap  = []; // devId => ['item', 'source', 'tags', 'unit_count']
    $unitRows = []; // rows to insert as listing_kind='unit'
    $seenStandaloneDevelopmentTokkoIds = []; // properties tagged as development but served by /property/

    foreach (($propItems ?? []) as $item) {
        $rawId = (string)($item['id'] ?? '');
        if ($rawId === '') {
            continue;
        }

        // ── Unit belonging to a development ──
        if (!empty($item['development']['id']) && is_array($item['development'])) {
            $devId = (string)$item['development']['id'];
            if (!isset($devMap[$devId])) {
                $devMap[$devId] = ['item' => $item, 'source' => $item['development'], 'tags' => [], 'unit_count' => 0];
            }
            $devMap[$devId]['unit_count']++;
            $devMap[$devId]['tags'] = array_values(array_unique(array_merge(
                $devMap[$devId]['tags'],
                tokko_extract_tags($item),
                tokko_extract_tags($item['development'])
            )));

            // Also store the unit as its own row so it can be listed under the development.
            // The list endpoint can omit the full ES description, so we enrich each unit with its detail endpoint.
            $unitSource = tokko_merge_tokko_item($item, tokko_fetch_item_detail($propUrl, $cfg['api_key'], $rawId));
            $uPhotos = tokko_extract_photos($unitSource);
            if (empty($uPhotos)) {
                $uPhotos = tokko_extract_photos($item);
            }
            $uPublicData = tokko_public_ficha_data_for_item($item, $unitSource);
            $uDescription = tokko_best_description(
                tokko_extract_description($item, $unitSource),
                (string)($uPublicData['description'] ?? '')
            );
            $uDetails = tokko_apply_public_ficha_data(tokko_extract_details($item, $unitSource, false), $uPublicData);
            $uTags = tokko_flatten_tag_groups($uDetails['tag_groups'] ?? []);
            if (empty($uTags)) {
                $uTags = tokko_extract_tags($unitSource);
            }
            $unitRows[] = [
                ':tokko_id'        => 'property:' . $rawId,
                ':title'           => $unitSource['publication_title'] ?? $unitSource['title'] ?? $unitSource['name'] ?? $item['publication_title'] ?? 'Unidad',
                ':description'     => $uDescription,
                ':price'           => tokko_extract_price($unitSource),
                ':address'         => tokko_extract_address($item, $unitSource),
                ':city'            => tokko_extract_city($item, $unitSource),
                ':bedrooms'        => (int)($unitSource['room_amount'] ?? $unitSource['suite_amount'] ?? $item['room_amount'] ?? 0),
                ':bathrooms'       => (int)($unitSource['bathroom_amount'] ?? $item['bathroom_amount'] ?? 0),
                ':area'            => (float)($unitSource['surface'] ?? $unitSource['roofed_surface'] ?? $unitSource['total_surface'] ?? $item['surface'] ?? 0),
                ':image_url'       => $uPhotos[0]['image'] ?? $unitSource['photo'] ?? $item['photo'] ?? '',
                ':photos_json'     => json_encode($uPhotos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':tags_json'       => json_encode($uTags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':videos_json'     => json_encode(array_values(is_array($unitSource['videos'] ?? null) ? $unitSource['videos'] : []), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':files_json'      => json_encode(array_values(is_array($unitSource['files'] ?? null) ? $unitSource['files'] : []), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':details_json'    => json_encode($uDetails, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':operation_type'  => tokko_extract_operation_type($unitSource),
                ':listing_kind'    => 'unit',
                ':property_type'   => tokko_translate_property_type($unitSource['type']['name'] ?? $item['type']['name'] ?? ''),
                ':reference_code'  => $unitSource['reference_code'] ?? $item['reference_code'] ?? null,
                ':location_full'   => tokko_extract_location_full($item, $unitSource),
                ':parent_tokko_id' => 'development:' . $devId,
                ':branch_name'     => tokko_extract_branch_name($unitSource, $item),
            ];

            continue; // don't insert this unit as a standalone property
        }

        // ── Standalone property ──
        // The property list endpoint can omit or shorten the ES description.
        // Enrich with /property/{id}/ so we can store the full Tokko description.
        $source      = tokko_merge_tokko_item($item, tokko_fetch_item_detail($propUrl, $cfg['api_key'], $rawId));
        $photos      = tokko_extract_photos($source);
        if (empty($photos)) {
            $photos = tokko_extract_photos($item);
        }
        $videos      = array_values(is_array($source['videos'] ?? null) ? $source['videos'] : []);
        $files       = array_values(is_array($source['files'] ?? null) ? $source['files'] : []);
        $publicData  = tokko_public_ficha_data_for_item($item, $source);
        $description = tokko_best_description(
            tokko_extract_description($item, $source),
            (string)($publicData['description'] ?? '')
        );
        $details     = tokko_apply_public_ficha_data(tokko_extract_details($item, $source, false), $publicData);
        $tags        = tokko_flatten_tag_groups($details['tag_groups'] ?? []);
        if (empty($tags)) {
            $tags = tokko_extract_tags($source);
        }

        $listingKind = tokko_is_development($source) ? 'development' : 'property';
        $tokkoId     = 'property:' . $rawId;

        $stmt->execute([
            ':tokko_id'       => $tokkoId,
            ':title'          => $source['publication_title'] ?? $source['title'] ?? $source['name'] ?? 'Property',
            ':description'    => $description,
            ':price'          => tokko_extract_price($source),
            ':address'        => tokko_extract_address($item, $source),
            ':city'           => tokko_extract_city($item, $source),
            ':bedrooms'       => (int)($source['room_amount'] ?? $source['suite_amount'] ?? $item['room_amount'] ?? 0),
            ':bathrooms'      => (int)($source['bathroom_amount'] ?? $item['bathroom_amount'] ?? 0),
            ':area'           => (float)($source['surface'] ?? $source['roofed_surface'] ?? $source['total_surface'] ?? $item['surface'] ?? 0),
            ':image_url'      => $photos[0]['image'] ?? $source['photo'] ?? $item['photo'] ?? '',
            ':photos_json'    => json_encode($photos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':tags_json'      => json_encode($tags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':videos_json'    => json_encode($videos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':files_json'     => json_encode($files, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':details_json'   => json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':operation_type' => tokko_extract_operation_type($item),
            ':listing_kind'   => $listingKind,
            ':property_type'  => tokko_translate_property_type($source['type']['name'] ?? $item['type']['name'] ?? ''),
            ':reference_code' => $source['reference_code'] ?? $item['reference_code'] ?? null,
            ':location_full'   => tokko_extract_location_full($item, $source),
            ':parent_tokko_id' => null,
            ':branch_name'    => tokko_extract_branch_name($source, $item),
        ]);
        if ($listingKind === 'development') {
            $seenStandaloneDevelopmentTokkoIds[] = $tokkoId;
        } else {
            $seenPropertyIds[] = $tokkoId;
        }
        $synced++;
    }

    // ── STEP 2: Enrich devMap with the development endpoint ───────────────────
    // /api/v1/development/ has richer metadata (photos, description, tags) but
    // no unit counts. Use it to enrich entries already found via the property
    // endpoint, and also add any dev that ONLY exists in this endpoint.
    if ($devUrl) {
        $knownDevelopmentIds = array_values(array_unique(array_merge(
            function_exists('tokko_are_real_estate_development_ids') ? tokko_are_real_estate_development_ids() : [],
            function_exists('tokko_local_development_ids_to_recheck') ? tokko_local_development_ids_to_recheck($pdo) : []
        )));
        $devItems = function_exists('tokko_fetch_development_items')
            ? tokko_fetch_development_items($devUrl, $cfg['api_key'], $knownDevelopmentIds)
            : tokko_fetch_items($devUrl, $cfg['api_key']);
        if ($devItems !== null) {
            $devEndpointFetched = true;
            $devEndpointLoadedCount = count($devItems);
            foreach ($devItems as $item) {
                $devId = (string)($item['id'] ?? '');
                if ($devId === '') {
                    continue;
                }
                if (!isset($devMap[$devId])) {
                    $devMap[$devId] = ['item' => $item, 'source' => $item, 'tags' => [], 'unit_count' => 0];
                } else {
                    // Overwrite source with richer development-endpoint data
                    $devMap[$devId]['source'] = $item;
                    $devMap[$devId]['item']   = $item;
                }
                $devMap[$devId]['tags'] = array_values(array_unique(array_merge(
                    $devMap[$devId]['tags'],
                    tokko_extract_tags($item)
                )));
            }
        } else {
            $errors[] = 'Unable to fetch development endpoint (non-fatal): ' . $devUrl;
        }
    }

    // ── STEP 3: Upsert developments (preserves existing DB ids) ─────────────
    // Using ON DUPLICATE KEY UPDATE (keyed on tokko_id) so the auto-increment
    // id never changes — prevents 404s caused by stale links in the browser.
    $seenDevTokkoIds  = [];
    $seenUnitTokkoIds = [];

    foreach ($devMap as $devId => $devData) {
        $item      = $devData['item'];
        $source    = $devData['source'];
        $tags      = $devData['tags'];
        $unitCount = $devData['unit_count'];

        // Enrich developments too; the development list endpoint can be lighter than the detail endpoint.
        if ($devUrl) {
            $source = tokko_merge_tokko_item($source, tokko_fetch_item_detail($devUrl, $cfg['api_key'], $devId));
        }

        $photos = tokko_extract_photos($source);
        if (empty($photos)) {
            $photos = tokko_extract_photos($item);
        }
        $videos      = array_values(is_array($source['videos'] ?? null) ? $source['videos'] : []);
        $files       = array_values(is_array($source['files'] ?? null) ? $source['files'] : []);
        $publicData  = tokko_public_ficha_data_for_item($item, $source);
        $description = tokko_best_description(
            tokko_extract_description($item, $source),
            (string)($publicData['description'] ?? '')
        );

        $details = tokko_apply_public_ficha_data(tokko_extract_details($item, $source, true), $publicData);
        $publicTags = tokko_flatten_tag_groups($details['tag_groups'] ?? []);
        if (!empty($publicTags)) {
            $tags = $publicTags;
        }
        if ($unitCount > 0 && empty($details['unit_amount'])) {
            $details['unit_amount'] = $unitCount;
        }
        if ($unitCount > 0) {
            $details['unit_count_synced'] = $unitCount;
        }

        $devTokkoId = 'development:' . $devId;
        $stmt->execute([
            ':tokko_id'       => $devTokkoId,
            ':title'          => $source['publication_title'] ?? $source['title'] ?? $source['name'] ?? $item['publication_title'] ?? 'Desarrollo',
            ':description'    => $description,
            ':price'          => tokko_extract_price($source),
            ':address'        => tokko_extract_address($item, $source),
            ':city'           => tokko_extract_city($item, $source),
            ':bedrooms'       => (int)($source['room_amount'] ?? $item['room_amount'] ?? 0),
            ':bathrooms'      => (int)($source['bathroom_amount'] ?? $item['bathroom_amount'] ?? 0),
            ':area'           => (float)($source['surface'] ?? $source['roofed_surface'] ?? $source['total_surface'] ?? $item['surface'] ?? 0),
            ':image_url'      => $photos[0]['image'] ?? $source['photo'] ?? $item['photo'] ?? '',
            ':photos_json'    => json_encode($photos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':tags_json'      => json_encode($tags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':videos_json'    => json_encode($videos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':files_json'     => json_encode($files, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':details_json'   => json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':operation_type' => tokko_extract_operation_type($source),
            ':listing_kind'   => 'development',
            ':property_type'  => tokko_translate_property_type($source['type']['name'] ?? $item['type']['name'] ?? ''),
            ':reference_code' => $source['reference_code'] ?? $item['reference_code'] ?? null,
            ':location_full'  => tokko_extract_location_full($item, $source),
            ':parent_tokko_id' => null,
            ':branch_name'    => tokko_extract_branch_name($source, $item),
        ]);
        $seenDevTokkoIds[] = $devTokkoId;
        $synced++;
    }

    // Upsert units
    foreach ($unitRows as $row) {
        try {
            $stmt->execute($row);
            $seenUnitTokkoIds[] = $row[':tokko_id'];
        } catch (\Throwable $e) {
            $errors[] = 'Unit insert failed (' . ($row[':tokko_id'] ?? '?') . '): ' . $e->getMessage();
        }
    }

    // Remove developments/units deleted from Tokko (preserving DB ids for survivors)
    if ($devEndpointFetched || !empty($devMap) || !empty($seenStandaloneDevelopmentTokkoIds)) {
        $allSeenDevelopmentTokkoIds = array_values(array_unique(array_merge(
            $seenDevTokkoIds,
            $seenStandaloneDevelopmentTokkoIds
        )));

        if (!empty($allSeenDevelopmentTokkoIds)) {
            $ph = implode(',', array_fill(0, count($allSeenDevelopmentTokkoIds), '?'));
            // No borramos automáticamente desarrollos ARE Real Estate que no aparezcan
            // en el listado de Tokko en esta corrida, porque Tokko puede omitir algunos
            // desarrollos del endpoint general aunque sigan existiendo por ID.
            $pdo->prepare("
                DELETE FROM properties
                WHERE listing_kind = 'development'
                  AND tokko_id NOT IN ($ph)
                  AND LOWER(COALESCE(branch_name, '')) NOT LIKE '%are real estate%'
                  AND LOWER(COALESCE(branch_name, '')) NOT LIKE '%are real state%'
            ")->execute($allSeenDevelopmentTokkoIds);
        } else {
            $pdo->exec("
                DELETE FROM properties
                WHERE listing_kind = 'development'
                  AND LOWER(COALESCE(branch_name, '')) NOT LIKE '%are real estate%'
                  AND LOWER(COALESCE(branch_name, '')) NOT LIKE '%are real state%'
            ");
        }
        if (!empty($seenUnitTokkoIds)) {
            $ph = implode(',', array_fill(0, count($seenUnitTokkoIds), '?'));
            $pdo->prepare("DELETE FROM properties WHERE listing_kind = 'unit' AND tokko_id NOT IN ($ph)")
                ->execute($seenUnitTokkoIds);
        } else {
            $pdo->exec("DELETE FROM properties WHERE listing_kind = 'unit'");
        }
    }

    // ── STEP 4: Remove standalone properties deleted from Tokko ──────────────
    if ($propItems !== null) {
        if (!empty($seenPropertyIds)) {
            $placeholders = implode(',', array_fill(0, count($seenPropertyIds), '?'));
            $pdo->prepare(
                "DELETE FROM properties WHERE listing_kind = 'property' AND tokko_id NOT IN ($placeholders)"
            )->execute($seenPropertyIds);
        } else {
            // All standalone properties were removed from Tokko
            $pdo->exec("DELETE FROM properties WHERE listing_kind = 'property'");
        }
    }

    $result = [
        'synced' => $synced,
        'skipped' => false,
        'developments_detected_total' => count($devMap),
        'developments_from_development_endpoint' => $devEndpointLoadedCount,
        'developments_saved' => count($seenDevTokkoIds),
        'units_saved' => count($seenUnitTokkoIds),
        'configured_extra_development_ids' => function_exists('tokko_are_real_estate_development_ids') ? tokko_are_real_estate_development_ids() : [],
        'development_fetch_variants' => $GLOBALS['TOKKO_DEVELOPMENT_FETCH_VARIANT_STATS'] ?? [],
    ];
    if ($errors) {
        $result['errors'] = $errors;
    }

    return $result;
}

function tokko_fetch_items(string $baseUrl, string $apiKey, array $extraParams = []): ?array
{
    $items = [];
    $offset = 0;
    $limit = 100;
    $safety = 0;

    while ($safety < 30) {
        $safety++;
        $separator = str_contains($baseUrl, '?') ? '&' : '?';
        $url = $baseUrl . $separator . http_build_query(tokko_default_api_params($apiKey, array_merge($extraParams, [
            'limit' => $limit,
            'offset' => $offset,
        ])));

        $json = function_exists('tokko_http_get') ? tokko_http_get($url, 25) : @file_get_contents($url);
        if (!is_string($json) || $json === '') {
            return $offset === 0 ? null : $items;
        }

        $payload = json_decode($json, true);
        if (!is_array($payload)) {
            return $offset === 0 ? null : $items;
        }

        $pageItems = $payload['objects'] ?? $payload['results'] ?? $payload['data'] ?? [];
        if (!is_array($pageItems)) {
            return $offset === 0 ? null : $items;
        }

        foreach ($pageItems as $pageItem) {
            if (is_array($pageItem)) {
                $items[] = $pageItem;
            }
        }

        $meta = is_array($payload['meta'] ?? null) ? $payload['meta'] : [];
        $next = $meta['next'] ?? null;
        $totalCount = null;
        foreach ([$meta['total_count'] ?? null, $meta['total'] ?? null, $payload['total_count'] ?? null, $payload['total'] ?? null] as $candidate) {
            if ($candidate !== null && is_numeric($candidate)) {
                $totalCount = (int)$candidate;
                break;
            }
        }

        if (count($pageItems) === 0) {
            break;
        }

        $offset += count($pageItems);

        if ($totalCount !== null && $offset >= $totalCount) {
            break;
        }

        // Si Tokko no manda meta.next pero regresó una página llena, intentamos
        // la siguiente página de todos modos. Esto evita perder desarrollos cuando
        // el API omite el enlace next pero sí tiene más resultados por offset.
        if (!$next && count($pageItems) < $limit) {
            break;
        }
    }

    return $items;
}


function tokko_fetch_item_detail(string $baseUrl, string $apiKey, string|int $id): ?array
{
    static $cache = [];

    $id = trim((string)$id);
    if ($id === '') {
        return null;
    }

    $baseWithoutQuery = strtok($baseUrl, '?') ?: $baseUrl;
    $baseWithoutQuery = rtrim($baseWithoutQuery, '/') . '/';
    $cacheKey = $baseWithoutQuery . $id;

    if (array_key_exists($cacheKey, $cache)) {
        return $cache[$cacheKey];
    }

    $url = $baseWithoutQuery . rawurlencode($id) . '/?' . http_build_query(tokko_default_api_params($apiKey));
    $json = tokko_http_get($url, 12);
    if (!is_string($json) || $json === '') {
        $cache[$cacheKey] = null;
        return null;
    }

    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        $cache[$cacheKey] = null;
        return null;
    }

    $detail = $payload['object'] ?? $payload['result'] ?? $payload;
    $cache[$cacheKey] = is_array($detail) ? $detail : null;
    return $cache[$cacheKey];
}

function tokko_merge_tokko_item(array $base, ?array $detail): array
{
    if (!$detail) {
        return $base;
    }

    // array_replace_recursive keeps the list data and overlays the richer detail endpoint.
    return array_replace_recursive($base, $detail);
}


function tokko_normalize_identity_text(mixed $value): string
{
    $text = strtolower(trim((string)$value));
    $text = str_replace(['-', '_'], ' ', $text);
    $text = preg_replace('/\s+/', ' ', $text) ?: $text;
    return $text;
}

function tokko_collect_identity_strings(mixed $value, array &$out, int $depth = 0): void
{
    if ($depth > 5 || count($out) > 80) {
        return;
    }

    if (is_string($value) || is_numeric($value)) {
        $text = trim((string)$value);
        if ($text !== '' && mb_strlen($text, 'UTF-8') <= 180) {
            $out[] = $text;
        }
        return;
    }

    if (!is_array($value)) {
        return;
    }

    foreach ($value as $key => $child) {
        $k = strtolower((string)$key);
        $interestingKey = in_array($k, [
            'branch', 'branches', 'company', 'companies', 'office', 'offices',
            'broker', 'real_estate', 'producer', 'agent', 'owner', 'publisher',
            'name', 'full_name', 'email', 'username', 'display_name'
        ], true);

        if ($interestingKey || $depth < 2) {
            tokko_collect_identity_strings($child, $out, $depth + 1);
        }
    }
}

function tokko_extract_branch_name(array ...$sources): ?string
{
    // La sucursal real del inventario debe salir del objeto branch del registro
    // que Tokko devuelve. No se debe decidir por título, tags, descripción ni por
    // cadenas internas mezcladas, porque eso combina ARE Homes con ARE Real Estate.
    $fallbacks = [];

    foreach ($sources as $source) {
        foreach ([['branch', 'display_name'], ['branch', 'name']] as $path) {
            $value = $source;
            foreach ($path as $part) {
                if (!is_array($value) || !array_key_exists($part, $value)) {
                    $value = null;
                    break;
                }
                $value = $value[$part];
            }
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        foreach ([['office', 'name'], ['company', 'name'], ['real_estate', 'name']] as $path) {
            $value = $source;
            foreach ($path as $part) {
                if (!is_array($value) || !array_key_exists($part, $value)) {
                    $value = null;
                    break;
                }
                $value = $value[$part];
            }
            if (is_string($value) && trim($value) !== '') {
                $fallbacks[] = trim($value);
            }
        }
    }

    $fallbacks = array_values(array_unique($fallbacks));
    return $fallbacks[0] ?? null;
}

function tokko_public_brand_info(array ...$sources): array
{
    $strings = [];
    foreach ($sources as $source) {
        tokko_collect_identity_strings($source, $strings);
    }

    $haystack = tokko_normalize_identity_text(implode(' ', array_unique($strings)));

    if (str_contains($haystack, 'are homes') || str_contains($haystack, 'arehomes')) {
        return ['key' => 'are_homes', 'name' => 'ARE Homes'];
    }

    if (str_contains($haystack, 'are real estate') || preg_match('/(^|\s)are($|\s)/', $haystack)) {
        return ['key' => 'are_real_estate', 'name' => 'ARE Real Estate'];
    }

    return ['key' => 'unknown', 'name' => null];
}


function tokko_default_api_params(string $apiKey, array $extra = []): array
{
    // Tokko puede devolver textos/tags en inglés si no se manda idioma.
    // Dejamos el idioma centralizado para que propiedades, desarrollos y unidades usen la misma fuente.
    return array_merge([
        'key' => $apiKey,
        'format' => 'json',
        'lang' => 'es_mx',
    ], $extra);
}

function tokko_add_unique_url(array &$urls, mixed $url): void
{
    if (!is_string($url)) {
        return;
    }

    $url = trim($url);
    if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
        return;
    }

    $urls[$url] = true;
}

function tokko_public_urls_for_item(array $item, array $source): array
{
    $urls = [];

    foreach ([$source, $item, $item['development'] ?? null] as $candidate) {
        if (!is_array($candidate)) {
            continue;
        }

        foreach (['public_url', 'web_url', 'url', 'property_url', 'ficha_url', 'share_url'] as $urlKey) {
            tokko_add_unique_url($urls, $candidate[$urlKey] ?? null);
        }

        // Algunos payloads traen ligas en archivos o recursos relacionados.
        foreach (['files', 'links', 'documents'] as $listKey) {
            if (!is_array($candidate[$listKey] ?? null)) {
                continue;
            }
            foreach ($candidate[$listKey] as $row) {
                if (is_string($row)) {
                    if (str_contains($row, 'ficha.info')) {
                        tokko_add_unique_url($urls, $row);
                    }
                    continue;
                }
                if (!is_array($row)) {
                    continue;
                }
                foreach (['url', 'href', 'file', 'link'] as $field) {
                    $value = $row[$field] ?? null;
                    if (is_string($value) && str_contains($value, 'ficha.info')) {
                        tokko_add_unique_url($urls, $value);
                    }
                }
            }
        }
    }

    return array_keys($urls);
}

function tokko_best_description(string ...$descriptions): string
{
    $best = '';
    foreach ($descriptions as $description) {
        $text = trim(tokko_html_to_text($description));
        if ($text === '' || !tokko_description_is_valid($text)) {
            continue;
        }

        if ($best === '') {
            $best = $text;
            continue;
        }

        $length = mb_strlen($text, 'UTF-8');
        $bestLength = mb_strlen($best, 'UTF-8');

        // Nunca sustituimos una descripción larga por una meta-descripción cortada.
        if ($length > $bestLength + 40) {
            $best = $text;
            continue;
        }

        // Si la actual parece cortada y la nueva no, preferimos la nueva aunque no sea mucho más larga.
        if (tokko_description_is_probably_cut($best) && !tokko_description_is_probably_cut($text) && $length >= $bestLength - 20) {
            $best = $text;
        }
    }

    return $best;
}

function tokko_public_ficha_data_for_item(array $item, array $source): array
{
    $result = [
        'description' => '',
        'services' => [],
        'spaces' => [],
        'features' => [],
        'public_url' => null,
    ];

    foreach (tokko_public_urls_for_item($item, $source) as $url) {
        $data = tokko_fetch_public_ficha_data($url);
        if (!empty($data['description'])) {
            $result['description'] = tokko_best_description($result['description'], (string)$data['description']);
        }
        foreach (['services', 'spaces', 'features'] as $group) {
            if (!empty($data[$group]) && is_array($data[$group])) {
                $result[$group] = tokko_normalize_tag_list(array_merge($result[$group], $data[$group]));
            }
        }
        if ($result['public_url'] === null && (
            $result['description'] !== ''
            || !empty($result['services'])
            || !empty($result['spaces'])
            || !empty($result['features'])
        )) {
            $result['public_url'] = $url;
        }
    }

    return $result;
}

function tokko_apply_public_ficha_data(array $details, array $publicData): array
{
    if (!empty($publicData['public_url'])) {
        $details['public_url'] = $publicData['public_url'];
        $details['public_ficha_url'] = $publicData['public_url'];
    }

    if (!empty($publicData['description'])) {
        $details['public_description'] = $publicData['description'];
    }

    $groups = is_array($details['tag_groups'] ?? null)
        ? $details['tag_groups']
        : ['services' => [], 'spaces' => [], 'features' => []];

    foreach (['services', 'spaces', 'features'] as $group) {
        if (!isset($groups[$group]) || !is_array($groups[$group])) {
            $groups[$group] = [];
        }

        if (!empty($publicData[$group]) && is_array($publicData[$group])) {
            // La ficha pública manda exactamente lo visible/publicado; tiene prioridad.
            $groups[$group] = tokko_normalize_tag_list($publicData[$group]);
            $details['public_' . $group] = $groups[$group];
        }
    }

    $details['tag_groups'] = $groups;
    return $details;
}

function tokko_flatten_tag_groups(array $groups): array
{
    $tags = [];
    foreach (['services', 'spaces', 'features'] as $group) {
        if (!empty($groups[$group]) && is_array($groups[$group])) {
            $tags = array_merge($tags, $groups[$group]);
        }
    }
    return tokko_normalize_tag_list($tags);
}


function tokko_remote_id_from_tokko_id(?string $tokkoId): ?string
{
    $tokkoId = trim((string)$tokkoId);
    if ($tokkoId === '') {
        return null;
    }
    $parts = explode(':', $tokkoId, 2);
    return $parts[1] ?? $parts[0] ?: null;
}

function tokko_kind_from_tokko_id(?string $tokkoId, string $fallback = 'property'): string
{
    $tokkoId = trim((string)$tokkoId);
    if (str_starts_with($tokkoId, 'development:')) {
        return 'development';
    }
    if (str_starts_with($tokkoId, 'property:')) {
        return 'property';
    }
    return $fallback === 'development' ? 'development' : 'property';
}

function tokko_fetch_remote_item_for_row(array $row): ?array
{
    $cfg = app_config()['tokko'];
    if (empty($cfg['api_key'])) {
        return null;
    }

    $remoteId = tokko_remote_id_from_tokko_id($row['tokko_id'] ?? null);
    if ($remoteId === null) {
        return null;
    }

    $kind = tokko_kind_from_tokko_id($row['tokko_id'] ?? null, (string)($row['listing_kind'] ?? 'property'));
    $baseUrl = $kind === 'development'
        ? ($cfg['development_url'] ?? '')
        : ($cfg['url'] ?? '');

    if ($baseUrl === '') {
        return null;
    }

    return tokko_fetch_item_detail($baseUrl, $cfg['api_key'], $remoteId);
}

function tokko_refresh_property_row_from_tokko(array $row): array
{
    $remote = tokko_fetch_remote_item_for_row($row);
    if (!$remote) {
        return $row;
    }

    $isDevelopment = (($row['listing_kind'] ?? '') === 'development') || str_starts_with((string)($row['tokko_id'] ?? ''), 'development:');
    $currentDescription = trim((string)($row['description'] ?? ''));
    $publicData = tokko_public_ficha_data_for_item($remote, $remote);
    $newDescription = tokko_best_description(
        tokko_extract_description($remote, $remote),
        (string)($publicData['description'] ?? '')
    );

    $updates = [];
    $params = [':id' => (int)$row['id']];

    if (
        $newDescription !== ''
        && tokko_description_is_valid($newDescription)
        && (
            $currentDescription === ''
            || tokko_description_is_probably_cut($currentDescription)
            || mb_strlen($newDescription, 'UTF-8') > mb_strlen($currentDescription, 'UTF-8') + 40
        )
    ) {
        $updates[] = 'description = :description';
        $params[':description'] = $newDescription;
        $row['description'] = $newDescription;
    }

    $photos = tokko_extract_photos($remote);
    if (!empty($photos)) {
        $updates[] = 'photos_json = :photos_json';
        $params[':photos_json'] = json_encode($photos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $row['photos_json'] = $params[':photos_json'];
        $row['image_url'] = $photos[0]['image'] ?? ($row['image_url'] ?? '');
        $updates[] = 'image_url = :image_url';
        $params[':image_url'] = $row['image_url'];
    }

    $details = tokko_apply_public_ficha_data(tokko_extract_details($remote, $remote, $isDevelopment), $publicData);
    if (!empty($details)) {
        $updates[] = 'details_json = :details_json';
        $params[':details_json'] = json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $row['details_json'] = $params[':details_json'];
    }

    // Para la ficha y la vista preferimos servicios/amenidades publicados en ficha.info.
    // Si no hay ficha pública utilizable, usamos los tags estrictos de Tokko como respaldo.
    $tagGroups = $details['tag_groups'] ?? tokko_extract_tag_groups($remote);
    $flatTags = tokko_flatten_tag_groups(is_array($tagGroups) ? $tagGroups : []);
    if (empty($flatTags)) {
        $flatTags = tokko_extract_tags($remote);
    }
    if (!empty($flatTags)) {
        $updates[] = 'tags_json = :tags_json';
        $params[':tags_json'] = json_encode($flatTags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $row['tags_json'] = $params[':tags_json'];
    }

    if ($updates) {
        $updates[] = 'updated_at = NOW()';
        try {
            $sql = 'UPDATE properties SET ' . implode(', ', array_unique($updates)) . ' WHERE id = :id';
            db()->prepare($sql)->execute($params);
        } catch (Throwable $e) {
            log_error($e);
        }
    }

    return $row;
}

function tokko_extract_price(array $item): float
{
    if (isset($item['operations'][0]['prices'][0]['price'])) {
        return (float)$item['operations'][0]['prices'][0]['price'];
    }
    if (isset($item['price'])) {
        return (float)$item['price'];
    }
    if (isset($item['from_price'])) {
        return (float)$item['from_price'];
    }
    return 0.0;
}

/**
 * Runs tokko_sync() automatically if more than $intervalSeconds have passed
 * since the last successful sync. Uses a simple timestamp file as a gate.
 * Fails silently so it never breaks the properties endpoint.
 */
function tokko_auto_sync(int $intervalSeconds = 900): void
{
    $cfg = app_config()['tokko'];
    if (empty($cfg['api_key'])) {
        return;
    }

    // Bump this constant to force an immediate re-sync after deploying a new version
    $codeVersion = 'v21-desarrollos-legales';

    $stampFile = __DIR__ . '/../logs/last_sync.stamp';

    $raw = is_file($stampFile) ? (string)@file_get_contents($stampFile) : '';
    $parts = explode('|', $raw, 2);
    $storedVersion = $parts[0] ?? '';
    $lastRun = (int)($parts[1] ?? 0);

    $versionChanged = ($storedVersion !== $codeVersion);
    $intervalElapsed = (time() - $lastRun) >= $intervalSeconds;

    if (!$versionChanged && !$intervalElapsed) {
        return; // Up to date and too soon
    }

    try {
        $result = tokko_sync();
        if (empty($result['skipped'])) {
            @file_put_contents($stampFile, $codeVersion . '|' . time(), LOCK_EX);
        }
    } catch (Throwable $e) {
        log_error($e);
    }
}

function tokko_html_to_text(string $html): string
{
    // Replace block-level closing tags with a newline so paragraphs are preserved
    $text = preg_replace('#</(p|div|li|h[1-6]|br|tr)>\s*#i', "\n", $html) ?? $html;
    $text = preg_replace('#<br\s*/?>\s*#i', "\n", $text) ?? $text;
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    // Collapse multiple blank lines into a single one
    $text = preg_replace('/\n{3,}/', "\n\n", $text) ?? $text;
    return trim($text);
}

function tokko_is_english(string $text): bool
{
    if (trim($text) === '') {
        return false;
    }

    $lower = strtolower($text);

    // Strong single-word signals → definitely English with just one match
    $strongSignals = [
        'the ', 'this ', 'that ', 'these ', 'those ', 'there is', 'there are',
        ' is a ', ' is an ', ' are a ', ' are the ',
        ' was ', ' were ', ' will be ', ' have been ',
        ' with ', ' from ', ' located ', ' featuring ', ' includes ',
        'bedroom', 'bathroom', 'kitchen', 'living room', 'square feet',
        'sqft', 'sq ft', 'amenities', 'building has', 'floor plan',
        'this property', 'this development', 'this unit',
    ];
    foreach ($strongSignals as $signal) {
        if (strpos($lower, $signal) !== false) {
            return true;
        }
    }

    // Weak signals: 2 matches → English
    $weakSignals = [
        ' in ', ' at ', ' for ', ' and ', ' or ', ' not ',
        ' its ', ' our ', ' your ', ' their ', ' which ', ' when ',
        'floor', 'garage', 'parking', 'balcony', 'view', 'space',
        'office', 'commercial', 'land', 'lot', 'unit', 'area',
        'property', 'building', 'level', 'access',
    ];
    $count = 0;
    foreach ($weakSignals as $signal) {
        if (strpos($lower, $signal) !== false) {
            $count++;
            if ($count >= 2) {
                return true;
            }
        }
    }

    return false;
}

function tokko_translate_to_spanish(string $text): string
{
    if (empty(trim($text))) {
        return $text;
    }

    // ── Cache ─────────────────────────────────────────────────────────────────
    $cacheFile = __DIR__ . '/../data/desc_translation_cache.json';
    static $descCache = null;
    if ($descCache === null) {
        $descCache = [];
        if (file_exists($cacheFile) && is_readable($cacheFile)) {
            $descCache = json_decode(file_get_contents($cacheFile), true) ?: [];
        }
    }
    $cacheKey = md5(trim($text));
    if (isset($descCache[$cacheKey])) {
        return $descCache[$cacheKey];
    }

    // ── Split into chunks ≤ 480 chars at sentence boundaries ─────────────────
    $maxChunk = 480;
    $chunks   = [];
    $remaining = trim($text);
    while (mb_strlen($remaining) > 0) {
        if (mb_strlen($remaining) <= $maxChunk) {
            $chunks[] = $remaining;
            break;
        }
        $slice     = mb_substr($remaining, 0, $maxChunk);
        $lastBreak = false;
        foreach (['. ', ".\n", '! ', '? ', "\n\n"] as $sep) {
            $pos = mb_strrpos($slice, $sep);
            if ($pos !== false && $pos > 80 && ($lastBreak === false || $pos > $lastBreak)) {
                $lastBreak = $pos + mb_strlen($sep);
            }
        }
        $cutAt     = ($lastBreak !== false) ? $lastBreak : $maxChunk;
        $chunks[]  = mb_substr($remaining, 0, $cutAt);
        $remaining = ltrim(mb_substr($remaining, $cutAt));
    }

    $translatedParts = [];
    $anyTranslated   = false;

    $lingvaInstances = [
        'https://lingva.ml',
        'https://translate.plausibility.cloud',
    ];

    foreach ($chunks as $chunk) {
        $chunk = trim($chunk);
        if ($chunk === '') {
            continue;
        }

        $chunkTranslated = null;

        // ── 1. Lingva (Google-backed, no daily limit) ─────────────────────────
        foreach ($lingvaInstances as $base) {
            $url = $base . '/api/v1/en/es/' . rawurlencode($chunk);
            $raw = tokko_http_get($url, 10);
            if ($raw) {
                $data      = json_decode($raw, true);
                $candidate = $data['translation'] ?? null;
                if (
                    is_string($candidate)
                    && $candidate !== ''
                    && stripos($candidate, 'error') === false
                    && strtolower(trim($candidate)) !== strtolower(trim($chunk))
                ) {
                    $chunkTranslated = $candidate;
                    break;
                }
            }
        }

        // ── 2. MyMemory fallback ──────────────────────────────────────────────
        if ($chunkTranslated === null) {
            $url = 'https://api.mymemory.translated.net/get?' . http_build_query([
                'q'        => $chunk,
                'langpair' => 'en|es',
                'de'       => 'sync@are-inmobiliaria.com',
            ]);
            $raw = tokko_http_get($url, 10);
            if ($raw) {
                $data      = json_decode($raw, true);
                $candidate = $data['responseData']['translatedText'] ?? '';
                if (
                    !empty($candidate)
                    && stripos($candidate, 'MYMEMORY WARNING') === false
                    && stripos($candidate, 'QUERY LENGTH LIMIT') === false
                    && strtolower(trim($candidate)) !== strtolower(trim($chunk))
                ) {
                    $chunkTranslated = $candidate;
                }
            }
        }

        if ($chunkTranslated !== null) {
            $translatedParts[] = $chunkTranslated;
            $anyTranslated     = true;
        } else {
            $translatedParts[] = $chunk; // keep original on failure
        }
    }

    $final = trim(implode(' ', $translatedParts));
    if ($final === '') {
        return $text;
    }

    // ── Save to cache if at least one chunk was translated ────────────────────
    if ($anyTranslated) {
        $dir = dirname($cacheFile);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        $descCache[$cacheKey] = $final;
        @file_put_contents(
            $cacheFile,
            json_encode($descCache, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    return $final;
}

function tokko_path_value(array $data, string $path): mixed
{
    $current = $data;
    foreach (explode('.', $path) as $part) {
        if (!is_array($current) || !array_key_exists($part, $current)) {
            return null;
        }
        $current = $current[$part];
    }
    return $current;
}

function tokko_clean_public_text(mixed $value): ?string
{
    if (!is_string($value) && !is_numeric($value)) {
        return null;
    }

    $text = tokko_html_to_text((string)$value);
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    $text = trim($text);

    $lower = strtolower($text);
    $emptyValues = [
        '0', '0.0', '0,0', 'null', 'undefined', 'array',
        '-', '--', '---', 'n/a', 'na', 'nd',
        'no disponible', 'no especificado', 'sin especificar',
        'sin informacion', 'sin información', 'desconocido',
        'agregar un valor o medida',
    ];

    if ($text === '' || in_array($lower, $emptyValues, true) || preg_match('/^-+$/', $text)) {
        return null;
    }

    return $text;
}

function tokko_first_text(array $sources, array $paths): ?string
{
    foreach ($sources as $source) {
        if (!is_array($source)) {
            continue;
        }
        foreach ($paths as $path) {
            $candidate = tokko_clean_public_text(tokko_path_value($source, $path));
            if ($candidate !== null) {
                return $candidate;
            }
        }
    }
    return null;
}

function tokko_extract_address(array $item, array $source): string
{
    $address = tokko_first_text([$source, $item], [
        'publication_address_es',
        'publication_address',
        'published_address_es',
        'published_address',
        'address_for_publish_es',
        'address_for_publish',
        'public_address_es',
        'public_address',
        'fake_address',
        'address',
        'address_short',
        'real_address',
    ]);

    return $address ?? '';
}

function tokko_extract_city(array $item, array $source): string
{
    return tokko_first_text([$source, $item], [
        'location.name',
        'location.city',
        'city',
        'address_short',
    ]) ?? '';
}

function tokko_extract_location_full(array $item, array $source): ?string
{
    $location = tokko_first_text([$source, $item], [
        'location.full_location',
        'location.full_name',
        'location.display_name',
        'full_location',
    ]);

    if ($location !== null) {
        return $location;
    }

    $parts = [];
    foreach (['location.country', 'location.state', 'location.city', 'location.name', 'location.neighborhood'] as $path) {
        $part = tokko_first_text([$source, $item], [$path]);
        if ($part !== null && !in_array($part, $parts, true)) {
            $parts[] = $part;
        }
    }

    return $parts ? implode(' | ', $parts) : null;
}

function tokko_build_display_location(array $item, array $source): ?string
{
    $address = tokko_extract_address($item, $source);
    $location = tokko_extract_location_full($item, $source);

    if ($address !== '' && $location !== null && stripos($location, $address) === false) {
        return $address . ' | ' . $location;
    }

    return $location ?? ($address !== '' ? $address : null);
}

function tokko_description_is_valid(string $description): bool
{
    $normalized = trim(tokko_html_to_text($description));
    if ($normalized === '') {
        return false;
    }

    $lower = mb_strtolower($normalized, 'UTF-8');
    $compact = preg_replace('/\s+/u', ' ', $lower) ?: $lower;
    $placeholders = [
        'yes we are',
        'are real estate',
        'are inmobiliaria',
        'sin descripcion',
        'sin descripción',
        'no disponible',
        'no especificado',
        'agregar un valor o medida',
        'nd',
        'n/a',
        '---',
    ];

    if (in_array(trim($compact), $placeholders, true)) {
        return false;
    }

    // Evita confundir atributos personalizados con descripción real.
    // Ejemplo reportado: "D: Blvd. Paseo IXTAPA, T: Campo de GOLF" pertenece al atributo "Vista".
    if (preg_match('/^\s*[A-ZÁÉÍÓÚÑ]\s*:\s*[^\n]{1,180}$/u', $normalized)) {
        return false;
    }

    return !str_contains($lower, 'mymemory warning')
        && !str_contains($lower, 'query length limit')
        && !str_contains($lower, 'arqus-alliance');
}


function tokko_description_is_probably_cut(string $description): bool
{
    $text = trim(tokko_html_to_text($description));
    $length = mb_strlen($text, 'UTF-8');

    // Muy corta: probablemente es una descripción breve real o un título, no usamos esta regla.
    if ($length < 120) {
        return false;
    }

    // Si ya es larga, aunque no tenga punto final, normalmente es usable.
    if ($length >= 320) {
        return false;
    }

    // Las meta-descripciones públicas de Tokko suelen llegar cortadas sin puntuación final.
    if (!preg_match('/[.!?…)]$/u', $text)) {
        return true;
    }

    // También detecta cortes obvios al final de conectores/palabras incompletas.
    return (bool)preg_match('/\b(c|co|con|de|del|la|el|los|las|un|una|en|para|por|que|y|o)$/iu', $text);
}

function tokko_normalize_description_key(string|int $key): string
{
    $key = trim(mb_strtolower((string)$key, 'UTF-8'));
    $key = strtr($key, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
    return preg_replace('/[^a-z0-9]+/u', ' ', $key) ?: $key;
}

function tokko_description_key_score(string|int $key): int
{
    $normalized = tokko_normalize_description_key($key);
    $score = 0;

    if (preg_match('/(^| )(es|esp|espanol|spanish|es mx)( |$)/u', $normalized)) {
        $score += 10000;
    }
    if (preg_match('/(^| )(en|eng|english)( |$)/u', $normalized)) {
        $score -= 3000;
    }
    if (str_contains($normalized, 'rich') || str_contains($normalized, 'only') || str_contains($normalized, 'full')) {
        $score += 1600;
    }
    if (str_contains($normalized, 'description') || str_contains($normalized, 'descripcion')) {
        $score += 1400;
    }
    if (str_contains($normalized, 'publication') || str_contains($normalized, 'public') || str_contains($normalized, 'web')) {
        $score += 600;
    }
    if (str_contains($normalized, 'short') || str_contains($normalized, 'corta') || str_contains($normalized, 'resumen')) {
        $score -= 8000;
    }
    if (str_contains($normalized, 'observacion') || str_contains($normalized, 'observations')) {
        $score -= 450;
    }
    if (str_contains($normalized, 'note') || str_contains($normalized, 'comment')) {
        $score -= 800;
    }

    return $score;
}

function tokko_looks_like_description_key(string|int $key): bool
{
    $normalized = tokko_normalize_description_key($key);
    return str_contains($normalized, 'description')
        || str_contains($normalized, 'descripcion')
        || str_contains($normalized, 'descriptions')
        || str_contains($normalized, 'observacion')
        || str_contains($normalized, 'observations');
}

function tokko_looks_like_language_key(string|int $key): bool
{
    $normalized = tokko_normalize_description_key($key);
    return (bool)preg_match('/(^| )(es|esp|espanol|spanish|es mx|en|eng|english)( |$)/u', $normalized);
}

function tokko_collect_description_text_fragments(mixed $value, array &$parts, int $depth = 0): void
{
    if ($depth > 6 || $value === null) {
        return;
    }

    if (is_string($value) || is_numeric($value)) {
        $text = trim(tokko_html_to_text((string)$value));
        if ($text !== '' && tokko_description_is_valid($text)) {
            $parts[] = $text;
        }
        return;
    }

    if (!is_array($value)) {
        return;
    }

    foreach ($value as $childKey => $childValue) {
        $normalizedKey = tokko_normalize_description_key($childKey);
        if (in_array(str_replace(' ', '_', $normalizedKey), ['tags','services','features','amenities','custom_attributes','photos','files','videos'], true)) {
            continue;
        }
        tokko_collect_description_text_fragments($childValue, $parts, $depth + 1);
    }
}

function tokko_add_description_candidate(array &$candidates, mixed $value, int $score = 0, string|int $key = ''): void
{
    $score += tokko_description_key_score($key);

    if (is_array($value) && tokko_looks_like_description_key($key)) {
        $parts = [];
        tokko_collect_description_text_fragments($value, $parts);
        $parts = array_values(array_unique(array_filter($parts)));
        if (count($parts) >= 2) {
            tokko_add_description_candidate($candidates, implode("

", $parts), $score + 900, $key);
        }
    }

    if (is_string($value) || is_numeric($value)) {
        $text = trim(tokko_html_to_text((string)$value));
        if (tokko_description_is_valid($text)) {
            $length = mb_strlen($text, 'UTF-8');
            $quality = $score + min($length, 6000) * 2;
            if ($length >= 180) {
                $quality += 3500;
            }
            if ($length >= 400) {
                $quality += 4500;
            }
            if (tokko_description_is_probably_cut($text)) {
                $quality -= 9000;
            }
            $candidates[] = [
                'text' => $text,
                'score' => $score,
                'length' => $length,
                'quality' => $quality,
            ];
        }
        return;
    }

    if (!is_array($value)) {
        return;
    }

    $language = $value['language'] ?? $value['lang'] ?? $value['locale'] ?? $value['idioma'] ?? $value['code'] ?? null;
    $languageScore = is_string($language) ? tokko_description_key_score($language) : 0;

    // Si recibimos un contenedor conocido de descripción, ahí sí es válido leer text/value/body/content.
    foreach (['description_only', 'rich_description', 'description', 'descripcion', 'publication_description', 'public_description', 'web_description', 'body', 'content', 'text', 'value'] as $field) {
        if (array_key_exists($field, $value)) {
            tokko_add_description_candidate($candidates, $value[$field], $score + $languageScore + 700, $field);
        }
    }

    foreach ($value as $childKey => $childValue) {
        if (tokko_looks_like_language_key($childKey) || tokko_looks_like_description_key($childKey)) {
            tokko_add_description_candidate($candidates, $childValue, $score + $languageScore, $childKey);
        } elseif (is_array($childValue) && isset($childValue['language'])) {
            tokko_add_description_candidate($candidates, $childValue, $score + $languageScore, $childKey);
        }
    }
}

function tokko_collect_description_fields(array $data, array &$candidates, int $depth = 0): void
{
    if ($depth > 5) {
        return;
    }

    $ignoredContainers = [
        'tags', 'features', 'amenities', 'services', 'spaces', 'rooms', 'aditionals', 'additionals',
        'custom_attributes', 'custom_attrs', 'custom_fields', 'extra_attributes', 'extra_attrs',
        'attributes_extra', 'property_extra_attributes', 'attributes_custom', 'extras', 'extra_data',
        'photos', 'files', 'videos', 'operations', 'prices', 'branch', 'producer', 'owner', 'location',
    ];

    foreach ($data as $key => $value) {
        $normalizedKey = tokko_normalize_description_key($key);
        if (in_array(str_replace(' ', '_', $normalizedKey), $ignoredContainers, true)) {
            continue;
        }

        if (tokko_looks_like_description_key($key)) {
            tokko_add_description_candidate($candidates, $value, max(0, 400 - ($depth * 80)), $key);
            continue;
        }

        if (is_array($value)) {
            tokko_collect_description_fields($value, $candidates, $depth + 1);
        }
    }
}

function tokko_extract_description(array $item, array $source): string
{
    $candidates = [];
    $sources = [$source, $item, $item['development'] ?? null];

    $paths = [
        'description_only_es',
        'rich_description_es',
        'description_es',
        'description_es_mx',
        'publication_description_es',
        'public_description_es',
        'web_description_es',
        'description_only',
        'rich_description',
        'publication_description',
        'public_description',
        'web_description',
        'description',
        'descriptions',
        'description_languages',
        'localized_descriptions',
        'localized_description',
        // description_short suele ser una meta descripción recortada; se usa solo como último recurso.
        'observations',
        'observaciones',
    ];

    foreach ($sources as $sourceCandidate) {
        if (!is_array($sourceCandidate)) {
            continue;
        }
        foreach ($paths as $path) {
            $value = tokko_path_value($sourceCandidate, $path);
            if ($value !== null) {
                tokko_add_description_candidate($candidates, $value, 0, $path);
            }
        }
    }

    // Búsqueda secundaria segura: solo campos cuyo nombre realmente sea descripción.
    foreach ($sources as $sourceCandidate) {
        if (is_array($sourceCandidate)) {
            tokko_collect_description_fields($sourceCandidate, $candidates);
        }
    }

    // En algunos casos Tokko entrega en la API solo una meta-descripción cortada,
    // pero la ficha pública contiene el texto completo. La agregamos como candidato
    // y el selector final elige la versión válida más larga.
    $publicUrls = [];
    foreach ($sources as $sourceCandidate) {
        if (!is_array($sourceCandidate)) {
            continue;
        }
        foreach (['public_url', 'web_url', 'url', 'property_url', 'ficha_url'] as $urlKey) {
            $urlValue = $sourceCandidate[$urlKey] ?? null;
            if (is_string($urlValue) && filter_var($urlValue, FILTER_VALIDATE_URL)) {
                $publicUrls[$urlValue] = true;
            }
        }
    }
    foreach (array_keys($publicUrls) as $publicUrl) {
        $publicDescription = tokko_fetch_public_description($publicUrl);
        if ($publicDescription !== '') {
            tokko_add_description_candidate($candidates, $publicDescription, 4500, 'public_description_full');
        }
    }

    if (!$candidates) {
        return '';
    }

    usort($candidates, static function (array $a, array $b): int {
        if (($a['quality'] ?? 0) === ($b['quality'] ?? 0)) {
            return $b['length'] <=> $a['length'];
        }
        return ($b['quality'] ?? 0) <=> ($a['quality'] ?? 0);
    });

    return $candidates[0]['text'];
}

function tokko_decode_json_string_fragment(string $value): string
{
    $decoded = json_decode('"' . str_replace('"', '\\"', $value) . '"');
    if (is_string($decoded)) {
        return $decoded;
    }

    $value = stripcslashes($value);
    return html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}


function tokko_try_add_json_description_candidates(string $jsonText, array &$candidates, int $score = 4300): void
{
    $jsonText = trim($jsonText);
    if ($jsonText === '') {
        return;
    }

    $decoded = json_decode($jsonText, true);
    if (!is_array($decoded)) {
        $decoded = json_decode(stripslashes($jsonText), true);
    }

    if (!is_array($decoded)) {
        return;
    }

    $walker = function (mixed $node, string|int $key = '') use (&$walker, &$candidates, $score): void {
        if (!is_array($node)) {
            if (tokko_looks_like_description_key($key) || tokko_looks_like_language_key($key)) {
                tokko_add_description_candidate($candidates, $node, $score, $key);
            }
            return;
        }

        if (tokko_looks_like_description_key($key) || tokko_looks_like_language_key($key)) {
            tokko_add_description_candidate($candidates, $node, $score, $key);
        }

        foreach ($node as $childKey => $child) {
            $walker($child, $childKey);
        }
    };

    $walker($decoded);
}

function tokko_collect_public_description_candidates(string $html, array &$candidates): void
{
    // Meta tags: útiles como respaldo, pero suelen estar cortados.
    if (preg_match_all('/<meta[^>]+(?:name|property)=["\'](?:description|og:description|twitter:description)["\'][^>]+content=["\']([^"\']{20,})["\'][^>]*>/iu', $html, $matches)) {
        foreach ($matches[1] as $raw) {
            tokko_add_description_candidate($candidates, html_entity_decode((string)$raw, ENT_QUOTES | ENT_HTML5, 'UTF-8'), 250, 'description_short');
        }
    }

    // JSON-LD y estados JS/Next/Vue/React: normalmente contienen la descripción completa.
    if (preg_match_all('/<script[^>]*>(.*?)<\/script>/is', $html, $scriptMatches)) {
        foreach ($scriptMatches[1] as $script) {
            $scriptText = html_entity_decode((string)$script, ENT_QUOTES | ENT_HTML5, 'UTF-8');

            if (preg_match_all('/["\'](?:description|descripcion|description_only|rich_description|publication_description|public_description|web_description)["\']\s*:\s*["\']((?:\\\\.|[^"\\\\]){30,})["\']/iu', $scriptText, $jsonMatches)) {
                foreach ($jsonMatches[1] as $rawValue) {
                    tokko_add_description_candidate($candidates, tokko_decode_json_string_fragment((string)$rawValue), 4200, 'public_description_full');
                }
            }

            // JSON-LD / Next / Nuxt / estados de React: intentamos decodificar objetos completos.
            if (preg_match_all('/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $html, $jsonLdMatches)) {
                foreach ($jsonLdMatches[1] as $jsonText) {
                    tokko_try_add_json_description_candidates(html_entity_decode((string)$jsonText, ENT_QUOTES | ENT_HTML5, 'UTF-8'), $candidates, 4600);
                }
            }
            if (preg_match('/<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)<\/script>/is', $html, $nextMatch)) {
                tokko_try_add_json_description_candidates(html_entity_decode((string)$nextMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'), $candidates, 4700);
            }
            if (preg_match('/window\.__(?:INITIAL_STATE|NUXT__|APOLLO_STATE__)\s*=\s*({.*?})\s*;?/is', $scriptText, $stateMatch)) {
                tokko_try_add_json_description_candidates(html_entity_decode((string)$stateMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'), $candidates, 4600);
            }

            // Algunos sitios guardan HTML escapado dentro del JS.
            if (preg_match_all('/Descripci[oó]n(.{80,6000}?)(?:Servicios|Amenidades|Caracter[ií]sticas|Ubicaci[oó]n|Mapa|Contacto)/ius', $scriptText, $sectionMatches)) {
                foreach ($sectionMatches[1] as $rawSection) {
                    tokko_add_description_candidate($candidates, $rawSection, 3500, 'public_description_full');
                }
            }
        }
    }

    // Texto visible de la ficha pública. Quitamos scripts/estilos antes de buscar secciones.
    $body = preg_replace('#<script[^>]*>.*?</script>#is', ' ', $html) ?? $html;
    $body = preg_replace('#<style[^>]*>.*?</style>#is', ' ', $body) ?? $body;
    $plain = html_entity_decode(strip_tags($body), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $plain = preg_replace('/\s+/u', ' ', $plain) ?: $plain;

    $sectionPatterns = [
        '/Descripci[oó]n\s+(.*?)\s+(?:Servicios|Amenidades|Caracter[ií]sticas|Ubicaci[oó]n|Mapa|Contacto|Multimedia|Archivos|Detalles)/iu',
        '/DESCRIPCI[OÓ]N\s+(.*?)\s+(?:SERVICIOS|AMENIDADES|CARACTER[IÍ]STICAS|UBICACI[OÓ]N|MAPA|CONTACTO|MULTIMEDIA|ARCHIVOS|DETALLES)/u',
    ];

    foreach ($sectionPatterns as $pattern) {
        if (preg_match($pattern, $plain, $sectionMatch)) {
            tokko_add_description_candidate($candidates, (string)$sectionMatch[1], 3800, 'public_description_full');
        }
    }
}


function tokko_strip_public_invisible_chars(string $value): string
{
    // ficha.info suele hidratar contenido con caracteres invisibles / separadores unicode.
    // Si no los quitamos, los regex no encuentran encabezados como "Servicios".
    $value = str_replace(["\u{200B}", "\u{200C}", "\u{200D}", "\u{FEFF}", "\u{2060}"], '', $value);
    $value = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}\x{2060}]/u', '', $value) ?? $value;
    return $value;
}

function tokko_decode_public_html_text(string $value): string
{
    $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    // Decode common JS unicode escapes found inside hydrated React/Vue/Next states.
    $value = preg_replace_callback('/\\\\u([0-9a-fA-F]{4})/', static function (array $m): string {
        $code = hexdec($m[1]);
        if ($code <= 0x7F) {
            return chr($code);
        }
        if ($code <= 0x7FF) {
            return chr(0xC0 | ($code >> 6)) . chr(0x80 | ($code & 0x3F));
        }
        return chr(0xE0 | ($code >> 12)) . chr(0x80 | (($code >> 6) & 0x3F)) . chr(0x80 | ($code & 0x3F));
    }, $value) ?? $value;

    $value = stripcslashes($value);
    return tokko_strip_public_invisible_chars($value);
}

function tokko_public_plain_text(string $html, bool $keepBreaks = true): string
{
    $html = tokko_decode_public_html_text($html);
    $html = preg_replace('#<script[^>]*>.*?</script>#is', ' ', $html) ?? $html;
    $html = preg_replace('#<style[^>]*>.*?</style>#is', ' ', $html) ?? $html;

    if ($keepBreaks) {
        $html = preg_replace('#</(p|div|li|h[1-6]|section|article|tr|td|br)>\s*#i', "\n", $html) ?? $html;
        $html = preg_replace('#<br\s*/?>#i', "\n", $html) ?? $html;
    }

    $plain = strip_tags($html);
    $plain = html_entity_decode($plain, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $plain = tokko_strip_public_invisible_chars($plain);

    if ($keepBreaks) {
        $plain = preg_replace('/[ \t]+/u', ' ', $plain) ?? $plain;
        $plain = preg_replace('/\n\s*\n+/u', "\n", $plain) ?? $plain;
        return trim($plain);
    }

    return trim(preg_replace('/\s+/u', ' ', $plain) ?? $plain);
}

function tokko_clean_public_section_text(string $text): string
{
    $text = tokko_decode_public_html_text($text);
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = tokko_strip_public_invisible_chars($text);
    $text = str_replace(['Mostrar más', 'Mostrar mas', 'Mostrar menos', 'Ver más', 'Ver mas'], '', $text);
    $text = preg_replace('/\s*\|\s*/u', ' | ', $text) ?? $text;
    $text = preg_replace('/[ \t]+/u', ' ', $text) ?? $text;
    $text = preg_replace('/\n\s*\n\s*\n+/u', "\n\n", $text) ?? $text;
    return trim($text);
}

function tokko_add_public_description_from_section(string $text, array &$candidates, int $score = 5600): void
{
    $plain = tokko_clean_public_section_text($text);
    if ($plain === '') {
        return;
    }

    $patterns = [
        '/Descripci[oó]n\s*(.*?)\s*(?:Servicios|Espacios|Adicionales|Amenidades|Caracter[ií]sticas|Ubicaci[oó]n|Mapa|Contacto|Multimedia|Archivos|Detalles|Informaci[oó]n general)(?:\s|$)/isu',
        '/DESCRIPCI[OÓ]N\s*(.*?)\s*(?:SERVICIOS|ESPACIOS|ADICIONALES|AMENIDADES|CARACTER[IÍ]STICAS|UBICACI[OÓ]N|MAPA|CONTACTO|MULTIMEDIA|ARCHIVOS|DETALLES|INFORMACI[OÓ]N GENERAL)(?:\s|$)/su',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $plain, $m)) {
            $candidate = trim((string)$m[1]);
            if ($candidate !== '') {
                tokko_add_description_candidate($candidates, $candidate, $score, 'public_description_full');
            }
        }
    }
}

function tokko_known_service_labels(): array
{
    return [
        // Español visible en ficha.info
        'Electricidad', 'Pavimento', 'Pavimentación', 'Agua potable', 'Alumbrado público',
        'Drenaje pluvial', 'Electricidad subterránea', 'Alcantarilla', 'Alcantarillado',
        'Biodigestor', 'Cable', 'Gas Industrial', 'Gas Natural', 'Internet',
        'Servicio de Mantenimiento', 'Teléfono', 'Línea telefónica', 'Drenaje', 'Cisterna',
        'Seguridad', 'Seguridad 24Hs', 'Vigilancia', 'CCTV',
        // Inglés por si ficha.info hidrata etiquetas desde Tokko antes de traducirlas.
        'Electricity', 'Pavement', 'Drinking Water', 'Public lighting',
        'Rainwater drainage', 'Underground electricity', 'Sewage', 'Sewerage',
        'Biodigester', 'Natural Gas', 'Industrial Gas', 'Phone', 'Telephone',
    ];
}

function tokko_public_extract_known_labels(string $text, array $knownLabels = []): array
{
    $text = tokko_clean_public_section_text($text);
    if ($text === '' || !$knownLabels) {
        return [];
    }

    $hits = [];
    $flat = preg_replace('/\s+/u', ' ', $text) ?? $text;
    foreach ($knownLabels as $label) {
        $pattern = '/(?<!\p{L})' . preg_quote($label, '/') . '(?!\p{L})/iu';
        if (preg_match($pattern, $flat, $m, PREG_OFFSET_CAPTURE)) {
            $hits[] = [
                'label' => $label,
                'pos' => (int)($m[0][1] ?? 0),
            ];
        }
    }

    if (!$hits) {
        return [];
    }

    usort($hits, static fn (array $a, array $b): int => $a['pos'] <=> $b['pos']);
    return tokko_normalize_tag_list(array_column($hits, 'label'));
}

function tokko_public_extract_list_items(string $sectionText, array $knownLabels = []): array
{
    $text = tokko_clean_public_section_text($sectionText);
    if ($text === '') {
        return [];
    }

    // En ficha.info los servicios muchas veces vienen como texto hidratado en una sola línea:
    // "Servicios Pavimento Electricidad". Primero buscamos etiquetas conocidas dentro
    // de la sección para separarlas correctamente y no devolver "Pavimento Electricidad"
    // como un único servicio.
    $knownHits = tokko_public_extract_known_labels($text, $knownLabels);
    if ($knownHits) {
        return $knownHits;
    }

    $lines = preg_split('/\R+|•|✓|✔|▪|·/u', $text) ?: [];
    $items = [];
    foreach ($lines as $line) {
        $line = trim(preg_replace('/\s+/u', ' ', $line) ?? $line);
        $line = preg_replace('/^(Servicios|Services|Espacios|Spaces|Adicionales|Additionals|Amenidades|Amenities|Caracter[ií]sticas|Features)\b[:\s-]*/iu', '', $line) ?? $line;
        $line = trim($line);
        if ($line === '' || mb_strlen($line, 'UTF-8') > 80) {
            continue;
        }
        if (tokko_is_empty_detail_value($line)) {
            continue;
        }
        $items[] = $line;
    }

    return tokko_normalize_tag_list($items);
}


function tokko_public_extract_services_from_json_value(mixed $value): array
{
    if (!is_array($value)) {
        return [];
    }

    $services = [];
    $known = tokko_known_service_labels();
    $knownLookup = [];
    foreach ($known as $label) {
        $knownLookup[normalizeAttributeKey($label)] = $label;
    }

    $add = static function (mixed $label) use (&$services, $knownLookup): void {
        $text = tokko_clean_tag_label($label);
        if ($text === null || mb_strlen($text, 'UTF-8') > 80) {
            return;
        }

        $normalized = normalizeAttributeKey($text);
        // Preferimos etiquetas conocidas para evitar traer textos de catálogo o descripciones.
        if (isset($knownLookup[$normalized])) {
            $services[] = $knownLookup[$normalized];
            return;
        }

        // También aceptamos etiquetas cortas cuando claramente vienen dentro de un contenedor de servicios.
        if (preg_match('/electric|paviment|pavement|agua|water|drenaje|drainage|alumbrado|lighting|gas|internet|tel[eé]fono|phone|alcantarill|sewer|biodigest/u', mb_strtolower($text, 'UTF-8'))) {
            $services[] = $text;
        }
    };

    $walk = function (mixed $node, string|int $key = '', bool $insideServices = false, int $depth = 0) use (&$walk, $add): void {
        if ($depth > 14) {
            return;
        }

        $normalizedKey = normalizeAttributeKey((string)$key);
        $isServicesKey = in_array($normalizedKey, [
            'services', 'service', 'servicios', 'servicio', 'public services', 'public service',
            'property services', 'property service', 'visible services', 'visible service'
        ], true);
        $inside = $insideServices || $isServicesKey;

        if (!is_array($node)) {
            if ($inside) {
                $add($node);
            }
            return;
        }

        $selection = tokko_tag_selection_state($node);
        if ($selection === false) {
            return;
        }

        if ($inside || $selection === true) {
            foreach (['name', 'label', 'title', 'text', 'value', 'valor'] as $field) {
                if (array_key_exists($field, $node) && !is_array($node[$field]) && tokko_boolish($node[$field]) === null) {
                    $add($node[$field]);
                    break;
                }
            }
        }

        foreach ($node as $childKey => $child) {
            // Evita recorrer catálogos muy grandes de servicios no publicados.
            if ($inside && is_array($child) && count($child) > 35) {
                continue;
            }
            $walk($child, $childKey, $inside, $depth + 1);
        }
    };

    $walk($value);
    return tokko_normalize_tag_list($services);
}

function tokko_try_collect_public_services_from_json(string $jsonText): array
{
    $jsonText = trim($jsonText);
    if ($jsonText === '') {
        return [];
    }

    $decoded = json_decode($jsonText, true);
    if (!is_array($decoded)) {
        $decoded = json_decode(stripslashes($jsonText), true);
    }

    if (!is_array($decoded)) {
        return [];
    }

    return tokko_public_extract_services_from_json_value($decoded);
}

function tokko_collect_public_services_from_embedded_data(string $html): array
{
    $services = [];
    $known = tokko_known_service_labels();

    if (preg_match_all('/<script[^>]*>(.*?)<\/script>/is', $html, $scriptMatches)) {
        foreach ($scriptMatches[1] as $script) {
            $scriptText = tokko_decode_public_html_text(html_entity_decode((string)$script, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $scriptText = str_replace(['\\n', '\\r', '\\t'], ["\n", "\n", ' '], $scriptText);

            // Next/Vue/Nuxt suelen guardar el estado completo como JSON.
            if (preg_match('/<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)<\/script>/is', $html, $nextMatch)) {
                $services = array_merge($services, tokko_try_collect_public_services_from_json(html_entity_decode((string)$nextMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            }
            if (preg_match('/window\.(?:__INITIAL_STATE__|__NUXT__|__APOLLO_STATE__)\s*=\s*({.*?})\s*;?/is', $scriptText, $stateMatch)) {
                $services = array_merge($services, tokko_try_collect_public_services_from_json($stateMatch[1]));
            }

            // Arrays directos tipo "services": ["Pavimento", "Electricidad"]
            if (preg_match_all('/["\'](?:services|servicios|public_services|property_services)["\']\s*:\s*(\[[^\]]{2,5000}\])/iu', $scriptText, $arrays)) {
                foreach ($arrays[1] as $rawArray) {
                    $services = array_merge($services, tokko_try_collect_public_services_from_json((string)$rawArray));
                }
            }

            // Texto hidratado/escapado: buscamos solo la ventana posterior al encabezado Servicios.
            foreach ([$scriptText, stripcslashes($scriptText), tokko_decode_json_string_fragment($scriptText)] as $variant) {
                $window = tokko_public_text_window_after_heading($variant, ['Servicios', 'Services'], [
                    'Espacios', 'Spaces', 'Adicionales', 'Additionals', 'Amenities', 'Amenidades',
                    'Características', 'Caracteristicas', 'Features', 'Ubicación', 'Ubicacion',
                    'Location', 'Mapa', 'Map', 'Contacto', 'Contact', 'Multimedia', 'Archivos',
                    'Files', 'Detalles', 'Details', 'Información general', 'Informacion general',
                    'General information', 'Descripción', 'Descripcion', 'Description',
                ], 1800);
                if ($window !== '') {
                    $services = array_merge($services, tokko_public_extract_known_labels($window, $known));
                }
            }
        }
    }

    return tokko_normalize_tag_list($services);
}

function tokko_extract_public_section(string $plain, string $heading, array $nextHeadings): string
{
    $plain = tokko_strip_public_invisible_chars($plain);
    $headingPattern = preg_quote($heading, '/');
    $next = implode('|', array_map(static fn ($h) => preg_quote($h, '/'), $nextHeadings));

    $patterns = [
        '/(?:^|\n|\s)' . $headingPattern . '\s*(.*?)(?=\n?\s*(?:' . $next . ')(?:\s|\n|$))/isu',
        '/(?:^|\s)' . $headingPattern . '\s+(.{2,2500}?)(?=\s+(?:' . $next . ')(?:\s|$))/isu',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $plain, $m)) {
            return trim((string)$m[1]);
        }
    }

    return '';
}

function tokko_public_text_window_after_heading(string $text, array $headings, array $nextHeadings, int $maxLength = 1400): string
{
    $text = tokko_clean_public_section_text($text);
    if ($text === '') {
        return '';
    }

    foreach ($headings as $heading) {
        $pattern = '/(?:^|\s|>|\\n)' . preg_quote($heading, '/') . '(?:\s|:|>|\\n)/iu';
        if (!preg_match($pattern, $text, $m, PREG_OFFSET_CAPTURE)) {
            continue;
        }

        $start = (int)$m[0][1] + strlen((string)$m[0][0]);
        $window = mb_substr($text, $start, $maxLength, 'UTF-8');

        $cutAt = null;
        foreach ($nextHeadings as $next) {
            if (preg_match('/(?:^|\s)' . preg_quote($next, '/') . '(?:\s|:|$)/iu', $window, $nm, PREG_OFFSET_CAPTURE)) {
                $pos = (int)$nm[0][1];
                if ($pos > 0 && ($cutAt === null || $pos < $cutAt)) {
                    $cutAt = $pos;
                }
            }
        }

        if ($cutAt !== null) {
            $window = mb_substr($window, 0, $cutAt, 'UTF-8');
        }

        $window = trim($window);
        if ($window !== '') {
            return $window;
        }
    }

    return '';
}

function tokko_collect_public_services_from_text(string $text): array
{
    $decoded = tokko_decode_public_html_text($text);
    $plain = tokko_public_plain_text($decoded, true);
    $compact = tokko_public_plain_text($decoded, false);
    $known = tokko_known_service_labels();

    $next = [
        'Espacios', 'Spaces', 'Adicionales', 'Additionals', 'Amenities', 'Amenidades',
        'Características', 'Caracteristicas', 'Features', 'Ubicación', 'Ubicacion',
        'Location', 'Mapa', 'Map', 'Contacto', 'Contact', 'Multimedia', 'Archivos',
        'Files', 'Detalles', 'Details', 'Información general', 'Informacion general',
        'General information', 'Descripción', 'Descripcion', 'Description',
    ];

    foreach (['Servicios', 'Services'] as $heading) {
        $section = tokko_extract_public_section($plain, $heading, $next);
        if ($section !== '') {
            $items = tokko_public_extract_list_items($section, $known);
            if ($items) {
                return $items;
            }
        }

        $section = tokko_extract_public_section($compact, $heading, $next);
        if ($section !== '') {
            $items = tokko_public_extract_list_items($section, $known);
            if ($items) {
                return $items;
            }
        }
    }

    // Fallback para fichas hidratadas por React/Next donde la sección queda compactada.
    foreach ([$plain, $compact, $decoded] as $sourceText) {
        $window = tokko_public_text_window_after_heading($sourceText, ['Servicios', 'Services'], $next, 1600);
        if ($window !== '') {
            $items = tokko_public_extract_known_labels($window, $known);
            if ($items) {
                return $items;
            }
        }
    }

    $embedded = tokko_collect_public_services_from_embedded_data($decoded);
    if ($embedded) {
        return $embedded;
    }

    return [];
}

function tokko_fetch_public_ficha_data(string $publicUrl): array
{
    static $cache = [];

    if (isset($cache[$publicUrl])) {
        return $cache[$publicUrl];
    }

    $result = [
        'description' => '',
        'services' => [],
        'spaces' => [],
        'features' => [],
        'public_url' => $publicUrl,
    ];

    $html = tokko_http_get($publicUrl, 12);
    if (!is_string($html) || trim($html) === '') {
        $cache[$publicUrl] = $result;
        return $result;
    }

    $decodedHtml = tokko_decode_public_html_text($html);
    $candidates = [];
    tokko_collect_public_description_candidates($decodedHtml, $candidates);

    // Búsqueda adicional sobre todo el HTML decodificado y sobre texto visible.
    tokko_add_public_description_from_section($decodedHtml, $candidates, 6200);
    tokko_add_public_description_from_section(tokko_public_plain_text($decodedHtml, true), $candidates, 6500);
    tokko_add_public_description_from_section(tokko_public_plain_text($decodedHtml, false), $candidates, 6000);

    if ($candidates) {
        usort($candidates, static function (array $a, array $b): int {
            if (($a['quality'] ?? 0) === ($b['quality'] ?? 0)) {
                return ($b['length'] ?? 0) <=> ($a['length'] ?? 0);
            }
            return ($b['quality'] ?? 0) <=> ($a['quality'] ?? 0);
        });

        $description = trim((string)($candidates[0]['text'] ?? ''));
        $description = tokko_clean_public_section_text($description);
        if (tokko_description_is_valid($description)) {
            $result['description'] = $description;
        }
    }

    $services = tokko_collect_public_services_from_text($decodedHtml);
    if ($services) {
        $result['services'] = $services;
    }

    $cache[$publicUrl] = $result;
    return $result;
}


function tokko_fetch_public_description(string $publicUrl): string
{
    $data = tokko_fetch_public_ficha_data($publicUrl);
    return trim((string)($data['description'] ?? ''));
}


// Traduce el tipo de propiedad de inglés a español (Tokko API devuelve en inglés)
function tokko_translate_property_type(string $type): string
{
    static $map = [
        // Inglés → nombre exacto del CRM de Tokko en español
        'house'               => 'Casa',
        'single family home'  => 'Casa Unifamiliar',
        'single family'       => 'Casa Unifamiliar',
        'apartment'           => 'Departamento',
        'ph'                  => 'Penthouse',
        'penthouse'           => 'Penthouse',
        'office'              => 'Oficina',
        'office building'     => 'Edificio de Oficinas',
        'land'                => 'Terreno',
        'lot'                 => 'Terreno',
        'local'               => 'Local Comercial',
        'store'               => 'Local Comercial',
        'commercial'          => 'Local Comercial',
        'commercial space'    => 'Local Comercial',
        'retail space'        => 'Local Comercial',
        'business premises'   => 'Local Comercial',
        'bussiness premises'  => 'Local Comercial',
        'commercial building' => 'Edificio Comercial',
        'residential building'=> 'Edificio Residencial',
        'building'            => 'Edificio',
        'storage'             => 'Bodega Industrial',
        'warehouse'           => 'Bodega Industrial',
        'bodega'              => 'Bodega Industrial',
        'industrial'          => 'Nave Industrial',
        'industrial condo'    => 'Condominio Industrial',
        'industrial condominium' => 'Condominio Industrial',
        'industrial land'     => 'Terreno Industrial',
        'residential land'    => 'Terreno Residencial',
        'commercial land'     => 'Terreno Comercial',
        'ranch'               => 'Rancho',
        'farm'                => 'Rancho',
        'hacienda'            => 'Hacienda',
        'country house'       => 'Casa en condominio',
        'country club'        => 'Club de Campo',
        'room'                => 'Departamento',
        'studio'              => 'Estudio',
        'loft'                => 'Loft',
        'development'         => 'Desarrollo',
        'parking'             => 'Estacionamiento',
        'hotel'               => 'Hotel',
        'chalet'              => 'Casa',
        'duplex'              => 'Dúplex',
        'villa'               => 'Villa',
        'townhouse'           => 'Casa en Condominio',
        'condominium'         => 'Condominio',
        'field'               => 'Campo',
        'land field'          => 'Campo',
        'mixed use'           => 'Uso Mixto',
        'fractional'          => 'Fraccional',
        'cabin'               => 'Cabaña',
        'beach house'         => 'Casa de Playa',
        'residential complex' => 'Complejo Residencial',
        'housing complex'     => 'Complejo Habitacional',
        'industrial park'     => 'Parque Industrial',
        'business park'       => 'Parque Empresarial',
        'shopping center'     => 'Centro Comercial',
        'mall'                => 'Centro Comercial',
        'parking lot'         => 'Estacionamiento',
        'suite'               => 'Suite',
    ];
    $key = strtolower(trim($type));
    return $map[$key] ?? $type;
}

function tokko_extract_operation_type(array $item): string
{
    $raw = $item['operations'][0]['operation_type'] ?? null;
    if (is_array($raw)) {
        $raw = $raw['name'] ?? 'venta';
    }
    $type = strtolower((string)$raw);
    return str_contains($type, 'rent') || str_contains($type, 'alquil') || str_contains($type, 'renta') ? 'renta' : 'venta';
}

function tokko_is_development(array $item): bool
{
    if (!empty($item['development']) || !empty($item['developments'])) {
        return true;
    }

    $type = strtolower((string)($item['type']['name'] ?? $item['type'] ?? ''));
    if (str_contains($type, 'desarrollo') || str_contains($type, 'emprendimiento') || str_contains($type, 'development')) {
        return true;
    }

    $tags = strtolower((string)json_encode($item['tags'] ?? []));
    return str_contains($tags, 'desarrollo') || str_contains($tags, 'emprendimiento') || str_contains($tags, 'development');
}

function tokko_pick_source(array $item, bool $isDevelopment): array
{
    if ($isDevelopment && !empty($item['development']) && is_array($item['development'])) {
        return $item['development'];
    }

    return $item;
}

function tokko_extract_photos(array $item): array
{
    $photos = $item['photos'] ?? [];
    if (!is_array($photos)) {
        return [];
    }

    return array_values(array_filter(array_map(static function ($photo) {
        if (!is_array($photo) || empty($photo['image'])) {
            return null;
        }

        return [
            'image' => $photo['image'],
            'thumb' => $photo['thumb'] ?? $photo['image'],
            'original' => $photo['original'] ?? $photo['image'],
            'description' => $photo['description'] ?? null,
            'is_front_cover' => (bool)($photo['is_front_cover'] ?? false),
            'is_blueprint' => (bool)($photo['is_blueprint'] ?? false),
            'order' => (int)($photo['order'] ?? 0),
        ];
    }, $photos)));
}

function tokko_boolish(mixed $value): ?bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        if ((float)$value === 1.0) {
            return true;
        }
        if ((float)$value === 0.0) {
            return false;
        }
        return null;
    }
    if (!is_string($value)) {
        return null;
    }

    $normalized = mb_strtolower(trim($value), 'UTF-8');
    if (in_array($normalized, ['1', 'true', 'yes', 'si', 'sí', 'selected', 'checked', 'active', 'activo', 'activa'], true)) {
        return true;
    }
    if (in_array($normalized, ['0', 'false', 'no', 'null', 'none', 'unchecked', 'unselected', 'inactive', 'inactivo', 'inactiva'], true)) {
        return false;
    }
    return null;
}

function tokko_tag_selection_state(array $value): ?bool
{
    $positive = false;
    $flagKeys = [
        'selected', 'is_selected', 'seleccionado', 'seleccionada',
        'checked', 'is_checked', 'marcado', 'marcada',
        'enabled', 'is_enabled', 'available', 'is_available',
        'active', 'is_active', 'activo', 'activa',
        'value', 'valor',
    ];

    foreach ($flagKeys as $key) {
        if (!array_key_exists($key, $value)) {
            continue;
        }

        $bool = tokko_boolish($value[$key]);
        if ($bool === false) {
            return false;
        }
        if ($bool === true) {
            $positive = true;
        }
    }

    return $positive ? true : null;
}

function tokko_clean_tag_label(mixed $value): ?string
{
    if (!is_string($value) && !is_numeric($value)) {
        return null;
    }

    $text = trim(tokko_html_to_text((string)$value));
    $normalized = mb_strtolower($text, 'UTF-8');
    if ($text === '' || in_array($normalized, ['0', '1', 'true', 'false', 'null', 'undefined', 'array', '---'], true)) {
        return null;
    }

    return $text;
}

function tokko_collect_tag_names(mixed $value, array &$result, int $depth = 0, bool $requireSelected = false): void
{
    if ($depth > 6 || $value === null || $value === false) {
        return;
    }

    // Si Tokko entrega una lista simple de strings dentro de `services`, esos strings
    // ya representan elementos seleccionados. Por eso los scalars se aceptan.
    $label = tokko_clean_tag_label($value);
    if ($label !== null) {
        $result[] = $label;
        return;
    }

    if (!is_array($value)) {
        return;
    }

    $selection = tokko_tag_selection_state($value);

    // Importante: muchos payloads de Tokko traen el catálogo completo de servicios
    // como objetos {name: "Agua potable", ...} sin bandera selected/checked.
    // Antes esos objetos se agregaban aunque no estuvieran seleccionados.
    // Cuando el contenedor requiere selección, solo agregamos el nombre del objeto
    // si trae una bandera explícita positiva. Si no, seguimos buscando hijos marcados.
    if ($requireSelected && $selection === false) {
        return;
    }
    $canUseObjectLabel = !$requireSelected || $selection === true;

    if ($canUseObjectLabel) {
        foreach (['name', 'label', 'title', 'description', 'text'] as $field) {
            if (array_key_exists($field, $value)) {
                $label = tokko_clean_tag_label($value[$field]);
                if ($label !== null) {
                    $result[] = $label;
                    return;
                }
            }
        }

        // En algunos payloads Tokko usa value como texto; solo lo usamos si no es booleano.
        foreach (['value', 'valor'] as $field) {
            if (array_key_exists($field, $value) && tokko_boolish($value[$field]) === null) {
                $label = tokko_clean_tag_label($value[$field]);
                if ($label !== null) {
                    $result[] = $label;
                    return;
                }
            }
        }
    }

    foreach ($value as $childKey => $child) {
        // Si el objeto padre está seleccionado, sus hijos label/name/value pueden leerse sin exigir otra bandera.
        $childRequiresSelection = $requireSelected && $selection !== true;
        // Evitamos recorrer campos de nombre de objetos no seleccionados, porque eso reintroduce el catálogo completo.
        if ($childRequiresSelection && in_array((string)$childKey, ['name', 'label', 'title', 'description', 'text', 'value', 'valor'], true)) {
            continue;
        }
        tokko_collect_tag_names($child, $result, $depth + 1, $childRequiresSelection);
    }
}

function tokko_normalize_tag_list(array $raw): array
{
    $clean = [];
    foreach ($raw as $tag) {
        $translated = trim(tokko_translate_tag((string)$tag));
        if ($translated === '') {
            continue;
        }
        $key = mb_strtolower($translated, 'UTF-8');
        if (!isset($clean[$key])) {
            $clean[$key] = $translated;
        }
    }

    return array_values($clean);
}

function tokko_merge_tag_groups(array ...$groupsList): array
{
    $merged = ['services' => [], 'spaces' => [], 'features' => []];
    foreach ($groupsList as $groups) {
        foreach ($merged as $group => $_) {
            if (!empty($groups[$group]) && is_array($groups[$group])) {
                $merged[$group] = array_values(array_unique(array_merge($merged[$group], $groups[$group])));
            }
        }
    }
    return $merged;
}

function tokko_categorize_tag_label(string $label, mixed $type = null): string
{
    $typeText = strtolower(trim((string)$type));

    // Tokko normalmente manda type=1 para Servicios. Los demás se separan como espacios/adicionales.
    if (in_array($typeText, ['1', 'service', 'services', 'servicio', 'servicios'], true)) {
        return 'services';
    }
    if (in_array($typeText, ['2', 'space', 'spaces', 'room', 'rooms', 'espacio', 'espacios'], true)) {
        return 'spaces';
    }
    if (in_array($typeText, ['3', 'feature', 'features', 'amenity', 'amenities', 'additional', 'additionals', 'adicional', 'adicionales'], true)) {
        return 'features';
    }

    $normalized = mb_strtolower(tokko_translate_tag($label), 'UTF-8');
    if (preg_match('/electric|luz|agua|gas|drenaje|alcantarill|alumbrado|paviment|internet|tel[eé]fono|mantenimiento|seguridad|vigilancia|cctv|cisterna/u', $normalized)) {
        return 'services';
    }
    if (preg_match('/bañ|bodega|patio|terraza|jard[ií]n|rec[aá]mara|cocina|sala|comedor|oficina|vest[ií]bulo|estacionamiento|cochera|balc[oó]n|local|cuarto/u', $normalized)) {
        return 'spaces';
    }
    return 'features';
}

function tokko_extract_tag_groups_from_api_tags(array $item): array
{
    $groups = ['services' => [], 'spaces' => [], 'features' => []];
    $tags = $item['tags'] ?? null;

    if (!is_array($tags)) {
        return $groups;
    }

    foreach ($tags as $tag) {
        if (is_array($tag)) {
            $label = null;
            foreach (['name', 'label', 'title', 'description', 'text'] as $field) {
                if (array_key_exists($field, $tag)) {
                    $label = tokko_clean_tag_label($tag[$field]);
                    if ($label !== null) {
                        break;
                    }
                }
            }
            if ($label === null) {
                continue;
            }
            $group = tokko_categorize_tag_label($label, $tag['type'] ?? $tag['tag_type'] ?? $tag['category'] ?? null);
            $groups[$group][] = $label;
            continue;
        }

        $label = tokko_clean_tag_label($tag);
        if ($label !== null) {
            $group = tokko_categorize_tag_label($label, null);
            $groups[$group][] = $label;
        }
    }

    foreach ($groups as $group => $items) {
        $groups[$group] = tokko_normalize_tag_list($items);
    }

    return $groups;
}

function tokko_extract_tag_groups(array $item): array
{
    $groups = ['services' => [], 'spaces' => [], 'features' => []];

    $pathGroups = [
        'services' => ['services', 'public_services', 'property_services'],
        'spaces' => ['spaces', 'rooms'],
        'features' => ['amenities', 'features', 'property_features', 'aditionals', 'additionals', 'additional_features', 'extras'],
    ];

    foreach ($pathGroups as $group => $paths) {
        $raw = [];
        foreach ($paths as $path) {
            $value = tokko_path_value($item, $path);
            if ($value !== null) {
                // Estos contenedores pueden traer catálogo completo; por eso respetamos checked/selected/value.
                tokko_collect_tag_names($value, $raw, 0, true);
            }
        }
        $groups[$group] = tokko_normalize_tag_list($raw);
    }

    // No usamos item['tags'] como respaldo automático porque Tokko puede devolver aquí
    // etiquetas internas o de catálogo que no coinciden con los servicios visibles/publicados
    // en la ficha. Los servicios públicos se cargan desde ficha.info en
    // tokko_apply_public_ficha_data().
    return $groups;
}

function tokko_extract_tags(array $item): array
{
    $raw = [];

    // Primero usamos grupos estructurados y/o tags oficiales de Tokko ya agrupados.
    $groups = tokko_extract_tag_groups($item);
    foreach ($groups as $items) {
        $raw = array_merge($raw, $items);
    }

    return tokko_normalize_tag_list($raw);
}

function tokko_translate_tag(string $tag): string
{
    static $map = [
        // infrastructure
        'sewage'                  => 'Drenaje',
        'sewage system'           => 'Drenaje',
        'sewerage'                => 'Alcantarillado',
        'electricity'             => 'Electricidad',
        'underground electricity' => 'Electricidad subterránea',
        'phone'                   => 'Línea telefónica',
        'telephone'               => 'Línea telefónica',
        'internet'                => 'Internet',
        'pavement'                => 'Pavimentación',
        'paved road'              => 'Calle pavimentada',
        'public lighting'         => 'Alumbrado público',
        'street lighting'         => 'Alumbrado público',
        'rainwater drainage'      => 'Drenaje pluvial',
        'storm drain'             => 'Drenaje pluvial',
        'biodigesters'            => 'Biodigestores',
        'biodigester'             => 'Biodigestor',
        'water'                   => 'Agua',
        'potable water'           => 'Agua potable',
        'water tank'              => 'Cisterna',
        'cistern'                 => 'Cisterna',
        'drainage'                => 'Drenaje',
        'gas'                     => 'Gas',
        'natural gas'             => 'Gas natural',
        'sidewalk'                => 'Banqueta',
        // amenities
        'gym'                     => 'Gimnasio',
        'swimming pool'           => 'Alberca',
        'pool'                    => 'Alberca',
        'parking'                 => 'Estacionamiento',
        'elevator'                => 'Elevador',
        'security'                => 'Seguridad',
        'security cameras'        => 'Cámaras de seguridad',
        'rooftop'                 => 'Roof Garden',
        'roof garden'             => 'Roof Garden',
        'lobby'                   => 'Lobby',
        'garden'                  => 'Jardín',
        'terrace'                 => 'Terraza',
        'balcony'                 => 'Balcón',
        'laundry'                 => 'Lavandería',
        'laundry room'            => 'Cuarto de lavado',
        'storage'                 => 'Bodega',
        'storage room'            => 'Cuarto de bodega',
        'concierge'               => 'Concierge',
        'playground'              => 'Área de juegos',
        'pet friendly'            => 'Pet Friendly',
        'co-working'              => 'Co-working',
        'coworking'               => 'Co-working',
        'bbq'                     => 'Asador',
        'grill'                   => 'Asador',
        'jacuzzi'                 => 'Jacuzzi',
        'sauna'                   => 'Sauna',
        'spa'                     => 'Spa',
        'cinema'                  => 'Cine',
        'movie room'              => 'Sala de cine',
        'business center'         => 'Centro de negocios',
        'event room'              => 'Salón de eventos',
        'event hall'              => 'Salón de eventos',
        'sports court'            => 'Cancha deportiva',
        'tennis court'            => 'Cancha de tenis',
        'basketball court'        => 'Cancha de basketball',
        'air conditioning'        => 'Aire acondicionado',
        'heating'                 => 'Calefacción',
        'solar panels'            => 'Paneles solares',
        'generator'               => 'Planta de luz',
        'clubhouse'               => 'Club House',
        'club house'              => 'Club House',
        'reception'               => 'Recepción',
        'conference room'         => 'Sala de conferencias',
        'conference'              => 'Sala de conferencias',
        'doorman'                 => 'Portero',
        'guard'                   => 'Vigilancia',
        'gated community'         => 'Privada',
        'green areas'             => 'Áreas verdes',
        'green area'              => 'Área verde',
        'common areas'            => 'Áreas comunes',
        'common area'             => 'Área común',
        'fire extinguisher'       => 'Extinguidor',
        'sprinklers'              => 'Rociadores contra incendio',
        'freight elevator'        => 'Elevador de carga',
        'service elevator'        => 'Elevador de servicio',
        'visitors parking'        => 'Estacionamiento para visitas',
        'visitor parking'         => 'Estacionamiento para visitas',
        'covered parking'         => 'Estacionamiento techado',
        'underground parking'     => 'Estacionamiento subterráneo',
        'fiber optic'             => 'Fibra óptica',
        'high speed internet'     => 'Internet de alta velocidad',
        'intercom'                => 'Intercomunicador',
        'alarm system'            => 'Sistema de alarma',
        'smart home'              => 'Casa inteligente',
        'domotics'                => 'Domótica',
        'air purifier'            => 'Purificador de aire',
        'view'                    => 'Vista panorámica',
        'mountain view'           => 'Vista a la montaña',
        'city view'               => 'Vista a la ciudad',
        'accessible'              => 'Accesible',
        'wheelchair accessible'   => 'Acceso para silla de ruedas',
        'furnished'               => 'Amueblado',
        'semi furnished'          => 'Semi-amueblado',
        'unfurnished'             => 'Sin muebles',
        'kitchen'                 => 'Cocina',
        'equipped kitchen'        => 'Cocina equipada',
        'walk in closet'          => 'Walk-in Closet',
        'closet'                  => 'Clóset',
        'dining room'             => 'Comedor',
        'living room'             => 'Sala',
        'study'                   => 'Estudio',
        'service room'            => 'Cuarto de servicio',
        'maid room'               => 'Cuarto de servicio',
        // propiedades generales
        'hall'                    => 'Vestíbulo',
        'lobby hall'              => 'Vestíbulo',
        'fire detector'           => 'Detector de incendios',
        'fire alarm'              => 'Alarma contra incendios',
        'smoke detector'          => 'Detector de humo',
        'modern style'            => 'Estilo moderno',
        'colonial style'          => 'Estilo colonial',
        'contemporary style'      => 'Estilo contemporáneo',
        'one level'               => 'Un nivel',
        'single level'            => 'Un nivel',
        'cctv'                    => 'Cámaras CCTV',
        'electricity to be connected' => 'Toma de electricidad',
        'water to be connected'   => 'Toma de agua',
        'gas to be connected'     => 'Toma de gas',
        'aluminium windows'       => 'Ventanas de aluminio',
        'aluminum windows'        => 'Ventanas de aluminio',
        'glass windows'           => 'Ventanas de vidrio',
        '24 hour security'        => 'Seguridad 24 horas',
        '24/7 security'           => 'Seguridad 24/7',
        'fixed garage'            => 'Cochera fija',
        'lift'                    => 'Elevador',
        'main boulevard'          => 'Sobre boulevard principal',
        'administrative office building' => 'Edificio de oficinas administrativas',
        'drinking water'          => 'Agua potable',
        'night security'          => 'Vigilancia nocturna',
        'internal land'           => 'Terreno interior',
        'private security company' => 'Empresa de seguridad privada',
        'good rental potential'   => 'Buen potencial de renta',
        'quiet location'          => 'Zona tranquila',
        'security grills'         => 'Rejas de seguridad',
        'security grill'          => 'Reja de seguridad',
        'concrete floors'         => 'Pisos de concreto',
        'concrete floor'          => 'Piso de concreto',
        'trifasic energy'         => 'Energía trifásica',
        'trifásic energy'         => 'Energía trifásica',
        'three phase energy'      => 'Energía trifásica',
        'access control'          => 'Control de acceso',
        'maintenance service'     => 'Servicio de mantenimiento',
        'issue invoice'           => 'Factura disponible',
        'store'                   => 'Bodega',
        'entrance security'       => 'Seguridad en acceso',
        'immediate deed'          => 'Escrituración inmediata',
        'direct sale'             => 'Venta directa',
        'condominium'             => 'Condominio',
        'condomini'               => 'Condominio',
        'solar heater'            => 'Calentador solar',
        'cistern'                 => 'Cisterna',
        'water cistern'           => 'Cisterna de agua',
        'electric plant'          => 'Planta de luz',
        'backup power'            => 'Energía de respaldo',
        'natural ventilation'     => 'Ventilación natural',
        'cross ventilation'       => 'Ventilación cruzada',
        'wood floors'             => 'Pisos de madera',
        'marble floors'           => 'Pisos de mármol',
        'porcelain floors'        => 'Pisos de porcelanato',
        'laminated floors'        => 'Pisos laminados',
        'ceramic floors'          => 'Pisos de cerámica',
        'granite countertops'     => 'Encimeras de granito',
        'marble countertops'      => 'Encimeras de mármol',
        'quartz countertops'      => 'Encimeras de cuarzo',
        'stainless steel'         => 'Acero inoxidable',
        'double height'           => 'Doble altura',
        'high ceilings'           => 'Techos altos',
        'skylight'                => 'Claraboya',
        'panoramic view'          => 'Vista panorámica',
        'sea view'                => 'Vista al mar',
        'lake view'               => 'Vista al lago',
        'pool view'               => 'Vista a la alberca',
        'garden view'             => 'Vista al jardín',
        'bay windows'             => 'Ventanales',
        'electric blinds'         => 'Persianas eléctricas',
        'curtains'                => 'Cortinas',
        'dressing room'           => 'Vestidor',
        'utility room'            => 'Cuarto de utilería',
        'wine cellar'             => 'Cava de vinos',
        'home theater'            => 'Home Theater',
        'home office'             => 'Home Office',
        'private pool'            => 'Alberca privada',
        'shared pool'             => 'Alberca compartida',
        'heated pool'             => 'Alberca climatizada',
        'infinity pool'           => 'Alberca infinity',
        'adults pool'             => 'Alberca para adultos',
        'kids pool'               => 'Alberca infantil',
        'mini gym'                => 'Mini gimnasio',
        'yoga room'               => 'Sala de yoga',
        'pilates room'            => 'Sala de pilates',
        'massage room'            => 'Sala de masajes',
        'bicycle parking'         => 'Estacionamiento de bicicletas',
        'bike rack'               => 'Rack de bicicletas',
        'electric car charger'    => 'Cargador para auto eléctrico',
        'ev charger'              => 'Cargador para auto eléctrico',
        'shuttle service'         => 'Servicio de transporte',
        'valet parking'           => 'Valet parking',
        'storage unit'            => 'Cuarto de bodega',
        'package room'            => 'Cuarto de paquetes',
        'mail room'               => 'Cuarto de correspondencia',
        'trash chute'             => 'Ducto de basura',
        'recycling'               => 'Reciclaje',
        'water treatment'         => 'Tratamiento de agua',
        'rainwater collection'    => 'Captación de agua pluvial',
        'led lighting'            => 'Iluminación LED',
        'energy efficient'        => 'Eficiencia energética',
        'leed certified'          => 'Certificación LEED',
        'earthquake resistant'    => 'Resistente a sismos',
        'impact resistant windows'=> 'Ventanas resistentes a impactos',
        'bulletproof glass'       => 'Vidrio blindado',
        'panic room'              => 'Cuarto de pánico',
        'safe'                    => 'Caja fuerte',
        'vault'                   => 'Caja de seguridad',
        'loading dock'            => 'Andén de carga',
        'freight elevator'        => 'Elevador de carga',
        'crane'                   => 'Grúa',
        'office space'            => 'Espacio de oficinas',
        'open office'             => 'Oficina abierta',
        'private office'          => 'Oficina privada',
        'meeting room'            => 'Sala de reuniones',
        'boardroom'               => 'Sala de juntas',
        'server room'             => 'Cuarto de servidores',
        'data center'             => 'Centro de datos',
        'cafeteria'               => 'Cafetería',
        'restaurant'              => 'Restaurante',
        'convenience store'       => 'Tienda de conveniencia',
        'pharmacy'                => 'Farmacia',
        'atm'                     => 'Cajero automático',
        'bank'                    => 'Banco',
        'gym center'              => 'Centro deportivo',
        'sports center'           => 'Centro deportivo',
        'fitness center'          => 'Gimnasio',
        'health club'             => 'Club de salud',
        'beauty salon'            => 'Salón de belleza',
        'dry cleaning'            => 'Tintorería',
    ];

    $key = strtolower(trim($tag));
    return $map[$key] ?? $tag;
}

/**
 * Translates a single English string to Spanish using:
 *   1. A persistent JSON cache (backare/data/translation_cache.json)
 *   2. MyMemory free API (no key required, ~1 000 words/day per IP)
 * Returns the original string if translation fails or the text is already Spanish.
 */
/**
 * Shared low-level HTTP GET via cURL (with file_get_contents fallback).
 */
function tokko_http_get(string $url, int $timeout = 10): string|false
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT      => 'ARE-Inmobiliaria/1.0',
        ]);
        $result = curl_exec($ch);
        curl_close($ch);
        return $result;
    }
    $ctx = stream_context_create(['http' => ['timeout' => $timeout, 'header' => "User-Agent: ARE-Inmobiliaria/1.0\r\n"]]);
    return @file_get_contents($url, false, $ctx);
}

/**
 * Translate a short string (tag / property type) using:
 *   1. Persistent JSON cache
 *   2. Lingva Translate (Google-backed, no API key, no daily limit)
 *   3. MyMemory (fallback)
 * Returns original if all APIs fail.
 */
function tokko_auto_translate(string $text): string
{
    // Traducción automática desactivada: se conserva exactamente el texto que llega desde Tokko.
    return trim($text);
}

function tokko_translate_detail_value(string $field, mixed $value): mixed
{
    if ($value === null || $value === '') {
        return $value;
    }
    $v = strtolower(trim(str_replace('_', ' ', (string)$value)));

    static $conditions = [
        'good'                    => 'Buenas condiciones',
        'good condition'          => 'Buenas condiciones',
        'excellent'               => 'Excelentes condiciones',
        'excellent condition'     => 'Excelentes condiciones',
        'regular'                 => 'Condiciones regulares',
        'regular condition'       => 'Condiciones regulares',
        'bad'                     => 'Necesita reparación',
        'bad condition'           => 'Necesita reparación',
        'needs repair'            => 'Necesita reparación',
        'need repairs'            => 'Necesita reparación',
        'new'                     => 'A estrenar',
        'new building'            => 'Edificio nuevo',
        'to remodel'              => 'Para remodelar',
        'under construction'      => 'En construcción',
        'habitability certificate'=> 'Con cédula de habitabilidad',
    ];
    static $situations = [
        'forsale'   => 'En venta',
        'for sale'  => 'En venta',
        'rent'      => 'En renta',
        'for rent'  => 'En renta',
        'rented'    => 'Rentado',
        'sold'      => 'Vendido',
        'transfer'  => 'Traspaso',
    ];
    static $orientations = [
        'north'     => 'Norte',
        'south'     => 'Sur',
        'east'      => 'Oriente',
        'west'      => 'Poniente',
        'northeast' => 'Noreste',
        'northwest' => 'Noroeste',
        'southeast' => 'Sureste',
        'southwest' => 'Suroeste',
        'corner'    => 'Esquina',
        'front'     => 'Frente',
        'back'      => 'Trasero',
        'interior'  => 'Interior',
        'exterior'  => 'Exterior',
    ];
    static $dispositions = [
        'front'    => 'Frente',
        'back'     => 'Trasero',
        'interior' => 'Interior',
        'internal' => 'Interior',
        'external' => 'Exterior',
        'exterior' => 'Exterior',
        'corner'   => 'Esquina',
        'lateral'  => 'Lateral',
    ];
    static $credits = [
        'yes'   => 'Sí',
        'no'    => 'No',
        'true'  => 'Sí',
        'false' => 'No',
        '1'     => 'Sí',
        '0'     => 'No',
    ];
    static $statuses = [
        'finished'           => 'Terminado',
        'completed'          => 'Terminado',
        'under construction' => 'En construcción',
        'in construction'    => 'En construcción',
        'construction'       => 'En construcción',
        'presale'            => 'Pre-venta',
        'pre-sale'           => 'Pre-venta',
        'pre sale'           => 'Pre-venta',
        'proyected'          => 'En planos',
        'projected'          => 'En planos',
        'planning'           => 'En planeación',
        'delivery'           => 'Entrega',
        'sold out'           => 'Agotado',
    ];

    $map = match ($field) {
        'property_condition'   => $conditions,
        'situation'            => $situations,
        'orientation'          => $orientations,
        'disposition'          => $dispositions,
        'credit_eligible'      => $credits,
        'construction_status'  => $statuses,
        default                => [],
    };

    return $map[$v] ?? $value;
}


function tokko_normalize_attribute_key(string $label): string
{
    $label = trim(mb_strtolower($label, 'UTF-8'));
    $label = strtr($label, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
        'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'Ü' => 'u', 'Ñ' => 'n',
    ]);
    $label = preg_replace('/[^a-z0-9]+/u', ' ', $label) ?? $label;
    return trim(preg_replace('/\s+/u', ' ', $label) ?? $label);
}

function tokko_is_empty_detail_value(mixed $value): bool
{
    if ($value === null || $value === '' || $value === []) {
        return true;
    }

    if (is_array($value) || is_object($value)) {
        return false;
    }

    $text = trim((string)$value);
    $lower = mb_strtolower($text, 'UTF-8');
    $lower = preg_replace('/\s+/u', ' ', $lower) ?? $lower;

    $emptyValues = [
        '', '-', '--', '---', 'n/a', 'na', 'nd',
        'null', 'undefined', 'array',
        'no disponible', 'no especificado', 'sin especificar',
        'sin informacion', 'sin información', 'desconocido',
        'agregar un valor o medida',
    ];

    if (in_array($lower, $emptyValues, true) || preg_match('/^-+$/', $text)) {
        return true;
    }

    return false;
}

function tokko_clean_detail_scalar(mixed $value, bool $zeroIsEmpty = true): mixed
{
    if (tokko_is_empty_detail_value($value)) {
        return null;
    }

    if (is_array($value) || is_object($value)) {
        return $value;
    }

    $text = trim((string)$value);
    if ($zeroIsEmpty && preg_match('/^0(?:[.,]0+)?(?:\s*(?:mxn|usd|m2|m²|m|%))?$/iu', $text)) {
        return null;
    }

    return is_numeric($value) ? $value : $text;
}

function tokko_read_attribute_value(array $attribute): mixed
{
    foreach (['value', 'valor', 'display_value', 'text', 'description', 'amount', 'name_value'] as $key) {
        if (array_key_exists($key, $attribute) && !tokko_is_empty_detail_value($attribute[$key])) {
            return $attribute[$key];
        }
    }
    return null;
}

function tokko_extract_custom_attributes(array $item, array $source): array
{
    $paths = [
        'custom_attributes', 'custom_attrs', 'custom_fields', 'custom_data',
        'extra_attributes', 'extra_attrs', 'attributes_extra', 'property_extra_attributes',
        'attributes_custom', 'extras', 'additional_attributes', 'extra_data',
    ];

    $result = [];
    foreach ([$source, $item, $item['development'] ?? null] as $candidateSource) {
        if (!is_array($candidateSource)) {
            continue;
        }

        foreach ($paths as $path) {
            $attributes = tokko_path_value($candidateSource, $path);
            if (!is_array($attributes)) {
                continue;
            }

            foreach ($attributes as $key => $attribute) {
                $label = null;
                $value = null;

                if (is_array($attribute)) {
                    foreach (['label', 'name', 'title', 'key', 'attribute', 'field'] as $labelKey) {
                        if (!empty($attribute[$labelKey]) && is_string($attribute[$labelKey])) {
                            $label = $attribute[$labelKey];
                            break;
                        }
                    }
                    $value = tokko_read_attribute_value($attribute);
                } elseif (is_string($key) && !is_array($attribute)) {
                    $label = $key;
                    $value = $attribute;
                }

                if (!is_string($label) || $label === '') {
                    continue;
                }

                $cleanValue = tokko_clean_detail_scalar($value, true);
                if ($cleanValue === null) {
                    continue;
                }

                $normalized = tokko_normalize_attribute_key($label);
                if ($normalized === '') {
                    continue;
                }

                $result[$normalized] = [
                    'label' => trim($label),
                    'value' => $cleanValue,
                ];
            }
        }
    }

    return array_values($result);
}

function tokko_find_custom_attribute(array $attributes, array $labels): mixed
{
    $wanted = array_map('tokko_normalize_attribute_key', $labels);
    foreach ($attributes as $attribute) {
        if (!is_array($attribute)) {
            continue;
        }
        $label = (string)($attribute['label'] ?? '');
        $key = tokko_normalize_attribute_key($label);
        if (in_array($key, $wanted, true)) {
            return $attribute['value'] ?? null;
        }
    }
    return null;
}

function tokko_extract_details(array $item, array $source, bool $isDevelopment): array
{
    $customAttributes = tokko_extract_custom_attributes($item, $source);

    $landShape = tokko_find_custom_attribute($customAttributes, ['Forma de terreno']);
    $topography = tokko_find_custom_attribute($customAttributes, ['Topografía', 'Topografia']);
    $landUse = tokko_find_custom_attribute($customAttributes, ['Uso de suelo']);
    $view = tokko_find_custom_attribute($customAttributes, ['Vista']);
    $subdivision = tokko_find_custom_attribute($customAttributes, ['Fraccionamiento', 'Condominio']);
    $frontCount = tokko_find_custom_attribute($customAttributes, ['Numero de frentes', 'Número de frentes']);
    $customFront = tokko_find_custom_attribute($customAttributes, ['Metros de frente']);
    $customDepth = tokko_find_custom_attribute($customAttributes, ['Metros de fondo']);
    $cos = tokko_find_custom_attribute($customAttributes, ['COS']);
    $cus = tokko_find_custom_attribute($customAttributes, ['CUS']);
    $customPriceM2 = tokko_find_custom_attribute($customAttributes, ['Precio x m²', 'Precio x m2', 'Precio por m²', 'Precio por m2']);
    $customMaintenance = tokko_find_custom_attribute($customAttributes, ['Cuota de mantenimiento', 'Mantenimiento']);

    $tagGroups = tokko_merge_tag_groups(tokko_extract_tag_groups($item), tokko_extract_tag_groups($source));
    $publicBrand = tokko_public_brand_info($item, $source);
    $sourceBranchName = tokko_extract_branch_name($source, $item);

    return array_filter([
        'public_brand' => $publicBrand['key'] ?? 'unknown',
        'public_brand_name' => $publicBrand['name'] ?? null,
        'source_branch_name' => $sourceBranchName,
        'is_development' => $isDevelopment,
        'full_location' => $source['location']['full_location'] ?? $item['location']['full_location'] ?? null,
        'short_location' => $source['location']['short_location'] ?? $item['location']['short_location'] ?? null,
        'published_address' => tokko_extract_address($item, $source),
        'display_location' => tokko_build_display_location($item, $source),
        'custom_attributes' => $customAttributes ?: null,
        'tag_groups' => $tagGroups,
        'land_shape' => tokko_clean_detail_scalar($landShape, true),
        'topography' => tokko_clean_detail_scalar($topography, true),
        'land_use' => tokko_clean_detail_scalar($landUse, true),
        'view' => tokko_clean_detail_scalar($view, true),
        'subdivision' => tokko_clean_detail_scalar($subdivision, true),
        'front_count' => tokko_clean_detail_scalar($frontCount, true),
        'custom_front_measure' => tokko_clean_detail_scalar($customFront, true),
        'custom_depth_measure' => tokko_clean_detail_scalar($customDepth, true),
        'cos' => tokko_clean_detail_scalar($cos, false),
        'cus' => tokko_clean_detail_scalar($cus, false),
        'custom_price_per_m2' => tokko_clean_detail_scalar($customPriceM2, true),
        'custom_maintenance' => tokko_clean_detail_scalar($customMaintenance, true),
        'zip_code' => $source['location']['zip_code'] ?? $item['location']['zip_code'] ?? null,
        'geo_lat' => $source['location']['geo_lat'] ?? $source['geo_lat'] ?? $item['location']['geo_lat'] ?? $item['geo_lat'] ?? null,
        'geo_long' => $source['location']['geo_long'] ?? $source['geo_long'] ?? $item['location']['geo_long'] ?? $item['geo_long'] ?? null,
        'expenses' => $item['expenses'] ?? $source['expenses'] ?? $item['common_expenses'] ?? $source['common_expenses'] ?? null,
        'maintenance' => $item['maintenance'] ?? $source['maintenance'] ?? $item['maintenance_fee'] ?? $source['maintenance_fee'] ?? $customMaintenance ?? null,
        'parking_lot_amount' => $item['parking_lot_amount'] ?? $source['parking_lot_amount'] ?? null,
        'covered_parking_lot' => $item['covered_parking_lot'] ?? $source['covered_parking_lot'] ?? null,
        'front_measure' => $item['front_measure'] ?? $source['front_measure'] ?? $customFront ?? null,
        'depth_measure' => $item['depth_measure'] ?? $source['depth_measure'] ?? $customDepth ?? null,
        'lot_number' => $item['lot_number'] ?? $source['lot_number'] ?? null,
        'floor' => $item['floor'] ?? $source['floor'] ?? null,
        'roofed_surface' => $item['roofed_surface'] ?? $source['roofed_surface'] ?? null,
        'total_surface' => $item['total_surface'] ?? $source['total_surface'] ?? null,
        'unroofed_surface' => $item['unroofed_surface'] ?? $source['unroofed_surface'] ?? null,
        'private_area' => $item['private_area'] ?? $source['private_area'] ?? null,
        'surface_measurement' => $item['surface_measurement'] ?? $source['surface_measurement'] ?? null,
        'land_length' => $item['land_length'] ?? $source['land_length'] ?? null,
        'land_width' => $item['land_width'] ?? $source['land_width'] ?? null,
        'public_services' => $item['public_services'] ?? $source['public_services'] ?? null,
        'electricity' => $item['electricity'] ?? $source['electricity'] ?? null,
        'water' => $item['water'] ?? $source['water'] ?? null,
        'sewerage' => $item['sewerage'] ?? $source['sewerage'] ?? null,
        'construction_date' => $source['construction_date'] ?? $item['development']['construction_date'] ?? null,
        'construction_status' => tokko_translate_detail_value('construction_status', $source['construction_status'] ?? $item['development']['construction_status'] ?? null),
        'delivery_date' => $item['development']['delivery_date'] ?? $source['delivery_date'] ?? null,
        'property_condition' => tokko_translate_detail_value('property_condition', $item['property_condition'] ?? null),
        'situation' => tokko_translate_detail_value('situation', $item['situation'] ?? null),
        'age' => $item['age'] ?? null,
        'orientation' => tokko_translate_detail_value('orientation', $item['orientation'] ?? $source['orientation'] ?? null),
        'disposition' => tokko_translate_detail_value('disposition', $item['disposition'] ?? $source['disposition'] ?? null),
        'zonification' => $item['zonification'] ?? $source['zonification'] ?? $landUse ?? null,
        'price_per_m2' => $item['price_per_m2'] ?? $source['price_per_m2'] ?? $customPriceM2 ?? null,
        'iptu' => $item['iptu'] ?? $source['iptu'] ?? null,
        'credit_eligible' => tokko_translate_detail_value('credit_eligible', $item['credit_eligible'] ?? $source['credit_eligible'] ?? null),
        'public_url' => $item['public_url'] ?? $source['public_url'] ?? $source['web_url'] ?? null,
        'unit_amount' => $item['unit_amount'] ?? $source['unit_amount'] ?? $item['development']['unit_amount'] ?? null,
        'floors_amount' => $item['floors_amount'] ?? $source['floors_amount'] ?? $item['development']['floors_amount'] ?? null,
        'available_units' => $item['available_units'] ?? $source['available_units'] ?? $item['development']['available_units'] ?? null,
        'branch' => [
            'name' => $source['branch']['name'] ?? $item['branch']['name'] ?? null,
            'email' => $source['branch']['email'] ?? $item['branch']['email'] ?? null,
            'phone' => $source['branch']['phone'] ?? $item['branch']['phone'] ?? null,
            'address' => $source['branch']['address'] ?? $item['branch']['address'] ?? null,
            'contact_time' => $source['branch']['contact_time'] ?? $item['branch']['contact_time'] ?? null,
        ],
    ], static fn ($value) => $value !== null && $value !== '' && $value !== []);
}
