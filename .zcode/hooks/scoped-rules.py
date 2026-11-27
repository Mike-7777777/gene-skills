#!/usr/bin/env python3
"""scoped-rules.py — path-scoped instructions for ZCode. Standard library only.

A rule is a file in .zcode/rules/. Its frontmatter carries `paths:`, a list of
gitignore-style globs matched without regard to case, and its body is the
instruction. Given the file a Read, Edit or Write names, this prints the bodies
of the rules that match it and that this session has not been given yet, as the
hook JSON ZCode turns into context.

Usage:
  scoped-rules.py --root DIR                 stdin: the PreToolUse payload
  scoped-rules.py --root DIR --reset         stdin: the SessionStart payload
  scoped-rules.py --root DIR --list          every rule and its globs
  scoped-rules.py --root DIR --match PATH    the rules that match one path
                                             (PATH is relative to the project)

Exit codes: 0 for the two hook forms, whatever it found; 2 is a usage error.
A payload it cannot read, a rules folder that is missing and an unreadable rule
all end the same way: nothing printed, exit 0. A hook that fails must not fail
the tool call it watches.

Writes only <system temp>/ccgs-zcode-rules/<session id>.txt, the list of rules a
session has been given.
"""
import json
import os
import re
import sys
import tempfile

RULES_DIR = os.path.join(".zcode", "rules")
STATE_DIR = os.path.join(tempfile.gettempdir(), "ccgs-zcode-rules")
VERBS = {"Read": "read", "Edit": "edit", "Write": "write or create"}


def expand_braces(pattern):
    """`a{b,c}d` -> [`abd`, `acd`]; braces nest."""
    i = pattern.find("{")
    if i < 0:
        return [pattern]
    depth, j = 0, i
    while j < len(pattern):
        if pattern[j] == "{":
            depth += 1
        elif pattern[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    if depth != 0:
        return [pattern]
    head, body, tail = pattern[:i], pattern[i + 1:j], pattern[j + 1:]
    alternatives, current, depth = [], "", 0
    for ch in body:
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        if ch == "," and depth == 0:
            alternatives.append(current)
            current = ""
        else:
            current += ch
    alternatives.append(current)
    out = []
    for alternative in alternatives:
        for expanded in expand_braces(head + alternative + tail):
            if expanded not in out:
                out.append(expanded)
    return out


def glob_to_regex(glob):
    """One brace-free glob -> a regex for a whole project-relative path.
    `**/` is zero or more segments, a trailing `**` is anything below, and `*`
    and `?` stay inside one segment."""
    out, i, n = [], 0, len(glob)
    while i < n:
        if glob.startswith("**", i):
            if i + 2 == n:
                out.append("(.*)")
                i += 2
            elif glob[i + 2] == "/":
                out.append("(?:[^/]+/)*")
                i += 3
            else:
                out.append(".*")
                i += 2
        elif glob[i] == "*":
            out.append("[^/]*")
            i += 1
        elif glob[i] == "?":
            out.append("[^/]")
            i += 1
        elif glob[i] == "[":
            j = glob.find("]", i + 1)
            if j < 0:
                out.append("\\[")
                i += 1
            else:
                inner = glob[i + 1:j]
                if inner.startswith("!"):
                    inner = "^" + inner[1:]
                out.append("[" + inner + "]")
                i = j + 1
        else:
            out.append(re.escape(glob[i]))
            i += 1
    return "".join(out)


def compile_globs(globs):
    regexes = []
    for glob in globs:
        for alternative in expand_braces(glob):
            try:
                regexes.append((glob, re.compile(glob_to_regex(alternative) + r"\Z", re.I | re.S)))
            except re.error:
                continue
    return regexes


def parse_rule(text):
    """-> (globs, body) for a rule that carries `paths:`; None for any other file."""
    match = re.match(r"\A---\r?\n(.*?)\r?\n---\r?\n(.*)\Z", text, re.S)
    if not match:
        return None
    frontmatter, body = match.group(1), match.group(2)
    globs, in_paths = [], False
    for line in frontmatter.splitlines():
        if re.match(r"^paths:\s*$", line):
            in_paths = True
            continue
        if not in_paths:
            continue
        item = re.match(r"^\s+-\s+(.+?)\s*$", line)
        if item:
            globs.append(item.group(1).strip().strip('"').strip("'"))
        elif line.strip():
            in_paths = False
    if not globs:
        return None
    return globs, body.strip()


class Rule(object):
    def __init__(self, name, globs, body):
        self.name = name
        self.globs = globs
        self.body = body
        self.regexes = compile_globs(globs)
        title = re.match(r"^#\s+(.+?)\s*$", body, re.M)
        self.title = title.group(1) if title else name

    def matched_by(self, rel):
        """The globs that match one project-relative path."""
        return [glob for glob, regex in self.regexes if regex.match(rel)]


def load_rules(root):
    folder = os.path.join(root, RULES_DIR)
    rules = []
    if not os.path.isdir(folder):
        return rules
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".md"):
            continue
        try:
            with open(os.path.join(folder, name), encoding="utf-8") as handle:
                parsed = parse_rule(handle.read())
        except (OSError, UnicodeDecodeError):
            continue
        if parsed:
            rules.append(Rule(name, parsed[0], parsed[1]))
    return rules


