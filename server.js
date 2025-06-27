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

// MiniMax语音配置文件路径
const minimaxVoiceConfigFile = path.join(__dirname, 'data', 'minimax-voice-config.json');

// 语音配置管理函数
function loadVoiceConfig() {
  try {
    if (fs.existsSync(minimaxVoiceConfigFile)) {
      return fs.readJsonSync(minimaxVoiceConfigFile);
    } else {
      // 返回默认配置
      const defaultConfig = {
        platform: 'minimax',
        apiKey: '',
        groupId: '',
        voiceClones: {}
      };
      saveVoiceConfig(defaultConfig);
      return defaultConfig;
    }
  } catch (error) {
    console.error('加载语音配置失败:', error);
    return {
      platform: 'minimax',
      apiKey: '',
      groupId: '',
      voiceClones: {}
    };
  }
}

function saveVoiceConfig(config) {
  try {
    fs.writeJsonSync(minimaxVoiceConfigFile, config, { spaces: 2 });
    console.log('语音配置已保存');
  } catch (error) {
    console.error('保存语音配置失败:', error);
  }
}

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

// MiniMax API配置
const MINIMAX_API_BASE = 'https://api.minimaxi.com';

// MiniMax语音合成函数
async function generateMiniMaxAudio(text, voiceConfig) {
    try {
        console.log(`开始MiniMax语音合成: 文本="${text}", voice_id="${voiceConfig.voiceId}"`);
        
        // 使用正确的API端点和参数格式（按照用户提供的示例）
        const payload = {
            model: 'speech-02-hd',
            text: text,
            timber_weights: [
                {
                    voice_id: voiceConfig.voiceId,
                    weight: 100
                }
            ],
            voice_setting: {
                voice_id: "",
                speed: 1,
                pitch: 0,
                vol: 1,
                latex_read: false
            },
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: "mp3"
            },
            language_boost: "auto"
        };
        
        console.log('请求参数:', JSON.stringify(payload, null, 2));

        const response = await fetch(`https://api.minimaxi.com/v1/t2a_v2?GroupId=${voiceConfig.groupId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${voiceConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('MiniMax API错误响应:', response.status, errorText);
            throw new Error(`MiniMax API错误: ${response.status} - ${errorText}`);
        }

        // 检查响应内容类型
        const contentType = response.headers.get('content-type');
        console.log('响应内容类型:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
            // MiniMax TTS API可能返回JSON格式的响应，包含音频数据信息
            const responseData = await response.json();
            console.log('MiniMax API JSON响应:', JSON.stringify(responseData, null, 2));
            
            // 检查是否有错误
            if (responseData.base_resp && responseData.base_resp.status_code !== 0) {
                throw new Error(`MiniMax API错误: ${responseData.base_resp.status_msg}`);
            }
            
            // MiniMax API可能返回不同格式的音频数据
            // 检查是否有直接的音频数据字段
            let audioData = null;
            
            if (responseData.data && responseData.data.audio) {
                audioData = responseData.data.audio;
            } else if (responseData.audio) {
                audioData = responseData.audio;
            } else if (responseData.data && responseData.data.extra_info && responseData.data.extra_info.audio_size > 0) {
                // 如果有音频大小信息，说明有音频，但可能在其他字段
                console.log('检测到音频信息:', responseData.data.extra_info);
                
                // 尝试查找音频字段
                if (responseData.data.audio_file) {
                    audioData = responseData.data.audio_file;
                } else if (responseData.data.file_url) {
                    audioData = responseData.data.file_url;
                } else if (responseData.data.audio_path) {
                    audioData = responseData.data.audio_path;
                } else if (responseData.data.file_path) {
                    audioData = responseData.data.file_path;
                } else if (responseData.data.file_id) {
                    // 有些API返回file_id，需要单独下载
                    console.log('发现file_id，尝试下载音频:', responseData.data.file_id);
                    try {
                        const downloadUrl = `https://api.minimaxi.com/v1/files/${responseData.data.file_id}/content?GroupId=${voiceConfig.groupId}`;
                        const downloadResponse = await fetch(downloadUrl, {
                            headers: {
                                'Authorization': `Bearer ${voiceConfig.apiKey}`
                            }
                        });
                        
                        if (downloadResponse.ok && downloadResponse.headers.get('content-type')?.includes('audio')) {
                            const audioBuffer = await downloadResponse.arrayBuffer();
                            if (audioBuffer.byteLength > 1000) {
                                const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
                                const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                                
                                const audioDir = path.dirname(audioPath);
                                if (!fs.existsSync(audioDir)) {
                                    fs.mkdirSync(audioDir, { recursive: true });
                                }
                                
                                fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
                                const audioUrl = `/audio/${audioFileName}`;
                                console.log(`通过file_id下载音频成功，保存到: ${audioUrl}`);
                                return audioUrl;
                            }
                        }
                    } catch (downloadError) {
                        console.error('通过file_id下载音频失败:', downloadError);
                    }
                }
            }
            
            if (audioData) {
                // 如果有音频URL，直接返回
                if (typeof audioData === 'string' && audioData.startsWith('http')) {
                    console.log('获得音频URL:', audioData);
                    return audioData;
                }
                
                // 如果是base64数据，需要解码保存
                if (typeof audioData === 'string' && audioData.length > 100) {
                    try {
                        const audioBuffer = Buffer.from(audioData, 'base64');
                        const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
                        const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                        
                        // 确保audio目录存在
                        const audioDir = path.dirname(audioPath);
                        if (!fs.existsSync(audioDir)) {
                            fs.mkdirSync(audioDir, { recursive: true });
                        }
                        
                        fs.writeFileSync(audioPath, audioBuffer);
                        const audioUrl = `/audio/${audioFileName}`;
                        console.log(`语音合成成功，音频保存到: ${audioUrl}`);
                        return audioUrl;
                    } catch (decodeError) {
                        console.error('Base64解码失败:', decodeError);
                    }
                }
            }
            
            // 如果响应成功但没有找到音频数据，检查是否有base64编码的音频数据
            if (responseData.base_resp && responseData.base_resp.status_code === 0) {
                console.log('API响应成功但未找到直接音频数据，检查可能的base64编码数据');
                
                // 遍历响应数据，寻找可能的base64音频数据
                const findBase64Audio = (obj, path = '') => {
                    for (const [key, value] of Object.entries(obj)) {
                        const currentPath = path ? `${path}.${key}` : key;
                        
                        if (typeof value === 'string' && value.length > 10000) {
                            // 可能是base64编码的音频数据
                            console.log(`发现可能的base64音频数据在: ${currentPath}, 长度: ${value.length}`);
                            try {
                                const audioBuffer = Buffer.from(value, 'base64');
                                if (audioBuffer.length > 1000) {
                                    const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
                                    const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                                    
                                    const audioDir = path.dirname(audioPath);
                                    if (!fs.existsSync(audioDir)) {
                                        fs.mkdirSync(audioDir, { recursive: true });
                                    }
                                    
                                    fs.writeFileSync(audioPath, audioBuffer);
                                    const audioUrl = `/audio/${audioFileName}`;
                                    console.log(`Base64音频解码成功，保存到: ${audioUrl}`);
                                    return audioUrl;
                                }
                            } catch (decodeError) {
                                console.log(`Base64解码失败 (${currentPath}):`, decodeError.message);
                            }
                        } else if (typeof value === 'object' && value !== null) {
                            const result = findBase64Audio(value, currentPath);
                            if (result) return result;
                        }
                    }
                    return null;
                };
                
                const base64AudioUrl = findBase64Audio(responseData);
                if (base64AudioUrl) {
                    return base64AudioUrl;
                }
                
                // 如果还是没找到，尝试重新以流的方式请求
                console.log('未找到base64音频数据，尝试重新请求为流式响应');
                try {
                    const streamResponse = await fetch(`https://api.minimaxi.com/v1/t2a_v2?GroupId=${voiceConfig.groupId}`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${voiceConfig.apiKey}`,
                            'Content-Type': 'application/json',
                            'Accept': 'audio/mpeg, application/octet-stream'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    if (streamResponse.ok && !streamResponse.headers.get('content-type')?.includes('json')) {
                        const audioBuffer = await streamResponse.arrayBuffer();
                        if (audioBuffer.byteLength > 1000) {
                            const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
                            const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                            
                            const audioDir = path.dirname(audioPath);
                            if (!fs.existsSync(audioDir)) {
                                fs.mkdirSync(audioDir, { recursive: true });
                            }
                            
                            fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
                            const audioUrl = `/audio/${audioFileName}`;
                            console.log(`流式请求成功，音频保存到: ${audioUrl}`);
                            return audioUrl;
                        }
                    }
                } catch (streamError) {
                    console.error('流式请求失败:', streamError);
                }
            }
            
            // 如果JSON响应没有音频数据，抛出错误
            throw new Error('API响应中未找到音频数据');
        }

        // MiniMax TTS API返回音频文件流
        const audioBuffer = await response.arrayBuffer();
        
        // 检查音频数据大小
        if (audioBuffer.byteLength < 1000) {
            console.error('音频数据太小:', audioBuffer.byteLength, '字节');
            // 尝试解析为JSON查看错误
            try {
                const textData = new TextDecoder().decode(audioBuffer);
                console.error('小文件内容:', textData);
                const errorData = JSON.parse(textData);
                if (errorData.base_resp) {
                    throw new Error(`MiniMax API错误: ${errorData.base_resp.status_msg}`);
                }
            } catch (parseError) {
                // 如果不是JSON，继续处理
            }
            throw new Error('返回的音频数据无效（文件太小）');
        }
        
        // 保存音频文件
        const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
        const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
        
        // 确保audio目录存在
        const audioDir = path.dirname(audioPath);
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }
        
        fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
        
        const audioUrl = `/audio/${audioFileName}`;
        console.log(`语音合成成功，音频保存到: ${audioUrl}`);
        
        return audioUrl;
    } catch (error) {
        console.error('MiniMax语音合成详细错误:', error);
        throw new Error(`MiniMax语音合成失败: ${error.message}`);
    }
}

// MiniMax语音克隆函数
async function createMiniMaxVoiceClone(audioFiles, voiceConfig) {
    try {
        console.log('开始语音克隆流程，文件数量:', audioFiles.length);
        console.log('使用API配置:', {
            groupId: voiceConfig.groupId,
            hasApiKey: !!voiceConfig.apiKey
        });
        
        // 1. 通过File接口上传文件，得到file_id（按官方示例添加purpose参数）
        const uploadedFileIds = [];
        for (const file of audioFiles) {
            console.log(`上传文件: ${file.originalname}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file.path), {
                filename: file.originalname,
                contentType: file.mimetype
            });
            // 根据官方示例添加purpose参数
            formData.append('purpose', 'retrieval');

            const uploadResponse = await fetch(`https://api.minimaxi.com/v1/files/upload?GroupId=${voiceConfig.groupId}`, {
                method: 'POST',
                headers: {
                    'authority': 'api.minimaxi.com',
                    'Authorization': `Bearer ${voiceConfig.apiKey}`
                },
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error(`文件上传失败: ${file.originalname}`, uploadResponse.status, errorText);
                throw new Error(`文件上传失败: ${uploadResponse.status} - ${errorText}`);
            }

            const uploadResult = await uploadResponse.json();
            console.log(`文件上传响应:`, JSON.stringify(uploadResult, null, 2));
            
            // 根据官方示例，file_id在file.file_id中
            const fileId = uploadResult.file?.file_id || uploadResult.data?.file_id;
            if (!fileId) {
                throw new Error(`无法获取file_id，响应结构: ${JSON.stringify(uploadResult)}`);
            }
            
            console.log(`文件上传成功: ${file.originalname}, file_id: ${fileId}`);
            uploadedFileIds.push(fileId);
        }

        // 2. 生成自定义voice_id
        const customVoiceId = `liming_voice_${Date.now()}`;
        console.log('生成自定义voice_id:', customVoiceId);

        // 3. 调用语音克隆接口，使用file_id和自定义voice_id（按官方示例修改参数名）
        const clonePayload = {
            voice_id: customVoiceId,
            file_id: uploadedFileIds[0] // 官方示例使用单个file_id
        };
        
        console.log('调用语音克隆接口，参数:', JSON.stringify(clonePayload, null, 2));

        const cloneResponse = await fetch(`https://api.minimaxi.com/v1/voice_clone?GroupId=${voiceConfig.groupId}`, {
            method: 'POST',
            headers: {
                'authority': 'api.minimaxi.com',
                'Authorization': `Bearer ${voiceConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clonePayload)
        });

        if (!cloneResponse.ok) {
            const errorText = await cloneResponse.text();
            console.error('语音克隆API调用失败:', cloneResponse.status, errorText);
            throw new Error(`语音克隆失败: ${cloneResponse.status} - ${errorText}`);
        }

        const cloneResult = await cloneResponse.json();
        console.log('语音克隆成功:', JSON.stringify(cloneResult, null, 2));
        
        // 返回自定义的voice_id，这个ID将用于后续的语音合成
        return customVoiceId;
    } catch (error) {
        console.error('语音克隆流程失败:', error);
        throw new Error(`语音克隆失败: ${error.message}`);
    }
}

// 语音生成路由
app.post('/api/generate-speech', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: '缺少文本内容' });
        }

        // 读取语音配置
        const voiceConfig = loadVoiceConfig();
        
        if (!voiceConfig) {
            console.log('MiniMax语音合成失败，降级到Web Speech: 配置文件未找到');
            return res.json({ 
                success: true, 
                audioUrl: null,
                message: '使用浏览器内置语音合成'
            });
        }

        try {
            const audioUrl = await generateMiniMaxAudio(text, voiceConfig);
            res.json({ 
                success: true, 
                audioUrl: audioUrl,
                message: '语音生成成功'
            });
        } catch (error) {
            console.log('MiniMax语音合成失败，降级到Web Speech:', error.message);
            res.json({ 
                success: true, 
                audioUrl: null,
                message: '使用浏览器内置语音合成'
            });
        }
    } catch (error) {
        console.error('语音生成失败:', error);
        res.status(500).json({ error: '语音生成失败' });
    }
});

// 语音克隆路由
app.post('/api/clone-voice', voiceUpload.array('voiceSamples', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '请上传音频文件' });
        }

        // 读取语音配置
        const voiceConfig = loadVoiceConfig();
        
        if (!voiceConfig) {
            return res.status(400).json({ error: 'MiniMax配置未找到' });
        }

        try {
            const voiceId = await createMiniMaxVoiceClone(req.files, voiceConfig);
            
            // 更新配置文件
            voiceConfig.voiceId = voiceId;
            voiceConfig.voiceName = "礼明（克隆）";
            saveVoiceConfig(voiceConfig);
            
            res.json({ 
                success: true, 
                voiceId: voiceId,
                message: '语音克隆成功'
            });
        } catch (error) {
            console.error('MiniMax语音克隆API调用失败:', error);
            
            // 创建本地克隆记录
            const localCloneId = `clone_${Date.now()}`;
            voiceConfig.voiceId = localCloneId;
            voiceConfig.voiceName = "礼明（本地克隆）";
            voiceConfig.platform = 'custom-clone';
            saveVoiceConfig(voiceConfig);
            
            res.json({ 
                success: true, 
                voiceId: localCloneId,
                message: '已创建本地语音克隆记录，将使用本地样本播放'
            });
        }
    } catch (error) {
        console.error('语音克隆失败:', error);
        res.status(500).json({ error: '语音克隆失败' });
    } finally {
        // 清理上传的文件
        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('删除临时文件失败:', err);
                });
            });
        }
    }
});

// 获取语音克隆列表
app.get('/api/voice-clones', async (req, res) => {
    try {
        const voiceConfig = loadVoiceConfig();
        
        if (!voiceConfig) {
            return res.status(400).json({ error: 'MiniMax配置未找到' });
        }

        try {
            // 调用MiniMax API获取语音克隆列表
            const response = await fetch(`${MINIMAX_API_BASE}/v1/voice_clone/list?GroupId=${voiceConfig.groupId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${voiceConfig.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('获取语音克隆列表失败:', response.status, errorText);
                throw new Error(`获取列表失败: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('语音克隆列表:', JSON.stringify(result, null, 2));

            res.json({
                success: true,
                voices: result.data || [],
                message: '获取语音克隆列表成功'
            });
        } catch (error) {
            console.error('获取语音克隆列表失败:', error);
            // 返回本地配置的语音信息
            const localVoices = [];
            if (voiceConfig.voiceId && voiceConfig.voiceName) {
                localVoices.push({
                    voice_id: voiceConfig.voiceId,
                    voice_name: voiceConfig.voiceName,
                    status: voiceConfig.platform === 'custom-clone' ? 'local' : 'unknown'
                });
            }
            
            res.json({
                success: true,
                voices: localVoices,
                message: '使用本地语音配置'
            });
        }
    } catch (error) {
        console.error('获取语音克隆列表失败:', error);
        res.status(500).json({ error: '获取语音克隆列表失败' });
    }
});

// 语音合成路由 - 修复config未定义错误并支持本地克隆
app.post('/api/synthesize-speech', async (req, res) => {
    try {
        const { text, voiceId } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: '缺少文本内容' });
        }

        console.log(`开始语音合成，文本: "${text}", voiceId: ${voiceId || '默认'}`);

        // 读取语音配置
        const voiceConfig = loadVoiceConfig();
        
        if (!voiceConfig) {
            return res.status(400).json({ error: 'MiniMax配置未找到' });
        }

        // 注意：不再直接返回本地文件，而是尝试使用克隆的voice_id进行真正的语音合成

        try {
            // 使用指定的voiceId或配置中的默认voiceId
            const finalVoiceId = voiceId || voiceConfig.voiceId || 'male-qn-qingse';
            const audioUrl = await generateMiniMaxAudio(text, { ...voiceConfig, voiceId: finalVoiceId });
            
            res.json({ 
                success: true, 
                audio_url: audioUrl,
                audioUrl: audioUrl,  // 同时提供两种格式以保证兼容性
                voice_id: finalVoiceId,
                source: 'minimax',
                message: '语音合成成功'
            });
        } catch (error) {
            console.error('MiniMax语音合成失败:', error);
            
            // 降级到默认音色
            try {
                console.log('尝试使用默认音色进行语音合成');
                const audioUrl = await generateMiniMaxAudio(text, { ...voiceConfig, voiceId: 'male-qn-qingse' });
                
                res.json({ 
                    success: true, 
                    audio_url: audioUrl,
                    audioUrl: audioUrl,  // 同时提供两种格式以保证兼容性
                    voice_id: 'male-qn-qingse',
                    source: 'fallback',
                    message: '克隆音色不可用，使用默认音色'
                });
            } catch (fallbackError) {
                console.error('默认音色合成也失败:', fallbackError);
                
                // 智能降级策略
                console.log('MiniMax API不可用，启动智能降级策略');
                
                // 1. 如果是克隆语音，尝试使用本地样本（仅作为最后备选）
                if (voiceId && (voiceId.startsWith('clone_') || voiceId.startsWith('liming_voice'))) {
                    const voiceSamplesDir = path.join(__dirname, 'public', 'uploads', 'voice_samples');
                    if (fs.existsSync(voiceSamplesDir)) {
                        const files = fs.readdirSync(voiceSamplesDir);
                        const audioFile = files.find(file => 
                            file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.MP3')
                        );
                        
                        if (audioFile) {
                            const audioUrl = `/uploads/voice_samples/${audioFile}`;
                            console.log(`使用本地音频样本作为备选: ${audioUrl}`);
                            
                            return res.json({ 
                                success: true, 
                                audio_url: audioUrl,
                                audioUrl: audioUrl,
                                source: 'local_fallback',
                                message: '⚠️ MiniMax服务暂时不可用，播放本地语音样本。建议检查API配置或联系技术支持。'
                            });
                        }
                    }
                }
                
                // 2. 生成TTS提示音频（使用系统默认方式）
                try {
                    const fallbackText = `抱歉，语音合成服务暂时不可用。您要说的内容是：${text}`;
                    console.log('生成降级提示音频');
                    
                    return res.json({ 
                        success: true, 
                        audio_url: null,
                        audioUrl: null,
                        source: 'browser',
                        fallback_text: fallbackText,
                        message: '🔧 语音合成服务维护中，请使用浏览器内置语音或稍后重试'
                    });
                } catch (error) {
                    console.error('降级策略也失败:', error);
                    
                    return res.json({ 
                        success: false, 
                        error: 'MiniMax服务不可用，且降级方案失败',
                        message: '❌ 语音服务暂时不可用，请稍后重试或联系技术支持',
                        troubleshooting: {
                            'API状态': 'MiniMax认证失败',
                            '错误代码': '1004',
                            '建议': '检查API密钥是否有效，或联系MiniMax技术支持'
                        }
                    });
                }
            }
        }
    } catch (error) {
        console.error('语音合成失败:', error);
        res.status(500).json({ error: '语音合成失败' });
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
        if (!fs.existsSync(minimaxVoiceConfigFile)) {
            return res.json({
                platform: 'minimax',
                voiceId: 'male-qn-qingse',
                voiceName: '青涩音（男）'
            });
        }
        
        const config = await fs.readJson(minimaxVoiceConfigFile);
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
        if (fs.existsSync(minimaxVoiceConfigFile)) {
            config = await fs.readJson(minimaxVoiceConfigFile);
        }
        
        config.voiceId = voiceId;
        config.voiceName = voiceName || voiceId;
        config.platform = platform || 'minimax';
        
        await fs.writeJson(minimaxVoiceConfigFile, config, { spaces: 2 });
        
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

// 便捷路由：重定向到语音克隆管理页面
app.get('/voice-cloning', (req, res) => {
  res.redirect('/voice-clone-manager.html');
});

// MiniMax配置API
app.post('/api/minimax/config', async (req, res) => {
  try {
    const { platform, apiKey, groupId, voiceId, voiceName } = req.body;
    
    if (!apiKey || !groupId) {
      return res.status(400).json({ 
        success: false, 
        error: 'API密钥和Group ID是必填项' 
      });
    }

    const config = {
      platform: platform || 'minimax',
      apiKey: apiKey.trim(),
      groupId: groupId.trim(),
      voiceId: voiceId || 'male-qn-qingse',
      voiceName: voiceName || '礼明老师'
    };

    // 保存配置
    saveVoiceConfig(config);
    
    res.json({ 
      success: true, 
      message: 'MiniMax配置保存成功',
      config: {
        platform: config.platform,
        groupId: config.groupId,
        voiceId: config.voiceId,
        voiceName: config.voiceName,
        apiKeyFormat: config.apiKey.startsWith('sk-') ? 'sk-format' : 'jwt-format'
      }
    });
  } catch (error) {
    console.error('保存MiniMax配置失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '保存配置时发生错误: ' + error.message 
    });
  }
});

// 获取MiniMax配置API
app.get('/api/minimax/config', async (req, res) => {
  try {
    const config = loadVoiceConfig();
    
    if (!config) {
      return res.status(404).json({ 
        success: false, 
        error: '配置文件未找到' 
      });
    }

    // 返回配置（不包含完整的API密钥）
    res.json({ 
      success: true,
      config: {
        platform: config.platform,
        groupId: config.groupId,
        voiceId: config.voiceId,
        voiceName: config.voiceName,
        apiKeyFormat: config.apiKey ? (config.apiKey.startsWith('sk-') ? 'sk-format' : 'jwt-format') : 'not-set',
        hasApiKey: !!config.apiKey
      }
    });
  } catch (error) {
    console.error('获取MiniMax配置失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取配置时发生错误: ' + error.message 
    });
  }
});

// 语音样本上传接口（兼容前端调用）
app.post('/api/upload-voice-sample', voiceUpload.single('voiceSample'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传语音文件' });
        }

        console.log(`上传语音样本: ${req.file.originalname}, 大小: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
        
        // 保存到本地voice_samples目录
        const voiceSamplesDir = path.join(__dirname, 'public', 'uploads', 'voice_samples');
        if (!fs.existsSync(voiceSamplesDir)) {
            fs.mkdirSync(voiceSamplesDir, { recursive: true });
        }
        
        const fileExtension = path.extname(req.file.originalname);
        const simplifiedFileName = `voice_sample_${Date.now()}${fileExtension}`;
        const localFilePath = path.join(voiceSamplesDir, simplifiedFileName);
        
        // 复制文件到目标位置
        fs.copyFileSync(req.file.path, localFilePath);
        
        const audioUrl = `/uploads/voice_samples/${simplifiedFileName}`;
        console.log(`语音样本保存成功: ${audioUrl}`);
        
        res.json({
            success: true,
            filename: req.file.originalname,
            simplified_filename: simplifiedFileName,
            size: req.file.size,
            audio_url: audioUrl,
            message: '语音样本上传成功'
        });

    } catch (error) {
        console.error('语音样本上传失败:', error);
        res.status(500).json({ error: `上传失败: ${error.message}` });
    } finally {
        // 清理临时文件
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('删除临时文件失败:', err);
            });
        }
    }
});

// 文件上传接口（用于语音克隆测试）
app.post('/api/upload-file', voiceUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传文件' });
        }

        const voiceConfig = loadVoiceConfig();
        if (!voiceConfig) {
            return res.status(400).json({ error: 'MiniMax配置未找到' });
        }

        console.log(`开始上传文件: ${req.file.originalname}, 大小: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
        
        try {
            // 尝试上传到MiniMax
            const formData = new FormData();
            formData.append('purpose', 'retrieval');  // 使用官方示例的purpose
            formData.append('file', fs.createReadStream(req.file.path), {
                filename: req.file.originalname,
                contentType: req.file.mimetype
            });

            const uploadResponse = await fetch(`https://api.minimaxi.com/v1/files/upload?GroupId=${voiceConfig.groupId}`, {
                method: 'POST',
                headers: {
                    'authority': 'api.minimaxi.com',
                    'Authorization': `Bearer ${voiceConfig.apiKey}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            if (uploadResponse.ok) {
                const uploadResult = await uploadResponse.json();
                console.log(`文件上传响应:`, JSON.stringify(uploadResult, null, 2));
                
                const fileId = uploadResult.file?.file_id || uploadResult.data?.file_id;
                if (fileId) {
                    console.log(`文件上传成功: ${req.file.originalname}, file_id: ${fileId}`);
                    
                    res.json({
                        success: true,
                        file_id: fileId,
                        filename: req.file.originalname,
                        size: req.file.size,
                        source: 'minimax'
                    });
                    return;
                }
            }
            
            // 如果MiniMax上传失败，抛出错误进入降级逻辑
            const errorText = await uploadResponse.text();
            throw new Error(`MiniMax上传失败: ${uploadResponse.status} - ${errorText}`);
            
        } catch (error) {
            console.log(`MiniMax文件上传失败，使用本地降级方案: ${error.message}`);
            
            // 降级方案：创建本地file_id - 使用简化文件名避免中文字符问题
            const localFileId = `local_file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const fileExtension = path.extname(req.file.originalname);
            const simplifiedFileName = `voice_sample_${Date.now()}${fileExtension}`;
            const localFilePath = `uploads/voice_samples/${simplifiedFileName}`;
            
            // 确保目录存在
            const uploadDir = path.dirname(path.join(__dirname, 'public', localFilePath));
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            // 复制文件到本地存储
            const targetPath = path.join(__dirname, 'public', localFilePath);
            fs.copyFileSync(req.file.path, targetPath);
            
            console.log(`文件已保存到本地: ${localFilePath}`);
            console.log(`生成本地file_id: ${localFileId}`);
            
            res.json({
                success: true,
                file_id: localFileId,
                filename: req.file.originalname,
                simplified_filename: simplifiedFileName,  // 添加简化文件名
                size: req.file.size,
                source: 'local',
                local_path: localFilePath,
                message: '由于API密钥问题，文件已保存到本地，将使用本地模拟进行语音克隆'
            });
        }

    } catch (error) {
        console.error('文件上传失败:', error);
        res.status(500).json({ error: `文件上传失败: ${error.message}` });
    } finally {
        // 清理上传的临时文件
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('删除临时文件失败:', err);
            });
        }
    }
});

