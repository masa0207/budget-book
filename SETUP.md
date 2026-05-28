# 家計簿アプリ セットアップガイド

## 必要なもの
- Supabaseアカウント（無料）
- Vercelアカウント（無料）
- Googleアカウント（認証に使用）

---

## Step 1: Supabaseプロジェクト作成

1. https://supabase.com にアクセス → 「Start your project」
2. 新しいプロジェクトを作成
3. 「SQL Editor」を開く
4. `supabase/schema.sql` の内容をコピーして実行

---

## Step 2: Supabase認証設定（Google OAuth）

1. Supabase → Authentication → Providers → Google を有効化
2. Google Cloud Console でOAuthクライアントを作成
   - Authorized redirect URI: `https://[プロジェクトID].supabase.co/auth/v1/callback`
3. Client ID / Client Secret をSupabaseに設定

---

## Step 3: 環境変数設定

`.env.local` を編集:

```
NEXT_PUBLIC_SUPABASE_URL=https://[プロジェクトID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anonキー]
```

値は Supabase → Settings → API から取得

---

## Step 4: ローカル動作確認

```bash
npm run dev
```

http://localhost:3000 でアプリを確認

---

## Step 5: Vercelへデプロイ

1. GitHubにリポジトリを作成してpush
2. https://vercel.com → 「New Project」→ リポジトリを選択
3. Environment Variables に Step 3 の2つの値を設定
4. Deploy

デプロイ後、SupabaseのAuthentication → URL Configuration → Site URL に  
VercelのURLを追加してください。

---

## iPhoneでのインストール（PWA）

1. SafariでアプリのURLを開く
2. 共有ボタン → 「ホーム画面に追加」
3. ホーム画面からアプリとして起動可能

---

## PWAアイコン

`public/icons/` に以下のPNGファイルを配置してください:
- `icon-192.png` (192×192px)
- `icon-512.png` (512×512px)

---

## カテゴリの追加

Supabase → Table Editor → categories テーブルで直接追加するか、  
将来的にアプリ内のカテゴリ管理画面から追加できます。
