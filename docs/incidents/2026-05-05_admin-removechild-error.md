# 障害レポート: 管理画面で「公開日指定」時に `removeChild` エラーで操作不能

| 項目 | 内容 |
|------|------|
| 発生日 | 2026-05-05 |
| 報告者 | クライアント運用担当 |
| 解析担当 | ikko.fujimura |
| 影響範囲 | Strapi 管理画面（Strapi Cloud 上の運用環境） |
| 影響ユーザー | 管理画面ログインユーザー全般（特定条件下） |
| 重大度 | 高（記事公開フローが完了不能） |
| ステータス | **主要因仮説あり・対照検証中** |
| 最終更新 | 2026-05-06（多角的レビュー反映） |

---

## 1. サマリー

Strapi 管理画面でニュース記事を作成する際、以下の手順で React の DOM 操作エラーが発生し、操作画面がエラー画面に遷移して以後の操作ができなくなる。

```
Failed to execute 'removeChild' on 'Node':
The node to be removed is not a child of this node.
（'Node' に対して 'removeChild' を実行できませんでした：
 削除対象のノードは、このノードの子ではありません。）
```

---

## 2. 再現手順

| # | 操作 | 結果 |
|---|------|------|
| 1 | 管理画面にログイン | OK |
| 2 | News Article コレクションで「新規作成」 | OK |
| 3 | タイトル・本文等を入力 | OK |
| 4 | 「保存」 | OK（ドラフト保存成功） |
| 5 | 「公開日指定」（DateTimePicker を開く） | **エラー画面に遷移** |

エラー画面 URL:
```
https://magical-attraction-b063577ce7.strapiapp.com/admin/content-manager/collection-types/api::news-article.news-article/<documentId>
```

---

## 3. 環境

| 項目 | バージョン／設定 |
|------|-----------------|
| Strapi | 5.15.0 |
| React | ^18.0.0 |
| ホスティング | Strapi Cloud |
| 管理画面ロケール | `ja`（`src/admin/app.js` で固定） |
| ブラウザ | Google Chrome（クライアント運用担当環境） |
| 関連プラグイン | `strapi-plugin-ja-pack` 2.0.1 |

---

## 4. 有力仮説（要対照検証）

> 注意: 本セクションの内容は **未確定の仮説** であり、対照検証（§6）の結果次第で更新する。

### 4.1 推定メカニズム

**Chrome の「ページ自動翻訳」機能が管理画面 DOM を改変し、React の DOM 再調整（reconciliation）と衝突している** という仮説を最有力視している。

1. Chrome の翻訳機能は、ページ上のテキストノードを `<font>` 要素で包み、翻訳後テキストへ差し替える形で DOM ツリーを書き換える。
2. Strapi 管理画面（React 18）は仮想 DOM 上で計算した親子関係を前提に `Node.removeChild()` などの DOM 操作を行う。
3. ステップ⑸の「公開日指定」では DatePicker のポップオーバーが React Portal によって mount/unmount される。
4. このタイミングで、React が削除対象として保持しているノードはすでに翻訳機能の `<font>` ラッパー配下に移動済みのため、本来の親ノードからは「子ではない」状態となる。
5. 結果として `removeChild` が `NotFoundError` を投げ、Strapi のエラーバウンダリが画面全体をエラー UI に置換する。

### 4.2 根拠

