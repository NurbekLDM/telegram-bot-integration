// Import necessary modules
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration variables
const API_TOKEN = process.env.API_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS

// Global variables
let botActive = true;
let keywordResponses = [];
let questionReplies = [];
let reactions = [];

// Initialize the bot
const bot = new Telegraf(API_TOKEN);

// Data handling functions
function loadKeywordResponses() {
  try {
    const filePath = path.join(process.cwd(), 'keyword_responses.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      keywordResponses = data.map(item => [new RegExp(item.pattern, 'i'), item.response]);
      console.log(`Loaded ${keywordResponses.length} keyword responses`);
    } else {
      console.log('keyword_responses.json not found');
      keywordResponses = [];
    }
  } catch (e) {
    console.error('Error loading keyword responses:', e);
    keywordResponses = [];
  }
}

function loadResponses() {
  try {
    const filePath = path.join(process.cwd(), 'responses.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      questionReplies = data.question_replies || [];
      reactions = data.reactions || [];
      console.log(`Loaded ${questionReplies.length} question replies and ${reactions.length} reactions`);
    } else {
      console.log('responses.json not found');
      questionReplies = ["Bilmadim 🤔"];
      reactions = ["😊"];
    }
  } catch (e) {
    console.error('Error loading responses:', e);
    questionReplies = ["Bilmadim 🤔"];
    reactions = ["😊"];
  }
}

// QA storage and retrieval
function findSimilarQuestion(text) {
  try {
    const filePath = path.join(process.cwd(), 'qa_pairs.json');
    if (!fs.existsSync(filePath)) return null;
    
    const qaPairs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Simple similarity check
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

// Command handlers
bot.command('start', async (ctx) => {
  try {
    // Check if the user is an admin
    if (ADMIN_IDS.length > 0 && ADMIN_IDS.includes(ctx.from.id)) {
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
    if (ADMIN_IDS.length > 0 && !ADMIN_IDS.includes(ctx.from.id)) {
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
bot.on('text', async (ctx) => {
  try {
    // If bot is not active or the message is not in a group, return
    if (!botActive || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
      return;
    }

    const text = ctx.message.text.toLowerCase().trim();

    // Check for replies (only for text replies)
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
      // On serverless, we'll just log this rather than writing to file
      console.log(`Reply detected: ${text}`);
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
bot.on('message', async (ctx) => {
  if (ctx.message.text) return; // Skip text messages as they're handled above
  
  if (!botActive || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
    return;
  }

  try {
    console.log(`Received non-text message in chat ${ctx.chat.id}`);
  } catch (e) {
    console.error(`Error handling non-text message: ${e}`);
  }
});

// Load data
loadKeywordResponses();
loadResponses();


module.exports = async (req, res) => {
  // Logging kelgan so'rovlar
  console.log('Webhook request received', {
    method: req.method,
    path: req.url,
    headers: req.headers,
    body: req.body ? 'Has body' : 'No body'
  });

  try {
    // POST so'rovlarni qayta ishlash
    if (req.method === 'POST') {
      console.log('Processing Telegram update', JSON.stringify(req.body || {}).slice(0, 100));
      
      if (!req.body) {
        return res.status(400).send('No request body');
      }
      
      // Update'ni Telegraf orqali qayta ishlash
      await bot.handleUpdate(req.body);
      return res.status(200).send('OK');
    } 
    // GET so'rovlar uchun diagnostika sahifasi
    else if (req.method === 'GET') {
      return res.status(200).send(`
        <html>
          <body>
            <h1>Telegram Bot Webhook is active!</h1>
            <p>API Token available: ${Boolean(process.env.API_TOKEN)}</p>
            <p>Admin IDs: ${process.env.ADMIN_IDS || 'Not set'}</p>
            <p>Bot is ${botActive ? 'active' : 'inactive'}</p>
            <p>Loaded ${keywordResponses.length} keyword responses</p>
            <p>Loaded ${questionReplies.length} question replies</p>
          </body>
        </html>
      `);
    } else {
      return res.status(405).send('Method not allowed');
    }
  } catch (error) {
    console.error('Error in webhook handler:', error);
    return res.status(500).send(`Error: ${error.message}`);
  }
};