#!/usr/bin/env bash
set -euo pipefail

# Helper to deploy the Supabase Auth Hook: Send SMS (Bird)
# Usage:
#   export SUPABASE_PROJECT_REF=xxxxxxxxxxxxxxxxxxxxxxxx
#   export SMS_WORKSPACE_ID=wb_XXXXXXXX
#   export SMS_CHANNEL_ID=ch_XXXXXXXX
#   export SMS_ACCESS_KEY=live_xxxxxxxxxxxxxxxxx
#   # optional: provide your own hook secret
#   # export SEND_SMS_HOOK_SECRETS="v1,whsec_<base64>"
#   scripts/deploy-send-sms-bird.sh

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF to your project ref}" 
: "${SMS_WORKSPACE_ID:?Set SMS_WORKSPACE_ID (Bird workspace id)}"
: "${SMS_CHANNEL_ID:?Set SMS_CHANNEL_ID (Bird channel id)}"
: "${SMS_ACCESS_KEY:?Set SMS_ACCESS_KEY (Bird access key)}"

if [[ -z "${SEND_SMS_HOOK_SECRETS:-}" ]]; then
  echo "Generating webhook secret..."
  b64=$(openssl rand -base64 32)
  export SEND_SMS_HOOK_SECRETS="v1,whsec_${b64}"
fi

echo "Linking project ${SUPABASE_PROJECT_REF}..."
supabase link --project-ref "${SUPABASE_PROJECT_REF}" >/dev/null

echo "Setting secrets..."
supabase secrets set \
  SEND_SMS_HOOK_SECRETS="${SEND_SMS_HOOK_SECRETS}" \
  SMS_WORKSPACE_ID="${SMS_WORKSPACE_ID}" \
  SMS_CHANNEL_ID="${SMS_CHANNEL_ID}" \
  SMS_ACCESS_KEY="${SMS_ACCESS_KEY}"

echo "Deploying function send-sms-bird..."
supabase functions deploy send-sms-bird

echo "Done. Now configure Auth → Hooks → Send SMS in Dashboard:"
echo "  Endpoint: https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/send-sms-bird"
echo "  Secret:   ${SEND_SMS_HOOK_SECRETS}"
echo "  Method:   POST"

