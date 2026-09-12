# Documentation

[Project README](../README.md) · [User guide](../USERGUIDE.md) · [Maintainer guide](../MAINTAINER.md)

## Start here

| Task | Read |
| --- | --- |
| Set up, change, and test the project | [Development](development.md) |
| Work with an AI coding assistant | [AI development guidance](ai-development.md), then the shared development guide |
| Find the implementation to change | [Architecture](architecture.md) |
| Inspect the server contract | [Session API](api.md) |
| Publish or diagnose a build | [Deployment](deployment.md) |
| Plan the UI redesign | [UI and UX improvement plan](ui-ux-plan.md) (proposed) |
| Apply the current color direction | [Casino color and material plan](color-material-plan.md) (implemented; unverified) |
| Review and integrate contributions | [Maintainer guide](../MAINTAINER.md) |

## Structure

Keep the documentation flat until a topic needs several pages. Each subject has one owning page; other pages link to it.

```text
docs/
  README.md             Documentation index
  development.md        Setup, workflow, checks, troubleshooting
  ai-development.md     AI context and handoff guidance
  architecture.md       Runtime boundaries and source map
  api.md                Session HTTP and event contract
  deployment.md         Pages and local packaging
  ui-ux-plan.md         Proposed UI redesign and acceptance criteria
  color-material-plan.md  Current casino palette and material specification
  screenshots/          Current product screenshots
  archive/              Historical notes and unused documentation media
```

The [archive](archive/README.md) preserves earlier material and is excluded from the current development reading path.
