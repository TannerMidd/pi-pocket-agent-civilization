// Building sites: every task an agent is given becomes a building that its own work puts up.
// A request opens a lot beside the agent's house. Each finished tool call adds the part it stands for: a file read
// lays a foundation stone, a file written raises a storey, a program run adds a chimney, a web host a mast, a git
// action a crate, an MCP server a flag, a helper a banner, and a failure a crack. When the task ends the scaffolding
// comes down and the building takes the style of what the work mostly was. Each house keeps its last few.

import { C, SHIRTS, disc, hash, px, rect, rng, shade } from "./pixels.js";

/** Finished buildings kept beside each house. */
export const KEEP = 6;
/** A storey's height, in pixels. */
const FLOOR = 7;

/** The ground a lot takes, for placing it and clearing the trees. */
export const LOT = { w: 50, h: 58 };
/** A task that goes quiet this long after its agent stopped is finished. */
const QUIET = 3 * 60_000;
/** Work that comes this soon after a task ended belongs to it still (a helper's report woke the agent). */
const REOPEN = 10 * 60_000;

/** What each kind of work adds, in words. */
export const PARTS = {
    read: { word: "stone", title: "Foundation stones", about: "files read" },
    write: { word: "storey", title: "Storeys", about: "files written" },
    shell: { word: "chimney", title: "Chimneys", about: "programs run" },
    git: { word: "crate", title: "Crates", about: "git and GitHub actions" },
    web: { word: "mast", title: "Mast pennants", about: "web hosts visited" },
    mcp: { word: "flag", title: "Flags", about: "MCP servers used" },
    artifact: { word: "easel", title: "Easels", about: "artifacts published" },
    memory: { word: "rune", title: "Runes", about: "memories kept" },
    delegate: { word: "banner", title: "Banners", about: "helpers who joined" },
    other: { word: "gear", title: "Gears", about: "other tools" },
    fail: { word: "crack", title: "Cracks", about: "failed calls" },
};

/** What a finished building becomes: the kind of work that weighed most. */
export const STYLES = {
    study: {
        name: "Study",
        about: "Mostly reading: it learned the code before it acted.",
        walls: ["stone", "plaster", "brick"],
        roofs: ["steep", "mansard"],
        colors: [C.navy, C.teal, C.plum, C.slate],
    },
    workshop: {
        name: "Workshop",
        about: "Mostly edits: it changed files.",
        walls: ["planks", "timber", "plaster"],
        roofs: ["gable", "hip"],
        colors: [C.red, C.teal, C.green, C.orange],
    },
    foundry: {
        name: "Foundry",
        about: "Mostly commands: it ran programs and tests.",
        walls: ["brick", "darkstone"],
        roofs: ["sawtooth", "flat"],
        colors: [C.slate, C.steel, C.dark],
    },
    lookout: {
        name: "Lookout",
        about: "Mostly the web: it looked things up.",
        walls: ["stone", "plaster"],
        roofs: ["hip", "gable"],
        colors: [C.blue, C.teal, C.red],
    },
    warehouse: {
        name: "Warehouse",
        about: "Mostly git: commits, branches, and pull requests.",
        walls: ["planks", "metal"],
        roofs: ["low", "barrel"],
        colors: [C.dark, C.steel, C.red],
    },
    council: {
        name: "Council hall",
        about: "Mostly delegation: helpers did much of the work.",
        walls: ["marble"],
        roofs: ["pediment"],
        colors: [C.white, C.sand, C.silver],
    },
    embassy: {
        name: "Trading post",
        about: "Mostly MCP servers: it dealt with other services.",
        walls: ["plaster", "planks"],
        roofs: ["hip", "gable"],
        colors: [C.orange, C.green, C.blue],
    },
    atelier: {
        name: "Atelier",
        about: "It published artifacts: pages, pictures, documents.",
        walls: ["plaster", "timber"],
        roofs: ["glass"],
        colors: [C.plum, C.pink, C.sky],
    },
    vault: {
        name: "Archive",
        about: "It kept memories for later.",
        walls: ["darkstone", "stone"],
        roofs: ["dome", "crenel"],
        colors: [C.teal, C.slate, C.plum],
    },
    manor: {
        name: "Manor",
        about: "A bit of everything.",
        walls: ["brick", "plaster", "timber", "planks"],
        roofs: ["hip", "gable", "mansard"],
        colors: [C.red, C.blue, C.green, C.plum, C.orange],
    },
};

const STYLE_OF = {
    read: "study",
    write: "workshop",
    shell: "foundry",
    web: "lookout",
    git: "warehouse",
    delegate: "council",
    mcp: "embassy",
    artifact: "atelier",
    memory: "vault",
    other: "manor",
};

/** How much one call of each kind weighs when the style is chosen. */
const WEIGHT = {
    read: 1,
    write: 1.6,
    shell: 1.3,
    web: 2,
    git: 1.8,
    delegate: 3,
    mcp: 1.8,
    artifact: 3,
    memory: 3,
    other: 1,
};

const WALLS = {
    stone: ["#9aa6b8", "#b4bfcc", "#8b8f9e"],
    darkstone: ["#566c86", "#4d5872", "#5e5a6e"],
    plaster: ["#e8d8b8", "#f0c8a8", "#d8e4c0", "#e4d0e8", "#f4e4a8"],
    timber: ["#efe0c0", "#e6d2b0"],
    brick: ["#b13e53", "#a8583a", "#c06848", "#8f4a3a"],
    planks: ["#d8a878", "#c08a58", "#a87850", "#b89a70"],
    metal: ["#94b0c2", "#7f8ea3"],
    marble: ["#e8eef4", "#f4f0e4"],
};

const PROPS = ["barrel", "flowers", "bench", "lamp", "fence", "well", "hay", "pot"];

/** The kind of work a tool call is. */
export function categoryOf(call) {
    if (call.n === "subagent" || call.n === "team") {
        return "delegate";
    }

    const sector = String(call.s ?? "");

    if (sector === "files") {
        return call.w ? "write" : "read";
    }

    if (sector === "shell") {
        return "shell";
    }

    if (sector === "github") {
        return "git";
    }

    if (sector === "web") {
        return "web";
    }

    if (sector.startsWith("mcp:")) {
        return "mcp";
    }

    if (sector === "artifact") {
        return "artifact";
    }

    if (sector === "memory") {
        return "memory";
    }

    return "other";
}

/** The first words of a request, without the markers that say who sent it. */
export function titleOf(text) {
    const line = String(text ?? "")
        .replace(/^(\s*\[[^\]]{1,80}\]\s*)+/, "")
        .split("\n")
        .map((each) => each.trim())
        .find((each) => each.length > 0);

    if (!line) {
        return "A task";
    }

    const sentence = line.match(/^.{12,}?[.!?](\s|$)/)?.[0]?.trim() ?? line;
    const words = sentence.replace(/[.!]+$/, "");

    return words.length > 60 ? `${words.slice(0, 59).trimEnd()}…` : words;
}

/** The style a project's work points to, and the share of the kind that won. */
export function styleOf(counts) {
    let total = 0;
    let best = "other";
    let most = -1;

    for (const [kind, weight] of Object.entries(WEIGHT)) {
        const score = (counts[kind] ?? 0) * weight;

        total += score;

        if (score > most) {
            most = score;
            best = kind;
        }
    }

    if (total <= 0) {
        return "manor";
    }

    // Spread over many kinds with no clear lead: a manor.
    if (most / total < 0.34 && total >= 8) {
        return "manor";
    }

    return STYLE_OF[best];
}

/** Every task as a project, from the events alone: the model, apart from any drawing. */
export class Projects {
    /**
     * @param {object} host: `convs()` the conversations, `nameOf(id)`, `colorOf(id)`, and optional `on(kind, project, part)`
     * for effects.
     */
    constructor(host) {
        this.host = host;
        this.clear();
    }

    clear() {
        this.all = new Map();
        this.open = new Map();
        this.calls = new Map();
        /** Each helper's task: the project it was given work for, until it gets other work. */
        this.assigned = new Map();
        this.version = 0;
    }

    /** The project an agent's work goes to: a helper's own task, else its owner's open one. */
    projectFor(id, event) {
        const owner = this.ownerOf(id);

        if (id !== owner) {
            // Its own task; else the work its owner does now; else the owner's latest, which it helps finish.
            const project =
                this.all.get(this.assigned.get(id)) ??
                this.open.get(owner) ??
                this.listOf(owner).at(-1);

            if (project) {
                this.assigned.set(id, project.id);

                return project;
            }
        }

        const project = this.ensure(owner, event);

        if (id !== owner) {
            this.assigned.set(id, project.id);
        }

        return project;
    }

