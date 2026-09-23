"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { availableExams } from "@/lib/data/demo-exams";

export function ActiveAttempt() {
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const found = availableExams.find((exam) => window.localStorage.getItem(`sinaqai:active:${exam.id}`));
      setActive(found ? { id: found.id, title: found.title } : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return active
    ? <p><Link href={`/exams/${active.id}/start`}>{active.title} — davam et</Link></p>
    : <p>Davam edən imtahanınız yoxdur.</p>;
}
