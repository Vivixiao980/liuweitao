// 全局变量
let isVoiceEnabled = true;
let userId = 'user_' + Date.now();
let messageCount = 0;

// DOM 元素
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const loadingOverlay = document.getElementById('loadingOverlay');
const charCounter = document.getElementById('charCounter');
const voiceToggle = document.getElementById('voiceToggle');
const audioPlayer = document.getElementById('audioPlayer');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadStats();
    setWelcomeTime();
});

function initializeApp() {
    // 输入框事件监听
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleKeyDown);
    
    // 自动调整输入框高度
    messageInput.addEventListener('input', autoResizeTextarea);
    
    // 加载统计数据
    loadStats();
}

function setWelcomeTime() {
    const welcomeTime = document.getElementById('welcomeTime');
    if (welcomeTime) {
        welcomeTime.textContent = formatTime(new Date());
    }
}

function handleInputChange() {
    const length = messageInput.value.length;
    charCounter.textContent = `${length}/1000`;
    
    // 更新发送按钮状态
    sendButton.disabled = length === 0 || length > 1000;
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// 发送消息
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || sendButton.disabled) return;
    
    // 显示用户消息
    addMessage(message, 'user');
    
    // 清空输入框
    messageInput.value = '';
    handleInputChange();
    autoResizeTextarea();
    
    // 显示加载状态
    showLoading(true);
    
    try {
        // 发送到服务器
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                userId: userId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 显示老师回复
            setTimeout(() => {
                addMessage(data.reply, 'teacher');
                
                // 语音播放
                if (isVoiceEnabled) {
                    speakText(data.reply);
                }
                
                // 更新统计
                loadStats();
            }, 1000); // 模拟思考时间
        } else {
            addMessage('抱歉，我现在遇到了一些技术问题，请稍后再试。', 'teacher');
        }
    } catch (error) {
        console.error('发送消息失败:', error);
        addMessage('网络连接出现问题，请检查网络后重试。', 'teacher');
    } finally {
        showLoading(false);
    }
}

// 添加消息到聊天界面
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const timestamp = formatTime(new Date());
    const avatarSrc = sender === 'teacher' ? 'teacher-avatar.svg' : 'user-avatar.svg';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <img src="${avatarSrc}" alt="${sender === 'teacher' ? '礼明老师' : '用户'}" 
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2MzY2ZjEiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxMCIgeT0iMTAiPgo8cGF0aCBkPSJNMjAgMjFWMTlBNCA0IDAgMCAwIDEyIDEySDEyQTQgNCAwIDAgMCA0IDE5VjIxIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4KPC9zdmc+'">
        </div>
        <div class="message-content">
            <div class="message-text">${formatMessageText(text)}</div>
            <div class="message-time">${timestamp}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    messageCount++;
}

// 格式化消息文本
function formatMessageText(text) {
    // 简单的文本格式化，可以根据需要扩展
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

// 格式化时间
function formatTime(date) {
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 滚动到底部
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 显示/隐藏加载状态
function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// 语音功能
function toggleVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    const icon = voiceToggle.querySelector('i');
    const text = voiceToggle.querySelector('span') || voiceToggle;
    
    if (isVoiceEnabled) {
        voiceToggle.classList.add('voice-enabled');
        icon.className = 'fa fa-volume-up';
        voiceToggle.innerHTML = '<i class="fa fa-volume-up"></i> 语音开启';
    } else {
        voiceToggle.classList.remove('voice-enabled');
        icon.className = 'fa fa-volume-mute';
        voiceToggle.innerHTML = '<i class="fa fa-volume-mute"></i> 语音关闭';
    }
}

// 文字转语音 - 支持语音克隆
async function speakText(text) {
    if (!isVoiceEnabled) return;
    
    // 停止当前播放
    speechSynthesis.cancel();
    
    try {
        // 首先尝试使用语音克隆API
        const response = await fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        
        if (response.ok && response.headers.get('content-type') === 'audio/mpeg') {
            // 使用语音克隆生成的音频
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onloadeddata = () => {
                audio.play().catch(e => {
                    console.error('语音播放失败:', e);
                    fallbackToWebSpeech(text);
                });
            };
            
            audio.onerror = () => {
                console.error('语音文件加载失败');
                fallbackToWebSpeech(text);
            };
            
            // 清理资源
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
            };
            
            return; // 成功使用语音克隆，直接返回
        } else if (response.status === 503) {
            // 处理503服务不可用状态，检查是否有fallback标志
            try {
                const errorData = await response.json();
                if (errorData.fallback || errorData.useWebSpeech) {
                    console.log('语音服务不可用，使用Web Speech API:', errorData.error);
                    fallbackToWebSpeech(text);
                    return;
                }
            } catch (e) {
                console.error('解析错误响应失败:', e);
            }
        }
    } catch (error) {
        console.error('语音克隆调用失败:', error);
    }
    
    // 如果语音克隆失败或未配置，回退到Web Speech API
    fallbackToWebSpeech(text);
}

// 回退到Web Speech API
function fallbackToWebSpeech(text) {
    if (!('speechSynthesis' in window)) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 0.8;
    
    // 尝试使用中文语音
    const voices = speechSynthesis.getVoices();
    const chineseVoice = voices.find(voice => 
        voice.lang.includes('zh') || voice.lang.includes('CN')
    );
    
    if (chineseVoice) {
        utterance.voice = chineseVoice;
    }
    
    speechSynthesis.speak(utterance);
}

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        if (stats) {
            const totalChats = document.getElementById('totalChats');
            const totalUsers = document.getElementById('totalUsers');
            
            if (totalChats) totalChats.textContent = stats.totalConversations || 0;
            if (totalUsers) totalUsers.textContent = stats.uniqueUsers || 0;
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 导出对话记录
async function exportConversations() {
    try {
        const response = await fetch('/api/export-conversations');
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `对话记录_${new Date().toLocaleDateString('zh-CN')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('对话记录导出成功！');
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败，请稍后重试。');
    }
}

// 显示/隐藏统计面板
function toggleStats() {
    const statsPanel = document.getElementById('statsPanel');
    const isVisible = statsPanel.style.display === 'flex';
    statsPanel.style.display = isVisible ? 'none' : 'flex';
    
    if (!isVisible) {
        loadStats();
    }
}

// 初始化语音API
window.addEventListener('load', function() {
    if ('speechSynthesis' in window) {
        // 预加载语音
        speechSynthesis.getVoices();
        speechSynthesis.addEventListener('voiceschanged', function() {
            // 语音列表加载完成
        });
    }
});

// 页面可见性变化处理
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 页面隐藏时停止语音
        speechSynthesis.cancel();
    }
});

// 错误处理
window.addEventListener('error', function(event) {
    console.error('页面错误:', event.error);
});

// 添加一些示例对话功能
function addExampleQuestions() {
    const examples = [
        "老师，您能介绍一下自己吗？",
        "我在学习上遇到了困难，该怎么办？",
        "您对学生有什么建议吗？",
        "谢谢老师的指导！"
    ];
    
    // 可以在界面上添加快捷问题按钮
    // 这里先预留接口
    return examples;
} 