# AI development guidance

[Documentation index](README.md) · [Development](development.md) · [Architecture](architecture.md)

This is the project context for AI coding assistants. Human and AI contributors use the same architecture, checks, and review expectations.

## Before editing

1. Read the [project README](../README.md), this page, and the relevant sections of [Development](development.md) and [Architecture](architecture.md).
2. Inspect the working tree and preserve unrelated user changes.
3. Read the actual implementation and nearby tests before choosing an approach. Treat archived notes as historical context only.
4. Identify whether the task affects the Java runtime, browser runtime, shared UI, or multiple layers.

This page is linked from the root README. It is an explicit reading entry point; it does not rely on automatic discovery of a root agent-instruction file.

## Project constraints

- There are two maintained rules implementations: Java `BelotMatchFacade` and TypeScript `BelotMatchFacade`. A rule fix in one does not fix the other.
- Keep Java engine code independent of Spring and UI concerns.
- The active React app uses `GameGateway`; implement operations in both gateways when the shared interface changes.
- Keep Java view records, TypeScript types, session responses, pending actions, and events compatible.
- Use `serverGateway.ts` for the active HTTP/SSE transport. The older `sessionApi.ts` and `eventStream.ts` are not the active app path.
- Keep card and suit mapping in `cardPresentation.ts`. Preserve established card classes and lowercase labels unless the task explicitly changes that presentation.
- Keep development documentation under `docs/`. The root Markdown files are README, MAINTAINER, and USERGUIDE.
- Avoid unrelated refactors, dependency updates, generated artifacts, and changes to archived material.

## Validate and hand off

Use the [validation table](development.md#validation) to choose checks. Verify changed gameplay in both runtimes and state any known differences. Documentation edits need link and source checks; they do not require running unrelated application test suites.

Finish with a concise account of what changed, why, checks actually performed, and any remaining limitations. Distinguish successful checks from checks that were skipped or blocked. Do not claim a deployment or test run that did not happen.
