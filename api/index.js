const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '7719771424:AAFRN7VsbLnEKZZ8av7htNeGvlwEJqHnSt8';
const portfolioUrl = 'https://nurbek.codes/';
const bot = new TelegramBot(token);

app.use(express.json());

// Webhook yo'li
app.post('/webhook', (req, res) => {
  console.log('Webhook so‘rovi qabul qilindi:', req.body);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// /start buyrug'i
bot.onText(/\/start/, (msg) => {
  console.log('Start buyrug‘i qabul qilindi:', msg);
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

module.exports = app;
