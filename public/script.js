// 全局变量
let isVoiceEnabled = true; // 默认开启语音功能
let currentAudio = null;
let messageCount = 0;

// 移动端音频初始化标志
let mobileAudioInitialized = false;
let userHasInteracted = false;

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
    
    // 移动端音频初始化
    if (isMobile()) {
        initializeMobileAudio();
    }
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
            
            // 优化的语音处理逻辑
            if (data.audioUrl) {
                console.log('🎵 收到语音回复链接:', data.audioUrl);
                console.log('🔊 语音开关状态:', isVoiceEnabled ? '已开启' : '已关闭');
                
                if (isVoiceEnabled) {
                    console.log('▶️ 尝试播放语音...');
                    playAudio(data.audioUrl);
                } else {
                    console.log('💡 提示：语音功能已关闭，点击右上角"语音开启"按钮可听到语音回复');
                    showVoiceTip();
                }
            } else {
                // 尝试使用新的音频API生成语音
                if (isVoiceEnabled) {
                    console.log('🎵 尝试生成语音回复...');
                    generateAndPlayAudio(data.reply || data.response);
                } else {
                    console.log('❌ 本次回复无语音内容');
                }
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

// 新增：生成并播放音频（使用新的音频API）
async function generateAndPlayAudio(text) {
    if (!text || !isVoiceEnabled) return;
    
    try {
        console.log('🎵 调用音频生成API...');
        const response = await fetch('/api/audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });
        
        if (!response.ok) {
            throw new Error(`音频生成失败: ${response.status}`);
        }
        
        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('audio')) {
            // 获取音频二进制数据
            const audioBlob = await response.blob();
            console.log(`✅ 获取音频数据成功，大小: ${audioBlob.size} bytes`);
            
            // 创建 blob URL
            const audioUrl = URL.createObjectURL(audioBlob);
            console.log('🎵 创建 blob URL:', audioUrl);
            
            // 播放音频
            playAudioBlob(audioUrl);
        } else {
            // 如果返回的是JSON（错误信息）
            const errorData = await response.json();
            throw new Error(errorData.error || '音频生成失败');
        }
    } catch (error) {
        console.error('生成音频失败:', error);
        // 显示错误提示但不阻止正常使用
        showAudioError('语音生成失败: ' + error.message);
    }
}

// 新增：播放blob音频
function playAudioBlob(blobUrl) {
    if (!isVoiceEnabled) {
        console.log('语音未开启，跳过播放');
        // 释放blob URL
        URL.revokeObjectURL(blobUrl);
        return;
    }
    
    // 移动端使用专用播放函数
    if (isMobile()) {
        playAudioOnMobile(blobUrl);
        return;
    }
    
    console.log('尝试播放blob音频:', blobUrl);
    
    // 停止当前音频
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    try {
        currentAudio = new Audio(blobUrl);
        
        // 添加音频事件监听
        currentAudio.addEventListener('loadstart', () => {
            console.log('开始加载音频');
        });
        
        currentAudio.addEventListener('canplay', () => {
            console.log('音频可以播放');
        });
        
        currentAudio.addEventListener('play', () => {
            console.log('音频开始播放');
        });
        
        currentAudio.addEventListener('ended', () => {
            console.log('音频播放完成');
            currentAudio = null;
            // 释放blob URL
            URL.revokeObjectURL(blobUrl);
            // 移除播放指示器
            const indicator = document.querySelector('.playing-indicator');
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        });
        
        currentAudio.addEventListener('error', (e) => {
            console.error('音频加载/播放错误:', e);
            // 释放blob URL
            URL.revokeObjectURL(blobUrl);
            showAudioError('音频播放失败');
        });
        
        // 尝试播放
        const playPromise = currentAudio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('✅ 音频播放成功');
                showPlayingIndicator();
            }).catch(error => {
                console.error('❌ 音频播放失败:', error);
                // 释放blob URL
                URL.revokeObjectURL(blobUrl);
                if (error.name === 'NotAllowedError') {
                    showAudioPermissionTip();
                } else {
                    showAudioError('音频播放失败');
                }
            });
        }
    } catch (error) {
        console.error('创建音频对象失败:', error);
        // 释放blob URL
        URL.revokeObjectURL(blobUrl);
        showAudioError('音频创建失败');
    }
}

