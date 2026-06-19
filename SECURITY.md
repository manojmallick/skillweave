# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories on the
[skillweave repository](https://github.com/manojmallick/skillweave/security/advisories/new),
or by email to the maintainer. Do not open a public issue for security reports.

We aim to acknowledge reports within a few working days.

## Scope & posture

- **Local-first, zero telemetry.** The runtime reads and writes local files only
  (`traces/`, `.context/`); it makes no network calls except to the LLM provider you
  configure for the boundary judge.
- **API keys** are read from environment variables (`ANTHROPIC_API_KEY`,
  `GEMINI_API_KEY` / `GOOGLE_API_KEY`, `OPENAI_API_KEY`) and are never written to disk
  or to the trace logs.
- **Offline by default.** With no provider key set, the judge runs a local heuristic and
  the chain makes no outbound requests at all.
