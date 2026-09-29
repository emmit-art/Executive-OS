import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedStatuses = new Set([
  "received",
  "processing",
  "needs_clarification",
  "awaiting_approval",
  "completed",
  "failed",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const makeWebhookUrl = Deno.env.get("MAKE_COACH_WEBHOOK_URL");
  const makeWebhookKey = Deno.env.get("MAKE_COACH_WEBHOOK_KEY");

  if (!supabaseUrl || !anonKey) {
    return json({ error: "Supabase runtime configuration is missing" }, 500);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  let requestId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();
    const threadId = String(body?.thread_id ?? "").trim() || crypto.randomUUID();
    const inputType = String(body?.input_type ?? "text").trim() || "text";
    const source = String(body?.source ?? "coffee_run").trim() || "coffee_run";

    if (!message) return json({ error: "message is required" }, 400);

    const { data: created, error: insertError } = await supabase
      .from("assistant_requests")
      .insert({
        owner_id: user.id,
        thread_id: threadId,
        message,
        input_type: inputType,
        status: "received",
        source,
      })
      .select("id")
      .single();

    if (insertError || !created) throw insertError ?? new Error("Could not create request");
    requestId = created.id;

    await supabase
      .from("assistant_requests")
      .update({ status: "processing" })
      .eq("id", requestId);

    if (!makeWebhookUrl) {
      throw new Error("MAKE_COACH_WEBHOOK_URL is not configured");
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (makeWebhookKey) {
      headers["x-make-apikey"] = makeWebhookKey;
    }

    const makeResponse = await fetch(makeWebhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: message,
        thread_id: threadId,
        user_id: user.id,
        request_id: requestId,
        source,
        input_type: inputType,
      }),
    });

    const responseText = await makeResponse.text();
    if (!makeResponse.ok) {
      throw new Error(
        `Make webhook returned ${makeResponse.status}${responseText ? `: ${responseText.slice(0, 500)}` : ""}`,
      );
    }

    let makeData: Record<string, unknown> = {};
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText);
        makeData = parsed && typeof parsed === "object" ? parsed : { reply: responseText };
      } catch {
        makeData = { reply: responseText };
      }
    }

    const returnedStatus = String(makeData.status ?? "completed");
    const status = allowedStatuses.has(returnedStatus) ? returnedStatus : "completed";
    const reply = String(makeData.reply ?? "").trim();
    const requiresApproval =
      Boolean(makeData.requires_approval) || status === "awaiting_approval";
    const makeExecutionId = makeData.make_execution_id
      ? String(makeData.make_execution_id)
      : null;
    const errorMessage = makeData.error_message
      ? String(makeData.error_message)
      : null;
    const terminal = status === "completed" || status === "failed";

    const { error: updateError } = await supabase
      .from("assistant_requests")
      .update({
        status,
        reply: reply || null,
        requires_approval: requiresApproval,
        make_execution_id: makeExecutionId,
        error_message: errorMessage,
        completed_at: terminal ? new Date().toISOString() : null,
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    return json({
      status,
      reply,
      requires_approval: requiresApproval,
      request_id: requestId,
      thread_id: threadId,
      make_execution_id: makeExecutionId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (requestId) {
      await supabase
        .from("assistant_requests")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    return json(
      {
        status: "failed",
        error: errorMessage,
        request_id: requestId,
      },
      502,
    );
  }
});

