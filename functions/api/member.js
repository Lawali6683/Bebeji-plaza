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

    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== env.API_AUTH_KEY) {
        return new Response(JSON.stringify({ message: "Invalid API key." }), {
            status: 401,
            headers: corsHeaders(origin),
        });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ message: "Method Not Allowed." }), {
            status: 405,
            headers: corsHeaders(origin),
        });
    }

    try {
        const data = await request.json();

        const {
            fullName,
            phoneNumber,
            businessName,
            shopNumber,
            idCardNumber,
            email,
            country,
            state,
            lg,
            idCardImageLink,
            userImageLink,
            shopImageLink
        } = data;

        if (
            !fullName ||
            !phoneNumber ||
            !businessName ||
            !shopNumber ||
            !idCardNumber ||
            !email ||
            !lg ||
            !idCardImageLink ||
            !userImageLink ||
            !shopImageLink
        ) {
            return new Response(
                JSON.stringify({ message: "Missing required fields." }),
                { status: 400, headers: corsHeaders(origin) }
            );
        }

        
        const checkIdCardExists = async (idCardNumber) => {
            const queryUrl =
                `${FIREBASE_RTDB_URL}/Members.json` +
                `?orderBy="idcardNumber"&equalTo="${idCardNumber}"` +
                `&auth=${env.FIREBASE_SECRET}`;

            const res = await fetch(queryUrl);
            const result = await res.json();
            return result && Object.keys(result).length > 0;
        };

        if (await checkIdCardExists(idCardNumber)) {
            return new Response(
                JSON.stringify({
                    message: "Error: This Member ID Card Number is already registered."
                }),
                { status: 409, headers: corsHeaders(origin) }
            );
        }

       
        const memberId = `MB-${Date.now()}`;

        const memberData = {
            memberId,
            idcardNumber: idCardNumber,
            fullName,
            businessName,
            phoneNumber,
            email,
            country,
            state,
            lg,
            bebejiShopNumber: shopNumber,
            idCardImageLink,
            userImageLink,
            shopImageLink,
            registerTime: new Date().toISOString()
        };

    
        const writeUrl =
            `${FIREBASE_RTDB_URL}/Members/${memberId}.json?auth=${env.FIREBASE_SECRET}`;

        const writeResponse = await fetch(writeUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(memberData),
        });

        if (!writeResponse.ok) {
            throw new Error("Failed to write member data.");
        }

        return new Response(
            JSON.stringify({
                message: "Member registered successfully.",
                memberId,
                member: memberData,
            }),
            {
                status: 201,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders(origin),
                },
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ message: `Internal server error: ${error.message}` }),
            { status: 500, headers: corsHeaders(origin) }
        );
    }
}
