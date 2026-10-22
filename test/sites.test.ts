import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error: the browser module is plain JavaScript, without types.
import * as sites from "../agent-civilization/sites.js";

const { KEEP, Projects, categoryOf, fileOf, planOf, styleOf, titleOf } = sites;

type Event = Record<string, unknown> & { k: string };

/** A town of one session ("s"), with a subagent ("sub") and a linked session ("link"). */
function town() {
    const convs: Record<string, { kind: string; parent?: string }> = {
        s: { kind: "session" },
        sub: { kind: "subagent", parent: "s" },
        link: { kind: "linked", parent: "s" },
    };
    const seen: [string, string][] = [];
    const projects = new Projects({
        convs: () => convs,
        nameOf: (id: string) => id,
        colorOf: () => null,
        on: (kind: string, project: { title: string }) => seen.push([kind, project.title]),
    });
    let id = 0;
    let at = 1_000_000;
    let call = 0;

    const feed = (event: Event) => {
        at = typeof event.at === "number" ? event.at : at + 1000;
        projects.feed({ ...event, id: ++id, at });
    };

    /** A tool call that starts and finishes. */
    const work = (c: string, more: Record<string, unknown>, ok = 1) => {
        const key = `call${++call}`;

        feed({ k: "tool", c, call: key, n: "read", ...more });
        feed({ k: "done", c, call: key, ok });
    };

    const ask = (to: string, text: string, from = "human:Robin") =>
        feed({ k: "msg", from, to, via: from.startsWith("human:") ? "human" : "team", text });

    return { projects, feed, work, ask, seen, now: () => at };
}

const only = (projects: { all: Map<string, unknown> }) => [...projects.all.values()] as any[];

test("a request opens a project, its work adds parts, and its end gives it a style", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "Check the README against the code. Then tell me.");
    work("s", { s: "files", i: "README.md" });
    work("s", { s: "files", i: "town.js" });
    work("s", { s: "files", i: "town.js" });
    work("s", { n: "edit", s: "files", i: "README.md", w: 1 });
    work("s", { n: "bash", s: "shell", i: "npm", l: "npm test" });
    feed({ k: "reply", c: "s", cost: 0.25 });
    feed({ k: "idle", c: "s" });

    const [project] = only(projects);

    assert.equal(project.title, "Check the README against the code");
    assert.deepEqual(project.askers, ["Robin"]);
    assert.equal(project.state, "done");
    assert.equal(project.calls, 5);
    assert.equal(project.reads.size, 2);
    assert.equal(project.writes.size, 1);
    assert.equal(project.programs.size, 1);
    assert.equal(project.cost, 0.25);

    const plan = planOf(project);

    assert.equal(plan.stoneCount, 2);
    assert.equal(plan.floors, 1);
    assert.equal(plan.chimneys, 1);
    assert.equal(plan.done, true);
    assert.equal(project.style, "study");
});

test("a helper's work builds its owner's project, which waits for the owner to finish", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "Review the extension");
    feed({ k: "tool", c: "s", call: "spawn", n: "subagent", a: "spawn", tn: "sub" });
    feed({ k: "done", c: "s", call: "spawn", ok: 1 });
    feed({ k: "msg", from: "s", to: "sub", via: "subagent", text: "Read the server" });
    feed({ k: "idle", c: "s" });

    // The owner is idle, but its helper works on: the project stays open.
    work("sub", { s: "files", i: "agent-civilization.ts" });
    assert.equal(only(projects)[0].state, "building");

    feed({ k: "idle", c: "sub" });
    feed({ k: "msg", from: "sub", to: "s", via: "report", text: "Done" });
    feed({ k: "think", c: "s" });
    work("s", { n: "write", s: "files", i: "REVIEW.md", w: 1 });
    feed({ k: "idle", c: "s" });

    const list = only(projects);

    assert.equal(list.length, 1);
    assert.equal(list[0].state, "done");
    assert.equal(list[0].calls, 3);
    assert.deepEqual(
        [...list[0].helpers.values()].map((each: { name: string }) => each.name),
        ["sub"],
    );
    assert.equal(list[0].reads.get("agent-civilization.ts"), 1);
});

test("a word while the work goes on joins it; a new request after it opens another", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "Fix the flaky test");
    work("s", { n: "bash", s: "shell", i: "npm", l: "npm test" });
    ask("s", "I can review it after", "human:Kai");
    work("s", { n: "bash", s: "shell", i: "npm", l: "npm test" });
    feed({ k: "idle", c: "s" });
    ask("s", "Now ship it");
    work("s", { n: "bash", s: "github", i: "git push", l: "git push" });
    feed({ k: "idle", c: "s" });

    const list = only(projects);

    assert.deepEqual(
        list.map((each) => each.title),
        ["Fix the flaky test", "Now ship it"],
    );
    assert.deepEqual(list[0].askers, ["Robin", "Kai"]);
    assert.equal(list[0].style, "foundry");
    assert.equal(list[1].style, "warehouse");
});