// 修改原有的playAudio函数（保持向后兼容）
function playAudio(audioUrl) {
    if (!isVoiceEnabled) {
        console.log('语音未开启，跳过播放');
        return;
    }
    
    console.log('尝试播放语音:', audioUrl);
    
    // 停止当前音频
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    try {
        currentAudio = new Audio(audioUrl);
        
        // 添加音频事件监听
        currentAudio.addEventListener('loadstart', () => {
            console.log('开始加载音频');
        });
        
        currentAudio.addEventListener('canplay', () => {
            console.log('音频可以播放');
        });
        
        currentAudio.addEventListener('play', () => {
            console.log('音频开始播放');
        });
        
        currentAudio.addEventListener('ended', () => {
            console.log('音频播放完成');
            currentAudio = null;
            // 移除播放指示器
            const indicator = document.querySelector('.playing-indicator');
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        });
        
        currentAudio.addEventListener('error', (e) => {
            console.error('音频加载/播放错误:', e);
            // 如果传统URL加载失败，尝试使用新的音频API
            console.log('🔄 传统音频URL失败，尝试音频API...');
            const lastTeacherMessage = document.querySelector('.teacher-message:last-child .message-text');
            if (lastTeacherMessage) {
                const text = lastTeacherMessage.textContent || lastTeacherMessage.innerText;
                generateAndPlayAudio(text);
            } else {
                showAudioError('音频加载失败');
            }
        });
        
        // 尝试播放
        const playPromise = currentAudio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('✅ 音频播放成功');
                showPlayingIndicator();
            }).catch(error => {
                console.error('❌ 音频播放失败:', error);
                if (error.name === 'NotAllowedError') {
                    showAudioPermissionTip();
                } else {
                    // 如果播放失败，尝试使用新的音频API
                    console.log('🔄 传统音频播放失败，尝试音频API...');
                    const lastTeacherMessage = document.querySelector('.teacher-message:last-child .message-text');
                    if (lastTeacherMessage) {
                        const text = lastTeacherMessage.textContent || lastTeacherMessage.innerText;
                        generateAndPlayAudio(text);
        } else {
                        showAudioError('音频播放失败');
                    }
                }
            });
        }
    } catch (error) {
        console.error('创建音频对象失败:', error);
        showAudioError('音频创建失败');
    }
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
    
    // 处理换行符，将 \\n 和 \n 都转换为 <br> 标签
    // 同时转义HTML字符防止XSS攻击
    const escapedMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\\n\\n/g, '<br><br>')  // 处理双换行符 \\n\\n
        .replace(/\\n/g, '<br>')         // 处理单换行符 \\n
        .replace(/\n/g, '<br>');         // 处理实际换行符 \n
    
    textDiv.innerHTML = escapedMessage;
    
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
        if (btnText) btnText.textContent = '目前语音开启';
        icon.className = 'fa fa-volume-off';  // 语音开启时显示静音图标，表示点击后会关闭
        voiceToggle.title = '关闭语音播放';
    } else {
        voiceToggle.classList.remove('voice-enabled');
        if (btnText) btnText.textContent = '目前语音关闭';
        icon.className = 'fa fa-volume-up';   // 语音关闭时显示有声图标，表示点击后会开启
        voiceToggle.title = '开启语音播放';
    }
}

