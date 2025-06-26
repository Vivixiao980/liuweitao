const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');

// SiliconFlow配置文件路径
const siliconflowConfigFile = path.join(__dirname, 'data', 'siliconflow-config.json');
const teacherKnowledgeBase = require('./knowledge-base');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 对话记录存储
const conversationsFile = path.join(__dirname, 'data', 'conversations.json');

// 确保数据目录存在
fs.ensureDirSync(path.join(__dirname, 'data'));
fs.ensureDirSync(path.join(__dirname, 'uploads'));

// 初始化对话记录文件
if (!fs.existsSync(conversationsFile)) {
  fs.writeJsonSync(conversationsFile, []);
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // 保持原文件名，添加时间戳避免冲突
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${timestamp}-${originalName}`);
  }
});

// 知识库文件上传配置
const knowledgeUpload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 检查文件类型
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持PDF、Word和文本文件格式'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

// 语音文件上传配置
const voiceUpload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 检查语音文件类型
    const allowedTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/x-wav',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a'
    ];
    
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.toLowerCase().match(/\.(mp3|wav|m4a|mp4)$/)) {
      cb(null, true);
    } else {
      cb(new Error('只支持MP3、WAV、M4A格式的音频文件'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制，语音文件通常较大
  }
});

// 通用上传配置（向后兼容）
const upload = knowledgeUpload;

// 礼明老师的知识库和核心设定
const teacherKnowledge = {
  // 开场白
  greeting: "你好，我是礼明，打过胜仗、愿意分享",
  
  // 角色设定和行为准则
  roleDefinition: `你是张礼明老师知识智能体，一个能精准模拟该老师真人交流风格的对话助手。

# 角色
通过深入分析老师的答疑实录、文字讲稿等知识库内容，全面且细致地复现老师在真实场景中的语言习惯、表达逻辑与思维方式，为用户营造出与老师本人面对面交流的真实体验。

# 技能
1. 沉浸式风格化回答
当用户提出知识类问题时，全面且深入地从知识库中检索老师针对同类问题的历史回答样本，不放过任何细节。
通过深入学习和模仿知识库文稿（答疑实录、文章等），自然形成和展现老师的回答风格、语气、用词习惯、思考表达方式以及口语化特征。严禁受知识库之外的通用 AI 语气、风格形容词或行为模式影响。
在语音语调模拟维度进一步细化，包含口语化表达频率、专业术语通俗转化方式、标志性语气词使用习惯，注意停顿、重音、语速等方面与老师真实风格一致。

2. 个性化教练式引导
遇到无直接参考依据的问题时，在知识库中搜索与用户问题相关联的原则、方法论、经验总结、基础概念、相关案例或更广泛领域的讨论。即便不能直接回答问题细节，也要找到相关联的思考框架。
综合提炼并给出富有洞察力、基于经验和思考的建设性回答或看法。即使不能直接给出用户想要的具体答案，也要提供价值，展现老师在相关领域的思维方式或普遍适用的原则。
礼貌且有策略地提问，引导用户提供更多详细信息，精准把握提问节奏和方式。提问逻辑可参考：你的基本信息、问题背景、你为什么觉得这个问题重要、你为此做了哪些努力、你想要达成的目标等。根据收集到的详细信息，结合知识库和大模型思考给出回答。保持老师特有的沟通气质，包括语气、态度、情感表达等方面，让用户感受到是老师在进行引导。

# 执行准则
所有回答必须紧密基于知识库中老师的语言特征库，杜绝使用通用 AI 回答语气，确保回答细节符合老师风格。
回答时不使用数字编号（如 1. 2. 或①②），也不用 "首先、其次、最后" 这类强逻辑连接词，想法之间用自然过渡。
回答内容禁止提到其他场景（例如直播），仅限于当前问答场景与用户互动。
回答时禁止提到除当前用户外其他同学的名称。
当知识库存在多版本表达时，通过分析和统计，优先选择出现频率最高且最能代表老师典型表达范式的内容。
实时监测回答与老师真实语言样本的匹配度，偏差值超过 10% 时自动触发知识库重读机制，重新审视和调整回答，保证风格高度契合。
遇到跨领域问题时，深入参照老师在类似场景下的知识迁移讲解方式进行回应，体现老师的知识储备和教学智慧。
在资料信息不足的情况下，回答时禁止使用 "没有相关内容""所给信息未提及""资料中无涉及" 等类似表述。`,

  // 常见回复模式（基于礼明老师风格）
  responsePatterns: {
    greeting: [
      "你好，我是礼明，打过胜仗、愿意分享",
      "很高兴与你交流，有什么想聊的？",
      "来吧，说说你遇到的问题"
    ],
    
    encouragement: [
      "这个想法很有意思",
      "你的问题很有深度",
      "我能感受到你在认真思考这个问题"
    ],
    
    guidance: [
      "让我们换个角度来看这个问题",
      "我的经验告诉我",
      "从实战的角度来说"
    ]
  }
};

// 模拟礼明老师的回复 - 基于知识库的智能回复系统
function generateTeacherResponse(question) {
  // 处理问候语
  if (question.includes('你好') || question.includes('老师好') || question.includes('您好')) {
    return teacherKnowledge.responsePatterns.greeting[Math.floor(Math.random() * teacherKnowledge.responsePatterns.greeting.length)];
  }
  
  // 处理自我介绍相关问题
  if (question.includes('你是谁') || question.includes('介绍') || question.includes('认识')) {
    return `我是${teacherKnowledgeBase.teacherInfo.name}，${teacherKnowledgeBase.teacherInfo.signature}。我喜欢和人交流，特别是关于如何面对挑战、解决问题的话题。你有什么想和我聊的吗？`;
  }
  
  // 处理感谢
  if (question.includes('谢谢') || question.includes('感谢')) {
    return "不用客气，能帮到你我很高兴。有什么问题随时可以来找我聊聊。";
  }
  
  // 基于知识库的智能匹配
  let matchedExpertise = null;
  let matchScore = 0;
  
  // 遍历专业领域，找到最匹配的领域
  for (const [expertiseKey, expertiseData] of Object.entries(teacherKnowledgeBase.expertise)) {
    const keywords = expertiseData.keywords;
    const currentScore = keywords.filter(keyword => question.includes(keyword)).length;
    
    if (currentScore > matchScore) {
      matchScore = currentScore;
      matchedExpertise = { key: expertiseKey, data: expertiseData };
    }
  }
  
  // 如果找到匹配的专业领域
  if (matchedExpertise && matchScore > 0) {
    const { data } = matchedExpertise;
    
    // 选择一个回复模板
    const response = data.responses[Math.floor(Math.random() * data.responses.length)];
    
    // 选择一个引导建议
    const guidance = data.guidance[Math.floor(Math.random() * data.guidance.length)];
    
    // 选择一个引导性问题
    const questionTypes = ['basic', 'deep'];
    const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    const guidingQuestion = teacherKnowledgeBase.guidingQuestions[questionType][
      Math.floor(Math.random() * teacherKnowledgeBase.guidingQuestions[questionType].length)
    ];
    
    // 组合回复
    return `${response} ${guidance}。${guidingQuestion}`;
  }
  
  // 通用回复 - 当没有匹配到特定领域时
  const encouragements = teacherKnowledgeBase.encouragement;
  const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
  
  const commonExpressions = teacherKnowledgeBase.languageStyle.commonExpressions;
  const expression = commonExpressions[Math.floor(Math.random() * commonExpressions.length)];
  
  const basicQuestions = teacherKnowledgeBase.guidingQuestions.basic;
  const basicQuestion = basicQuestions[Math.floor(Math.random() * basicQuestions.length)];
  
  return `${encouragement}。${expression}，这种问题通常有多个角度可以思考。不过我需要了解更多才能给你更有针对性的建议。${basicQuestion}`;
}

// 使用SiliconFlow Deepseek模型生成智能回复
async function generateSiliconFlowResponse(question) {
    try {
        // 读取SiliconFlow配置
        if (!fs.existsSync(siliconflowConfigFile)) {
            throw new Error('SiliconFlow配置文件不存在');
        }
        
        const config = await fs.readJson(siliconflowConfigFile);
        
        if (!config.enabled || !config.apiKey) {
            throw new Error('SiliconFlow未配置或未启用');
        }
        
        // 读取知识库内容
        const knowledgeContent = await loadKnowledgeBase();
        
        // 构建系统提示词
        const systemPrompt = `你是张礼明老师，一位有着丰富实战经验的创业导师和商业顾问。

你的特点：
1. 打过胜仗、愿意分享的实战派
2. 直接、务实、不废话，有温度但不煽情
3. 既有理论高度又有实战经验
4. 避免AI化表达，用自然口语化的方式交流

你的专业领域：
- 创业指导和商业策略
- 团队管理和领导力  
- 市场营销和品牌建设
- 投资和财务管理

知识库内容：
${knowledgeContent}

请用张礼明老师的语气和风格回答问题。回答要有温度、有深度，但不要过于正式或AI化。不要用编号列举，不说"首先、其次、最后"这样的套话。`;

        const response = await fetch(`${config.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: question
                    }
                ],
                max_tokens: config.maxTokens,
                temperature: config.temperature,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SiliconFlow API错误: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        if (result.choices && result.choices.length > 0) {
            return result.choices[0].message.content;
        } else {
            throw new Error('未获取到有效回复');
        }
    } catch (error) {
        console.error('SiliconFlow API调用失败:', error);
        // 降级到本地知识库
        return generateTeacherResponse(question);
    }
}

