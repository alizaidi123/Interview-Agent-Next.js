import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { planStore, type Session } from "@/lib/planStore";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type Turn = { role: "agent" | "candidate"; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId: string | undefined = body?.sessionId;
    const fallbackHistory: Turn[] | undefined = body?.history;

    if (!sessionId || !planStore[sessionId]) {
      return NextResponse.json({ ok: false, error: "Missing or invalid sessionId" }, { status: 400 });
    }

    const session: Session = planStore[sessionId];

    // Prefer server-persisted turns; else use fallback from client
    const turns: Turn[] =
      (Array.isArray(session.turns) && session.turns.length > 0 ? session.turns : fallbackHistory) || [];

    if (turns.length === 0) {
      return NextResponse.json({ ok: false, error: "No interview turns found" }, { status: 400 });
    }

    const transcript = turns.map((t) => `${t.role === "agent" ? "AI" : "Candidate"}: ${t.content}`).join("\n");

    // ---------- Structured evaluation ----------
    const evalPrompt = `
You are an AI HR evaluator.

Job Description:
${session.job_description || "N/A"}

Candidate Resume:
${session.resume_text || "N/A"}

Interview Transcript:
${transcript}

Return STRICT JSON:
{
  "summary": "3-6 sentence overview reflecting behavior in the transcript",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendation": "Hire | Move to next round | Hold | No",
  "scores": { "communication":1-5, "professionalism":1-5, "role_fit":1-5, "seniority":1-5, "overall":1-5 },
  "flags": { "fixated_on_compensation":bool, "rude_or_confrontational":bool, "evasiveness_or_lack_of_detail":bool }
}
Judge ONLY from the transcript; penalize rudeness/evasiveness/compensation fixation when present.
`.trim();

    const evalResp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: evalPrompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    type Structured = {
      summary?: string;
      strengths?: string[];
      weaknesses?: string[];
      recommendation?: string;
      scores?: { communication?: number; professionalism?: number; role_fit?: number; seniority?: number; overall?: number };
      flags?: { fixated_on_compensation?: boolean; rude_or_confrontational?: boolean; evasiveness_or_lack_of_detail?: boolean };
    };

    let structured: Structured;
    try {
      structured = JSON.parse(evalResp.choices?.[0]?.message?.content ?? "{}");
    } catch {
      structured = { summary: "No summary generated.", strengths: [], weaknesses: [], recommendation: "Hold" };
    }

    // ---------- PDF ----------
    const pdfDoc = await PDFDocument.create();
    const pageSize: [number, number] = [612, 792];
    let page = pdfDoc.addPage(pageSize);
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const MARGIN = 56;
    const MAX_W = page.getWidth() - MARGIN * 2;
    let y = page.getHeight() - MARGIN;

    let pageIndex = 1;
    const footer = () => {
      const txt = `Page ${pageIndex++}`;
      page.drawText(txt, {
        x: page.getWidth() - MARGIN - helv.widthOfTextAtSize(txt, 9),
        y: MARGIN / 2,
        size: 9,
        font: helv,
        color: rgb(0.45, 0.45, 0.5),
      });
    };
    const newPage = () => { page = pdfDoc.addPage(pageSize); y = page.getHeight() - MARGIN; footer(); };
    const need = (n: number, lh = 14) => { if (y - n * lh < MARGIN + 30) { footer(); newPage(); } };
    const wrap = (t: string, f = helv, s = 11) => {
      if (!t) return [""];
      const words = t.split(/\s+/); const lines: string[] = []; let cur = "";
      for (const w of words) { const test = cur ? `${cur} ${w}` : w;
        if (f.widthOfTextAtSize(test, s) > MAX_W) { if (cur) lines.push(cur); cur = w; } else cur = test; }
      if (cur) lines.push(cur); return lines;
    };
    const H1 = (t: string) => { need(2, 18); page.drawText(t, { x: MARGIN, y, size: 16, font: helvBold }); y -= 22; };
    const KV = (k: string, v: string) => {
      const kt = `${k}: `; const w = helvBold.widthOfTextAtSize(kt, 11);
      need(1); page.drawText(kt, { x: MARGIN, y, size: 11, font: helvBold });
      page.drawText(v || "—", { x: MARGIN + w, y, size: 11, font: helv }); y -= 14;
    };
    const rule = () => { need(1); page.drawLine({ start: { x:MARGIN, y:y-6 }, end: { x: page.getWidth()-MARGIN, y:y-6 }, thickness: 0.6, color: rgb(0.85,0.85,0.9) }); y -= 14; };
    const P = (t: string) => { const ls = wrap(t); need(ls.length); ls.forEach(ln => { page.drawText(ln, { x:MARGIN, y, size:11, font:helv }); y -= 14; }); };
    const Bul = (arr: string[]) => {
      for (const it of arr || []) {
        const b = "• "; const w = helvBold.widthOfTextAtSize(b, 11);
        const ls = wrap(it); need(ls.length);
        page.drawText(b, { x:MARGIN, y, size:11, font:helvBold });
        page.drawText(ls[0], { x:MARGIN+w, y, size:11, font:helv }); y -= 14;
        for (const cont of ls.slice(1)) { page.drawText(cont, { x:MARGIN+w, y, size:11, font:helv }); y -= 14; }
      }
    };

    // Title
    page.drawText("Interview Evaluation Report", { x: MARGIN, y, size: 18, font: helvBold }); y -= 26;

    KV("Candidate", session.candidate_name ?? "N/A");
    KV("Position", session.role ?? "N/A");
    KV("Company", session.company_name ?? "N/A");
    KV("Generated", new Date().toLocaleString());
    rule();

    H1("Summary");
    P(structured.summary || "—");
    rule();

    H1("Strengths");
    if (structured.strengths && structured.strengths.length > 0) {
      Bul(structured.strengths);
    } else {
      P("—");
    }

    H1("Weaknesses");
    if (structured.weaknesses && structured.weaknesses.length > 0) {
      Bul(structured.weaknesses);
    } else {
      P("—");
    }

    if (structured.scores) {
      rule(); H1("Scores (1–5)");
      const s = structured.scores;
      P(`Communication: ${s?.communication ?? "—"}  |  Professionalism: ${s?.professionalism ?? "—"}  |  Role Fit: ${s?.role_fit ?? "—"}  |  Seniority: ${s?.seniority ?? "—"}  |  Overall: ${s?.overall ?? "—"}`);
    }

    if (structured.flags) {
      rule(); H1("Behavioral Flags");
      const f = structured.flags;
      const flags = [
        f.fixated_on_compensation ? "Fixated on compensation" : "",
        f.rude_or_confrontational ? "Rude or confrontational tone" : "",
        f.evasiveness_or_lack_of_detail ? "Evasive / lack of detail" : "",
      ].filter(Boolean);
      if (flags.length > 0) {
        Bul(flags);
      } else {
        P("None observed.");
      }
    }

    rule(); H1("Recommendation"); P(structured.recommendation || "—"); rule();
    H1("Transcript"); P(transcript || "—");

    footer();
    const pdfBytes = await pdfDoc.save();

    session.report = {
      generatedAt: new Date().toISOString(),
      evaluation: structured,
      transcript,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    };

    return NextResponse.json({ ok: true, reportReady: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ /api/interview/complete error:", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
