import { guard } from "@/lib/admin-route";
import { listQuestions } from "@/lib/questions";
import { CSV_HEADER, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const qs = await listQuestions();
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const rows = [
      CSV_HEADER,
      ...qs.map((q) => [q.text, ...q.options, "ABCD"[q.correctIndex], q.difficulty ?? "", q.category, q.explanation, q.status]),
    ];
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="joule-questions-${stamp}.csv"`,
      },
    });
  }

  const data = qs.map(({ text, options, correctIndex, difficulty, category, explanation, status }) => ({
    text, options, correctIndex, difficulty, category, explanation, status,
  }));
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="joule-questions-${stamp}.json"`,
    },
  });
}