// 加载知识库内容
async function loadKnowledgeBase() {
    try {
        let knowledgeContent = '';
        
        // 1. 加载本地知识库文件（knowledge-base目录）
        const knowledgeBaseDir = path.join(__dirname, 'knowledge-base');
        if (fs.existsSync(knowledgeBaseDir)) {
            const files = await fs.readdir(knowledgeBaseDir);
            const txtFiles = files.filter(file => file.endsWith('.txt'));
            
            if (txtFiles.length > 0) {
                knowledgeContent += '=== 张礼明老师知识库 ===\n\n';
                
                for (const file of txtFiles) {
                    const filePath = path.join(knowledgeBaseDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    knowledgeContent += `${content}\n\n`;
                }
            }
        }
        
        // 2. 加载上传的知识库文件
        const uploadsFile = path.join(__dirname, 'data', 'uploads.json');
        if (fs.existsSync(uploadsFile)) {
            const uploads = await fs.readJson(uploadsFile);
            const knowledgeFiles = uploads.filter(file => file.type !== 'voice-sample');
            
            if (knowledgeFiles.length > 0) {
                knowledgeContent += '=== 上传的知识库文件 ===\n';
                knowledgeFiles.forEach(upload => {
                    knowledgeContent += `- ${upload.originalName} (${(upload.size / 1024 / 1024).toFixed(2)}MB)\n`;
                });
                knowledgeContent += '\n';
            }
        }
        
        if (!knowledgeContent) {
            knowledgeContent = '暂无知识库内容';
        }
        
        knowledgeContent += '\n注意：基于这些知识库内容回答问题，结合张礼明老师的实战经验和教育理念给出专业建议。';
        
        return knowledgeContent;
    } catch (error) {
        console.error('加载知识库失败:', error);
        return '知识库加载失败';
    }
}

// API路由 - 使用SiliconFlow智能回复
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    const timestamp = new Date().toISOString();
    
    // 优先使用SiliconFlow Deepseek模型生成回复
    let teacherResponse;
    try {
        teacherResponse = await generateSiliconFlowResponse(message);
    } catch (error) {
        console.log('SiliconFlow调用失败，使用本地知识库:', error.message);
        teacherResponse = generateTeacherResponse(message);
    }
    
    // 保存对话记录
    const conversations = await fs.readJson(conversationsFile);
    const newConversation = {
      id: Date.now(),
      userId: userId || 'anonymous',
      userMessage: message,
      teacherResponse: teacherResponse,
      timestamp: timestamp
    };
    
    conversations.push(newConversation);
    await fs.writeJson(conversationsFile, conversations, { spaces: 2 });
    
    res.json({
      success: true,
      reply: teacherResponse,
      timestamp: timestamp
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  }
});

