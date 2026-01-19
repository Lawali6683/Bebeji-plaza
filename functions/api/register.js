export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");

    const ALLOWED_ORIGINS = [
        "https://bebejiplaza.pages.dev",
        "https://www.bebejiplaza.com",
        "http://localhost:8080",
    ];

    const corsHeaders = (o) => ({
        "Access-Control-Allow-Origin": o,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    });

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response(JSON.stringify({ success: false, message: "Access denied" }), {
            status: 403,
            headers: corsHeaders(origin),
        });
    }

    if (request.headers.get("x-api-key") !== env.API_AUTH_KEY) {
        return new Response(JSON.stringify({ success: false, message: "Invalid API key" }), {
            status: 401,
            headers: corsHeaders(origin),
        });
    }

    try {
        const { idCardNumber } = await request.json();

        if (!idCardNumber) {
            return new Response(JSON.stringify({
                success: false,
                message: "idCardNumber is required"
            }), { status: 400, headers: corsHeaders(origin) });
        }

        const res = await fetch(
            `${env.FIREBASE_RTDB_URL}/Members.json?auth=${env.FIREBASE_SECRET}`
        );

        const members = await res.json();
        if (!members) {
            return new Response(JSON.stringify({
                success: false,
                message: "No members found"
            }), { status: 404, headers: corsHeaders(origin) });
        }

        let found = null;

        for (const key in members) {
            const m = members[key];
            if (
                typeof m.idcardNumber === "string" &&
                m.idcardNumber.trim() === idCardNumber.trim()
            ) {
                found = { ...m, memberId: m.memberId || key };
                break;
            }
        }

        if (!found) {
            return new Response(JSON.stringify({
                success: false,
                message: "Member ID Card Number not found"
            }), { status: 404, headers: corsHeaders(origin) });
        }

      
       const memberData = {
    memberId: foundMemberId, 

    idcardNumber: foundMember.idcardNumber || "",
    fullName: foundMember.fullName || "",

    businessName: foundMember.businessName || foundMember.businesName || "",
    businesName: foundMember.businesName || foundMember.businessName || "",

    phoneNumber: foundMember.phoneNumber || "",
    email: foundMember.email || "",

    country: foundMember.country || "",
    state: foundMember.state || "",
    lg: foundMember.lg || "",

    bebejiShopNumber: foundMember.bebejiShopNumber || "",

    idCardImageLink: foundMember.idCardImageLink || "",
    userImageLink: foundMember.userImageLink || "",
    shopImageLink: foundMember.shopImageLink || ""
};

        return new Response(JSON.stringify({
            success: true,
            member: memberData
        }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
        });

    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            message: e.message
        }), { status: 500, headers: corsHeaders(origin) });
    }
}
