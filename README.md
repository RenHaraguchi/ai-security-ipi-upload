# 06-ipi-upload ｜ 間接プロンプトインジェクション体験デモ（アップロード方式）

「HTML記事をアップロードすると要約するAI」。受講生は**手元のHTMLを選んでアップロード→「要約」を押すだけ**。
普通の記事はちゃんと要約されるが、講師が配布する**罠HTML**には `display:none` 等で
**人間に見えない命令**が本文へ仕込んであり、AIがそれに従って要約に**フィッシング誘導文を混入**する
＝**間接プロンプトインジェクション(IPI)** の体験。

## このデモの設計思想

- **アプリは罠を一切判定しない**。アップロードされたHTMLから本文テキスト（不可視部分含む）を
  抽出し、ただ要約に回すだけ。「やらせ」にしないため、アプリ側に罠の在処を持たせない。
- **乗っ取りは出力汚染型**（要約は続けつつフィッシングURLを混入）。タスクを放棄しないので
  高性能化したモデルにも通りやすく、演出くささが出ない。
- **種明かしはアップロードされたHTMLをその場で `DOMParser` 解析**し、不可視要素を抽出して提示。
  アプリは事前に答えを知らない。
- プレビューは **iframe sandbox（script無効）** で表示するため、`display:none` の罠は
  人間に見えず、scriptも動かず安全。一方 **AIには不可視テキスト込みの抽出結果**を渡す
  （＝「見えないテキストが要約器に流れ込む」現実を忠実再現）。

## セットアップ

```bash
cd dev/ai-security-demos/06-ipi-upload
npm install
npm run dev          # http://localhost:3006
```

APIキー未設定でも**オフラインモード**（台本応答）で全フローが動く。当日の再現失敗時の保険になる。
本番は実キーで本物のAIに要約させること（やらせと混同しないため）。

## APIキー（Groq）の設定

無料・カード登録不要。Groqは独自基盤（Google/Geminiの制限とは無関係）。

ローカル:

```bash
# プロジェクト直下に .env.local を作成（.env.example をコピー）
GROQ_API_KEY=gsk_xxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant   # 無料枠で叩けるモデル名に変更可
```

Vercel:

- Project → Settings → Environment Variables に `GROQ_API_KEY` を登録 → 再デプロイ
- `.env.local` はコミットしない（`.gitignore` 済み）

### APIキーの取得手順

1. https://console.groq.com を開き、Google/GitHub等でログイン
2. **API Keys** → **Create API Key** → `gsk_...` が表示されるのでコピー
3. 上記のとおり `.env.local`（ローカル）/ Vercel 環境変数（本番）に設定

## デモ的に「IPIが通りやすい」理由

`llama-3.1-8b-instant` のような軽量モデルは、防御を入れていない素朴な要約アプリへの間接注入が
通りやすい。「最新AIは賢い→無防備アプリ＋巧妙な罠なら通る」こと自体を教材化している。
より賢いモデルでも試したい場合は `GROQ_MODEL=llama-3.3-70b-versatile` に変更して比較できる。

## このアプリ自体のセキュリティ対策

- APIキーは**サーバ側のAPIルートでのみ**使用（ブラウザに出さない / `NEXT_PUBLIC_` 不使用）
- 任意URL取得はしない（アップロードされたHTMLのみ扱う＝SSRFなし）
- プレビューは iframe sandbox で script 無効化（罠HTML内のスクリプトを実行しない）
- 出力は全てテキスト描画（ReactのエスケープでXSS防止）
- 簡易レート制限・`max_tokens` 小・`temperature 0`・無料/安価モデルでコスト暴発を抑制
- セキュリティヘッダ（`next.config.mjs`）

## 構成

```
06-ipi-upload/
  app/
    layout.js                レイアウト
    page.js                  アップロードUI・プレビュー(iframe)・要約・種明かし(DOMParser)
    globals.css              スタイル（媒体監視ツール風）
    api/summarize/route.js   サーバ側：Groq呼び出し / オフライン台本 / レート制限 / テキスト抽出
  lib/
    extract.js               HTML→本文テキスト抽出（不可視テキストも含めて抽出）
  public/sample-articles/
    clean-ev.html            無害サンプル（罠なし）
    trapped-clinic.html      罠（display:none でフィッシング誘導を混入）
    trapped-delivery.html    罠（白文字+1pxフォント・配送通知を装う）
    trapped-utility.html     罠（visibility:hidden・電力料金を装う）
    trapped-bank.html        罠（opacity:0・ネット銀行を装う）
    trapped-jobscam.html     罠（画面外配置 left:-9999px・副業勧誘を装う）
  .env.example
```

## デモ運用メモ

- 罠HTMLは**講師が事前配布**。受講生は中身を打たず、画面でも見えない（＝ユーザーは被害者役）
- 乗っ取りの結果は「要約に偽の確認URLが混ざる」出力汚染に限定（外部送信などはしない）
- 隔離環境・ダミーデータで運用すること
- 罠URLは実在しない `.example` ドメインを使用