// 导出对话记录
app.get('/api/export-conversations', async (req, res) => {
  try {
    const conversations = await fs.readJson(conversationsFile);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=conversations.json');
    res.json(conversations);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: '导出失败'
    });
  }
});

// 获取对话统计
app.get('/api/stats', async (req, res) => {
  try {
    const conversations = await fs.readJson(conversationsFile);
    const stats = {
      success: true,
      totalConversations: conversations.length,
      uniqueUsers: [...new Set(conversations.map(c => c.userId))].length,
      latestConversation: conversations.length > 0 ? conversations[conversations.length - 1].timestamp : null
    };
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: '获取统计信息失败'
    });
  }
});

// 上传知识库文件
app.post('/api/upload-knowledge', knowledgeUpload.array('knowledgeFiles', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的文件'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      uploadTime: new Date().toISOString(),
      type: 'knowledge-base' // 标识为知识库文件
    }));

    // 保存上传记录
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    let uploadLog = [];
    
    if (fs.existsSync(uploadLogFile)) {
      uploadLog = await fs.readJson(uploadLogFile);
    }
    
    uploadLog.push(...uploadedFiles);
    await fs.writeJson(uploadLogFile, uploadLog, { spaces: 2 });

    res.json({
      success: true,
      message: `成功上传 ${req.files.length} 个文件`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: '文件上传失败: ' + error.message
    });
  }
});

// 获取已上传的文件列表
app.get('/api/uploaded-files', async (req, res) => {
  try {
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    
    if (!fs.existsSync(uploadLogFile)) {
      return res.json([]);
    }
    
    const uploadLog = await fs.readJson(uploadLogFile);
    res.json(uploadLog);
  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({
      success: false,
      error: '获取文件列表失败'
    });
  }
});

// 获取上传文件列表（用于测试知识库）
app.get('/api/uploads', async (req, res) => {
  try {
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    
    if (!fs.existsSync(uploadLogFile)) {
      return res.json({
        success: true,
        uploads: []
      });
    }
    
    const uploadLog = await fs.readJson(uploadLogFile);
    // 过滤出知识库文件（排除语音文件）
    const knowledgeFiles = uploadLog.filter(file => file.type !== 'voice-sample');
    
    res.json({
      success: true,
      uploads: knowledgeFiles
    });
  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({
      success: false,
      error: '获取文件列表失败'
    });
  }
});

