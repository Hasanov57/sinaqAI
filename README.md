# sinaqai

sinaqai is an Azerbaijani exam-preparation platform for students preparing for DİM examinations. The first MVP slice implements project setup, the Supabase schema, exam browsing, an exam-taking experience, deterministic multiple-choice grading, and result analysis.

The repository intentionally keeps official exam data and AI-generated content separate. Official answers stored in the database are the source of truth. AI is not involved in multiple-choice grading, score totals, percentages, or statistics.

## What works now

- Responsive Azerbaijani landing page
- Filterable exam catalog
- Exam detail and instructions
- Exam runner with a timer, question navigation, refresh-safe demo progress, and submission confirmation
- Deterministic multiple-choice grading
- Results by overall score, subject, topic, and question
- Official/demo explanation display after submission
- Supabase email/password login form
- PostgreSQL schema, constraints, indexes, triggers, and row-level security
- Unit tests for critical grading and topic-statistics logic
- A clearly labelled six-question demo exam

The demo exam is not DİM material. Its active attempt and result are stored only on the current device so that the product can be evaluated without credentials. Production attempts are designed for Supabase-backed persistence after authentication.

## Architecture

```text
app/
  exams/
    [examId]/
      start/page.tsx
      page.tsx
    page.tsx
  login/page.tsx
  results/[attemptId]/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  auth/
  exam/
  results/
lib/
  analytics/
  data/
  grading/
  supabase/
public/
supabase/migrations/
types/
```

The data flow is:

```text
Official DİM data
  → validated structured records
  → deterministic grading
  → optional AI explanation or semantic assistance
  → student analytics
```

The code is organized by product concern, without repository classes, dependency injection, or other enterprise patterns. Pure scoring and analytics functions are independent from React and Supabase, making them easy to test.

## Technology

- Next.js 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4 plus a small product-specific style layer
- Supabase PostgreSQL and Auth
- Vitest for focused unit tests
- Vercel as the intended deployment target

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The demo exam works without environment variables. Account creation and login require a configured Supabase project.

## Environment variables

Copy `.env.example` to `.env.local` and add:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=
AI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` and `AI_API_KEY` are server-only secrets. Never prefix either with `NEXT_PUBLIC_` or import them into client components.

AI variables are reserved for later phases and are not used by the Phase 1–2 application.

## Supabase setup

1. Create a Supabase project.
2. Install the Supabase CLI if you want to manage the project locally.
3. Link this repository to the project.
4. Apply the migration in `supabase/migrations`.
5. Copy the project URL and anon key into `.env.local`.

With the Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates:

- profiles and administrator flag
- exams, subjects, topics, canonical questions, variant numbering, and answer options
- accepted open answers and official scoring rubrics
- exam attempts and student answers
- a separate AI-explanation cache
- row-level access rules for user-owned attempts and answers
- database protection against answer changes after submission

To make an account an administrator, update `profiles.is_admin` from a trusted database administration context. Do not expose this operation to the browser.

## Data and grading rules

- Each question has a canonical ID independent from the visible number in a booklet variant.
- A unique partial index allows at most one correct option per multiple-choice question.
- Multiple-choice grading compares the selected option with the stored official option.
- Open-answer normalization is conservative: trim, lowercase, repeated whitespace, and trailing punctuation only.
- Accepted-answer partial credit comes from stored records, never a hard-coded fraction.
- Any future AI grading result must be checked against `rubric_json.allowed_scores` before storage.
- Official explanations and AI explanations use separate fields and tables.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploying to Vercel

1. Push the repository to your Git provider.
2. Import it into Vercel as a Next.js project.
3. Add the production environment variables in Vercel.
4. Set `NEXT_PUBLIC_APP_URL` to the production origin.
5. Deploy.

Run the Supabase migration before enabling account-backed exam attempts. Keep the service-role and AI keys in Vercel's encrypted server environment only.

## Next phase

Phase 3 should connect open-ended question input to `accepted_answers` and `scoring_rubrics`, add exact-match and partial-credit submission logic, validate official allowed scores, and extend the result view for review-needed answers. AI-assisted grading should remain deferred to Phase 4.
