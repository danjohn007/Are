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
    $cfg = app_config()['tokko'];
    if (!$cfg['api_key']) {
        return ['synced' => 0, 'skipped' => true];
    }

    $endpoints = [];
    if (!empty($cfg['url'])) {
        $endpoints[] = ['url' => $cfg['url'], 'kind' => 'property'];
    }
    if (!empty($cfg['development_url'])) {
        $endpoints[] = ['url' => $cfg['development_url'], 'kind' => 'development'];
    }

    if (!$endpoints) {
        return ['synced' => 0, 'skipped' => true];
    }

    $pdo = db();
    ensure_property_columns();

    $sql = "
        INSERT INTO properties (
            tokko_id, title, description, price, address, city, bedrooms, bathrooms, area, image_url,
            photos_json, tags_json, videos_json, files_json, details_json,
            operation_type, listing_kind, property_type, reference_code, location_full
        )
        VALUES (
            :tokko_id, :title, :description, :price, :address, :city, :bedrooms, :bathrooms, :area, :image_url,
            :photos_json, :tags_json, :videos_json, :files_json, :details_json,
            :operation_type, :listing_kind, :property_type, :reference_code, :location_full
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
            updated_at = NOW()
    ";

    $stmt = $pdo->prepare($sql);
    $synced = 0;
    $errors = [];

    foreach ($endpoints as $endpoint) {
        $items = tokko_fetch_items($endpoint['url'], $cfg['api_key']);
        if ($items === null) {
            $errors[] = 'Unable to fetch Tokko endpoint: ' . $endpoint['url'];
            continue;
        }

        foreach ($items as $item) {
            // Trust the endpoint source for listing kind to avoid false positives
            // from tags/type text that can misclassify regular properties.
            $isDevelopment = ($endpoint['kind'] === 'development');
            $kind = $isDevelopment ? 'development' : 'property';
            $source = tokko_pick_source($item, $isDevelopment);

            $rawId = (string)($item['id'] ?? '');
            if ($rawId === '') {
                continue;
            }

            $photos = tokko_extract_photos($source);
            $tags = tokko_extract_tags($source);
            $videos = array_values(is_array($source['videos'] ?? null) ? $source['videos'] : []);
            $files = array_values(is_array($source['files'] ?? null) ? $source['files'] : []);
            $description = tokko_extract_description($item, $source);
            $publicUrl = $item['public_url'] ?? $source['public_url'] ?? $source['web_url'] ?? null;
            if ($description === '' && is_string($publicUrl) && $publicUrl !== '') {
                $description = tokko_fetch_public_description($publicUrl);
            }

            $stmt->execute([
                ':tokko_id' => $kind . ':' . $rawId,
                ':title' => $source['publication_title'] ?? $source['title'] ?? $source['name'] ?? $item['publication_title'] ?? 'Property',
                ':description' => $description,
                ':price' => tokko_extract_price($item),
                ':address' => $source['real_address'] ?? $source['address'] ?? $item['real_address'] ?? $item['address'] ?? '',
                ':city' => $source['location']['name'] ?? ($item['location']['name'] ?? $source['location'] ?? $item['location'] ?? $item['address_short'] ?? ''),
                ':bedrooms' => (int)($source['room_amount'] ?? $source['suite_amount'] ?? $item['room_amount'] ?? $item['suite_amount'] ?? 0),
                ':bathrooms' => (int)($source['bathroom_amount'] ?? $item['bathroom_amount'] ?? 0),
                ':area' => (float)($source['surface'] ?? $source['roofed_surface'] ?? $source['total_surface'] ?? $item['surface'] ?? $item['roofed_surface'] ?? $item['total_surface'] ?? 0),
                ':image_url' => $photos[0]['image'] ?? $source['photo'] ?? $item['photo'] ?? '',
                ':photos_json' => json_encode($photos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':tags_json' => json_encode($tags, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':videos_json' => json_encode($videos, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':files_json' => json_encode($files, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':details_json' => json_encode(tokko_extract_details($item, $source, $isDevelopment), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':operation_type' => tokko_extract_operation_type($item),
                ':listing_kind' => $kind,
                ':property_type' => $source['type']['name'] ?? $item['type']['name'] ?? $item['type'] ?? null,
                ':reference_code' => $source['reference_code'] ?? $item['reference_code'] ?? null,
                ':location_full' => $source['location']['full_location'] ?? $item['location']['full_location'] ?? null,
            ]);
            $synced++;
        }
    }

    $result = ['synced' => $synced, 'skipped' => false];
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

function tokko_extract_description(array $item, array $source): string
{
    $candidates = [
        $source['description_only'] ?? null,
        $source['rich_description'] ?? null,
        $source['description'] ?? null,
        $item['description_only'] ?? null,
        $item['rich_description'] ?? null,
        $item['description'] ?? null,
        $item['description_short'] ?? null,
    ];

    foreach ($candidates as $value) {
        if (!is_string($value)) {
            continue;
        }

        $normalized = trim(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($normalized === '') {
            continue;
        }

        $lower = strtolower($normalized);
        if ($lower === 'yes we are' || $lower === 'are real estate') {
            continue;
        }

        return $normalized;
    }

    return '';
}

function tokko_fetch_public_description(string $publicUrl): string
{
    static $cache = [];

    if (isset($cache[$publicUrl])) {
        return $cache[$publicUrl];
    }

    $html = @file_get_contents($publicUrl);
    if (!is_string($html) || $html === '') {
        $cache[$publicUrl] = '';
        return '';
    }

    // Normalize whitespace and extract text between "Descripcion" and "Ubicacion" blocks.
    $plain = preg_replace('/\s+/u', ' ', strip_tags($html));
    if (!is_string($plain) || $plain === '') {
        $cache[$publicUrl] = '';
        return '';
    }

    $description = '';
    if (preg_match('/Descripci[oó]n\s+(.*?)\s+Ubicaci[oó]n/iu', $plain, $matches) === 1) {
        $description = trim((string)$matches[1]);
    }

    if ($description !== '') {
        $description = str_replace([' Mostrar m\u00e1s', ' Mostrar m\u00e1s ', ' Mostrar mas', ' Mostrar menos'], ' ', $description);
        $description = preg_replace('/\s+/u', ' ', $description) ?: $description;
    }

    $cache[$publicUrl] = trim($description);
    return $cache[$publicUrl];
}

function tokko_extract_operation_type(array $item): string
{
    $type = strtolower((string)($item['operations'][0]['operation_type'] ?? $item['operations'][0]['operation_type']['name'] ?? 'venta'));
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

    return array_values(array_filter(array_map(static function ($tag) {
        if (is_array($tag)) {
            return $tag['name'] ?? null;
        }
        return is_string($tag) ? $tag : null;
    }, $tags)));
}

function tokko_extract_details(array $item, array $source, bool $isDevelopment): array
{
    return array_filter([
        'is_development' => $isDevelopment,
        'full_location' => $source['location']['full_location'] ?? $item['location']['full_location'] ?? null,
        'short_location' => $source['location']['short_location'] ?? $item['location']['short_location'] ?? null,
        'zip_code' => $source['location']['zip_code'] ?? $item['location']['zip_code'] ?? null,
        'geo_lat' => $source['geo_lat'] ?? $item['geo_lat'] ?? null,
        'geo_long' => $source['geo_long'] ?? $item['geo_long'] ?? null,
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
        'construction_date' => $source['construction_date'] ?? null,
        'construction_status' => $source['construction_status'] ?? null,
        'property_condition' => $item['property_condition'] ?? null,
        'situation' => $item['situation'] ?? null,
        'age' => $item['age'] ?? null,
        'orientation' => $item['orientation'] ?? $source['orientation'] ?? null,
        'disposition' => $item['disposition'] ?? $source['disposition'] ?? null,
        'zonification' => $item['zonification'] ?? $source['zonification'] ?? null,
        'price_per_m2' => $item['price_per_m2'] ?? $source['price_per_m2'] ?? null,
        'iptu' => $item['iptu'] ?? $source['iptu'] ?? null,
        'credit_eligible' => $item['credit_eligible'] ?? $source['credit_eligible'] ?? null,
        'public_url' => $item['public_url'] ?? $source['public_url'] ?? $source['web_url'] ?? null,
        'branch' => [
            'name' => $source['branch']['name'] ?? $item['branch']['name'] ?? null,
            'email' => $source['branch']['email'] ?? $item['branch']['email'] ?? null,
            'phone' => $source['branch']['phone'] ?? $item['branch']['phone'] ?? null,
            'address' => $source['branch']['address'] ?? $item['branch']['address'] ?? null,
            'contact_time' => $source['branch']['contact_time'] ?? $item['branch']['contact_time'] ?? null,
        ],
    ], static fn ($value) => $value !== null && $value !== '' && $value !== []);
}