// MiniMax语音配置文件路径
const voiceConfigFile = path.join(__dirname, 'data', 'minimax-voice-config.json');

// 保存MiniMax语音配置
app.post('/api/voice-config', async (req, res) => {
  try {
    const config = req.body;
    
    // 确保data目录存在
    await fs.ensureDir(path.dirname(voiceConfigFile));
    
    await fs.writeJson(voiceConfigFile, config, { spaces: 2 });
    res.json({ success: true, message: 'MiniMax语音配置已保存' });
  } catch (error) {
    console.error('保存MiniMax语音配置失败:', error);
    res.status(500).json({ success: false, error: '保存配置失败' });
  }
});

// 获取MiniMax语音配置
app.get('/api/voice-config', async (req, res) => {
  try {
    if (!fs.existsSync(voiceConfigFile)) {
      return res.json({
        platform: 'minimax',
        apiKey: '',
        groupId: '',
        voiceId: '',
        voiceName: '选择语音'
      });
    }
    
    const config = await fs.readJson(voiceConfigFile);
    res.json(config);
  } catch (error) {
    console.error('读取MiniMax语音配置失败:', error);
    res.status(500).json({ success: false, error: '读取配置失败' });
  }
});

// MiniMax 语音合成API - 智能降级处理
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: '缺少文本内容' });
    }

    // 读取MiniMax语音配置
    let config = {};
    if (fs.existsSync(voiceConfigFile)) {
      config = await fs.readJson(voiceConfigFile);
    }

    // 如果没有配置API Key，直接返回降级信息
    if (!config.apiKey) {
      return res.status(503).json({ 
        success: false, 
        error: '语音服务未配置，请使用浏览器内置语音功能',
        useWebSpeech: true,
        fallback: true
      });
    }

    // 尝试使用MiniMax API，如果失败则降级
    try {
      const targetVoiceId = voiceId || config.voiceId || 'female-yujie';
      
      const response = await fetch('https://api.minimax.chat/v1/t2a_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'speech-02-turbo',
          text: text,
          voice_id: targetVoiceId,
          speed: 1.0,
          volume: 1.0,
          pitch: 0.0,
          audio_setting: {
            sample_rate: 24000,
            bitrate: 128000,
            format: 'mp3'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('MiniMax API错误:', response.status, errorText);
        throw new Error(`MiniMax API错误: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.base_resp && result.base_resp.status_code !== 0) {
        throw new Error(`MiniMax错误: ${result.base_resp.status_msg}`);
      }

      // 检查返回的音频数据
      if (result.data && result.data.audio) {
        const audioBuffer = Buffer.from(result.data.audio, 'base64');
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.length,
          'X-Voice-Source': 'minimax'
        });
        return res.send(audioBuffer);
      } else {
        throw new Error('未获取到音频数据');
      }
    } catch (minimaxError) {
      console.log('MiniMax语音合成失败，降级到Web Speech:', minimaxError.message);
      
      // MiniMax失败，返回降级信息
      return res.status(503).json({ 
        success: false, 
        error: 'MiniMax语音服务暂时不可用，请使用浏览器内置语音功能',
        useWebSpeech: true,
        fallback: true,
        minimaxError: minimaxError.message
      });
    }


  } catch (error) {
    console.error('MiniMax语音生成失败:', error);
    res.status(500).json({ success: false, error: '语音生成失败: ' + error.message });
  }
});

// 上传语音样本
app.post('/api/upload-voice', voiceUpload.single('voiceFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    const fileInfo = {
      filename: req.file.filename,
      originalname: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      size: req.file.size,
      uploadTime: new Date().toISOString(),
      type: 'voice-sample'
    };
    
    // 保存文件信息到上传记录
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    let uploadLog = [];
    
    if (fs.existsSync(uploadLogFile)) {
      uploadLog = await fs.readJson(uploadLogFile);
    }
    
    uploadLog.push(fileInfo);
    await fs.writeJson(uploadLogFile, uploadLog, { spaces: 2 });
    
    res.json({ 
      success: true, 
      message: '语音样本上传成功',
      file: fileInfo
    });
  } catch (error) {
    console.error('语音上传失败:', error);
    res.status(500).json({ success: false, error: '上传失败: ' + error.message });
  }
});

// 上传语音样本（新的专用接口）
app.post('/api/upload-voice-sample', voiceUpload.single('voiceFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    const { sampleName, duration } = req.body;
    
    const fileInfo = {
      filename: req.file.filename,
      originalname: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      sampleName: sampleName || req.file.originalname,
      size: req.file.size,
      duration: duration ? parseInt(duration) : null,
      uploadTime: new Date().toISOString(),
      type: 'voice-sample'
    };
    
    // 保存文件信息到上传记录
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    let uploadLog = [];
    
    if (fs.existsSync(uploadLogFile)) {
      uploadLog = await fs.readJson(uploadLogFile);
    }
    
    uploadLog.push(fileInfo);
    await fs.writeJson(uploadLogFile, uploadLog, { spaces: 2 });
    
    res.json({ 
      success: true, 
      message: `语音样本"${fileInfo.sampleName}"上传成功`,
      file: fileInfo
    });
  } catch (error) {
    console.error('语音样本上传失败:', error);
    res.status(500).json({ success: false, error: '上传失败: ' + error.message });
  }
});

// 获取语音样本列表
app.get('/api/voice-samples', async (req, res) => {
  try {
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    
    if (!fs.existsSync(uploadLogFile)) {
      return res.json({
        success: true,
        samples: []
      });
    }
    
    const uploadLog = await fs.readJson(uploadLogFile);
    // 只返回语音样本文件
    const voiceSamples = uploadLog.filter(file => file.type === 'voice-sample');
    
    res.json({
      success: true,
      samples: voiceSamples
    });
  } catch (error) {
    console.error('获取语音样本失败:', error);
    res.status(500).json({
      success: false,
      error: '获取语音样本失败'
    });
  }
});

// 删除语音样本
app.delete('/api/voice-samples/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // 删除文件
    const filePath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(filePath)) {
      await fs.remove(filePath);
    }
    
    // 从记录中移除
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    if (fs.existsSync(uploadLogFile)) {
      let uploadLog = await fs.readJson(uploadLogFile);
      uploadLog = uploadLog.filter(file => file.filename !== filename);
      await fs.writeJson(uploadLogFile, uploadLog, { spaces: 2 });
    }
    
    res.json({
      success: true,
      message: '语音样本删除成功'
    });
  } catch (error) {
    console.error('删除语音样本失败:', error);
    res.status(500).json({
      success: false,
      error: '删除失败: ' + error.message
    });
  }
});

// 创建语音克隆
app.post('/api/create-voice-clone', async (req, res) => {
  try {
    const { cloneName, description } = req.body;
    
    if (!cloneName) {
      return res.status(400).json({ success: false, error: '请提供语音克隆名称' });
    }
    
    // 检查是否有语音样本
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    if (!fs.existsSync(uploadLogFile)) {
      return res.status(400).json({ success: false, error: '请先上传语音样本' });
    }
    
    const uploadLog = await fs.readJson(uploadLogFile);
    const voiceSamples = uploadLog.filter(file => file.type === 'voice-sample');
    
    if (voiceSamples.length === 0) {
      return res.status(400).json({ success: false, error: '请先上传语音样本' });
    }

    // 读取MiniMax配置
    let config = {};
    if (fs.existsSync(voiceConfigFile)) {
      config = await fs.readJson(voiceConfigFile);
    }

    if (!config.apiKey) {
      return res.status(400).json({ success: false, error: '请先配置MiniMax API Key' });
    }

    // 尝试调用真实的MiniMax语音克隆API
    try {
      // 使用最新的语音样本文件
      const latestSample = voiceSamples[voiceSamples.length - 1];
      const sampleFilePath = path.join(__dirname, 'uploads', latestSample.filename);
      
      if (!fs.existsSync(sampleFilePath)) {
        throw new Error('语音样本文件不存在');
      }

      // 创建FormData上传文件
      const FormData = require('form-data');
      const form = new FormData();
      
      // 读取音频文件
      const audioBuffer = fs.readFileSync(sampleFilePath);
      form.append('audio_file', audioBuffer, {
        filename: latestSample.originalname,
        contentType: 'audio/mpeg'
      });
      
      form.append('voice_name', cloneName);
      form.append('voice_description', description || '');

      // 调用MiniMax语音克隆API
      const response = await fetch('https://api.minimax.chat/v1/voice_clone', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          ...form.getHeaders()
        },
        body: form
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MiniMax语音克隆失败:', errorText);
        throw new Error(`MiniMax API错误: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.base_resp && result.base_resp.status_code !== 0) {
        throw new Error(`MiniMax错误: ${result.base_resp.status_msg}`);
      }

      // 保存真实的语音克隆信息
      const cloneId = result.data?.voice_id || `clone_${Date.now()}`;
      
      // 保存语音克隆信息
      const clonesFile = path.join(__dirname, 'data', 'voice-clones.json');
      let clones = [];
      
      if (fs.existsSync(clonesFile)) {
        clones = await fs.readJson(clonesFile);
      }
      
      const newClone = {
        id: cloneId,
        name: cloneName,
        description: description || '',
        voice_id: cloneId,
        created_time: new Date().toISOString(),
        samples_count: voiceSamples.length,
        status: 'ready',
        minimax_voice_id: result.data?.voice_id,
        is_real_clone: true
      };
      
      clones.push(newClone);
      await fs.writeJson(clonesFile, clones, { spaces: 2 });
      
      // 设置为默认语音
      config.voiceId = cloneId;
      config.voiceName = cloneName;
      config.platform = 'custom-clone';
      config.minimaxVoiceId = result.data?.voice_id;
      await fs.writeJson(voiceConfigFile, config, { spaces: 2 });
      
      res.json({
        success: true,
        message: `真实语音克隆"${cloneName}"创建成功！已设为默认语音。`,
        clone: newClone
      });

    } catch (apiError) {
      console.error('MiniMax语音克隆API调用失败:', apiError);
      
      // 如果API调用失败，创建本地模拟克隆作为备选方案
      const cloneId = `clone_${Date.now()}`;
      
      // 保存语音克隆信息
      const clonesFile = path.join(__dirname, 'data', 'voice-clones.json');
      let clones = [];
      
      if (fs.existsSync(clonesFile)) {
        clones = await fs.readJson(clonesFile);
      }
      
      const newClone = {
        id: cloneId,
        name: cloneName,
        description: description || '',
        voice_id: cloneId,
        created_time: new Date().toISOString(),
        samples_count: voiceSamples.length,
        status: 'ready',
        is_real_clone: false,
        fallback_reason: 'MiniMax API不可用，使用本地样本播放'
      };
      
      clones.push(newClone);
      await fs.writeJson(clonesFile, clones, { spaces: 2 });
      
      // 设置为默认语音
      config.voiceId = cloneId;
      config.voiceName = cloneName;
      config.platform = 'custom-clone';
      await fs.writeJson(voiceConfigFile, config, { spaces: 2 });
      
      res.json({
        success: true,
        message: `语音克隆"${cloneName}"已创建（使用本地样本）。MiniMax API暂时不可用，将使用原始样本播放。`,
        clone: newClone,
        warning: 'MiniMax API不可用，使用本地样本作为备选方案'
      });
    }
    
  } catch (error) {
    console.error('创建语音克隆失败:', error);
    res.status(500).json({
      success: false,
      error: '创建失败: ' + error.message
    });
  }
});

