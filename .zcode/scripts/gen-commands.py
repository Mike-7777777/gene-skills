#!/usr/bin/env python3
"""gen-commands.py — regenerate the slash-command file of each skill (ZCode port).

A skill is authored once, in .zcode/skills/<name>/SKILL.md. ZCode loads that
file through the Skill tool when the model picks the skill. It runs
.zcode/commands/<name>.md when the user types /<name>, and only that file
carries `argument-hint` and `allowed-tools`. This script derives each command
from its skill, so the two are never edited apart by hand.

The body is the same in both files. What differs is only the frontmatter: a
command keeps `description`, `argument-hint` and `allowed-tools` and leaves
out the rest (`model:` above all: ZCode would read a tier alias there as a
model ID). The `allowed-tools` grant for the settings command is rewritten to
the root-relative form the command runs.

Usage:
  bash .zcode/scripts/gen-commands.sh [<name> ...] [--root DIR] [--check]
    <name>      regenerate only these skills; default is every folder that
                holds a SKILL.md
    --root DIR  the project; defaults to the repo this script is in
    --check     report which commands are out of date and write nothing

Output: TSV, one row per skill — <name>, then one of:
  written     the command file differed and was replaced
  kept        the command file already matched
  stale       (--check only) the command file differs from its skill
  no-skill    no folder of that name holds a SKILL.md
  not-read    the SKILL.md could not be read
  not-written the SKILL.md has no closed frontmatter block, or the write failed
Exit codes: 0 done; 1 a file could not be read or written; 2 usage or no such
skill; 3 with --check, at least one command is stale.
Reads SKILL.md files; writes only .zcode/commands/<name>.md; never prompts.
Standard library only.
"""
import os
import re
import sys

SKILLS_DIR = os.path.join(".zcode", "skills")
COMMANDS_DIR = os.path.join(".zcode", "commands")
COMMAND_KEYS = ("description", "argument-hint", "allowed-tools")
# The form a first-command line takes upstream. A skill in this port carries
# it already rewritten; the pattern is kept so an upstream-style skill file
# is converted on the way.
BOOTSTRAP = re.compile(r"^!`([^`]*)`[ \t]*$", re.M)
SKILL_VAR_PREFIX = "${CLAUDE_SKILL_DIR}/../../"
# A skill pre-approves that command through its own folder. A command runs the
# root-relative form, so its grant has to say the same thing.
SKILL_GRANT = re.compile(r'Bash\(bash "\*/\.zcode/skills/[^/"]+/\.\./\.\./hooks/yaml-helper\.sh" resolve_config \*\)')
COMMAND_GRANT = "Bash(bash .zcode/hooks/yaml-helper.sh resolve_config *)"
BODY_NOTE = ("> Paths in this skill are relative to the project root (the folder that holds "
             "`project.yaml`), whatever a \"relative to this base directory\" line says. A `/name` to "
             "run is the skill or slash command `name`: invoke it with the Skill tool, or type it.")


def split_frontmatter(text):
    """-> (frontmatter lines, body). (None, text) when the file opens with no
    closed `---` block: such a file is left exactly as it is."""
    lines = text.split("\n")
    if lines and lines[0] == "---":
        for index in range(1, len(lines)):
            if lines[index] == "---":
                return lines[1:index], "\n".join(lines[index + 1:])
    return None, text


def raw_field(frontmatter, key):
    """The lines of one frontmatter field, continuation lines included, or None."""
    out, inside = [], False
    for line in frontmatter:
        if inside:
            if line[:1] in (" ", "\t"):
                out.append(line)
                continue
            inside = False
        if re.match(r"^%s\s*:" % re.escape(key), line):
            out.append(line)
            inside = True
    return out or None


def is_config_command(command):
    return "yaml-helper.sh" in command and "resolve_config" in command


