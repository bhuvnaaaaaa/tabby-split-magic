import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

export const parseTab = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ notes: z.string().trim().min(1).max(5000), currency: z.enum(["INR", "USD", "EUR"]) }).strict().parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) { setResponseStatus(503); return { ok: false as const, status: 503, error: "Online parsing isn’t configured. Your notes can still be split locally." }; }
    const { parseTabWithAI } = await import("./tabby-parser.server");
    const result = await parseTabWithAI(data.notes, data.currency, getRequest(), apiKey);
    if (!result.ok) setResponseStatus(result.status);
    return result;
  });

export const readReceipt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ image: z.string().max(7_000_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/), currency: z.enum(["INR", "USD", "EUR"]) }).strict().parse(input))
  .handler(async ({ data }) => {
    const match = data.image.match(/^data:image\/(jpeg|png|webp);base64,(.*)$/);
    if (!match?.[2]) return { ok: false as const, status: 400, error: "Choose a valid receipt photo." };
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    const valid = match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : match[1] === "png" ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid || bytes.length > 5_000_000) return { ok: false as const, status: 400, error: "Choose a valid JPEG, PNG or WebP photo smaller than 5 MB." };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, status: 503, error: "Receipt reading is not configured yet." };
    const { parseTabWithAI } = await import("./tabby-parser.server");
    const result = await parseTabWithAI("", data.currency, getRequest(), apiKey, data.image);
    if (!result.ok) {
      setResponseStatus(result.status);
      if (result.status === 422) return { ok: false as const, status: 422, error: "Couldn’t read this receipt clearly. Try a sharper, well-lit close-up with the whole bill in frame." };
    }
    return result;
  });