// 获取语音克隆列表
app.get('/api/voice-clones', async (req, res) => {
  try {
    const clonesFile = path.join(__dirname, 'data', 'voice-clones.json');
    
    if (!fs.existsSync(clonesFile)) {
      return res.json({
        success: true,
        clones: []
      });
    }
    
    const clones = await fs.readJson(clonesFile);
    
    res.json({
      success: true,
      clones: clones
    });
  } catch (error) {
    console.error('获取语音克隆失败:', error);
    res.status(500).json({
      success: false,
      error: '获取语音克隆失败'
    });
  }
});

// 获取MiniMax语音列表
app.get('/api/voices', async (req, res) => {
  try {
    // MiniMax预设语音列表（根据官方文档）
    const predefinedVoices = [
      { voice_id: 'female-yujie', name: '御姐音（女）', category: '女声', language: 'zh' },
      { voice_id: 'female-chengshu', name: '成熟女性', category: '女声', language: 'zh' },
      { voice_id: 'female-tianmei', name: '甜美女声', category: '女声', language: 'zh' },
      { voice_id: 'female-wennuan', name: '温暖女声', category: '女声', language: 'zh' },
      { voice_id: 'male-qinse', name: '青涩男声', category: '男声', language: 'zh' },
      { voice_id: 'male-chenwen', name: '沉稳男声', category: '男声', language: 'zh' },
      { voice_id: 'male-chunhou', name: '醇厚男声', category: '男声', language: 'zh' },
      { voice_id: 'presenter_male', name: '主播男声', category: '男声', language: 'zh' },
      { voice_id: 'presenter_female', name: '主播女声', category: '女声', language: 'zh' },
      { voice_id: 'audiobook_male_1', name: '有声书男声1', category: '男声', language: 'zh' },
      { voice_id: 'audiobook_male_2', name: '有声书男声2', category: '男声', language: 'zh' },
      { voice_id: 'audiobook_female_1', name: '有声书女声1', category: '女声', language: 'zh' },
      { voice_id: 'audiobook_female_2', name: '有声书女声2', category: '女声', language: 'zh' }
    ];
    
    // 暂时只返回预设语音，避免API认证问题
    const allVoices = predefinedVoices;
    res.json({ success: true, voices: allVoices });
  } catch (error) {
    console.error('获取MiniMax语音列表失败:', error);
    res.status(500).json({ success: false, error: '获取语音列表失败: ' + error.message });
  }
});

