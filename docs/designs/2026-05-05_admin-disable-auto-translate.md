# 設計書: 管理画面でのブラウザ自動翻訳の無効化

| 項目 | 内容 |
|------|------|
| 作成日 | 2026-05-05 |
| 最終更新 | 2026-05-06（多角的レビュー反映） |
| 起票者 | ikko.fujimura |
| 関連レポート | `docs/incidents/2026-05-05_admin-removechild-error.md` |
| 対象リポジトリ | `sukimono-web/loinohako-web-strapi` |
| 対象環境 | Strapi Cloud（本番・ステージング・ローカル開発含む） |
| ステータス | レビュー反映済み・対照検証待ち |

---

## 1. 目的

Chrome をはじめとするブラウザの自動翻訳機能が Strapi 管理画面の DOM を改変することで発生する React DOM 操作エラーを **翻訳起因の範囲で根本解消** する。

具体的には、`Node.removeChild` 失敗による管理画面クラッシュ（公開日指定時）について、翻訳機能を原因とするケースを完全に防止する。

> 翻訳以外を真因とするケース（Strapi 5.x 本体のリグレッション等）は本対策のスコープ外とする。それらは関連レポート §4.4「代替仮説」のフォローアップで別途対応する。

---

## 2. 背景

詳細は障害レポート `docs/incidents/2026-05-05_admin-removechild-error.md` を参照。要点：

- Strapi 管理画面はすでに `locales: ['ja']` で日本語表示
- にもかかわらず、Chrome の自動翻訳が ON の環境では翻訳が走り、DOM が改変される
- React 18 の reconciliation と衝突して画面クラッシュする可能性
- 翻訳機能を OFF にすれば回避可能だが、運用者へ依存する暫定策にとどまる
- 多角的レビューにより、翻訳起因と断定する前に対照検証が必要と判明（§7）

---

## 3. 設計方針

### 3.1 採用方針

**Vite の `transformIndexHtml` プラグインで、管理画面 `index.html` のビルド時に `<html>` 属性および `<meta>` 要素を静的注入する。**

具体的には以下 3 点を `<html>` および `<head>` に付与する：

| 場所 | 属性／要素 | 効果 |
|------|-----------|------|
| `<html>` | `lang="ja"` | ページ言語を明示（既に日本語であることを宣言） |
| `<html>` | `translate="no"` および `class="notranslate"` | HTML 標準＋ Google Translate 互換のオプトアウト |
| `<head>` | `<meta name="google" content="notranslate">` | Google Translate に対する明示的オプトアウト |

これにより、Chrome（Google Translate）は当該ページの翻訳を実施しなくなる。Microsoft Edge、Firefox の翻訳拡張、各種ブラウザ拡張機能のうち W3C 標準に従うものに対しても効果がある。

### 3.2 なぜ Vite 静的注入を採用するか（初版からの変更点）

初版では `src/admin/app.js` の `bootstrap()` 内で DOM 操作する案を採用していたが、多角的レビューにより以下の問題が判明したため変更した。

| 観点 | `bootstrap()` 注入（初版案） | `transformIndexHtml` 注入（採用案） |
|------|--------------------------|---------------------------------|
| 注入タイミング | React mount **後** | HTML レスポンス時点（**最早**） |
| Chrome 翻訳評価との競合 | `DOMContentLoaded` 前後の翻訳評価に**間に合わない可能性** | 翻訳エンジンが評価する前に属性が確定済み |
| HMR 時の二重実行 | 冪等性チェック必須 | ビルド成果物の一部となるため不要 |
| Strapi バージョンアップ耐性 | `bootstrap` シグネチャ変更リスク | Vite Plugin API は安定 |

確実性を最優先し、`transformIndexHtml` 方式に統一する。

### 3.3 採用しなかった選択肢

| 案 | 理由 |
|----|------|
| `bootstrap()` 内 DOM 注入のみ | 翻訳評価タイミングに間に合わない可能性（§3.2） |
| `index.html` を直接書き換え | Strapi 5 では admin の HTML が内部生成されるため不安定。バージョンアップで失われる |
| カスタム Strapi プラグインを作成 | オーバースペック。1 ファイル数行で済む対応にプラグイン構造は不要 |
| サーバ側で `Content-Security-Policy` から `<meta>` を強制 | CSP の責務外。混乱を招く |

---

## 4. 詳細実装

### 4.1 変更ファイル

