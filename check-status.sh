#!/bin/bash

echo "🔍 老刘智能体系统状态检查"
echo "================================"

# 检查服务器状态
echo "📡 检查服务器状态..."
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "✅ 服务器运行正常 (端口3000)"
else
    echo "❌ 服务器未运行"
    exit 1
fi

# 检查SiliconFlow API状态
echo ""
echo "🤖 检查SiliconFlow API状态 (DeepSeek-R1)..."
api_response=$(curl -s -X POST https://api.siliconflow.cn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ybkmtrltrtstpbtemkuykyfhbwcbjdlrevpzhuuegiwsxnqv" \
  -d '{"model": "deepseek-ai/DeepSeek-R1", "messages": [{"role": "user", "content": "测试"}], "max_tokens": 50}' \
  --connect-timeout 10)

if echo "$api_response" | grep -q "choices"; then
    echo "✅ SiliconFlow API正常 (DeepSeek-R1)"
    if echo "$api_response" | grep -q "reasoning_content"; then
        echo "🧠 推理功能已启用"
    fi
else
    echo "⚠️  SiliconFlow API异常（将使用本地知识库）"
    echo "错误详情: $(echo "$api_response" | head -100)"
fi

# 测试本地API
echo ""
echo "💬 测试老刘对话API..."
local_response=$(curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "测试API", "userId": "health-check"}' \
  --connect-timeout 10)

if echo "$local_response" | grep -q "success.*true"; then
    echo "✅ 老刘对话API正常"
    reply=$(echo "$local_response" | grep -o '"reply":"[^"]*"' | cut -d'"' -f4 | head -50)
    echo "📝 回复示例: $reply"
else
    echo "❌ 老刘对话API异常"
    echo "错误详情: $local_response"
fi

# 检查MiniMax语音状态
echo ""
echo "🎵 检查MiniMax语音配置..."
if [ -f "data/minimax-voice-config.json" ]; then
    echo "✅ MiniMax语音配置文件存在"
else
    echo "⚠️  MiniMax语音配置文件缺失"
fi

# 检查语音克隆页面
echo ""
echo "🔧 检查语音克隆页面..."
voice_page_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/voice-clone.html --connect-timeout 5)
if [ "$voice_page_status" = "200" ]; then
    echo "✅ 语音克隆页面正常访问"
else
    echo "⚠️  语音克隆页面访问异常 (状态码: $voice_page_status)"
fi

echo ""
echo "🎯 系统状态检查完成！"
echo "访问地址: http://localhost:3000"
echo "语音管理: http://localhost:3000/voice-clone.html" 