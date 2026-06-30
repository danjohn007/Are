<?php

declare(strict_types=1);

function app_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/../config/config.php';
    }
    return $cfg;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? sanitize_array($decoded) : [];
}

function sanitize_array(array $data): array
{
    $result = [];
    foreach ($data as $key => $value) {
        if (is_array($value)) {
            $result[$key] = sanitize_array($value);
        } elseif (is_string($value)) {
            $result[$key] = trim(strip_tags($value));
        } else {
            $result[$key] = $value;
        }
    }
    return $result;
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}

function not_found(): void
{
    respond(404, ['success' => false, 'message' => 'Route not found']);
}

function parse_path(): string
{
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $pos = strpos($uri, '/api/');
    if ($pos === false) {
        return '/';
    }
    return '/' . ltrim(substr($uri, $pos + 5), '/');
}

function pagination(): array
{
    $page = max((int)($_GET['page'] ?? 1), 1);
    $limit = (int)($_GET['limit'] ?? 10);
    $limit = max(min($limit, 100), 1);
    $offset = ($page - 1) * $limit;
    return [$page, $limit, $offset];
}

function log_error(Throwable $e): void
{
    $line = sprintf("[%s] %s in %s:%d\n%s\n\n", date('c'), $e->getMessage(), $e->getFile(), $e->getLine(), $e->getTraceAsString());
    file_put_contents(__DIR__ . '/../logs/error.log', $line, FILE_APPEND);
}

function log_info(string $message, array $context = []): void
{
    $payload = [
        'time' => date('c'),
        'message' => $message,
        'context' => $context,
    ];
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    @file_put_contents($logDir . '/app.log', json_encode($payload) . PHP_EOL, FILE_APPEND);
}

function decode_json_field(mixed $value, array $fallback = []): array
{
    if (is_array($value)) {
        return $value;
    }
    if (!is_string($value) || $value === '') {
        return $fallback;
    }

    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function public_text_value(mixed $value): string
{
    if ($value === null || $value === false) {
        return '';
    }

    if (is_array($value) || is_object($value)) {
        return '';
    }

    $text = trim((string)$value);
    return preg_replace('/\s+/u', ' ', $text) ?: $text;
}

function build_property_display_location(array $row): string
{
    $details = is_array($row['details'] ?? null) ? $row['details'] : [];
    $fromDetails = public_text_value($details['display_location'] ?? null);
    if ($fromDetails !== '') {
        return $fromDetails;
    }

    $address = public_text_value($row['address'] ?? $details['published_address'] ?? null);
    $location = public_text_value($row['location_full'] ?? $details['full_location'] ?? $row['city'] ?? null);

    if ($address !== '' && $location !== '' && stripos($location, $address) === false) {
        return $address . ' | ' . $location;
    }

    return $location !== '' ? $location : $address;
}

function normalize_property_row(array $row): array
{
    $row['photos'] = decode_json_field($row['photos_json'] ?? null, []);
    $row['tags'] = decode_json_field($row['tags_json'] ?? null, []);
    $row['videos'] = decode_json_field($row['videos_json'] ?? null, []);
    $row['files'] = decode_json_field($row['files_json'] ?? null, []);
    $row['details'] = decode_json_field($row['details_json'] ?? null, []);

    if (!$row['photos'] && !empty($row['image_url'])) {
        $row['photos'] = [[
            'image' => $row['image_url'],
            'thumb' => $row['image_url'],
            'original' => $row['image_url'],
            'description' => null,
            'is_front_cover' => true,
            'order' => 0,
        ]];
    }

    $row['display_location'] = build_property_display_location($row);

    unset($row['photos_json'], $row['tags_json'], $row['videos_json'], $row['files_json'], $row['details_json']);

    return $row;
}
