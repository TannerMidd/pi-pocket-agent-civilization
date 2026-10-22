import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { Host, Web } from "../_pocket.d.ts";
import setup from "../agent-civilization.ts";

type Handler = (...args: never[]) => unknown;
type Route = (request: unknown) => unknown;

let dataDir = "";

beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "agent-civilization-"));
    // Each test starts a fresh world: no handover from the one before.
    forgetHandover();
});

/** Like a restart: the next module starts from its file, not from the one before it in this process. */
function forgetHandover() {
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("x.agent-civilization.state")];
}

afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
});

async function harness() {
    const routes = new Map<string, Route>();
    const sent: { event: string; data: unknown }[] = [];
    const disposers: (() => unknown)[] = [];
    let client = "";
    const web = {
        route: (method: string, path: string, handle: Route) =>
            routes.set(`${method} ${path}`, handle),
        conversationRoute: (
            method: string,
            path: string,
            handle: Route,
            options: { conversation: string },
        ) => {
            assert.equal(options.conversation, "source");
            routes.set(`${method} ${path}`, handle);
        },
        client: (entry: string) => {
            client = entry;
        },
        send: (event: string, data: unknown) => sent.push({ event, data }),
        onDispose: (run: () => unknown) => disposers.push(run),
    };
    const extension = (await setup({ dataDir } as Host, web as unknown as Web)) as unknown as {
        name: string;
        hooks: { handlers: Record<string, Handler> }[];
    };
    const handlers = Object.assign({}, ...extension.hooks.map((each) => each.handlers)) as Record<
        string,
        (...args: unknown[]) => unknown
    >;
    const api = (conversationId: string, taskId = `task-${conversationId}`) => ({
        conversationId,
        taskId,
        snapshot: async () => undefined,
    });
    const tool = (id: string, conversation: string, name: string, args: object) =>
        handlers.beforeTool!({ id, name, arguments: args }, api(conversation));
    const world = () =>
        routes.get("GET world")!({}) as {
            convs: Record<string, unknown>;
            events: Record<string, unknown>[];
            unknown: string[];
        };
    const meta = (id: string, title = "A session") =>
        routes.get("GET meta/:source")!({
            conversation: { id, title, cwd: "/work" },
            linkedSessions: { list: async () => [] },
        }) as Promise<{ events: unknown[] }>;
    const dispose = async () => {
        for (const run of disposers) {
            await run();
        }
    };

    return {
        extension,
        handlers,
        routes,
        sent,
        client: () => client,
        api,
        tool,
        world,
        meta,
        dispose,
    };
}

test("it adds its routes and its page, and names its extension", async () => {
    const town = await harness();

    assert.equal(town.extension.name, "agent-civilization");
    assert.deepEqual([...town.routes.keys()].sort(), [
        "GET meta/:source",
        "GET world",
        "POST reset",
    ]);
    assert.equal(town.client(), "agent-civilization");
    assert.deepEqual(Object.keys(town.handlers).sort(), [
        "afterResponse",
        "afterTool",
        "beforeRequest",
        "beforeTool",
        "onYield",
    ]);
    await town.dispose();
});

test("its hooks change no call, and never throw, whatever they are given", async () => {
    const town = await harness();
    const api = town.api("1");

    assert.equal(
        town.handlers.beforeTool!({ id: "a", name: "bash", arguments: { command: "ls" } }, api),
        undefined,
    );
    assert.equal(
        town.handlers.afterTool!({ id: "a", name: "bash" }, { isError: false }, api),
        undefined,
    );
    assert.equal(await town.handlers.beforeRequest!({ messages: [] }, api, {}), undefined);
    assert.equal(
        town.handlers.afterResponse!({ content: [], provider: "p", model: "m" }, api),
        undefined,
    );
    assert.equal(town.handlers.onYield!({ content: [] }, api), undefined);

    // Nonsense in: still nothing out, and nothing thrown (each hook logs its own error).
    const warn = console.warn;

    console.warn = () => {};

    try {
        for (const name of Object.keys(town.handlers)) {
            assert.doesNotThrow(() => town.handlers[name]!(null, null, null));
            assert.equal(await town.handlers[name]!(null, null, null), undefined);
        }
    } finally {
        console.warn = warn;
    }

    await town.dispose();
});

