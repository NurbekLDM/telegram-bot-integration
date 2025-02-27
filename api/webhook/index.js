const TelegramBot = require('node-telegram-bot-api');  

const token = '7719771424:AAFRN7VsbLnEKZZ8av7htNeGvlwEJqHnSt8';  
const portfolioUrl = 'https://nurbek.codes';  

// Bot yaratish  
const bot = new TelegramBot(token, { polling: true });  

// /start buyrug'i  
bot.onText(/\/start/, (msg) => {  
  const chatId = msg.chat.id;  

  // Xabar va tugma opsiyalari  
  const message = `Salom! Portfolio saytimni ochish uchun "Open App" tugmasini bosing.`;  

  const opts = {  
    reply_markup: {  
      inline_keyboard: [  
        [{ text: 'Open App', web_app: { url: portfolioUrl } }]  
      ]  
    }  
  };  

  // Xabarni yuborish  
  bot.sendMessage(chatId, message, opts);  
});  

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
  
  // GET metodi uchun javob  
  return res.status(200).send('Telegram bot is running');  
};  
