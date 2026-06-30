# SkillWeave — real-world use cases

Five runnable scenarios that show **what SkillWeave gives you that a plain skill
doesn't**. Every one runs fully offline (the boundary judge falls back to a
heuristic — no API key needed).

```bash
npx tsx examples/use-cases/01-support-triage.ts     # reliability: confidence routing + auto-judge + retry
npx tsx examples/use-cases/02-code-review-gate.ts    # contracts + hard assertions + memory across runs
npx tsx examples/use-cases/03-secret-safe-logs.ts    # security: capabilities + sandbox + secret redaction
npx tsx examples/use-cases/04-batch-digest.ts        # composition: map · reduce · parallel · DAG
npx tsx examples/use-cases/05-nightly-report.ts      # production wrapper: trigger + events + observability
```

**Plus a head-to-head on a REAL LLM** (needs a provider key — `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`):

```bash
npx tsx examples/use-cases/06-ab-llm.ts              # same model + prompt: raw call vs SkillWeave-wrapped
npx tsx examples/use-cases/06-ab-llm.ts --hard       # loose prompt + bait email → the contrast fires
npx tsx examples/use-cases/06-ab-llm.ts --hard --trials 5
```

---

## "Why not just write a skill?"

A **skill** (a markdown / prompt instruction) answers one question: *what should
the model do?* That's necessary — and it's where the intelligence lives. But a
skill on its own is **one prompt with no guard rails**. The moment you put it in
production you start hand-rolling everything around it: did it actually return
anything? did it make something up? when does it run? who gets paged when it
fails? can it reach the network? what did last week's runs look like?

SkillWeave is the **runtime around the prompt**. A skill is still the unit of
intelligence — SkillWeave makes it a unit you can *compose, test, grade, secure,
schedule, observe, and trust*.

| Concern | Just a skill (prompt) | A SkillWeave micro-skill |
|---|---|---|
| **Scope** | "do the whole task" in one prompt | one narrow job with a declared `does` / `does_not` |
| **Contract** | implicit | typed `state_read` / `state_write` — enforced; a skill can't write a field it didn't declare |
| **Wrong output** | ships silently | confidence-routed, **auto-judged for groundedness**, **retried with negative context** |
| **Bad input** | model muddles through | a **deterministic assertion HALTS** the chain — no LLM, no cost |
| **Composition** | copy-paste prompt glue | `sequential · parallel · map · reduce · conditional · loop · DAG` primitives |
| **Memory** | amnesiac every run | `MemoryStore` records outcomes + failures; trend & recommendations across runs |
| **Security** | inherits the agent's full access | **default-deny capabilities**, filesystem **sandbox**, **secret redaction** |
| **Activation** | you trigger it manually | declarative `cron` / `webhook` / `human_checkpoint` triggers |
| **Observability** | print statements | NDJSON trace per step, alert thresholds, A/B compare, ASCII/Mermaid diagram |
| **Reuse / distribution** | a file you paste around | `gradeSkill` (9-point gate → tier) → `publishSkill` / `installSkill` |
| **Cost** | one big context, every time | small jobs; **deterministic skills cost $0** and carry zero reliability overhead |

**The one-line version:** a skill tells the model *what to do*; SkillWeave makes
sure it *did it, didn't make it up, was allowed to, and you'll know if it
breaks* — and lets you snap many such skills into a pipeline.

---

## What each use case proves

### 1 · Support-ticket triage — *the reliability layer*
A probabilistic "pick the real action items" skill grabs a vague, non-actionable
line on its first attempt. Confidence dips into the **low band → the orchestrator
retries with negative context → the second attempt drops it and recovers**, and
the auto-judge confirms every item is verbatim-grounded in the email.
> A plain prompt would have shipped the bad item. Here the framework catches and
> fixes it — and writes the whole decision to a trace.

### 2 · Code-review risk gate — *contracts, assertions, memory*
A **deterministic** ($0, no LLM) skill flags auth / secret / destructive-SQL
changes in a PR. It declares a contract, passes the **9-point quality gate
(9/9 → verified)**, and a hard assertion would HALT on empty input. `memory-update`
records every run so you see the **risk-rate trend across runs** (run it twice).
> A prompt can't be graded, can't guarantee output, and forgets every run.

### 3 · Secret-safe logs — *security primitives*
Before logs reach an LLM: a skill that asks for `net` is **denied by the
default-deny policy**, file writes are **sandboxed** (path-traversal blocked), and
provider API keys are **redacted** out of the log line.
> A prompt-skill has no concept of least privilege — it inherits whatever the
> host agent can do.

### 4 · Batch digest — *composition primitives*
Summarise N changelog entries with `mapPattern` (parallel, isolated per item),
fold them with `reducePattern`, run post-processing stages with `parallel`, and
resolve a build `dagLayers` graph into parallelizable layers.
> One "summarise all of these" prompt has no parallelism, no per-item isolation,
> and bakes the loop logic into the prompt instead of reusing a primitive.

### 5 · Nightly report — *the production wrapper*
A weekday-09:00 **cron trigger** decides activation; an **EventBus** routes
low-confidence warnings to the trace log and failures to a webhook (your Slack /
pager); **alert thresholds** check the run's metrics; and the pipeline renders as
a diagram.
> This is all the scaffolding you'd otherwise rebuild by hand around every skill.

### 6 · A/B on a real LLM — *transform a plain skill, then compare*
The **same prompt** runs two ways against the **same model**: once as a raw call
(`runPlain` — whatever it returns, you ship) and once moved inside a SkillWeave
`Skill` (`grounded-extractor`) so the runtime confidence-routes it, **auto-judges
groundedness against the email**, and **retries with negative context** when the
model over-infers. `--hard` uses a loose, realistic prompt + a bait email so the
plain path ships invented follow-ups and the wrapped path catches them.
> The only thing that changed between the two paths is the wrapper around the
> prompt. On an easy task both agree — and that's the honest result: the wrapper
> adds *safety and a verdict*, and steps in exactly when the model slips.

---

## When a plain skill is the right call

SkillWeave is not a replacement for writing good prompts — it wraps them. If your
task is a **single, one-shot, low-stakes prompt** with no composition, no
reliability requirement, and no need for memory/security/scheduling, a plain
skill is simpler and you should just use one. Reach for SkillWeave when the task
is **multi-step**, the output is **probabilistic and consequential**, or it has to
**run unattended in production**.
