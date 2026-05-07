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

    // Index on listing_kind + branch_name for fast filtering
    try {
        $pdo->exec('ALTER TABLE properties ADD INDEX idx_listing_kind (listing_kind), ADD INDEX idx_branch_name (branch_name)');
    } catch (\Throwable) {
        // Indexes already exist — ignore
    }

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

function tokko_sync(): array
{
    // Translations make HTTP calls — give PHP unlimited time on shared hosting.
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
            description = VALUES(description),
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

            // Also store the unit as its own row so it can be listed under the development
            $uPhotos = tokko_extract_photos($item);
            $uDescription = tokko_extract_description($item, $item);
            if (!empty($uDescription) && tokko_is_english($uDescription)) {
                $uDescTranslated = tokko_translate_to_spanish($uDescription);
                if (!empty($uDescTranslated)) {
                    $uDescription = $uDescTranslated;
                }
            }
            $unitRows[] = [
                ':tokko_id'        => 'property:' . $rawId,
                ':title'           => $item['publication_title'] ?? $item['title'] ?? $item['name'] ?? 'Unidad',
                ':description'     => $uDescription,
                ':price'           => tokko_extract_price($item),
                ':address'         => $item['real_address'] ?? $item['address'] ?? '',
                ':city'            => $item['location']['name'] ?? $item['address_short'] ?? '',
                ':bedrooms'        => (int)($item['room_amount'] ?? $item['suite_amount'] ?? 0),
                ':bathrooms'       => (int)($item['bathroom_amount'] ?? 0),
                ':area'            => (float)($item['surface'] ?? $item['roofed_surface'] ?? $item['total_surface'] ?? 0),
                ':image_url'       => $uPhotos[0]['image'] ?? $item['photo'] ?? '',
                ':photos_json'     => json_encode($uPhotos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':tags_json'       => json_encode(tokko_extract_tags($item), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':videos_json'     => json_encode(array_values(is_array($item['videos'] ?? null) ? $item['videos'] : []), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':files_json'      => json_encode(array_values(is_array($item['files'] ?? null) ? $item['files'] : []), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':details_json'    => json_encode(tokko_extract_details($item, $item, false), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':operation_type'  => tokko_extract_operation_type($item),
                ':listing_kind'    => 'unit',
                ':property_type'   => tokko_translate_property_type($item['type']['name'] ?? ''),
                ':reference_code'  => $item['reference_code'] ?? null,
                ':location_full'   => $item['location']['full_location'] ?? null,
                ':parent_tokko_id' => 'development:' . $devId,
                ':branch_name'     => $item['branch']['name'] ?? null,
            ];

            continue; // don't insert this unit as a standalone property
        }

        // ── Standalone property ──
        $source      = $item;
        $photos      = tokko_extract_photos($source);
        $tags        = tokko_extract_tags($source);
        $videos      = array_values(is_array($source['videos'] ?? null) ? $source['videos'] : []);
        $files       = array_values(is_array($source['files'] ?? null) ? $source['files'] : []);
        $description = tokko_extract_description($item, $source);
        $publicUrl   = $item['public_url'] ?? $source['public_url'] ?? $source['web_url'] ?? null;
        if (strlen($description) < 200 && is_string($publicUrl) && $publicUrl !== '') {
            $fromPage = tokko_fetch_public_description($publicUrl);
            if (strlen($fromPage) > strlen($description)) {
                $description = $fromPage;
            }
        }
        if (!empty($description) && tokko_is_english($description)) {
            $translated = tokko_translate_to_spanish($description);
            if (!empty($translated)) {
                $description = $translated;
            }
        }

        $stmt->execute([
            ':tokko_id'       => 'property:' . $rawId,
            ':title'          => $source['publication_title'] ?? $source['title'] ?? $source['name'] ?? 'Property',
            ':description'    => $description,
            ':price'          => tokko_extract_price($item),
            ':address'        => $source['real_address'] ?? $source['address'] ?? $item['real_address'] ?? $item['address'] ?? '',
            ':city'           => $source['location']['name'] ?? $item['location']['name'] ?? $item['address_short'] ?? '',
            ':bedrooms'       => (int)($source['room_amount'] ?? $source['suite_amount'] ?? $item['room_amount'] ?? 0),
            ':bathrooms'      => (int)($source['bathroom_amount'] ?? $item['bathroom_amount'] ?? 0),
            ':area'           => (float)($source['surface'] ?? $source['roofed_surface'] ?? $source['total_surface'] ?? $item['surface'] ?? 0),
            ':image_url'      => $photos[0]['image'] ?? $source['photo'] ?? $item['photo'] ?? '',
            ':photos_json'    => json_encode($photos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':tags_json'      => json_encode($tags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':videos_json'    => json_encode($videos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':files_json'     => json_encode($files, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':details_json'   => json_encode(tokko_extract_details($item, $source, false), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':operation_type' => tokko_extract_operation_type($item),
            ':listing_kind'   => 'property',
            ':property_type'  => tokko_translate_property_type($source['type']['name'] ?? $item['type']['name'] ?? ''),
            ':reference_code' => $source['reference_code'] ?? $item['reference_code'] ?? null,
            ':location_full'   => $source['location']['full_location'] ?? $item['location']['full_location'] ?? null,
            ':parent_tokko_id' => null,
            ':branch_name'    => $source['branch']['name'] ?? $item['branch']['name'] ?? null,
        ]);
        $seenPropertyIds[] = 'property:' . $rawId;
        $synced++;
    }

    // ── STEP 2: Enrich devMap with the development endpoint ───────────────────
    // /api/v1/development/ has richer metadata (photos, description, tags) but
    // no unit counts. Use it to enrich entries already found via the property
    // endpoint, and also add any dev that ONLY exists in this endpoint.
    if ($devUrl) {
        $devItems = tokko_fetch_items($devUrl, $cfg['api_key']);
        if ($devItems !== null) {
            $devEndpointFetched = true;
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

        $photos = tokko_extract_photos($source);
        if (empty($photos)) {
            $photos = tokko_extract_photos($item);
        }
        $videos      = array_values(is_array($source['videos'] ?? null) ? $source['videos'] : []);
        $files       = array_values(is_array($source['files'] ?? null) ? $source['files'] : []);
        $description = tokko_extract_description($item, $source);
        $publicUrl   = $item['public_url'] ?? $source['public_url'] ?? $source['web_url'] ?? null;
        if (strlen($description) < 200 && is_string($publicUrl) && $publicUrl !== '') {
            $fromPage = tokko_fetch_public_description($publicUrl);
            if (strlen($fromPage) > strlen($description)) {
                $description = $fromPage;
            }
        }
        if (!empty($description) && tokko_is_english($description)) {
            $translated = tokko_translate_to_spanish($description);
            if (!empty($translated)) {
                $description = $translated;
            }
        }

        $details = tokko_extract_details($item, $source, true);
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
            ':price'          => tokko_extract_price($item),
            ':address'        => $source['real_address'] ?? $source['address'] ?? $item['real_address'] ?? $item['address'] ?? '',
            ':city'           => $source['location']['name'] ?? $item['location']['name'] ?? '',
            ':bedrooms'       => (int)($source['room_amount'] ?? $item['room_amount'] ?? 0),
            ':bathrooms'      => (int)($source['bathroom_amount'] ?? $item['bathroom_amount'] ?? 0),
            ':area'           => (float)($source['surface'] ?? $source['roofed_surface'] ?? $source['total_surface'] ?? $item['surface'] ?? 0),
            ':image_url'      => $photos[0]['image'] ?? $source['photo'] ?? $item['photo'] ?? '',
            ':photos_json'    => json_encode($photos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':tags_json'      => json_encode($tags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':videos_json'    => json_encode($videos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':files_json'     => json_encode($files, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':details_json'   => json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':operation_type' => tokko_extract_operation_type($item),
            ':listing_kind'   => 'development',
            ':property_type'  => tokko_translate_property_type($source['type']['name'] ?? $item['type']['name'] ?? ''),
            ':reference_code' => $source['reference_code'] ?? $item['reference_code'] ?? null,
            ':location_full'  => $source['location']['full_location'] ?? $item['location']['full_location'] ?? null,
            ':parent_tokko_id' => null,
            ':branch_name'    => $source['branch']['name'] ?? $item['branch']['name'] ?? null,
        ]);
        $seenDevTokkoIds[] = $devTokkoId;
        $synced++;
    }

    // Upsert units
    foreach ($unitRows as $row) {
        $stmt->execute($row);
        $seenUnitTokkoIds[] = $row[':tokko_id'];
    }

    // Remove developments/units deleted from Tokko (preserving DB ids for survivors)
    if ($devEndpointFetched || !empty($devMap)) {
        if (!empty($seenDevTokkoIds)) {
            $ph = implode(',', array_fill(0, count($seenDevTokkoIds), '?'));
            $pdo->prepare("DELETE FROM properties WHERE listing_kind = 'development' AND tokko_id NOT IN ($ph)")
                ->execute($seenDevTokkoIds);
        } else {
            $pdo->exec("DELETE FROM properties WHERE listing_kind = 'development'");
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

    $result = ['synced' => $synced, 'skipped' => false, 'developments' => count($devMap)];
    if ($errors) {
        $result['errors'] = $errors;
    }

    return $result;
}

function tokko_fetch_items(string $baseUrl, string $apiKey): ?array
{
    $items = [];
    $offset = 0;
    $limit = 50;

    while (true) {
        $separator = str_contains($baseUrl, '?') ? '&' : '?';
        $url = $baseUrl . $separator . http_build_query([
            'key' => $apiKey,
            'limit' => $limit,
            'offset' => $offset,
        ]);

        $json = @file_get_contents($url);
        if (!$json) {
            return $offset === 0 ? null : $items;
        }

        $payload = json_decode($json, true);
        if (!is_array($payload)) {
            return $offset === 0 ? null : $items;
        }

        $pageItems = $payload['objects'] ?? $payload['results'] ?? [];
        if (!is_array($pageItems)) {
            return $offset === 0 ? null : $items;
        }

        $items = array_merge($items, $pageItems);

        $meta = is_array($payload['meta'] ?? null) ? $payload['meta'] : [];
        $next = $meta['next'] ?? null;
        $totalCount = isset($meta['total_count']) ? (int)$meta['total_count'] : null;

        if (!$next) {
            break;
        }

        $offset += count($pageItems);

        if ($totalCount !== null && $offset >= $totalCount) {
            break;
        }

        if (count($pageItems) === 0) {
            break;
        }
    }

    return $items;
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
    $codeVersion = 'v7';

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

    // Write stamp BEFORE running so concurrent requests don't pile up
    @file_put_contents($stampFile, $codeVersion . '|' . time(), LOCK_EX);

    try {
        tokko_sync();
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

function tokko_extract_description(array $item, array $source): string
{
    $candidates = [
        $item['development']['description_only'] ?? null,
        $item['development']['rich_description'] ?? null,
        $item['development']['description'] ?? null,
        $item['development']['description_short'] ?? null,
        $item['development']['observations'] ?? null,
        $item['development']['notes'] ?? null,
        $item['development']['comments'] ?? null,
        $source['description_only'] ?? null,
        $source['rich_description'] ?? null,
        $source['description'] ?? null,
        $source['description_short'] ?? null,
        $source['observations'] ?? null,
        $source['notes'] ?? null,
        $source['comments'] ?? null,
        $item['description_only'] ?? null,
        $item['rich_description'] ?? null,
        $item['description'] ?? null,
        $item['description_short'] ?? null,
        $item['observations'] ?? null,
        $item['notes'] ?? null,
        $item['comments'] ?? null,
    ];

    // Placeholder-like phrases used by some agencies instead of a real description
    $placeholders = ['yes we are', 'are real estate', 'are inmobiliaria', 'sin descripcion', 'sin descripción'];

    $best = '';
    foreach ($candidates as $value) {
        if (!is_string($value)) {
            continue;
        }

        $normalized = tokko_html_to_text($value);
        if ($normalized === '') {
            continue;
        }

        $lower = strtolower($normalized);
        $isPlaceholder = false;
        foreach ($placeholders as $placeholder) {
            if (trim($lower) === $placeholder) {
                $isPlaceholder = true;
                break;
            }
        }
        if ($isPlaceholder) {
            continue;
        }

        if (strlen($normalized) > strlen($best)) {
            $best = $normalized;
        }
    }

    return $best;
}

function tokko_fetch_public_description(string $publicUrl): string
{
    static $cache = [];

    if (isset($cache[$publicUrl])) {
        return $cache[$publicUrl];
    }

    $ctx = stream_context_create(['http' => [
        'timeout' => 8,
        'header' => "User-Agent: Mozilla/5.0 (compatible; PropertyBot/1.0)\r\n",
    ]]);
    $html = @file_get_contents($publicUrl, false, $ctx);
    if (!is_string($html) || $html === '') {
        $cache[$publicUrl] = '';
        return '';
    }

    // 1. Try <meta name="description"> first — most reliable
    if (preg_match('/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{20,})["\'][^>]*>/i', $html, $m)) {
        $desc = trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($desc !== '') {
            $cache[$publicUrl] = $desc;
            return $desc;
        }
    }

    // 2. Try og:description
    if (preg_match('/<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']{20,})["\'][^>]*>/i', $html, $m)) {
        $desc = trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($desc !== '') {
            $cache[$publicUrl] = $desc;
            return $desc;
        }
    }

    // 3. Try text between Descripcion and the next major section heading
    $plain = preg_replace('/\s+/u', ' ', strip_tags($html));
    if (!is_string($plain)) {
        $cache[$publicUrl] = '';
        return '';
    }

    $description = '';
    // Try multiple heading pairs
    $patterns = [
        '/Descripci[oó]n\s+(.*?)\s+(?:Ubicaci[oó]n|Caracter[ií]sticas|Detalles|Amenidades|Contacto)/iu',
        '/Descripci[oó]n\s+(.{40,1500})(?=\s+[A-ZÁÉÍÓÚ]{4,})/u',
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $plain, $matches) === 1) {
            $description = trim((string)$matches[1]);
            break;
        }
    }

    if ($description !== '') {
        $description = str_replace(['Mostrar más', 'Mostrar mas', 'Mostrar menos', 'Ver más', 'Ver mas'], '', $description);
        $description = preg_replace('/\s{2,}/u', ' ', $description) ?: $description;
    }

    $cache[$publicUrl] = trim($description);
    return $cache[$publicUrl];
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
    return $map[$key] ?? tokko_auto_translate($type);
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

function tokko_extract_tags(array $item): array
{
    $tags = $item['tags'] ?? [];
    if (!is_array($tags)) {
        return [];
    }

    $raw = array_values(array_filter(array_map(static function ($tag) {
        if (is_array($tag)) {
            return $tag['name'] ?? null;
        }
        return is_string($tag) ? $tag : null;
    }, $tags)));

    return array_values(array_map('tokko_translate_tag', $raw));
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
    return $map[$key] ?? tokko_auto_translate($tag);
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
    $text = trim($text);
    if ($text === '') {
        return $text;
    }

    // ── Load cache ──────────────────────────────────────────────────────────
    $cacheFile = __DIR__ . '/../data/translation_cache.json';
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        if (file_exists($cacheFile) && is_readable($cacheFile)) {
            $cache = json_decode(file_get_contents($cacheFile), true) ?: [];
        }
    }

    $key = strtolower($text);
    if (isset($cache[$key])) {
        return $cache[$key];
    }

    $translated = null;

    // ── 1. Lingva Translate (Google-backed, no daily limit) ──────────────────
    $lingvaInstances = [
        'https://lingva.ml',
        'https://translate.plausibility.cloud',
    ];
    foreach ($lingvaInstances as $base) {
        $url  = $base . '/api/v1/en/es/' . rawurlencode($text);
        $raw  = tokko_http_get($url, 6);
        if ($raw) {
            $data = json_decode($raw, true);
            $candidate = $data['translation'] ?? null;
            if (
                is_string($candidate)
                && $candidate !== ''
                && stripos($candidate, 'error') === false
                && strtolower(trim($candidate)) !== strtolower($text)
            ) {
                $translated = mb_strtoupper(mb_substr($candidate, 0, 1)) . mb_substr($candidate, 1);
                break;
            }
        }
    }

    // ── 2. MyMemory fallback ─────────────────────────────────────────────────
    if ($translated === null) {
        $url = 'https://api.mymemory.translated.net/get?' . http_build_query([
            'q'        => $text,
            'langpair' => 'en|es',
            'de'       => 'sync@are-inmobiliaria.com',
        ]);
        $raw = tokko_http_get($url, 6);
        if ($raw) {
            $data = json_decode($raw, true);
            $candidate = $data['responseData']['translatedText'] ?? null;
            if (
                is_string($candidate)
                && $candidate !== ''
                && stripos($candidate, 'MYMEMORY WARNING') === false
                && strtolower(trim($candidate)) !== strtolower($text)
            ) {
                $translated = mb_strtoupper(mb_substr($candidate, 0, 1)) . mb_substr($candidate, 1);
            }
        }
    }

    if ($translated === null) {
        return $text; // all APIs failed – do NOT cache
    }

    // ── Persist to cache ─────────────────────────────────────────────────────
    $cache[$key] = $translated;
    $dir = dirname($cacheFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    @file_put_contents(
        $cacheFile,
        json_encode($cache, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
    );

    return $translated;
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

function tokko_extract_details(array $item, array $source, bool $isDevelopment): array
{
    return array_filter([
        'is_development' => $isDevelopment,
        'full_location' => $source['location']['full_location'] ?? $item['location']['full_location'] ?? null,
        'short_location' => $source['location']['short_location'] ?? $item['location']['short_location'] ?? null,
        'zip_code' => $source['location']['zip_code'] ?? $item['location']['zip_code'] ?? null,
        'geo_lat' => $source['location']['geo_lat'] ?? $source['geo_lat'] ?? $item['location']['geo_lat'] ?? $item['geo_lat'] ?? null,
        'geo_long' => $source['location']['geo_long'] ?? $source['geo_long'] ?? $item['location']['geo_long'] ?? $item['geo_long'] ?? null,
        'expenses' => $item['expenses'] ?? $source['expenses'] ?? null,
        'parking_lot_amount' => $item['parking_lot_amount'] ?? $source['parking_lot_amount'] ?? null,
        'covered_parking_lot' => $item['covered_parking_lot'] ?? $source['covered_parking_lot'] ?? null,
        'front_measure' => $item['front_measure'] ?? $source['front_measure'] ?? null,
        'depth_measure' => $item['depth_measure'] ?? $source['depth_measure'] ?? null,
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
        'zonification' => $item['zonification'] ?? $source['zonification'] ?? null,
        'price_per_m2' => $item['price_per_m2'] ?? $source['price_per_m2'] ?? null,
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
