import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// vite.config.js は Strapi 慣習に従い CommonJS で書かれているため、
// 名前付きエクスポート disableAutoTranslate を createRequire 経由で取得する。
const require = createRequire(import.meta.url);
const { disableAutoTranslate } = require('../../src/admin/vite.config.js');

const transform = disableAutoTranslate.transformIndexHtml;

describe('disableAutoTranslate.transformIndexHtml', () => {
  it('属性のない <html> に lang/translate/class を付与する', () => {
    const out = transform('<html><head></head><body></body></html>');
    expect(out).toContain('lang="ja"');
    expect(out).toContain('translate="no"');
    expect(out).toContain('class="notranslate"');
  });

  it('</head> 直前に notranslate メタを挿入する', () => {
    const out = transform('<html><head><title>x</title></head></html>');
    expect(out).toMatch(/<meta name="google" content="notranslate"><\/head>/);
  });

  it('既存 lang を上書きしない（冪等）', () => {
    const out = transform('<html lang="en"><head></head></html>');
    expect(out).toContain('lang="en"');
    expect(out).not.toContain('lang="ja"');
  });

  it('既存 class に notranslate を追加（重複なし）', () => {
    const out = transform('<html class="foo"><head></head></html>');
    expect(out).toContain('class="foo notranslate"');
  });

  it('既に notranslate を含む class はそのまま保持する', () => {
    const out = transform(
      '<html class="foo notranslate bar"><head></head></html>'
    );
    expect(out).toMatch(/class="foo notranslate bar"/);
  });

  it('再適用しても meta タグは 1 回のみ（冪等）', () => {
    const once = transform('<html><head></head></html>');
    const twice = transform(once);
    const matches = twice.match(/name="google"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('既存 translate 属性も保持する', () => {
    const out = transform('<html translate="yes"><head></head></html>');
    expect(out).toContain('translate="yes"');
    expect(out).not.toContain('translate="no"');
  });
});
