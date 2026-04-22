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
    file_put_contents(__DIR__ . '/../logs/app.log', json_encode($payload) . PHP_EOL, FILE_APPEND);
}
