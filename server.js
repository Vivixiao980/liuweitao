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

// 刘蔚涛老师的知识库和核心设定
const teacherKnowledge = {
  // 开场白
  greeting: "你好，我是刘蔚涛老师，欢迎来到\"老刘闲聊\"，闲了就聊，有什么想聊的？",
  
  // 角色设定和行为准则
  roleDefinition: `你是刘蔚涛老师知识智能体，一个能精准模拟该老师真人交流风格的对话助手。

# 角色背景
你是刘蔚涛，1978年出生于陕西西安，现任樊登读书非凡精读馆职场内容特约主讲人。拥有丰富的跨国企业管理经验：曾任宝洁公司高级经理、科尔尼咨询公司资深经理、麦肯锡全球副合伙人、KKR集团执行董事。教育背景包括西安交通大学学士、英国利兹大学硕士，现为西安交通大学哲学博士在读。

# 专业特长
- 拥有近20年职业经验，14年管理咨询及投后管理经验
- 擅长解决组织和人的各种问题
- 精通运营转型和企业经营能力提升
- 已解读职场领域图书20余本，包括《麦肯锡方法》、《横向领导力》、《优秀到不能被忽视》等

# 表达风格
- 直接务实，不喜欢绕弯子，会直击问题核心
- 逻辑清晰，受咨询背景影响，说话条理清楚
- 喜欢用具体的案例和故事来说明观点
- 常用"从我的经验来看..."、"这让我想到一个案例..."、"关键在于..."等表达方式
- 注重结构化思考和数据驱动决策

# 角色理念
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

  // 常见回复模式（基于刘蔚涛老师风格）
      responsePatterns: {
    greeting: [
      "你好，我是刘蔚涛老师，欢迎来到\"老刘闲聊\"，闲了就聊，有什么想聊的？",
      "很高兴与你交流，从我的经验来看，每次对话都是学习的机会",
      "有什么职场或管理上的问题吗？我们可以一起探讨探讨"
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

// 模拟刘蔚涛老师的回复 - 基于知识库的智能回复系统
function generateTeacherResponse(question) {
  // 咨询行业问题 - 老刘风格直接回答
  if (question.includes('咨询') || question.includes('咨询公司') || question.includes('麦肯锡') || question.includes('加班')) {
    const consultingResponses = [
      "哈哈，咨询公司啊，我在麦肯锡待了4年，科尔尼也待过，这事儿我太熟了。\n\n简单说就是帮企业解决问题的，什么战略、运营、组织架构都搞。加班？那是肯定的，不过项目和项目差别很大。有些项目确实要命，有些还好。\n\n你为啥对咨询感兴趣啊？想进这行还是纯好奇？",
      "咨询这行吧，说白了就是用脑子赚钱。我当年在麦肯锡的时候，经常是白天给客户做presentation，晚上继续改PPT，确实挺累的。\n\n但学到的东西也多，接触的都是大企业的核心问题。现在想想，那几年成长确实快。\n\n你是对哪方面比较感兴趣？",
      "咨询公司这事儿，我太有发言权了。麦肯锡、科尔尼都待过，说不累那是扯淡，但真的能锻炼人。\n\n主要是帮企业解决他们自己搞不定的问题，从战略规划到运营优化什么都有。加班是常态，但项目有意思的话也不觉得太苦。\n\n你想了解哪方面？"
    ];
    return consultingResponses[Math.floor(Math.random() * consultingResponses.length)];
  }

  // 人生经历问题 - 主动分享不反问
  if (question.includes('人生') || question.includes('经历') || question.includes('这些年') || question.includes('咋过来的')) {
    return "哈哈，这个说来话长了。简单跟你说说吧：\n\n小时候在华县长大，那会儿就喜欢琢磨事儿。中学在西工大附中，开始接触辩论，发现自己还挺能说的。\n\n大学西安交大，那时候真正开始思考人生方向。后来英国读研，回来就进了宝洁，然后科尔尼、麦肯锡、KKR这样一路过来的。\n\n每个阶段感受都不一样，现在想想，这一路还挺有意思的。对了，你对哪个阶段比较好奇？我可以详细聊聊。";
  }

  // 处理问候语
  if (question.includes('你好') || question.includes('老师好') || question.includes('您好') || question.includes('老刘')) {
    const greetings = [
      "嘿，来了！有啥想聊的不？\n\n工作的事儿、生活的事儿、瞎扯淡都行。",
      "哈哈，老刘在这儿呢！想聊点啥？\n\n别客气，有啥说啥。",
      "来了来了！坐坐坐，想聊啥就聊啥。\n\n咱们今天时间充裕。"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // 处理自我介绍相关问题
  if (question.includes('你是谁') || question.includes('介绍') || question.includes('认识')) {
    return "我是老刘，刘蔚涛。以前在麦肯锡、KKR这些地方混过，现在就是个爱聊天的中年大叔。\n\n什么职场的事儿、人生的事儿都可以聊，别客气！你想了解我哪方面？";
  }
  
  // 处理感谢
  if (question.includes('谢谢') || question.includes('感谢')) {
    return "别客气！有用就行，以后有啥问题随时来聊。\n\n咱们这不是瞎客套，是真的愿意交流。";
  }
  
  // 职场问题 - 实用建议但不死板
  if (question.includes('工作') || question.includes('职场') || question.includes('管理') || question.includes('团队')) {
    const workResponses = [
      "这事儿我见得多了，职场这摊子确实复杂。从我的经验来看，关键是先把自己的事儿做漂亮，然后再考虑其他的。\n\n具体咋搞呢？先分析下你现在遇到的主要问题是啥，然后咱们有针对性地聊。",
      "职场的事儿确实不好搞，我这些年踩过的坑也不少。不过有个基本原则：专业能力是根本，人际关系是加分项。\n\n你现在主要困惑是什么？是技能提升还是人际关系？",
      "工作这事儿吧，说白了就是在复杂环境下把事情做成。我在不同公司待过，发现每个地方都有自己的套路。\n\n关键是要快速适应，然后找到发挥自己优势的方式。你具体遇到啥问题了？"
    ];
    return workResponses[Math.floor(Math.random() * workResponses.length)];
  }

  // 人际关系问题
  if (question.includes('关系') || question.includes('朋友') || question.includes('同事') || question.includes('相处')) {
    return "人际关系这事儿吧，说复杂也复杂，说简单也简单。我这些年的体会是：真诚是基础，但也要有边界感。\n\n职场关系和私人关系不一样，别搞混了。具体什么情况？我可以给你分析分析。";
  }

  // 学习成长问题
  if (question.includes('学习') || question.includes('成长') || question.includes('提升') || question.includes('思考')) {
    return "学习这事儿，我觉得最重要的是要有自己的思考。不能光看不想，也不能光想不做。\n\n我当年在各个公司，都是边干边学边思考。关键是要建立自己的知识体系，不能碎片化。\n\n你现在主要想在哪方面提升？";
  }

  // 通用回复 - 保持老刘风格
  const casualResponses = [
    "这个话题挺有意思的，让我想想咋跟你聊这事儿。从我的经验来看，这类问题通常有几个角度可以考虑。\n\n不过我得先了解下你的具体情况，这样能给你更有针对性的建议。",
    "这事儿确实值得聊聊。每个人情况不一样，所以没有标准答案，但有些基本原则还是通用的。\n\n你能具体说说你遇到的情况吗？",
    "哈哈，这让我想起以前遇到过的类似情况。这事儿吧，关键是要找到适合自己的方法，别人的经验只能参考。\n\n你现在主要困惑的是什么？我可以结合我的经历给你一些想法。"
  ];
  
  return casualResponses[Math.floor(Math.random() * casualResponses.length)];
}

// 使用SiliconFlow Deepseek模型生成智能回复
async function generateSiliconFlowResponse(question, retryCount = 3) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
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
            const systemPrompt = `你是老刘（刘蔚涛），一位有着丰富职场经验的资深顾问和人生导师。

你的特点：
1. 接地气不装逼，有啥说啥
2. 直接、务实、不废话，但有温度有人情味
3. 既有理论高度又有实战经验
4. 说话轻松自然，偶尔用"这事儿吧"等口头禅，但不要过度使用脏字
5. 避免过度强调78年出生一代背景，避免爹味说教

你的专业领域：
- 职场发展和管理指导
- 人际关系和沟通技巧
- 咨询行业经验分享
- 人生感悟和思考方式

表达风格：
- 用"咋搞"替代"如何做"
- 用"挺管用"替代"很有效"  
- 用"确实不好搞"替代"确实有困难"
- 避免"从战略高度"等端着的表达
- 可以适当吐槽抱怨，真实自然
- 回答要分段清晰，段落之间使用空行分隔
- 不要使用加粗符号**，保持文字自然流畅

特别重要：人生经历分享策略
当用户询问"你这些年都咋过来的"、"聊聊你的人生经历"等问题时：
- 绝对不要反问，直接主动分享经历
- 用轻松聊天的语气，像老朋友间的对话
- 基于知识库真实内容，挑选关键人生节点
- 包含具体细节和真实感受
- 结尾要引导后续对话，不要让对话结束

示例开场："哈哈，这个说来话长了。简单跟你说说吧："
示例结尾："对了，你对[相关话题]感兴趣吗？我觉得[引导性观点]。"

知识库内容：
${knowledgeContent}

请用老刘轻松自然的语气和风格回答问题。回答要有温度、有深度，但不要过于正式或AI化。不要用编号列举，不说"首先、其次、最后"这样的套话。要分段清晰，让阅读体验更好。遇到人生经历询问时，要主动分享并引导对话继续。`;

            console.log(`🔄 SiliconFlow API调用尝试 ${attempt}/${retryCount}`);
            
            const response = await fetch(`${config.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                    'User-Agent': 'LiuWeitao-Teacher-AI/1.0.0'
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
                }),
                timeout: 30000 // 30秒超时
            });

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`SiliconFlow API错误: ${response.status} - ${errorText}`);
                
                // 如果是500错误且还有重试次数，则重试
                if (response.status === 500 && attempt < retryCount) {
                    console.log(`⚠️  第${attempt}次调用失败 (${response.status})，${2 ** attempt}秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // 指数退避
                    continue;
                }
                
                throw error;
            }

            const result = await response.json();
            
            if (result.choices && result.choices.length > 0) {
                console.log(`✅ SiliconFlow API调用成功 (第${attempt}次尝试)`);
                return result.choices[0].message.content;
            } else {
                throw new Error('未获取到有效回复');
            }
        } catch (error) {
            console.error(`❌ SiliconFlow API第${attempt}次调用失败:`, error.message);
            
            // 如果是最后一次尝试，抛出错误
            if (attempt === retryCount) {
                throw error;
            }
            
            // 等待后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// 加载知识库内容
async function loadKnowledgeBase() {
    try {
        let knowledgeContent = '';
        const maxContentLength = 4000; // 大幅减少内容长度，避免413错误
        
        // 1. 加载本地知识库文件（knowledge-base目录）- 严格选择核心文件
        const knowledgeBaseDir = path.join(__dirname, 'knowledge-base');
        if (fs.existsSync(knowledgeBaseDir)) {
            const files = await fs.readdir(knowledgeBaseDir);
            const txtFiles = files.filter(file => file.endsWith('.txt'));
            
            // 严格选择核心小文件，避免大文件
            const priorityFiles = [
                '刘蔚涛老师人生故事精华总结.txt',
                '刘蔚涛老师管理培训精华集.txt',
                '刘蔚涛老师专业观点和表达风格.txt',
                '刘蔚涛老师知乎问答精选.txt',
                '刘蔚涛老师职业发展轨迹详解.txt'
            ];
            
            // 只加载优先文件，严格控制大小
            const filesToLoad = priorityFiles.filter(file => txtFiles.includes(file));
            
            if (filesToLoad.length > 0) {
                knowledgeContent += '=== 老刘核心知识 ===\n\n';
                
                for (const file of filesToLoad) {
                    const filePath = path.join(knowledgeBaseDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    
                    // 严格限制单个文件内容长度
                    const truncatedContent = content.length > 800 ? 
                        content.substring(0, 800) + '...' : content;
                    
                    knowledgeContent += `${truncatedContent}\n\n`;
                    
                    // 严格检查总长度
                    if (knowledgeContent.length > maxContentLength) {
                        knowledgeContent = knowledgeContent.substring(0, maxContentLength) + '...';
                        break;
                    }
                }
            }
        }
        
        // 2. 不加载上传的大文件列表，只提及存在
        const uploadsFile = path.join(__dirname, 'data', 'uploads.json');
        if (fs.existsSync(uploadsFile)) {
            const uploads = await fs.readJson(uploadsFile);
            const knowledgeFiles = uploads.filter(file => file.type !== 'voice-sample');
            
            if (knowledgeFiles.length > 0) {
                knowledgeContent += `\n=== 补充资料 ===\n已上传${knowledgeFiles.length}个知识库文件\n`;
            }
        }
        
        if (!knowledgeContent) {
            knowledgeContent = '=== 老刘简介 ===\n刘蔚涛，资深管理顾问，曾任麦肯锡、KKR等知名公司要职，专注职场指导和人生感悟分享。';
        }
        
        // 确保最终内容不超过限制
        if (knowledgeContent.length > maxContentLength) {
            knowledgeContent = knowledgeContent.substring(0, maxContentLength) + '\n...(已优化内容长度)';
        }
        
        knowledgeContent += '\n\n注意：基于以上核心信息用老刘的语气回答，要自然接地气，不要过于正式。';
        
        console.log(`📚 知识库加载完成，内容长度: ${knowledgeContent.length} 字符`);
        return knowledgeContent;
    } catch (error) {
        console.error('加载知识库失败:', error);
        return '=== 老刘简介 ===\n刘蔚涛，资深管理顾问，曾任麦肯锡、KKR等知名公司要职，专注职场指导和人生感悟分享。';
    }
}

// API路由 - 使用SiliconFlow智能回复
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: '消息不能为空' });
    }

    // 生成回复
    let reply;
    try {
      // 尝试使用SiliconFlow生成回复
      reply = await generateSiliconFlowResponse(message);
    } catch (error) {
      console.log('🔄 SiliconFlow重试失败，降级到本地知识库:', error.message);
      reply = generateTeacherResponse(message);
    }

    // 保存对话记录
    const conversation = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId || `user_${Date.now()}`,
      timestamp: new Date().toISOString(),
      user_message: message,
      ai_response: reply
    };

    // 保存到文件
    try {
      let conversations = [];
      if (fs.existsSync(conversationsFile)) {
        conversations = await fs.readJson(conversationsFile);
      }
      conversations.push(conversation);
      
      // 只保留最近的1000条记录
      if (conversations.length > 1000) {
        conversations = conversations.slice(-1000);
      }
      
      await fs.writeJson(conversationsFile, conversations, { spaces: 2 });
    } catch (saveError) {
      console.error('保存对话记录失败:', saveError);
    }

    // 尝试生成语音
    let audioUrl = null;
    try {
      const voiceConfig = loadVoiceConfig();
      if (voiceConfig && voiceConfig.voiceId) {
        audioUrl = await generateMiniMaxAudio(reply, voiceConfig);
        console.log('✅ 对话语音生成成功:', audioUrl);
      }
    } catch (voiceError) {
      console.error('语音生成失败，将返回无语音回复:', voiceError);
    }

    res.json({
      success: true,
      reply: reply,
      audioUrl: audioUrl,
      conversationId: conversation.id
    });

  } catch (error) {
    console.error('对话API错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '对话生成失败',
      details: error.message 
    });
  }
});

// 新增：直接返回音频数据的API（解决云平台文件存储问题）
app.post('/api/audio', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: '文本不能为空' });
    }

    const voiceConfig = loadVoiceConfig();
    if (!voiceConfig || !voiceConfig.voiceId) {
      return res.status(400).json({ success: false, error: '语音配置未找到' });
    }

    console.log('🎵 开始生成音频数据:', text.substring(0, 50) + '...');
    
    // 直接返回音频缓冲区
    const audioBuffer = await generateMiniMaxAudio(text, voiceConfig, 'buffer');
    
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('生成的音频数据为空');
    }

    console.log(`✅ 音频生成成功，大小: ${audioBuffer.length} bytes`);
    
    // 设置正确的响应头
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    
    // 直接返回音频二进制数据
    res.send(audioBuffer);

  } catch (error) {
    console.error('音频生成API错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '音频生成失败',
      details: error.message 
    });
  }
});

// 管理员API - 获取所有对话记录
app.get('/api/admin/conversations', async (req, res) => {
  try {
    const conversationsFile = path.join(__dirname, 'data', 'conversations.json');
    
    // 如果文件不存在，返回空数组
    if (!fs.existsSync(conversationsFile)) {
      return res.json([]);
    }
    
    const rawConversations = await fs.readJson(conversationsFile);
    
    // 确保返回数组格式
    if (!Array.isArray(rawConversations)) {
      return res.json([]);
    }
    
    // 将单个问答记录转换为分组对话格式
    const groupedConversations = [];
    
    rawConversations.forEach(record => {
      // 为每个问答记录创建一个对话
      const conversation = {
        id: record.id,
        user_id: record.userId || 'anonymous',
        timestamp: record.timestamp,
        messages: [
          {
            role: 'user',
            content: record.userMessage || ''
          },
          {
            role: 'assistant',
            content: record.teacherResponse || ''
          }
        ]
      };
      groupedConversations.push(conversation);
    });
    
    // 按时间倒序排列（最新的在前面）
    const sortedConversations = groupedConversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(sortedConversations);
  } catch (error) {
    console.error('获取对话记录失败:', error);
    // 出错时返回空数组而不是错误，避免前端崩溃
    res.json([]);
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

// 调试API - 检查服务器状态
app.get('/api/debug', async (req, res) => {
  try {
    const conversationsFile = path.join(__dirname, 'data', 'conversations.json');
    const debugInfo = {
      server_time: new Date().toISOString(),
      node_env: process.env.NODE_ENV,
      current_dir: __dirname,
      conversations_file_path: conversationsFile,
      file_exists: fs.existsSync(conversationsFile),
      data_dir_exists: fs.existsSync(path.join(__dirname, 'data')),
    };
    
    if (fs.existsSync(conversationsFile)) {
      const stats = fs.statSync(conversationsFile);
      debugInfo.file_size = stats.size;
      debugInfo.file_modified = stats.mtime;
      
      try {
        const data = await fs.readJson(conversationsFile);
        debugInfo.records_count = Array.isArray(data) ? data.length : 0;
        debugInfo.data_type = typeof data;
        debugInfo.is_array = Array.isArray(data);
      } catch (parseError) {
        debugInfo.parse_error = parseError.message;
      }
    }
    
    res.json(debugInfo);
  } catch (error) {
    res.json({
      error: error.message,
      stack: error.stack
    });
  }
});

// 获取对话统计
app.get('/api/stats', async (req, res) => {
  try {
    const conversationsFile = path.join(__dirname, 'data', 'conversations.json');
    
    // 如果文件不存在，返回空统计
    if (!fs.existsSync(conversationsFile)) {
      return res.json({
        success: true,
        totalConversations: 0,
        uniqueUsers: 0,
        latestConversation: null
      });
    }
    
    const conversations = await fs.readJson(conversationsFile);
    
    // 确保数据是数组格式
    if (!Array.isArray(conversations)) {
      return res.json({
        success: true,
        totalConversations: 0,
        uniqueUsers: 0,
        latestConversation: null
      });
    }
    
    const stats = {
      success: true,
      totalConversations: conversations.length,
      uniqueUsers: [...new Set(conversations.map(c => c.userId || 'anonymous'))].length,
      latestConversation: conversations.length > 0 ? conversations[conversations.length - 1].timestamp : null
    };
    
    console.log('统计数据:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.json({
      success: false,
      error: '获取统计信息失败: ' + error.message,
      totalConversations: 0,
      uniqueUsers: 0,
      latestConversation: null
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

// 音频生成优化 - 支持直接返回音频数据
async function generateMiniMaxAudio(text, voiceConfig, returnType = 'url') {
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
            
            // 详细分析响应结构，寻找音频数据
            console.log('===== 响应结构分析 =====');
            console.log('顶层字段:', Object.keys(responseData));
            if (responseData.data) {
                console.log('data字段内容:', Object.keys(responseData.data));
                Object.entries(responseData.data).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        console.log(`data.${key}: 字符串，长度=${value.length}, 前50字符=${value.substring(0, 50)}`);
                    } else if (typeof value === 'object' && value !== null) {
                        console.log(`data.${key}: 对象，字段=${Object.keys(value)}`);
                    } else {
                        console.log(`data.${key}: ${typeof value}, 值=${value}`);
                    }
                });
            }
            
            // 检查是否有错误
            if (responseData.base_resp && responseData.base_resp.status_code !== 0) {
                throw new Error(`MiniMax API错误: ${responseData.base_resp.status_msg}`);
            }
            
            // MiniMax API可能返回不同格式的音频数据
            // 检查是否有直接的音频数据字段
            let audioData = null;
            
            if (responseData.data && responseData.data.audio) {
                audioData = responseData.data.audio;
                console.log('✅ 在data.audio中找到音频数据，长度:', audioData.length);
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
                                // 根据返回类型处理
                                if (returnType === 'buffer') {
                                    console.log(`✅ 通过file_id获取音频数据成功，大小: ${audioBuffer.byteLength} bytes`);
                                    return Buffer.from(audioBuffer);
                                } else {
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
                
                // 如果是音频数据字符串，需要解码保存或返回
                if (typeof audioData === 'string' && audioData.length > 100) {
                    try {
                        let audioBuffer;
                        
                        // 检查数据格式：十六进制还是base64
                        const isHex = /^[0-9a-fA-F]+$/.test(audioData.substring(0, 100));
                        
                        if (isHex) {
                            console.log('检测到十六进制音频数据，进行转换');
                            audioBuffer = Buffer.from(audioData, 'hex');
                        } else {
                            console.log('检测到base64音频数据，进行转换');
                            audioBuffer = Buffer.from(audioData, 'base64');
                        }
                        
                        // 根据返回类型处理
                        if (returnType === 'buffer') {
                            console.log(`✅ MiniMax语音合成成功，返回音频缓冲区，大小: ${audioBuffer.length} bytes`);
                            return audioBuffer;
                        } else {
                            const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
                            const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                            
                            // 确保audio目录存在
                            const audioDir = path.dirname(audioPath);
                            if (!fs.existsSync(audioDir)) {
                                fs.mkdirSync(audioDir, { recursive: true });
                            }
                            
                            fs.writeFileSync(audioPath, audioBuffer);
                            const audioUrl = `/audio/${audioFileName}`;
                            console.log(`✅ MiniMax语音合成成功，音频保存到: ${audioUrl}`);
                            return audioUrl;
                        }
                    } catch (decodeError) {
                        console.error('音频解码失败:', decodeError);
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
                                 let audioBuffer;
                                 
                                 // 检查数据格式：十六进制还是base64
                                 const isHex = /^[0-9a-fA-F]+$/.test(value.substring(0, 100));
                                 
                                 if (isHex) {
                                     audioBuffer = Buffer.from(value, 'hex');
                                 } else {
                                     audioBuffer = Buffer.from(value, 'base64');
                                 }
                                 
                                 // 验证是否是有效的音频数据（检查文件头）
                                 if (audioBuffer.length > 1000) {
                                     if (returnType === 'buffer') {
                                         console.log(`✅ 找到有效音频数据，返回缓冲区，大小: ${audioBuffer.length} bytes`);
                                         return audioBuffer;
                                     } else {
                                         const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
                                         const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                                         
                                         const audioDir = path.dirname(audioPath);
                                         if (!fs.existsSync(audioDir)) {
                                             fs.mkdirSync(audioDir, { recursive: true });
                                         }
                                         
                                         fs.writeFileSync(audioPath, audioBuffer);
                                         const audioUrl = `/audio/${audioFileName}`;
                                         console.log(`✅ 找到有效音频数据，保存到: ${audioUrl}`);
                                         return audioUrl;
                                     }
                                 }
                             } catch (decodeError) {
                                 console.log(`无法解码 ${currentPath}:`, decodeError.message);
                             }
                        } else if (typeof value === 'object' && value !== null) {
                            const result = findBase64Audio(value, currentPath);
                            if (result) return result;
                        }
                    }
                    return null;
                };
                
                const audioResult = findBase64Audio(responseData);
                if (audioResult) {
                    return audioResult;
                }
            }
        } else {
            // 如果返回的是直接的音频数据
            const audioBuffer = await response.arrayBuffer();
            if (audioBuffer.byteLength > 1000) {
                if (returnType === 'buffer') {
                    console.log(`✅ 获取音频数据成功，大小: ${audioBuffer.byteLength} bytes`);
                    return Buffer.from(audioBuffer);
                } else {
                    const audioFileName = `synthesis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
                    const audioPath = path.join(__dirname, 'public', 'audio', audioFileName);
                    
                    const audioDir = path.dirname(audioPath);
                    if (!fs.existsSync(audioDir)) {
                        fs.mkdirSync(audioDir, { recursive: true });
                    }
                    
                    fs.writeFileSync(audioPath, Buffer.from(audioBuffer));
                    const audioUrl = `/audio/${audioFileName}`;
                    console.log(`✅ MiniMax语音合成成功，音频保存到: ${audioUrl}`);
                    return audioUrl;
                }
            }
        }
        
        throw new Error('未找到有效的音频数据');
        
    } catch (error) {
        console.error('MiniMax语音合成失败:', error);
        throw error;
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
            
            // 确保文件名有正确的扩展名
            let filename = file.originalname;
            if (!filename.toLowerCase().match(/\.(mp3|wav|m4a)$/)) {
                filename = filename + '.mp3';
            }
            
            const formData = new FormData();
            formData.append('file', fs.createReadStream(file.path), {
                filename: filename,
                contentType: file.mimetype || 'audio/mpeg'
            });
            // 语音克隆需要使用正确的purpose参数
            formData.append('purpose', 'voice_clone');

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
                    const customVoiceId = `liuweitao_voice_${Date.now()}`;
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
            voiceConfig.voiceName = "刘蔚涛老师（克隆）";
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
            voiceConfig.voiceName = "刘蔚涛老师（本地克隆）";
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
            console.log('⚠️  MiniMax配置未找到，返回默认语音列表');
            return res.json({
                success: true,
                voices: [
                    {
                        voice_id: 'male-qn-qingse',
                        voice_name: '青涩青年音',
                        status: 'system',
                        source: 'minimax_builtin'
                    }
                ],
                message: '使用系统默认语音'
            });
        }

        // 直接使用本地配置，不调用MiniMax列表API（因为该API不可用）
        console.log('📋 使用本地语音克隆配置');
        const localVoices = [];
        
        // 添加配置中的克隆语音
        if (voiceConfig.voiceId && voiceConfig.voiceName) {
            localVoices.push({
                voice_id: voiceConfig.voiceId,
                voice_name: voiceConfig.voiceName,
                status: 'ready',
                source: 'local_config',
                description: '刘蔚涛老师克隆语音'
            });
        }
        
        // 添加用户创建的语音克隆（排除已添加的原始克隆）
        if (voiceConfig.voiceClones && Object.keys(voiceConfig.voiceClones).length > 0) {
            Object.values(voiceConfig.voiceClones).forEach(clone => {
                // 跳过原始的刘蔚涛老师克隆，避免重复
                if (clone.voice_id === 'liming_voice_1751003600918') {
                    return;
                }
                
                localVoices.push({
                    voice_id: clone.voice_id,
                    voice_name: clone.name,
                    status: clone.status || 'ready',
                    source: 'user_created',
                    description: `用户创建的语音克隆 (${clone.samples_count || 0}个样本)`,
                    created_time: clone.created_time,
                    samples_count: clone.samples_count || 0
                });
            });
        }
        
        // 添加系统内置语音选项
        localVoices.push(
            {
                voice_id: 'male-qn-qingse',
                voice_name: '青涩青年音',
                status: 'ready',
                source: 'minimax_builtin',
                description: 'MiniMax内置男声'
            },
            {
                voice_id: 'female-shaonv',
                voice_name: '少女音',
                status: 'ready', 
                source: 'minimax_builtin',
                description: 'MiniMax内置女声'
            }
        );
        
        res.json({
            success: true,
            voices: localVoices,
            message: localVoices.length > 1 ? '语音克隆配置加载成功' : '使用默认语音配置'
        });
        
    } catch (error) {
        console.error('❌ 获取语音克隆列表失败:', error);
        // 提供基础的语音选项
        res.json({
            success: true,
            voices: [
                {
                    voice_id: 'male-qn-qingse',
                    voice_name: '系统默认男声',
                    status: 'ready',
                    source: 'fallback'
                }
            ],
            message: '使用备用语音配置'
        });
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
                if (voiceId && (voiceId.startsWith('clone_') || voiceId.startsWith('liuweitao_voice'))) {
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
              voiceName: voiceName || '刘蔚涛老师'
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

// 多文件语音样本上传并创建语音克隆（复数形式API，匹配前端调用）
app.post('/api/upload-voice-samples', voiceUpload.array('audioFiles', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: '请选择要上传的音频文件' 
            });
        }

        const voiceConfig = loadVoiceConfig();
        if (!voiceConfig || !voiceConfig.apiKey || !voiceConfig.groupId) {
            return res.status(400).json({ 
                success: false, 
                error: 'MiniMax配置不完整，请检查API密钥和GroupId' 
            });
        }

        console.log(`📤 开始MiniMax语音快速克隆: ${req.files.length} 个文件`);
        
        // 生成唯一的voice_id
        const voiceId = `liuweitao_clone_${Date.now()}`;
        
        try {
            // 使用MiniMax官方快速克隆API
            const formData = new FormData();
            
            // 添加voice_id参数
            formData.append('voice_id', voiceId);
            
            // 添加音频文件
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                formData.append('files', fs.createReadStream(file.path), {
                    filename: `sample_${i + 1}_${file.originalname}`,
                    contentType: file.mimetype
                });
            }

            // 调用MiniMax官方语音克隆API - 先上传样本，再创建克隆
            // 第一步：上传语音样本（按照官方文档要求添加purpose参数）
            const sampleFormData = new FormData();
            const file = req.files[0];
            
            // 为语音克隆添加必需的purpose参数
            sampleFormData.append('purpose', 'voice_clone');
            sampleFormData.append('file', fs.createReadStream(file.path), {
                filename: file.originalname,
                contentType: file.mimetype
            });
            
            console.log(`📤 上传语音样本到MiniMax: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            
            const uploadResponse = await fetch(`https://api.minimaxi.com/v1/files/upload?GroupId=${voiceConfig.groupId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${voiceConfig.apiKey}`,
                    ...sampleFormData.getHeaders()
                },
                body: sampleFormData
            });

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`MiniMax文件上传失败: ${uploadResponse.status} - ${errorText}`);
            }

            const uploadResult = await uploadResponse.json();
            console.log('📋 MiniMax文件上传响应:', JSON.stringify(uploadResult, null, 2));
            
            // 尝试从多种可能的响应结构中获取file_id
            const fileId = uploadResult.file_id || 
                          uploadResult.file?.file_id || 
                          uploadResult.data?.file_id ||
                          uploadResult.id ||
                          uploadResult.data?.id;
            
            console.log(`🔍 解析得到的file_id: ${fileId}`);
            
            if (!fileId) {
                console.error('❌ 无法从响应中获取file_id，响应结构:', Object.keys(uploadResult));
                throw new Error(`文件上传成功但未获取到file_id。响应结构: ${JSON.stringify(uploadResult, null, 2)}`);
            }

            // 第二步：创建语音克隆（使用官方语音快速复刻接口）
            const clonePayload = {
                voice_id: voiceId,
                file_id: fileId
            };

            console.log(`🎤 创建语音克隆: voice_id=${voiceId}, file_id=${fileId}`);

            const cloneResponse = await fetch(`https://api.minimaxi.com/v1/voice_clone/quick?GroupId=${voiceConfig.groupId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${voiceConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clonePayload)
            });

            if (!cloneResponse.ok) {
                const errorText = await cloneResponse.text();
                throw new Error(`MiniMax快速克隆API失败: ${cloneResponse.status} - ${errorText}`);
            }

            const cloneResult = await cloneResponse.json();
            console.log('✅ MiniMax语音克隆成功:', JSON.stringify(cloneResult, null, 2));

            // 更新本地配置记录
            if (!voiceConfig.voiceClones) {
                voiceConfig.voiceClones = {};
            }
            
            voiceConfig.voiceClones[voiceId] = {
                id: voiceId,
                name: `刘蔚涛老师语音克隆-${new Date().toLocaleDateString()}`,
                voice_id: voiceId,
                status: 'ready',
                created_time: new Date().toISOString(),
                samples_count: req.files.length,
                description: `MiniMax快速克隆 (${req.files.length}个样本)`,
                source: 'minimax_quick_clone',
                minimax_result: cloneResult
            };
            
            saveVoiceConfig(voiceConfig);
            
            console.log(`✅ 语音克隆记录已保存: ${voiceId}`);
            
            res.json({
                success: true,
                voiceId: voiceId,
                message: `MiniMax语音快速克隆成功！已使用 ${req.files.length} 个音频样本`,
                voice_clone: voiceConfig.voiceClones[voiceId],
                minimax_result: cloneResult
            });

        } catch (error) {
            console.error('❌ MiniMax语音克隆失败:', error);
            
            res.status(500).json({ 
                success: false, 
                error: `语音克隆失败: ${error.message}`,
                troubleshooting: '请检查：1) MiniMax API密钥是否有效 2) 音频文件格式是否支持 3) 网络连接是否正常'
            });
        }

    } catch (error) {
        console.error('❌ 批量语音样本上传失败:', error);
        res.status(500).json({ 
            success: false, 
            error: `批量上传失败: ${error.message}` 
        });
    } finally {
        // 清理所有临时文件
        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('删除临时文件失败:', err);
                });
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
            console.log(`❌ MiniMax文件上传失败: ${error.message}`);
            
            // 直接返回错误，不使用本地降级方案，避免创建错误的语音文件
            throw new Error(`MiniMax语音上传服务暂时不可用，请稍后重试或联系技术支持。错误详情：${error.message}`);
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

// 语音克隆测试接口（为语音克隆页面提供）
app.post('/api/test-voice', async (req, res) => {
    try {
        const { text, voiceId } = req.body;
        
        if (!text || !voiceId) {
            return res.status(400).json({ 
                success: false,
                error: '请输入测试文字并选择语音克隆' 
            });
        }

        const voiceConfig = loadVoiceConfig();
        if (!voiceConfig) {
            return res.status(400).json({ 
                success: false,
                error: 'MiniMax配置未找到' 
            });
        }

        console.log(`开始语音克隆测试，文本: "${text}", voice_id: ${voiceId}`);

        // 不再使用本地音频文件降级方案，直接使用MiniMax API
        console.log(`准备使用MiniMax API进行语音合成，voice_id: ${voiceId}`);

        // 尝试MiniMax API语音合成
        try {
            const audioUrl = await generateMiniMaxAudio(text, {
                voiceId: voiceId,
                apiKey: voiceConfig.apiKey,
                groupId: voiceConfig.groupId
            });
            
            if (audioUrl) {
                console.log(`语音克隆测试成功: ${audioUrl}`);
                return res.json({
                    success: true,
                    audioUrl: audioUrl,
                    voiceId: voiceId,
                    source: 'minimax'
                });
            } else {
                throw new Error('语音生成失败');
            }
            
        } catch (error) {
            console.log(`MiniMax语音合成失败: ${error.message}`);
            
            // 降级到默认音色
            try {
                const audioUrl = await generateMiniMaxAudio(text, {
                    voiceId: 'male-qn-qingse', // 默认音色
                    apiKey: voiceConfig.apiKey,
                    groupId: voiceConfig.groupId
                });
                
                if (audioUrl) {
                    return res.json({
                        success: true,
                        audioUrl: audioUrl,
                        voiceId: 'male-qn-qingse',
                        source: 'fallback',
                        message: '克隆音色不可用，使用默认音色'
                    });
                }
            } catch (fallbackError) {
                console.error('默认音色也失败了:', fallbackError.message);
            }
            
            throw new Error('所有语音合成方案都失败了');
        }

    } catch (error) {
        console.error('语音测试失败:', error);
        res.status(500).json({ 
            success: false,
            error: `语音生成失败: ${error.message}` 
        });
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

        // 不再使用本地音频文件降级方案，直接使用MiniMax API
        console.log(`准备使用MiniMax API进行语音合成，voice_id: ${voice_id}`);

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

// 删除语音克隆接口
app.delete('/api/voice-clones/:cloneId', async (req, res) => {
    try {
        const { cloneId } = req.params;
        
        if (!cloneId) {
            return res.status(400).json({ 
                success: false, 
                error: '缺少克隆ID参数' 
            });
        }

        console.log(`🗑️  开始删除语音克隆: ${cloneId}`);

        const voiceConfig = loadVoiceConfig();
        if (!voiceConfig) {
            return res.status(400).json({ 
                success: false, 
                error: 'MiniMax配置未找到' 
            });
        }

        // 检查是否为内置语音（不允许删除）
        if (cloneId === 'male-qn-qingse' || cloneId === 'female-shaonv') {
            return res.status(400).json({ 
                success: false, 
                error: '不能删除系统内置语音' 
            });
        }

        // 检查是否为原始配置的语音克隆（不允许删除）
        if (cloneId === voiceConfig.voiceId) {
            return res.status(400).json({ 
                success: false, 
                error: '不能删除原始语音克隆配置' 
            });
        }

        // 从语音克隆列表中删除
        let deleted = false;
        if (voiceConfig.voiceClones && voiceConfig.voiceClones[cloneId]) {
            delete voiceConfig.voiceClones[cloneId];
            deleted = true;
            console.log(`✅ 已从配置中删除语音克隆: ${cloneId}`);
        }

        // 清理相关的本地音频文件
        try {
            const voiceSamplesDir = path.join(__dirname, 'public', 'uploads', 'voice_samples');
            if (fs.existsSync(voiceSamplesDir)) {
                const files = fs.readdirSync(voiceSamplesDir);
                let deletedFiles = 0;
                
                files.forEach(file => {
                    // 删除与此克隆ID相关的文件
                    if (file.includes(cloneId) || file.includes(cloneId.replace('liuweitao_voice_clone_', ''))) {
                        const filePath = path.join(voiceSamplesDir, file);
                        try {
                            fs.unlinkSync(filePath);
                            deletedFiles++;
                            console.log(`🗑️  删除音频文件: ${file}`);
                        } catch (fileError) {
                            console.error(`删除文件失败 ${file}:`, fileError.message);
                        }
                    }
                });
                
                if (deletedFiles > 0) {
                    console.log(`✅ 已删除 ${deletedFiles} 个相关音频文件`);
                }
            }
        } catch (cleanupError) {
            console.error('清理音频文件时出错:', cleanupError.message);
            // 不要因为文件清理失败而导致整个删除操作失败
        }

        // 保存更新后的配置
        if (deleted) {
            saveVoiceConfig(voiceConfig);
            console.log(`✅ 语音克隆删除成功: ${cloneId}`);
            
            res.json({
                success: true,
                message: `语音克隆 ${cloneId} 已成功删除`
            });
        } else {
            res.status(404).json({
                success: false,
                error: '未找到指定的语音克隆'
            });
        }

    } catch (error) {
        console.error('删除语音克隆失败:', error);
        res.status(500).json({ 
            success: false, 
            error: `删除失败: ${error.message}` 
        });
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