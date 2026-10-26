# Frontend design skills

Project-local skills shared by CASMS_WebApp and CASMS_MobileApp. Codex can discover these skills from the frontend root on the next turn. Follow each application's AGENTS.md and existing design system when applying guidance.

- ui-ux-pro-max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
  - Commit: d14efff8ed1faa4187f004f79926f428c8074ec7
  - Source: .claude/skills/ui-ux-pro-max (including data, scripts and references).
  - Local adaptation: SKILL.md commands resolve the installed skill directory rather than using Claude's plugin environment variable.
  - Requires Python 3; no third-party Python packages.
- animate-ui: https://github.com/imskyleen/animate-ui
  - Commit: c28163655493f98bff9dc0362301a6242f74a1fd
  - Source: skills/animate-ui (including NOTICE.md and references).
  - Agent instructions only. React/Vue runtime dependencies are installed only when implementing animations in the relevant application.

Installed 2026-10-25 at the user's request. Baseline frontend commit b4ca6c07bb8a3a16606228e58248600a95d1fd67. The user subsequently requested removal of WebApp AGENTS.md, OCV reports, docs and qa directories. No application source, package manifest or lockfile changes.