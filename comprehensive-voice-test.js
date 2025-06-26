const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

// 读取配置
const config = JSON.parse(fs.readFileSync('data/minimax-voice-config.json', 'utf8'));

async function testVoiceFunctions() {
    console.log('=== 智能教师助手语音功能全面测试 ===\n');
    
    console.log('📋 配置信息:');
    console.log(`   API Key: ${config.apiKey.substring(0, 50)}...`);
    console.log(`   Group ID: ${config.groupId}`);
    console.log(`   Voice ID: ${config.voiceId || '未设置'}`);
    console.log(`   Platform: ${config.platform || 'minimax'}\n`);
    
    const tests = [
        {
            name: '基础语音合成',
            test: testBasicSynthesis
        },
        {
            name: '语音克隆音色合成',
            test: testCloneSynthesis
        },
        {
            name: '文件上传功能',
            test: testFileUpload
        },
        {
            name: '语音克隆创建',
            test: testVoiceClone
        },
        {
            name: '语音克隆列表',
            test: testVoiceList
        },
        {
            name: '智能降级机制',
            test: testFallbackMechanism
        }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.log(`\n${i + 1}. 🧪 测试 ${test.name}:`);
        console.log('─'.repeat(50));
        
        try {
            const result = await test.test();
            if (result.success) {
                console.log(`   ✅ ${test.name} 测试通过`);
                if (result.message) console.log(`   💡 ${result.message}`);
                passedTests++;
            } else {
                console.log(`   ❌ ${test.name} 测试失败: ${result.error}`);
            }
        } catch (error) {
            console.log(`   ❌ ${test.name} 测试异常: ${error.message}`);
        }
        
        // 测试间隔
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 测试总结: ${passedTests}/${totalTests} 项测试通过`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有测试通过！语音功能运行正常。');
    } else if (passedTests > 0) {
        console.log('⚠️  部分功能正常，建议检查失败的项目。');
    } else {
        console.log('❌ 所有测试失败，请检查API配置和网络连接。');
    }
    
    console.log('\n🔧 修复建议:');
    if (passedTests < totalTests) {
        console.log('   1. 检查MiniMax API密钥是否有效');
        console.log('   2. 确认账户权限和余额');
        console.log('   3. 验证网络连接');
        console.log('   4. 当前已实现智能降级，基础功能可正常使用');
    } else {
        console.log('   ✨ 所有功能正常，无需修复！');
    }
}

// 测试基础语音合成
async function testBasicSynthesis() {
    try {
        const response = await fetch('http://localhost:3000/api/synthesize-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '你好，我是礼明老师，这是基础语音合成测试。',
                voiceId: 'male-qn-qingse'
            })
        });
        
        const result = await response.json();
        console.log(`   状态: ${response.status}`);
        console.log(`   响应: ${result.message || result.error || 'Unknown'}`);
        
        if (result.success) {
            return {
                success: true,
                message: `音频URL: ${result.audio_url || result.audioUrl || '使用浏览器TTS'}`
            };
        } else {
            return {
                success: false,
                error: result.error || '未知错误'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 测试语音克隆音色合成
async function testCloneSynthesis() {
    try {
        const response = await fetch('http://localhost:3000/api/synthesize-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '你好，我是礼明老师，这是语音克隆合成测试。',
                voiceId: config.voiceId || 'clone_1750943421874'
            })
        });
        
        const result = await response.json();
        console.log(`   状态: ${response.status}`);
        console.log(`   使用音色: ${config.voiceId || 'clone_1750943421874'}`);
        console.log(`   响应: ${result.message || result.error || 'Unknown'}`);
        
        if (result.success) {
            return {
                success: true,
                message: `音频来源: ${result.source}, URL: ${result.audio_url || result.audioUrl || '本地样本'}`
            };
        } else {
            return {
                success: false,
                error: result.error || '未知错误'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 测试文件上传功能
async function testFileUpload() {
    try {
        // 查找测试音频文件
        const testAudioPath = 'uploads/1750930443694-6月26日.MP3';
        if (!fs.existsSync(testAudioPath)) {
            return {
                success: false,
                error: '测试音频文件不存在'
            };
        }
        
        const formData = new FormData();
        formData.append('audioFiles', fs.createReadStream(testAudioPath));
        
        const response = await fetch('http://localhost:3000/api/upload-voice-samples', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log(`   状态: ${response.status}`);
        console.log(`   响应: ${result.message || result.error || 'Unknown'}`);
        
        if (result.success) {
            return {
                success: true,
                message: `文件上传成功，来源: ${result.source || 'unknown'}`
            };
        } else {
            return {
                success: false,
                error: result.error || '未知错误'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 测试语音克隆创建
async function testVoiceClone() {
    try {
        // 查找测试音频文件
        const testAudioPath = 'uploads/1750930443694-6月26日.MP3';
        if (!fs.existsSync(testAudioPath)) {
            return {
                success: false,
                error: '测试音频文件不存在'
            };
        }
        
        const formData = new FormData();
        formData.append('voiceSamples', fs.createReadStream(testAudioPath));
        
        const response = await fetch('http://localhost:3000/api/clone-voice', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log(`   状态: ${response.status}`);
        console.log(`   响应: ${result.message || result.error || 'Unknown'}`);
        
        if (result.success) {
            return {
                success: true,
                message: `语音克隆成功，Voice ID: ${result.voiceId || result.voice_id}`
            };
        } else {
            return {
                success: false,
                error: result.error || '未知错误'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 测试语音克隆列表
async function testVoiceList() {
    try {
        const response = await fetch('http://localhost:3000/api/voice-clones');
        const result = await response.json();
        
        console.log(`   状态: ${response.status}`);
        console.log(`   响应: ${result.message || result.error || 'Unknown'}`);
        
        if (result.success) {
            const voiceCount = result.voices ? result.voices.length : 0;
            return {
                success: true,
                message: `找到 ${voiceCount} 个语音克隆`
            };
        } else {
            return {
                success: false,
                error: result.error || '未知错误'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 测试智能降级机制
async function testFallbackMechanism() {
    try {
        // 使用一个不存在的voice_id来触发降级
        const response = await fetch('http://localhost:3000/api/synthesize-speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: '这是智能降级机制测试。',
                voiceId: 'invalid_voice_id_test'
            })
        });
        
        const result = await response.json();
        console.log(`   状态: ${response.status}`);
        console.log(`   响应: ${result.message || result.error || 'Unknown'}`);
        console.log(`   来源: ${result.source || 'unknown'}`);
        
        // 降级机制应该能够处理失败并提供备选方案
        if (result.success || result.source === 'browser' || result.source === 'local_fallback') {
            return {
                success: true,
                message: `降级机制正常工作，来源: ${result.source}`
            };
        } else {
            return {
                success: false,
                error: result.error || '降级机制未生效'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 运行测试
testVoiceFunctions().then(() => {
    console.log('\n=== 测试完成 ===');
    process.exit(0);
}).catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
}); 