test("a request after the agent answered is a new task, even while its helpers still work", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "Review the extension");
    feed({ k: "msg", from: "s", to: "sub", via: "subagent", text: "Read the server" });
    work("s", { s: "files", i: "a.ts" });
    feed({ k: "idle", c: "s" });
    work("sub", { s: "files", i: "b.ts" });
    ask("s", "Also check the docs");
    work("s", { s: "files", i: "docs.md" });
    feed({ k: "idle", c: "sub" });
    feed({ k: "idle", c: "s" });

    const list = only(projects);

    assert.deepEqual(
        list.map((each) => [each.title, each.state, each.calls]),
        [
            ["Review the extension", "done", 2],
            ["Also check the docs", "done", 1],
        ],
    );
});

test("a helper's work stays with the task it was given, after a new request", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "Review the extension");
    feed({ k: "think", c: "s" });
    feed({ k: "msg", from: "s", to: "sub", via: "subagent", text: "Read the server" });
    feed({ k: "idle", c: "s" });
    ask("s", "Also check the docs");
    work("sub", { s: "files", i: "server.ts" });
    feed({ k: "reply", c: "sub", cost: 0.5 });
    work("s", { s: "files", i: "docs.md" });
    feed({ k: "idle", c: "s" });

    const [first, second] = only(projects);

    assert.equal(first.reads.get("server.ts"), 1);
    assert.equal(first.cost, 0.5);
    assert.equal(second.reads.has("server.ts"), false);
    assert.equal(second.state, "done");
});

test("a call still running keeps its site open, however quiet", () => {
    const { projects, feed, ask, now } = town();

    ask("s", "Run the long build");
    feed({ k: "tool", c: "s", call: "long", n: "bash", s: "shell", i: "make", l: "make" });
    projects.settle(now() + 45 * 60_000);
    assert.equal(only(projects)[0]?.state, "building");
    feed({ k: "done", c: "s", call: "long", ok: 1 });
    feed({ k: "idle", c: "s" });
    assert.equal(only(projects)[0].state, "done");
    assert.equal(only(projects)[0].calls, 1);
});

test("a request that comes as the turn before ends waits for its own work", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "First task");
    work("s", { s: "files", i: "a.ts" });
    feed({ k: "idle", c: "s" });
    ask("s", "Second task", "human:Kai");
    // A turn woken before ends after the second request came: that is not the second task's end.
    feed({ k: "idle", c: "s" });
    feed({ k: "think", c: "s" });
    work("s", { s: "files", i: "b.ts" });
    feed({ k: "idle", c: "s" });

    assert.deepEqual(
        only(projects).map((each) => [each.title, each.state, each.calls]),
        [
            ["First task", "done", 1],
            ["Second task", "done", 1],
        ],
    );
});

test("work soon after a task ended, with no new request, goes on with the same building", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "Tidy the docs");
    work("s", { n: "edit", s: "files", i: "docs/a.md", w: 1 });
    feed({ k: "idle", c: "s" });
    feed({ k: "think", c: "s" });
    work("s", { n: "edit", s: "files", i: "docs/b.md", w: 1 });
    feed({ k: "idle", c: "s" });

    const list = only(projects);

    assert.equal(list.length, 1);
    assert.equal(list[0].writes.size, 2);
    assert.equal(list[0].state, "done");
});

test("a linked session builds its own project, beside its own house", () => {
    const { projects, feed, work, ask } = town();

    ask("s", "Start a guide");
    ask("link", "Write a newcomers' guide", "s");
    work("link", { n: "write", s: "files", i: "NEWCOMERS.md", w: 1 });
    feed({ k: "idle", c: "link" });

    const owners = only(projects).map((each) => [each.owner, each.title, each.askers[0]]);

    assert.deepEqual(owners, [
        ["s", "Start a guide", "Robin"],
        ["link", "Write a newcomers' guide", "s"],
    ]);
});

test("a task that mostly failed is left a ruin; one with no tool call builds nothing", () => {
    const { projects, feed, work, ask, seen } = town();

    ask("s", "Deploy it");

    for (let index = 0; index < 4; index++) {
        work("s", { n: "bash", s: "shell", i: "deploy", l: "deploy" }, 0);
    }

    work("s", { s: "files", i: "a.ts" });
    feed({ k: "idle", c: "s" });
    ask("s", "Thanks!");
    feed({ k: "think", c: "s" });
    feed({ k: "idle", c: "s" });

    const list = only(projects);

    assert.equal(list.length, 1);
    assert.equal(list[0].state, "ruin");
    assert.equal(list[0].fails, 4);
    assert.equal(planOf(list[0]).cracks, 4);
    assert.ok(seen.some(([kind, title]) => kind === "drop" && title === "Thanks"));
});

