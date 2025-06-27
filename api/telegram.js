require("dotenv").config();
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

// Configuration variables
const API_TOKEN = process.env.API_TOKEN;
const ADMIN_IDS = process.env.ADMIN_IDS;
const VERCEL_URL = "https://telegram-bot-integration.vercel.app";
const WEBHOOK_PATH = "/api/telegram";
const WEBHOOK_URL = `${VERCEL_URL}${WEBHOOK_PATH}`;

// Global variables
let botActive = true;
let keywordResponses = [];
let questionReplies = [];
let reactions = [];

// Reaksiya emoji ro'yxati (Redis'dan yuklanadi yoki default ishlatiladi)
const defaultReactions = [
  "👍",
  "❤️",
  "🔥",
  "👏",
  "😁",
  "🤔",
  "😮",
  "😢",
  "😮‍💨",
  "💯",
];

// Reaksiya ehtimoli (0.3 = 30%)
const REACTION_PROBABILITY = 0.6;

const axios = require("axios");

async function addMessageReaction(ctx, reaction) {
  try {
    console.log("=== ADD MESSAGE REACTION ===");

    const chat_id =
      ctx.chat?.id ||
      ctx.update?.message?.chat?.id ||
      ctx.update?.callback_query?.message?.chat?.id;
    const message_id =
      ctx.message?.message_id ||
      ctx.update?.message?.message_id ||
      ctx.update?.callback_query?.message?.message_id;

    console.log(`Chat ID: ${chat_id}`);
    console.log(`Message ID: ${message_id}`);
    console.log(`Reaction: ${reaction}`);
    console.log(`Chat type: ${ctx.chat?.type}`);

    if (!chat_id || !message_id) {
      console.warn("chat_id yoki message_id topilmadi");
      return;
    }

    // Check if reactions are available for this chat
    if (ctx.chat.type === "private") {
      console.log("Reactions are not supported in private chats");
      return;
    }

    const url = `https://api.telegram.org/bot${API_TOKEN}/setMessageReaction`;
    console.log(`Making request to: ${url}`);

    const requestData = {
      chat_id,
      message_id,
      reaction: [{ type: "emoji", emoji: reaction }],
      is_big: false,
    };

    console.log("Request data:", JSON.stringify(requestData, null, 2));

    const response = await axios.post(url, requestData);

    console.log(
      `SUCCESS: Reaction ${reaction} added to message ${message_id} in chat ${chat_id}`
    );
    console.log("Response status:", response.status);
    console.log("Response data:", response.data);
  } catch (e) {
    console.error("=== ERROR ADDING REACTION ===");
    console.error("Error object:", e);
    console.error("Error message:", e.message);

    if (e.response) {
      console.error("Response status:", e.response.status);
      console.error("Response data:", e.response.data);
      console.error("Response headers:", e.response.headers);
    }

    // Log specific error codes
    if (e.response?.status === 400) {
      console.error(
        "Bad Request - likely reaction not supported or invalid emoji"
      );
    } else if (e.response?.status === 403) {
      console.error("Forbidden - bot lacks permission to add reactions");
    } else if (e.response?.status === 429) {
      console.error("Rate limited - too many requests");
    }
  }
}

// Helper function to initialize Redis keys if they don't exist
async function initializeRedisKeys() {
  try {
    // Initialize keyword_responses if it doesn't exist
    const keywordExists = await redis.exists("keyword_responses");
    if (!keywordExists) {
      await redis.set("keyword_responses", JSON.stringify([]));
      console.log("Initialized keyword_responses key");
    }

    // Initialize responses if it doesn't exist
    const responsesExists = await redis.exists("responses");
    if (!responsesExists) {
      await redis.set(
        "responses",
        JSON.stringify({
          question_replies: [],
          reactions: defaultReactions,
        })
      );
      console.log("Initialized responses key");
    }

    // Initialize qa_pairs if it doesn't exist
    const qaPairsExists = await redis.exists("qa_pairs");
    if (!qaPairsExists) {
      await redis.set("qa_pairs", JSON.stringify([]));
      console.log("Initialized qa_pairs key");
    }
  } catch (e) {
    console.error("Error initializing Redis keys:", e);
  }
}

