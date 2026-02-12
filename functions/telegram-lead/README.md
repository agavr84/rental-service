# Telegram lead function (Yandex Cloud Functions)

## Env vars
- TELEGRAM_BOT_TOKEN
- TELEGRAM_CHAT_ID

## Deploy (пример)
```bash
yc serverless function create --name telegram-lead

yc serverless function version create \
  --function-name telegram-lead \
  --runtime nodejs16 \
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
  -d '{"name":"Иван","phone":"+7 (922) 447 44 77"}'
```

## CORS
Функция отвечает на OPTIONS и добавляет CORS‑заголовки для локального теста (`http://127.0.0.1:8080`).
