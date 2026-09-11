# Maintainer guide

[README](README.md) · [User guide](USERGUIDE.md) · [Documentation index](docs/README.md)

Use this guide when reviewing, integrating, or releasing changes. Setup and commands live in [Development](docs/development.md); implementation boundaries live in [Architecture](docs/architecture.md).

## Review a change

1. Confirm the change has a clear purpose and preserves unrelated work.
2. For rules or session changes, review both the Java implementation and the browser implementation. Check snapshots, pending actions, scoring, and events for equivalent behavior.
3. For API changes, review the controller, Java view models, TypeScript types, and both gateways together.
4. Run the relevant checks in [Development](docs/development.md), and record results and any untested behavior in the pull request.
5. For visible gameplay changes, exercise the affected flow in both runtimes, including unavailable actions and error states.

Keep Java rules independent of React and Spring. Route UI game operations through `GameGateway`. Keep card presentation mapping centralized. See [Architecture](docs/architecture.md) for source entry points.

## Integrate and deploy

Use a focused feature branch and a pull request describing the problem, resulting behavior, and validation. Review the diff before merging.

Merging or pushing to `main` triggers the Pages deployment workflow. That workflow builds the browser client but does **not** run the Java or frontend test suites. Complete applicable checks before merging.

Follow [Deployment](docs/deployment.md) for Pages configuration, local packaging, and deployment troubleshooting.

## Keep documentation current

Keep only these Markdown entry points at the repository root:

- [README.md](README.md): project overview and quickest route to play or develop.
- [USERGUIDE.md](USERGUIDE.md): player-facing instructions.
- [MAINTAINER.md](MAINTAINER.md): review and maintenance responsibilities.

Keep detailed documentation in `docs/`, linked from its [index](docs/README.md). Update the owning page in the same change as the behavior it describes. Use relative links, short headings, and executable commands with an explicit working directory. Link to existing guidance instead of duplicating it.

AI assistants enter through the README link to [AI development guidance](docs/ai-development.md); keep that page aligned with the shared workflow. Historical material in [the archive](docs/archive/README.md) is background, not current project policy.

## Current maintenance constraints

Both game implementations require maintenance; there is no automatic translation between Java and TypeScript. Sessions are in memory, and some artwork remains placeholder material. Avoid documenting multiplayer, durable storage, or automated test gates as existing features.