// Updated data handling functions with consistent Redis operations
async function loadKeywordResponses() {
  try {
    // Try regular GET first
    let dataJSON = await redis.get("keyword_responses");

    // If that fails or returns null, try JSON.GET
    if (!dataJSON) {
      try {
        dataJSON = await redis.call("JSON.GET", "keyword_responses", ".");
      } catch (jsonError) {
        console.log(
          "No keyword responses found in Redis (tried both GET and JSON.GET)"
        );
        return;
      }
    }

    if (dataJSON) {
      const parsedData =
        typeof dataJSON === "string" ? JSON.parse(dataJSON) : dataJSON;
      keywordResponses = parsedData.map((item) => [
        new RegExp(item.pattern, "i"),
        item.response,
      ]);
      console.log(
        `Loaded ${keywordResponses.length} keyword responses from Redis`
      );
    }
  } catch (e) {
    console.error("Error loading keyword responses from Redis:", e);
    console.log("Attempting to reset keyword_responses key...");

    // Reset the key if there's a type error
    try {
      await redis.del("keyword_responses");
      await redis.set("keyword_responses", JSON.stringify([]));
      console.log("Reset keyword_responses key successfully");
    } catch (resetError) {
      console.error("Failed to reset keyword_responses key:", resetError);
    }
  }
}

async function loadResponses() {
  try {
    // Try regular GET first
    let dataJSON = await redis.get("responses");

    // If that fails or returns null, try JSON.GET
    if (!dataJSON) {
      try {
        dataJSON = await redis.call("JSON.GET", "responses", ".");
      } catch (jsonError) {
        console.log(
          "No responses found in Redis (tried both GET and JSON.GET)"
        );
        reactions = defaultReactions;
        return;
      }
    }

    if (dataJSON) {
      const data =
        typeof dataJSON === "string" ? JSON.parse(dataJSON) : dataJSON;
      questionReplies = data.question_replies || [];

      // Redis'da reactions mavjud bo'lsa o'shani ishlatish, yo'q bo'lsa default
      if (
        data.reactions &&
        Array.isArray(data.reactions) &&
        data.reactions.length > 0
      ) {
        reactions = data.reactions;
        console.log(
          `Loaded ${questionReplies.length} question replies and ${reactions.length} reactions from Redis`
        );
      } else {
        reactions = defaultReactions;
        console.log(
          `Loaded ${questionReplies.length} question replies. Using default reactions.`
        );
      }
    } else {
      console.log(
        "No general responses found in Redis. Using default reactions."
      );
      reactions = defaultReactions;
    }
  } catch (e) {
    console.error("Error loading responses from Redis:", e);
    console.log("Attempting to reset responses key...");

    // Reset the key if there's a type error
    try {
      await redis.del("responses");
      await redis.set(
        "responses",
        JSON.stringify({ question_replies: [], reactions: defaultReactions })
      );
      reactions = defaultReactions;
      console.log("Reset responses key successfully");
    } catch (resetError) {
      console.error("Failed to reset responses key:", resetError);
    }
  }
}

// Updated storeQAPair function to use consistent Redis operations
async function storeQAPair(question, answer) {
  try {
    const newQAPair = { question, answer, timestamp: Date.now() };

    // Try to get existing data using regular GET first
    let qaPairsJSON;
    try {
      qaPairsJSON = await redis.get("qa_pairs");
    } catch (getError) {
      // If GET fails, try JSON.GET
      try {
        qaPairsJSON = await redis.call("JSON.GET", "qa_pairs", ".");
      } catch (jsonError) {
        qaPairsJSON = null;
      }
    }

    const qaPairs = qaPairsJSON ? JSON.parse(qaPairsJSON) : [];
    qaPairs.push(newQAPair);

    // Store using regular SET command for consistency
    await redis.set("qa_pairs", JSON.stringify(qaPairs));
    console.log("Stored new QA pair in Redis");
  } catch (e) {
    console.error("Error storing QA pair in Redis:", e);

    // If there's an error, try to reset the key
    try {
      await redis.del("qa_pairs");
      const qaPairs = [{ question, answer, timestamp: Date.now() }];
      await redis.set("qa_pairs", JSON.stringify(qaPairs));
      console.log("Reset qa_pairs key and stored new QA pair");
    } catch (resetError) {
      console.error("Failed to reset and store QA pair:", resetError);
    }
  }
}

