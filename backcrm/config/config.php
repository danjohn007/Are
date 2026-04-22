<?php

declare(strict_types=1);

return [
    'db' => [
        'driver' => 'mysql',
        'host' => 'localhost',
        'port' => 3306,
        'dbname' => 'idactivo_are',
        'user' => 'idactivo_userare',
        'password' => 'Danjonh007'
    ],
    'app' => [
        'cors_origin' => '*',
        'debug' => true,
        'log_requests' => true,
        'access_secret' => 'replace_access_secret_in_production',
        'refresh_secret' => 'replace_refresh_secret_in_production',
        'access_ttl' => 900,
        'refresh_ttl' => 604800,
        'aes_key' => 'replace_aes_secret_in_production',
        'rate_limit_max' => 200,
        'rate_limit_window' => 900,
        'mail_to' => 'admin@portal.com',
        'twilio_sid' => '',
        'twilio_token' => '',
        'twilio_from' => ''
    ],
    'tokko' => [
        'url' => '',
        'api_key' => ''
    ]
];
