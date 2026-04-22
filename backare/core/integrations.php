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

function tokko_sync(): array
{
    $cfg = app_config()['tokko'];
    if (!$cfg['url'] || !$cfg['api_key']) {
        return ['synced' => 0, 'skipped' => true];
    }

    $url = $cfg['url'] . '?key=' . urlencode($cfg['api_key']);
    $json = @file_get_contents($url);
    if (!$json) {
        return ['synced' => 0, 'skipped' => false, 'error' => 'Unable to fetch Tokko'];
    }

    $payload = json_decode($json, true);
    $items = $payload['objects'] ?? $payload['results'] ?? [];
    $pdo = db();

    $sql = "
        INSERT INTO properties (tokko_id, title, description, price, address, city, bedrooms, bathrooms, area, image_url)
        VALUES (:tokko_id, :title, :description, :price, :address, :city, :bedrooms, :bathrooms, :area, :image_url)
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
            updated_at = NOW()
    ";

    $stmt = $pdo->prepare($sql);
    $synced = 0;

    foreach ($items as $item) {
        $stmt->execute([
            ':tokko_id' => (string)($item['id'] ?? ''),
            ':title' => $item['publication_title'] ?? $item['title'] ?? 'Property',
            ':description' => $item['description'] ?? '',
            ':price' => (float)($item['operations'][0]['prices'][0]['price'] ?? 0),
            ':address' => $item['address'] ?? '',
            ':city' => $item['location']['name'] ?? ($item['location'] ?? ''),
            ':bedrooms' => (int)($item['room_amount'] ?? 0),
            ':bathrooms' => (int)($item['bathroom_amount'] ?? 0),
            ':area' => (float)($item['surface'] ?? 0),
            ':image_url' => $item['photos'][0]['image'] ?? '',
        ]);
        $synced++;
    }

    return ['synced' => $synced, 'skipped' => false];
}
