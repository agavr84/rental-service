# Telegram Lead Function (Yandex Cloud Functions)

Sends lead form data to Telegram chat.

## Required environment variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

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
