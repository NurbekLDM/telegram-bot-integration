const TelegramBot = require('node-telegram-bot-api');

const token = '7719771424:AAFRN7VsbLnEKZZ8av7htNeGvlwEJqHnSt8';
const portfolioUrl = 'https://nurbek.codes';

// Bot yaratish
const bot = new TelegramBot(token, { polling: true });

// /start buyrug'i
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_markup: {
      keyboard: [
        [{ text: 'Open App', web_app: { url: portfolioUrl } }]
      ],
      resize_keyboard: true, // Klaviaturani moslashuvchan qilish
      one_time_keyboard: false // Klaviatura chatda doim qolishi uchun
    }
  };
  bot.sendMessage(chatId, 'Salom! "Open App" tugmasini bosing.', opts);
});

// Vercel serverless function handler (Agar webhook ishlatayotgan bo‘lsangiz)
module.exports = async (req, res) => {
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
