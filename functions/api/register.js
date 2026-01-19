export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");
    const ALLOWED_ORIGINS = ["https://bebejiplaza.pages.dev", "https://www.bebejiplaza.com", "http://localhost:8080"];
    
    const corsHeaders = (reqOrigin) => ({
        "Access-Control-Allow-Origin": reqOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== env.API_AUTH_KEY) return new Response(JSON.stringify({ message: "Invalid API key." }), { status: 401, headers: corsHeaders(origin) });

    try {
        const body = await request.json();
        const { idCardNumber } = body;

        if (!idCardNumber) return new Response(JSON.stringify({ message: "ID Card Number is required." }), { status: 400, headers: corsHeaders(origin) });

        const membersUrl = `${env.FIREBASE_RTDB_URL}/Members.json?auth=${env.FIREBASE_SECRET}`;
        const res = await fetch(membersUrl);
        const members = await res.json();

        let foundMember = null;
        let memberKey = null;
      
        for (const key in members) {
            if (members[key].idcardNumber && members[key].idcardNumber.toString().trim() === idCardNumber.toString().trim()) {
                foundMember = members[key];
                memberKey = key;
                break;
            }
        }

        if (!foundMember) {
            return new Response(JSON.stringify({ message: "Member ID not found in database." }), { status: 404, headers: corsHeaders(origin) });
        }

       
        const responseData = {
            success: true,
            member: {
                memberId: memberKey,
                idcardNumber: foundMember.idcardNumber,
                fullName: foundMember.fullName || "",
                businessName: foundMember.businessName || foundMember.businesName || "",
                phoneNumber: foundMember.phoneNumber || "",
                email: foundMember.email || "",
                bebejiShopNumber: foundMember.bebejiShopNumber || foundMember.shopNumber || "",
                state: foundMember.state || "",
                lg: foundMember.lg || "",
                idCardImageLink: foundMember.idCardImageLink || "",
                userImageLink: foundMember.userImageLink || "",
                shopImageLink: foundMember.shopImageLink || ""
            }
        };

        return new Response(JSON.stringify(responseData), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });

    } catch (error) {
        return new Response(JSON.stringify({ message: "Server Error: " + error.message }), { status: 500, headers: corsHeaders(origin) });
    }
}
