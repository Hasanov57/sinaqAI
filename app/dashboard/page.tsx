import Link from "next/link";
import { redirect } from "next/navigation";
import { ActiveAttempt } from "@/components/dashboard/active-attempt";
import { loginPath } from "@/lib/auth/return-path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Nəticələrim" };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient().catch(() => null);
  const { data: { user } } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!user || !supabase) redirect(loginPath("/dashboard"));

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "şagird";
  const admin = createSupabaseAdminClient();
  const attemptsResult = admin
    ? await admin.from("exam_attempts").select("id,exam_id,status,submitted_at,total_score,max_score")
      .eq("user_id", user.id).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(10)
    : null;
  const attempts = attemptsResult?.data ?? [];
  const examIds = [...new Set(attempts.map((attempt) => attempt.exam_id))];
  const examsResult = admin && examIds.length
    ? await admin.from("exams").select("id,title").in("id", examIds)
    : null;
  const examTitles = new Map((examsResult?.data ?? []).map((exam) => [exam.id, exam.title]));

  const attemptIds = attempts.map((attempt) => attempt.id);
  const answersResult = admin && attemptIds.length
    ? await admin.from("student_answers").select("question_id,is_correct").in("attempt_id", attemptIds).eq("is_correct", false)
    : null;
  const wrongQuestionIds = [...new Set((answersResult?.data ?? []).map((answer) => answer.question_id))];
  const questionTopicsResult = admin && wrongQuestionIds.length
    ? await admin.from("questions").select("id,topic_id").in("id", wrongQuestionIds)
    : null;
  const questionTopicIds = new Map((questionTopicsResult?.data ?? []).map((question) => [question.id, question.topic_id]));
  const topicIds = [...new Set([...questionTopicIds.values()].filter((id): id is string => Boolean(id)))];
  const topicsResult = admin && topicIds.length
    ? await admin.from("topics").select("id,name").in("id", topicIds)
    : null;
  const topicNames = new Map((topicsResult?.data ?? []).map((topic) => [topic.id, topic.name]));
  const weakTopics = new Map<string, number>();
  for (const answer of answersResult?.data ?? []) {
    const topicName = topicNames.get(questionTopicIds.get(answer.question_id) ?? "");
    if (topicName) weakTopics.set(topicName, (weakTopics.get(topicName) ?? 0) + 1);
  }
  const topWeakTopics = [...weakTopics].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return <section className="section"><div className="shell account-page">
    <p className="eyebrow">Şəxsi kabinet</p><h1>Xoş gəlmisiniz, {name}</h1>
    <div className="dashboard-grid">
      <article className="account-card"><h2>Son imtahanlar</h2>
        {!admin || attemptsResult?.error ? <p>Nəticə tarixçəsi hazırda yüklənmir.</p>
          : attempts.length ? <ul className="dashboard-list">{attempts.map((attempt) => <li key={attempt.id}>
              <Link href={`/results/${attempt.id}`}>{examTitles.get(attempt.exam_id) ?? "Rəsmi imtahan"}</Link>
              <small>{attempt.submitted_at ? new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium" }).format(new Date(attempt.submitted_at)) : ""}</small>
            </li>)}</ul> : <p>Hələ tamamlanmış imtahanınız yoxdur.</p>}
      </article>
      <article className="account-card"><h2>Nəticələr</h2>
        {!admin || attemptsResult?.error ? <p>Nəticə tarixçəsi hazırda yüklənmir.</p>
          : attempts.length ? <p>Son {attempts.length} imtahanın nəticəsi göstərilir. Ən son nəticə: {attempts[0].max_score ? `${attempts[0].total_score ?? 0} / ${attempts[0].max_score} düzgün` : "rəy gözləyir"}.</p>
            : <p>Nəticələr imtahanı tamamladıqdan sonra burada görünəcək.</p>}
      </article>
      <article className="account-card"><h2>Zəif mövzular</h2>
        {topWeakTopics.length ? <><p>Son imtahanlardakı səhv cavablarınıza əsasən:</p><ul className="dashboard-list">{topWeakTopics.map(([topic, count]) => <li key={topic}>{topic}<small>{count} səhv cavab</small></li>)}</ul></>
          : <p>Hələ zəif mövzu göstəricisi yoxdur.</p>}
      </article>
      <article className="account-card"><h2>Davam edən imtahan</h2><ActiveAttempt /></article>
    </div>
  </div></section>;
}
