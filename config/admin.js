'use strict';

const crypto = require('crypto');

module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  preview: {
    enabled: true,
    config: {
      allowedOrigins: env('FRONTEND_PREVIEW_BASE_URL'),
      handler: async (uid, { documentId, status: previewStatus }) => {
        if (uid !== 'api::news-article.news-article') {
          return null;
        }

        try {
          const document = await strapi.documents(uid).findOne({ documentId });

          if (!document?.slug) {
            return null;
          }

          const baseUrl = env('FRONTEND_PREVIEW_BASE_URL');
          const secret = env('FRONTEND_PREVIEW_SECRET');

          if (!baseUrl || !secret) {
            return null;
          }

          const timestamp = Date.now();
          const payload = `${document.slug}:${timestamp}`;
          const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
          const token = `${timestamp}.${signature}`;

          const previewUrl = new URL(`/news/${document.slug}`, baseUrl);
          previewUrl.searchParams.set('preview', '1');
          previewUrl.searchParams.set('token', token);

          if (previewStatus === 'draft') {
            previewUrl.searchParams.set('status', 'draft');
          }

          return previewUrl.toString();
        } catch (error) {
          console.error('[Preview] Handler error:', error);
          return null;
        }
      },
    },
  },
});
