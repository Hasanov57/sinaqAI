"use client";

import Link from "next/link";
import { CalendarDays, Clock3, FileQuestion, GraduationCap } from "lucide-react";
import { useMemo, useState } from "react";
import type { Exam } from "@/types/exam";

export function ExamBrowser({ exams }: { exams: Exam[] }) {
  const [year, setYear] = useState("all");
  const [type, setType] = useState("all");
  const [subject, setSubject] = useState("all");

  const years = [...new Set(exams.map((exam) => exam.year))];
  const types = [...new Map(exams.map((exam) => [exam.type, exam.typeLabel])).entries()];
  const subjects = [...new Set(exams.flatMap((exam) => exam.subjects))];

  const filtered = useMemo(
    () =>
      exams.filter(
        (exam) =>
          (year === "all" || String(exam.year) === year) &&
          (type === "all" || exam.type === type) &&
          (subject === "all" || exam.subjects.includes(subject)),
      ),
    [exams, subject, type, year],
  );

  return (
    <>
      <div className="filter-bar" aria-label="İmtahan filtrləri">
        <div className="field">
          <label htmlFor="year">İl</label>
          <select id="year" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">Bütün illər</option>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="type">İmtahan növü</label>
          <select id="type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Bütün növlər</option>
            {types.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="subject">Fənn</label>
          <select id="subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="all">Bütün fənlər</option>
            {subjects.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {filtered.length ? (
        <div className="exam-grid">
          {filtered.map((exam) => (
            <article className="exam-card" key={exam.id}>
              <div className="exam-card-top">
                <span className="badge"><CalendarDays size={14} /> {exam.year}</span>
                {exam.status === "demo" && <span className="badge badge-demo">DEMO</span>}
              </div>
              <h2>{exam.title}</h2>
              <div className="exam-card-meta">
                <span><GraduationCap size={17} /> {exam.grade}-ci sinif</span>
                <span><FileQuestion size={17} /> {exam.questionCount} sual</span>
                <span><Clock3 size={17} /> {exam.durationMinutes} dəqiqə</span>
              </div>
              <div className="subject-list">
                {exam.subjects.map((item) => <span key={item}>{item}</span>)}
              </div>
              <Link className="button button-secondary" href={`/exams/${exam.id}`}>
                İmtahana bax
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Uyğun imtahan tapılmadı</h2>
          <p>Filtrlərdən birini dəyişərək yenidən yoxla.</p>
        </div>
      )}
    </>
  );
}
