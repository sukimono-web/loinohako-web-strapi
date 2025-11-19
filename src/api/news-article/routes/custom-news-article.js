'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/news-articles/:id/preview-link',
      handler: 'news-article.previewLink',
      config: {
        auth: false,
      },
    },
  ],
};


