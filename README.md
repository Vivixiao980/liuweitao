# 刘蔚涛老师智能体 - 老刘闲聊，闲了就来聊

一个基于刘蔚涛老师知识库的AI智能对话系统，支持语音克隆和自然对话。

## 🎯 核心功能

- 🤖 **AI智能对话** - 基于SiliconFlow Deepseek模型的智能回答
- 📚 **知识库调用** - 丰富的刘蔚涛老师专业知识内容
- 🎵 **语音克隆** - MiniMax语音克隆技术，老师真实声音回复
- 💬 **自然风格** - 模拟老师真实的说话风格和表达习惯
- 📱 **响应式界面** - 现代化网页设计，支持移动端
- 💾 **对话记录** - 自动保存对话历史，支持导出

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/Vivixiao980/liuweitao.git
   cd liuweitao
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置API密钥**
   
   编辑 `data/siliconflow-config.json` 和 `data/minimax-voice-config.json` 文件，填入您的API密钥。

4. **系统自检**
   ```bash
   node system-check.js
   ```

5. **启动服务**
   ```bash
   npm start
   ```

6. **访问应用**
   
   打开浏览器访问：http://localhost:3000

## 📋 项目结构

```
liuweitao/
├── server.js              # 服务器主文件
├── knowledge-base.js      # 知识库配置
├── system-check.js        # 系统自检脚本
├── package.json           # 项目依赖
├── public/                # 前端文件
│   ├── index.html         # 主页面
│   ├── styles.css         # 样式文件
│   ├── script.js          # 前端脚本
│   └── liuweitao.png      # 老师头像
├── knowledge-base/        # 知识库文件
├── data/                  # 配置文件
└── uploads/              # 上传文件目录
```

## ⚙️ 配置说明

### SiliconFlow AI配置
编辑 `data/siliconflow-config.json`：
```json
{
  "platform": "siliconflow",
  "apiKey": "你的API密钥",
  "baseURL": "https://api.siliconflow.cn/v1",
  "model": "deepseek-ai/DeepSeek-V3",
  "enabled": true
}
```

### MiniMax语音克隆配置
编辑 `data/minimax-voice-config.json`：
```json
{
  "platform": "minimax",
  "apiKey": "你的API密钥",
  "groupId": "你的群组ID",
  "voiceId": "语音克隆ID"
}
```

## 🎨 界面特色

- **深蓝色主题** - 护眼的深蓝色（#003366）文字设计
- **渐变背景** - 优雅的紫蓝渐变背景
- **现代化布局** - 卡片式设计，圆角边框
- **响应式设计** - 完美适配手机和电脑

## 📚 知识库内容

项目包含丰富的刘蔚涛老师知识内容：
- 职场管理经验分享
- 人生故事和成长轨迹
- 专业观点和表达风格
- 咨询行业实战经验
- 个人发展指导建议

## 🛠️ 开发命令

```bash
# 启动开发模式（自动重启）
npm run dev

# 生产环境启动
npm start

# 系统自检
node system-check.js
```

## 📝 使用说明

1. **开始对话** - 直接在输入框输入问题
2. **语音播放** - 点击"语音开启"按钮启用语音回复
3. **推荐问题** - 点击预设问题快速开始对话
4. **导出记录** - 点击"导出记录"按钮下载对话历史

## 🔧 故障排除

如果遇到问题，请：
1. 运行 `node system-check.js` 检查系统状态
2. 检查API密钥配置是否正确
3. 确认网络连接正常
4. 查看控制台错误信息

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交Issue和Pull Request来改进项目！

---

**老刘闲聊，闲了就来聊！** 🎉 