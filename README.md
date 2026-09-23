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
- An incomplete DİM dataset with 79 verified non-listening questions: 24 English, 30 Azərbaycan dili, and 25 Riyaziyyat questions
- Official subject ordering (English → Azerbaijani → Mathematics), passage-linked content, and open-answer schema support
- Optional private handwritten-solution image upload for signed-in students
- On-demand Gemini explanations for incorrect multiple-choice answers; AI does not grade or alter scores

The demo exam is not DİM material. The separate 79-question draft dataset is transcribed from the official DİM explanation PDF and remains labelled incomplete because listening questions 1–6 need the official audio. Anonymous/demo progress stays on the current device. Completed official attempts from signed-in users are also saved in Supabase; handwritten images, when uploaded, use Supabase's private bucket.

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

```powershell
npm install
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The demo exam works without environment variables. Account creation and login require a configured Supabase project.

## Environment variables

Create the local environment file by copying `.env.example` to `.env.local`, then open it in Notepad on Windows:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
notepad .env.local
```

Paste the values from your own Supabase project where the matching lines appear. The `.env.local` file is in the project folder beside `package.json`. Do not put these secret values in GitHub or send them in chat. Add:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
AI_PROVIDER=gemini
AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The current Supabase dashboard calls these the **Publishable key** and **Secret key**. For an older project, the compatible names `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are also accepted. If copying from Supabase's Connect dialog, put the values under the variable names above: add `NEXT_PUBLIC_` to the publishable key name, keep the secret key server-only, and skip `SUPABASE_JWKS_URL` (this app does not need it).

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only secrets. Never prefix either with `NEXT_PUBLIC_` or import them into client components. The Gemini key is used only by the server route and is never returned to the browser. AI explanations require a signed-in Supabase user and can be requested only for an incorrect multiple-choice response. The server-role key lets the route store personalized explanation caches and enforce a shared eight-requests-per-minute user limit. They are educational assistance, not official DİM material or grading.

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

The migrations create:

- profiles and administrator flag
- exams, subjects, topics, canonical questions, variant numbering, and answer options
- accepted open answers and official scoring rubrics
- exam attempts and student answers
- a separate AI-explanation cache
- shared passages, subject ordering, the private `student-solutions` storage bucket, and a shared per-user AI request limit
- row-level access rules for user-owned attempts and answers
- database protection against answer changes after submission

To make an account an administrator, update `profiles.is_admin` from a trusted database administration context. Do not expose this operation to the browser.

### Deploying the latest database changes

When pulling an update that adds a new migration, apply pending migrations to the linked Supabase project with `supabase db push`, or paste each pending migration SQL file into Supabase SQL Editor in filename order. The latest migrations are `supabase/migrations/202609230003_passages_and_student_solutions.sql` and `supabase/migrations/202609230004_rekey_expanded_exam.sql`. Do not run the exam importer until the migrations succeed. In Vercel, add the same Supabase URL and anon key plus the server-only service-role key and Gemini settings shown above; keep the service-role and Gemini values as Secret environment variables. Redeploy after saving environment-variable changes.

### Check the project before pushing

```bash
npm run validate:data
npm run typecheck
npm run lint
npm test
npm run build
```

These checks validate the current repository and build. They do not prove the remote Supabase migration, Gemini key, Vercel deployment, or full official exam dataset is ready; those must be checked in the corresponding dashboards.

## Official DİM test dataset

The structured source file is `data/exams/2025-03-02-graduation-11-az.json`. It currently contains 79 verified non-listening questions: 24 English, 30 Azərbaycan dili, and 25 Riyaziyyat. The exam intentionally remains incomplete until the six English listening questions have official audio. The route is:

```text
/exams/2025-03-02-graduation-11-az-incomplete
```

The original PDF belongs in `data/raw/izah.pdf` and is intentionally ignored by Git. Do not commit the source PDF. Source crops and diagrams are stored in `public/exam-assets/2025-03-02/`. Skipped listening questions and page numbers are recorded in `data/review/2025-03-02-manual-review.json`.

The explanation PDF does not specify an official duration or a per-question maximum score for the open-response questions. Those values remain `null`; the interface does not present the count of correct answers as an official DİM score. Only multiple-choice questions are automatically graded; open responses are saved for review.

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
2. Apply every pending SQL file in `supabase/migrations` in filename order. With the CLI, `supabase db push` does this for you.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only on your computer or in a secure server environment. Never expose it in a browser variable and never commit it.
4. In PowerShell, move to the project folder, open `.env.local` in Notepad, and make sure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` have values. Save and close Notepad. Keep the secret key server-only.
5. Validate and import:

```bash
npm run validate:data
npm run import:exam -- data/exams/2025-03-02-graduation-11-az.json
```

On Windows, the complete command sequence is:

```powershell
cd D:\sinaqAi
notepad .env.local
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

1. Push this repository to GitHub. `data/raw/izah.pdf` and `.env.local` are ignored and must stay off GitHub.
2. If the GitHub repository is already connected to Vercel, pushing to the production branch starts a new deployment. Otherwise, in Vercel choose **Add New → Project**, select the repository, and keep the detected Next.js settings.
3. In Vercel **Project Settings → Environment Variables**, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the values from the same Supabase project used for the import. These are public browser configuration values; choose **Config** if Vercel asks for a type. An older `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works.
4. Logged-in official result history and the AI route need `SUPABASE_SECRET_KEY` in Vercel. Choose **Secret** and never add `NEXT_PUBLIC_` to its name. The older `SUPABASE_SERVICE_ROLE_KEY` also works. For AI explanations, also set `AI_PROVIDER=gemini`, `AI_MODEL=gemini-3.8-flash`, and the server-only `GEMINI_API_KEY` (choose **Secret**).
5. In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://sinaqai.vercel.app` and add `https://sinaqai.vercel.app/**` to **Redirect URLs**. The registration confirmation now returns through `/auth/callback`, so the callback URL must be allowed. Keep `http://localhost:3000/**` there too if local sign-in is needed. New confirmation emails must be requested after changing this setting.
6. In Vercel **Deployments**, wait for the latest production deployment to show **Ready**. Open the official exam, intentionally submit a wrong multiple-choice answer, click **AI ilə izah et**, sign in, and verify that the site returns to the same question.

Run the Supabase migrations and import the official dataset before enabling account-backed exam attempts. Keep the service-role and AI keys in Vercel's encrypted server environment only. Logged-in official attempts are stored in `exam_attempts` and `student_answers`; anonymous/demo progress remains in browser storage. The dashboard reads persisted attempts. The AI route reads the submitted answer and official material on the server, uses Gemini only on request, and caches per question, wrong answer, user, and model.

The current draft flow bundles answers in client-side data so it can be tested without credentials. Before publishing a paid or protected exam, move answer lookup and final grading to a server-only Supabase path.

## Next phase

Open responses that cannot be matched to an official accepted answer remain marked for review. The current draft flow still bundles official answers in client-side data, so before publishing a paid or protected exam, move question delivery and final grading to a server-only path. AI-assisted grading is not part of the current explanation feature.