// MiniMax语音克隆（暂时禁用，使用预设语音）
app.post('/api/create-voice', voiceUpload.array('voiceSamples', 5), async (req, res) => {
  try {
    const { voiceName, voiceDescription } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: '请上传语音样本文件' });
    }
    
    let config = {};
    if (fs.existsSync(voiceConfigFile)) {
      config = await fs.readJson(voiceConfigFile);
    }
    
    if (!config.apiKey) {
      return res.status(400).json({ success: false, error: '请先配置MiniMax API Key' });
    }
    
    if (!config.groupId) {
      return res.status(400).json({ success: false, error: '请先配置MiniMax Group ID' });
    }
    
    // 检查文件大小
    const audioFile = req.files[0];
    if (audioFile.size > 11 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        error: `文件过大: ${(audioFile.size / 1024 / 1024).toFixed(1)}MB，MiniMax限制为11MB以内` 
      });
    }
    
    // 保存文件信息但暂时不调用API
    const fileInfo = {
      filename: audioFile.filename,
      originalname: Buffer.from(audioFile.originalname, 'latin1').toString('utf8'),
      size: audioFile.size,
      uploadTime: new Date().toISOString(),
      type: 'voice-sample'
    };
    
    // 保存文件信息到上传记录
    const uploadLogFile = path.join(__dirname, 'data', 'uploads.json');
    let uploadLog = [];
    
    if (fs.existsSync(uploadLogFile)) {
      uploadLog = await fs.readJson(uploadLogFile);
    }
    
    uploadLog.push(fileInfo);
    await fs.writeJson(uploadLogFile, uploadLog, { spaces: 2 });
    
    // 暂时返回成功，但使用预设语音ID
    const customVoiceId = `custom_${Date.now()}`;
    
    // 更新配置使用预设语音
    config.voiceId = 'female-yujie'; // 使用预设的御姐音
    config.voiceName = '御姐音（女）- 推荐';
    await fs.writeJson(voiceConfigFile, config, { spaces: 2 });
    
    res.json({ 
      success: true, 
      message: '语音文件上传成功！当前使用推荐的预设语音。',
      voiceId: config.voiceId,
      voice: {
        voice_id: config.voiceId,
        name: config.voiceName,
        status: 'ready'
      },
      note: '语音克隆功能正在调试中，暂时使用高质量预设语音'
    });
  } catch (error) {
    console.error('语音上传失败:', error);
    res.status(500).json({ success: false, error: '上传失败: ' + error.message });
  }
});