// Updated findSimilarQuestion function
async function findSimilarQuestion(text) {
  try {
    // Try regular GET first
    let qaPairsJSON;
    try {
      qaPairsJSON = await redis.get("qa_pairs");
    } catch (getError) {
      // If GET fails, try JSON.GET
      try {
        qaPairsJSON = await redis.call("JSON.GET", "qa_pairs", ".");
      } catch (jsonError) {
        return null;
      }
    }

    if (!qaPairsJSON) return null;

    const qaPairs = JSON.parse(qaPairsJSON);
    for (const pair of qaPairs) {
      if (
        pair.question.toLowerCase().includes(text) ||
        text.includes(pair.question.toLowerCase())
      ) {
        return pair.answer;
      }
    }
    return null;
  } catch (e) {
    console.error("Error finding similar question in Redis:", e);
    return null;
  }
}

// Random reaksiya qo'shish funksiyasi
async function addRandomReaction(ctx) {
  try {
    // Debug: reaction sozlamalari va ehtimollik
    console.log(
      `Reaction probability: ${REACTION_PROBABILITY}, Random: ${Math.random()}`
    );
    console.log(`Available reactions: ${reactions.join(", ")}`);
    console.log(`Chat type: ${ctx.chat.type}, Chat ID: ${ctx.chat.id}`);

    if (Math.random() > REACTION_PROBABILITY) {
      console.log("Reaction skipped due to probability");
      return;
    }

    if (!reactions || reactions.length === 0) {
      console.log("No reactions available");
      return;
    }

    const randomReaction =
      reactions[Math.floor(Math.random() * reactions.length)];
    console.log(`Selected reaction: ${randomReaction}`);

    await addMessageReaction(ctx, randomReaction);
  } catch (e) {
    console.error(`Error in addRandomReaction: ${e}`);
  }
}

// Initialize the bot
const bot = new Telegraf(API_TOKEN);

// Command handlers
bot.command("start", async (ctx) => {
  try {
    if (
      ADMIN_IDS &&
      ADMIN_IDS.length > 0 &&
      ADMIN_IDS.includes(String(ctx.from.id))
    ) {
      if (!botActive) {
        botActive = true;
        await ctx.reply(
          "Bot aktivlashtirildi. Endi xabarlarni qayta ishlayapti."
        );
        console.log(`Bot activated by user ${ctx.from.id}`);
        return;
      }
    }
    await ctx.reply(
      "Salom! Men sizga yordam berish uchun tayyorman. Savollaringizni yozing yoki o'zimni qiziqtiradigan narsalarni so'rang 😊"
    );
  } catch (e) {
    console.error(`Error in /start handler: ${e}`);
  }
});

bot.command("stop", async (ctx) => {
  try {
    if (
      ADMIN_IDS &&
      ADMIN_IDS.length > 0 &&
      !ADMIN_IDS.includes(String(ctx.from.id))
    ) {
      await ctx.reply("Sizga bu buyruqni bajarish ruxsat etilmagan.");
      console.log(`Unauthorized /stop attempt by user ${ctx.from.id}`);
      return;
    }
    botActive = false;
    await ctx.reply(
      "Bot deaktivlashtirildi. Endi xabarlarni qayta ishlamaydi."
    );
    console.log(`Bot deactivated by user ${ctx.from.id}`);
  } catch (e) {
    console.error(`Error in /stop handler: ${e}`);
  }
});

