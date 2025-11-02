module.exports = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https://your-cloudflare-worker.workers.dev'],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: [
        'https://loi-no-hako.jp',           // 本番環境のドメイン
        'https://*.loi-no-hako.jp',         // サブドメイン
        'https://your-cloudflare-worker.workers.dev', // Cloudflare Workers URL
        'http://localhost:3000',            // ローカル開発環境
      ],
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'X-Requested-With',
      ],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
