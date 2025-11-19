'use strict';

/**
 *  news-article controller
 */

const crypto = require('crypto');

const { createCoreController } = require('@strapi/strapi').factories;
const { ApplicationError } = require('@strapi/utils').errors;

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

module.exports = createCoreController(
  'api::news-article.news-article',
  ({ strapi }) => ({
    async previewLink(ctx) {
      const { id } = ctx.params;
      if (!id) {
        return ctx.badRequest('Missing entry id.');
      }

      const baseUrl = process.env.FRONTEND_PREVIEW_BASE_URL;
      const secret = process.env.FRONTEND_PREVIEW_SECRET;

      if (!baseUrl || !secret) {
        throw new ApplicationError(
          'Preview is not configured. Please set FRONTEND_PREVIEW_BASE_URL and FRONTEND_PREVIEW_SECRET.'
        );
      }

      const document = await strapi
        .documents('api::news-article.news-article')
        .findOne({
          documentId: id,
        });

      if (!document) {
        return ctx.notFound('News article not found.');
      }

      if (!document.slug) {
        return ctx.badRequest('Slug is required to generate a preview link.');
      }

      const timestamp = Date.now();
      const payload = `${document.slug}:${timestamp}`;

      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const token = `${timestamp}.${signature}`;

      const previewUrl = new URL(`/news/${document.slug}`, baseUrl);
      previewUrl.searchParams.set('preview', '1');
      previewUrl.searchParams.set('token', token);

      if (!document.publishedAt) {
        previewUrl.searchParams.set('status', 'draft');
      }

      ctx.body = {
        url: previewUrl.toString(),
        token,
        expiresAt: timestamp + TOKEN_TTL_MS,
      };
    },
  })
);