
Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "content-type",
        },
      });
    }
  
    if (req.method === "GET") {
      return Response.json({
        success: true,
        function: "ypd-webhook",
        message: "YPD webhook endpoint is online.",
        mode: "diagnostic",
      });
    }
  
    if (req.method === "POST") {
      // Do not acknowledge payment events until
      // Ontech's signature and payload are verified.
      return Response.json(
        {
          success: false,
          message: "Webhook verification is not configured yet.",
        },
        { status: 503 },
      );
    }
  
    return new Response("Method not allowed", {
      status: 405,
    });
  });
  