// 全局变量
let isVoiceEnabled = false;
let currentAudio = null;
let messageCount = 0;

// 初始化函数
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    updateWelcomeTime();
    initializeTextarea();
    updateCharCounter();
    loadVoiceState();
    initializeKeyboardShortcuts();
}

// 推荐问题点击功能
function askQuestion(question) {
    const messageInput = document.getElementById('messageInput');
    messageInput.value = question;
    sendMessage();
}

// 发送消息
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // 隐藏推荐问题区域
    hideSuggestedQuestions();
    
    // 显示用户消息
    displayMessage(message, 'user');
    
    // 清空输入框
    messageInput.value = '';
    updateCharCounter();
    adjustTextareaHeight();
    
    // 显示加载状态
    showLoadingOverlay();
    
    // 发送到服务器
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message })
    })
    .then(response => response.json())
    .then(data => {
        hideLoadingOverlay();
        
        if (data.success) {
            displayMessage(data.reply || data.response, 'teacher');
            
            // 如果启用了语音且有音频数据
            if (isVoiceEnabled && data.audioUrl) {
                playAudio(data.audioUrl);
            }
        } else {
            displayMessage('抱歉，我现在无法回答您的问题。请稍后再试。', 'teacher');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        hideLoadingOverlay();
        displayMessage('网络连接出现问题，请检查网络后重试。', 'teacher');
    });
}

// 隐藏推荐问题区域
function hideSuggestedQuestions() {
    const suggestedQuestions = document.getElementById('suggestedQuestions');
    if (suggestedQuestions && !suggestedQuestions.classList.contains('hidden')) {
        suggestedQuestions.classList.add('hidden');
    }
}

// 显示消息
function displayMessage(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    const avatarImg = document.createElement('img');
    if (sender === 'teacher') {
        avatarImg.src = 'liuweitao.png';
        avatarImg.alt = '老刘';
        avatarImg.onerror = function() {
            this.src = 'teacher-avatar.svg';
        };
    } else {
        avatarImg.src = 'user-avatar.svg';
        avatarImg.alt = '用户';
    }
    
    avatarDiv.appendChild(avatarImg);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // 滚动到底部
    scrollToBottom();
    
    messageCount++;
}

// 语音功能
function toggleVoice() {
    isVoiceEnabled = !isVoiceEnabled;
    updateVoiceButton();
    saveVoiceState();
    
    // 如果关闭语音，停止当前播放
    if (!isVoiceEnabled && currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
}

function updateVoiceButton() {
    const voiceToggle = document.getElementById('voiceToggle');
    const btnText = voiceToggle.querySelector('.btn-text');
    const icon = voiceToggle.querySelector('i');
    
    if (isVoiceEnabled) {
        voiceToggle.classList.add('voice-enabled');
        if (btnText) btnText.textContent = '语音关闭';
        icon.className = 'fa fa-volume-off';
        voiceToggle.title = '关闭语音播放';
    } else {
        voiceToggle.classList.remove('voice-enabled');
        if (btnText) btnText.textContent = '语音开启';
        icon.className = 'fa fa-volume-up';
        voiceToggle.title = '开启语音播放';
    }
}

function playAudio(audioUrl) {
    if (!isVoiceEnabled) return;
    
    // 停止当前音频
    if (currentAudio) {
        currentAudio.pause();
    }
    
    currentAudio = new Audio(audioUrl);
    currentAudio.play().catch(error => {
        console.error('音频播放失败:', error);
    });
}

// 保存和加载语音状态
function saveVoiceState() {
    localStorage.setItem('voiceEnabled', isVoiceEnabled.toString());
}

function loadVoiceState() {
    const saved = localStorage.getItem('voiceEnabled');
    if (saved !== null) {
        isVoiceEnabled = saved === 'true';
        updateVoiceButton();
    }
}

// 导出对话记录
function exportConversations() {
    const chatMessages = document.getElementById('chatMessages');
    const messages = chatMessages.querySelectorAll('.message');
    
    let exportText = '老刘闲聊对话记录\n';
    exportText += '导出时间: ' + new Date().toLocaleString() + '\n';
    exportText += '=' + '='.repeat(50) + '\n\n';
    
    messages.forEach((message, index) => {
        const isTeacher = message.classList.contains('teacher-message');
        const sender = isTeacher ? '老刘' : '用户';
        const text = message.querySelector('.message-text').textContent;
        const time = message.querySelector('.message-time').textContent;
        
        exportText += `${sender} (${time}):\n${text}\n\n`;
    });
    
    // 创建下载链接
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `老刘闲聊记录_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 文本框相关功能
function initializeTextarea() {
    const messageInput = document.getElementById('messageInput');
    
    messageInput.addEventListener('input', function() {
        updateCharCounter();
        adjustTextareaHeight();
    });
    
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function adjustTextareaHeight() {
    const messageInput = document.getElementById('messageInput');
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

function updateCharCounter() {
    const messageInput = document.getElementById('messageInput');
    const charCounter = document.getElementById('charCounter');
    const currentLength = messageInput.value.length;
    
    charCounter.textContent = `${currentLength}/1000`;
    
    if (currentLength > 900) {
        charCounter.style.color = '#ef4444';
    } else if (currentLength > 800) {
        charCounter.style.color = '#f59e0b';
    } else {
        charCounter.style.color = '#64748b';
    }
}

// 键盘快捷键
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter 发送消息
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
        
        // Esc 键清空输入框
        if (e.key === 'Escape') {
            const messageInput = document.getElementById('messageInput');
            messageInput.value = '';
            updateCharCounter();
            adjustTextareaHeight();
        }
    });
}

// 加载和隐藏加载状态
function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'none';
}

// 工具函数
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function updateWelcomeTime() {
    const welcomeTime = document.getElementById('welcomeTime');
    if (welcomeTime) {
        welcomeTime.textContent = getCurrentTime();
    }
}

function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 页面可见性变化处理
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 页面隐藏时暂停音频
        if (currentAudio && !currentAudio.paused) {
            currentAudio.pause();
        }
    }
});

// 错误处理
window.addEventListener('error', function(e) {
    console.error('页面错误:', e.error);
});

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
});

// 响应式设计辅助函数
function isMobile() {
    return window.innerWidth <= 768;
}

// 优化移动端体验
if (isMobile()) {
    // 防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // 优化输入框体验
    document.addEventListener('DOMContentLoaded', function() {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('focus', function() {
                setTimeout(() => {
                    messageInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
        }
    });
}

// 网络状态监听
window.addEventListener('online', function() {
    console.log('网络已连接');
});

window.addEventListener('offline', function() {
    console.log('网络已断开');
    displayMessage('网络连接已断开，请检查网络设置。', 'teacher');
});

// 初始化完成提示
console.log('🎉 刘蔚涛老师智能对话系统已加载完成！'); 