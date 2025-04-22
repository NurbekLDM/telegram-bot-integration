// Import necessary modules  
const { Telegraf } = require('telegraf');  
const { message } = require('telegraf/filters');  
const fs = require('fs');  
const path = require('path');  
const express = require('express');  
const bodyParser = require('body-parser');  
require('dotenv').config();  

// Configuration variables  
const API_TOKEN = process.env.API_TOKEN;  
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];  
const PROXY_URL = process.env.PROXY_URL || null;  

// Global variables  
let botActive = true;  
let keywordResponses = [];  
let questionReplies = [];  
let reactions = [];  
let server = null;  

// Data handling functions  
function loadKeywordResponses() {  
  try {  
    const filePath = path.join(__dirname, 'keyword_responses.json');  
    if (fs.existsSync(filePath)) {  
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));  
      keywordResponses = data.map(item => [new RegExp(item.pattern, 'i'), item.response]);  
      console.log(`Loaded ${keywordResponses.length} keyword responses`);  
    }  
  } catch (e) {  
    console.error('Error loading keyword responses:', e);  
  }  
}  

function loadResponses() {  
  try {  
    const filePath = path.join(__dirname, 'responses.json');  
    if (fs.existsSync(filePath)) {  
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));  
      questionReplies = data.question_replies || [];  
      reactions = data.reactions || [];  
      console.log(`Loaded ${questionReplies.length} question replies and ${reactions.length} reactions`);  
    }  
  } catch (e) {  
    console.error('Error loading responses:', e);  
  }  
}  

// QA storage and retrieval  
function storeQAPair(question, answer) {  
  try {  
    const filePath = path.join(__dirname, 'qa_pairs.json');  
    let qaPairs = [];  
    
    if (fs.existsSync(filePath)) {  
      qaPairs = JSON.parse(fs.readFileSync(filePath, 'utf8'));  
    }  
    
    qaPairs.push({ question, answer, timestamp: Date.now() });  
    fs.writeFileSync(filePath, JSON.stringify(qaPairs, null, 2));  
    console.log('Stored new QA pair');  
  } catch (e) {  
    console.error('Error storing QA pair:', e);  
  }  
}  

function findSimilarQuestion(text) {  
  try {  
    const filePath = path.join(__dirname, 'qa_pairs.json');  
    if (!fs.existsSync(filePath)) return null;  
    
    const qaPairs = JSON.parse(fs.readFileSync(filePath, 'utf8'));  
    
    // Simple similarity check (can be improved with better algorithms)  
    for (const pair of qaPairs) {  
      if (pair.question.toLowerCase().includes(text) ||   
          text.includes(pair.question.toLowerCase())) {  
        return pair.answer;  
      }  
    }  
    return null;  
  } catch (e) {  
    console.error('Error finding similar question:', e);  
    return null;  
  }  
}  

// Initialize the bot  
const bot = new Telegraf(API_TOKEN);  

// Command handlers  
bot.command('start', async (ctx) => {  
  try {  
    // Check if the user is an admin  
    if (ADMIN_IDS.length > 0 && ADMIN_IDS.includes(ctx.from.id.toString())) {  
      if (!botActive) {  
        botActive = true;  
        await ctx.reply("Bot aktivlashtirildi. Endi xabarlarni qayta ishlayapti.");  
        console.log(`Bot activated by user ${ctx.from.id}`);  
        return;  
      }  
    }  
    // Send the standard start message  
    await ctx.reply("Salom! Men sizga yordam berish uchun tayyorman. Savollaringizni yozing yoki o'zimni qiziqtiradigan narsalarni so'rang 😊");  
  } catch (e) {  
    console.error(`Error in /start handler: ${e}`);  
  }  
});  

bot.command('stop', async (ctx) => {  
  try {  
    // Check if the user is an admin  
    if (ADMIN_IDS.length > 0 && !ADMIN_IDS.includes(ctx.from.id.toString())) {  
      await ctx.reply("Sizga bu buyruqni bajarish ruxsat etilmagan.");  
      console.log(`Unauthorized /stop attempt by user ${ctx.from.id}`);  
      return;  
    }  
    botActive = false;  
    await ctx.reply("Bot deaktivlashtirildi. Endi xabarlarni qayta ishlamaydi.");  
    console.log(`Bot deactivated by user ${ctx.from.id}`);  
  } catch (e) {  
    console.error(`Error in /stop handler: ${e}`);  
  }  
});  

