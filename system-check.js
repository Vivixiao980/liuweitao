#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

console.log('🔍 刘蔚涛老师智能体系统自检开始...\n');

// 检查项目结构
function checkProjectStructure() {
  console.log('📁 检查项目结构...');
  
  const requiredFiles = [
    'server.js',
    'package.json',
    'knowledge-base.js',
    'public/index.html',
    'public/styles.css',
    'public/script.js',
    'public/liuweitao.png'
  ];
  
  const requiredDirs = [
    'public',
    'knowledge-base',
    'data',
    'uploads'
  ];
  
  let allFilesExist = true;
  
  // 检查文件
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`   ✅ ${file}`);
    } else {
      console.log(`   ❌ ${file} - 缺失`);
      allFilesExist = false;
    }
  });
  
  // 检查目录
  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`   ✅ ${dir}/`);
    } else {
      console.log(`   ❌ ${dir}/ - 缺失`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

// 检查知识库
function checkKnowledgeBase() {
  console.log('\n📚 检查知识库...');
  
  const knowledgeDir = 'knowledge-base';
  let knowledgeFiles = 0;
  
  if (fs.existsSync(knowledgeDir)) {
    const files = fs.readdirSync(knowledgeDir);
    const txtFiles = files.filter(file => file.endsWith('.txt'));
    knowledgeFiles = txtFiles.length;
    
    console.log(`   📖 找到 ${knowledgeFiles} 个知识库文件`);
    txtFiles.slice(0, 5).forEach(file => {
      console.log(`      - ${file}`);
    });
    
    if (txtFiles.length > 5) {
      console.log(`      ... 以及其他 ${txtFiles.length - 5} 个文件`);
    }
  }
  
  return knowledgeFiles > 0;
}

// 检查API配置
function checkAPIConfig() {
  console.log('\n🔧 检查API配置...');
  
  const configs = [
    {
      file: 'data/siliconflow-config.json',
      name: 'SiliconFlow AI',
      requiredFields: ['apiKey', 'model', 'enabled']
    },
    {
      file: 'data/minimax-voice-config.json',
      name: 'MiniMax语音克隆',
      requiredFields: ['apiKey', 'voiceId', 'groupId']
    }
  ];
  
  let allConfigsValid = true;
  
  configs.forEach(config => {
    if (fs.existsSync(config.file)) {
      try {
        const data = fs.readJsonSync(config.file);
        const hasAllFields = config.requiredFields.every(field => 
          data[field] && data[field].toString().length > 0
        );
        
        if (hasAllFields) {
          console.log(`   ✅ ${config.name} - 配置完整`);
        } else {
          console.log(`   ⚠️  ${config.name} - 配置不完整`);
          console.log(`      缺少字段: ${config.requiredFields.filter(field => !data[field])}`);
        }
      } catch (error) {
        console.log(`   ❌ ${config.name} - 配置文件格式错误`);
        allConfigsValid = false;
      }
    } else {
      console.log(`   ❌ ${config.name} - 配置文件不存在`);
      allConfigsValid = false;
    }
  });
  
  return allConfigsValid;
}

// 检查依赖
function checkDependencies() {
  console.log('\n📦 检查项目依赖...');
  
  try {
    const packageJson = fs.readJsonSync('package.json');
    const dependencies = Object.keys(packageJson.dependencies || {});
    
    console.log(`   📋 项目依赖: ${dependencies.length} 个`);
    dependencies.forEach(dep => {
      console.log(`      - ${dep}`);
    });
    
    // 检查node_modules是否存在
    if (fs.existsSync('node_modules')) {
      console.log('   ✅ node_modules 已安装');
      return true;
    } else {
      console.log('   ❌ node_modules 未安装，请运行: npm install');
      return false;
    }
  } catch (error) {
    console.log('   ❌ package.json 读取失败');
    return false;
  }
}

// 检查端口可用性
function checkPort() {
  console.log('\n🌐 检查端口配置...');
  
  const net = require('net');
  const port = 3000;
  
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        console.log(`   ✅ 端口 ${port} 可用`);
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      console.log(`   ⚠️  端口 ${port} 被占用`);
      resolve(false);
    });
  });
}

// 生成功能清单
function generateFeatureList() {
  console.log('\n🎯 核心功能清单:');
  console.log('   🤖 AI智能对话 (SiliconFlow Deepseek模型)');
  console.log('   📚 刘蔚涛老师知识库调用');
  console.log('   🎵 MiniMax语音克隆回复');
  console.log('   💬 自然对话风格模拟');
  console.log('   📱 响应式网页界面');
  console.log('   💾 对话记录保存和导出');
  console.log('   🎨 深蓝色护眼界面主题');
}

// 主检查函数
async function runSystemCheck() {
  const results = [];
  
  results.push(checkProjectStructure());
  results.push(checkKnowledgeBase());
  results.push(checkAPIConfig());
  results.push(checkDependencies());
  results.push(await checkPort());
  
  generateFeatureList();
  
  console.log('\n📊 检查结果总结:');
  const passedChecks = results.filter(Boolean).length;
  const totalChecks = results.length;
  
  if (passedChecks === totalChecks) {
    console.log(`   🎉 全部检查通过 (${passedChecks}/${totalChecks})`);
    console.log('   ✨ 项目已准备就绪，可以启动！');
    console.log('\n🚀 启动命令: npm start');
    console.log('🌐 访问地址: http://localhost:3000');
  } else {
    console.log(`   ⚠️  部分检查失败 (${passedChecks}/${totalChecks})`);
    console.log('   🔧 请修复上述问题后重新运行检查');
  }
  
  console.log('\n🔍 系统自检完成！');
  
  return passedChecks === totalChecks;
}

// 如果直接运行此脚本
if (require.main === module) {
  runSystemCheck().catch(console.error);
}

module.exports = { runSystemCheck }; 