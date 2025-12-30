export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");

    const ALLOWED_ORIGINS = [
      "https://bebejiplaza.pages.dev",
    "https://www.bebejiplaza.com", 
    "http://localhost:8080",
    ];

    const corsHeaders = (reqOrigin) => ({
        "Access-Control-Allow-Origin": reqOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        "Access-Control-Max-Age": "86400",
    });

    if (request.method === "OPTIONS") {
        if (ALLOWED_ORIGINS.includes(origin)) {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }
        return new Response(null, { status: 403 }); 
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response(JSON.stringify({ message: "Access denied." }), { status: 403 });
    }

    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== env.API_AUTH_KEY) {
        return new Response(JSON.stringify({ message: "Invalid API key." }), { 
            status: 401, 
            headers: corsHeaders(origin) 
        });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ message: "Method Not Allowed." }), { 
            status: 405, 
            headers: corsHeaders(origin) 
        });
    }

    try {
        const body = await request.json();
        const { idCardNumber } = body;

        if (!idCardNumber) {
            return new Response(JSON.stringify({ message: "idCardNumber is required." }), { 
                status: 400, 
                headers: corsHeaders(origin) 
            });
        }

        const safeIdCardNumber = encodeURIComponent(idCardNumber.trim());
        
        
        const firebaseQuery = `${env.FIREBASE_RTDB_URL}/Members.json?orderBy="idcardNumber"&equalTo="${safeIdCardNumber}"&auth=${env.FIREBASE_SECRET}`;

        const firebaseResponse = await fetch(firebaseQuery);
        const firebaseData = await firebaseResponse.json();

        if (!firebaseData || Object.keys(firebaseData).length === 0) {
            return new Response(JSON.stringify({ 
                message: "Member ID Card Number not found. Please verify your number." 
            }), { 
                status: 404, 
                headers: corsHeaders(origin) 
            });
        }

        const memberKey = Object.keys(firebaseData)[0];
        const member = firebaseData[memberKey];

       
        const memberData = {
            idcardNumber: member.idcardNumber,
            fullName: member.fullName,
            businesName: member.businesName || "", 
            phoneNumber: member.phoneNumber || "",
            email: member.email || "",
            bebejiShopNumber: member.bebejiShopNumber || "",
            state: member.state || "",
            lg: member.lg || "",
            idCardImageLink: member.idCardImageLink || "",
            userImageLink: member.userImageLink || "", 
            shopImageLink: member.shopImageLink || "",
        };

        return new Response(JSON.stringify({ message: "Verification successful.", member: memberData }), {
            status: 200,
            headers: { 
                "Content-Type": "application/json", 
                ...corsHeaders(origin) 
            },
        });
    } catch (error) {
        console.error("Worker Error:", error.stack);
        return new Response(JSON.stringify({ message: "Internal server error during processing." }), { 
            status: 500, 
            headers: corsHeaders(origin) 
        });
    }
}