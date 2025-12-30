// reportCard.js - Cloudflare Worker Function
export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  
  const ALLOWED_ORIGINS = [
        "https://bebejiplaza.pages.dev",
        "http://localhost:8080",
        "https://www.bebejiplaza.com",
    ];


  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { apiKey, postId, action } = await request.json();

    // 1. Tsaro (Security Check)
    if (!apiKey || apiKey !== "@haruna66") {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const RTDB_URL = "https://bebeji-plaza-6b176-default-rtdb.firebaseio.com";
    const FIREBASE_SECRET = env.FIREBASE_SECRET; // Saka wannan a Cloudflare Dashboard

    // 2. Nemo bayanan katin
    const cardRes = await fetch(`${RTDB_URL}/CardData/${postId}.json?auth=${FIREBASE_SECRET}`);
    const cardData = await cardRes.json();

    if (!cardData) return new Response(JSON.stringify({ success: false, message: "Not found" }), { headers: corsHeaders });

    let updateData = {};
    let subject = "";
    let emailStatus = "";

    if (action === "report") {
      // Sanya alamar SATA
      updateData = { isStolen: true, reportedAt: new Date().toISOString() };
      // Ajiye a CardReport DB
      await fetch(`${RTDB_URL}/CardReport/${postId}.json?auth=${FIREBASE_SECRET}`, {
        method: "PUT",
        body: JSON.stringify(cardData)
      });
      subject = "GARGADI: Rahoton Satar Waya - Bebeji Plaza";
      emailStatus = "AN YI RAHOTON SATA";
    } else if (action === "remove") {
      // Cire alamar SATA
      updateData = { isStolen: null, reportedAt: null };
      // Goge daga CardReport DB
      await fetch(`${RTDB_URL}/CardReport/${postId}.json?auth=${FIREBASE_SECRET}`, { method: "DELETE" });
      subject = "Cire Rahoton Sata - Bebeji Plaza";
      emailStatus = "AN CIRE DAGA ZARGIN SATA";
    }

    // Update Babban DB
    await fetch(`${RTDB_URL}/CardData/${postId}.json?auth=${FIREBASE_SECRET}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });

    // 3. Tsarin Tura Email na Zamani (Resend API)
    const emailBody = `
      <div style="font-family: Arial, sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <img src="https://i.imgur.com/MNooQYo.png" width="100" style="display: block; margin: 0 auto;">
        <h2 style="color: #003366; text-align: center;">BEBEJI PLAZA PHONE CENTER</h2>
        <div style="background: ${action === 'report' ? '#fee' : '#efe'}; padding: 15px; border-radius: 5px; text-align: center;">
          <h3 style="color: ${action === 'report' ? '#c00' : '#28a'};">${emailStatus}</h3>
        </div>
        <p><b>Sunan Wayar:</b> ${cardData.deviceName}</p>
        <p><b>Mabuɗin Bincike:</b> ${postId}</p>
        <p><b>Mai Saye:</b> ${cardData.buyerName}</p>
        <hr>
        <p style="font-size: 12px; color: #777;">Wannan sakon ya fito ne daga tsarin tsaro na Bebeji Plaza Gusau. Idan ba kai ne ka yi wannan aikin ba, tuntuɓi shago cikin gaggawa.</p>
      </div>
    `;

    const recipients = [cardData.buyerEmail, "bebejiplaza05@gmail.com"];
    
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "Security Bebeji Plaza <security@bebejiplaza.com>",
        to: recipients,
        subject: subject,
        html: emailBody
      })
    });

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: corsHeaders });
  }
}