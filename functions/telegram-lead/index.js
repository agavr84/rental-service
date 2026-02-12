const https = require("node:https");

const sendTelegram = (token, chatId, text) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });

    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${token}/sendMessage`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(data || "Telegram error"));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });

const parseBody = (event) => {
  if (!event.body) return {};
  if (event.isBase64Encoded) {
    const decoded = Buffer.from(event.body, "base64").toString("utf8");
    try {
      return JSON.parse(decoded);
    } catch {
      return {};
    }
  }
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
};

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method Not Allowed",
    };
  }

  const { name, phone } = parseBody(event);
  if (!name || !phone) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: "Missing name or phone",
    };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: "Missing Telegram configuration",
    };
  }

  const text = `Новая заявка\nИмя: ${name}\nТелефон: ${phone}`;

  try {
    await sendTelegram(token, chatId, text);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "OK",
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: error.message || "Telegram error",
    };
  }
};