// Reaksiya sozlash buyrug'i (faqat adminlar uchun)
bot.command("reactions", async (ctx) => {
  try {
    if (!ADMIN_IDS || !ADMIN_IDS.includes(String(ctx.from.id))) {
      await ctx.reply("Sizga bu buyruqni bajarish ruxsat etilmagan.");
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);

    if (args.length === 0) {
      const status =
        reactions.length > 0
          ? `Faol reaksiyalar: ${reactions.join(" ")}`
          : "Hozir reaksiyalar o'chiq";
      await ctx.reply(status);
      return;
    }

    if (args[0] === "off") {
      reactions = [];
      const currentData = await redis.get("responses");
      const data = currentData ? JSON.parse(currentData) : {};
      data.reactions = [];
      await redis.set("responses", JSON.stringify(data));
      await ctx.reply("Reaksiyalar o'chirildi");
      return;
    }

    // Reaksiyalarni sozlash: /reactions 👍 ❤️ 🔥 👏
    reactions = args;
    const currentData = await redis.get("responses");
    const data = currentData ? JSON.parse(currentData) : {};
    data.reactions = reactions;
    await redis.set("responses", JSON.stringify(data));

    await ctx.reply(`Yangi reaksiyalar sozlandi: ${reactions.join(" ")}`);
    console.log(
      `Reactions updated by admin ${ctx.from.id}: ${reactions.join(" ")}`
    );
  } catch (e) {
    console.error(`Error in /reactions handler: ${e}`);
    await ctx.reply("Xatolik yuz berdi");
  }
});

// Test reaction command (faqat adminlar uchun)
bot.command("test_reaction", async (ctx) => {
  try {
    console.log("=== TEST_REACTION COMMAND RECEIVED ===");
    console.log(`From user: ${ctx.from.id} (${ctx.from.username})`);
    console.log(`Chat type: ${ctx.chat.type}, Chat ID: ${ctx.chat.id}`);
    console.log(`ADMIN_IDS: ${ADMIN_IDS}`);
    console.log(`User ID in string: ${String(ctx.from.id)}`);
    console.log(
      `Is admin: ${ADMIN_IDS && ADMIN_IDS.includes(String(ctx.from.id))}`
    );

    if (!ADMIN_IDS || !ADMIN_IDS.includes(String(ctx.from.id))) {
      console.log("User not authorized for test_reaction");
      await ctx.reply("Sizga bu buyruqni bajarish ruxsat etilmagan.");
      return;
    }

    console.log("User authorized, proceeding with test...");
    await ctx.reply("Test reaction qo'yishga harakat qilmoqda...");

    // Force a reaction test
    console.log("Testing reaction manually...");
    console.log(`Bot active: ${botActive}`);
    console.log(`Chat type: ${ctx.chat.type}`);
    console.log(`Available reactions: ${JSON.stringify(reactions)}`);
    console.log(`Reactions count: ${reactions.length}`);

    if (reactions.length > 0) {
      console.log(`Attempting to add reaction: ${reactions[0]}`);
      await addMessageReaction(ctx, reactions[0]);
      await ctx.reply(
        `Test reaction ${reactions[0]} qo'yishga harakat qilindi`
      );
      console.log("Test reaction attempt completed");
    } else {
      console.log("No reactions available!");
      await ctx.reply(
        "Reaksiyalar mavjud emas! /reactions buyrug'i bilan sozlang."
      );
    }
  } catch (e) {
    console.error(`ERROR in /test_reaction handler:`, e);
    console.error("Stack trace:", e.stack);
    await ctx.reply(`Xatolik: ${e.message}`);
  }
});

