const { Pool } = require('pg');
const fs = require('fs-extra');
const path = require('path');

// 数据库连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PRIVATE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// 本地JSON文件路径（作为备用）
const conversationsFile = path.join(__dirname, 'data', 'conversations.json');

class DatabaseManager {
  constructor() {
    this.useDatabase = !!process.env.DATABASE_URL || !!process.env.DATABASE_PRIVATE_URL;
    console.log(`💾 数据存储模式: ${this.useDatabase ? 'PostgreSQL数据库' : '本地JSON文件'}`);
  }

  // 初始化数据库表
  async initDatabase() {
    if (!this.useDatabase) return;
    
    try {
      const client = await pool.connect();
      
      // 创建对话表
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id BIGINT PRIMARY KEY,
          user_id VARCHAR(100) DEFAULT 'anonymous',
          user_message TEXT NOT NULL,
          teacher_response TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      // 创建索引
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
      `);
      
      client.release();
      console.log('✅ 数据库表初始化完成');
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      // 如果数据库初始化失败，切换到文件存储
      this.useDatabase = false;
      console.log('🔄 切换到本地文件存储模式');
    }
  }

  // 保存对话记录
  async saveConversation(conversation) {
    if (this.useDatabase) {
      return await this.saveToDatabase(conversation);
    } else {
      return await this.saveToFile(conversation);
    }
  }

  // 获取所有对话记录
  async getAllConversations() {
    if (this.useDatabase) {
      return await this.getFromDatabase();
    } else {
      return await this.getFromFile();
    }
  }

  // 保存到数据库
  async saveToDatabase(conversation) {
    try {
      const client = await pool.connect();
      const query = `
        INSERT INTO conversations (id, user_id, user_message, teacher_response, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          user_message = EXCLUDED.user_message,
          teacher_response = EXCLUDED.teacher_response
      `;
      
      await client.query(query, [
        conversation.id,
        conversation.userId || 'anonymous',
        conversation.userMessage,
        conversation.teacherResponse,
        new Date(conversation.timestamp)
      ]);
      
      client.release();
      console.log(`💾 对话已保存到数据库: ${conversation.id}`);
    } catch (error) {
      console.error('❌ 保存到数据库失败:', error);
      // 备用方案：保存到文件
      await this.saveToFile(conversation);
    }
  }

  // 从数据库获取
  async getFromDatabase() {
    try {
      const client = await pool.connect();
      const result = await client.query(`
        SELECT 
          id,
          user_id as "userId",
          user_message as "userMessage", 
          teacher_response as "teacherResponse",
          timestamp
        FROM conversations 
        ORDER BY timestamp DESC
      `);
      
      client.release();
      
      return result.rows.map(row => ({
        ...row,
        timestamp: row.timestamp.toISOString()
      }));
    } catch (error) {
      console.error('❌ 从数据库获取失败:', error);
      // 备用方案：从文件获取
      return await this.getFromFile();
    }
  }

  // 保存到文件（备用方案）
  async saveToFile(conversation) {
    try {
      // 确保目录存在
      fs.ensureDirSync(path.dirname(conversationsFile));
      
      let conversations = [];
      if (fs.existsSync(conversationsFile)) {
        conversations = await fs.readJson(conversationsFile);
      }
      
      conversations.push(conversation);
      
      // 保持最近1000条记录
      if (conversations.length > 1000) {
        conversations = conversations.slice(-1000);
      }
      
      await fs.writeJson(conversationsFile, conversations, { spaces: 2 });
      console.log(`💾 对话已保存到文件: ${conversation.id}`);
    } catch (error) {
      console.error('❌ 保存到文件失败:', error);
    }
  }

  // 从文件获取（备用方案）
  async getFromFile() {
    try {
      if (!fs.existsSync(conversationsFile)) {
        return [];
      }
      return await fs.readJson(conversationsFile);
    } catch (error) {
      console.error('❌ 从文件读取失败:', error);
      return [];
    }
  }

  // 迁移文件数据到数据库
  async migrateFileToDatabase() {
    if (!this.useDatabase) {
      console.log('⚠️ 未连接数据库，跳过迁移');
      return;
    }

    try {
      const fileData = await this.getFromFile();
      if (fileData.length === 0) {
        console.log('📁 没有本地数据需要迁移');
        return;
      }

      console.log(`🔄 开始迁移 ${fileData.length} 条记录到数据库...`);
      
      let successCount = 0;
      for (const conversation of fileData) {
        try {
          await this.saveToDatabase(conversation);
          successCount++;
        } catch (error) {
          console.error(`❌ 迁移记录失败: ${conversation.id}`, error);
        }
      }
      
      console.log(`✅ 迁移完成: ${successCount}/${fileData.length} 条记录`);
    } catch (error) {
      console.error('❌ 数据迁移失败:', error);
    }
  }

  // 获取统计信息
  async getStats() {
    try {
      const conversations = await this.getAllConversations();
      return {
        totalConversations: conversations.length,
        uniqueUsers: [...new Set(conversations.map(c => c.userId || 'anonymous'))].length,
        latestConversation: conversations.length > 0 ? conversations[0].timestamp : null
      };
    } catch (error) {
      console.error('❌ 获取统计失败:', error);
      return {
        totalConversations: 0,
        uniqueUsers: 0,
        latestConversation: null
      };
    }
  }

  // 关闭数据库连接
  async close() {
    if (this.useDatabase) {
      await pool.end();
    }
  }
}

// 创建全局实例
const dbManager = new DatabaseManager();

module.exports = dbManager; 