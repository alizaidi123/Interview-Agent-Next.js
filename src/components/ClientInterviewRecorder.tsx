"use client";

import React, { useState, useRef } from "react";

export default function ClientInterviewRecorder({
  onAnswerReady,
}: {
  onAnswerReady: (transcription: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.text) onAnswerReady(data.text);
      audioChunks.current = [];
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex gap-4 items-center">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`px-4 py-2 rounded ${recording ? "bg-red-500" : "bg-green-500"} text-white`}
      >
        {recording ? "Stop" : "Start"} Recording
      </button>
    </div>
  );
}
