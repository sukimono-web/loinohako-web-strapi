'use strict';

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    // slugが未設定、またはデフォルト値の場合
    if (!data.slug || data.slug === 'news-article') {
      try {
        // 既存の記事を取得して最大番号を確認
        const existingArticles = await strapi.db.query('api::news-article.news-article').findMany({
          select: ['slug'],
          orderBy: { id: 'desc' },
          limit: 1000,
        });

        let maxNumber = 0;
        existingArticles.forEach(article => {
          if (article.slug) {
            const match = article.slug.match(/news-article-(\d+)$/);
            if (match) {
              const number = parseInt(match[1], 10);
              if (number > maxNumber) {
                maxNumber = number;
              }
            }
          }
        });

        data.slug = `news-article-${maxNumber + 1}`;
      } catch (error) {
        console.error('[Lifecycle] Error generating slug:', error);
        data.slug = `news-article-${Date.now()}`;
      }
    }
  },

  async beforeUpdate(event) {
    const { data } = event.params;

    // 更新時はslugを変更しない。nullや空文字に設定された場合のみ再生成
    if (data.slug === null || data.slug === '' || data.slug === 'news-article') {
      try {
        const existingArticles = await strapi.db.query('api::news-article.news-article').findMany({
          select: ['slug'],
          orderBy: { id: 'desc' },
          limit: 1000,
        });

        let maxNumber = 0;
        existingArticles.forEach(article => {
          if (article.slug) {
            const match = article.slug.match(/news-article-(\d+)$/);
            if (match) {
              const number = parseInt(match[1], 10);
              if (number > maxNumber) {
                maxNumber = number;
              }
            }
          }
        });

        data.slug = `news-article-${maxNumber + 1}`;
      } catch (error) {
        console.error('[Lifecycle] Error updating slug:', error);
        data.slug = `news-article-${Date.now()}`;
      }
    }
  },
};
