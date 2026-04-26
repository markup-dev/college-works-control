<?php

$frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter([
        $frontend,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ]))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // Иначе браузер не отдаёт кастомные заголовки в Axios/fetch (см. Access-Control-Expose-Headers).
    'exposed_headers' => ['X-Created-Assignment-Id'],

    'max_age' => 0,

    'supports_credentials' => true,

];
