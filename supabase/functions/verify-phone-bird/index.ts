import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type AnyPayload = {
  user?: { phone?: string | null } | null;
  sms?: { otp?: string | null; phone?: string | null; to?: string | null } | null;
};

const normSecret = (raw: string) =>
  raw.replace(/^v\d,?/, "").replace(/^whsec_/, "").trim();

const pickPhone = (p: AnyPayload) => {
  const v = p.sms?.phone ?? p.sms?.to ?? p.user?.phone ?? null;
  if (!v) return null;
  const s = v.trim();
  return s ? (s.startsWith("+") ? s : `+${s}`) : null;
};

Deno.serve(async (req) => {
  try {
    const raw = await req.text();

    const rawSecret = Deno.env.get("SEND_SMS_HOOK_SECRETS");
    if (!rawSecret) {
      return new Response(JSON.stringify({ error: "Missing hook secret" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    // 1) Валідуємо підпис Standard Webhooks
    new Webhook(normSecret(rawSecret)).verify(raw, Object.fromEntries(req.headers));

    // 2) Розбираємо payload
    const payload = JSON.parse(raw) as AnyPayload;
    const otp = payload.sms?.otp ?? null;
    const phone = pickPhone(payload);

    if (!otp || !phone) {
      return new Response(JSON.stringify({ error: "Invalid payload: missing otp or phone" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // 3) Bird creds
    const workspace = Deno.env.get("SMS_WORKSPACE_ID");
    const channel   = Deno.env.get("SMS_CHANNEL_ID");
    const accessKey = Deno.env.get("SMS_ACCESS_KEY");
    if (!workspace || !channel || !accessKey) {
      return new Response(JSON.stringify({ error: "Missing Bird API credentials" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const brand = Deno.env.get("SMS_BRAND") || "Your App";
    const text  = `${brand}: your verification code is ${otp}`;

    // 4) Відправляємо через Bird Channels API
    const r = await fetch(`https://api.bird.com/workspaces/${workspace}/channels/${channel}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `AccessKey ${accessKey}` },
      body: JSON.stringify({
        receiver: { contacts: [{ identifierKey: "phonenumber", identifierValue: phone }] },
        body: { type: "text", text: { text } },
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("Bird error:", t);
      return new Response(JSON.stringify({ error: "Bird send failed", details: t }), {
        status: 502, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Hook error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
