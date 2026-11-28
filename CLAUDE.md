# 太陽ノックス 公式サイト — 作業メモ（新しいチャット向け）

奈良県橿原市の草野球チーム「太陽ノックス」（監督：しみ）の公式サイト。チーム名は乃木坂46「太陽ノック」から。
公開URL: https://taiyo-knocks.netlify.app （GitHub `taiyoknocks/taiyo-knocks-site` の main に push すると Netlify が自動で公開）

## 必ず守ること

- **勝手に実行しない。** サイトの修正・公開は、内容を説明してしみさんの「GO」をもらってから。見本（ローカルでのスクショ）までは作ってよい。
- **main へのコミットは必ず taiyoknocks 名義で。** それ以外の名義だと Netlify がデプロイを止める（Unrecognized Git contributor）。
  ```
  GIT_AUTHOR_NAME=taiyoknocks GIT_AUTHOR_EMAIL=362071472+taiyoknocks@users.noreply.github.com \
  GIT_COMMITTER_NAME=taiyoknocks GIT_COMMITTER_EMAIL=362071472+taiyoknocks@users.noreply.github.com git commit ...
  ```
- **Netlify は無料プラン（月300クレジット、本番公開1回=15クレジット）。** 修正はまとめて1回で公開する。サイトに関係ないコミット（tools/ や CLAUDE.md だけ）はメッセージに `[skip netlify]` を入れて公開しない。
- 合言葉（BLOG_PASSCODE / BLOG_ADMIN_PASSCODE）は Netlify の環境変数にだけある。こちらで本番に入力したり、ファイルに書いたりしない。
- クラウドの作業環境からは netlify.app に接続できないことがある。公開後の確認は、しみさんにスマホで見てもらう。
- しみさんはスマホで見ることが多い。説明は短く、専門用語を避ける。

## 構成

| 場所 | 中身 |
|---|---|
| `site/index.html` | トップページ（**手で直さない**。下の手順で作り直す） |
| `site/images/` | トップページの画像 |
| `site/blog/` | ブログ一覧 `index.html`・記事 `post.html`・共通 `blog.css` / `blog.js`・メンバー `members.json` |
| `site/post/index.html` | メンバーが書くページ（noindex。サイトからはリンクせず、URLを共有して使う） |
| `site/post/manage.html` | 管理用（全記事の削除・書き出し） |
| `netlify/functions/blog.mjs` | `/api/blog/*` の入口（Netlify Blobs のストア `tk-blog`） |
| `netlify/lib/blog-core.mjs` | ブログの中身（posts / post / img / check / admin-check / create / update / delete / export） |
| `tests/blog-core.test.mjs` | `npm test` |
| `tools/design/Main.dc.html` | トップページのデザインの元データ |
| `tools/build_top.py` | 元データ → `site/index.html` に変換（スライダー・メニュー・ニュース開閉・ブログ新着カードのJSもここで入れる） |
| `tools/devserver.mjs` | ブログを手元で試すサーバー（`node tools/devserver.mjs` → localhost:8787、テスト用合言葉 `taiyo` / 管理 `kantoku`） |

### トップページを直すとき
1. `tools/design/Main.dc.html` を直す（文言・並び・スタイルはここ）
2. `python3 tools/build_top.py` で `site/index.html` を作り直す
3. Playwright（390px幅）でスクショを撮って見せる → GO → taiyoknocks 名義で push

※ claude.ai のデザインキャンバス（https://claude.ai/artifact/BiPhhxNAPkesfjV7rJZ3SP）は古い見た目のコピー。正しい元データは `tools/design/`。

### ブログの仕組み
- メンバーは `/post/` で合言葉を1回入れる（そのスマホに保存）→ 書く（文章と写真を自由に並べる、写真はスマホ側で1280pxに縮小）→ プレビュー → 投稿。
- 投稿すると、そのスマホに「削除用の鍵」が保存され、そのスマホからだけ編集・削除できる。管理用合言葉ならどの記事でも削除・編集できる。
- 編集では ID・投稿日時は変えない。写真は `{type:'image', keep:番号}` で残し、外した写真はサーバーからも消す。新しい写真の番号は使い回さない（画像URLは immutable キャッシュのため）。
- 合言葉は日本語OK。全角半角・前後の空白の違いは同じとみなす（NFKC）。
- 表示は乃木坂46公式ブログと同じ形：トップは新着4件の2列カード＋VIEW MORE、`/blog/` は「メンバーを選択」＋カード2列（12件/ページ）、メンバーか月を選ぶと「左に正方形の写真・右にタイトル」の一覧（10件/ページ）＋背番号の青い帯＋ARCHIVES。カードの丸アイコンはトップのメンバー欄の背番号の形。

### スクショ確認のコツ
- Google Fonts に繋がらないので、`npm i @fontsource/cinzel @fontsource/shippori-mincho @fontsource/zen-kaku-gothic-new` を作業用フォルダに入れ、Playwright で fonts.googleapis.com をそのCSSに差し替えると本番と同じ見た目で撮れる。
- 画像は loading="lazy" なので、全体スクショの前に一度スクロールする。

## サイトの中身（事実）
- 色：白＋ロイヤルブルー #1D4FB8、アクセントのサンイエロー #FFC400。書体：Cinzel / Shippori Mincho / Zen Kaku Gothic New。
- メンバー14人と推しは `site/blog/members.json`（背番号43 しみ＝監督、10 きょろ侍＝キャプテン）。
- スポンサー：SHOTBAR BUZZ（Instagram @buzz_2022_bar）、株式会社トクナガ（https://www.roof-tokunaga.com/）。どちらも掲載許可済み。
- 11/23 ちえのわベースボールクラブ戦 14－2 勝ち（勝：ニブタクヤ、本：きょろ侍 3ラン）。点数はチームのPLAYアプリの方に合わせた。
- 次の試合：12/6（日）13:00（予定）大和郡山市総合運動公園 多目的グランド vs ティターンズ。予告先発ニブタクヤ。
- Instagram @taiyo_knocks、YouTube https://www.youtube.com/channel/UCoVtau7pK26m3WbjXcuxjUQ（11/23開設）。

## 残っていること
- 12/6 の開始時刻が決まったら更新（今は「13:00（予定）」）。
- 本番での最初の投稿・編集を、しみさんのスマホで試してもらう。
- いつか：独自ドメイン（.jp など）、「太陽ノックス」「太陽ノック」での検索上位、収益化。
