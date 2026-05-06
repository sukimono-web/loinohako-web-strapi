const { mergeConfig } = require('vite');

// 管理画面の <html> と <head> にブラウザ自動翻訳のオプトアウト宣言を静的注入する。
// Why: 自動翻訳エンジンによる DOM 改変が React の reconciliation と衝突し、
//      DatePicker などの Portal 操作で removeChild が失敗する事象への対策。
// 関連: docs/incidents/2026-05-05_admin-removechild-error.md
const NOTRANSLATE_META_RE =
  /<meta\s+name=["']google["']\s+content=["']notranslate["']/i;

const disableAutoTranslate = {
  name: 'disable-auto-translate',
  transformIndexHtml(html) {
    let result = html.replace(/<html(\s[^>]*)?>/, (_, attrs = '') => {
      let next = attrs ?? '';
      if (!/\blang=/.test(next)) next += ' lang="ja"';
      if (!/\btranslate=/.test(next)) next += ' translate="no"';
      if (!/\bclass=/.test(next)) {
        next += ' class="notranslate"';
      } else {
        next = next.replace(/\bclass="([^"]*)"/, (_m, c) =>
          c.split(/\s+/).includes('notranslate')
            ? `class="${c}"`
            : `class="${c} notranslate"`
        );
      }
      return `<html${next}>`;
    });

    if (!NOTRANSLATE_META_RE.test(result)) {
      result = result.replace(
        /<\/head>/,
        '<meta name="google" content="notranslate"></head>'
      );
    }

    return result;
  },
};

module.exports = (config) =>
  mergeConfig(config, {
    plugins: [disableAutoTranslate],
  });

module.exports.disableAutoTranslate = disableAutoTranslate;
