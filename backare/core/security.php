<?php

declare(strict_types=1);

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function jwt_sign(array $payload, string $secret, int $ttlSeconds): string
{
    $now = time();
    $payload['iat'] = $now;
    $payload['exp'] = $now + $ttlSeconds;

    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $h = base64url_encode(json_encode($header));
    $p = base64url_encode(json_encode($payload));
    $sig = hash_hmac('sha256', "$h.$p", $secret, true);
    return "$h.$p." . base64url_encode($sig);
}

function jwt_verify(string $token, string $secret): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$h, $p, $s] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', "$h.$p", $secret, true));
    if (!hash_equals($expected, $s)) {
        return null;
    }

    $payload = json_decode(base64url_decode($p), true);
    if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) {
        return null;
    }

    return $payload;
}

function aes_key(string $secret): string
{
    return hash('sha256', $secret, true);
}

function encrypt_value(?string $text): ?string
{
    if ($text === null || $text === '') {
        return null;
    }
    $secret = app_config()['app']['aes_key'];
    $iv = random_bytes(16);
    $encrypted = openssl_encrypt($text, 'AES-256-CBC', aes_key($secret), OPENSSL_RAW_DATA, $iv);
    if ($encrypted === false) {
        return null;
    }
    return bin2hex($iv) . ':' . bin2hex($encrypted);
}

function decrypt_value(?string $encrypted): ?string
{
    if ($encrypted === null || $encrypted === '') {
        return null;
    }

    $parts = explode(':', $encrypted);
    if (count($parts) !== 2) {
        return null;
    }

    $iv = hex2bin($parts[0]);
    $payload = hex2bin($parts[1]);
    if ($iv === false || $payload === false) {
        return null;
    }

    $secret = app_config()['app']['aes_key'];
    $decrypted = openssl_decrypt($payload, 'AES-256-CBC', aes_key($secret), OPENSSL_RAW_DATA, $iv);
    return $decrypted === false ? null : $decrypted;
}

function apply_security_headers(): void
{
    $origin = app_config()['app']['cors_origin'] ?? '*';
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: no-referrer-when-downgrade');
}

function apply_rate_limit(): void
{
    $max = (int)app_config()['app']['rate_limit_max'];
    $window = (int)app_config()['app']['rate_limit_window'];
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = sys_get_temp_dir() . '/are_rate_limit_' . md5($ip) . '.json';
    $now = time();

    $data = ['count' => 0, 'start' => $now];
    if (is_file($file)) {
        $loaded = json_decode((string)file_get_contents($file), true);
        if (is_array($loaded)) {
            $data = $loaded;
        }
    }

    if (($now - (int)$data['start']) > $window) {
        $data = ['count' => 0, 'start' => $now];
    }

    $data['count'] = (int)$data['count'] + 1;
    file_put_contents($file, json_encode($data));

    if ((int)$data['count'] > $max) {
        respond(429, ['success' => false, 'message' => 'Too many requests']);
    }
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($header, 'Bearer ') !== 0) {
        return null;
    }
    return trim(substr($header, 7));
}

function require_auth(): array
{
    $token = bearer_token();
    if (!$token) {
        respond(401, ['success' => false, 'message' => 'Authentication required']);
    }

    $payload = jwt_verify($token, app_config()['app']['access_secret']);
    if (!$payload) {
        respond(401, ['success' => false, 'message' => 'Invalid token']);
    }

    return $payload;
}

function require_admin(): array
{
    $payload = require_auth();
    if (($payload['role'] ?? '') !== 'admin') {
        respond(403, ['success' => false, 'message' => 'Forbidden']);
    }
    return $payload;
}
