# 礼明老师智能对话系统 🎓

一个集成语音克隆功能的智能教育对话系统，使用MiniMax API实现高质量的语音合成和克隆。

## ✨ 主要功能

### 🎯 核心功能
- **智能对话**: 基于SiliconFlow Deepseek模型的智能问答
- **语音克隆**: 使用MiniMax API实现真实的语音克隆
- **知识库**: 支持文档上传和智能检索
- **多平台适配**: 响应式设计，支持PC和移动端

### 🎵 语音功能
- **语音合成**: 将文字转换为自然语音
- **语音克隆**: 克隆特定人物的声音特征
- **智能降级**: MiniMax → 本地样本 → Web Speech API
- **音频管理**: 完整的音频文件管理系统

### 🔧 技术特性
- **现代化架构**: Node.js + Express + Socket.IO
- **API集成**: MiniMax语音克隆 + SiliconFlow对话
- **文件处理**: 支持多种音频和文档格式
- **错误处理**: 完善的错误处理和日志系统

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 本地开发
```bash
# 克隆项目
git clone https://github.com/Vivixiao980/liming.git
cd liming

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入您的API密钥

# 启动开发服务器
npm run dev
```

### 生产部署
```bash
# 安装依赖
npm install --production

# 启动服务器
npm start
```

## 📋 API配置

### MiniMax语音克隆
1. 获取MiniMax API密钥和Group ID
2. 在 `data/minimax-voice-config.json` 中配置：
```json
{
  "platform": "minimax",
  "apiKey": "your_jwt_token",
  "groupId": "your_group_id",
  "voiceId": "your_voice_id",
  "voiceName": "克隆语音名称"
}
```

### SiliconFlow对话
1. 获取SiliconFlow API密钥
2. 在 `data/siliconflow-config.json` 中配置：
```json
{
  "platform": "siliconflow",
  "apiKey": "your_api_key",
  "model": "deepseek-ai/DeepSeek-V3",
  "enabled": true
}
```

## 🎯 功能使用

### 语音克隆流程
1. 访问 `/voice-clone-upload.html`
2. 上传音频样本（推荐10-30秒清晰语音）
3. 系统自动创建语音克隆
4. 在主页面对话中自动使用克隆语音

### 知识库管理
1. 访问 `/knowledge-upload.html`
2. 上传文档文件（支持txt, pdf, docx等）
3. 系统自动处理并建立索引
4. 对话中自动引用相关知识

## 🔧 部署指南

### Railway部署
1. 连接GitHub仓库到Railway
2. 设置环境变量：
   - `MINIMAX_API_KEY`: MiniMax JWT Token
   - `MINIMAX_GROUP_ID`: MiniMax Group ID
   - `SILICONFLOW_API_KEY`: SiliconFlow API Key
3. 部署自动完成

### Vercel部署
```bash
# 安装Vercel CLI
npm i -g vercel

# 部署
vercel --prod
```

## 📁 项目结构

```
├── server.js              # 主服务器文件
├── package.json           # 项目配置
├── railway.json           # Railway部署配置
├── Procfile              # 进程配置
├── public/               # 静态文件
│   ├── index.html        # 主页面
│   ├── script.js         # 前端脚本
│   ├── styles.css        # 样式文件
│   └── audio/            # 音频文件目录
├── data/                 # 配置和数据
│   ├── minimax-voice-config.json
│   ├── siliconflow-config.json
│   └── conversations.json
├── uploads/              # 上传文件目录
└── knowledge_base/       # 知识库文件
```

## 🎨 界面预览

- **主对话界面**: 现代化聊天界面，支持语音播放
- **语音克隆管理**: 直观的语音克隆操作界面
- **知识库管理**: 文件上传和管理界面
- **系统监控**: 实时状态监控和诊断工具

## 🔒 安全特性

- CORS跨域保护
- 文件类型验证
- 上传大小限制
- API调用频率限制
- 错误信息脱敏

## 📊 监控和日志

- 详细的API调用日志
- 语音合成状态追踪
- 错误处理和报告
- 性能监控指标

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- [MiniMax](https://www.minimaxi.com/) - 提供语音克隆API
- [SiliconFlow](https://siliconflow.cn/) - 提供AI对话能力
- [Express.js](https://expressjs.com/) - Web框架
- [Socket.IO](https://socket.io/) - 实时通信

## 📞 联系方式

- 项目地址: [https://github.com/Vivixiao980/liming](https://github.com/Vivixiao980/liming)
- 问题反馈: [Issues](https://github.com/Vivixiao980/liming/issues)

---

⭐ 如果这个项目对您有帮助，请给它一个星标！ 