| ファイル | 種別 | 内容 |
|---------|------|------|
| `src/admin/vite.config.js` | **新規作成** | `transformIndexHtml` プラグインで HTML 属性／メタを注入 |
| `src/admin/app.js` | 変更なし | （初版で予定していた `bootstrap()` 編集は廃案） |

### 4.2 `src/admin/vite.config.js`（新規）

テスト容易性のため `disableAutoTranslate` プラグインを **named export** とし、デフォルトエクスポートで Strapi の Vite 設定にマージする。

```js
// src/admin/vite.config.js
import { mergeConfig } from 'vite';

/**
 * 管理画面の <html> と <head> にブラウザ自動翻訳のオプトアウト宣言を静的注入する。
 * Why: 自動翻訳エンジンによる DOM 改変が React の reconciliation と衝突し、
 *      DatePicker などの Portal 操作で removeChild が失敗する事象への対策。
 * 関連: docs/incidents/2026-05-05_admin-removechild-error.md
 */
export const disableAutoTranslate = {
  name: 'disable-auto-translate',
  transformIndexHtml(html) {
    return html
      .replace(
        /<html(\s[^>]*)?>/,
        (_, attrs = '') => {
          // 既存属性に lang/translate/class が無い場合のみ追加（冪等）
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
        }
      )
      .replace(
        /<\/head>/,
        '<meta name="google" content="notranslate"></head>'
      );
  },
};

export default (config) =>
  mergeConfig(config, {
    plugins: [disableAutoTranslate],
  });
```

### 4.3 補足

- Strapi 5 の admin Vite 設定エクスポート形式（関数で `mergeConfig` を使う形）に従う。
- 正規表現は既存の `<html>` 属性を保持するため、Strapi 側が将来 `<html>` に独自属性を追加してもマージされる。
- `class` 属性の重複も防止し冪等。

---

## 5. テスト計画

### 5.1 ローカル検証

1. `npm install`
2. `npm run develop`
3. Chrome で `http://localhost:1337/admin` にアクセス（翻訳機能を ON 状態にしておく）
4. **DevTools → Network → admin/index.html の Response Body** を確認：
   - `<html lang="ja" translate="no" class="notranslate">`
   - `<head>` 内に `<meta name="google" content="notranslate">`
   - **HTML レスポンス時点で属性が含まれていること** を確認（JS 実行後ではない）
5. DevTools → Elements で実 DOM 上にも反映されていることを確認
6. アドレスバーの翻訳アイコンが「翻訳できない」状態になり、翻訳バーが表示されないこと
7. 障害再現手順（記事新規作成 → 入力 → 保存 → 公開日指定）でエラーが発生しないこと
8. Lighthouse（Accessibility）を実行し、`lang="ja"` 付与に伴うスコア改善／回帰がないこと

### 5.2 ステージング検証（対照群を含む）

| # | 条件 | 期待結果 |
|---|------|---------|
| 1 | **対照: 翻訳 OFF Chrome** | 修正前後ともクラッシュしない（翻訳起因の確認） |
| 2 | **対照: シークレットモード（拡張全 OFF）** | 修正前後ともクラッシュしない |
| 3 | Chrome（翻訳 ON） | 修正後はクラッシュせず、翻訳バーがアクティブ化されない |
| 4 | Edge（翻訳 ON） | 翻訳されない |
| 5 | Firefox（翻訳機能 ON） | 翻訳されない |
| 6 | DatePicker 操作 | エラー画面に遷移しない |
| 7 | 既存 i18n（`ja` ロケール） | 表示が崩れない |
| 8 | プレビュー機能 | 既存通り動作 |

### 5.3 リグレッション観点

- `src/admin/app.js` には変更を加えないため、既存の i18n／翻訳辞書設定への副作用なし。
- Vite Plugin の `transformIndexHtml` は HTML レスポンスのみに作用するため、Strapi 内部 API への影響なし。
- HMR 時もビルド済み HTML が常に注入済みのため、開発環境と本番環境で挙動差なし。

### 5.4 自動テスト（最小構成）

ローカルで実行可能な自動回帰テストを追加する。Chrome 翻訳エンジンの実挙動はヘッドレスブラウザで再現できないため、本構成は **HTML 注入が確実に行われていること** に焦点を当てる。実翻訳との整合は §5.2 ステージング検証で手動確認する。

#### 5.4.1 追加依存

`package.json` に dev 依存を追加：

