const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
app.use(express.json()); // JSON requestlarni qabul qilish uchun

const token = '7719771424:AAFRN7VsbLnEKZZ8av7htNeGvlwEJqHnSt8';
const portfolioUrl = 'https://nurbek.codes';
const webhookUrl = 'https://telegram-bot-integration.vercel.app/api/webhook';

// Botni webhook rejimida yaratish
const bot = new TelegramBot(token, { webHook: true });

// Webhook URL ni sozlash
bot.setWebHook(webhookUrl).then(() => {
  console.log(`✅ Webhook set to: ${webhookUrl}`);
}).catch(err => console.error('❌ Webhook error:', err));

// /start buyrug'i uchun Open App tugmasi bilan javob
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open App', web_app: { url: portfolioUrl } }]
      ]
    }
  };
  bot.sendMessage(chatId, 'Salom! "Open App" tugmasini bosing.', opts);
});

// Telegramdan kelgan webhook so‘rovlarini qabul qilish
app.post('/api/webhook', (req, res) => {
  try {
    bot.processUpdate(req.body);
    const message  = req.body;
    console.log('✉️ Message:', message);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// Webhookning faoliyatini tekshirish uchun GET route
app.get('/api/webhook', (req, res) => {
  res.send('✅ Telegram bot webhook is active');
});

// Vercel uchun eksport
module.exports = app;
