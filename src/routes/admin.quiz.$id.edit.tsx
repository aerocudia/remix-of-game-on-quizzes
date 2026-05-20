import { createFileRoute } from "@tanstack/react-router";
import { QuizBuilder } from "@/components/QuizBuilder";

export const Route = createFileRoute("/admin/quiz/$id/edit")({
  component: EditQuiz,
});

function EditQuiz() {
  const { id } = Route.useParams();
  return <QuizBuilder quizId={id} />;
}
