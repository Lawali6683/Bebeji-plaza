export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");

  const ALLOWED_ORIGINS = [
    "https://bebejiplaza.pages.dev",
    "http://localhost:8080",
    "https://www.bebejiplaza.com",
  ];

  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data = await request.json();
    const { apiKey, adminEmail, sellerEmail, cardImage, subject } = data;

    if (!apiKey || apiKey !== env.API_AUTH_KEY) {
      return new Response(JSON.stringify({ success: false, message: "Auth failed" }), {
        status: 401, headers: corsHeaders
      });
    }

    const recipients = [adminEmail];
    if (sellerEmail && sellerEmail.includes('@')) {
      recipients.push(sellerEmail);
    }

   
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Bebeji Plaza", email: "bebejiplaza05@gmail.com" },
        to: recipients.map(email => ({ email })),
        subject: subject || "Legal Device Purchase Agreement",
        htmlContent: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; text-align: center; background: #f9f9f9; padding: 20px;">
            <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #ddd; display: inline-block;">
              <h2 style="color: #0a1128;">Bebeji Plaza Official Receipt</h2>
              <p style="color: #444;">Wannan shine katin yarjejeniyar cinikin da aka yi.</p>
              <img src="${cardImage}" alt="Receipt Card" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <p style="color: #888; font-size: 12px; margin-top: 20px;">Wannan sako ne daga tsarin Bebeji Plaza Verification System.</p>
            </div>
          </div>
        `,
      }),
    });

    const emailStatus = await brevoRes.json();
    if (!brevoRes.ok) throw new Error(JSON.stringify(emailStatus));

    return new Response(JSON.stringify({ success: true, emailStatus }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: corsHeaders
    });
  }
}
