39*2 ローカル基本セット

GitHubへアップロードするときは、この39*2フォルダの「中身」をリポジトリ直下へアップロードしてください。

構成:
- index.html                HOME
- scenario/index.html       シナリオ一覧
- tools/index.html          ツール一覧
- tools/dice-log/index.html ダイスログ抽出（現在は土台）
- about/index.html          ABOUT
- assets/css/style.css      共通デザイン
- assets/js/main.js         共通JavaScript
- assets/images/            画像置き場


v0.2.5: Supabase自動同期（任意ON/OFF）を追加。手動クラウド保存・読み込みはそのまま残しています。

v0.2.6: 同期状態表示（確認中・保存待ち・同期中・同期済み・エラー）と、他端末の新しい変更を検知して自動上書きを止める競合ガードを追加。