// 显示音频权限提示
function showAudioPermissionTip() {
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #f59e0b;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    tip.textContent = '🔊 请点击页面任意位置以启用音频播放';
    document.body.appendChild(tip);
    
    // 3秒后自动消失
    setTimeout(() => {
        if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
        }
    }, 3000);
    
    // 点击页面任意位置后再次尝试播放
    const handleClick = () => {
        if (currentAudio) {
            currentAudio.play().then(() => {
                console.log('✅ 用户交互后音频播放成功');
                if (tip.parentNode) {
                    tip.parentNode.removeChild(tip);
                }
            }).catch(console.error);
        }
        document.removeEventListener('click', handleClick, { once: true });
    };
    document.addEventListener('click', handleClick, { once: true });
}

// 显示音频错误提示
function showAudioError(message) {
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    tip.textContent = message || '❌ 语音播放失败，请检查网络连接';
    document.body.appendChild(tip);
    
    setTimeout(() => {
        if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
        }
    }, 3000);
}

// 显示语音提示（当有语音但未开启时）
function showVoiceTip() {
    // 避免重复显示
    if (document.querySelector('.voice-tip')) return;
    
    const tip = document.createElement('div');
    tip.className = 'voice-tip';
    tip.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #3b82f6;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
        max-width: 250px;
        line-height: 1.4;
    `;
    tip.innerHTML = '🎵 有语音回复！<br/>点击此处开启语音播放';
    
    // 点击开启语音
    tip.addEventListener('click', () => {
        if (!isVoiceEnabled) {
            toggleVoice();
        }
        if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
        }
    });
    
    document.body.appendChild(tip);
    
    // 5秒后自动消失
    setTimeout(() => {
        if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
        }
    }, 5000);
}

// 显示正在播放指示器
function showPlayingIndicator() {
    // 避免重复显示
    if (document.querySelector('.playing-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'playing-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 25px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: pulse 1.5s ease-in-out infinite;
    `;
    indicator.innerHTML = '🔊 正在播放语音回复...';
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
        }
    `;
    if (!document.querySelector('style[data-audio-styles]')) {
        style.setAttribute('data-audio-styles', 'true');
        document.head.appendChild(style);
    }
    
    document.body.appendChild(indicator);
    
    // 3秒后自动消失
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 3000);
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

// 移动端音频初始化
function initializeMobileAudio() {
    if (mobileAudioInitialized || !isMobile()) return;
    
    console.log('🔧 初始化移动端音频支持...');
    
    // 创建一个静音音频来"解锁"音频播放
    const unlockAudio = () => {
        if (userHasInteracted) return;
        
        const audio = new Audio();
        // 使用一个很短的静音音频数据URI
        audio.src = 'data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACA';
        audio.volume = 0;
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('✅ 移动端音频已解锁');
                userHasInteracted = true;
                audio.pause();
                audio.src = '';
                
                // 显示音频可用提示
                if (isVoiceEnabled) {
                    showMobileAudioReady();
                }
            }).catch(() => {
                console.log('⚠️ 移动端音频解锁失败，等待用户交互');
            });
        }
    };
    
    // 监听用户交互事件
    const interactionEvents = ['touchstart', 'touchend', 'click', 'tap'];
    const handleInteraction = () => {
        unlockAudio();
        // 只需要解锁一次
        interactionEvents.forEach(event => {
            document.removeEventListener(event, handleInteraction);
        });
    };
    
    interactionEvents.forEach(event => {
        document.addEventListener(event, handleInteraction, { once: true });
    });
    
    mobileAudioInitialized = true;
}

// 显示移动端音频就绪提示
function showMobileAudioReady() {
    if (!isMobile()) return;
    
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: #10b981;
        color: white;
        padding: 10px 16px;
        border-radius: 20px;
        z-index: 10000;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 90%;
        text-align: center;
    `;
    tip.textContent = '🎵 移动端语音已启用！';
    document.body.appendChild(tip);
    
    setTimeout(() => {
        if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
        }
    }, 2000);
}

