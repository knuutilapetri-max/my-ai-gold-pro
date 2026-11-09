
/**
 * MY AI GOLD PRO - Cloudflare Worker
 * Requires the Cloudflare secret: OPENAI_API_KEY
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        status: "MY AI GOLD PRO chat worker online"
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!env.OPENAI_API_KEY) {
      return json({
        error: "Server configuration missing OPENAI_API_KEY"
      }, 503);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({
        error: "messages must be a non-empty array"
      }, 400);
    }

    const messages = body.messages
      .slice(-12)
      .map((m) => {
        const role = m?.role === "assistant"
          ? "assistant"
          : "user";

        const content = typeof m?.content === "string"
          ? m.content.slice(0, 8000)
          : "";

        return { role, content };
      })
      .filter(m => m.content.trim());

    if (!messages.length) {
      return json({ error: "No valid message content" }, 400);
    }

    const context = typeof body.context === "string"
      ? body.context.slice(0, 12000)
      : "";

    const instructions = [
      "Olet MY AI GOLD PRO -sovelluksen suomenkielinen markkina-analyysin keskusteluavustaja.",
      "Vastaa käyttäjälle aina suomeksi, selkeästi ja käytännöllisesti.",
      "Analysoi kultamarkkinoita ja XAUUSDT-markkinaa, kun käyttäjän kysymys liittyy niihin.",
      "Käytä sovelluksen antamaa markkinakontekstia silloin kun se on saatavilla.",
      "Älä koskaan keksi reaaliaikaisia hintoja, indikaattoreita tai uutisia.",
      "Jos ajantasaista markkinatietoa ei ole annettu, kerro se selvästi.",
      "Selitä BUY- ja SELL-signaalit sekä Entry-, TP- ja SL-tasot epävarmuuksineen.",
      "Älä lupaa tuottoa äläkä väitä toteuttavasi kauppoja.",
      context
        ? "SOVELLUKSEN TILANNEKONTEKSTI:\n" + context
        : "Sovelluksen markkinakontekstia ei toimitettu. Älä oleta markkinahintoja."
    ].join("\n\n");

    try {
      const upstream = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            instructions,
            input: messages,
            max_output_tokens: 900
          })
        }
      );

      const result = await upstream.json();

      if (!upstream.ok) {
        return json({
          error: result.error?.message || "OpenAI API request failed"
        }, upstream.status);
      }

      let reply = result.output_text || "";

      if (!reply && Array.isArray(result.output)) {
        for (const item of result.output) {
          if (Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part.type === "output_text") {
                reply += part.text || "";
              }
            }
          }
        }
      }

      if (!reply.trim()) {
        return json({
          error: "AI did not return a response"
        }, 502);
      }

      return json({ reply: reply.trim() });

    } catch (error) {
      return json({
        error: "AI connection failed: " + error.message
      }, 502);
    }
  }
};

