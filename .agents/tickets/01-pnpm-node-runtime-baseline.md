# 01: Establish the PNPM and Node 22 Runtime Baseline

**What to build:** Contributors and CI can install, typecheck, lint, test, build, and build the container using the same Node 22 and PNPM toolchain. Docker Compose, `.env.example`, persistent data mounting, and README instructions provide one reproducible local and container workflow.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Node 22 and PNPM are consistently used for local development, CI, and container builds.
- [x] The project installs from the committed lockfile and all CI quality gates run successfully.
- [x] Docker and Docker Compose start the bot with settings persisted outside the container.
- [x] The documented setup includes required environment variables and command registration.