    ownerOf(id) {
        const house = this.host.ownerOf?.(id);

        if (house) {
            return house;
        }

        const convs = this.host.convs();
        let at = id;
        const seen = new Set();

        while (convs[at]?.kind === "subagent" && convs[at].parent && !seen.has(at)) {
            seen.add(at);
            at = convs[at].parent;
        }

        return at;
    }

    listOf(owner) {
        return [...this.all.values()]
            .filter((project) => project.owner === owner)
            .sort((a, b) => a.start - b.start || a.seq - b.seq);
    }

    create(owner, event, title, asker) {
        const project = {
            id: `p${event.id}`,
            seq: event.id,
            owner,
            title,
            askers: asker ? [asker] : [],
            start: event.at,
            last: event.at,
            end: null,
            state: "building",
            calls: 0,
            fails: 0,
            cost: 0,
            counts: {},
            reads: new Map(),
            writes: new Map(),
            programs: new Map(),
            hosts: new Map(),
            servers: new Map(),
            helpers: new Map(),
            crates: [],
            extras: { artifact: [], memory: [], other: [] },
            failures: [],
            stones: [],
            busy: new Set([owner]),
            // A request waits for its agent: an idle that ends the turn before is not this task's end.
            begun: !asker,
            now: null,
            version: 0,
        };

        this.all.set(project.id, project);
        this.open.set(owner, project);
        this.version++;
        this.host.on?.("start", project);

        return project;
    }

    /** The open project of an owner; else its last one again, when the work goes on; else a new one. */
    ensure(owner, event) {
        const open = this.open.get(owner);

        if (open) {
            return open;
        }

        const last = this.listOf(owner).at(-1);

        if (last && last.end !== null && event.at - last.end < REOPEN && !last.closedByAsk) {
            last.state = "building";
            last.end = null;
            last.version++;
            this.open.set(owner, last);
            this.version++;
            this.host.on?.("reopen", last);

            return last;
        }

        const convs = this.host.convs();

        return this.create(
            owner,
            event,
            titleOf(convs[owner]?.title ?? this.host.nameOf(owner)),
            null,
        );
    }

    touch(project, id, event) {
        project.last = Math.max(project.last, event.at);
        project.busy.add(id);

        if (id === project.owner) {
            project.begun = true;
        }

        if (id !== project.owner && !project.helpers.has(id)) {
            this.helper(project, id, this.host.nameOf(id), this.host.colorOf(id));
        }
    }

    helper(project, id, name, color) {
        const key = name || id;

        for (const each of project.helpers.values()) {
            if (each.name === key) {
                if (id && !each.id) {
                    each.id = id;
                }

                return;
            }
        }

        project.helpers.set(id || `name:${key}`, { id, name: key, color });
        project.counts.delegate = (project.counts.delegate ?? 0) + 1;
        this.part(project, "delegate", key, color);
    }

    part(project, kind, label, color, sector) {
        project.version++;
        this.version++;
        this.host.on?.("part", project, { kind, label, color, s: sector });
    }

    feed(event) {
        switch (event.k) {
            case "msg":
                this.message(event);
                break;
            case "tool":
                this.tool(event);
                break;
            case "done":
                this.done(event);
                break;

            case "think": {
                const project = this.projectFor(event.c, event);

                this.touch(project, event.c, event);
                break;
            }

            case "reply": {
                const owner = this.ownerOf(event.c);
                const project =
                    event.c === owner
                        ? this.open.get(owner)
                        : this.all.get(this.assigned.get(event.c));

                if (project && Number.isFinite(event.cost)) {
                    project.cost += Number(event.cost);
                }

                break;
            }

            case "idle":
                this.idle(event);
                break;
            default:
                break;
        }
    }

    message(event) {
        const to = event.to;

        if (typeof to !== "string") {
            return;
        }

        const convs = this.host.convs();
        const owner = this.ownerOf(to);
        const from = typeof event.from === "string" ? event.from : "";

        // A helper given work: it joins its owner's project.
        if (owner !== to) {
            const project = this.ensure(owner, event);

            this.assigned.set(to, project.id);
            this.touch(project, to, event);

            return;
        }

        // A report or answer from a helper or a linked session: the same work goes on.
        const fromChild = from !== "" && convs[from]?.parent === to;

        if (event.via === "report" || event.via === "stop" || fromChild) {
            const project = this.ensure(owner, event);

            project.last = Math.max(project.last, event.at);
            project.busy.add(owner);

            return;
        }

        const asker = from.startsWith("human:")
            ? from.slice(6)
            : from === "station:schedule"
              ? "a schedule"
              : from === "station:github"
                ? "GitHub"
                : from
                  ? this.host.nameOf(from)
                  : "someone";
        const open = this.open.get(owner);

        // A word while the agent works joins that work.
        if (open?.busy.has(owner)) {
            if (!open.askers.includes(asker)) {
                open.askers.push(asker);
            }

            open.last = Math.max(open.last, event.at);

            return;
        }

        // The agent had answered: what its helpers still do ends with that task, and this is a new one.
        if (open) {
            this.finish(open, event.at);
        }

        const last = this.listOf(owner).at(-1);

        if (last) {
            last.closedByAsk = true;
        }

        this.create(owner, event, titleOf(event.text), asker);
    }

    tool(event) {
        const project = this.projectFor(event.c, event);

        this.touch(project, event.c, event);
        this.calls.set(event.call, {
            p: project.id,
            c: event.c,
            n: event.n,
            s: event.s,
            i: event.i,
            l: event.l,
            w: event.w,
            a: event.a,
            tn: event.tn,
        });

        // Old calls that never finished: forget them, oldest first.
        if (this.calls.size > 400) {
            this.calls.delete(this.calls.keys().next().value);
        }

        project.now = { label: String(event.l || event.n || ""), at: event.at, done: false };
        project.version++;
    }

    done(event) {
        const call = this.calls.get(event.call);

        if (!call) {
            return;
        }

        this.calls.delete(event.call);

        const project = this.all.get(call.p);

        if (!project) {
            return;
        }

        const kind = categoryOf(call);
        const by = call.c;
        const color = by === project.owner ? null : this.host.colorOf(by);

        project.calls++;
        project.last = Math.max(project.last, event.at);
        project.version++;
        this.version++;

        if (!event.ok) {
            project.fails++;
            project.failures.push(String(call.l || call.n));
            project.now = { label: `${call.l || call.n} failed`, at: event.at, done: true };
            this.host.on?.("part", project, { kind: "fail", label: call.l || call.n, s: call.s });

            return;
        }

        // A helper counts once, when it joins (below), not for each call that gives it work.
        if (kind !== "delegate") {
            project.counts[kind] = (project.counts[kind] ?? 0) + 1;
        }

        const item = String(call.i || call.l || call.n);

        const add = (map, key) => {
            const fresh = !map.has(key);

            map.set(key, (map.get(key) ?? 0) + 1);

            return fresh;
        };

        let added = null;

        switch (kind) {
            case "read":
                if (add(project.reads, item)) {
                    project.stones.push(color);
                    added = item;
                }

                break;
            case "write":
                if (add(project.writes, item)) {
                    added = item;
                }

                break;
            case "shell":
                if (add(project.programs, String(call.l || item)) && project.programs.size <= 2) {
                    added = String(call.l || item);
                }

                break;
            case "git":
                project.crates.push(String(call.l || item));
                added = String(call.l || item);
                break;
            case "web":
                if (add(project.hosts, item)) {
                    added = item;
                }

                break;

            case "mcp": {
                const server = String(call.s).slice(4) || "?";

                if (add(project.servers, server)) {
                    added = server;
                }

                break;
            }

            case "delegate":
                if (["spawn", "start", "send"].includes(String(call.a)) && call.tn) {
                    this.helper(project, null, String(call.tn), null);
                }

                break;
            default:
                project.extras[kind].push(String(call.l || item));
                added = String(call.l || item);
                break;
        }

        project.now = {
            label: added ? `+ ${PARTS[kind].word}: ${added}` : String(call.l || call.n),
            at: event.at,
            done: true,
        };

        if (added && kind !== "delegate") {
            this.part(project, kind, added, color, call.s);
        }
    }

