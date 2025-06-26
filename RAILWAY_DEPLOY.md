# 🚀 Railway部署指南

## 📋 部署前准备

### 1. 准备API密钥
确保您有以下API密钥：
- **MiniMax API密钥**：以`sk-`开头的标准API密钥
- **SiliconFlow API密钥**：用于AI对话功能

### 2. 检查项目文件
确保以下文件存在：
- ✅ `package.json` - 项目依赖
- ✅ `server.js` - 主服务器文件
- ✅ `railway.json` - Railway配置
- ✅ `Procfile` - 启动命令
- ✅ `.railwayignore` - 忽略文件

## 🚀 部署步骤

### 第一步：创建Railway项目

1. 访问 [Railway官网](https://railway.app)
2. 使用GitHub账户登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"

### 第二步：连接GitHub仓库

1. 如果项目还没有推送到GitHub：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/your-repo.git
   git push -u origin main
   ```

2. 在Railway中选择您的仓库
3. 点击 "Deploy Now"

### 第三步：配置环境变量

在Railway项目设置中添加以下环境变量：

#### 必需的环境变量：
```
MINIMAX_API_KEY=sk-your-minimax-api-key
MINIMAX_GROUP_ID=your-group-id
SILICONFLOW_API_KEY=your-siliconflow-api-key
NODE_ENV=production
```

#### 可选的环境变量：
```
APP_NAME=礼明老师智能体
```

### 第四步：部署设置

1. **构建设置**：
   - 构建命令：`npm install`
   - 启动命令：`npm start`

2. **健康检查**：
   - 路径：`/`
   - 超时：100秒

3. **重启策略**：
   - 类型：失败时重启
   - 最大重试次数：10次

## 🔧 部署后配置

### 1. 访问部署的应用
- Railway会提供一个域名，如：`https://your-app.railway.app`
- 访问该域名检查应用是否正常运行

### 2. 配置API密钥
1. 访问 `https://your-app.railway.app/settings.html`
2. 配置MiniMax和SiliconFlow API密钥
3. 测试语音合成和AI对话功能

### 3. 上传知识库
1. 访问 `https://your-app.railway.app/knowledge.html`
2. 上传礼明老师的相关文档
3. 测试知识库查询功能

## 📊 监控和维护

### 1. 查看日志
- 在Railway控制台中查看应用日志
- 监控错误和性能指标

### 2. 域名设置（可选）
- 在Railway项目设置中配置自定义域名
- 设置SSL证书（Railway自动提供）

### 3. 扩展设置
- 根据使用情况调整资源配置
- 设置自动扩展规则

## 🚨 常见问题

### Q1: 部署失败怎么办？
**A1**: 检查以下几点：
- 确保`package.json`中的依赖正确
- 检查环境变量是否正确设置
- 查看Railway部署日志了解具体错误

### Q2: API调用失败？
**A2**: 检查以下几点：
- 确保API密钥格式正确（MiniMax密钥以`sk-`开头）
- 检查API密钥是否有足够的权限和余额
- 确认网络连接正常

### Q3: 文件上传失败？
**A3**: 检查以下几点：
- Railway可能有文件大小限制
- 确保上传目录有写权限
- 检查文件格式是否支持

### Q4: 域名访问慢？
**A4**: 
- Railway使用全球CDN，首次访问可能较慢
- 考虑使用自定义域名
- 检查地理位置和网络连接

## 📝 部署检查清单

部署完成后，请检查以下功能：

- [ ] 主页正常加载
- [ ] AI对话功能正常
- [ ] 语音合成功能正常
- [ ] 知识库查询功能正常
- [ ] 文件上传功能正常
- [ ] 语音克隆功能正常（如果有权限）
- [ ] 设置页面正常工作
- [ ] 所有API端点响应正常

## 🎉 部署成功！

恭喜！您的礼明老师智能体已成功部署到Railway。

**下一步**：
1. 分享您的应用链接
2. 开始使用和测试功能
3. 根据需要调整配置
4. 监控应用性能和使用情况

## 📞 技术支持

如果遇到问题，可以：
1. 查看Railway官方文档
2. 检查项目日志
3. 联系技术支持

---

**注意**：确保您的API密钥安全，不要在公开的代码仓库中暴露密钥信息。 