// Message handler  
bot.on(message('text'), async (ctx) => {  
  try {  
    // If bot is not active or the message is not in a group, return  
    if (!botActive || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {  
      return;  
    }  

    const text = ctx.message.text.toLowerCase().trim();  

    // Check for replies (only for text replies)  
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {  
      const question = ctx.message.reply_to_message.text.toLowerCase().trim();  
      const answer = ctx.message.text;  
      storeQAPair(question, answer);  
      
      try {  
        console.log(`Stored QA pair: ${question} -> ${answer}`);  
      } catch (e) {  
        console.error(`Error sending reply: ${e}`);  
      }  
      return;  
    }  

    // Check for spam  
    const spamPatterns = [  
      /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/,  
      /t\.me\//  
    ];  

    if (spamPatterns.some(pattern => pattern.test(text))) {  
      try {  
        await ctx.deleteMessage();  
        console.log(`Spam message deleted in chat ${ctx.chat.id}`);  
      } catch (e) {  
        console.error(`Error deleting spam: ${e}`);  
      }  
      return;  
    }  

    // Look for similar questions in stored QA pairs  
    const storedAnswer = findSimilarQuestion(text);  
    if (storedAnswer) {  
      try {  
        await ctx.reply(storedAnswer);  
        console.log(`Replied with stored answer in chat ${ctx.chat.id}`);  
      } catch (e) {  
        console.error(`Error sending reply: ${e}`);  
      }  
      return;  
    }  

    // Check for keywords  
    for (const [pattern, response] of keywordResponses) {  
      if (pattern.test(text)) {  
        try {  
          await ctx.reply(response);  
          console.log(`Replied with keyword response in chat ${ctx.chat.id}`);  
        } catch (e) {  
          console.error(`Error sending reply: ${e}`);  
        }  
        return;  
      }  
    }  

    // Check for general questions  
    const questionPattern = /(mi\b|\?|kim\b|nima\b|qachon\b|qayerda\b|nega\b|qanday\b)$/i;  
    if (questionPattern.test(text)) {  
      try {  
        let response = questionReplies.length > 0   
          ? questionReplies[Math.floor(Math.random() * questionReplies.length)]   
          : "Bilmadim 🤔";  
        
        if (reactions.length > 0 && Math.random() < 0.3) {  
          response += ` ${reactions[Math.floor(Math.random() * reactions.length)]}`;  
        }  
        
        await ctx.reply(response);  
        console.log(`Replied with general question response in chat ${ctx.chat.id}`);  
      } catch (e) {  
        console.error(`Error sending reply: ${e}`);  
      }  
    }  
  } catch (e) {  
    console.error(`Error in message handler: ${e}`);  
  }  
});  

// Handle non-text messages  
bot.on(message(), async (ctx) => {  
  if (ctx.message.text) return; // Skip text messages as they're handled above  
  
  if (!botActive || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {  
    return;  
  }  

  try {  
    console.log(`Replied to non-text message in chat ${ctx.chat.id}`);  
  } catch (e) {  
    console.error(`Error sending reply: ${e}`);  
  }  
});  

// Main function  
async function main() {  
  // Data fayllarini tekshirish  
  const qaFilePath = path.join(__dirname, 'qa_pairs.json');  
  if (!fs.existsSync(qaFilePath)) {  
    fs.writeFileSync(qaFilePath, JSON.stringify([], null, 2));  
    console.log('qa_pairs.json fayli yaratildi');  
  }  

  // Data fayllarini yuklash  
  loadKeywordResponses();  
  loadResponses();  
  
  // Botni ishga tushirish  
  try {  
    console.log("Bot ishga tushdi...");  
    await bot.launch({  
      telegram: PROXY_URL ? { apiRoot: PROXY_URL } : undefined  
    });  
    
    // Graceful stop  
    process.once('SIGINT', () => bot.stop('SIGINT'));  
    process.once('SIGTERM', () => bot.stop('SIGTERM'));  
  } catch (e) {  
    console.error(`Error starting bot: ${e}`);  
  }  
}  

// Express server  
const app = express();  
app.use(bodyParser.json());  

app.listen(3000, () => {  
  console.log('Server is running on port 3000');  
});  

// AWS Lambda uchun handler  
module.exports.handler = async (event) => {  
  try {  
    await main();  
    return {  
      statusCode: 200,  
      body: 'Bot ishga tushdi!'  
    };  
  } catch (e) {  
    console.error(`Error in Lambda handler: ${e}`);  
    return {  
      statusCode: 500,  
      body: 'Bot ishga tushirilishi mumkin emas'  
    };  
  } finally {  
    // Graceful shutdown  
    if (server) {  
      await server.close();  
    }  
  }  
};