# QuizTime – Auth Setup

Email/password login was scaffolded before. This update adds:
- Phone number field to registration
- SMS login via Supabase Auth (Bird/MessageBird provider)

## Configure Supabase
1. Create a project at supabase.com and copy the project URL and anon key.
2. In Supabase Dashboard → Authentication → Providers → Phone:
   - Enable the Phone provider
   - Choose MessageBird (Bird)
   - Provide Access Key and Originator/Sender (phone number or sender ID)
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
- Login → choose “Telefon” to use SMS OTP (Supabase + Bird/MessageBird).
  Email is stored in user metadata `contact_email` and mirrored into `public.profiles` via trigger, so no email verification is required.
