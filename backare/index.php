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
        // Ensure branch_name column exists before querying (safe no-op if already present)
        ensure_property_columns();

        $city          = $_GET['city'] ?? null;
        $operation     = $_GET['operation_type'] ?? null;
        $kind          = $_GET['listing_kind'] ?? null;
        $property_type = $_GET['property_type'] ?? null;
        $rawLimit      = $_GET['limit'] ?? null;
        $returnAll     = $rawLimit === null || $rawLimit === '' || strtolower((string)$rawLimit) === 'all';

        $where  = [];
        $params = [];

        // Exclude properties/developments published by "ARE Homes" branch
        // Uses branch_name column when populated; falls back to details_json for rows not yet re-synced
        $where[] = "(
            (branch_name IS NOT NULL AND LOWER(branch_name) NOT LIKE '%are homes%')
            OR
            (branch_name IS NULL AND (details_json IS NULL OR LOWER(details_json) NOT LIKE '%\"name\":\"are homes%'))
        )";

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
        } else {
            // Units are only fetched through /properties/{id}/units, not the main list
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

        // ── Send response to client immediately, then sync in background ────
        $responseBody = (string)json_encode([
            'success' => true,
            'data'    => $rows,
            'meta'    => ['total' => $total, 'page' => $page, 'limit' => $limit, 'totalPages' => (int)ceil($total / $limit)],
        ]);
        http_response_code(200);
        header('Content-Type: application/json');
        header('Content-Length: ' . strlen($responseBody));
        echo $responseBody;

        // Flush to client NOW (works with FastCGI/PHP-FPM and classic mod_php)
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            if (ob_get_level()) {
                ob_end_flush();
            }
            flush();
        }

        // Background: run auto-sync AFTER the user already has the data
        ignore_user_abort(true);
        tokko_auto_sync();
        exit;
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
        $stmt = db()->prepare("SELECT * FROM properties WHERE parent_tokko_id = :ptid ORDER BY price ASC, title ASC");
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
        // Reset the auto-sync timer so the next automatic run is 15 minutes from now
        $stampFile = __DIR__ . '/logs/last_sync.stamp';
        @file_put_contents($stampFile, 'v4|' . time(), LOCK_EX);
        respond(200, ['success' => true, 'data' => $result]);
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

        // Propiedades visibles al publico (listing_kind='property', sin sucursal ARE Homes)
        $publicFilter = "listing_kind = 'property' AND (details_json IS NULL OR LOWER(details_json) NOT LIKE '%\"name\":\"are homes%')";

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

        $totalDevelopments = (int)db()->query("
            SELECT COUNT(*) FROM properties WHERE listing_kind = 'development'
        ")->fetchColumn();

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