    idle(event) {
        const owner = this.ownerOf(event.c);
        const project =
            event.c === owner ? this.open.get(owner) : this.all.get(this.assigned.get(event.c));

        if (!project || (event.c === owner && !project.begun)) {
            return;
        }

        project.busy.delete(event.c);
        project.last = Math.max(project.last, event.at);

        // The agent stopped and none of its helpers works on: done, unless a report wakes it again.
        if (event.c === owner && project.busy.size === 0 && this.open.get(owner) === project) {
            this.finish(project, event.at);
        }
    }

    finish(project, at) {
        this.open.delete(project.owner);
        project.end = at;
        project.busy.clear();
        project.state = project.fails >= 3 && project.fails > project.calls * 0.4 ? "ruin" : "done";
        project.style = styleOf(project.counts);
        project.version++;
        this.version++;

        // A word answered without a tool: nothing was built.
        if (project.calls === 0 && project.helpers.size === 0) {
            this.forget(project);
            this.host.on?.("drop", project);

            return;
        }

        this.host.on?.("finish", project);

        // Only the newest few stay: the oldest come down.
        const done = this.listOf(project.owner).filter((each) => each.end !== null);

        for (const old of done.slice(0, Math.max(0, done.length - KEEP))) {
            this.forget(old);
            this.host.on?.("drop", old);
        }
    }

    forget(project) {
        this.all.delete(project.id);

        for (const [helper, id] of this.assigned) {
            if (id === project.id) {
                this.assigned.delete(helper);
            }
        }
    }

    /** Tasks whose agent went quiet long ago are finished. */
    settle(now) {
        const pending = new Set([...this.calls.values()].map((call) => call.p));

        for (const project of [...this.open.values()]) {
            const quiet = now - project.last;

            // A call still running keeps its site open; only one forgotten for hours does not.
            if (pending.has(project.id) && quiet < QUIET * 40) {
                continue;
            }

            if (
                (project.busy.size === 0 && quiet > QUIET) ||
                (!project.busy.has(project.owner) && quiet > QUIET * 3) ||
                quiet > QUIET * 10
            ) {
                this.finish(project, project.last);
            }
        }
    }
}

/** What a project looks like now: its size, style, and parts, from its counts and a seed of its own. */
export function planOf(project) {
    if (project.plan && project.plan.version === project.version) {
        return project.plan;
    }

    const seed = hash(`${project.id}:${project.title}`);
    const random = rng(seed);
    const pick = (list) => list[Math.floor(random() * list.length) % list.length];
    const done = project.state !== "building";
    const styleKey = done ? (project.style ?? styleOf(project.counts)) : styleOf(project.counts);
    const style = STYLES[styleKey];
    const wallKind = pick(style.walls);
    const reads = project.reads.size;
    const big = project.calls >= 30 || reads + project.writes.size >= 14 || styleKey === "lookout";
    const plan = {
        version: project.version,
        seed,
        done,
        ruin: project.state === "ruin",
        style: styleKey,
        wallKind,
        wall: pick(WALLS[wallKind]),
        roofKind: pick(style.roofs),
        roof: pick(style.colors),
        trim: pick([C.white, C.gold, C.dark, C.cyan, C.pink]),
        windowKind: pick(["square", "arched", "shutters", "tall"]),
        shutter: pick(SHIRTS),
        door: pick([C.brown, C.dark, C.red, C.teal, C.navy]),
        props: [pick(PROPS), pick(PROPS)].filter(
            (each, index, list) => list.indexOf(each) === index,
        ),
        easels: Math.min(2, project.extras.artifact.length),
        propSide: random() < 0.5 ? -1 : 1,
        w: Math.min(32, 20 + 2 * Math.min(6, reads)),
        floors: Math.min(4, project.writes.size),
        stones: project.stones.slice(0, 8),
        stoneCount: Math.min(8, reads),
        chimneys: Math.min(2, project.programs.size),
        crates: Math.min(6, project.crates.length),
        hosts: Math.min(4, project.hosts.size),
        flags: [...project.servers.keys()]
            .slice(0, 3)
            .map((name) => SHIRTS[hash(name) % SHIRTS.length]),
        banners: [...project.helpers.values()]
            .slice(0, 3)
            .map((each) => each.color ?? SHIRTS[hash(each.name) % SHIRTS.length]),
        runes: Math.min(3, project.extras.memory.length),
        gears: Math.min(2, project.extras.other.length),
        cracks: Math.min(6, project.fails),
        tower: big,
    };

    if (done) {
        plan.floors = Math.max(1, plan.floors);
    }

    // The yard holds what fits beside the building: easels first, then props of its own.
    plan.props = plan.props.slice(0, Math.max(0, (plan.w > 26 ? 1 : 2) - plan.easels));

    plan.w -= plan.w % 2;
    project.plan = plan;

    return plan;
}

// ——— drawing ———

function shadow(c, x, y, w) {
    c.fillStyle = "rgba(16,14,40,0.25)";
    c.fillRect(x - w / 2 + 1, y - 1, w + 4, 3);
}

/** A wall of one material, w × h, its top-left at (x, y). */
function wall(c, kind, color, x, y, w, h) {
    rect(c, x, y, w, h, color);

    const dark = shade(color, -0.16);

    switch (kind) {
        case "brick":
            for (let row = 0; row < h; row += 3) {
                rect(c, x, y + row, w, 1, dark);

                for (let column = (row / 3) % 2 ? 2 : 5; column < w; column += 6) {
                    rect(c, x + column, y + row, 1, 3, dark);
                }
            }

            break;
        case "stone":
        case "darkstone":
            for (let row = 0; row < h; row += 4) {
                rect(c, x, y + row, w, 1, dark);

                for (let column = (row / 4) % 2 ? 3 : 7; column < w; column += 8) {
                    rect(c, x + column, y + row, 1, 4, dark);
                }
            }

            break;
        case "planks":
            for (let row = 2; row < h; row += 3) {
                rect(c, x, y + row, w, 1, dark);
            }

            break;
        case "metal":
            for (let column = 1; column < w; column += 3) {
                rect(c, x + column, y, 1, h, dark);
            }

            break;
        case "timber":
            rect(c, x, y, w, 1, C.dark);
            rect(c, x, y, 1, h, C.dark);
            rect(c, x + w - 1, y, 1, h, C.dark);

            for (let column = 6; column < w - 3; column += 7) {
                rect(c, x + column, y, 1, h, C.dark);
            }

            break;
        case "marble":
            for (let column = 2; column < w - 1; column += 5) {
                rect(c, x + column, y + 1, 1, h - 1, shade(color, -0.1));
            }

            break;
        default:
            break;
    }

    rect(c, x, y + h - 1, w, 1, shade(color, -0.32));
}

function windowAt(c, plan, x, y, lit, top) {
    const glass = lit ? C.gold : C.navy;
    const shine = lit ? C.white : C.sky;

    if (plan.windowKind === "arched" || (top && plan.style === "study")) {
        rect(c, x - 1, y - 1, 5, 6, C.dark);
        rect(c, x, y, 3, 4, glass);
        px(c, x - 1, y - 1, plan.wall);
        px(c, x + 3, y - 1, plan.wall);
        px(c, x + 1, y - 1, C.dark);
        px(c, x, y, shine);
    } else if (plan.windowKind === "tall") {
        rect(c, x - 1, y - 1, 4, 6, C.dark);
        rect(c, x, y, 2, 4, glass);
        px(c, x, y, shine);
    } else {
        rect(c, x - 1, y - 1, 5, 5, C.dark);
        rect(c, x, y, 3, 3, glass);
        px(c, x, y, shine);

        if (plan.windowKind === "shutters") {
            rect(c, x - 2, y - 1, 1, 5, plan.shutter);
            rect(c, x + 4, y - 1, 1, 5, plan.shutter);
        }
    }
}

