#!/bin/bash

set -e  # エラーが発生したら停止

echo "=== frontend 本番デプロイ開始 ==="
echo ""

# frontend ディレクトリへ移動
cd ${HOME}/repo/hono-note/frontend

# 依存関係インストール（必要に応じて）
echo "📦 依存関係を確認中..."
bun install

# build
echo "🏗 frontend を build 中..."
bun run build

# Caddy reload
echo "🔄 Caddy を再読み込み中..."
sudo systemctl reload caddy

# ステータス確認
echo ""
echo "✅ frontend デプロイ完了！"
echo ""
echo "📊 Caddy ステータス："
sudo systemctl status caddy --no-pager

echo ""
echo "📁 build 出力: /home/koji/repo/hono-note/frontend/dist"
echo "🌐 公開URL: ${MY_DOMAIN_URL}/hono-note/frontend/"
