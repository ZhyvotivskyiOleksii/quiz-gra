# QuizTime – Auth Setup

Email/password login was scaffolded before. This update adds:
- Phone number field to registration
- SMS login via Supabase Auth (Twilio provider)

## Configure Supabase
1. Create a project at supabase.com and copy the project URL and anon key.
2. In Supabase Dashboard → Authentication → Providers → Phone:
   - Enable the Phone provider
   - Choose Twilio and fill Account SID, Auth Token, Message Service SID
   - Save

## Environment
Create `.env.local` (or update `.env`) with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Install deps

```
npm i @supabase/supabase-js
```

## Usage
- Registration stores the phone in user metadata.
- Login → choose “Telefon” to use SMS OTP (Supabase + Twilio).
