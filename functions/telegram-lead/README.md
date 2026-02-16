# Telegram Lead Function (Yandex Cloud Functions)

Sends lead form data to Telegram chat.

## Required environment variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## Recommended environment variables

- `ALLOWED_ORIGINS` - comma-separated list of allowed Origins for CORS.
  Example:
  `https://xn--80aaaabdu9b1ckcx4jpb.xn--p1ai,https://www.xn--80aaaabdu9b1ckcx4jpb.xn--p1ai`
- `MIN_FORM_FILL_MS` - minimum form fill time in ms (default `1500`).
- `MAX_FORM_FILL_MS` - maximum accepted form age in ms (default `7200000`).
- `RATE_LIMIT_WINDOW_MS` - rate-limit window in ms (default `60000`).
- `RATE_LIMIT_MAX` - max requests per window per IP (default `8`).

## Deploy example

```bash
yc serverless function create --name telegram-lead

yc serverless function version create \
  --function-name telegram-lead \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 128m \
  --execution-timeout 5s \
  --service-account-id <SERVICE_ACCOUNT_ID> \
  --environment TELEGRAM_BOT_TOKEN=<TOKEN>,TELEGRAM_CHAT_ID=<CHAT_ID> \
  --source-path .
```

## Test

```bash
curl -X POST <FUNCTION_URL> \
  -H 'Content-Type: application/json' \
  -d '{"name":"Иван","phone":"+7 (900) 000-00-00"}'
```

## Notes

- Function handles `OPTIONS` (CORS preflight).
- Current implementation allows all origins (`*`).
