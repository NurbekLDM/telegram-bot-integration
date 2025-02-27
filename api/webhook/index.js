const TelegramBot = require('node-telegram-bot-api');


const token = '7719771424:AAFRN7VsbLnEKZZ8av7htNeGvlwEJqHnSt8';
const portfolioUrl = 'https://nurbek.codes';


const bot = new TelegramBot(token);

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

// Vercel serverless function handler
module.exports = async (req, res) => {
  // Webhook URL ni tekshirish qismi
  if (req.method === 'GET') {
    return res.status(200).send('Telegram bot webhook is active');
  }

  if (req.method === 'POST') {
    try {
      const data = req.body;
      console.log('Webhook data received:', data);
      bot.processUpdate(data);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error processing update:', error);
      return res.status(500).json({ error: 'Failed to process update' });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};