function roofOf(c, plan, cx, base, w) {
    const color = plan.roof;
    const dark = shade(color, -0.3);
    const light = shade(color, 0.22);
    const half = w / 2 + 2;

    const slope = (height, flat = 0) => {
        for (let row = 0; row < height; row++) {
            const span = Math.round(flat + ((half - flat) * (row + 1)) / height);
            const y = base - height + row;

            rect(c, cx - span, y, span * 2, 1, row % 3 === 2 ? shade(color, -0.1) : color);
            px(c, cx - span, y, dark);
            px(c, cx + span - 1, y, dark);

            if (row % 2 === 0 && span > 3) {
                px(c, cx - Math.floor(span / 2), y, light);
            }
        }

        rect(c, cx - half, base - 1, half * 2, 1, dark);
    };

    switch (plan.roofKind) {
        case "steep":
            slope(Math.round(half * 0.95));
            px(c, cx, base - Math.round(half * 0.95) - 1, plan.trim);
            disc(c, cx, base - Math.round(half * 0.45), 1, plan.trim);
            break;
        case "gable":
            slope(Math.round(half * 0.6));
            break;
        case "low":
            slope(Math.round(half * 0.35) + 1);
            // A hoist: a beam out of the gable, a rope, and a hook.
            rect(c, cx - 1, base - Math.round(half * 0.35) - 2, 7, 1, C.dark);
            rect(c, cx + 5, base - Math.round(half * 0.35) - 1, 1, 6, C.silver);
            px(c, cx + 4, base - Math.round(half * 0.35) + 5, C.silver);
            break;
        case "hip":
            slope(Math.round(half * 0.45), Math.round(half * 0.45));
            break;
        case "mansard":
            slope(4, half - 3);
            rect(c, cx - half + 4, base - 7, half * 2 - 8, 3, dark);
            windowAt(c, plan, cx - 1, base - 3, false, true);
            break;
        case "barrel":
            for (let row = 0; row < 6; row++) {
                const span = Math.round(half * Math.sqrt(1 - ((5 - row) / 6) ** 2));

                rect(
                    c,
                    cx - span,
                    base - 6 + row,
                    span * 2,
                    1,
                    row % 2 ? color : shade(color, 0.1),
                );
            }

            rect(c, cx - half, base - 1, half * 2, 1, dark);
            break;

        case "sawtooth": {
            const teeth = Math.max(2, Math.floor((half * 2) / 8));
            const step = Math.floor((half * 2) / teeth);

            for (let tooth = 0; tooth < teeth; tooth++) {
                const x0 = cx - half + tooth * step;

                for (let row = 0; row < 6; row++) {
                    rect(c, x0 + row, base - 6 + row, step - row, 1, row === 5 ? dark : color);
                }

                rect(c, x0, base - 6, 1, 6, C.cyan);
                px(c, x0, base - 6, C.white);
            }

            break;
        }

        case "flat":
            rect(c, cx - half, base - 3, half * 2, 3, color);
            rect(c, cx - half, base - 3, half * 2, 1, light);
            rect(c, cx - half, base - 1, half * 2, 1, dark);
            break;
        case "crenel":
            rect(c, cx - half, base - 3, half * 2, 3, plan.wall);
            rect(c, cx - half, base - 1, half * 2, 1, shade(plan.wall, -0.3));

            for (let x = cx - half; x < cx + half - 1; x += 4) {
                rect(c, x, base - 5, 2, 2, plan.wall);
            }

            break;

        case "dome": {
            const r = Math.min(8, half - 4);

            for (let dy = -r; dy <= 0; dy++) {
                const span = Math.round(Math.sqrt(r * r - dy * dy));

                rect(
                    c,
                    cx - span,
                    base - 1 + dy,
                    span * 2 + 1,
                    1,
                    dy % 3 === 0 ? shade(color, -0.1) : color,
                );
            }

            rect(c, cx - half, base - 1, half * 2, 2, dark);
            px(c, cx - 3, base - 5, light);
            px(c, cx - 2, base - 6, light);
            rect(c, cx, base - r - 4, 1, 3, plan.trim);
            break;
        }

        case "pediment":
            slope(5);
            rect(c, cx - half, base - 1, half * 2, 1, C.silver);
            px(c, cx, base - 3, C.gold);
            break;
        case "glass":
            for (let row = 0; row < 6; row++) {
                const span = Math.round(3 + ((half - 3) * (row + 1)) / 6);

                rect(c, cx - span, base - 6 + row, span * 2, 1, row % 2 ? C.cyan : C.sky);
                px(c, cx - span, base - 6 + row, C.dark);
                px(c, cx + span - 1, base - 6 + row, C.dark);
            }

            for (let x = cx - half + 4; x < cx + half - 2; x += 5) {
                rect(c, x, base - 5, 1, 5, C.dark);
            }

            rect(c, cx - half, base - 1, half * 2, 1, C.dark);
            break;
        default:
            slope(Math.round(half * 0.6));
    }
}

/** How tall a roof stands over the walls. */
function roofHeight(plan) {
    const half = plan.w / 2 + 2;

    return (
        {
            steep: Math.round(half * 0.95),
            gable: Math.round(half * 0.6),
            low: Math.round(half * 0.35) + 1,
            hip: Math.round(half * 0.45),
            mansard: 7,
            barrel: 6,
            sawtooth: 6,
            flat: 3,
            crenel: 5,
            dome: Math.min(8, half - 4) + 4,
            pediment: 5,
            glass: 6,
        }[plan.roofKind] ?? 8
    );
}

/** How high a finished roof stands over the top of the walls, at dx from the middle. */
function roofAt(plan, dx) {
    const h = roofHeight(plan);
    const half = plan.w / 2 + 2;
    const off = Math.abs(dx);

    switch (plan.roofKind) {
        case "steep":
        case "gable":
        case "low":
        case "pediment":
        case "glass":
            return Math.max(1, Math.round(h * (1 - off / half)));

        case "hip": {
            const flat = Math.round(half * 0.45);

            return Math.max(
                1,
                Math.min(h, Math.round((h * (half - off)) / Math.max(1, half - flat))),
            );
        }

        case "mansard":
            return off < half - 3 ? h : 2;
        case "barrel":
            return Math.max(1, Math.round(6 * Math.sqrt(Math.max(0, 1 - (off / half) ** 2))));

        case "dome": {
            const r = Math.min(8, half - 4);

            return off <= r ? Math.max(1, Math.round(Math.sqrt(r * r - off * off))) : 1;
        }

        default:
            return h;
    }
}

function prop(c, kind, x, y, t) {
    switch (kind) {
        case "barrel":
            rect(c, x - 2, y - 5, 5, 5, C.brown);
            rect(c, x - 2, y - 4, 5, 1, C.dark);
            rect(c, x - 2, y - 2, 5, 1, C.dark);
            break;
        case "flowers":
            rect(c, x - 3, y - 2, 7, 2, C.dark);

            for (let i = 0; i < 4; i++) {
                px(c, x - 3 + i * 2, y - 3, [C.pink, C.gold, C.white, C.red][i]);
            }

            break;
        case "bench":
            rect(c, x - 3, y - 3, 7, 1, C.brown);
            px(c, x - 3, y - 2, C.dark);
            px(c, x + 3, y - 2, C.dark);
            break;
        case "lamp":
            rect(c, x, y - 9, 1, 9, C.slate);
            rect(c, x - 1, y - 11, 3, 2, C.gold);
            break;
        case "fence":
            for (let i = 0; i < 4; i++) {
                rect(c, x - 4 + i * 3, y - 4, 1, 4, C.sand);
            }

            rect(c, x - 4, y - 3, 10, 1, C.sand);
            break;
        case "well":
            rect(c, x - 3, y - 4, 7, 4, C.stone2);
            rect(c, x - 2, y - 4, 5, 1, C.water);
            rect(c, x - 3, y - 9, 1, 5, C.dark);
            rect(c, x + 3, y - 9, 1, 5, C.dark);
            rect(c, x - 4, y - 10, 9, 1, C.red);
            break;
        case "hay":
            disc(c, x, y - 3, 3, C.gold);
            rect(c, x - 3, y - 1, 7, 1, shade(C.gold, -0.3));
            break;
        case "pot":
            rect(c, x - 1, y - 3, 3, 3, C.orange);
            px(c, x, y - 5 - Math.round(Math.sin(t) * 0.4), C.leaf3);
            px(c, x - 1, y - 4, C.leaf2);
            px(c, x + 1, y - 4, C.leaf2);
            break;
        default:
            break;
    }
}

/**
 * A project at (x, y), the middle of its front at ground level. `o`: t (seconds), lit (windows aglow), rise (how
 * many storeys stand, while they go up).
 */
