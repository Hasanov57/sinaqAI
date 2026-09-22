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
- A draft 15-question DİM test dataset with five questions each from Azərbaycan dili, Riyaziyyat, and İngilis dili

The demo exam is not DİM material. The separate 15-question draft dataset is transcribed from the official DİM explanation PDF and is labelled as a test dataset rather than a complete exam. Active attempts and results are currently stored only on the current device so that the product can be evaluated without credentials. Production attempts are designed for Supabase-backed persistence after authentication.

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

## Official DİM test dataset

The structured source file is `data/exams/2025-03-02-graduation-11-az.json`. It contains exactly 15 verified multiple-choice questions: five Azərbaycan dili, five Riyaziyyat, and five İngilis dili questions. The route is:

```text
/exams/2025-03-02-graduation-11-az-test-15
```

The original PDF belongs in `data/raw/izah.pdf` and is intentionally ignored by Git. Do not commit the source PDF. One geometry diagram extracted from the PDF is stored as a small web asset in `public/exam-assets/2025-03-02/`.

The explanation PDF does not specify an official duration or a per-question maximum score for these selected questions. Those values remain `null`; the interface reports a count of correct answers and never presents that count as an official DİM score.

Validate the structured data before using it:

```bash
npm run validate:data
```

The reusable extraction helper can inspect any page range and optionally create a crop. It deliberately emits extraction evidence only; a human must verify every question and answer before adding it to the dataset.

```bash
python scripts/extract_dim_pdf.py data/raw/izah.pdf --pages 1-17 --output tmp/pdfs/izah-structure.json
python scripts/extract_dim_pdf.py data/raw/izah.pdf --crop-page 16 --crop-box 306,152,495,300 --crop-output tmp/pdfs/crop.png
```

### Importing the dataset into Supabase

1. In Supabase, open the project you created for sinaqai.
2. Apply both SQL files in `supabase/migrations` in filename order. With the CLI, `supabase db push` does this for you.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only on your computer or in a secure server environment. Never expose it in a browser variable and never commit it.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the terminal where you will run the import.
5. Validate and import:

```bash
npm run validate:data
npm run import:exam -- data/exams/2025-03-02-graduation-11-az.json
```

The importer is idempotent: running it again updates the same draft exam, questions, variants, and options instead of creating duplicates. The imported exam remains private/draft until an administrator deliberately publishes it.

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

1. Push this repository to GitHub. Confirm that `data/raw/izah.pdf` is not included.
2. In Vercel, choose **Add New → Project**, select the GitHub repository, and keep the detected Next.js settings.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL`. The last value should be your real Vercel address, for example `https://sinaqai.vercel.app`.
4. Add `SUPABASE_SERVICE_ROLE_KEY` only if a deployed server-side feature actually needs it. Choose **Secret**, not a public/config value. Never add `NEXT_PUBLIC_` to its name.
5. Click **Deploy**. After the first deployment, copy the exact Vercel address into `NEXT_PUBLIC_APP_URL` and redeploy if it changed.
6. In Supabase Authentication URL settings, set the Site URL to the Vercel address and add the same origin to Redirect URLs.
7. Open the exam catalog and the 15-question draft route shown above, then complete a test submission.

Run the Supabase migration before enabling account-backed exam attempts. Keep the service-role and AI keys in Vercel's encrypted server environment only.

The current draft flow bundles answers in client-side data so it can be tested without credentials. Before publishing a paid or protected exam, move answer lookup and final grading to a server-only Supabase path.

## Next phase

Phase 3 should connect open-ended question input to `accepted_answers` and `scoring_rubrics`, add exact-match and partial-credit submission logic, validate official allowed scores, and extend the result view for review-needed answers. AI-assisted grading should remain deferred to Phase 4.
