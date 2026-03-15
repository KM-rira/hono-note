#!/bin/bash
set -e

echo "=== frontend 本番デプロイ開始 ==="
echo ""

FRONTEND_DIR="${HOME}/repo/hono-note/frontend"
PUBLIC_DIR="/var/www/${MY_DOMAIN}/hono-note/frontend"

cd "$FRONTEND_DIR"

echo "📦 依存関係を確認中..."
bun install

echo "🏗 frontend を build 中..."
bun run build

echo "📁 公開ディレクトリ更新中..."
sudo mkdir -p "$PUBLIC_DIR"
sudo rsync -av --delete dist/ "$PUBLIC_DIR/"

echo "🔄 Caddy を再読み込み中..."
sudo systemctl reload caddy

echo ""
echo "✅ frontend デプロイ完了！"
echo "📁 build 出力: $PUBLIC_DIR"
echo "🌐 公開URL: ${MY_DOMAIN_URL}/hono-note/frontend/"
