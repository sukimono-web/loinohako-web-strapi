import React from 'react';
import { Eye } from '@strapi/icons';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';

const NewsArticlePreviewButton = ({ model, documentId, document }) => {
  const fetchClient = useFetchClient();
  const { toggleNotification } = useNotification();
  const [isLoading, setIsLoading] = React.useState(false);

  const isNewsArticle = model === 'api::news-article.news-article';
  const slug = document?.slug;
  const isDraft = !document?.publishedAt;

  const isDisabled = !documentId || !slug;

  const onClick = React.useCallback(async () => {
    if (!isNewsArticle || isDisabled) {
      return false;
    }

    setIsLoading(true);
    try {
      const response = await fetchClient.get(`/api/news-articles/${documentId}/preview-link`);
      const previewUrl = response?.data?.url;

      if (!previewUrl) {
        throw new Error('プレビュー URL を取得できませんでした。');
      }

      const target = window.open(previewUrl, '_blank', 'noopener,noreferrer');
      if (!target) {
        toggleNotification({
          type: 'info',
          message: 'ポップアップがブロックされました。ブラウザの設定を確認してください。',
        });
      }
    } catch (error) {
      const message =
        error?.response?.data?.error?.message ??
        error?.message ??
        'プレビューリンクの生成に失敗しました。';
      toggleNotification({
        type: 'warning',
        message,
      });
    } finally {
      setIsLoading(false);
    }

    return false;
  }, [documentId, fetchClient, isDisabled, isNewsArticle, toggleNotification]);

  if (!isNewsArticle) {
    return null;
  }

  return {
    id: 'news-article-preview',
    label: isDraft ? '下書きをプレビュー' : 'プレビュー',
    icon: /*#__PURE__*/ React.createElement(Eye, null),
    variant: 'secondary',
    disabled: isDisabled,
    loading: isLoading,
    position: 'panel',
    onClick,
  };
};

NewsArticlePreviewButton.type = 'news-article-preview';
NewsArticlePreviewButton.position = 'panel';

export default NewsArticlePreviewButton;

