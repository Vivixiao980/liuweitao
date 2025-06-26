# 礼明老师智能对话系统

一个现代化的AI老师对话网站，可以模拟与礼明老师的实时对话，支持语音播放和对话记录管理。

## 功能特点

- 🤖 **智能对话**: 模拟礼明老师的回复风格和知识库
- 🎵 **语音播放**: 支持文字转语音，让对话更生动
- 💬 **实时聊天**: 现代化的聊天界面，支持实时对话
- 📊 **数据统计**: 查看对话统计和用户活跃度
- 📥 **数据导出**: 支持导出所有对话记录为JSON格式
- 📱 **响应式设计**: 支持手机、平板和桌面设备
- 🎨 **美观界面**: 现代化UI设计，用户体验优良

## 技术栈

- **后端**: Node.js + Express
- **前端**: 纯HTML/CSS/JavaScript
- **数据存储**: JSON文件存储
- **语音功能**: Web Speech API

## 安装和运行

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动服务器**
   ```bash
   npm start
   ```
   
   或者开发模式（自动重启）：
   ```bash
   npm run dev
   ```

3. **访问网站**
   打开浏览器访问: http://localhost:3000

## 项目结构

```
礼明老师智能体/
├── server.js              # 后端服务器
├── package.json           # 项目配置和依赖
├── public/                # 前端静态文件
│   ├── index.html        # 主页面
│   ├── styles.css        # 样式文件
│   ├── script.js         # 前端JavaScript
│   └── teacher-avatar.jpg # 老师头像
├── data/                 # 数据存储目录
│   └── conversations.json # 对话记录
└── README.md             # 项目说明
```

## API接口

### POST /api/chat
发送对话消息
```json
{
  "message": "用户消息",
  "userId": "用户ID"
}
```

### GET /api/stats
获取对话统计信息

### GET /api/export-conversations
导出所有对话记录

## 自定义配置

### 修改老师知识库
在 `server.js` 中的 `teacherKnowledge` 对象里添加更多知识内容：

```javascript
const teacherKnowledge = {
  commonQuestions: {
    "你的问题": "老师的回答",
    // 添加更多问答对
  }
};
```

### 更换老师头像
将新的头像图片替换 `public/teacher-avatar.jpg` 文件

### 修改UI样式
编辑 `public/styles.css` 文件来自定义界面样式

## 部署说明

1. **本地部署**: 直接运行 `npm start`
2. **云服务器部署**: 上传代码后安装依赖并启动
3. **Docker部署**: 可以创建Dockerfile进行容器化部署

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 注意事项

- 语音功能需要浏览器支持Web Speech API
- 数据存储在本地JSON文件中，重要数据请定期备份
- 生产环境建议使用数据库替代JSON文件存储

## 联系方式

如有问题或建议，请联系开发者。

## 许可证

MIT License 