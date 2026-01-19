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


        const membersUrl = `${env.FIREBASE_RTDB_URL}/Members.json?auth=${env.FIREBASE_SECRET}`;
const res = await fetch(membersUrl);

if (!res.ok) {
    throw new Error("Failed to read Members database.");
}

const members = await res.json();

if (!members) {
    return new Response(JSON.stringify({
        message: "Member ID Card Number not found."
    }), { status: 404, headers: corsHeaders(origin) });
}

let foundMember = null;
let foundMemberId = null;

for (const memberId in members) {
    const m = members[memberId];

    if (
        m &&
        typeof m.idcardNumber === "string" &&
        m.idcardNumber.trim() === idCardNumber.trim()
    ) {
        foundMember = m;
        foundMemberId = memberId;
        break;
    }
}

if (!foundMember) {
    return new Response(JSON.stringify({
        message: "Member ID Card Number not found."
    }), { status: 404, headers: corsHeaders(origin) });
}


const memberData = {
    idcardNumber: foundMember.idcardNumber,

    fullName: foundMember.fullName || "",
  
    businessName: foundMember.businessName || foundMember.businesName || "",
    businesName: foundMember.businesName || foundMember.businessName || "",

    phoneNumber: foundMember.phoneNumber || "",
    email: foundMember.email || "",

    bebejiShopNumber: foundMember.bebejiShopNumber || "",

    state: foundMember.state || "",
    lg: foundMember.lg || "",

    idCardImageLink: foundMember.idCardImageLink || "",
    userImageLink: foundMember.userImageLink || "",
    shopImageLink: foundMember.shopImageLink || ""
};


const requiredFields = [
    "memberId",
    "idcardNumber",
    "fullName",
    "businessName",
    "phoneNumber",
    "email",
    "bebejiShopNumber"
];

const missing = requiredFields.filter(
    f => !memberData[f] || memberData[f].trim?.() === ""
);

if (missing.length > 0) {
    return new Response(JSON.stringify({
        message: "Incomplete member data in database.",
        missing
    }), { status: 422, headers: corsHeaders(origin) });
}


return new Response(JSON.stringify({
    success: true,
    member: memberData
}), {
    status: 200,
    headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin)
    }
});
