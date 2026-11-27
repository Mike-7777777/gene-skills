# Agent Teams (not available in the ZCode port)

> On-demand reference, kept so the links to it still resolve.

Upstream, "agent teams" meant several independent Claude Code *sessions* running
at once and coordinated through a shared task list, behind an experimental
environment variable. ZCode has no equivalent: one session, its `Agent` tool,
and the subagents that tool starts.

So this project uses one multi-agent pattern here, subagents
(`.zcode/docs/coordination-rules.md`). When work looks like it needs a team:

- **Work that spans subsystems that will not touch the same files** → separate
  sessions you run yourself, one per workstream, each opened in the project
  root. Each has the same 49 agents. Nothing coordinates them but you: agree
  who writes which files before you start them.
- **One workstream's output feeding another's** → sequential subagents in one
  session, as before. Independent sessions cannot wait on each other.
- **Cost** → each session spends its own tokens. A team was never the cheap
  route.
