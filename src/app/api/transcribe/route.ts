
import { OpenAI } from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as Blob;

  const buffer = Buffer.from(await file.arrayBuffer());

  const transcription = await openai.audio.transcriptions.create({
    file: new File([buffer], "recording.webm"),
    model: "whisper-1",
    response_format: "json",
  });

  return NextResponse.json({ text: transcription.text });
}
