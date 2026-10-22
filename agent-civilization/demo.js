// A made-up civilization, for a look at what the page draws when no agent works: worlds, moons, a linked world,
// people, and the places they reach, all from the same events that the server sends.

const FILES = [
    "src/server/app.ts",
    "src/server/http.ts",
    "src/server/spend.ts",
    "src/server/linked-sessions.ts",
    "web/app.js",
    "web/style.css",
    "web/transcript.js",
    "test/app.test.ts",
    "test/spend.test.ts",
    "docs/features.md",
    "package.json",
    "README.md",
];
const COMMANDS = [
    "npm test",
    "npm run check",
    "npm run lint",
    'rg "budget" src',
    "node --check web/app.js",
    "ls docs",
    "cat package.json",
];
const GIT = [
    "git status",
    "git diff --stat",
    "git log --oneline -5",
    "gh pr view 412",
    "gh pr checks 412",
];
const SITES = ["localhost:5173", "github.com", "developer.mozilla.org", "nodejs.org"];
const MCP = [
    ["github", "search_issues"],
    ["github", "get_pull_request"],
    ["linear", "list_issues"],
];
const MOON_NAMES = [
    "test-runner",
    "researcher",
    "reviewer",
    "doc-scout",
    "perf-hunter",
    "ui-tester",
    "migrator",
    "lint-sweeper",
];
const SAYINGS = [
    "All 214 tests pass.",
    "Found it: the cache is read before the commit lands.",
    "The spend limit now covers linked sessions too.",
    "I split the handler into two routes and kept the old one as a redirect.",
    "Three call sites still use the old name; fixing them now.",
    "The flaky test waits on an animation. Waiting on getAnimations() fixes it.",
    "Docs updated. The table in features.md lists the new limit.",
];
const THOUGHTS = [
    "If the watcher fires before the commit, it sees a stale view… check the order in #committed.",
    "The reviewer will want a test for the replay path. One small test, not ten.",
    "Maybe the linked session can draft the release notes while the tests run.",
    "Two routes share a prefix; the fixed part wins, so items/new is safe.",
];
const ASKS = [
    "Run the full test suite and report only failures.",
    "Find every caller of spend.check and list them.",
    "Review the diff in src/server/spend.ts for edge cases.",
    "Check the page on a phone viewport and screenshot the result.",
    "Measure how long the session list takes to load with 500 sessions.",
];
const HUMAN_ASKS = [
    "Can you make the budget cover linked sessions too?",
    "Ship it when the tests are green 🚀",
    "Why is the settings page slow on my phone?",
    "Add a small test for the replay case.",
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Demo {
    constructor(onBatch) {
        this.onBatch = onBatch;
        this.data = { convs: {}, res: {}, humans: {}, events: [] };
        this.seq = 0;
        this.timers = new Set();
        this.running = false;
        this.busy = new Map();
        this.out = [];
        this.changed = { convs: new Set(), res: new Set(), humans: new Set() };
        this.started = Date.now();
    }

    // ——— bookkeeping, as the server keeps it ———

    conv(id, extra = {}) {
        let conv = this.data.convs[id];

        if (!conv) {
            conv = {
                id,
                kind: "session",
                first: Date.now(),
                last: Date.now(),
                tin: 0,
                tout: 0,
                cost: 0,
                calls: 0,
                turns: 0,
                errors: 0,
                tools: {},
                files: {},
            };
            this.data.convs[id] = conv;
        }

        Object.assign(conv, extra);
        conv.last = Date.now();
        this.changed.convs.add(id);

        return conv;
    }

    touch(key, item, by, write) {
        const resource = (this.data.res[key] ??= { key, count: 0, last: 0, items: {}, by: {} });

        resource.count++;
        resource.last = Date.now();
        resource.by[by] = (resource.by[by] ?? 0) + 1;

        if (item) {
            const entry = (resource.items[item] ??= { n: 0, last: 0 });

            entry.n++;
            entry.last = Date.now();

            if (write) {
                entry.w = (entry.w ?? 0) + 1;
            }
        }

        this.changed.res.add(key);
    }

    emit(k, data) {
        const event = { id: 1e12 + ++this.seq, at: Date.now(), k, ...data };

        this.data.events.push(event);

        if (this.data.events.length > 3000) {
            this.data.events.shift();
        }

        this.out.push(event);
        this.flushSoon();

        return event;
    }

    flushSoon() {
        if (this.flushTimer) {
            return;
        }

        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;

            const pickOut = (set, from) => {
                const out = {};

                set.forEach((key) => (out[key] = from[key]));
                set.clear();

                return out;
            };

            const batch = {
                events: this.out,
                convs: pickOut(this.changed.convs, this.data.convs),
                res: pickOut(this.changed.res, this.data.res),
                humans: pickOut(this.changed.humans, this.data.humans),
            };

            this.out = [];

            if (this.running) {
                this.onBatch(batch);
            }
        }, 120);
    }

    later(ms, run) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);

            if (this.running) {
                run();
            }
        }, ms);

        this.timers.add(timer);
    }

    // ——— what agents do ———

    human(name, to, text) {
        const person = (this.data.humans[name] ??= { name, count: 0, last: 0 });

        person.count++;
        person.last = Date.now();
        this.changed.humans.add(name);
        this.emit("msg", { from: `human:${name}`, to, via: "human", text });
        this.later(500, () => this.think(to));
    }

    think(id) {
        const conv = this.conv(id);

        this.emit("think", { c: id, m: 10 + conv.turns * 3, pv: conv.provider, md: conv.model });
        this.later(900 + Math.random() * 2200, () => this.reply(id));
    }

    reply(id) {
        const conv = this.conv(id);
        const tin = 8000 + Math.round(Math.random() * 40000);
        const tout = 200 + Math.round(Math.random() * 1800);
        const cost = (tin * 3 + tout * 15) / 1e6;
        const final = conv.turns > 2 && Math.random() < 0.18;

        conv.turns++;
        conv.tin += tin;
        conv.tout += tout;
        conv.cost += cost;
        this.touch(`model:${conv.provider}`, conv.model, id);

        if (final) {
            this.emit("reply", {
                c: id,
                pv: conv.provider,
                md: conv.model,
                tin,
                tout,
                cost,
                calls: 0,
                stop: "stop",
                text: pick(SAYINGS),
            });
            this.later(400, () => {
                this.emit("idle", { c: id });

                if (conv.kind === "subagent" && conv.parent) {
                    this.emit("msg", {
                        from: id,
                        to: conv.parent,
                        via: "report",
                        text: pick(SAYINGS),
                    });
                    this.later(700, () => this.think(conv.parent));
                } else {
                    this.later(5000 + Math.random() * 6000, () =>
                        this.human("Robin", id, pick(HUMAN_ASKS)),
                    );
                }
            });

            return;
        }

        const calls = 1 + (Math.random() < 0.35 ? 1 : 0);

        this.emit("reply", {
            c: id,
            pv: conv.provider,
            md: conv.model,
            tin,
            tout,
            cost,
            calls,
            stop: "toolUse",
            th: Math.random() < 0.5 ? pick(THOUGHTS) : undefined,
        });

        let pending = calls;

        for (let index = 0; index < calls; index++) {
            this.later(150 + index * 200, () =>
                this.tool(id, () => {
                    if (--pending === 0) {
                        this.later(250, () => this.think(id));
                    }
                }),
            );
        }
    }

    tool(id, done) {
        const conv = this.conv(id);
        const roll = Math.random();
        const call = `demo:${++this.seq}`;
        let event;

        if (
            conv.kind !== "subagent" &&
            roll < 0.12 &&
            Object.values(this.data.convs).filter(
                (each) => each.parent === id && each.kind === "subagent",
            ).length < 4
        ) {
            this.spawn(id, call);
            this.later(600, done);

            return;
        }

        if (conv.kind === "session" && !conv.parent && roll < 0.16 && !this.linkedMade) {
            this.linkedMade = true;
            this.found(id, call);
            this.later(600, done);

            return;
        }

        if (roll < 0.5) {
            const file = pick(FILES);
            const write = Math.random() < 0.3;
            const verb = write ? pick(["wrote", "edited"]) : "read";

            event = {
                n: write ? "edit" : "read",
                s: "files",
                i: file,
                l: `${verb} ${file}`,
                w: write ? 1 : undefined,
            };
            conv.files[file] ??= { r: 0, w: 0, last: 0 };
            conv.files[file][write ? "w" : "r"]++;
            conv.files[file].last = Date.now();
            this.touch("files", file, id, write);
        } else if (roll < 0.68) {
            const command = pick(COMMANDS);

            event = { n: "bash", s: "shell", i: command.split(" ")[0], l: command };
            this.touch("shell", command.split(" ")[0], id);
        } else if (roll < 0.78) {
            const command = pick(GIT);

            event = {
                n: "bash",
                s: "github",
                i: command.split(" ").slice(0, 2).join(" "),
                l: command,
            };
            this.touch("github", event.i, id);
        } else if (roll < 0.86) {
            const site = pick(SITES);

            event = { n: "browser", s: "web", i: site, l: `navigate ${site}` };
            this.touch("web", site, id);
        } else if (roll < 0.94) {
            const [server, name] = pick(MCP);

            event = { n: "mcp_call", s: `mcp:${server}`, i: name, l: `${server} · ${name}` };
            this.touch(`mcp:${server}`, name, id);
        } else if (roll < 0.97) {
            event = { n: "memory", s: "memory", i: "add", l: "memory add" };
            this.touch("memory", "add", id);
        } else {
            event = { n: "codemode", s: "codemode", i: "script", l: "ran a script" };
            this.touch("codemode", "script", id);
        }

        conv.calls++;
        conv.tools[event.n] = (conv.tools[event.n] ?? 0) + 1;
        this.emit("tool", { c: id, call, ...event });

        // Now and then a run of bad luck, and a storm with it.
        const elapsed = Date.now() - this.started;
        const cursed = elapsed >= 22_000 && (elapsed - 22_000) % 150_000 < 20_000;
        const ok = Math.random() > (cursed ? 0.55 : 0.06);

        this.later(300 + Math.random() * (event.n === "bash" ? 3500 : 1200), () => {
            if (!ok) {
                this.conv(id).errors++;
            }

            const why =
                event.n === "bash"
                    ? "exit code 1: 2 tests failed"
                    : event.s === "files"
                      ? "the text to replace was not found"
                      : "timed out";

            this.emit("done", { c: id, call, n: event.n, ok: ok ? 1 : 0, e: ok ? undefined : why });
            done();
        });
    }

    spawn(parent, call) {
        const used = new Set(Object.values(this.data.convs).map((each) => each.name));
        const name = MOON_NAMES.find((each) => !used.has(each)) ?? `helper-${this.seq}`;
        const id = `demo-${++this.seq}`;
        const owner = this.data.convs[parent];
        const cheap = Math.random() < 0.5;
        const ask = pick(ASKS);

        this.conv(parent).calls++;
        this.emit("tool", {
            c: parent,
            call,
            n: "subagent",
            l: `spawn ${name}`,
            a: "spawn",
            tn: name,
        });
        this.conv(id, {
            kind: "subagent",
            parent,
            name,
            provider: cheap ? "opencode-go" : owner.provider,
            model: cheap ? "deepseek-v4.1-flash" : owner.model,
            thinking: "medium",
        });
        this.emit("link", { c: id, p: parent, kind: "subagent", name });
        this.later(250, () => {
            this.emit("done", { c: parent, call, n: "subagent", ok: 1 });
            this.emit("msg", { from: parent, to: id, via: "subagent", text: ask });
            this.later(500, () => this.think(id));
        });
    }

    found(parent, call) {
        const id = `demo-${++this.seq}`;
        const title = "Write the release notes";

        this.conv(parent).calls++;
        this.emit("tool", {
            c: parent,
            call,
            n: "team",
            l: `team start ${title}`,
            a: "start",
            tn: title,
        });
        this.conv(id, {
            kind: "linked",
            parent,
            title,
            provider: "openai",
            model: "gpt-5.5",
            thinking: "high",
        });
        this.emit("link", { c: id, p: parent, kind: "linked" });
        this.later(300, () => {
            this.emit("done", { c: parent, call, n: "team", ok: 1 });
            this.emit("msg", {
                from: parent,
                to: id,
                via: "team",
                text: "Draft release notes for 0.20 from the merged PRs; send them back when done.",
            });
            this.later(600, () => this.think(id));
        });
    }

    start() {
        this.running = true;

        const main = "demo-1";

        this.conv(main, {
            title: "Ship the budget refactor",
            provider: "anthropic",
            model: "claude-opus-4-7",
            thinking: "high",
            cwd: "~/pi-pocket",
        });
        this.flushSoon();
        this.later(700, () =>
            this.human(
                "Robin",
                main,
                "Make the budget cover linked sessions, and keep the tests lean.",
            ),
        );
        this.later(16000, () => this.human("Kai", main, "I can review the PR once it's up 👀"));
        // The first moons and a linked world come early, so there is something to see at once.
        [5000, 9000, 19000].forEach((ms) =>
            this.later(ms, () => this.spawn(main, `demo:${++this.seq}`)),
        );
        this.later(13000, () => {
            if (!this.linkedMade) {
                this.linkedMade = true;
                this.found(main, `demo:${++this.seq}`);
            }
        });

        // Keep the place lively: an idle world gets a nudge now and then.
        const nudge = () => {
            const idle = Object.values(this.data.convs).filter((conv) => {
                const last = [...this.data.events].reverse().find((event) => event.c === conv.id);

                return !last || last.k === "idle" || Date.now() - last.at > 12000;
            });

            if (idle.length > 0) {
                const conv = pick(idle);

                if (conv.kind === "subagent" && conv.parent) {
                    this.emit("msg", {
                        from: conv.parent,
                        to: conv.id,
                        via: "subagent",
                        text: pick(ASKS),
                    });
                    this.later(400, () => this.think(conv.id));
                } else {
                    this.human(Math.random() < 0.7 ? "Robin" : "Kai", conv.id, pick(HUMAN_ASKS));
                }
            }

            this.later(9000 + Math.random() * 5000, nudge);
        };

        this.later(12000, nudge);
    }

    stop() {
        this.running = false;
        this.timers.forEach((timer) => clearTimeout(timer));
        this.timers.clear();
        clearTimeout(this.flushTimer);
    }
}
