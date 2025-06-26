#!/bin/bash

# 礼明老师智能体 - Railway部署脚本

echo "🚀 开始部署到Railway..."

# 检查必要文件
echo "📋 检查部署文件..."
required_files=("package.json" "server.js" "railway.json" "Procfile")

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ 缺少必要文件: $file"
        exit 1
    else
        echo "✅ $file"
    fi
done

# 检查Git状态
if [ ! -d ".git" ]; then
    echo "📦 初始化Git仓库..."
    git init
    git branch -M main
fi

# 添加所有文件
echo "📝 添加文件到Git..."
git add .

# 提交更改
echo "💾 提交更改..."
git commit -m "Deploy to Railway: $(date)"

echo "🎉 准备完成！"
echo ""
echo "接下来的步骤："
echo "1. 将代码推送到GitHub："
echo "   git remote add origin https://github.com/your-username/your-repo.git"
echo "   git push -u origin main"
echo ""
echo "2. 在Railway中："
echo "   - 访问 https://railway.app"
echo "   - 创建新项目"
echo "   - 连接GitHub仓库"
echo "   - 配置环境变量"
echo ""
echo "3. 必需的环境变量："
echo "   MINIMAX_API_KEY=sk-your-minimax-api-key"
echo "   SILICONFLOW_API_KEY=your-siliconflow-api-key"
echo "   NODE_ENV=production"
echo ""
echo "📖 详细说明请查看 RAILWAY_DEPLOY.md" 