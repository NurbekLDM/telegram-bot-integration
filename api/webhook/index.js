const TelegramBot = require('node-telegram-bot-api');  


const token = '7719771424:AAFRN7VsbLnEKZZ8av7htNeGvlwEJqHnSt8';
const portfolioUrl = 'https://nurbek.codes';
// Bot yaratish  
const bot = new TelegramBot(token, { polling: true });  

// /start buyrug'i  
bot.onText(/\/start/, (msg) => {  
  const chatId = msg.chat.id;  

const bot = new TelegramBot(token);
  // Xabar va tugma opsiyalari  
  const message = `Salom! Portfolio saytimni ochish uchun "Open App" tugmasini bosing.`;  

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
  const opts = {  
    reply_markup: {  
      inline_keyboard: [  
        [{ text: 'Open App', web_app: { url: portfolioUrl } }]  
      ]  
    }  
  };  

// Vercel serverless function handler
module.exports = async (req, res) => {
  // Webhook URL ni tekshirish qismi
  if (req.method === 'GET') {
    return res.status(200).send('Telegram bot webhook is active');
  }
  // Xabarni yuborish  
  bot.sendMessage(chatId, message, opts);  
});  

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
// Vercel serverless function handler  
module.exports = async (req, res) => {  
  if (req.method === 'POST') {  
    try {  
      bot.processUpdate(req.body);  
      return res.status(200).send('OK');  
    } catch (error) {  
      console.error('Xatolik:', error);  
      return res.status(500).send('Server xatosi');  
    }  
  }  

  return res.status(405).json({ error: 'Method not allowed' });
};
  // GET metodi uchun javob  
  return res.status(200).send('Telegram bot is running');  
};  
