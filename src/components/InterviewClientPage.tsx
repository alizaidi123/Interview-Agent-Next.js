'use client';

import { useEffect, useRef, useState } from 'react';
import ClientInterviewRecorder from '@/components/ClientInterviewRecorder';
import type { PlanQuestion } from '@/lib/planStore';

type Msg = { role: 'agent' | 'candidate'; content: string };

type InterviewPlanDTO = {
  interview_questions?: PlanQuestion[];
  relevant_expert_terms?: string[];
};

type InterviewClientPageProps = {
  sessionId: string;
};

export default function InterviewClientPage({ sessionId }: InterviewClientPageProps) {
  const [plan, setPlan] = useState<InterviewPlanDTO | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [status, setStatus] = useState<'loading' | 'interviewing' | 'completed'>('loading');

  const [history, setHistory] = useState<Msg[]>([]);
  const finishedOnce = useRef(false);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/interview/plan?id=${sessionId}`);
      const data: InterviewPlanDTO = await res.json();
      setPlan(data);
      const firstQ = data?.interview_questions?.[0]?.question;
      if (firstQ) {
        setCurrentQuestion(firstQ);
        setHistory([{ role: 'agent', content: firstQ }]);
        setStatus('interviewing');
      } else {
        setStatus('completed');
      }
    };
    if (sessionId) run();
  }, [sessionId]);

  const handleAnswer = async (answerText: string) => {
    setHistory(h => [...h, { role: 'candidate', content: answerText }]);

    const res = await fetch('/api/interview/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, lastQuestion: currentQuestion, lastAnswer: answerText }),
    });
    const data: { action: 'follow_up' | 'next_question' | 'conclude'; followUpQuestion?: string; nextQuestion?: string; reason?: string } = await res.json();

    if (data.action === 'follow_up' && data.followUpQuestion) {
      setHistory(h => [...h, { role: 'agent', content: data.followUpQuestion! }]);
      setCurrentQuestion(data.followUpQuestion!);
    } else if (data.action === 'next_question' && data.nextQuestion) {
      setQuestionIndex(i => i + 1);
      setHistory(h => [...h, { role: 'agent', content: data.nextQuestion! }]);
      setCurrentQuestion(data.nextQuestion!);
    } else {
      setStatus('completed');
    }
  };

  useEffect(() => {
    const run = async () => {
      if (finishedOnce.current) return;
      finishedOnce.current = true;
      try {
        await fetch('/api/interview/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (e) {
        console.error('Failed to complete:', e);
      }
    };
    if (status === 'completed' && sessionId) run();
  }, [status, sessionId]);

  return (
    <main className="max-w-2xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Interview Room</h1>

      {status === 'loading' && <p>Loading interview...</p>}

      {status === 'interviewing' && (
        <>
          <div className="bg-gray-100 p-4 rounded-md mb-4">
            <p className="text-sm text-gray-600 mb-1">
              Question {questionIndex + 1}{plan?.interview_questions?.length ? `/${plan.interview_questions.length}` : ''}
            </p>
            <p className="font-medium">AI:</p>
            <p>{currentQuestion}</p>
          </div>

          <ClientInterviewRecorder onAnswerReady={handleAnswer} />
        </>
      )}

      {status === 'completed' && (
        <div className="bg-green-100 p-4 text-green-800 rounded-md">
          Interview completed. The report is being generated for HR.
        </div>
      )}
    </main>
  );
}
