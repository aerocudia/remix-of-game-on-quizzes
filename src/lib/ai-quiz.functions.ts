import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  topic: z.string().min(2).max(200),
  count: z.number().int().min(1).max(15).default(5),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
});

type GeneratedQ = {
  question_text: string;
  options: string[];
  correct_answer: string;
};

export const generateAIQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI gateway not configured");

    const system =
      "You generate fun, engaging multiple-choice quiz questions. Always respond by calling the provided tool. Each question MUST have exactly 4 options and the correct_answer MUST match one option exactly.";
    const user = `Generate ${data.count} ${data.difficulty}-difficulty multiple-choice quiz questions about: ${data.topic}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_quiz",
              description: "Return the generated quiz questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_text: { type: "string" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          minItems: 4,
                          maxItems: 4,
                        },
                        correct_answer: { type: "string" },
                      },
                      required: ["question_text", "options", "correct_answer"],
                    },
                  },
                },
                required: ["questions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_quiz" } },
      }),
    });

    if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add funds in workspace settings.");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);

    const payload = await res.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI did not return questions");
    const args = JSON.parse(call.function.arguments) as { questions: GeneratedQ[] };
    const cleaned = args.questions
      .filter((q) => q.options?.length === 4 && q.options.includes(q.correct_answer))
      .slice(0, data.count);
    return { questions: cleaned };
  });
