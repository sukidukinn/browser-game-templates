# Tetris Online setup

1. Supabaseで新しいProjectを作成。
2. SQL Editorを開き、`supabase-setup.sql` 全文を実行。
3. Project Settings / API Keys から Project URL と **Publishable key** を取得。
4. `supabase-config.js` の2箇所を置換。Secret/service_role keyは絶対にGitHubへ置かない。
5. GitHubに `tetris-online/` フォルダをアップロード。
6. `https://sukidukinn.github.io/browser-game-templates/tetris-online/` を開く。
7. Dキーでパネルを表示し、Sendで現在のスコアを送信。

## GitHub Loginを使う場合

Supabase Dashboard > Authentication > Sign In / Providers > GitHub を有効化する。
GitHub側でOAuth Appを作成し、Supabase画面に表示される Callback URL を GitHub OAuth App の Authorization callback URL に設定する。
Supabase Dashboard > Authentication > URL Configuration の Redirect URLs に以下を追加する。

`https://sukidukinn.github.io/browser-game-templates/tetris-online/`

ログインしなくてもスコアは投稿可能。コメントと誘導URLはログイン時だけ有効。
