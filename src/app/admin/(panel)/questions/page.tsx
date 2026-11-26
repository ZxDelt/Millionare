import { listQuestions } from "@/lib/questions";
import QuestionBankClient from "./QuestionBankClient";

export const metadata = { title: "Question Bank — JOULE JACKPOT" };

export default async function QuestionBank() {
  return <QuestionBankClient initial={await listQuestions()} />;
}