export function drawSite(c, plan, x, y, o = {}) {
    const t = o.t ?? 0;
    const w = plan.w;
    const half = w / 2;
    const left = x - half;
    const floors = o.rise ?? plan.floors;
    const building = !plan.done;
    const lit = !!o.lit && !plan.ruin;

    shadow(c, x, y, w + 4);

    // The lot: trodden ground.
    rect(c, left - 4, y - 1, w + 8, 3, C.dirt2);
    rect(c, left - 3, y - 1, w + 6, 1, shade(C.dirt, -0.05));

    // Foundation stones: one for each file read; a helper's in its colour.
    const plinth = 3;

    if (plan.stoneCount === 0) {
        rect(c, left, y - plinth, w, plinth, building ? shade(C.dirt2, -0.25) : C.stone2);
    } else {
        const each = Math.floor(w / plan.stoneCount);

        for (let i = 0; i < plan.stoneCount; i++) {
            const x0 = left + i * each;
            const width = i === plan.stoneCount - 1 ? w - i * each : each;
            const tint = plan.stones[i];
            const color = tint ? shade(tint, 0.15) : i % 2 ? C.stone : shade(C.stone, -0.08);

            rect(c, x0, y - plinth, width, plinth, color);
            rect(c, x0, y - plinth, width, 1, shade(color, 0.2));
            rect(c, x0 + width - 1, y - plinth, 1, plinth, shade(color, -0.35));
        }
    }

    rect(c, left, y - 1, w, 1, shade(C.stone2, -0.3));

    // Storeys: one for each file written. While it is built, a frame of beams and boards.
    const base = y - plinth;
    const whole = Math.floor(floors);
    const count = Math.ceil(floors - 0.001);

    for (let i = 0; i < count; i++) {
        const height = i < whole ? FLOOR : Math.max(1, Math.round((floors - whole) * FLOOR));
        const top = base - i * FLOOR - height;

        // A ruin's top storey ends in a broken edge.
        const broken = plan.ruin && i === count - 1;

        if (broken) {
            const fall = rng(plan.seed ^ 13);

            c.save();
            c.beginPath();

            for (let column = 0; column < w; column += 2) {
                const bite = Math.round(fall() * 5);

                c.rect(left + column, top + bite, 2, height - bite);
            }

            c.clip();
        }

        if (building) {
            rect(c, left, top, w, height, C.sand);

            for (let row = 2; row < height; row += 3) {
                rect(c, left, top + row, w, 1, shade(C.sand, -0.12));
            }

            for (let column = 0; column < w; column += 6) {
                rect(c, left + column, top, 1, height, C.brown);
            }

            rect(c, left + w - 1, top, 1, height, C.brown);
            rect(c, left, top, w, 1, C.brown);
        } else {
            wall(c, plan.wallKind, plan.wall, left, top, w, height);
        }

        if (height === FLOOR) {
            const panes = Math.max(1, Math.floor((w - 4) / 9));
            const gap = w / (panes + 1);

            for (let pane = 1; pane <= panes; pane++) {
                const wx = Math.round(left + gap * pane - 1);

                // The ground floor keeps its middle for the door.
                if (i === 0 && Math.abs(wx + 1 - x) < 5) {
                    continue;
                }

                if (building) {
                    rect(c, wx, top + 2, 3, 3, C.dark);
                } else {
                    // At night most windows glow, not all.
                    const on = lit && ((plan.seed >>> ((i * 3 + pane) % 24)) & 3) !== 0;

                    windowAt(c, plan, wx, top + 2, on, i === count - 1);
                }
            }
        }

        if (broken) {
            c.restore();
        }
    }

    const wallTop = base - floors * FLOOR;

    // Nothing stands yet: the bare frame of the first storey.
    if (building && floors < 1) {
        const top = base - FLOOR;

        for (let column = 0; column < w; column += 8) {
            rect(c, left + column, top, 1, FLOOR, C.brown);
        }

        rect(c, left + w - 1, top, 1, FLOOR, C.brown);
        rect(c, left, top, w, 1, C.brown);
    }

    // The door.
    if (count > 0) {
        if (building) {
            rect(c, x - 2, base - 6, 4, 6, C.dark);
        } else if (plan.style === "warehouse") {
            rect(c, x - 4, base - 6, 8, 6, C.dark);

            for (let row = 0; row < 5; row += 2) {
                rect(c, x - 3, base - 5 + row, 6, 1, shade(plan.door, 0.1));
            }
        } else if (plan.style === "foundry") {
            rect(c, x - 3, base - 6, 6, 6, C.dark);
            rect(c, x - 2, base - 5, 4, 5, lit || o.glow ? C.orange : "#3a1a10");
            px(c, x - 1, base - 3, C.gold);
        } else if (plan.style === "council") {
            rect(c, x - 3, base - 6, 6, 6, C.dark);
            rect(c, x - 2, base - 5, 4, 5, plan.door);
            rect(c, x - 2, base - 6, 4, 1, C.gold);
        } else {
            rect(c, x - 2, base - 6, 5, 6, C.dark);
            rect(c, x - 1, base - 5, 3, 5, plan.door);
            px(c, x + 1, base - 3, C.gold);
        }
    }

    // A tower for the big jobs: the style's own top.
    const towerX = x + half - 5;
    const towerTop = wallTop - 10;

    if (plan.tower && !building) {
        wall(
            c,
            plan.wallKind,
            shade(plan.wall, -0.06),
            towerX - 3,
            towerTop,
            8,
            wallTop - towerTop + 1,
        );
        windowAt(c, plan, towerX, towerTop + 3, lit, true);

        if (plan.style === "lookout" || plan.style === "study") {
            for (let row = 0; row < 8; row++) {
                const span = Math.floor(row / 2) + 1;

                rect(c, towerX + 1 - span, towerTop - 8 + row, span * 2, 1, plan.roof);
            }
        } else if (plan.style === "vault" || plan.style === "council") {
            disc(c, towerX + 1, towerTop, 4, plan.roof);
            rect(c, towerX - 3, towerTop, 9, 1, shade(plan.roof, -0.3));
        } else {
            for (let i = 0; i < 3; i++) {
                rect(c, towerX - 3 + i * 3, towerTop - 2, 2, 2, shade(plan.wall, -0.06));
            }
        }
    }

    // The roof, once the work is done; a ruin's lies broken.
    if (!building && !plan.ruin) {
        roofOf(c, plan, x, wallTop + 1, w);
    }

    const roofTop = building || plan.ruin ? wallTop : wallTop - roofHeight(plan);

    // Columns before a council hall.
    if (!building && plan.style === "council") {
        for (let column = left + 2; column < x + half - 1; column += 6) {
            if (Math.abs(column - x) > 3) {
                rect(c, column, wallTop + 1, 2, base - wallTop - 1, C.white);
                px(c, column + 1, wallTop + 2, C.silver);
            }
        }

        rect(c, left - 2, y - 1, w + 4, 1, C.silver);
    }

    // An awning over a trading post's door.
    if (!building && plan.style === "embassy") {
        for (let i = 0; i < 10; i++) {
            rect(c, x - 5 + i, base - 9, 1, 3, i % 2 ? C.white : plan.roof);
        }
    }

    // Book sign of a study; saw of a workshop.
    if (!building && plan.style === "study") {
        rect(c, x + 4, base - 8, 4, 3, C.red);
        px(c, x + 6, base - 8, C.white);
    } else if (!building && plan.style === "workshop") {
        rect(c, x - 9, base - 9, 5, 1, C.silver);
        rect(c, x - 4, base - 10, 1, 3, C.dark);
    }

    // Chimneys: one for each program run (two at most); smoking while the work goes on.
    for (let i = 0; i < plan.chimneys; i++) {
        const cx = i === 0 ? x + half - 7 : left + 4;
        // It stands on the roof just under it, and shows a few pixels over it.
        const surface = building || plan.ruin ? wallTop : wallTop + 1 - roofAt(plan, cx + 2 - x);
        const top = surface - (plan.style === "foundry" ? 8 : 5) - i * 2;

        rect(c, cx, top, 4, surface - top + 1, plan.style === "foundry" ? C.red : C.stone2);
        rect(c, cx - 1, top, 6, 1, C.slate);

        if (building || plan.style === "foundry") {
            const drift = ((t * 6 + i * 3) % 9) | 0;

            c.globalAlpha = 0.6;
            disc(c, cx + 2 + (drift >> 2), top - 2 - drift, 1 + (drift > 5 ? 1 : 0), C.silver);
            c.globalAlpha = 1;
        }
    }

    // A mast for the web: a pennant for each host.
    if (plan.hosts > 0) {
        const mx = left + 2;
        const top = roofTop - 10;

        rect(c, mx, top, 1, wallTop - top + 2, C.dark);

        for (let i = 0; i < plan.hosts; i++) {
            const wave = Math.round(Math.sin(t * 4 + i) * 0.6);

            rect(c, mx + 1, top + 1 + i * 3, 4 + wave, 2, [C.sky, C.gold, C.lime, C.pink][i]);
        }

        if (plan.style === "lookout" && !building) {
            rect(c, mx - 2, top - 1, 4, 2, C.gold);
            px(c, mx + 2, top - 1, C.cyan);
        }
    }

    // Flags of the MCP servers, on the roof.
    plan.flags.forEach((color, i) => {
        const fx = x - 4 + i * 5;
        const top = roofTop - 7;

        rect(c, fx, top, 1, 7, C.dark);
        rect(c, fx + 1, top, 3 + Math.round(Math.sin(t * 5 + i)), 2, color);
    });

    // Banners of the helpers, down the front of the top storey.
    if (count > 0) {
        plan.banners.forEach((color, i) => {
            const bx =
                left + 3 + i * Math.max(5, Math.floor((w - 8) / Math.max(1, plan.banners.length)));
            const top = wallTop + 1;

            rect(c, bx, top, 3, 5, color);
            px(c, bx + 1, top + 4, plan.done ? plan.wall : C.sand);
            rect(c, bx - 1, top, 5, 1, C.gold);
        });
    }

    // Runes of memory, glowing on the wall.
    for (let i = 0; i < plan.runes && count > 0; i++) {
        const rx = left + 3 + i * 4;
        const ry = base - 4;
        const glow = 0.6 + Math.sin(t * 3 + i) * 0.4;

        c.globalAlpha = glow;
        px(c, rx, ry, C.cyan);
        px(c, rx + 1, ry - 1, C.cyan);
        px(c, rx, ry - 2, C.cyan);
        c.globalAlpha = 1;
    }

    // Gears for other tools: a sign by the door.
    for (let i = 0; i < plan.gears && count > 0; i++) {
        const gx = x - 7 - i * 5;
        const gy = base - 9;

        disc(c, gx, gy, 2, C.silver);
        px(c, gx, gy, C.slate);
    }

    // Cracks: one for each failed call.
    const crack = rng(plan.seed ^ 77);

    for (let i = 0; i < plan.cracks && count > 0; i++) {
        let cx = Math.round(left + 2 + crack() * (w - 4));
        let cy = Math.round(base - 1 - crack() * Math.max(2, floors * FLOOR - 4));

        for (let step = 0; step < 4; step++) {
            px(c, cx, cy, C.ink);
            cx += crack() < 0.5 ? -1 : 1;
            cy -= 1;
        }
    }

    // Yard: crates of git, easels of artifacts, and props of its own.
    const side = plan.propSide;
    const yard = side > 0 ? x + half + 3 : left - 9;

    for (let i = 0; i < plan.crates; i++) {
        const cx = yard + (i % 3) * 3 * side + (side > 0 ? 0 : 3);
        const cy = y - 4 - Math.floor(i / 3) * 4;

        rect(c, cx, cy, 4, 4, C.brown);
        rect(c, cx, cy, 4, 1, C.tan);
        px(c, cx + 1, cy + 2, C.dark);
    }

    for (let i = 0; i < plan.easels; i++) {
        const ex = x - side * (half + 5 + i * 6);

        rect(c, ex - 1, y - 8, 1, 8, C.brown);
        rect(c, ex + 2, y - 8, 1, 8, C.brown);
        rect(c, ex - 2, y - 10, 6, 5, C.white);
        px(c, ex - 1, y - 9, [C.pink, C.sky][i]);
        px(c, ex + 1, y - 8, [C.gold, C.lime][i]);
        px(c, ex + 2, y - 9, C.red);
    }

    if (!building) {
        plan.props.forEach((kind, i) => {
            const px0 = x - side * (half + 5 + (plan.easels + i) * 7);

            prop(c, kind, px0, y + 1, t);
        });
    }

    // A ruin: a scorched top, rubble, and a wisp of smoke.
    if (plan.ruin) {
        const fall = rng(plan.seed ^ 29);

        c.globalAlpha = 0.4;
        rect(c, left, wallTop + 2, w, 4, C.ink);
        c.globalAlpha = 1;

        for (let i = 0; i < 5; i++) {
            rect(
                c,
                left - 3 + Math.round(fall() * (w + 4)),
                y - 2,
                3,
                2,
                i % 2 ? C.stone2 : C.slate,
            );
        }

        const drift = ((t * 5) % 10) | 0;

        c.globalAlpha = 0.5;
        disc(c, x + 2 + (drift >> 2), wallTop - 3 - drift, 1 + (drift > 6 ? 1 : 0), C.steel);
        c.globalAlpha = 1;
    }

    // While it goes up: scaffolding round it, a pulley and its bucket, and a sign with the task.
    if (building) {
        const top = Math.min(wallTop, base - FLOOR) - 5;
        const poles = [left - 2, x + half + 1];

        for (const pole of poles) {
            rect(c, pole, top, 1, y - top, C.brown);
        }

        for (let row = y - 6; row > top; row -= 6) {
            rect(c, left - 3, row, w + 6, 1, C.brown);
        }

        rect(c, left - 3, top, w + 6, 1, C.dark);
        // The pulley and its bucket, going up and down.
        rect(c, x + half + 1, top - 3, 1, 3, C.brown);
        rect(c, x + half - 3, top - 3, 5, 1, C.brown);

        const rope = 3 + Math.round((Math.sin(t * 1.7) + 1) * 4);

        rect(c, x + half - 3, top - 2, 1, rope, C.silver);
        rect(c, x + half - 4, top - 2 + rope, 3, 2, C.steel);

        // The sign: a board on a post, before the lot.
        const sx = left - 8;

        rect(c, sx + 2, y - 9, 1, 9, C.dark);
        rect(c, sx - 1, y - 13, 7, 5, C.white);
        rect(c, sx, y - 12, 5, 1, C.slate);
        rect(c, sx, y - 10, 4, 1, C.slate);
        rect(c, sx - 1, y - 13, 7, 1, C.gold);
    }
}