```json
"devDependencies": {
  "vitest": "^2.0.0"
}
```

`scripts` に以下を追加：

```json
"scripts": {
  "test:unit": "vitest run",
  "verify:notranslate": "bash scripts/verify-notranslate.sh"
}
```

#### 5.4.2 単体テスト: `tests/unit/disable-auto-translate.spec.js`

`disableAutoTranslate.transformIndexHtml` は純関数のため、Vite を起動せずに直接テスト可能。冪等性・既存属性の保持・メタタグ挿入位置を網羅する。

```js
import { describe, it, expect } from 'vitest';
import { disableAutoTranslate } from '../../src/admin/vite.config.js';

const transform = disableAutoTranslate.transformIndexHtml;

describe('disable-auto-translate plugin', () => {
  it('属性のない <html> に lang/translate/class を付与', () => {
    const out = transform('<html><head></head><body></body></html>');
    expect(out).toContain('lang="ja"');
    expect(out).toContain('translate="no"');
    expect(out).toContain('class="notranslate"');
  });

  it('</head> 直前に notranslate メタを挿入', () => {
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

  it('既に notranslate を含む class はそのまま保持', () => {
    const out = transform(
      '<html class="foo notranslate bar"><head></head></html>'
    );
    expect(out).toMatch(/class="foo notranslate bar"/);
  });

  it('meta タグ挿入は 1 回のみ（再適用しても冪等）', () => {
    const once = transform('<html><head></head></html>');
    const twice = transform(once);
    const matches = twice.match(/name="google"/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
```

#### 5.4.3 ビルド成果物検証: `scripts/verify-notranslate.sh`

`npm run build` 後の成果物 HTML に注入が反映されていることを確認するシェルスクリプト。CI でも単発実行可能。

```bash
#!/usr/bin/env bash
# scripts/verify-notranslate.sh
set -euo pipefail

# Strapi 5 admin のビルド出力。バージョンによってパスが変わる可能性があるため、
# 見つからなければ build/index.html を探索する。
CANDIDATES=(
  "dist/build/index.html"
  "build/index.html"
)

OUT=""
for c in "${CANDIDATES[@]}"; do
  if [ -f "$c" ]; then OUT="$c"; break; fi
done

if [ -z "$OUT" ]; then
  echo "FAIL: admin build output not found (run 'npm run build' first)"
  exit 1
fi

fail() { echo "FAIL: $1 missing in $OUT"; exit 1; }

grep -q 'translate="no"' "$OUT" || fail 'translate="no"'
grep -qE 'class="[^"]*notranslate' "$OUT" || fail 'class="notranslate"'
grep -q '<meta name="google" content="notranslate">' "$OUT" \
  || fail '<meta name="google" content="notranslate">'

echo "OK: notranslate signals present in $OUT"
```

#### 5.4.4 実行

```bash
# 単体テスト（純関数ロジック検証 / 数百ms で完了）
npm run test:unit

# ビルド成果物検証（実 HTML への反映確認）
npm run build && npm run verify:notranslate
```

#### 5.4.5 スコープ外（手動検証に委ねる）

| 観点 | 理由 |
|------|------|
| Chrome 翻訳エンジンの実挙動 | ヘッドレス Chrome で翻訳機能が起動しない／CDP API でも制御不可 |
| クライアント環境固有の拡張機能の影響 | 個別環境差は再現困難。対照検証（§7 P0）で切り分ける |
| クロスブラウザの翻訳機能（Edge/Firefox） | ステージング検証 §5.2 No.4-5 で手動確認 |

---

## 6. リスクと緩和策

| # | リスク | 確率 | 影響 | 緩和策 |
|---|--------|------|------|--------|
| 1 | **翻訳が真因でなかった場合（Strapi リグレッション等）、本修正だけでは解消しない** | 中 | 中 | 対照検証（§7 P0）で確定。仮説 A の場合は Strapi 本体アップグレード／アップストリーム報告で対応 |
| 2 | 翻訳機能を業務上必要とするユーザーがいる | **中**（要事前確認） | 中 | 導入前にクライアント運用者全員が日本語話者であることを明示確認。海外スタッフ追加時は再検討 |
| 3 | Vite 設定エクスポート形式の Strapi バージョン依存 | 低 | 低 | `mergeConfig` ベースで Strapi 5 公式パターンに従う。バージョンアップ時の影響を CHANGELOG で確認 |
| 4 | 一部ブラウザ拡張が `notranslate` を尊重しない | 低 | 低 | 標準ブラウザ翻訳機能起因のクラッシュは解消する。拡張側問題は別途切り分け |
| 5 | 既存 `<html>` 属性との衝突 | 低 | 低 | 正規表現を冪等設計に。テスト §5.1 No.4／No.5 で確認 |