// 改进的移动端音频播放函数
function playAudioOnMobile(blobUrl) {
    if (!isMobile()) {
        playAudioBlob(blobUrl);
        return;
    }
    
    console.log('📱 移动端音频播放:', blobUrl);
    
    // 检查用户是否已交互
    if (!userHasInteracted) {
        console.log('⚠️ 移动端需要用户交互后才能播放音频');
        showMobileAudioPermissionTip();
        return;
    }
    
    // 停止当前音频
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    try {
        currentAudio = new Audio();
        currentAudio.preload = 'auto';
        currentAudio.volume = 1.0;
        
        // 移动端专用事件监听
        currentAudio.addEventListener('loadstart', () => {
            console.log('📱 移动端音频开始加载');
        });
        
        currentAudio.addEventListener('canplaythrough', () => {
            console.log('📱 移动端音频可以播放');
        });
        
        currentAudio.addEventListener('play', () => {
            console.log('📱 移动端音频开始播放');
            showPlayingIndicator();
        });
        
        currentAudio.addEventListener('ended', () => {
            console.log('📱 移动端音频播放完成');
            currentAudio = null;
            URL.revokeObjectURL(blobUrl);
            const indicator = document.querySelector('.playing-indicator');
            if (indicator && indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        });
        
        currentAudio.addEventListener('error', (e) => {
            console.error('📱 移动端音频播放错误:', e);
            URL.revokeObjectURL(blobUrl);
            showMobileAudioError('移动端音频播放失败，请检查网络连接');
        });
        
        // 设置音频源
        currentAudio.src = blobUrl;
        
        // 尝试播放
        const playPromise = currentAudio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('✅ 移动端音频播放成功');
            }).catch(error => {
                console.error('❌ 移动端音频播放失败:', error);
                URL.revokeObjectURL(blobUrl);
                
                if (error.name === 'NotAllowedError') {
                    showMobileAudioPermissionTip();
                } else if (error.name === 'NotSupportedError') {
                    showMobileAudioError('您的设备不支持此音频格式');
                } else {
                    showMobileAudioError('移动端音频播放失败');
                }
            });
        }
    } catch (error) {
        console.error('📱 创建移动端音频对象失败:', error);
        URL.revokeObjectURL(blobUrl);
        showMobileAudioError('移动端音频创建失败');
    }
}

// 移动端音频权限提示
function showMobileAudioPermissionTip() {
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 20px;
        border-radius: 12px;
        z-index: 10000;
        font-size: 16px;
        text-align: center;
        max-width: 90%;
        line-height: 1.5;
    `;
    tip.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 10px;">🔊</div>
        <div>请点击下方按钮启用语音播放</div>
        <button id="enableMobileAudio" style="
            background: #10b981;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            margin-top: 15px;
            cursor: pointer;
        ">启用语音播放</button>
    `;
    
    document.body.appendChild(tip);
    
    // 点击启用按钮
    const enableButton = tip.querySelector('#enableMobileAudio');
    enableButton.addEventListener('click', () => {
        initializeMobileAudio();
        userHasInteracted = true;
        
        // 移除提示
        if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
        }
        
        // 重新尝试播放最新音频
        const lastTeacherMessage = document.querySelector('.teacher-message:last-child .message-text');
        if (lastTeacherMessage) {
            const text = lastTeacherMessage.textContent || lastTeacherMessage.innerText;
            generateAndPlayAudio(text);
        }
        
        showMobileAudioReady();
    });
    
    // 点击背景关闭
    tip.addEventListener('click', (e) => {
        if (e.target === tip) {
            if (tip.parentNode) {
                tip.parentNode.removeChild(tip);
            }
        }
    });
}

// 移动端音频错误提示
function showMobileAudioError(message) {
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 90%;
        text-align: center;
    `;
    tip.textContent = `📱 ${message}`;
    document.body.appendChild(tip);
    
    setTimeout(() => {
        if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
        }
    }, 4000);
} 