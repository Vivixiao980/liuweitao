#!/bin/bash

echo "🎤 智能教师助手语音功能测试"
echo "================================="

# 检查服务器是否运行
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 服务器未运行，请先启动服务器: npm start"
    exit 1
fi

echo "✅ 服务器运行正常"

# 运行全面测试
echo "🧪 开始全面测试..."
node comprehensive-voice-test.js

echo ""
echo "📝 测试说明："
echo "   - ✅ 表示功能正常"
echo "   - ❌ 表示功能异常但有降级方案"
echo "   - 🎯 当前实现了智能降级，确保基础功能可用"
echo ""
echo "🌐 Web测试页面："
echo "   - 语音克隆管理: http://localhost:3000/voice-clone-manager.html"
echo "   - MiniMax配置: http://localhost:3000/minimax-config.html"
echo "   - 权限检查器: http://localhost:3000/permission-checker.html" 