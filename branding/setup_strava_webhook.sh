#!/bin/bash
# Registra webhook subscription no Strava (executar 1x)
# https://developers.strava.com/docs/webhooks/

CLIENT_ID=250061
CLIENT_SECRET=2d62a2a835f768032c6380d789a1ee509ff97b66
CALLBACK_URL=https://runquest.veloxisit.com.br/api/strava/webhook
VERIFY_TOKEN=runquest_webhook_2026

echo "=== Listar subscriptions existentes ==="
curl -sG "https://www.strava.com/api/v3/push_subscriptions" \
  --data-urlencode "client_id=$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET" | python3 -m json.tool

echo
echo "=== Criar nova subscription ==="
curl -X POST "https://www.strava.com/api/v3/push_subscriptions" \
  -F client_id=$CLIENT_ID \
  -F client_secret=$CLIENT_SECRET \
  -F callback_url=$CALLBACK_URL \
  -F verify_token=$VERIFY_TOKEN | python3 -m json.tool

echo
echo "Strava chamou GET no callback_url com hub.challenge — backend já responde."
