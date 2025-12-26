export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  
  const ALLOWED_ORIGINS = [
    "https://bebejiplaza.pages.dev",
    "https://www.bebejiplaza.com",
    "http://localhost:8080",
  ];

  const corsHeaders = (requestedOrigin) => ({
    "Access-Control-Allow-Origin": requestedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    "Access-Control-Max-Age": "86400",
  });

  // 1. Handle CORS Preflight
  if (request.method === "OPTIONS") {
    if (ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    return new Response("Forbidden Origin", { status: 403 });
  }

  if (request.method !== "POST") {
    return new Response("Only POST supported.", { status: 405 });
  }

  try {
    const data = await request.json();
    const apiKey = request.headers.get("x-api-key");

    // 2. Authentication
    if (!apiKey || apiKey !== env.API_AUTH_KEY) {
      return new Response(JSON.stringify({ success: false, message: "Auth failed." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const { to, imageData, data: cardData } = data;

    // 3. Tabbatar da bayanan katin sun zo
    if (!imageData || !cardData) {
      return new Response(JSON.stringify({ success: false, message: "Missing image or card data." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // 4. Tsara jerin Emails (To List)
    // Koyaushe tura kofin zuwa ga shago (Admin)
    const adminEmail = env.ADMIN_EMAIL || "bebejiplaza05@gmail.com"; 
    let recipients = [adminEmail];

    // Idan akwai email na mai saya, a hada shi
    if (to && to.trim() !== "" && to.includes("@")) {
      recipients.push(to.trim());
    }

    const trackingID = cardData.postId || cardData.trackingKey;
    const subject = `Sales Record: ${cardData.deviceName} (ID: ${trackingID})`;

    // 5. Tsarin Email Body (HTML)
    const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f9; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; border: 1px solid #ddd; }
                .header { text-align: center; color: #003366; }
                .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .img-box { text-align: center; }
                .img-box img { width: 100%; max-width: 450px; border: 2px solid #003366; border-radius: 5px; }
                .footer { font-size: 11px; text-align: center; color: #777; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header"><h2>Bebeji Plaza Receipt</h2></div>
                <p>Hello <strong>${cardData.buyerName}</strong>,</p>
                <p>Attached is your digital receipt for the purchase of <strong>${cardData.deviceName}</strong>.</p>
                <div class="details">
                    <p><strong>Tracking ID:</strong> ${trackingID}</p>
                    <p><strong>IMEI:</strong> ${cardData.deviceSerial || cardData.imei}</p>
                    <p><strong>Price:</strong> ₦${Number(cardData.devicePrice).toLocaleString()}</p>
                    <p><strong>Date:</strong> ${cardData.dateTime}</p>
                </div>
                <div class="img-box">
                    <img src="${imageData}" alt="Certificate">
                </div>
                <div class="footer">
                    <p>Gusau, Zamfara State. Support: ${cardData.phoneNumber || '+234 8166836059'}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // 6. Tura Email ta hanyar Resend API
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Bebeji Plaza <onboarding@resend.dev>",
        to: recipients, // Wannan zai dauki admin da kuma buyer idan akwai
        subject: subject,
        html: emailBody,
      }),
    });

    const result = await resendRes.json();

    if (resendRes.ok) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: recipients.length > 1 ? "Emails sent to Buyer & Admin" : "Email sent to Admin only", 
        resendId: result.id 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    } else {
      throw new Error(JSON.stringify(result));
    }

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: "Error sending email", error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
}