// Message handler
bot.on(message("text"), async (ctx) => {
  try {
    if (
      !botActive ||
      (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")
    ) {
      return;
    }

    const text = ctx.message.text.toLowerCase().trim();

    // Barcha habarlarga random reaksiya qo'shish
    await addRandomReaction(ctx);

    // Reply to message logic
    if (ctx.message.reply_to_message && ctx.message.reply_to_message.text) {
      const question = ctx.message.reply_to_message.text.toLowerCase().trim();
      const answer = ctx.message.text;
      await storeQAPair(question, answer);
      console.log(`Attempted to store QA pair: ${question} -> ${answer}`);
      return;
    }

    // Spam detection
    const spamPatterns = [
      /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/,
      /t\.me\//,
    ];
    if (spamPatterns.some((pattern) => pattern.test(text))) {
      try {
        await ctx.deleteMessage();
        console.log(`Spam message deleted in chat ${ctx.chat.id}`);
      } catch (e) {
        console.error(`Error deleting spam: ${e}`);
      }
      return;
    }

    // Stored answer lookup
    const storedAnswer = await findSimilarQuestion(text);
    if (storedAnswer) {
      try {
        await ctx.reply(storedAnswer);
        console.log(
          `Replied with stored answer from Redis in chat ${ctx.chat.id}`
        );
      } catch (e) {
        console.error(`Error sending reply: ${e}`);
      }
      return;
    }

    // Keyword responses
    for (const [pattern, response] of keywordResponses) {
      if (pattern.test(text)) {
        try {
          await ctx.reply(response);
          console.log(
            `Replied with keyword response from Redis in chat ${ctx.chat.id}`
          );
        } catch (e) {
          console.error(`Error sending reply: ${e}`);
        }
        return;
      }
    }

    // Question pattern matching
    const questionPattern =
      /(mi\b|\?|kim\b|nima\b|qachon\b|qayerda\b|nega\b|qanday\b)$/i;
    if (questionPattern.test(text)) {
      try {
        let response =
          questionReplies.length > 0
            ? questionReplies[
                Math.floor(Math.random() * questionReplies.length)
              ]
            : "Bilmadim 🤔";

        await ctx.reply(response);
        console.log(
          `Replied with general question response in chat ${ctx.chat.id}`
        );
      } catch (e) {
        console.error(`Error sending reply: ${e}`);
      }
    }
  } catch (e) {
    console.error(`Error in message handler: ${e}`);
  }
});

// Photo, video, sticker va boshqa media turlari uchun ham reaksiya qo'shish
bot.on(
  ["photo", "video", "sticker", "document", "audio", "voice"],
  async (ctx) => {
    try {
      if (
        !botActive ||
        (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")
      ) {
        return;
      }

      // Media habarlarga ham reaksiya qo'shish
      await addRandomReaction(ctx);
    } catch (e) {
      console.error(`Error in media handler: ${e}`);
    }
  }
);

// Vercel serverless function
module.exports = async (req, res) => {
  try {
    console.log(
      `[${new Date().toISOString()}] Request received: ${req.method} ${req.url}`
    );

    // Handle POST requests from Telegram webhook
    if (req.method === "POST") {
      console.log("=== WEBHOOK RECEIVED ===");
      console.log("Request body:", JSON.stringify(req.body, null, 2));

      // Load data before processing
      console.log("Loading Redis data...");
      await initializeRedisKeys();
      await loadKeywordResponses();
      await loadResponses();
      console.log(`Loaded reactions: ${reactions.join(", ")}`);
      console.log(`Bot active: ${botActive}`);

      console.log("Processing update...");
      await bot.handleUpdate(req.body);
      console.log("Update processed successfully");

      return res.status(200).json({ message: "OK" });
    }

    // Set webhook on GET request or initial invocation
    if (req.method === "GET") {
      console.log("Setting webhook...");
      await bot.telegram.setWebhook(WEBHOOK_URL);
      console.log(`Webhook set to ${WEBHOOK_URL}`);

      // Check webhook info
      const webhookInfo = await bot.telegram.getWebhookInfo();
      console.log("Webhook info:", webhookInfo);

      return res.status(200).json({
        message: `Webhook set to ${WEBHOOK_URL}`,
        bot_active: botActive,
        reactions_count: reactions.length,
        reactions: reactions,
        webhook_info: webhookInfo,
      });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("ERROR in Vercel handler:", e);
    console.error("Stack trace:", e.stack);
    return res
      .status(500)
      .json({ error: "Internal Server Error", details: e.message });
  }
};

// Main startup function
async function startBot() {
  try {
    console.log("Initializing bot...");
    await initializeRedisKeys();
    await loadKeywordResponses();
    await loadResponses();
    console.log("Bot initialization completed successfully");

    if (process.env.NODE_ENV == "local") {
      bot
        .launch()
        .then(() => console.log("Bot running locally with long polling..."));
      console.log("Bot ishga tushirishga harakat qildi.");
    }
  } catch (e) {
    console.error("Error starting bot:", e);
  }
}

// Start the bot
startBot();