test(`each house keeps its newest ${KEEP} buildings`, () => {
    const { projects, feed, work, ask, now } = town();

    for (let index = 0; index < KEEP + 2; index++) {
        ask("s", `Task number ${index}`);
        work("s", { s: "files", i: `f${index}` });
        feed({ k: "idle", c: "s" });
        // Far apart, so no task goes on as the one before.
        feed({ k: "pause", at: now() + 20 * 60_000 });
    }

    const titles = only(projects).map((each) => each.title);

    assert.equal(titles.length, KEEP);
    assert.equal(titles[0], "Task number 2");
});

test("a task whose agent went quiet long ago is finished", () => {
    const { projects, work, ask, now } = town();

    ask("s", "Look into it");
    work("s", { s: "files", i: "a.ts" });
    projects.settle(now() + 60_000);
    assert.equal(only(projects)[0].state, "building");
    projects.settle(now() + 60 * 60_000);
    assert.equal(only(projects)[0].state, "done");
});

test("the style follows the kind of work that weighed most", () => {
    assert.equal(styleOf({ read: 9, write: 1 }), "study");
    assert.equal(styleOf({ write: 6, read: 4 }), "workshop");
    assert.equal(styleOf({ shell: 8, read: 3 }), "foundry");
    assert.equal(styleOf({ web: 5, read: 3 }), "lookout");
    assert.equal(styleOf({ git: 5, read: 2 }), "warehouse");
    assert.equal(styleOf({ mcp: 4, read: 2 }), "embassy");
    assert.equal(styleOf({ delegate: 3, read: 4 }), "council");
    assert.equal(styleOf({ artifact: 2, read: 2 }), "atelier");
    assert.equal(styleOf({ memory: 2, read: 1 }), "vault");
    assert.equal(styleOf({ read: 4, write: 3, shell: 3, git: 2, web: 2 }), "manor");
});

test("shell commands that only read count as reading, and their file is the stone", () => {
    const shell = (l: string) => ({ n: "bash", s: "shell", i: l.split(" ")[0], l });

    assert.equal(categoryOf(shell("cat agent-civilization/sites.js")), "read");
    assert.equal(categoryOf(shell("grep -n style test/sites.test.ts")), "read");
    assert.equal(categoryOf(shell("sed -n 1,40p town.js")), "read");
    assert.equal(categoryOf(shell("sed -i s/a/b/ README.md")), "write");
    assert.equal(categoryOf(shell("cat a.txt > b.txt")), "shell");
    assert.equal(categoryOf(shell("npm test")), "shell");
    assert.equal(fileOf("sed -n 1,40p town.js"), "town.js");
    assert.equal(
        fileOf("grep -n 'style' agent-civilization/sites.js | head -5"),
        "agent-civilization/sites.js",
    );
    assert.equal(fileOf("ls"), "ls");
    assert.equal(fileOf('grep -nEi "\\b(the the|a a)\\b" READ…'), "grep -nEi");

    const { projects, feed, work, ask } = town();

    ask("s", "Explain the styles");
    work("s", shell("cat agent-civilization/sites.js"));
    work("s", shell("sed -n 1,40p agent-civilization/sites.js"));
    work("s", shell("grep -n KEEP test/sites.test.ts"));
    feed({ k: "idle", c: "s" });

    const [project] = only(projects);

    assert.deepEqual(
        [...project.reads.keys()],
        ["agent-civilization/sites.js", "test/sites.test.ts"],
    );
    assert.equal(project.style, "study");
});

test("a title is the request's first sentence, without the markers of who sent it", () => {
    assert.equal(titleOf("[via PiP] Check the README. Then more."), "Check the README");
    assert.equal(titleOf("[scheduled] Daily report"), "Daily report");
    assert.equal(titleOf("\n\nFix it!\nNow"), "Fix it");
    assert.equal(titleOf(""), "A task");
    assert.ok(titleOf("x".repeat(200)).length <= 60);
});

test("two projects with the same work still look different", () => {
    const { projects, feed, work, ask, now } = town();
    const looks = new Set<string>();

    for (let index = 0; index < 6; index++) {
        ask("s", `Same work ${index}`);
        work("s", { n: "edit", s: "files", i: "a.ts", w: 1 });
        feed({ k: "idle", c: "s" });
        feed({ k: "pause", at: now() + 20 * 60_000 });
    }

    for (const project of only(projects)) {
        const plan = planOf(project);

        looks.add(`${plan.wall}|${plan.roofKind}|${plan.roof}|${plan.windowKind}|${plan.door}`);
    }

    assert.ok(looks.size >= 4, `only ${looks.size} looks`);
});
