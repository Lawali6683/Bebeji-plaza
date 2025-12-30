function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");
    const SERVER_KEY = "@haruna66";

    const ALLOWED_ORIGINS = [
        "https://bebejiplaza.pages.dev",
        "http://localhost:8080",
        "https://www.bebejiplaza.com"
    ];

    const corsHeaders = {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.headers.get("x-api-key") !== SERVER_KEY || !ALLOWED_ORIGINS.includes(origin)) {
        return new Response(JSON.stringify({ message: "Unauthorized access." }), { 
            status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } 
        });
    }

    const url = new URL(request.url);
    const ACTION = url.searchParams.get('action') === 'verify' ? 'VERIFY' : 'SEND';
    const EMAIL_KV = env.EMAIL_OTP_KV;

    try {
        const data = await request.json();

        if (ACTION === 'SEND') {
            const { email } = data;
            if (!email) return new Response(JSON.stringify({ message: "Email is required." }), { status: 400, headers: corsHeaders });

            const otp = generateOtp();
            const otpKey = `otp:${email.toLowerCase()}`;
            await EMAIL_KV.put(otpKey, otp, { expirationTtl: 1800 }); 

            // -------------------
            // Brevo API Email
            // -------------------
            const res = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": env.BREVO_API_KEY,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    sender: { name: "Bebeji Plaza", email: "bebejiplaza05@gmail.com" },
                    to: [{ email }],
                    subject: "Verification Code (OTP)",
                    htmlContent: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                            <h2 style="color: #333;">Verification Code</h2>
                            <p>Your verification code is: <b style="font-size: 28px; color: #007bff; letter-spacing: 2px;">${otp}</b></p>
                            <p>This code will expire in <b style="color: #dc3545;">30 minutes</b>.</p>
                            <hr style="border: 0; border-top: 1px solid #eee;">
                            <p style="font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                        </div>
                    `
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(JSON.stringify(result));

            return new Response(JSON.stringify({ message: "OTP sent successfully.", status: 'sent' }), {
                status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
            });

        } else if (ACTION === 'VERIFY') {
            const { email, otp } = data;
            const otpKey = `otp:${email.toLowerCase()}`;
            const storedOtp = await EMAIL_KV.get(otpKey);

            if (storedOtp && storedOtp === otp) {
                await EMAIL_KV.delete(otpKey); 
                return new Response(JSON.stringify({ message: "OTP verified successfully.", status: 'verified' }), {
                    status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            } else {
                return new Response(JSON.stringify({ message: "Invalid or expired OTP." }), {
                    status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
        }
    } catch (error) {
        return new Response(JSON.stringify({ message: `Server error: ${error.message}` }), { 
            status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } 
        });
    }
}
