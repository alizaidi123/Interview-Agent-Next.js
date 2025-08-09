import * as React from "react";
import InterviewClientPage from "@/components/InterviewClientPage";

export default function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params); // Next 15: params is a Promise
  return <InterviewClientPage sessionId={id} />;
}
