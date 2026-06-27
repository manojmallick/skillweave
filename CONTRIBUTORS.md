# Contributors

SkillWeave is built and maintained by [Manoj Mallick](https://github.com/manojmallick)
(Amsterdam).

## Recent Contributors (v2.2.0)

- `summarize` skill — a probabilistic extractive summarizer that exercises the reliability layer (confidence routing · auto-judge · retry-with-negative-context), 9/9 verified (#60)

## Recent Contributors (v2.1.0)

- `todo-flagger` skill — a worked example of authoring a skill (new STATE field + registry schema, 9/9 verified) (#56)
- Runnable feature examples under `examples/` + an Examples docs page (#52, #54)

## Recent Contributors (v2.0.2)

- Published to npm — tag-gated publish workflow, graceful CLI errors on a bad `--doc`/`--input` file, and a README license (#49)

## Recent Contributors (v2.0.1)

- npm-publishable package — compiled `dist/` build, `main`/`exports`/`types`/`files`, package-relative data resolution, and a dist-first `skillweave` bin (#43)

## Recent Contributors (v2.0.0)

- COMPOSE + OBSERVE primitives — all composition patterns (sequential/parallel/map/reduce/conditional/loop) + DAG-layer resolution, plus threshold alerting rules, a pipeline visualiser (`skillweave visualise`), and A/B score comparison (#39)

## Recent Contributors (v1.3.0)

- MEMORY primitive — an adaptive `MemoryStore` on `.context/` with a decay model, last-write-wins conflict log, cross-session failure-pattern learning, per-skill read/write scope, and the `skillweave memory` command (#36)

## Recent Contributors (v1.2.0)

- TRIGGER + EVENT primitives — declarative pipeline activation (manual/cron/webhook/pipeline_completion + condition + human approval), a 5-field cron matcher, and a typed `EventBus` with routed subscriptions wired into the orchestrator (#32)

## Recent Contributors (v1.1.0)

- Developer experience — `skillweave doctor` readiness report and "did you mean?" suggestions for mistyped commands and skill names (#28)

## Recent Contributors (v1.0.0)

- Registry + public launch — the tiered skill catalog, the 9-point quality gate, quality-derived reputation, the local-first `publish` / `install` / `registry` commands, and the stable `src/index.ts` API (#24)

## Recent Contributors (v0.8.0)

- SigMap pipeline integration — the `load-context` skill, the `sigmap-verify` pipeline, the `runSigMapVerify` in-process API + `src/index.ts` barrel, and `skillweave verify` (#20)

## Recent Contributors (v0.7.0)

- Security model — per-skill capability permissions, a default-deny policy, the `guardWrite` filesystem sandbox, secret redaction, and `skillweave check-permissions` (#17)

## Recent Contributors (v0.6.0)

- Schema governance — versioned registry, schema differ, additive-only rule, skill schema pins, and `skillweave check-schemas` (#13)

## Recent Contributors (v0.5.0)

- Multi-LLM provider layer — `LLMProviderAdapter` + anthropic/google/openai/ollama adapters, capability profiles, primary→fallback executor, and the Neutral Skill Language validator (#10)

## Recent Contributors (v0.4.0)

- SigMap adapter layer — CONTEXT / COST / OBSERVE wrappers, `skillweave health`, and the `sigmap` CLI command (#7)

## Recent Contributors (v0.3.0)

- Production runtime — `skillweave` CLI (run/validate/test/list/trace/new), pipeline YAML loader, and skill registry (#4)

## Recent Contributors (v0.2.0)

- Reliability layer — confidence routing, retry-with-negative-context, auto-judge, golden anchors (#1)
- Documentation site (VitePress) + version-sync tooling

## Recent Contributors (v0.1.0)

- Prototype chain — `parse-input → validate-coverage → boundary-judge → memory-update`
- Multi-LLM boundary judge (Anthropic / Google AI Studio / OpenAI) + offline heuristic fallback

---

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md). External contributors are
credited here by name/handle on every release.
