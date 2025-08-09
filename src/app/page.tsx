"use client";

import { useState } from "react";
import { Toaster, toast } from "sonner";
import { Mail, Calendar, Clock, FileText, Send, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { cva } from "class-variance-authority";
import clsx from "clsx";

// Helper function to combine class names
const cn = clsx;

// CVA for input fields
const inputVariants = cva(
  "h-11 w-full rounded-lg border bg-white/50 px-3 text-sm transition-colors dark:bg-slate-800/50",
  {
    variants: {
      hasIcon: {
        true: "pl-10",
      },
      hasError: {
        true: "border-red-400 focus:ring-red-500",
        false: "border-slate-300 focus:ring-slate-500",
      },
    },
    defaultVariants: {
      hasIcon: false,
      hasError: false,
    },
  }
);

// CVA for button
const buttonVariants = cva(
  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-blue-600 h-11 text-white shadow-md hover:bg-blue-700 focus:ring-blue-500",
        secondary: "bg-slate-100 h-10 text-slate-700 hover:bg-slate-200 focus:ring-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

// CVA for file upload area
const fileUploadVariants = cva(
  "flex items-center justify-between gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer",
  {
    variants: {
      hasFile: {
        true: "border-green-400 dark:border-green-600",
        false: "border-slate-300 dark:border-slate-600",
      },
    },
    defaultVariants: {
      hasFile: false,
    },
  }
);

type ScheduleResponse = {
  success?: boolean;
  sessionId?: string;
  interviewLink?: string;
  hrPortalLink?: string;
  error?: string;
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    hrEmail: "",
    candidateEmail: "",
    interviewDate: "",
    interviewTime: "",
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [result, setResult] = useState<ScheduleResponse | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jdFile || !cvFile) {
      toast.warning("Please attach both files.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("hrEmail", form.hrEmail);
      fd.append("candidateEmail", form.candidateEmail);
      fd.append("interviewDate", form.interviewDate);
      fd.append("interviewTime", form.interviewTime);
      fd.append("cv", cvFile);
      fd.append("jd", jdFile);

      const res = await fetch("/api/schedule", { method: "POST", body: fd });
      const data: ScheduleResponse = await res.json();

      if (data.success) {
        setResult(data);
        toast.success("Interview scheduled", { description: "Invites sent and links generated." });
      } else {
        const msg = data.error || "Failed to schedule";
        setResult({ success: false, error: msg });
        toast.error("Scheduling failed", { description: msg });
      }
    } catch (err) {
      setResult({ success: false, error: "Unexpected error" });
      toast.error("Unexpected error", { description: "Please try again shortly." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster richColors position="top-right" closeButton />

      {/* Background + Centering */}
      <div className="min-h-[100svh] bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 antialiased">
        {/* Window */}
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-700">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Schedule an Interview
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Upload the JD and Resume, add emails, date & time — we’ll handle the rest.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6 p-6">
            {/* Emails */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="hrEmail" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  HR Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="hrEmail"
                    name="hrEmail"
                    type="email"
                    placeholder="hr@company.com"
                    value={form.hrEmail}
                    onChange={onChange}
                    required
                    className={cn(inputVariants({ hasIcon: true }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="candidateEmail" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Candidate Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="candidateEmail"
                    name="candidateEmail"
                    type="email"
                    placeholder="candidate@email.com"
                    value={form.candidateEmail}
                    onChange={onChange}
                    required
                    className={cn(inputVariants({ hasIcon: true }))}
                  />
                </div>
              </div>
            </div>

            {/* Files */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Job Description (.pdf / .docx)</span>
                <label className={cn(fileUploadVariants({ hasFile: !!jdFile }))}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {jdFile ? "JD uploaded" : "Upload JD"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {jdFile ? jdFile.name : "Choose file"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {jdFile ? "Change" : "Browse"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => setJdFile(e.target.files?.[0] || null)}
                    required
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Resume / CV (.pdf / .docx)</span>
                <label className={cn(fileUploadVariants({ hasFile: !!cvFile }))}>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {cvFile ? "Resume uploaded" : "Upload Resume"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {cvFile ? cvFile.name : "Choose file"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {cvFile ? "Change" : "Browse"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    required
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="interviewDate" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="interviewDate"
                    name="interviewDate"
                    type="date"
                    value={form.interviewDate}
                    onChange={onChange}
                    required
                    className={cn(inputVariants({ hasIcon: true }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="interviewTime" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Time
                </label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="interviewTime"
                    name="interviewTime"
                    type="time"
                    value={form.interviewTime}
                    onChange={onChange}
                    required
                    className={cn(inputVariants({ hasIcon: true }))}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(buttonVariants({ variant: "primary" }))}
            >
              {loading ? "Scheduling…" : (
                <>
                  <Send className="h-4 w-4" /> Schedule Interview
                </>
              )}
            </button>

            {/* Inline Result */}
            {result && (
              <div
                className={cn(
                  "rounded-lg border p-4",
                  result.success
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                )}
              >
                <div className="flex items-start gap-3">
                  {result.success ? <CheckCircle2 className="h-5 w-5 mt-0.5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 mt-0.5 text-amber-500" />}
                  <div className="flex-1">
                    <p className="font-medium">
                      {result.success ? "Interview scheduled" : "Scheduling failed"}
                    </p>
                    {result.success ? (
                      <>
                        <p className="mt-0.5 text-sm opacity-80">Share these links with the candidate and your team.</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <a href={result.interviewLink} className="group flex items-center justify-between rounded-md p-2 -m-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition" target="_blank" rel="noreferrer">
                            Candidate Interview Link
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                          </a>
                          <a href={result.hrPortalLink} className="group flex items-center justify-between rounded-md p-2 -m-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition" target="_blank" rel="noreferrer">
                            HR Portal Link
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                          </a>
                        </div>
                      </>
                    ) : (
                      <p className="mt-0.5 text-sm opacity-80">{result.error || "Please verify the details and try again."}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}