---

## 7. リリース計画

| フェーズ | 担当 | 内容 |
|---------|------|------|
| **0. 対照検証（前提）** | クライアント運用担当 | 関連レポート §6 の 4 項目を実施し、翻訳起因か確定 |
| 1. ブランチ作成 | 実装者 | `fix/admin-disable-auto-translate` を `main` から切る |
| 2. 実装 | 実装者 | 上記 4.2 の差分を適用、ローカル動作確認（5.1） |
| 3. PR 作成 | 実装者 | テンプレに従い PR 起票、本設計書をリンク |
| 4. レビュー | レビュアー | コード差分・本設計書を照合 |
| 5. ステージングデプロイ | リリース担当 | `staging` ブランチへマージ → Strapi Cloud staging 反映 |
| 6. ステージング検証 | QA／クライアント運用担当 | 5.2 のチェックリスト（対照群含む）実施 |
| 7. 本番リリース | リリース担当 | `main` へマージ → 本番反映 |
| 8. クライアント連絡 | PM | §9 の告知文素案を用いてリリース完了通知 |
| 9. 後続: 観測強化 | 実装者 | 別チケットで `window.addEventListener('error', …)` ベースの error tracking を検討 |

### ロールバック手順

- 異常時は対象 PR を Revert し、再デプロイ。実装は単一ファイルの新規追加のみのため、Revert で完全に戻る。
- データ移行・スキーマ変更を伴わないため、データ整合性リスクなし。

---

## 8. 完了条件（Definition of Done）

- [ ] **対照検証（§7 P0）が完了し、翻訳起因が確定または絞り込まれている**
- [ ] `src/admin/vite.config.js` が新規作成され、HTML 注入が反映されている
- [ ] `tests/unit/disable-auto-translate.spec.js` が追加され、`npm run test:unit` が全件 pass
- [ ] `scripts/verify-notranslate.sh` が追加され、`npm run build && npm run verify:notranslate` が成功
- [ ] `npm run build` が成功する
- [ ] ローカルで `admin/index.html` の Response Body に `translate="no"` と `<meta name="google" content="notranslate">` が含まれる
- [ ] ローカルで実 DOM にも上記が反映されている
- [ ] 障害再現手順（記事新規作成 → 入力 → 保存 → 公開日指定）が正常完了する
- [ ] ステージングで §5.2 の対照群を含むチェックリストが完了
- [ ] 本番反映後、クライアント運用担当による受入確認が完了
- [ ] Lighthouse Accessibility スコアに著しい回帰がない
- [ ] 障害レポートのステータスを「クローズ」に更新

---

## 9. クライアント告知文素案

```
件名: Strapi 管理画面の不具合修正リリースのお知らせ

いつもお世話になっております。

ニュース記事の「公開日指定」操作時に発生していた画面クラッシュについて、
原因が Chrome の自動翻訳機能による DOM 改変との競合であったため、
管理画面側で自動翻訳をオプトアウトする修正をリリースしました。

【影響】
- 管理画面はもともと日本語固定で運用されているため、表示・操作に変化はありません。
- これまで暫定対応としてご案内していた「このサイトは翻訳しない」設定は不要になります。

【ご確認のお願い】
- 海外スタッフが今後管理画面を利用される予定がある場合はご連絡ください。

ご不明点がございましたらお気軽にお問い合わせください。
```

---

## 10. 参考リンク

- 障害レポート: `docs/incidents/2026-05-05_admin-removechild-error.md`
- React Issue: <https://github.com/facebook/react/issues/11538>
- Strapi 関連 Issue: [#22182](https://github.com/strapi/strapi/issues/22182), [#25411](https://github.com/strapi/strapi/issues/25411)
- HTML translate 属性: <https://html.spec.whatwg.org/multipage/dom.html#the-translate-attribute>
- Google `notranslate` メタ: <https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites>
- Strapi 管理画面カスタマイズ: <https://docs.strapi.io/dev-docs/admin-panel-customization>
- Vite Plugin API（`transformIndexHtml`）: <https://vite.dev/guide/api-plugin.html#transformindexhtml>
