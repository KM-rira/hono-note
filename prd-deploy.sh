#!/bin/bash

set -e  # エラーが発生したら停止

echo "=== 本番環境へのデプロイ開始 ==="
echo ""

# サービス停止
echo "📦 hono-noteサービスを停止中..."
sudo systemctl stop hono-note

echo "🔒 Caddyを停止中..."
sudo systemctl stop caddy

# サービス開始
echo "🚀 hono-noteサービスを起動中..."
sudo systemctl start hono-note

echo "🔒 Caddyを起動中..."
sudo systemctl start caddy

# ステータス確認
echo ""
echo "✅ デプロイ完了！"
echo ""
echo "📊 サービスステータス："
echo ""
echo "=== trends-summary ==="
sudo systemctl status hono-note --no-pager
echo ""
echo "=== Caddy ==="
sudo systemctl status caddy --no-pager

echo ""
echo "🌐 アクセスURL: ${MY_DOMAIN_URL}/hono-note/"
echo "📝 ログ確認: sudo journalctl -u hono-note -f"
