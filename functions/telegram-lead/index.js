const https = require("node:https");

const MAX_BODY_BYTES = 4096;
const MIN_FORM_FILL_MS = Number(process.env.MIN_FORM_FILL_MS || 1500);
const MAX_FORM_FILL_MS = Number(process.env.MAX_FORM_FILL_MS || 2 * 60 * 60 * 1000);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 8);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const rateBuckets = new Map();

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
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(data || "Telegram error"));
            return;
          }

          try {
            const parsed = data ? JSON.parse(data) : {};
            if (parsed.ok === false) {
              reject(new Error(parsed.description || "Telegram rejected message"));
              return;
            }
            resolve();
          } catch {
            resolve();
          }
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Telegram request timeout")));
    req.write(payload);
    req.end();
  });

const getHeader = (headers, name) => {
  if (!headers) return "";
  const target = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) {
      return Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
  }
  return "";
};

const getClientIp = (event) => {
  const forwarded = getHeader(event.headers, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = getHeader(event.headers, "x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

const makeCorsHeaders = (origin, isAllowed) => {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (isAllowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

const isRateLimited = (key) => {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return true;
  }

  bucket.count += 1;
  return false;
};

const normalizePhoneDigits = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8") return `7${digits.slice(1)}`.slice(0, 11);
  if (digits[0] !== "7") return `7${digits}`.slice(0, 11);
  return digits.slice(0, 11);
};

const sanitizeName = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizePhone = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeQueryParams = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).slice(0, 15);
  const out = {};
  for (const [key, raw] of entries) {
    const cleanKey = String(key || "")
      .replace(/[^\w\-.:]/g, "")
      .slice(0, 64);
    const cleanValue = String(raw || "")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    if (!cleanKey || !cleanValue) continue;
    out[cleanKey] = cleanValue;
  }
  return out;
};

const parseBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > MAX_BODY_BYTES * 2) return {};
  if (event.isBase64Encoded) {
    const decodedBuffer = Buffer.from(event.body, "base64");
    if (decodedBuffer.length > MAX_BODY_BYTES) return {};
    const decoded = decodedBuffer.toString("utf8");
    try {
      return JSON.parse(decoded);
    } catch {
      return {};
    }
  }
  if (Buffer.byteLength(event.body, "utf8") > MAX_BODY_BYTES) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
};

exports.handler = async (event) => {
  if (!allowedOrigins.length) {
    return {
      statusCode: 500,
      headers: {},
      body: "Missing ALLOWED_ORIGINS configuration",
    };
  }

  const origin = getHeader(event.headers, "origin");
  const originAllowed = !!origin && allowedOrigins.includes(origin);
  const corsHeaders = makeCorsHeaders(origin, originAllowed);

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: originAllowed ? 200 : 403,
      headers: corsHeaders,
      body: "",
    };
  }

  if (!originAllowed) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: "Forbidden",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method Not Allowed",
    };
  }

  const clientIp = getClientIp(event);
  if (isRateLimited(clientIp)) {
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: "Too Many Requests",
    };
  }

  const body = parseBody(event);
  const company = String(body.company || "").trim();
  if (company) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "OK",
    };
  }

  const startedAt = Number(body.startedAt || 0);
  const filledForMs = Date.now() - startedAt;
  if (!startedAt || !Number.isFinite(startedAt) || filledForMs < MIN_FORM_FILL_MS || filledForMs > MAX_FORM_FILL_MS) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: "Invalid form timing",
    };
  }

  const name = sanitizeName(body.name);
  const phone = sanitizePhone(body.phone);
  const phoneDigits = normalizePhoneDigits(phone);
  const queryParams = normalizeQueryParams(body.queryParams);

  if (!name || name.length < 2 || name.length > 80) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: "Invalid name",
    };
  }

  if (phoneDigits.length !== 11) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: "Invalid phone",
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

  const queryText = Object.keys(queryParams).length
    ? `\nПараметры:\n${Object.entries(queryParams)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")}`
    : "";
  const text = `Новая заявка\nИмя: ${name}\nТелефон: ${phone}${queryText}`;

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
      body: "Telegram error",
    };
  }
};
