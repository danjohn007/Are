<?php

declare(strict_types=1);

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

    // ─── Upload de imagen ────────────────────────────────────────────────────
    if ($path === '/upload' && $method === 'POST') {
        require_auth();
        if (empty($_FILES['image'])) {
            respond(400, ['success' => false, 'message' => 'No se recibió ningún archivo']);
        }
        $file    = $_FILES['image'];
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($file['type'], $allowed, true)) {
            respond(400, ['success' => false, 'message' => 'Tipo de archivo no permitido. Use JPG, PNG, WEBP o GIF.']);
        }
        if ($file['size'] > 5 * 1024 * 1024) {
            respond(400, ['success' => false, 'message' => 'El archivo excede el tamaño máximo de 5MB']);
        }
        $ext       = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $filename  = uniqid('img_', true) . '.' . $ext;
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
        respond(200, ['success' => true, 'data' => ['url' => $url]]);
    }

    // ─── Servicios ───────────────────────────────────────────────────────────
    if ($path === '/services' && $method === 'GET') {
        [$page, $limit, $offset] = pagination();
        $rows = db()->prepare('SELECT * FROM services ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
        $rows->bindValue(':limit', $limit, PDO::PARAM_INT);
        $rows->bindValue(':offset', $offset, PDO::PARAM_INT);
        $rows->execute();
        $total = (int)db()->query('SELECT COUNT(*) FROM services')->fetchColumn();
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
        if (empty($input['name']) || empty($input['slug']) || !isset($input['price'])) {
            respond(422, ['success' => false, 'message' => 'name, slug y price son requeridos']);
        }
        $stmt = db()->prepare('INSERT INTO services (name, slug, description, price, form_schema) VALUES (:name, :slug, :description, :price, :form_schema)');
        $stmt->execute([
            ':name'        => $input['name'],
            ':slug'        => $input['slug'],
            ':description' => $input['description'] ?? null,
            ':price'       => (float)$input['price'],
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
        $stmt = db()->prepare('UPDATE services SET name=:name, slug=:slug, description=:description, price=:price, form_schema=:form_schema, updated_at=NOW() WHERE id=:id');
        $stmt->execute([
            ':name'        => $input['name'] ?? '',
            ':slug'        => $input['slug'] ?? '',
            ':description' => $input['description'] ?? null,
            ':price'       => (float)($input['price'] ?? 0),
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

        send_whatsapp($input['phone'], 'Hola ' . $lead['name'] . ', recibimos tu solicitud. Te contactaremos pronto. — ARE');

        $lead['email'] = $input['email'];
        $lead['phone'] = $input['phone'];
        respond(201, ['success' => true, 'data' => $lead]);
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
        $city      = $_GET['city'] ?? null;
        $operation = $_GET['operation_type'] ?? null;
        $kind      = $_GET['listing_kind'] ?? null;
        $rawLimit  = $_GET['limit'] ?? null;
        $returnAll = $rawLimit === null || $rawLimit === '' || strtolower((string)$rawLimit) === 'all';

        $where  = [];
        $params = [];
        if ($city) {
            $where[]              = 'city LIKE :city';
            $params[':city']      = '%' . $city . '%';
        }
        if ($operation) {
            $where[]                   = 'operation_type = :operation_type';
            $params[':operation_type'] = $operation;
        }
        if ($kind) {
            $where[]               = 'listing_kind = :listing_kind';
            $params[':listing_kind'] = $kind;
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $count = db()->prepare("SELECT COUNT(*) FROM properties $whereClause");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        if ($returnAll) {
            $page = 1;
            $limit = max($total, 1);
            $offset = 0;
            $stmt = db()->prepare("SELECT * FROM properties $whereClause ORDER BY created_at DESC");
            foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
        } else {
            [$page, $limit, $offset] = pagination();
            $stmt = db()->prepare("SELECT * FROM properties $whereClause ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
            foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        }

        $stmt->execute();

        $rows = array_map('normalize_property_row', $stmt->fetchAll());

        respond(200, ['success' => true, 'data' => $rows, 'meta' => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit)]]);
    }

    if (preg_match('#^/properties/(\d+)$#', $path, $m) && $method === 'GET') {
        $stmt = db()->prepare('SELECT * FROM properties WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => (int)$m[1]]);
        $row = $stmt->fetch();
        if (!$row) { respond(404, ['success' => false, 'message' => 'Propiedad no encontrada']); }
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
        $result = tokko_sync();
        respond(200, ['success' => true, 'data' => $result]);
    }

    // ─── Artículos ───────────────────────────────────────────────────────────
    if ($path === '/articles' && $method === 'GET') {
        [$page, $limit, $offset] = pagination();
        $stmt = db()->prepare('SELECT * FROM articles WHERE published = 1 ORDER BY created_at DESC LIMIT :limit OFFSET :offset');
        $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $total = (int)db()->query('SELECT COUNT(*) FROM articles WHERE published = 1')->fetchColumn();
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
        $stmt = db()->prepare('INSERT INTO articles (title, slug, excerpt, content, image_url, published) VALUES (:title, :slug, :excerpt, :content, :image_url, :published)');
        $stmt->execute([
            ':title'     => $input['title'] ?? '',
            ':slug'      => $input['slug'] ?? '',
            ':excerpt'   => $input['excerpt'] ?? null,
            ':content'   => $input['content'] ?? '',
            ':image_url' => $input['image_url'] ?? null,
            ':published' => isset($input['published']) ? ((bool)$input['published'] ? 1 : 0) : 1,
        ]);
        $id = (int)db()->lastInsertId();
        $fetch = db()->prepare('SELECT * FROM articles WHERE id = :id LIMIT 1');
        $fetch->execute([':id' => $id]);
        respond(201, ['success' => true, 'data' => $fetch->fetch()]);
    }

    if (preg_match('#^/articles/(\d+)$#', $path, $m) && $method === 'PUT') {
        require_admin();
        $input = json_input();
        $stmt = db()->prepare('UPDATE articles SET title=:title, slug=:slug, excerpt=:excerpt, content=:content, image_url=:image_url, published=:published, updated_at=NOW() WHERE id=:id');
        $stmt->execute([
            ':title'     => $input['title'] ?? '',
            ':slug'      => $input['slug'] ?? '',
            ':excerpt'   => $input['excerpt'] ?? null,
            ':content'   => $input['content'] ?? '',
            ':image_url' => $input['image_url'] ?? null,
            ':published' => isset($input['published']) ? ((bool)$input['published'] ? 1 : 0) : 1,
            ':id'        => (int)$m[1],
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
                (SELECT COUNT(*) FROM articles WHERE published=1) AS total_articles
        ")->fetch();

        $byService = db()->query("
            SELECT s.name, COUNT(l.id) AS total
            FROM services s
            LEFT JOIN leads l ON l.service_id = s.id
            GROUP BY s.name
            ORDER BY total DESC
        ")->fetchAll();

        $latest = db()->query("SELECT id, name, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5")->fetchAll();

        respond(200, ['success' => true, 'data' => ['totals' => $totals, 'byService' => $byService, 'latest' => $latest]]);
    }

    not_found();

} catch (Throwable $e) {
    log_error($e);
    respond(500, ['success' => false, 'message' => 'Error interno del servidor', 'debug' => (app_config()['app']['debug'] ?? false) ? $e->getMessage() : null]);
}