/** How far a project's art rises over its ground, for labels and taps. */
export function heightOf(plan, rise = plan.floors) {
    const walls = 3 + rise * FLOOR;
    const roof = plan.done && !plan.ruin ? roofHeight(plan) : 5;
    const extra = plan.hosts > 0 || plan.flags.length > 0 ? 10 : plan.chimneys > 0 ? 6 : 0;

    return walls + Math.max(roof, extra) + (plan.tower && plan.done ? 6 : 0);
}

/** A picture of a project, for its sheet. */
export function pictureOf(project, scale = 3) {
    const plan = planOf(project);
    const key = `${plan.version}:${scale}`;

    if (project.picture?.key === key) {
        return project.picture.url;
    }

    // Cropped close round the art: the building and its yard.
    const w = 76;
    const h = 64;
    const small = document.createElement("canvas");

    small.width = w;
    small.height = h;
    drawSite(small.getContext("2d"), plan, w / 2, h - 5, { t: 0 });

    const big = document.createElement("canvas");

    big.width = w * scale;
    big.height = h * scale;

    const g = big.getContext("2d");

    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, w * scale, h * scale);

    const url = big.toDataURL();

    project.picture = { key, url };

    return url;
}

// ——— in the town ———

const ART = { w: 100, h: 76, x: 50, y: 70 };

/** Where a lot stands, how its art draws, and what it shows: the projects of a town. */
export class Sites {
    constructor(town, { plaza, buildings }) {
        this.town = town;
        this.plaza = plaza;
        this.buildings = buildings;
        this.spots = new Map();
        this.rise = new Map();
        this.sprites = new Map();
        this.bricks = [];
        this.live = false;
        this.deriving = false;
        this.terrainDirty = false;
        this.model = new Projects({
            convs: () => town.data.convs,
            nameOf: (id) => town.nameOf(id),
            colorOf: (id) => town.citizens.get(id)?.look?.hatColor ?? null,
            ownerOf: (id) => town.houseOf?.(id) ?? null,
            on: (kind, project, part) => this.on(kind, project, part),
        });
    }

    clear() {
        this.model.clear();
        this.bricks = [];
        this.sprites.clear();
        this.rise.clear();
    }

    feed(event, live) {
        this.live = live && !this.town.calm;
        this.model.feed(event);
        this.live = false;
    }

