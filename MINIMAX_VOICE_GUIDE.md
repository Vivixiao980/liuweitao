# MiniMax语音克隆功能使用指南

## 🎯 最新修复 (2024-12-30)

### ✅ 已修复的关键问题

1. **API路由不匹配** (已修复)
   - **问题**: 前端调用`/api/create-voice`，但服务器定义的是`/api/clone-voice`
   - **症状**: 返回HTML页面导致`Unexpected token '<'`错误
   - **修复**: 统一路由为`/api/clone-voice`

2. **文件参数名不匹配** (已修复)
   - **问题**: 前端发送`voiceSamples`，服务器期望`audioFiles`
   - **修复**: 服务器端改为接收`voiceSamples`参数

3. **文件类型过滤器错误** (已修复)
   - **问题**: 语音文件被知识库文件过滤器拦截
   - **修复**: 使用专门的`voiceUpload`配置处理语音文件

4. **API端点错误** (已修复)
   - **问题**: 使用了错误的API端点`api.minimax.chat`
   - **修复**: 更正为官方端点`api.minimaxi.com`

5. **语音克隆流程重构** (全新实现)
   - **问题**: 之前的实现不符合官方文档要求
   - **修复**: 按照官方文档重新实现完整流程
   - **新增**: 语音克隆管理页面，可以查看和管理所有克隆的音色

## 🔍 问题诊断历史

根据终端日志分析和官方文档研究，发现的问题：

### 1. API端点错误 ✅ (已修复)
- **错误**: 代码中使用了 `https://api.minimax.chat`
- **正确**: 应该使用 `https://api.minimaxi.com`
- **影响**: 导致404 page not found错误

### 2. 认证格式确认 ✅ (正确)
- **JWT令牌格式**: 您的JWT令牌格式是正确的
- **认证方式**: `Authorization: Bearer {JWT_TOKEN}`
- **无需更换**: 您当前的JWT令牌无需更换

### 3. 权限限制问题 ⚠️ (需要升级账户)
- **错误信息**: `can_not_use_instant_voice_cloning`
- **原因**: 账户可能没有即时语音克隆权限
- **解决**: 需要升级账户或申请相关权限

### 4. 代码Bug ✅ (已修复)
- **错误**: `ReferenceError: config is not defined`
- **状态**: 已修复

## 🛠️ 已修复的问题

### API路由修复
```javascript
// 修复前（错误）
const response = await fetch('/api/create-voice', {

// 修复后（正确）
const response = await fetch('/api/clone-voice', {
```

### 参数名称修复
```javascript
// 修复前（错误）
app.post('/api/clone-voice', upload.array('audioFiles', 5), 

// 修复后（正确）
app.post('/api/clone-voice', voiceUpload.array('voiceSamples', 10),
```

### API端点修复
```javascript
// 修复前（错误）
const response = await fetch('https://api.minimax.chat/v1/text_to_speech', {

// 修复后（正确）
const response = await fetch('https://api.minimaxi.com/v1/text_to_speech', {
```

## 📋 使用步骤

### 1. 验证API密钥格式 ✅
您的JWT令牌格式正确：
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. 检查账户权限 ⚠️
访问[MiniMax控制台](https://www.minimaxi.com/user-center/basic-information)检查：
- ✅ 语音合成权限
- ❌ 即时语音克隆权限 (需要升级)
- ✅ 基础语音克隆权限

### 3. 测试API功能
使用测试页面验证功能：
```
http://localhost:3000/test-voice-clone.html
```

### 4. 上传语音样本
- **格式支持**: MP3、WAV、M4A、MP4
- **文件大小**: 单个文件最大50MB
- **数量限制**: 最多10个文件
- **总大小**: 建议不超过100MB

## 🎯 当前系统状态

### ✅ 正常功能
- 语音合成API调用
- 文件上传和验证
- 错误处理和降级
- 本地语音样本播放

### ⚠️ 需要注意
- MiniMax账户权限限制
- API调用配额限制
- 网络连接稳定性

### 🔄 智能降级机制
当MiniMax API失败时，系统会：
1. 使用本地语音样本播放
2. 降级到Web Speech API
3. 提供友好的错误提示

## 🚀 语音克隆管理工具

### 🎭 语音克隆管理页面
创建了专门的语音克隆管理页面：`voice-clone-manager.html`

**功能特性**：
- 📁 **文件上传**: 支持多文件选择，实时显示文件信息
- 🎤 **语音克隆**: 按照官方文档实现的完整克隆流程
- 📋 **克隆列表**: 显示所有已创建的语音克隆
- 🔊 **试听功能**: 测试克隆语音的效果
- ✅ **一键使用**: 设置默认语音
- 🔄 **实时刷新**: 获取最新的克隆状态

### 📝 官方流程实现
根据MiniMax官方文档，实现了正确的语音克隆流程：

1. **文件上传** → `https://api.minimaxi.com/v1/files/upload`
   - 获取每个文件的`file_id`
   - 支持MP3、WAV、M4A格式
   - 单文件最大50MB

2. **语音克隆** → `https://api.minimaxi.com/v1/voice_clone`
   - 使用`file_id`列表和自定义`voice_id`
   - 创建专属语音克隆

3. **语音合成** → 使用克隆的`voice_id`进行语音生成

### 使用方法
1. 访问 `http://localhost:3000/voice-clone-manager.html`
2. 上传3-10分钟的清晰语音文件
3. 点击"创建语音克隆"
4. 等待处理完成
5. 在"我的语音克隆"中查看和管理

## 📞 技术支持

如果遇到问题，请检查：
1. **服务器日志**: 查看终端输出的错误信息
2. **浏览器控制台**: 检查前端JavaScript错误
3. **网络连接**: 确保可以访问MiniMax API
4. **账户权限**: 确认有足够的API权限和配额

## 🎉 成功案例

系统已成功实现：
- ✅ 完整的移动端适配
- ✅ 智能降级机制
- ✅ 本地语音克隆记录
- ✅ 多种语音合成方案
- ✅ 用户友好的错误处理

当前可以正常使用本地语音样本进行播放，为用户提供完整的语音体验。 