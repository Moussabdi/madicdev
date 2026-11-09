// MADIC - Endpoint prive de rendu du gabarit commun.
import { madicEmailHtml } from "./madic-email-template.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const secret = Deno.env.get("MADIC_CRON_SECRET");
  if (req.method !== "POST" || !secret ||
      req.headers.get("x-madic-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const input: unknown = await req.json();
    if (!input || typeof input !== "object") return new Response("Invalid input", { status: 400 });
    const data = input as Record<string, unknown>;
    if (typeof data.title !== "string" || data.title.length > 250 ||
        typeof data.cabinet !== "string" || data.cabinet.length > 250 ||
        !Array.isArray(data.paragraphs) || data.paragraphs.length > 20 ||
        !data.paragraphs.every((p: unknown) => typeof p === "string" && p.length <= 4000)) {
      return new Response("Invalid template fields", { status: 400 });
    }
    let details: {label:string;value:string}[] | undefined;
    if (data.details !== undefined) {
      if (!Array.isArray(data.details) || data.details.length > 30 ||
          !data.details.every((d: unknown) => d && typeof d === "object" &&
            typeof (d as {label?:unknown}).label === "string" &&
            typeof (d as {value?:unknown}).value === "string" &&
            (d as {label:string}).label.length <= 250 && (d as {value:string}).value.length <= 2000)) {
        return new Response("Invalid details", { status: 400 });
      }
      details = data.details as {label:string;value:string}[];
    }
    let action: {label:string;url:string} | undefined;
    if (data.action !== undefined) {
      const a = data.action as {label?:unknown;url?:unknown};
      if (!a || typeof a.label !== "string" || typeof a.url !== "string" ||
          a.label.length > 250 || a.url.length > 2048) return new Response("Invalid action", {status:400});
      const url = new URL(a.url);
      if (url.protocol !== "https:" || url.hostname !== "madic.ca") {
        return new Response("Invalid action URL", {status:400});
      }
      action = {label:a.label,url:a.url};
    }
    const html = madicEmailHtml({greeting: typeof data.greeting === "string" && data.greeting.length <= 250 ? data.greeting : undefined, title:data.title,cabinet:data.cabinet,paragraphs:data.paragraphs as string[],details,action});
    return Response.json({html}, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
});