// 创建语音克隆接口（用于语音克隆测试）
app.post('/api/create-voice-clone', async (req, res) => {
    try {
        const { voice_id, file_ids } = req.body;
        
        if (!voice_id || !file_ids || file_ids.length === 0) {
            return res.status(400).json({ error: '缺少voice_id或file_ids参数' });
        }

        const voiceConfig = loadVoiceConfig();
        if (!voiceConfig) {
            return res.status(400).json({ error: 'MiniMax配置未找到' });
        }

        console.log(`开始创建语音克隆，voice_id: ${voice_id}, file_ids: ${file_ids.join(', ')}`);

        // 检查是否为本地file_id
        const isLocalFileId = file_ids[0].startsWith('local_file_');
        
        if (isLocalFileId) {
            console.log('检测到本地file_id，使用本地语音克隆模拟');
            
            // 本地语音克隆模拟
            const localCloneResult = {
                voice_id: voice_id,
                status: 'success',
                created_time: new Date().toISOString(),
                source: 'local',
                message: '本地语音克隆创建成功'
            };
            
            console.log('本地语音克隆成功:', JSON.stringify(localCloneResult, null, 2));
            
            res.json({
                success: true,
                voice_id: voice_id,
                result: localCloneResult,
                source: 'local'
            });
            return;
        }

        // 真实的MiniMax API调用
        const clonePayload = {
            voice_id: voice_id,
            file_id: file_ids[0] // 官方示例使用单个file_id
        };
        
        console.log('调用语音克隆接口，参数:', JSON.stringify(clonePayload, null, 2));

        const cloneResponse = await fetch(`https://api.minimaxi.com/v1/voice_clone?GroupId=${voiceConfig.groupId}`, {
            method: 'POST',
            headers: {
                'authority': 'api.minimaxi.com',
                'Authorization': `Bearer ${voiceConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(clonePayload)
        });

        if (!cloneResponse.ok) {
            const errorText = await cloneResponse.text();
            console.error('语音克隆API调用失败:', cloneResponse.status, errorText);
            throw new Error(`语音克隆失败: ${cloneResponse.status} - ${errorText}`);
        }

        const cloneResult = await cloneResponse.json();
        console.log('语音克隆成功:', JSON.stringify(cloneResult, null, 2));
        
        res.json({
            success: true,
            voice_id: voice_id,
            result: cloneResult,
            source: 'minimax'
        });

    } catch (error) {
        console.error('语音克隆失败:', error);
        res.status(500).json({ error: `语音克隆失败: ${error.message}` });
    }
});

// 测试语音合成接口（用于语音克隆测试）
app.post('/api/test-synthesis', async (req, res) => {
    try {
        const { text, voice_id } = req.body;
        
        if (!text || !voice_id) {
            return res.status(400).json({ error: '缺少text或voice_id参数' });
        }

        const voiceConfig = loadVoiceConfig();
        if (!voiceConfig) {
            return res.status(400).json({ error: 'MiniMax配置未找到' });
        }

        console.log(`开始语音合成测试，文本: "${text}", voice_id: ${voice_id}`);

        // 检查是否为本地克隆的voice_id
        if (voice_id.startsWith('liming_voice') || voice_id.includes('local')) {
            console.log('检测到本地克隆voice_id，查找对应的音频文件');
            
            // 查找本地音频文件
            const voiceSamplesDir = path.join(__dirname, 'public', 'uploads', 'voice_samples');
            if (fs.existsSync(voiceSamplesDir)) {
                const files = fs.readdirSync(voiceSamplesDir);
                const audioFile = files.find(file => 
                    file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.MP3')
                );
                
                if (audioFile) {
                    const audioUrl = `/uploads/voice_samples/${audioFile}`;
                    console.log(`使用本地音频文件: ${audioUrl}`);
                    
                    res.json({
                        success: true,
                        audio_url: audioUrl,
                        voice_id: voice_id,
                        source: 'local',
                        message: `使用本地音频样本播放（原文件：${audioFile}）`
                    });
                    return;
                }
            }
        }

        // 尝试MiniMax API语音合成
        try {
            const payload = {
                model: 'speech-02-hd',
                text: text,
                timber_weights: [
                    {
                        voice_id: voice_id,
                        weight: 100
                    }
                ],
                voice_setting: {
                    voice_id: "",
                    speed: 1,
                    pitch: 0,
                    vol: 1,
                    latex_read: false
                },
                audio_setting: {
                    sample_rate: 32000,
                    bitrate: 128000,
                    format: "mp3"
                },
                language_boost: "auto"
            };

            const response = await fetch(`https://api.minimaxi.com/v1/t2a_v2?GroupId=${voiceConfig.groupId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${voiceConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('语音合成失败:', response.status, errorText);
                throw new Error(`语音合成失败: ${response.status} - ${errorText}`);
            }

            // MiniMax返回音频文件
            const audioBuffer = await response.arrayBuffer();
            const audioFileName = `test_synthesis_${Date.now()}.mp3`;
            const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
            
            // 确保audio目录存在
            const audioDir = path.dirname(audioPath);
            if (!fs.existsSync(audioDir)) {
                fs.mkdirSync(audioDir, { recursive: true });
            }
            
            fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
            
            const audioUrl = `/audio/${audioFileName}`;
            console.log(`语音合成成功，音频保存到: ${audioUrl}`);
            
            res.json({
                success: true,
                audio_url: audioUrl,
                voice_id: voice_id,
                source: 'minimax'
            });
            
        } catch (error) {
            console.log(`MiniMax语音合成失败，使用默认音色: ${error.message}`);
            
            // 降级到默认音色
            const payload = {
                model: 'speech-02-hd',
                text: text,
                timber_weights: [
                    {
                        voice_id: 'male-qn-qingse',
                        weight: 100
                    }
                ],
                voice_setting: {
                    voice_id: "",
                    speed: 1,
                    pitch: 0,
                    vol: 1,
                    latex_read: false
                },
                audio_setting: {
                    sample_rate: 32000,
                    bitrate: 128000,
                    format: "mp3"
                },
                language_boost: "auto"
            };

            const response = await fetch(`https://api.minimaxi.com/v1/t2a_v2?GroupId=${voiceConfig.groupId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${voiceConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const audioBuffer = await response.arrayBuffer();
                const audioFileName = `fallback_synthesis_${Date.now()}.mp3`;
                const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                
                const audioDir = path.dirname(audioPath);
                if (!fs.existsSync(audioDir)) {
                    fs.mkdirSync(audioDir, { recursive: true });
                }
                
                fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
                
                const audioUrl = `/audio/${audioFileName}`;
                console.log(`使用默认音色合成成功: ${audioUrl}`);
                
                res.json({
                    success: true,
                    audio_url: audioUrl,
                    voice_id: 'male-qn-qingse',
                    source: 'fallback',
                    message: '克隆音色不可用，使用默认音色'
                });
            } else {
                throw new Error('所有语音合成方案都失败了');
            }
        }

    } catch (error) {
        console.error('语音合成测试失败:', error);
        res.status(500).json({ error: `语音合成失败: ${error.message}` });
    }
});

// 全局错误处理中间件 (必须放在所有路由和中间件之后)
app.use((err, req, res, next) => {
  console.error("全局错误处理器捕获到错误:", err);

  // 处理 Multer 抛出的错误
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      success: false,
      error: `文件上传错误: ${err.message}`,
      code: err.code 
    });
  }

  // 处理其他类型的错误
  if (err) {
    // 如果响应头已经发送，则将错误委托给 Express 的默认处理器
    if (res.headersSent) {
      return next(err);
    }
    return res.status(500).json({ 
      success: false,
      error: err.message || '服务器内部错误' 
    });
  }

  next();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
}); 