test("a session stays hidden until Pi Pocket confirms that the owner may see it", async () => {
    const town = await harness();

    town.tool("t1", "7", "read", { path: "/secret/plan.md" });
    town.tool("t2", "8", "read", { path: "/other/notes.md" });

    let world = town.world();

    assert.equal(world.events.length, 0);
    assert.deepEqual(Object.keys(world.convs), []);
    assert.deepEqual(world.unknown.sort(), ["7", "8"]);

    const answer = await town.meta("7");

    assert.ok(answer.events.length > 0);
    world = town.world();
    assert.deepEqual(Object.keys(world.convs), ["7"]);
    assert.ok(world.events.every((event) => event.c === "7"));
    assert.ok(world.events.some((event) => event.c === "7"));
    await town.dispose();
});

test("the file on disk keeps no words, paths, or titles of an unconfirmed session", async () => {
    const town = await harness();

    town.tool("t1", "7", "bash", { command: "cat /home/someone/private.txt" });
    town.tool("t2", "9", "read", { path: "/mine/readme.md" });
    await town.meta("9", "Mine");
    await town.dispose();

    const saved = JSON.parse(
        await readFile(join(dataDir, "agent-civilization", "world.json"), "utf8"),
    );
    const hidden = saved.events.filter((event: { c?: string }) => event.c === "7");

    assert.ok(hidden.length > 0);

    for (const event of hidden) {
        for (const field of ["text", "l", "i", "e", "name", "title", "tn"]) {
            assert.equal(event[field], undefined, `field ${field} of a hidden event was saved`);
        }
    }

    assert.ok(!JSON.stringify(saved).includes("private.txt"));
    assert.ok(JSON.stringify(saved).includes("readme.md"));
});

test("a subagent's name goes in its own field, never where a session id belongs", async () => {
    const town = await harness();

    await town.meta("3");
    town.tool("t1", "3", "subagent", { action: "spawn", name: "reviewer" });

    const event = town.world().events.find((each) => each.n === "subagent");

    assert.ok(event, "the subagent call shows");
    assert.equal(event.tn, "reviewer");
    assert.equal(event.to, undefined);
    await town.dispose();
});

test("a shell command's label drops its leading cd", async () => {
    const town = await harness();

    await town.meta("4");
    town.tool("t1", "4", "bash", { command: "cd /home/me/project && npm test" });

    const event = town.world().events.find((each) => each.k === "tool");

    assert.equal(event?.l, "npm test");
    assert.equal(event?.i, "npm");
    await town.dispose();
});

test("a model request is never held: the hook returns at once", async () => {
    const town = await harness();
    const result = town.handlers.beforeRequest!(
        { messages: [{ role: "user", content: "hi", timestamp: 1 }] },
        town.api("5"),
        {},
    );

    assert.equal(result, undefined);
    await town.dispose();
});

test("a call that runs twice in one process is counted once", async () => {
    const town = await harness();

    await town.meta("6");
    town.tool("same", "6", "read", { path: "a.md" });
    town.tool("same", "6", "read", { path: "a.md" });

    assert.equal(town.world().events.filter((event) => event.k === "tool").length, 1);
    await town.dispose();
});

test("matching words never show an unrelated conversation", async () => {
    const town = await harness();
    const text = "Please inspect these exact requirements before proceeding";

    await town.meta("1");
    town.tool("spawn", "1", "subagent", { action: "spawn", name: "reviewer", message: text });
    town.handlers.beforeRequest!(
        {
            messages: [
                { role: "user", content: `${text}\nPRIVATE OTHER PERSON DATA`, timestamp: 1 },
            ],
        },
        town.api("2"),
        {},
    );
    assert.equal(town.world().convs["2"], undefined);
    assert.ok(!JSON.stringify(town.world()).includes("PRIVATE OTHER PERSON DATA"));

    // The parent's own tool result names the child: now it shows.
    town.handlers.afterTool!(
        {
            id: "spawn",
            name: "subagent",
            arguments: { action: "spawn", name: "reviewer", message: text },
        },
        {
            isError: false,
            output: [],
            details: { conversationId: "2", name: "reviewer", action: "spawn" },
        },
        town.api("1"),
    );
    assert.ok(town.world().convs["2"]);
    await town.dispose();
});

test("a reset sends nothing from before it", async () => {
    const town = await harness();

    await town.meta("1");
    town.tool("old", "1", "read", { path: "/old-private-path.md" });
    await town.routes.get("POST reset")!({});
    await town.meta("1");
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(town.world().events.length, 0);
    assert.ok(!JSON.stringify(town.sent).includes("/old-private-path.md"));
    await town.dispose();
});

