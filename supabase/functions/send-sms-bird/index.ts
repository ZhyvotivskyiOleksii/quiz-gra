// supabase/functions/send-sms-bird/index.ts

function findStringDeep(input: unknown, predicate: (value: string, key?: string) => boolean, key?: string): string | null {
  if (typeof input === 'string') {
    return predicate(input, key) ? input : null
  }
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findStringDeep(item, predicate)
      if (found) return found
    }
    return null
  }
  if (input && typeof input === 'object') {
    for (const entry of Object.entries(input as Record<string, unknown>)) {
      const found = findStringDeep(entry[1], predicate, entry[0])
      if (found) return found
    }
  }
  return null
}

const looksLikeOtp = (value: string) => /^[0-9]{4,10}$/.test(value.trim())
const looksLikePhone = (value: string) => /^\+?[0-9]{6,15}$/.test(value.trim())

Deno.serve(async (req) => {
  try {
    const payload = await req.text();

    const parsed = JSON.parse(payload || "{}");

    const otp =
      findStringDeep(parsed?.sms, (val) => looksLikeOtp(val)) ??
      findStringDeep(parsed, (val, key) => {
        if (!key) return looksLikeOtp(val)
        return ['otp', 'token', 'code'].some((candidate) => key.toLowerCase().includes(candidate)) && looksLikeOtp(val)
      })

    const phoneRaw =
      findStringDeep(parsed?.user, (val, key) => {
        if (!key) return looksLikePhone(val)
        return key.toLowerCase().includes('phone') && looksLikePhone(val)
      }) ??
      findStringDeep(parsed, (val, key) => {
        if (!key) return looksLikePhone(val)
        return key.toLowerCase().includes('phone') && looksLikePhone(val)
      })

    if (!phoneRaw || !otp) {
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
      console.error("Missing Bird API credentials", {
        workspace: !!workspace,
        channel: !!channel,
        accessKey: !!accessKey,
      });
      return new Response(
        JSON.stringify({ error: "Missing Bird API credentials" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const phone = phoneRaw.startsWith("+") ? phoneRaw : `+${phoneRaw}`;
    const messageBody = `Your login code is: ${otp}`;

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
      JSON.stringify({ status: "ok", bird_status: (data as any).status || "sent" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Hook error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
