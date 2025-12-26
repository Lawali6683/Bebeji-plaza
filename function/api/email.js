import { Resend } from 'resend';

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");
    
    const url = new URL(request.url);
    const ACTION = url.searchParams.get('action') === 'verify' ? 'VERIFY' : 'SEND'; 
    const EMAIL_KV = env.EMAIL_OTP_KV; 

    const ALLOWED_ORIGINS = [
        "https://bebejiplaza.pages.dev",
        "http://localhost:8080",
        "https://www.bebejiplaza.com"
    ];
    
    const corsHeaders = (reqOrigin) => ({
        "Access-Control-Allow-Origin": reqOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type", 
        "Access-Control-Max-Age": "86400",
    });

    if (request.method === "OPTIONS") {
        if (ALLOWED_ORIGINS.includes(origin)) {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }
        return new Response(null, { status: 403 });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response(JSON.stringify({ message: "Access denied: Unauthorized Origin." }), { status: 403 });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ message: "Method Not Allowed." }), {
            status: 405,
            headers: corsHeaders(origin)
        });
    }
    
    try {
        const data = await request.json();
        
        if (ACTION === 'SEND') {
            const { email } = data;
            if (!email) return new Response(JSON.stringify({ message: "Email is required." }), { status: 400, headers: corsHeaders(origin) });

            const otp = generateOtp();
            const otpKey = `otp:${email.toLowerCase()}`;
            
            await EMAIL_KV.put(otpKey, otp, { expirationTtl: 600 }); 

            const resend = new Resend(env.RESEND_API_KEY);
            
            const emailResponse = await resend.emails.send({
                from: 'Bebeji Plaza <onboarding@resend.dev>',
                to: email,
                subject: 'Verification Code (OTP)',
                html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
            });
            
            if (emailResponse.error) throw new Error(emailResponse.error.message);

            return new Response(JSON.stringify({ message: "OTP sent to email successfully.", status: 'sent' }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
            });
        
        } else if (ACTION === 'VERIFY') {
            const { email, otp } = data;
            if (!email || !otp) return new Response(JSON.stringify({ message: "Email and OTP are required for verification." }), { status: 400, headers: corsHeaders(origin) });

            const otpKey = `otp:${email.toLowerCase()}`;
            const storedOtp = await EMAIL_KV.get(otpKey);

            if (storedOtp && storedOtp === otp) {
                await EMAIL_KV.delete(otpKey); 
                return new Response(JSON.stringify({ message: "OTP verified successfully.", status: 'verified' }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
                });
            } else {
                return new Response(JSON.stringify({ message: "Invalid or expired OTP." }), {
                    status: 401,
                    headers: corsHeaders(origin)
                });
            }
        }

    } catch (error) {
        return new Response(JSON.stringify({ message: `Internal server error: ${error.message}` }), { 
            status: 500, 
            headers: corsHeaders(origin) 
        });
    }
}
