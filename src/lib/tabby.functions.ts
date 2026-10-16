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