| 観点 | 観測事実 | 確度 |
|------|---------|------|
| エラーメッセージ | 典型的な React + 翻訳系拡張の競合パターンと一致（[facebook/react#11538](https://github.com/facebook/react/issues/11538) で長年トラックされている問題） | 高 |
| スクリーンショット | アドレスバー右側に Chrome 翻訳アイコンと「更新を完了」翻訳 UI ボタンが表示されていた | 中（補強事実であり直接立証ではない） |
| 発生ステップ | DOM の大規模な mount/unmount を伴うモーダル展開（DatePicker）でのみ発生 | 中 |
| Strapi コード | 当該 `src/admin/app.js` および `config/admin.js` に DOM 操作の独自実装は存在しない（標準 Strapi 管理画面のみ） | 高 |

**直接立証は未完**（翻訳 OFF 環境で再現しないことの確認が未実施）。§6 で対照検証を実施する。

### 4.3 「公開日指定」で発生しやすい推定理由（未検証）

- ステップ⑴〜⑶（タイトル・本文入力）は既存ノードの `value` 更新が中心で、追加・削除は限定的。
- ステップ⑷の保存後にバナー・状態表示が再描画される。
- ステップ⑸で DatePicker の Portal がマウントされると、フォーカストラップ・オーバーレイ・カレンダーグリッドなど多数のノードが**同時に**生成・破棄される。
- 翻訳機能が直前に書き換えていた領域と React の追跡 DOM が乖離している場合、Portal の unmount フェーズで `removeChild` 失敗が顕在化しうる。

> 上記は推定メカニズムであり、対照検証で確定する。

### 4.4 代替仮説

翻訳起因と断定できない以上、以下の代替仮説も並行して検討する。

| # | 仮説 | 補強する観測 | 関連 Issue |
|---|------|------------|-----------|
| A | **Strapi 5.x design-system／管理画面の Portal 系リグレッション** | Strapi 5 系で翻訳と無関係に `removeChild` を訴える報告が多数。サイドバー、ダイアログ、DatePicker などで広く発生 | [strapi/strapi#22182](https://github.com/strapi/strapi/issues/22182), [#22845](https://github.com/strapi/strapi/issues/22845), [#23791](https://github.com/strapi/strapi/issues/23791), [#24250](https://github.com/strapi/strapi/issues/24250), [#24349](https://github.com/strapi/strapi/issues/24349), [#25411](https://github.com/strapi/strapi/issues/25411) |
| B | **他の DOM 注入系ブラウザ拡張**（Grammarly、LastPass、1Password など） | これらも `<font>` や `<div>` ラッパーを挿入し、React と同種の競合を引き起こす | [facebook/react#17256](https://github.com/facebook/react/issues/17256) |
| C | **react-datepicker / Radix Popover の Portal 二重 unmount バグ** | DatePicker 起動時のみ発生する点と整合 | [strapi/design-system#1171](https://github.com/strapi/design-system/issues/1171) |

仮説 A は確度が高く、対照検証（翻訳 OFF）で再現する場合は本筋となる。その場合は Strapi 本体のアップグレード（[v5.43.0+ release notes](https://github.com/strapi/strapi/releases)）または Strapi 側への issue 報告が対応路線となる。

---

## 5. 影響範囲

| 区分 | 影響 |
|------|------|
| 機能影響 | 公開日指定経由での記事公開フローが進められない（保存自体は成功） |
| データ影響 | なし（クライアント側 UI クラッシュであり、API/DB は正常） |
| 回避可能性 | あり（後述） |
| 再現性 | 翻訳機能 ON のブラウザで高頻度再現の可能性あり（**対照検証で確定予定**） |

---

## 6. 対照検証計画（要クライアント協力）

仮説確定のため、クライアント運用担当の環境で以下を順に実施いただく。

| # | 条件 | 期待挙動 | 判定意義 |
|---|------|---------|---------|
| 1 | Chrome（通常）／翻訳 OFF にして同手順 | 再現しなければ翻訳が主要因確定 | 仮説 4.1 の検証 |
| 2 | Chrome シークレットモード（拡張・翻訳いずれも無効） | 再現しなければクライアント環境固有の競合と確定 | 仮説 B の絞り込み |
| 3 | 別ブラウザ（Edge / Firefox 翻訳 OFF） | 再現するかしないかで Strapi 5 本体起因か切り分け | 仮説 A の検証 |
| 4 | DevTools Console の完全なスタックトレース取得（minified でも可） | チャンク名で発生源を特定 | A / 翻訳起因 の二択判定 |

---

## 7. 暫定回避策（クライアント運用側）

修正リリース前は、管理画面に対して Chrome の翻訳を無効化することで回避できる。

1. 管理画面上で右クリック → 「日本語に翻訳しない」
2. またはアドレスバーの翻訳アイコン（縦三点メニュー）→ 「このサイトは翻訳しない」を選択

---

## 8. 恒久対策（概要）

仮説 4.1（翻訳起因）の場合、管理画面の HTML 側で翻訳系拡張の対象から除外することを宣言する。具体的な実装方針は別紙設計書を参照。

- HTML 静的注入: `<html lang="ja" translate="no" class="notranslate">`
- HTML 静的注入: `<meta name="google" content="notranslate">`

仮説 A（Strapi リグレッション）の場合、Strapi 本体のアップグレードまたはアップストリームへの報告が必要。

→ 設計書: `docs/designs/2026-05-05_admin-disable-auto-translate.md`

---

## 9. 再発防止

| 区分 | 施策 |
|------|------|
| 技術 | 管理画面ビルド時に `notranslate` 系メタを必ず注入する（恒久対策） |
| 観測 | 修正後も類似クラッシュが残らないか、`window.addEventListener('error', ...)` で Sentry 等にエラートラッキングする（別チケット推奨） |
| 運用 | Strapi バージョンアップ時に管理画面 HTML head から `meta[name=google]` が失われないか CI／手動チェックする |
| ドキュメント | クライアント向け運用手順に「翻訳機能を OFF にする」旨を補足記載 |

---

## 10. タイムライン

| 日時 | 事象 |
|------|------|
| 2026-05-05 | クライアントから障害報告受領（スクリーンショット添付） |
| 2026-05-05 | リポジトリ取得・コード調査・初版レポート／設計書作成 |
| 2026-05-06 | 多角的レビュー実施・指摘反映（本版） |
| TBD | クライアントによる対照検証（§6） |
| TBD | 対照検証結果に基づき確定対応（実装または Strapi 起因対応） |
| TBD | ステージング検証 → 本番リリース |

---

## 11. 参考

- React Issue: [Crash with browser translation #11538](https://github.com/facebook/react/issues/11538)
- React Issue: [Failed to execute 'removeChild' with React.Fragment + Chrome extension #17256](https://github.com/facebook/react/issues/17256)
- Strapi Issues: [#22182](https://github.com/strapi/strapi/issues/22182), [#22845](https://github.com/strapi/strapi/issues/22845), [#23791](https://github.com/strapi/strapi/issues/23791), [#24250](https://github.com/strapi/strapi/issues/24250), [#24349](https://github.com/strapi/strapi/issues/24349), [#25411](https://github.com/strapi/strapi/issues/25411)
- Strapi Design System: [Datepicker issues #1171](https://github.com/strapi/design-system/issues/1171)
- W3C HTML Living Standard: [The translate attribute](https://html.spec.whatwg.org/multipage/dom.html#the-translate-attribute)
- Google Search Central: [Excluding pages from translation](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- Strapi Docs: [Admin Panel Customization](https://docs.strapi.io/dev-docs/admin-panel-customization)
- Martijn Hols: [Everything about Google Translate crashing React](https://martijnhols.nl/blog/everything-about-google-translate-crashing-react)
