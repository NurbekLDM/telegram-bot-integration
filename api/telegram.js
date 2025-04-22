require('dotenv').config();
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD
});

// Configuration variables
const API_TOKEN = process.env.API_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS;
const VERCEL_URL = 'https://telegram-bot-integration.vercel.app';
const WEBHOOK_PATH = '/api/telegram';
const WEBHOOK_URL = `${VERCEL_URL}${WEBHOOK_PATH}`;

// Global variables
let botActive = true;
let keywordResponses = [];
let questionReplies = [];
let reactions = [];

// Data handling functions
async function loadKeywordResponses() {
  try {
    const dataJSON = await redis.get('keyword_responses');
    if (dataJSON) {
      keywordResponses = JSON.parse(dataJSON).map(item => [new RegExp(item.pattern, 'i'), item.response]);
      console.log(`Loaded ${keywordResponses.length} keyword responses from Redis`);
    } else {
      console.log('No keyword responses found in Redis.');
    }
  } catch (e) {
    console.error('Error loading keyword responses from Redis:', e);
  }
}

async function loadResponses() {
  try {
    const dataJSON = await redis.get('responses');
    if (dataJSON) {
      const data = JSON.parse(dataJSON);
      questionReplies = data.question_replies || [];
      reactions = data.reactions || [];
      console.log(`Loaded ${questionReplies.length} question replies and ${reactions.length} reactions from Redis`);
    } else {
      console.log('No general responses found in Redis.');
    }
  } catch (e) {
    console.error('Error loading responses from Redis:', e);
  }
}

async function storeQAPair(question, answer) {
  try {
    const newQAPair = { question, answer, timestamp: Date.now() };
    let qaPairsJSON = await redis.get('qa_pairs');
    let qaPairs = qaPairsJSON ? JSON.parse(qaPairsJSON) : [];
    qaPairs.push(newQAPair);
    await redis.set('qa_pairs', JSON.stringify(qaPairs));
    console.log('Stored new QA pair in Redis');
  } catch (e) {
    console.error('Error storing QA pair in Redis:', e);
  }
}

async function findSimilarQuestion(text) {
  try {
    const qaPairsJSON = await redis.get('qa_pairs');
    if (!qaPairsJSON) return null;
    const qaPairs = JSON.parse(qaPairsJSON);
    for (const pair of qaPairs) {
      if (pair.question.toLowerCase().includes(text) || text.includes(pair.question.toLowerCase())) {
        return pair.answer;
      }
    }
    return null;
  } catch (e) {
    console.error('Error finding similar question in Redis:', e);
    return null;
  }
}

// Initialize the bot
const bot = new Telegraf(API_TOKEN);

// Command handlers
bot.command('start', async (ctx) => {
  try {
    if (ADMIN_IDS && ADMIN_IDS.length > 0 && ADMIN_IDS.includes(String(ctx.from.id))) {
      if (!botActive) {
        botActive = true;
        await ctx.reply("Bot aktivlashtirildi. Endi xabarlarni qayta ishlayapti.");
        console.log(`Bot activated by user ${ctx.from.id}`);
        return;
      }
    }
    await ctx.reply("Salom! Men sizga yordam berish uchun tayyorman. Savollaringizni yozing yoki o'zimni qiziqtiradigan narsalarni so'rang 😊");
  } catch (e) {
    console.error(`Error in /start handler: ${e}`);
  }
});

bot.command('stop', async (ctx) => {
  try {
    if (ADMIN_IDS && ADMIN_IDS.length > 0 && !ADMIN_IDS.includes(String(ctx.from.id))) {
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
    if (!botActive || (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup')) {
      return;
    }
    const text = ctx.message.text.toLowerCase().trim();
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
      const question = ctx.message.reply_to_message.text.toLowerCase().trim();
      const answer = ctx.message.text;
      await storeQAPair(question, answer);
      console.log(`Attempted to store QA pair: ${question} -> ${answer}`);
      return;
    }
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
    const storedAnswer = await findSimilarQuestion(text);
    if (storedAnswer) {
      try {
        await ctx.reply(storedAnswer);
        console.log(`Replied with stored answer from Redis in chat ${ctx.chat.id}`);
      } catch (e) {
        console.error(`Error sending reply: ${e}`);
      }
      return;
    }
    for (const [pattern, response] of keywordResponses) {
      if (pattern.test(text)) {
        try {
          await ctx.reply(response);
          console.log(`Replied with keyword response from Redis in chat ${ctx.chat.id}`);
        } catch (e) {
          console.error(`Error sending reply: ${e}`);
        }
        return;
      }
    }
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

// Vercel serverless function
module.exports = async (req, res) => {
  try {
    // Handle POST requests from Telegram webhook
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body); // Process Telegram update
      return res.status(200).json({ message: 'OK' });
    }

    // Set webhook on GET request or initial invocation
    if (req.method === 'GET') {
      await bot.telegram.setWebhook(WEBHOOK_URL);
      console.log(`Webhook set to ${WEBHOOK_URL}`);
      return res.status(200).json({ message: `Webhook set to ${WEBHOOK_URL}` });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('Error in Vercel handler:', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Load data on startup
loadKeywordResponses();
loadResponses();

console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV == 'local') {
  bot.launch().then(() => console.log('Bot running locally with long polling...'));
  console.log('Bot ishga tushirishga harakat qildi.');
}