#!/usr/bin/env node
'use strict';

/**
 * strapi build 後に管理画面 HTML へ translate="no" 等を注入する。
 *
 * Why: vite.config.js の transformIndexHtml は strapi develop（Vite dev サーバ）では
 *      動作するが、strapi build のプロダクションビルドではビルド成果物に適用されない
 *      ことが Strapi Cloud で確認された。postbuild フックでビルド後に直接パッチする。
 * 関連: docs/incidents/2026-05-05_admin-removechild-error.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NOTRANSLATE_META = '<meta name="google" content="notranslate">';

function inject(html) {
  let out = html.replace(/<html(\s[^>]*)?>/, (_, attrs = '') => {
    let next = attrs ?? '';
    if (!/\btranslate=/.test(next)) next += ' translate="no"';
    if (!/\bclass=/.test(next)) {
      next += ' class="notranslate"';
    } else {
      next = next.replace(/\bclass="([^"]*)"/, (__, c) =>
        c.split(/\s+/).includes('notranslate')
          ? `class="${c}"`
          : `class="${c} notranslate"`
      );
    }
    return `<html${next}>`;
  });
  if (!out.includes(NOTRANSLATE_META)) {
    out = out.replace('</head>', `  ${NOTRANSLATE_META}\n  </head>`);
  }
  return out;
}

// strapi build が生成 / 出力するHTMLの候補（Strapi 5.x）
const CANDIDATES = [
  // Strapi が生成するエントリテンプレート（Strapi Cloud で直接配信されるケースあり）
  path.join(ROOT, '.strapi', 'client', 'index.html'),
  // Vite プロダクションビルドの出力先
  path.join(ROOT, 'dist', 'build', 'index.html'),
  path.join(ROOT, 'build', 'index.html'),
];

let patchedCount = 0;

for (const candidate of CANDIDATES) {
  if (!fs.existsSync(candidate)) continue;

  const original = fs.readFileSync(candidate, 'utf-8');
  const modified = inject(original);

  if (modified !== original) {
    fs.writeFileSync(candidate, modified, 'utf-8');
    console.log(`[inject-notranslate] patched   ${path.relative(ROOT, candidate)}`);
    patchedCount++;
  } else {
    console.log(`[inject-notranslate] already ok ${path.relative(ROOT, candidate)}`);
    patchedCount++;
  }
}

if (patchedCount === 0) {
  console.warn(
    '[inject-notranslate] 対象HTMLが見つかりません。先に strapi build を実行してください。'
  );
  console.warn('[inject-notranslate] candidates:', CANDIDATES.map(c => path.relative(ROOT, c)));
}