test("a call that runs again after a restart is counted once", async () => {
    const first = await harness();

    await first.meta("1");
    first.tool("same", "1", "read", { path: "a.md" });
    await first.dispose();
    forgetHandover();

    const reopened = await harness();

    reopened.tool("same", "1", "read", { path: "a.md" });
    assert.equal(reopened.world().events.filter((event) => event.k === "tool").length, 1);
    assert.equal((reopened.world().convs["1"] as { calls: number }).calls, 1);
    await reopened.dispose();
});

test("no name from outside reaches Object.prototype", async () => {
    const town = await harness();

    await town.meta("1");
    town.tool("p1", "1", "read", { path: "__proto__" });
    town.tool("p2", "1", "__proto__", {});
    town.handlers.beforeRequest!(
        { messages: [{ role: "user", content: "[from: __proto__] hello", timestamp: 7 }] },
        town.api("1"),
        {},
    );
    await town.dispose();

    const probe = {} as Record<string, unknown>;

    for (const field of ["n", "r", "w", "last", "count", "name"]) {
        assert.equal(probe[field], undefined, `Object.prototype.${field} was set`);
    }

    // And not after a restart from the file either.
    forgetHandover();
    await (await harness()).dispose();
    assert.equal(({} as Record<string, unknown>).last, undefined);
});

test("a burst goes out in batches small enough for the app, numbered in order", async () => {
    const town = await harness();

    await town.meta("1");

    for (let index = 0; index < 1500; index++) {
        town.tool(`c${index}`, "1", "read", { path: `src/${"deep/".repeat(12)}file-${index}.ts` });
    }

    await new Promise((resolve) => setTimeout(resolve, 2600));

    const batches = town.sent.filter((each) => each.event === "batch").map((each) => each.data);

    assert.ok(batches.length > 1);

    for (const batch of batches) {
        assert.ok(JSON.stringify(batch).length < 256 * 1024, "a batch is under 256 KiB");
    }

    const numbers = batches.map((batch) => (batch as { n: number }).n);

    assert.deepEqual(
        numbers,
        numbers.map((_, index) => numbers[0]! + index),
    );

    const events = batches.flatMap((batch) => (batch as { events: { k: string }[] }).events);

    assert.equal(events.filter((event) => event.k === "tool").length, 1500);
    await town.dispose();
});

test("what looks like a secret is masked before it is kept", async () => {
    const town = await harness();

    await town.meta("1");
    town.tool("s1", "1", "bash", {
        command: "curl -H 'Authorization: Bearer abcdef1234567890' https://x",
    });
    town.tool("s2", "1", "bash", {
        command: "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuv node run.js",
    });
    town.tool("s3", "1", "bash", {
        command: "git push https://ghp_abcdefghijklmnopqrstuvwxyz@github.com/x",
    });

    const kept = JSON.stringify(town.world());

    for (const secret of [
        "abcdef1234567890",
        "sk-abcdefghijklmnopqrstuv",
        "ghp_abcdefghijklmnopqrstuvwxyz",
    ]) {
        assert.ok(!kept.includes(secret), `${secret} was kept`);
    }

    await town.dispose();
});

// The formats below belong to Pi Pocket, not to this module, and can change in any release
// (api-stability.md, "What is internal"). These tests pin what Pi Pocket 0.19.0 sends.
test("Pi Pocket 0.19 formats: a person's name, a linked session, and a schedule", async () => {
    const town = await harness();

    await town.meta("1");
    await town.meta("2");
    town.handlers.beforeRequest!(
        { messages: [{ role: "user", content: "[from: Sam] can you look?", timestamp: 1 }] },
        town.api("1"),
        {},
    );
    town.tool("t1", "1", "team", {
        action: "start",
        title: "Docs",
        message: "Write the docs for the new limit please",
    });
    town.handlers.beforeRequest!(
        {
            messages: [
                {
                    role: "user",
                    content:
                        "Message from linked session Docs (address abc)\n<linked-session-message>\nWrite the docs for the new limit please\n</linked-session-message>",
                    timestamp: 2,
                },
            ],
        },
        town.api("2"),
        {},
    );
    town.handlers.beforeRequest!(
        { messages: [{ role: "user", content: "[scheduled] check the build", timestamp: 3 }] },
        town.api("1x"),
        {},
    );

    const world = town.world();
    const messages = world.events.filter((event) => event.k === "msg");

    assert.ok(messages.some((event) => event.from === "human:Sam" && event.to === "1"));
    assert.equal((world.convs["2"] as { parent?: string; kind: string }).parent, "1");
    assert.equal((world.convs["2"] as { kind: string }).kind, "linked");
    assert.ok(
        world.events.some((event) => event.k === "link" && event.c === "2" && event.p === "1"),
    );
    await town.dispose();
});
