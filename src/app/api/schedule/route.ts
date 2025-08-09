import { NextRequest, NextResponse } from "next/server";
import { tmpdir } from "os";
import { writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { PdfReader } from "pdfreader";
import mammoth from "mammoth";
import { OpenAI } from "openai";
import { google } from "googleapis";
import { planStore, tokenStore, type Session, type PlanQuestion } from "@/lib/planStore";

// ---------- Helpers ----------
function getBaseUrl(req: NextRequest) {
  const env = process.env.APP_BASE_URL;
  if (env) return env.replace(/\/+$/, "");
  const origin = req.headers.get("origin") || "http://localhost:3000";
  return origin.replace(/\/+$/, "");
}

function extractTextFromPDF(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
   
    new PdfReader().parseFileItems(filePath, (err: unknown, item: unknown) => {
      if (err) {
        reject(err);
        return;
      }
      if (!item) {
        resolve(text);
        return;
      }
      if (typeof item === "object" && item !== null && "text" in item) {
        const maybe = (item as { text?: string }).text;
        if (typeof maybe === "string") text += maybe + " ";
      }
    });
  });
}

async function extractTextFromDocx(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

// ---------- Route ----------
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    const formData = await req.formData();
    const candidateEmail = (formData.get("candidateEmail") as string) || "";
    const hrEmail = (formData.get("hrEmail") as string) || "";
    const interviewDate = (formData.get("interviewDate") as string) || "";
    const interviewTime = (formData.get("interviewTime") as string) || "";

    const cv = formData.get("cv") as File | null;
    const jd = formData.get("jd") as File | null;

    if (!cv || !jd || !candidateEmail || !hrEmail || !interviewDate || !interviewTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cvPath = path.join(tmpdir(), cv.name);
    const jdPath = path.join(tmpdir(), jd.name);

    await writeFile(cvPath, Buffer.from(await cv.arrayBuffer()));
    await writeFile(jdPath, Buffer.from(await jd.arrayBuffer()));

    let cvText = "";
    let jdText = "";

    try {
      cvText = cv.name.toLowerCase().endsWith(".pdf")
        ? await extractTextFromPDF(cvPath)
        : await extractTextFromDocx(cvPath);

      jdText = jd.name.toLowerCase().endsWith(".pdf")
        ? await extractTextFromPDF(jdPath)
        : await extractTextFromDocx(jdPath);
    } finally {
      try { await unlink(cvPath); } catch {}
      try { await unlink(jdPath); } catch {}
    }

    // ---------- Generate interview plan ----------
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const planPrompt = `
You are an intelligent HR assistant. Using the Job Description and Resume below,
create a concise interview plan that includes:
1) 5 customized interview questions tailored to the candidate and the JD
2) For each question, a short "expected_answer_insight"
3) 5 "relevant_expert_terms" to be explicitly probed

Return strictly valid JSON in the shape:
{
  "interview_questions": [
    { "question": "string", "expected_answer_insight": "string" }
  ],
  "relevant_expert_terms": ["term1","term2","term3","term4","term5"],
  "candidate_name": "optional",
  "role": "optional",
  "company_name": "optional"
}

Job Description:
${jdText}

Resume:
${cvText}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert AI interview planner." },
        { role: "user", content: planPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      return NextResponse.json({ error: "OpenAI returned empty content" }, { status: 502 });
    }

    // parse to a typed shape
    const parsed = JSON.parse(content) as Partial<Pick<Session,
      "interview_questions" | "relevant_expert_terms" | "candidate_name" | "role" | "company_name"
    >>;

    const questions: PlanQuestion[] = Array.isArray(parsed.interview_questions)
      ? parsed.interview_questions
          .filter((q: unknown): q is PlanQuestion => !!q && typeof (q as PlanQuestion).question === "string")
      : [];

    const terms: string[] = Array.isArray(parsed.relevant_expert_terms)
      ? parsed.relevant_expert_terms.filter((t): t is string => typeof t === "string")
      : [];

    // ---------- Create session + HR token & links ----------
    const sessionId = crypto.randomUUID();
    const hrToken = crypto.randomBytes(16).toString("hex");
    const base = getBaseUrl(req);
    const interviewLink = `${base}/interview/${sessionId}`;
    const hrPortalLink = `${base}/hr/${hrToken}`;

    // ---------- Persist ----------
    planStore[sessionId] = {
      session_id: sessionId,
      hr_email: hrEmail,
      candidate_email: candidateEmail,
      job_description: jdText,
      resume_text: cvText,
      interview_questions: questions,
      relevant_expert_terms: terms,
      candidate_name: parsed.candidate_name,
      role: parsed.role,
      company_name: parsed.company_name,
      report: null,
      hr_token: hrToken,
      scheduled_at: `${interviewDate} ${interviewTime}`,
      turns: [],
    };

    tokenStore[hrToken] = { sessionId };

    // ---------- Email: Candidate + HR ----------
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const candidateBody = `
Dear Candidate,

Your interview has been scheduled for ${interviewDate} at ${interviewTime}.

Please join using the link:
${interviewLink}

Best of luck!
HR Team
    `.trim();

    const candidateRaw = Buffer.from(
      `To: ${candidateEmail}\r\n` +
      `Subject: Interview Scheduled\r\n\r\n` +
      candidateBody
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: candidateRaw },
      });
    } catch (e) {
      console.warn("⚠️ Failed to send candidate invite email:", e);
    }

    const hrBody = `
Hello,

An interview has been scheduled with ${candidateEmail} for ${interviewDate} at ${interviewTime}.

You can access the interview report (once the interview is completed) here:
${hrPortalLink}

Regards,
AI Interview Agent
    `.trim();

    const hrRaw = Buffer.from(
      `To: ${hrEmail}\r\n` +
      `Subject: HR Portal Link for Interview Report\r\n\r\n` +
      hrBody
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: hrRaw },
      });
    } catch (e) {
      console.warn("⚠️ Failed to send HR portal link email:", e);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      interviewLink,
      hrPortalLink,
      interviewPlan: {
        interview_questions: questions,
        relevant_expert_terms: terms,
        candidate_name: parsed.candidate_name,
        role: parsed.role,
        company_name: parsed.company_name,
      },
    });
  } catch (error) {
    console.error("❌ Error in /api/schedule:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}