def run_first(match):
    """Replaces a skill's `!`command` line. ZCode runs nothing in a skill on its
    own, so the command becomes an instruction the model carries out first. The
    path is written relative to the project root, like every other path a skill
    names, because a command file cannot resolve the skill's own folder."""
    command = match.group(1).replace(SKILL_VAR_PREFIX, ".zcode/")
    if is_config_command(command):
        lead = ("**Run this first.** Use the Bash tool to run the command below before anything else "
                "in this skill. It is read-only, and its output is this run's resolved configuration: "
                "use it as written and do not re-derive it. If it fails or prints nothing, say so and "
                "use the defaults in `.zcode/docs/config-resolution.md`.")
    else:
        lead = ("**Run this first.** Use the Bash tool to run the command below before anything else "
                "in this skill; the steps below read its output.")
    return "%s\n\n```bash\n%s\n```" % (lead, command)


def body_of(body):
    """The body a skill and its command share."""
    body = BOOTSTRAP.sub(run_first, body).lstrip("\n")
    if not body.startswith(BODY_NOTE):
        body = BODY_NOTE + "\n\n" + body
    if not body.endswith("\n"):
        body += "\n"
    return body


def skill_text(frontmatter, body):
    """A whole SKILL.md from its parts."""
    return "---\n" + "\n".join(frontmatter) + "\n---\n\n" + body_of(body)


def command_from_skill(text):
    """The slash-command file for one SKILL.md, or (None, reason)."""
    frontmatter, body = split_frontmatter(text)
    if frontmatter is None:
        return None, "no frontmatter"
    lines = ["---"]
    for key in COMMAND_KEYS:
        field = raw_field(frontmatter, key)
        if field:
            lines.extend(SKILL_GRANT.sub(lambda m: COMMAND_GRANT, line) for line in field)
    lines.append("---")
    lines.append("")
    return "\n".join(lines) + "\n" + body_of(body), None


def generate(root, names, check):
    skills_dir = os.path.join(root, SKILLS_DIR)
    if not os.path.isdir(skills_dir):
        sys.stderr.write("gen-commands: no %s folder under %s\n" % (SKILLS_DIR, root))
        return 1
    if not names:
        names = sorted(d for d in os.listdir(skills_dir)
                       if os.path.isfile(os.path.join(skills_dir, d, "SKILL.md")))
    commands_dir = os.path.join(root, COMMANDS_DIR)
    status, stale = 0, 0
    for name in names:
        skill_path = os.path.join(skills_dir, name, "SKILL.md")
        if not os.path.isfile(skill_path):
            print("%s\tno-skill" % name)
            status = 2
            continue
        try:
            with open(skill_path, encoding="utf-8") as handle:
                text = handle.read()
        except (OSError, UnicodeDecodeError) as error:
            print("%s\tnot-read\t%s" % (name, error))
            status = 1
            continue
        content, reason = command_from_skill(text)
        if content is None:
            print("%s\tnot-written\t%s" % (name, reason))
            status = 1
            continue
        target = os.path.join(commands_dir, name + ".md")
        current = None
        try:
            with open(target, encoding="utf-8") as handle:
                current = handle.read()
        except (OSError, UnicodeDecodeError):
            pass
        if current == content:
            print("%s\tkept" % name)
            continue
        if check:
            print("%s\tstale" % name)
            stale += 1
            continue
        try:
            os.makedirs(commands_dir, exist_ok=True)
            with open(target, "w", encoding="utf-8", newline="\n") as handle:
                handle.write(content)
        except OSError as error:
            print("%s\tnot-written\t%s" % (name, error))
            status = 1
            continue
        print("%s\twritten" % name)
    return 3 if stale else status


def main(argv):
    root, check, names, i = None, False, [], 0
    while i < len(argv):
        if argv[i] == "--root" and i + 1 < len(argv):
            root = argv[i + 1]
            i += 2
        elif argv[i] == "--check":
            check = True
            i += 1
        elif argv[i] in ("-h", "--help"):
            sys.stdout.write(__doc__)
            return 0
        elif argv[i].startswith("-"):
            sys.stderr.write("gen-commands: unknown argument: %s (try --help)\n" % argv[i])
            return 2
        else:
            names.append(argv[i])
            i += 1
    if root is None:
        root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return generate(os.path.abspath(root), names, check)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    sys.exit(main(sys.argv[1:]))