    derive(events) {
        const touches = (event) => this.town.touches(event);

        this.deriving = true;
        this.model.clear();
        this.bricks = [];
        // Ids come again after a reset: no picture may outlive the project it was drawn for.
        this.sprites.clear();

        for (const event of events) {
            if (touches(event)) {
                this.model.feed(event);
            }
        }

        this.model.settle(Date.now());
        this.deriving = false;
        this.layout();

        // The quest log, made again from the events, gets its finished buildings back.
        const lines = [...this.model.all.values()]
            .filter((project) => project.end !== null)
            .map((project) => this.lineOf(project));

        if (lines.length > 0) {
            this.town.chronicle = [...this.town.chronicle, ...lines]
                .sort((a, b) => b.at - a.at)
                .slice(0, 150);
            this.town.chronicleVersion++;
        }

        for (const project of this.model.all.values()) {
            if (!this.rise.has(project.id)) {
                this.rise.set(project.id, planOf(project).floors);
            }
        }
    }

    on(kind, project, part) {
        if (this.deriving) {
            return;
        }

        const town = this.town;

        if (kind === "start") {
            this.rise.set(project.id, 0);
            this.layout();

            const spot = this.spots.get(project.id);

            if (spot && this.live) {
                town.puff(spot.x, spot.y, C.sand, 12);
                town.sound?.play("bell");
            }

            return;
        }

        const spot = this.spots.get(project.id);

        if (!spot) {
            return;
        }

        if (kind === "part" && this.live) {
            const call = part ?? {};
            const color =
                call.kind === "fail" ? C.steel : (call.color ?? PART_COLOR[call.kind] ?? C.sand);
            const place = call.s ? town.places.get(call.s) : null;
            const top = spot.y - heightOf(planOf(project), this.rise.get(project.id) ?? 0) + 6;

            if (call.kind !== "fail" && place?.shown && this.bricks.length < 24) {
                this.bricks.push({
                    a: { x: place.x, y: place.y - 14 },
                    b: { x: spot.x, y: top },
                    p: 0,
                    dur: 0.7 + Math.min(0.9, Math.hypot(spot.x - place.x, spot.y - place.y) / 300),
                    color,
                });
            } else {
                town.puff(spot.x, top, color, 6);
            }
        } else if (kind === "finish") {
            if (this.live && project.state === "ruin") {
                town.puff(spot.x, spot.y - 10, C.steel, 18);
                town.sound?.play("error");
            } else if (this.live) {
                town.confetti(spot.x, spot.y - 20);
                town.sound?.play("coin");
            }

            // Finished again after more work: one line for it, the newest.
            town.chronicle = town.chronicle.filter((line) => line.site !== project.id);
            town.chronicle.unshift(this.lineOf(project));
            town.chronicle.length = Math.min(town.chronicle.length, 150);
            town.chronicleVersion++;
        } else if (kind === "reopen" && this.live) {
            town.puff(spot.x, spot.y - 6, C.sand, 8);
        } else if (kind === "drop") {
            if (this.live) {
                town.puff(spot.x, spot.y - 8, C.silver, 14);
            }

            this.spots.delete(project.id);
            this.rise.delete(project.id);
            this.terrainDirty = true;

            if (this.town.selected?.type === "site" && this.town.selected.id === project.id) {
                this.town.selected = null;
            }
        }
    }

    /** A finished building in words, for the quest log; a tap on it opens its sheet. */
    lineOf(project) {
        const town = this.town;

        return {
            id: `site:${project.id}:${project.end}`,
            at: project.end,
            c: project.owner,
            site: project.id,
            icon: project.state === "ruin" ? "skull" : "house",
            who: town.nameOf(project.owner),
            text:
                project.state === "ruin"
                    ? `left "${project.title}" in ruins: ${project.fails} of ${project.calls} calls failed`
                    : `finished "${project.title}": a ${STYLES[planOf(project).style].name.toLowerCase()}`,
            color: C.gold,
        };
    }

    /** The projects whose house stands in the town now. */
    shown() {
        const out = [];

        for (const project of this.model.all.values()) {
            const home = this.town.homes.get(project.owner);
            const spot = this.spots.get(project.id);

            if (home && spot && home.shown && home.built >= 1) {
                out.push({ project, spot, plan: planOf(project) });
            }
        }

        return out;
    }

    /** What stands in the way of a new lot: buildings, the plaza, and the roads. */
    obstacles(skip) {
        const town = this.town;
        const boxes = [];
        const lines = [];
        const P = this.plaza;

        boxes.push([-P - 30, -P * 0.8 - 20, P + 30, P * 0.8 + 34]);

        for (const place of town.places.values()) {
            const def = this.buildings[place.kind] ?? { w: 30, h: 30 };

            boxes.push([
                place.x - def.w / 2 - 4,
                place.y - def.h - 6,
                place.x + def.w / 2 + 4,
                place.y + 8,
            ]);
            lines.push(place.trail);
        }

        for (const home of town.homes.values()) {
            boxes.push([home.x - 21, home.y - 40, home.x + 21, home.y + 9]);
            lines.push(home.trail);
        }

        for (const tent of town.tents.values()) {
            boxes.push([tent.x - 10, tent.y - 15, tent.x + 12, tent.y + 6]);
            lines.push(tent.trail.slice(0, tent.trail.indexOf(tent.home.door) + 1));
        }

        if (town.castle) {
            const def = this.buildings.castle ?? { w: 80, h: 70 };

            boxes.push([
                town.castle.x - def.w / 2 - 6,
                town.castle.y - def.h - 10,
                town.castle.x + def.w / 2 + 6,
                town.castle.y + 10,
            ]);
            lines.push(town.castle.trail);
        }

        for (const [id, spot] of this.spots) {
            if (id !== skip && spot.placed) {
                boxes.push(lotBox(spot.x, spot.y));
                lines.push(spot.path);
            }
        }

        return { boxes, lines };
    }

    /** Every lot beside its house: kept where it was while that ground stays free. */
    layout() {
        const town = this.town;

        for (const spot of this.spots.values()) {
            spot.placed = false;
        }

        for (const id of [...this.spots.keys()]) {
            if (!this.model.all.has(id)) {
                this.spots.delete(id);
            }
        }

        const projects = [...this.model.all.values()].sort(
            (a, b) => a.start - b.start || a.seq - b.seq,
        );
        let moved = false;

        for (const project of projects) {
            const home = town.homes.get(project.owner);

            if (!home) {
                continue;
            }

            const { boxes, lines } = this.obstacles(project.id);

            const free = (x, y) => {
                const box = lotBox(x, y);

                return (
                    !boxes.some((other) => overlaps(box, other)) &&
                    !lines.some((line) => crosses(line, box))
                );
            };

            const old = this.spots.get(project.id);
            let spot = null;

            if (old && free(home.x + old.dx, home.y + old.dy)) {
                spot = { x: home.x + old.dx, y: home.y + old.dy };
            } else {
                spot = this.find(home, free);
                moved = true;
            }

            const door = { x: spot.x, y: spot.y + 4 };
            // A street: each lot joins the nearest door of its neighbourhood, its house's or an older lot's.
            const doors = [home.door];

            for (const [other, each] of this.spots) {
                if (each.placed && this.model.all.get(other)?.owner === project.owner) {
                    doors.push(each.door);
                }
            }

            const near = doors.reduce((best, each) =>
                Math.hypot(each.x - door.x, each.y - door.y) <
                Math.hypot(best.x - door.x, best.y - door.y)
                    ? each
                    : best,
            );
            const side = spot.x >= home.x ? 1 : -1;
            const path =
                near === home.door && spot.y < home.y + 4
                    ? [door, { x: home.x + side * 25, y: home.y + 7 }, home.door]
                    : [door, { x: near.x, y: door.y }, near];

            this.spots.set(project.id, {
                x: spot.x,
                y: spot.y,
                dx: spot.x - home.x,
                dy: spot.y - home.y,
                door,
                path,
                placed: true,
            });
        }

        if (moved) {
            this.terrainDirty = true;
        }
    }

    /** The nearest free ground to a house, away from the plaza first. */
    find(home, free) {
        const out = Math.atan2((home.y - 20) / 0.8, home.x) || Math.PI / 2;

        for (const r of [74, 104, 134, 166, 200, 240, 285, 335, 390]) {
            const step = 46 / r;
            const most = Math.floor(Math.PI / step);

            for (let k = 0; k <= most; k++) {
                for (const sign of k === 0 ? [1] : [1, -1]) {
                    const angle = out + sign * k * step;
                    const x = Math.round(home.x + Math.cos(angle) * r);
                    const y = Math.round(home.y + Math.sin(angle) * r * 0.75);

                    if (free(x, y)) {
                        return { x, y };
                    }
                }
            }
        }

        return {
            x: Math.round(home.x + Math.cos(out) * 440),
            y: Math.round(home.y + Math.sin(out) * 330),
        };
    }

