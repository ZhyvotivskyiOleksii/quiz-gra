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
# Optional but recommended: lets the server link email to phone users immediately
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Install deps

```
npm i @supabase/supabase-js
```

## Usage
- Registration uses phone OTP. After verifying the SMS code we call a server route to link the provided email/password to the same Auth user. If `SUPABASE_SERVICE_ROLE_KEY` is set, the email is applied immediately (and appears in Auth → Users). Without it, we fall back to a normal `updateUser` that may require email confirmation depending on your project settings.
- Login → choose “Telefon” for SMS OTP or use email/password after registration.