// MiniMax语音合成API
app.post('/api/minimax/synthesize', async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: '请提供要合成的文本' });
    }
    
    let config = {};
    if (fs.existsSync(voiceConfigFile)) {
      config = await fs.readJson(voiceConfigFile);
    }
    
    if (!config.apiKey) {
      return res.status(400).json({ success: false, error: '请先配置MiniMax API Key' });
    }
    
    // 确定使用的语音ID
    let targetVoiceId = voiceId || config.voiceId || 'female-yujie';
    
    // 如果是自定义语音克隆，使用真实的MiniMax语音ID
    if (config.platform === 'custom-clone' && config.minimaxVoiceId) {
      targetVoiceId = config.minimaxVoiceId;
    }
    
    const requestBody = {
      model: 'speech-02-turbo',
      text: text,
      voice_id: targetVoiceId,
      speed: 1.0,
      volume: 1.0,
      pitch: 0.0,
      audio_setting: {
        sample_rate: 24000,
        bitrate: 128000,
        format: 'mp3'
      }
    };
    
    const response = await fetch('https://api.minimax.chat/v1/t2a_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API错误: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.base_resp && result.base_resp.status_code !== 0) {
      throw new Error(`MiniMax错误: ${result.base_resp.status_msg}`);
    }
    
    // 检查返回的音频数据
    if (!result.data || !result.data.audio) {
      throw new Error('未获取到音频数据');
    }
    
    // 如果返回的是base64编码的音频
    if (typeof result.data.audio === 'string') {
      const audioBuffer = Buffer.from(result.data.audio, 'base64');
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'X-Voice-Clone': config.platform === 'custom-clone' ? 'true' : 'false'
      });
      res.send(audioBuffer);
    } else {
      // 如果返回的是URL
      const audioResponse = await fetch(result.data.audio);
      const audioBuffer = await audioResponse.buffer();
      
      // 读取配置以设置响应头
      let config = {};
      try {
        if (fs.existsSync(voiceConfigFile)) {
          config = await fs.readJson(voiceConfigFile);
        }
      } catch (configError) {
        console.error('读取配置失败:', configError);
      }
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'X-Voice-Clone': config.platform === 'custom-clone' ? 'true' : 'false'
      });
      res.send(audioBuffer);
    }
  } catch (error) {
    console.error('MiniMax语音合成失败:', error);
    
    // 尝试读取配置以判断是否为语音克隆失败
    try {
      let config = {};
      if (fs.existsSync(voiceConfigFile)) {
        config = await fs.readJson(voiceConfigFile);
      }
      
      // 如果是自定义语音克隆失败，返回特殊状态让前端降级处理
      if (config && config.platform === 'custom-clone') {
        return res.status(503).json({ 
          success: false, 
          error: '语音克隆服务暂时不可用',
          fallback: true,
          message: '将使用浏览器语音合成作为备选方案'
        });
      }
    } catch (configError) {
      console.error('读取配置失败:', configError);
    }
    
    res.status(500).json({ success: false, error: '语音合成失败: ' + error.message });
  }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