    /** For the terrain: the lots, to keep clear of trees, and the paths to their houses. */
    things() {
        return this.shownSpots().map((spot) => ({ x: spot.x, y: spot.y, kind: "lot", foot: LOT }));
    }

    paths() {
        return this.shownSpots().flatMap((spot) =>
            spot.path.flatMap((point, index, list) =>
                index === 0 ? [] : [[list[index - 1], point]],
            ),
        );
    }

    shownSpots() {
        const out = [];

        for (const [id, spot] of this.spots) {
            const project = this.model.all.get(id);
            const home = project ? this.town.homes.get(project.owner) : null;

            if (spot.placed && home?.shown) {
                out.push(spot);
            }
        }

        return out;
    }

    update(dt) {
        for (const project of this.model.all.values()) {
            const target = planOf(project).floors;
            const now = this.rise.get(project.id) ?? target;

            if (now !== target) {
                this.rise.set(
                    project.id,
                    now < target
                        ? Math.min(target, now + dt * 1.4)
                        : Math.max(target, now - dt * 2),
                );
            }
        }

        for (const brick of this.bricks) {
            brick.p += dt / brick.dur;

            if (brick.p >= 1) {
                this.town.puff(brick.b.x, brick.b.y, brick.color, 5);
            }
        }

        this.bricks = this.bricks.filter((brick) => brick.p < 1);

        const now = this.town.replay ? this.town.replay.at : Date.now();

        if (!this.lastSettle || Math.abs(now - this.lastSettle) > 5000) {
            this.lastSettle = now;
            this.live = !this.town.calm;
            this.model.settle(now);
            this.live = false;
        }
    }

    /** The art of each lot, back to front with everything else. */
    drawables(push, inView, b, t, night) {
        for (const { project, spot, plan } of this.shown()) {
            if (!inView(spot.x, spot.y)) {
                continue;
            }

            push({
                y: spot.y,
                draw: () => {
                    const rise = this.rise.get(project.id) ?? plan.floors;

                    if (
                        plan.done &&
                        rise === plan.floors &&
                        plan.style !== "foundry" &&
                        !plan.ruin
                    ) {
                        b.drawImage(
                            this.sprite(project, plan, night > 0.3),
                            spot.x - ART.x,
                            spot.y - ART.y,
                        );
                    } else {
                        drawSite(b, plan, spot.x, spot.y, {
                            t,
                            lit: night > 0.3,
                            rise,
                            glow: !plan.done,
                        });
                    }
                },
            });
        }
    }

    sprite(project, plan, lit) {
        const key = `${plan.version}:${lit ? 1 : 0}`;
        const cached = this.sprites.get(project.id);

        if (cached?.key === key) {
            return cached.canvas;
        }

        const canvas = cached?.canvas ?? document.createElement("canvas");

        canvas.width = ART.w;
        canvas.height = ART.h;

        const g = canvas.getContext("2d");

        g.clearRect(0, 0, ART.w, ART.h);
        drawSite(g, plan, ART.x, ART.y, { t: 0, lit });
        this.sprites.set(project.id, { key, canvas });

        if (this.sprites.size > 80) {
            for (const id of this.sprites.keys()) {
                if (!this.model.all.has(id)) {
                    this.sprites.delete(id);
                }
            }
        }

        return canvas;
    }

    /** Bricks on their way from the building where the work was done to the site it builds. */
    drawBricks(b) {
        for (const brick of this.bricks) {
            const p = Math.min(1, brick.p);
            const x = Math.round(brick.a.x + (brick.b.x - brick.a.x) * p);
            const y = Math.round(
                brick.a.y + (brick.b.y - brick.a.y) * p - Math.sin(p * Math.PI) * 26,
            );

            rect(b, x - 2, y - 1, 4, 3, C.ink);
            rect(b, x - 1, y, 2, 1, brick.color);
        }
    }

    lights(out) {
        for (const { project, spot, plan } of this.shown()) {
            if (plan.ruin) {
                continue;
            }

            const rise = this.rise.get(project.id) ?? plan.floors;

            if (plan.done) {
                out.push({
                    x: spot.x,
                    y: spot.y - 4 - Math.min(2, rise) * 4,
                    r: 10 + rise * 3,
                    color: C.orange,
                });
            } else {
                out.push({
                    x: spot.x - plan.w / 2 - 2,
                    y: spot.y - 6 - rise * FLOOR,
                    r: 14,
                    color: C.gold,
                });
            }
        }
    }

    /** The project under a point in the world, front first. */
    pick(p, reach) {
        const list = this.shown().sort((a, c) => c.spot.y - a.spot.y);

        for (const { project, spot, plan } of list) {
            const half = Math.max(plan.w / 2 + 4, reach);
            const height = Math.max(
                heightOf(plan, this.rise.get(project.id) ?? plan.floors),
                reach * 2,
            );

            if (
                p.x > spot.x - half &&
                p.x < spot.x + half &&
                p.y > spot.y - height &&
                p.y < spot.y + 4
            ) {
                return project.id;
            }
        }

        return null;
    }

    where(id) {
        const project = this.model.all.get(id);
        const spot = this.spots.get(id);

        if (!project || !spot) {
            return null;
        }

        return { x: spot.x, y: spot.y, height: heightOf(planOf(project), this.rise.get(id) ?? 0) };
    }

    /** The open sites, for the camera: where the story is. */
    active() {
        return this.shown()
            .filter(({ plan }) => !plan.done)
            .map(({ spot }) => ({ x: spot.x, y: spot.y - 10 }));
    }

    selection(id) {
        const project = this.model.all.get(id);

        if (!project) {
            return null;
        }

        const town = this.town;
        const plan = planOf(project);
        const list = (map) => [...map.entries()].sort((a, c) => c[1] - a[1]);

        const tally = (items) => {
            const map = new Map();

            for (const item of items) {
                map.set(item, (map.get(item) ?? 0) + 1);
            }

            return list(map);
        };

        const groups = [
            ["read", list(project.reads)],
            ["write", list(project.writes)],
            ["shell", list(project.programs)],
            ["git", tally(project.crates)],
            ["web", list(project.hosts)],
            ["mcp", list(project.servers)],
            ["artifact", tally(project.extras.artifact)],
            ["memory", tally(project.extras.memory)],
            ["other", tally(project.extras.other)],
            ["delegate", [...project.helpers.values()].map((each) => [each.name, 1])],
            ["fail", tally(project.failures)],
        ]
            .filter(([, items]) => items.length > 0)
            .map(([kind, items]) => ({
                kind,
                ...PARTS[kind],
                items: items.slice(0, 10),
                more: Math.max(0, items.length - 10),
            }));

        return {
            type: "site",
            id,
            title: project.title,
            state: project.state,
            style: { key: plan.style, ...STYLES[plan.style] },
            owner: {
                id: project.owner,
                name: town.nameOf(project.owner),
                here: town.citizens.has(project.owner),
            },
            askers: project.askers,
            helpers: [...project.helpers.values()].map((each) => ({
                id: each.id,
                name: each.name,
                here: !!each.id && town.citizens.has(each.id),
                look: each.id ? town.citizens.get(each.id)?.look : undefined,
            })),
            start: project.start,
            end: project.end,
            calls: project.calls,
            fails: project.fails,
            cost: project.cost,
            now: project.state === "building" ? project.now?.label : null,
            groups,
            picture: pictureOf(project),
        };
    }
}

const PART_COLOR = {
    read: C.stone,
    write: C.sand,
    shell: C.red,
    git: C.brown,
    web: C.sky,
    mcp: C.lime,
    artifact: C.pink,
    memory: C.cyan,
    delegate: C.gold,
    other: C.silver,
};

function lotBox(x, y) {
    return [x - LOT.w / 2, y - LOT.h, x + LOT.w / 2, y + 8];
}

function overlaps(a, b) {
    return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

/** Whether a road of points runs through a box. */
function crosses(line, box) {
    if (!line) {
        return false;
    }

    for (let i = 0; i < line.length - 1; i++) {
        const a = line[i];
        const b = line[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));

        for (let step = 0; step <= steps; step++) {
            const x = a.x + ((b.x - a.x) * step) / steps;
            const y = a.y + ((b.y - a.y) * step) / steps;

            if (x > box[0] - 4 && x < box[2] + 4 && y > box[1] - 4 && y < box[3] + 4) {
                return true;
            }
        }
    }

    return false;
}
