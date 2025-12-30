export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");
    
    const FIREBASE_RTDB_URL = env.FIREBASE_RTDB_URL || "https://bebeji-plaza-6b176-default-rtdb.firebaseio.com";
    
    const ALLOWED_ORIGINS = [
        "https://bebejiplaza.pages.dev",
        "http://localhost:8080",
        "https://www.bebejiplaza.com",
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
        const data = await request.json();
        const { fullName, phoneNumber, businessName, shopNumber, idCardNumber, email, country, state, lg, idCardImageLink, userImageLink, shopImageLink } = data;

        if (!fullName || !phoneNumber || !businessName || !shopNumber || !idCardNumber || !lg || !idCardImageLink || !userImageLink || !shopImageLink || !email) {
            return new Response(JSON.stringify({ message: "Missing required fields (email, all images, etc.)." }), { status: 400, headers: corsHeaders(origin) });
        }

        const checkDuplicate = async (field, value) => {
            const safeValue = encodeURIComponent(value);
            const queryUrl = `${FIREBASE_RTDB_URL}/Members.json?orderBy="${field}"&equalTo="${safeValue}"&auth=${env.FIREBASE_SECRET}`;
            const res = await fetch(queryUrl);
            const data = await res.json();
            return data && Object.keys(data).length > 0;
        };

        if (await checkDuplicate('idcardNumber', idCardNumber)) {
            return new Response(JSON.stringify({ message: "Error: This Member ID Card Number is already registered." }), { 
                status: 409, 
                headers: corsHeaders(origin) 
            });
        }

        if (await checkDuplicate('bebejiShopNumber', shopNumber)) {
            return new Response(JSON.stringify({ message: "Error: This Shop Number is already registered." }), { 
                status: 409, 
                headers: corsHeaders(origin) 
            });
        }
        
        const memberData = {
            idcardNumber,
            fullName,
            businesName: businessName,
            phoneNumber,
            email,
            country,
            bebejiShopNumber: shopNumber,
            state,
            lg,
            idCardImageLink,
            userImageLink, 
            shopImageLink, 
            registerTime: new Date().toISOString(),
        };

        const firebaseWriteUrl = `${FIREBASE_RTDB_URL}/Members.json?auth=${env.FIREBASE_SECRET}`;
        const writeResponse = await fetch(firebaseWriteUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memberData)
        });

        if (!writeResponse.ok) throw new Error("Failed to write data to Firebase.");
        
        return new Response(JSON.stringify({ message: "Member data saved successfully.", member: memberData }), {
            status: 201,
            headers: { 
                "Content-Type": "application/json", 
                ...corsHeaders(origin) 
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ message: `Internal server error: ${error.message}` }), { 
            status: 500, 
            headers: corsHeaders(origin) 
        });
    }
}