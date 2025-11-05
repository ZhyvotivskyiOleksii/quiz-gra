Send SMS (Bird) – Supabase Auth Hook

What this function does
- Implements Supabase Auth “Send SMS” hook that delivers OTP codes via Bird (new MessageBird) API.
- Works with the new Bird credentials (workspace/channel/access key) – no legacy `live_` key required.

Files
- supabase/functions/send-sms-bird/index.ts – Deno function code
- supabase/functions/send-sms-bird/config.toml – `verify_jwt=false` (we validate via webhook signature)

Prereqs
- Supabase CLI logged to your project

Secrets to set (function-scoped)

  supabase secrets set SEND_SMS_HOOK_SECRETS="v1,whsec_<BASE64_FROM_OPENSSL>"
  supabase secrets set SMS_WORKSPACE_ID="wb_XXXXXXXX"
  supabase secrets set SMS_CHANNEL_ID="ch_XXXXXXXX"
  supabase secrets set SMS_ACCESS_KEY="live_xxxxxxxxxxxxxxxxx"

Generate the webhook secret value:

  openssl rand -base64 32
  # put it into: SEND_SMS_HOOK_SECRETS=v1,whsec_<that_base64>

Deploy

  supabase functions deploy send-sms-bird

Hook configuration in Dashboard
- Project → Auth → Hooks → Send SMS
  - Endpoint: https://<project-ref>.supabase.co/functions/v1/send-sms-bird
  - Secret: SEND_SMS_HOOK_SECRETS (full string with `v1,whsec_...`)
  - Method: POST

Testing
- Trigger an OTP via your app or cURL (recommended path that exercises the hook):

  curl -i "https://<project-ref>.supabase.co/auth/v1/otp" \
    -H "apikey: <YOUR_ANON_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"phone":"+48XXXXXXXXX","type":"sms"}'

Notes
- Frontend code stays the same: `signInWithOtp` / `verifyOtp` continue to work.
- This replaces provider-managed SMS; do not set MessageBird provider in Auth → Providers. Use the Hook instead.
- The function verifies the webhook signature; you do not need to set or send any Authorization header.