def relative_path(root, path):
    """A tool call's file path -> project-relative with `/` separators; None when
    the path is empty or outside the project."""
    if not isinstance(path, str) or not path.strip():
        return None
    path = path.strip()
    if not os.path.isabs(path):
        path = os.path.join(root, path)
    try:
        rel = os.path.relpath(os.path.normpath(path), root)
    except ValueError:  # another drive, on Windows
        return None
    rel = rel.replace(os.sep, "/")
    if rel == ".." or rel.startswith("../"):
        return None
    return rel


def session_key(value):
    """The session id as a file name; None when the payload carries none."""
    if not isinstance(value, str) or not value.strip():
        return None
    return re.sub(r"[^A-Za-z0-9_-]", "-", value.strip())[:128] or None


def state_file(key):
    return os.path.join(STATE_DIR, key + ".txt") if key else None


def read_state(path):
    try:
        with open(path, encoding="utf-8") as handle:
            return [line.strip() for line in handle if line.strip()]
    except OSError:
        return []


def write_state(path, names):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write("\n".join(names) + "\n")
    except OSError:
        pass


def read_payload():
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        return None
    return payload if isinstance(payload, dict) else None


def context_text(tool, rel, rules):
    verb = VERBS.get(tool, "touch")
    lines = [
        "Path-scoped instructions for `%s` (you are about to %s it). They apply to this file "
        "for the rest of the session: read them before you go on." % (rel, verb),
        "",
    ]
    for rule in rules:
        lines.append("----- %s (source: %s/%s) -----" % (rule.title, RULES_DIR, rule.name))
        lines.append(rule.body)
        lines.append("")
    return "\n".join(lines).strip()


def usage():
    sys.stderr.write("usage: scoped-rules.py --root DIR [--reset | --list | --match PATH] < payload.json\n")
    return 2


def main(argv):
    root, mode, target, i = None, "hook", None, 0
    while i < len(argv):
        if argv[i] == "--root" and i + 1 < len(argv):
            root = argv[i + 1]
            i += 2
        elif argv[i] == "--reset":
            mode = "reset"
            i += 1
        elif argv[i] == "--list":
            mode = "list"
            i += 1
        elif argv[i] == "--match" and i + 1 < len(argv):
            mode, target = "match", argv[i + 1]
            i += 2
        else:
            return usage()
    if not root:
        return usage()
    root = os.path.abspath(root)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

    if mode == "list":
        for rule in load_rules(root):
            for glob in rule.globs:
                print("%s\t%s" % (rule.name, glob))
        return 0
    if mode == "match":
        rel = relative_path(root, target)
        for rule in load_rules(root):
            for glob in rule.matched_by(rel or ""):
                print("%s\t%s\t%s" % (rel or target, rule.name, glob))
        return 0

    payload = read_payload()
    if payload is None:
        return 0
    state = state_file(session_key(payload.get("session_id")))
    if mode == "reset":
        if state:
            try:
                os.remove(state)
            except OSError:
                pass
        return 0
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return 0
    rel = relative_path(root, tool_input.get("file_path"))
    if not rel:
        return 0
    given = read_state(state) if state else []
    fresh = [rule for rule in load_rules(root) if rule.name not in given and rule.matched_by(rel)]
    if not fresh:
        return 0
    if state:
        write_state(state, given + [rule.name for rule in fresh])
    output = {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                     "additionalContext": context_text(payload.get("tool_name"), rel, fresh)}}
    print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
