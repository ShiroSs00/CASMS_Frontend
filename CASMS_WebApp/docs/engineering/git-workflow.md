# Git workflow

Record base commit and baseline status before changing files. Preserve pre-existing changes. Commit only task-owned paths after reviewing the staged diff and running required checks.

Do not push directly to main. Push only when the human user explicitly authorizes it. This WebApp repair does not authorize backend pushes or changes to mobile sources. Do not force-push without explicit authorization. Do not commit local environment files, credentials, dependencies, build output or QA runtime data.
