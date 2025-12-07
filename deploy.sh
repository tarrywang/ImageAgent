#!/bin/bash

# 悦舍工坊 - 像素化萌系贴纸生成器 一键部署脚本
# 适用于 Ubuntu 20.04/22.04/24.04

set -e

echo "=========================================="
echo "  悦舍工坊 - 像素化萌系贴纸生成器"
echo "  一键部署脚本"
echo "=========================================="

# 配置变量
APP_NAME="imageagent"
APP_DIR="/home/$USER/ImageAgent"
PORT=3001

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查是否为 root
if [ "$EUID" -eq 0 ]; then
    log_error "请不要使用 root 用户运行此脚本"
    exit 1
fi

# 1. 更新系统
log_info "更新系统包..."
sudo apt update && sudo apt upgrade -y

# 2. 安装 Node.js 20.x
if ! command -v node &> /dev/null; then
    log_info "安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    log_info "Node.js 已安装: $(node -v)"
fi

# 3. 安装 PM2
if ! command -v pm2 &> /dev/null; then
    log_info "安装 PM2..."
    sudo npm install -g pm2
else
    log_info "PM2 已安装"
fi

# 4. 安装 Nginx
if ! command -v nginx &> /dev/null; then
    log_info "安装 Nginx..."
    sudo apt install -y nginx
else
    log_info "Nginx 已安装"
fi

# 5. 创建应用目录并复制文件
log_info "设置应用目录..."
mkdir -p "$APP_DIR"

# 如果脚本在项目目录中运行，复制文件
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ]; then
    log_info "复制项目文件..."
    cp -r "$SCRIPT_DIR"/* "$APP_DIR/"
fi

cd "$APP_DIR"

# 6. 安装依赖
log_info "安装 npm 依赖..."
npm install --production

# 7. 创建 .env 文件（如果不存在）
if [ ! -f "$APP_DIR/.env" ]; then
    log_info "创建 .env 配置文件..."
    cat > "$APP_DIR/.env" << EOF
PORT=$PORT
# 添加其他环境变量
EOF
fi

# 8. 配置 PM2
log_info "配置 PM2..."
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start server.js --name "$APP_NAME"
pm2 save
pm2 startup systemd -u "$USER" --hp "/home/$USER" | tail -1 | sudo bash

# 9. 配置 Nginx
log_info "配置 Nginx..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name _;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        # 上传文件大小限制
        client_max_body_size 10M;
    }
}
EOF

# 启用站点配置
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并重启 Nginx
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# 10. 配置防火墙
log_info "配置防火墙..."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw --force enable

# 完成
echo ""
echo "=========================================="
echo -e "${GREEN}  部署完成！${NC}"
echo "=========================================="
echo ""
echo "  应用状态: pm2 status"
echo "  查看日志: pm2 logs $APP_NAME"
echo "  重启应用: pm2 restart $APP_NAME"
echo ""
echo "  访问地址: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "  下一步（可选）:"
echo "  1. 绑定域名后运行: sudo certbot --nginx -d your-domain.com"
echo "  2. 编辑 /etc/nginx/sites-available/$APP_NAME 修改 server_name"
echo ""
