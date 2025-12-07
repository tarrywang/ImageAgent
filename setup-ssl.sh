#!/bin/bash

# SSL 证书配置脚本
# 使用 Let's Encrypt 免费证书

set -e

if [ -z "$1" ]; then
    echo "用法: ./setup-ssl.sh your-domain.com"
    echo "示例: ./setup-ssl.sh pixel.yueshe.com"
    exit 1
fi

DOMAIN=$1

echo "为 $DOMAIN 配置 SSL 证书..."

# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 更新 Nginx 配置中的 server_name
sudo sed -i "s/server_name _;/server_name $DOMAIN;/" /etc/nginx/sites-available/imageagent
sudo nginx -t && sudo systemctl reload nginx

# 获取证书
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" --redirect

# 自动续期
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo ""
echo "SSL 配置完成！"
echo "访问: https://$DOMAIN"
