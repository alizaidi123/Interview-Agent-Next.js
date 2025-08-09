export type Turn = { role: "agent" | "candidate"; content: string };

export type PlanQuestion = {
  question: string;
  expected_answer_insight?: string;
};

export type Session = {
  session_id: string;
  hr_email: string;
  candidate_email: string;
  job_description: string;
  resume_text: string;
  interview_questions: PlanQuestion[];
  relevant_expert_terms: string[];
  candidate_name?: string;
  role?: string;
  company_name?: string;
  scheduled_at?: string;
  turns: Turn[];
  hr_token?: string;
  report: null | {
    generatedAt: string;
    evaluation: {
      summary?: string;
      strengths?: string[];
      weaknesses?: string[];
      recommendation?: string;
      scores?: {
        communication?: number;
        professionalism?: number;
        role_fit?: number;
        seniority?: number;
        overall?: number;
      };
      flags?: {
        fixated_on_compensation?: boolean;
        rude_or_confrontational?: boolean;
        evasiveness_or_lack_of_detail?: boolean;
      };
    };
    transcript: string;
    pdfBase64: string;
  };
};

export const planStore: Record<string, Session> = {};
export const tokenStore: Record<string, { sessionId: string }> = {};
