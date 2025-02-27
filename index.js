const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = 'YOUR_BOT_TOKEN_HERE';
const portfolioUrl = 'https://nurbek.codes'; // URL
const bot = new TelegramBot(token);

app.use(express.json());

// Webhook yo'li
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// /start buyrug'i
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open', web_app: { url: portfolioUrl } }]
      ]
    }
  };
  bot.sendMessage(chatId, 'Salom! Portfolio saytimni ochish uchun "Open" tugmasini bosing.', opts);
});

app.listen(3000, () => {
    console.log('Server 3000-portda ishga tushdi!');
    bot.setWebHook('https://your-vercel-app.vercel.app/webhook');
  });

// Vercel uchun eksport
module.exports = app;