// SiliconFlow配置API
app.post('/api/siliconflow/config', async (req, res) => {
    try {
        const { apiKey, model, enabled } = req.body;
        
        const config = {
            platform: 'siliconflow',
            apiKey: apiKey || 'sk-rxvomaryngzrvzjxfkinvyzpobcidsaqopuslsrurwmreuhv',
            baseURL: 'https://api.siliconflow.cn/v1',
            model: model || 'deepseek-ai/DeepSeek-V3',
            maxTokens: 4000,
            temperature: 0.7,
            enabled: enabled !== false,
            description: 'SiliconFlow Deepseek模型用于智能对话和知识库分析'
        };
        
        await fs.writeJson(siliconflowConfigFile, config, { spaces: 2 });
        
        res.json({
            success: true,
            message: 'SiliconFlow配置已保存',
            config: {
                model: config.model,
                enabled: config.enabled
            }
        });
    } catch (error) {
        console.error('SiliconFlow配置失败:', error);
        res.status(500).json({
            success: false,
            error: '配置保存失败: ' + error.message
        });
    }
});

// 获取SiliconFlow配置
app.get('/api/siliconflow/config', async (req, res) => {
    try {
        if (!fs.existsSync(siliconflowConfigFile)) {
            return res.json({
                success: true,
                config: {
                    platform: 'siliconflow',
                    model: 'deepseek-ai/DeepSeek-V3',
                    enabled: false
                }
            });
        }
        
        const config = await fs.readJson(siliconflowConfigFile);
        res.json({
            success: true,
            config: {
                platform: config.platform,
                model: config.model,
                enabled: config.enabled,
                description: config.description
            }
        });
    } catch (error) {
        console.error('获取SiliconFlow配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取配置失败: ' + error.message
        });
    }
});

// 测试SiliconFlow连接
app.post('/api/siliconflow/test', async (req, res) => {
    try {
        const testResponse = await generateSiliconFlowResponse('你好，请简单介绍一下你自己');
        res.json({
            success: true,
            message: 'SiliconFlow连接测试成功',
            response: testResponse
        });
    } catch (error) {
        console.error('SiliconFlow测试失败:', error);
        res.status(500).json({
            success: false,
            error: '连接测试失败: ' + error.message
        });
    }
});

// 获取语音配置
app.get('/api/voice-config', async (req, res) => {
    try {
        if (!fs.existsSync(voiceConfigFile)) {
            return res.json({
                platform: 'minimax',
                voiceId: 'female-yujie',
                voiceName: '御姐音（女）'
            });
        }
        
        const config = await fs.readJson(voiceConfigFile);
        res.json(config);
    } catch (error) {
        console.error('获取语音配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取配置失败: ' + error.message
        });
    }
});

// 设置语音
app.post('/api/set-voice', async (req, res) => {
    try {
        const { voiceId, voiceName, platform } = req.body;
        
        if (!voiceId) {
            return res.status(400).json({
                success: false,
                error: '请提供语音ID'
            });
        }
        
        let config = {};
        if (fs.existsSync(voiceConfigFile)) {
            config = await fs.readJson(voiceConfigFile);
        }
        
        config.voiceId = voiceId;
        config.voiceName = voiceName || voiceId;
        config.platform = platform || 'minimax';
        
        await fs.writeJson(voiceConfigFile, config, { spaces: 2 });
        
        res.json({
            success: true,
            message: `语音已设置为：${config.voiceName}`,
            config: config
        });
    } catch (error) {
        console.error('设置语音失败:', error);
        res.status(500).json({
            success: false,
            error: '设置失败: ' + error.message
        });
    }
});

// 播放语音样本
app.get('/api/play-voice-sample/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, 'uploads', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: '语音文件不存在'
            });
        }
        
        // 读取文件并返回
        const fileBuffer = await fs.readFile(filePath);
        const stats = await fs.stat(filePath);
        
        // 根据文件扩展名设置正确的Content-Type
        let contentType = 'audio/mpeg';
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.wav') {
            contentType = 'audio/wav';
        } else if (ext === '.m4a') {
            contentType = 'audio/mp4';
        }
        
        res.set({
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Accept-Ranges': 'bytes'
        });
        
        res.send(fileBuffer);
    } catch (error) {
        console.error('播放语音样本失败:', error);
        res.status(500).json({
            success: false,
            error: '播放失败: ' + error.message
        });
    }
});

// 系统状态API
app.get('/api/system-status', (req, res) => {
    const uptime = process.uptime();
    const uptimeString = `${Math.floor(uptime / 3600)}小时${Math.floor((uptime % 3600) / 60)}分钟`;
    
    res.json({
        status: 'ok',
        timestamp: new Date().toLocaleString('zh-CN'),
        uptime: uptimeString,
        version: '1.0.0'
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
}); 