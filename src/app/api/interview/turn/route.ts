import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { planStore, type Session, type Turn, type PlanQuestion } from "@/lib/planStore";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { sessionId, lastQuestion, lastAnswer } = await req.json();

    if (!sessionId || !planStore[sessionId]) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }
    if (!lastQuestion || !lastAnswer) {
      return NextResponse.json({ error: "Missing lastQuestion/lastAnswer" }, { status: 400 });
    }

    const session: Session = planStore[sessionId];
    session.turns = session.turns || [];

    // Persist Q/A (avoid duplicate question if it was already logged)
    const turns = session.turns as Turn[];
    if (!(turns[turns.length - 1]?.role === "agent" && turns[turns.length - 1]?.content === lastQuestion)) {
      turns.push({ role: "agent", content: lastQuestion });
    }
    turns.push({ role: "candidate", content: lastAnswer });

    const systemPrompt = `
You are an intelligent AI Interview Agent conducting a deep, structured interview.

Goals:
1) Probe vague answers with strong follow-ups.
2) Demand specific examples, metrics, and reasoning.
3) Test expert terms from the JD: ${JSON.stringify(session.relevant_expert_terms || [])}
4) Conclude only after core areas are covered.

Return STRICT JSON:
{
  "action": "follow_up" | "next_question" | "conclude",
  "followUpQuestion"?: "string",
  "reason": "string"
}
`.trim();

    const historyMessages: ChatCompletionMessageParam[] = turns.map((t) =>
      t.role === "agent"
        ? ({ role: "assistant", content: t.content } as ChatCompletionMessageParam)
        : ({ role: "user", content: t.content } as ChatCompletionMessageParam)
    );

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { action?: "follow_up" | "next_question" | "conclude"; followUpQuestion?: string; reason?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { action: "conclude", reason: "Parser fallback." };
    }

    if (parsed.action === "follow_up") {
      const q = parsed.followUpQuestion || "Can you elaborate on that with specifics?";
      turns.push({ role: "agent", content: q });
      return NextResponse.json({ action: "follow_up", followUpQuestion: q, reason: parsed.reason || "" });
    }

    if (parsed.action === "next_question") {
      const planQs: PlanQuestion[] = session.interview_questions || [];
      // Count how many plan questions already asked
      const mainAsked = turns.filter(
        (t) => t.role === "agent" && planQs.some((q) => q.question === t.content)
      ).length;

      const nextQ = planQs[mainAsked]?.question;
      if (nextQ) {
        turns.push({ role: "agent", content: nextQ });
        return NextResponse.json({ action: "next_question", nextQuestion: nextQ, reason: parsed.reason || "" });
      }
      return NextResponse.json({ action: "conclude", reason: "All main questions asked." });
    }

    return NextResponse.json({ action: "conclude", reason: parsed.reason || "Interview concluded." });
  } catch (error) {
    console.error("❌ Interview turn error:", error);
    return NextResponse.json({ error: "Failed to process interview turn" }, { status: 500 });
  }
}
