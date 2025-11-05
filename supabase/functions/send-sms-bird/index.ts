// supabase/functions/send-sms-bird/index.ts
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

interface SmsWebhookPayload {
  user: {
    phone: string;
  };
  sms: {
    otp: string;
  };
}

Deno.serve(async (req) => {
  try {
    const payload = await req.text();
    const secret = Deno.env.get("SEND_SMS_HOOK_SECRETS");
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "Missing hook secret" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const headers = Object.fromEntries(req.headers);
    const wh = new Webhook(secret.replace("v1,whsec_", ""));
    const { user, sms } = wh.verify(payload, headers) as SmsWebhookPayload;

    if (!user?.phone || !sms?.otp) {
      console.error("Invalid payload:", payload);
      return new Response(
        JSON.stringify({ error: "Invalid payload format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // === Bird API credentials ===
    const workspace = Deno.env.get("SMS_WORKSPACE_ID");
    const channel = Deno.env.get("SMS_CHANNEL_ID");
    const accessKey = Deno.env.get("SMS_ACCESS_KEY");

    if (!workspace || !channel || !accessKey) {
      return new Response(
        JSON.stringify({ error: "Missing Bird API credentials" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const phone = user.phone.startsWith("+") ? user.phone : `+${user.phone}`;
    const messageBody = `Your login code is: ${sms.otp}`;

    const response = await fetch(
      `https://api.bird.com/workspaces/${workspace}/channels/${channel}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `AccessKey ${accessKey}`,
        },
        body: JSON.stringify({
          receiver: {
            contacts: [
              {
                identifierKey: "phonenumber",
                identifierValue: phone,
              },
            ],
          },
          body: {
            type: "text",
            text: {
              text: messageBody,
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Bird error:", errText);
      return new Response(
        JSON.stringify({
          error: "Bird send failed",
          details: errText,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Bird response:", data);

    return new Response(
      JSON.stringify({ status: "ok", bird_status: data.status || "sent" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Hook error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
