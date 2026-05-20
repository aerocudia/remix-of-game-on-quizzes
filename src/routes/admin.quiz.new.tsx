import { createFileRoute } from "@tanstack/react-router";
import { QuizBuilder } from "@/components/QuizBuilder";

export const Route = createFileRoute("/admin/quiz/new")({
  component: () => <QuizBuilder quizId={null} />,
});
