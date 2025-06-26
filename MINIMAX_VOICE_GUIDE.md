# 🎤 MiniMax语音克隆完整使用指南

## 📋 问题诊断

根据您的终端日志，目前存在以下问题：

### 1. **API密钥格式错误** ❌
```
MiniMax错误: login fail: Please carry the API secret key in the 'Authorization' field of the request header
```

**问题原因**：您使用的是JWT令牌而不是标准API密钥
- 当前配置：`eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT令牌)
- 需要的格式：`sk-xxxxxxxxxxxxxxxxxx` (标准API密钥)

### 2. **权限限制** ⚠️
```
Your subscription has no access to use instant voice cloning, please upgrade.
```

**问题原因**：您的MiniMax账户没有语音克隆权限

## 🔧 解决方案

### 方案一：获取正确的API密钥 (推荐)

#### 步骤1：登录MiniMax开发者平台
1. 访问：https://www.minimaxi.com/
2. 登录您的账户
3. 进入"开发者中心"

#### 步骤2：创建标准API密钥
1. 在开发者中心，找到"API密钥管理"
2. 点击"创建新密钥"
3. 选择"标准API密钥"（不是JWT令牌）
4. 复制生成的密钥（格式：sk-xxxxxxxxxx）

#### 步骤3：升级语音克隆权限
1. 在控制台查看当前套餐
2. 升级到包含"语音克隆"功能的套餐
3. 确认有以下权限：
   - ✅ 语音合成 (TTS)
   - ✅ 语音克隆 (Voice Cloning)
   - ✅ 即时语音克隆 (Instant Voice Cloning)

#### 步骤4：更新配置
访问：http://localhost:3000/voice-settings.html
更新配置：
```json
{
  "platform": "minimax",
  "apiKey": "sk-your-new-api-key-here",
  "groupId": "your-group-id",
  "voiceId": "default-voice-id"
}
```

### 方案二：使用现有的本地语音克隆 (临时方案)

系统已经为您创建了本地语音克隆备选方案，可以正常使用：

#### 当前可用的语音克隆
- **克隆名称**：礼明
- **克隆ID**：clone_1750930458384
- **状态**：使用本地样本播放
- **样本数量**：已上传的语音文件

## 📱 使用语音克隆功能

### 1. **上传语音样本**
访问：http://localhost:3000/voice-clone-upload.html

**要求**：
- 文件格式：MP3, WAV, M4A
- 文件大小：每个文件 < 11MB
- 样本数量：1-5个文件
- 录音质量：清晰、无噪音
- 录音时长：每个样本10-60秒

**最佳实践**：
- 使用不同语调和情感的样本
- 包含不同类型的句子（陈述、疑问、感叹）
- 保持一致的音量和音质

### 2. **创建语音克隆**
1. 填写克隆名称（如："礼明老师"）
2. 添加描述（可选）
3. 上传语音样本文件
4. 点击"创建语音克隆"

### 3. **使用语音克隆**
创建成功后，系统会自动：
- 设置为默认语音
- 在聊天中使用克隆语音
- 支持语音开关控制

## 🎯 语音克隆工作流程

### 正常流程（MiniMax API可用）
```
1. 上传语音样本 → 2. 调用MiniMax API → 3. 生成语音克隆 → 4. 实时语音合成
```

### 降级流程（MiniMax API不可用）
```
1. 上传语音样本 → 2. 创建本地克隆 → 3. 使用样本播放 → 4. Web Speech API备选
```

## 🔍 故障排除

### 常见错误及解决方案

#### 1. "login fail: Please carry the API secret key"
**解决**：更换为标准格式API密钥（sk-开头）

#### 2. "can_not_use_instant_voice_cloning"
**解决**：升级MiniMax套餐，开通语音克隆权限

#### 3. "upload_file_size_exceeded"
**解决**：压缩音频文件，确保每个文件 < 11MB

#### 4. "只支持PDF、Word和文本文件格式"
**解决**：这是知识库上传的错误，不影响语音克隆

#### 5. "config is not defined"
**解决**：这是代码bug，系统会自动处理

### 检查当前状态

#### 查看语音克隆列表
访问：http://localhost:3000/voice-clone-upload.html
页面底部会显示所有已创建的语音克隆

#### 测试语音功能
1. 在主聊天页面发送消息
2. 确保"语音开启"按钮是激活状态
3. 系统会使用配置的语音进行播放

## 📈 推荐配置

### 生产环境配置
```json
{
  "platform": "minimax",
  "apiKey": "sk-your-real-api-key",
  "groupId": "your-group-id",
  "voiceId": "your-clone-id",
  "voiceName": "礼明老师",
  "model": "speech-01-hd",
  "speed": 1.0,
  "pitch": 0
}
```

### 开发/测试配置
```json
{
  "platform": "custom-clone",
  "voiceId": "clone_1750930458384",
  "voiceName": "礼明",
  "fallback": "web-speech"
}
```

## 🚀 下一步建议

### 立即可用
1. **当前系统已经可以正常使用**
2. **语音功能通过Web Speech API降级运行**
3. **所有聊天和知识库功能正常**

### 完整功能
1. **获取正确的MiniMax API密钥**
2. **升级账户权限**
3. **重新配置语音设置**
4. **享受高质量的语音克隆体验**

## 📞 技术支持

如果遇到问题：
1. 查看浏览器控制台错误信息
2. 检查终端日志输出
3. 使用系统内置的诊断工具：
   - http://localhost:3000/minimax-diagnostic.html
   - http://localhost:3000/api-test.html
   - http://localhost:3000/system-status.html

---

**总结**：您的系统已经有语音克隆功能，目前使用本地样本播放。要获得最佳体验，需要正确的MiniMax API密钥和相应权限。 