// The town: a living pixel-art simulation of every agent that the events tell of.
// Sessions are wizards with houses, subagents are apprentices in tents around them, linked sessions are envoys in
// houses down the road, and every place an agent reaches is a building around the plaza. Agents walk there to work;
// pigeons carry messages; coins flow from the oracle temples; the sky turns from day to night.

import {
    BUILDINGS,
    C,
    KIND_OF,
    LINE,
    SHIRTS,
    TOOL_OF,
    disc,
    drawBush,
    drawCampfire,
    drawChicken,
    drawIcon,
    drawLantern,
    drawPerson,
    drawPigeon,
    drawRock,
    drawTent,
    drawTree,
    fit,
    hash,
    lookOf,
    plain,
    px,
    rect,
    rgba,
    rng,
    shade,
    text,
    textWidth,
    wrap,
} from "./pixels.js";

const TAU = Math.PI * 2;
const PLAZA = 34;
const LANE = PLAZA - 6;

export const PLACES = {
    model: {
        label: "Oracle Temple",
        icon: "orb",
        color: "#b48cff",
        order: 0,
        about: "Every thought is a question to an oracle: one temple for each model provider. Coins flow back as tokens.",
    },
    files: {
        label: "Archive",
        icon: "book",
        color: "#5ee7ff",
        order: 1,
        about: "Every file the agents read, write, and edit.",
    },
    shell: {
        label: "Forge",
        icon: "hammer",
        color: "#ff9d4d",
        order: 2,
        about: "Shell commands, hammered out at the anvil.",
    },
    github: {
        label: "Git Harbor",
        icon: "anchor",
        color: "#e8ecff",
        order: 3,
        about: "git, gh, and pull request watches. A push sails a ship out.",
    },
    web: {
        label: "Observatory",
        icon: "scope",
        color: "#6dffb3",
        order: 4,
        about: "The browser and the web, seen through the telescope.",
    },
    codemode: {
        label: "Workshop",
        icon: "gear",
        color: "#c8ff6b",
        order: 5,
        about: "Code mode scripts that call other tools.",
    },
    memory: {
        label: "Memory Vault",
        icon: "key",
        color: "#ffd36b",
        order: 6,
        about: "Lessons kept across sessions.",
    },
    artifact: {
        label: "Gallery",
        icon: "frame",
        color: "#ff7a9c",
        order: 7,
        about: "Published artifacts.",
    },
    schedule: {
        label: "Clock Tower",
        icon: "clock",
        color: "#9cc3ff",
        order: 8,
        about: "Scheduled messages. Its clock shows your time.",
    },
    mcp: {
        label: "Embassy",
        icon: "flag",
        color: "#ff6bd6",
        order: 9,
        about: "An MCP server's embassy. Each flies its own flag.",
    },
    ext: {
        label: "Guild Hall",
        icon: "shield",
        color: "#8eeaff",
        order: 10,
        about: "Other tools, from extensions.",
    },
};

export const VIA = {
    human: { color: "#ffcd75", icon: "letter", word: "wrote to" },
    subagent: { color: "#41a6f6", icon: "scroll", word: "tasked" },
    report: { color: "#a7f070", icon: "scroll", word: "reported to" },
    team: { color: "#e070c0", icon: "pigeon", word: "messaged" },
    system: { color: "#9cc3ff", icon: "clock", word: "woke" },
    stop: { color: "#b13e53", icon: "bolt", word: "stopped" },
};

const ORACLES = {
    anthropic: "#ef7d57",
    openai: "#a7f070",
    google: "#41a6f6",
    "opencode-go": "#b48cff",
    openrouter: "#73eff7",
    faux: "#e070c0",
};

export const STATE_WORD = {
    idle: "idle",
    thinking: "thinking",
    working: "working",
    speaking: "answering",
    walking: "on the way",
    resting: "resting",
    error: "hurt",
};

export function placeOf(key) {
    const at = key.indexOf(":");
    const base = at < 0 ? key : key.slice(0, at);
    const sub = at < 0 ? "" : key.slice(at + 1);
    const def = PLACES[base] ?? PLACES.ext;

    return {
        ...def,
        key,
        base,
        sub,
        label: sub ? `${def.label} · ${sub}` : def.label,
        kind: KIND_OF[base] ?? "guild",
    };
}

const oracleColor = (provider) =>
    Object.hasOwn(ORACLES, provider) ? ORACLES[provider] : SHIRTS[hash(provider) % SHIRTS.length];

export const fmt = (n) => {
    const value = Number(n) || 0;

    return value >= 1e9
        ? `${(value / 1e9).toFixed(1)}B`
        : value >= 1e6
          ? `${(value / 1e6).toFixed(1)}M`
          : value >= 1e4
            ? `${Math.round(value / 1e3)}k`
            : value >= 1e3
              ? `${(value / 1e3).toFixed(1)}k`
              : String(Math.round(value));
};

export const money = (n) => {
    const value = Number(n) || 0;

    return value === 0 ? "$0" : value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
};

export const ellipsize = (value, max) => {
    const string = String(value ?? "");

    return string.length > max ? `${string.slice(0, max - 1)}…` : string;
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pt = (x, y) => ({ x: Math.round(x), y: Math.round(y) });
const SLOTS = [0, -9, 9, -17, 17, -5, 5, -13, 13];

/** A portrait of a citizen, as an image address. */
export function portraitURL(look, scale = 1) {
    const canvas = document.createElement("canvas");

    canvas.width = 20 * scale;
    canvas.height = 26 * scale;

    const g = canvas.getContext("2d");

    g.scale(scale, scale);
    drawPerson(g, 10, 24, look, { face: "down" });

    return canvas.toDataURL();
}

/** A picture of a building, as an image address. */
export function buildingURL(kind, state = {}) {
    const def = BUILDINGS[kind] ?? BUILDINGS.guild;
    const canvas = document.createElement("canvas");

    canvas.width = def.w + 12;
    canvas.height = def.h + 18;

    const g = canvas.getContext("2d");

    def.draw(g, Math.round(canvas.width / 2), canvas.height - 3, { t: 1, ...state });

    return canvas.toDataURL();
}

export class Town {
    constructor(canvas, data) {
        this.canvas = canvas;
        this.out = canvas.getContext("2d");
        this.buf = document.createElement("canvas");
        this.b = this.buf.getContext("2d");
        this.dark = document.createElement("canvas");
        this.d = this.dark.getContext("2d");
        this.data = data;
        this.citizens = new Map();
        this.places = new Map();
        this.homes = new Map();
        this.tents = new Map();
        this.royals = new Map();
        this.lanterns = [];
        this.critters = [];
        this.castle = null;
        this.fountain = { x: 0, y: 6 };
        this.humanTargets = new Map();
        this.fx = [];
        this.flyers = [];
        this.clouds = [];
        this.callTimes = [];
        this.errorTimes = [];
        this.toolTimes = [];
        this.chronicle = [];
        this.chronicleVersion = 0;
        this.cam = { x: 0, y: 0 };
        this.camT = { x: 0, y: 0 };
        this.born = Date.now();
        /** People who asked for less motion: no flashes, no rain, no glides, no typing. */
        this.calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
        this.S = 3;
        /** The frame's own scale over S: below 1 to fit "See all" exactly, and in between while a zoom glides. */
        this.k = 1;
        this.kGoal = 1;
        this.glide = null;
        this.follow = true;
        this.tracking = null;
        this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
        this.scope = "family";
        this.focus = null;
        this.visible = new Set();
        this.selected = null;
        this.hover = null;
        this.t = 0;
        this.dirty = true;
        this.replay = null;
        this.sound = null;
        this.sky = "cycle";
        this.terrain = null;
        this.terrainKey = "";
        this.box = { x: -200, y: -200, w: 400, h: 400 };
        this.firstBuild = true;
        this.w = 1;
        this.h = 1;
        this.dpr = 1;
        this.flash = 0;
        this.nextBolt = 8;
        this.nextFlock = 20;
        this.loop = this.loop.bind(this);
        this.bindInput();

        for (let index = 0; index < 5; index++) {
            this.clouds.push({
                x: Math.random() * 800 - 400,
                y: Math.random() * 800 - 400,
                r: 40 + Math.random() * 50,
                v: 4 + Math.random() * 5,
            });
        }
    }

    // ——— lifecycle ———

    start() {
        this.running = true;
        this.last = performance.now();
        this.frame = requestAnimationFrame(this.loop);
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.frame);
        this.unbind?.();
    }

    resize(width, height) {
        this.dpr = Math.min(3, window.devicePixelRatio || 1);
        this.w = Math.max(1, width);
        this.h = Math.max(1, height);
        this.canvas.width = Math.round(this.w * this.dpr);
        this.canvas.height = Math.round(this.h * this.dpr);
        this.canvas.style.width = `${this.w}px`;
        this.canvas.style.height = `${this.h}px`;
        this.checkShape();
    }

    setInsets(insets) {
        this.insets = insets;
        this.aimIn = 0;

        // Panels that settle in the first seconds re-frame the town at once, not with a slow drift.
        if (this.follow && Date.now() - this.born < 6000) {
            this.cutUntil = Date.now() + 300;
        }

        this.checkShape();
    }

    /** The shape of the view: "wide", "square", or "tall". The town lays itself out to fill it. */
    shape() {
        const view = this.insets;
        const ratio =
            (this.w - view.left - view.right) / Math.max(1, this.h - view.top - view.bottom);

        return ratio > 1.15 ? "wide" : ratio > 0.8 ? "square" : "tall";
    }

    checkShape() {
        if (this.shape() !== this.lastShape) {
            this.dirty = true;
        }
    }

    loop(now) {
        if (!this.running) {
            return;
        }

        // A quiet town draws 20 frames a second, not 60: a phone's battery lasts.
        const quiet =
            !this.glide &&
            this.fx.length === 0 &&
            this.flyers.length === 0 &&
            ![...this.citizens.values()].some(
                (citizen) => citizen.task || citizen.thinking || citizen.path.length > 0,
            );

        if (quiet && now - this.last < 45) {
            this.frame = requestAnimationFrame(this.loop);

            return;
        }

        const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));

        this.last = now;

        try {
            if (this.dirty) {
                this.relayout();
            }

            this.update(dt);
            this.render();
        } catch (error) {
            console.error("agent-civilization: frame failed", error);
        }

        this.frame = requestAnimationFrame(this.loop);
    }

    reset(data) {
        this.data = data;

        for (const map of [
            this.citizens,
            this.places,
            this.homes,
            this.tents,
            this.royals,
            this.humanTargets,
        ]) {
            map.clear();
        }

        this.fx = [];
        this.flyers = [];
        this.callTimes = [];
        this.errorTimes = [];
        this.chronicle = [];
        this.chronicleVersion++;
        this.selected = null;
        this.replay = null;
        this.dirty = true;
        this.follow = true;
        this.tracking = null;
        this.firstBuild = true;
        this.ringSlots = undefined;
    }

    setScope(scope, focus) {
        this.scope = scope;
        this.focus = focus;
        this.dirty = true;
        this.follow = true;
        this.tracking = null;
        this.selected = null;
    }

    // ——— names ———

    nameOf(id) {
        if (typeof id === "string" && id.startsWith("human:")) {
            return id.slice(6);
        }

        if (typeof id === "string" && id.startsWith("station:")) {
            return placeOf(id.slice(8)).label;
        }

        const conv = this.data.convs[id];

        if (!conv) {
            return id ? `Session ${id}` : "someone";
        }

        if (conv.kind === "subagent" && conv.name) {
            return conv.name;
        }

        return conv.title || conv.name || `Session ${id}`;
    }

    roleOf(id) {
        const conv = this.data.convs[id];

        return conv?.kind === "subagent"
            ? "subagent"
            : conv?.kind === "linked"
              ? "linked"
              : "session";
    }

    // ——— the layout ———

    computeVisible() {
        const convs = this.data.convs;
        const ids = Object.keys(convs).filter((id) => convs[id]);

        // A replay shows the town as it was when it began: agents that arrive meanwhile wait for its end.
        if (this.replay?.frozen) {
            return new Set([...this.replay.frozen.visible].filter((id) => convs[id]));
        }

        if (this.scope === "universe" || !this.focus) {
            const recent = Date.now() - 72 * 3600_000;
            const keep = new Set(
                ids.filter((id) => (convs[id].last ?? 0) > recent || convs[id].placeholder),
            );

            // A subagent goes with its parent, and its own apprentices with it.
            for (let grew = true; grew;) {
                grew = false;

                for (const id of ids) {
                    if (!keep.has(id) && convs[id].parent && keep.has(convs[id].parent)) {
                        keep.add(id);
                        grew = true;
                    }
                }
            }

            return keep;
        }

        let root = this.focus;
        const guard = new Set();

        while (convs[root]?.parent && convs[convs[root].parent] && !guard.has(root)) {
            guard.add(root);
            root = convs[root].parent;
        }

        const kids = {};

        for (const id of ids) {
            const parent = convs[id].parent;

            if (parent) {
                (kids[parent] ??= []).push(id);
            }
        }

        const out = new Set([root, this.focus]);
        const queue = [root];

        while (queue.length > 0) {
            for (const kid of kids[queue.shift()] ?? []) {
                if (!out.has(kid)) {
                    out.add(kid);
                    queue.push(kid);
                }
            }
        }

        return out;
    }

    /** What the layout depends on: who is in town, who their parents are, and which buildings show. */
    signature() {
        const visible = this.computeVisible();
        let value = `${this.scope}|${this.focus}|${this.shape()}|`;

        for (const id in this.data.convs) {
            const conv = this.data.convs[id];

            if (visible.has(id)) {
                value += `${id}:${conv?.kind}:${conv?.parent ?? ""}:${conv?.provider ?? ""};`;
            }
        }

        value += "|";

        for (const key in this.data.res) {
            if (this.resourceShown(this.data.res[key], visible)) {
                value += `${key},`;
            }
        }

        for (const [name, targets] of this.humanTargets) {
            value += `|${name}:${[...targets].some((id) => visible.has(id)) ? 1 : 0}`;
        }

        return value;
    }

    resourceShown(resource, visible) {
        return (
            !!resource &&
            (!this.replay?.frozen || this.replay.frozen.res.has(resource.key)) &&
            (this.scope === "universe" ||
                !this.focus ||
                Object.keys(resource.by ?? {}).some((id) => visible.has(id)))
        );
    }

    relayoutIfNeeded() {
        if (this.dirty || this.lastSignature !== this.signature()) {
            this.relayout();
        }
    }

    relayout() {
        this.dirty = false;
        this.lastSignature = this.signature();

        const convs = this.data.convs;
        const first = this.firstBuild;

        if (this.focus && !convs[this.focus] && this.scope !== "universe") {
            convs[this.focus] = {
                id: this.focus,
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
                placeholder: true,
            };
        }

        const visible = this.computeVisible();

        this.visible = visible;

        const parentOf = (id) => {
            const parent = convs[id]?.parent;

            return parent && visible.has(parent) ? parent : null;
        };

        const isMoon = (id) => convs[id]?.kind === "subagent" && parentOf(id) !== null;
        const byFirst = (a, b) =>
            (convs[a]?.first ?? 0) - (convs[b]?.first ?? 0) || (a < b ? -1 : 1);
        let order = 0;

        const born = (thing) => {
            if (first) {
                thing.built = 0;
                thing.delay = 0.15 + order++ * 0.07;
            }
        };

        // Buildings: the places these agents reached, on a ring around the plaza.
        const keys = new Set();

        for (const [key, resource] of Object.entries(this.data.res)) {
            if (this.resourceShown(resource, visible)) {
                keys.add(key);
            }
        }

        for (const id of visible) {
            const key = `model:${convs[id]?.provider}`;

            if (convs[id]?.provider && (!this.replay?.frozen || this.replay.frozen.res.has(key))) {
                keys.add(key);
            }
        }

        const sorted = [...keys].sort(
            (a, b) => placeOf(a).order - placeOf(b).order || (a < b ? -1 : 1),
        );

        // Each building keeps its slot on the ring: a new one takes a free slot and the rest stay
        // put. The ring grows, and everything spreads out again, only when its slots run out.
        for (const key of [...this.places.keys()]) {
            if (!keys.has(key)) {
                this.places.delete(key);
            }
        }

        let slots = this.ringSlots ?? 12;

        while (slots < sorted.length) {
            slots += 4;
        }

        if (slots !== this.ringSlots) {
            this.ringSlots = slots;

            for (const place of this.places.values()) {
                place.slot = undefined;
            }
        }

        // Wide enough apart that no building hides its neighbour, even where the ring is squashed.
        const ring = Math.max(96, (slots * 64) / TAU);
        const used = new Set(
            [...this.places.values()]
                .map((place) => place.slot)
                .filter((slot) => slot !== undefined),
        );

        const slotFor = (index) => {
            const wish = Math.round((index * slots) / Math.max(1, sorted.length)) % slots;

            for (let step = 0; step < slots; step++) {
                for (const slot of [wish + step, wish - step]) {
                    const free = ((slot % slots) + slots) % slots;

                    if (!used.has(free)) {
                        used.add(free);

                        return free;
                    }
                }
            }

            return wish;
        };

        sorted.forEach((key, index) => {
            const def = placeOf(key);
            let place = this.places.get(key);

            if (place && place.slot === undefined) {
                place.slot = slotFor(index);
            }

            if (!place) {
                place = {
                    key,
                    def,
                    kind: def.kind,
                    pulse: 0,
                    workers: new Set(),
                    shown: true,
                    built: 1,
                    delay: 0,
                    sail: 0,
                };
                place.built = first ? 1 : 0;
                place.slot = slotFor(index);
                born(place);
                this.places.set(key, place);
            }

            const angle = -Math.PI / 2 + 0.35 + (place.slot * TAU) / slots;

            place.x = Math.round(Math.cos(angle) * ring);
            place.y = Math.round(Math.sin(angle) * ring * 0.8 + 16);
            place.door = pt(place.x, place.y + 3);
            place.edge = pt(Math.cos(angle) * LANE, Math.sin(angle) * LANE * 0.8 + 4);
            place.trail = [
                place.door,
                ...(place.y > place.edge.y + 10
                    ? [
                          pt(
                              place.door.x +
                                  (place.x >= 0 ? -1 : 1) *
                                      ((BUILDINGS[def.kind]?.w ?? 30) / 2 + 7),
                              place.door.y + 4,
                          ),
                      ]
                    : []),
                place.edge,
            ];
            place.angle = angle;
            place.color =
                def.base === "model"
                    ? oracleColor(def.sub)
                    : def.base === "mcp"
                      ? SHIRTS[hash(def.sub) % SHIRTS.length]
                      : def.color;
        });

        // Homes: one for each session, on a ring outside the buildings; linked sessions down the road from theirs.
        const worlds = [...visible].filter((id) => !isMoon(id));

        // The nearest of an agent's ancestors (or itself) with a house: apprentices of apprentices
        // camp by it, and an envoy sent by an apprentice builds down the road from it.
        const houseOf = (id) => {
            const trail = new Set();
            let at = id;

            while (at !== null && isMoon(at) && !trail.has(at)) {
                trail.add(at);
                at = parentOf(at);
            }

            return at !== null && !isMoon(at) ? at : null;
        };

        const parentWorld = (id) => {
            const parent = parentOf(id);
            const house = parent === null ? null : houseOf(parent);

            return house === id ? null : house;
        };

        this.houseOf = houseOf;

        // Roots: sessions with no parent here, and any a loop of parents would leave without a place.
        const reached = new Set();
        const childrenOf = {};

        for (const id of worlds) {
            const parent = parentWorld(id);

            if (parent !== null) {
                (childrenOf[parent] ??= []).push(id);
            }
        }

        const reach = (id) => {
            if (!reached.has(id)) {
                reached.add(id);
                (childrenOf[id] ?? []).forEach(reach);
            }
        };

        worlds.filter((id) => parentWorld(id) === null).forEach(reach);

        const roots = worlds
            .filter((id) => parentWorld(id) === null || !reached.has(id))
            .sort(byFirst);
        const rootSet = new Set(roots);

        if (this.scope !== "universe" && this.focus) {
            roots.sort((a, b) => (a === this.focus ? -1 : b === this.focus ? 1 : 0));
        }

        const outer = Math.max(ring + 66, (roots.length * 66) / TAU);
        const spots = new Map();

        // Wide screens get a wide town: homes to the east and the keep to the west; tall screens, south and north.
        const shape = this.shape();
        const wide = shape === "wide";

        this.lastShape = shape;

        roots.forEach((id, index) => {
            const angle =
                (wide ? 0.12 : Math.PI / 2) +
                (index * TAU) / Math.max(1, roots.length) +
                (roots.length > 1 ? 0.3 : 0);

            spots.set(id, {
                x: Math.cos(angle) * outer,
                y: Math.sin(angle) * outer * 0.8 + 20,
                angle,
            });
        });

        const linkedBy = {};

        for (const id of worlds) {
            const parent = parentWorld(id);

            if (parent !== null && !rootSet.has(id)) {
                (linkedBy[parent] ??= []).push(id);
            }
        }

        const placeLinked = (parentId) => {
            const list = (linkedBy[parentId] ?? []).sort(byFirst);
            const base = spots.get(parentId);

            list.forEach((id, index) => {
                if (spots.has(id)) {
                    return;
                }

                const angle = base.angle + (index - (list.length - 1) / 2) * 0.62;

                spots.set(id, {
                    x: base.x + Math.cos(angle) * 84,
                    y: base.y + Math.sin(angle) * 70,
                    angle,
                });

                placeLinked(id);
            });
        };

        roots.forEach((id) => placeLinked(id));

        const ids = [...spots.keys()];

        for (let pass = 0; pass < (ids.length > 40 ? 8 : 40); pass++) {
            for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) {
                    const a = spots.get(ids[i]);
                    const b = spots.get(ids[j]);
                    const d = Math.hypot(b.x - a.x, b.y - a.y) || 0.1;

                    if (d < 78) {
                        const push = (78 - d) / 2;

                        a.x -= ((b.x - a.x) / d) * push;
                        a.y -= ((b.y - a.y) / d) * push;
                        b.x += ((b.x - a.x) / d) * push;
                        b.y += ((b.y - a.y) / d) * push;
                    }
                }
            }
        }

        for (const id of [...this.homes.keys()]) {
            if (!spots.has(id)) {
                this.homes.delete(id);
            }
        }

        for (const id of ids) {
            const spot = spots.get(id);
            let home = this.homes.get(id);

            if (!home) {
                const hue = SHIRTS[hash(id) % SHIRTS.length];

                home = {
                    id,
                    kind: "home",
                    built: first ? 1 : 0,
                    delay: 0,
                    shown: true,
                    roof: [C.red, C.blue, C.teal, C.plum, C.green, C.orange][hash(id) % 6],
                    wall:
                        hue === C.white
                            ? C.tan
                            : [C.tan, C.sand, "#c7b299", "#b9a48a"][hash(id) % 4],
                    mail: 0,
                };
                born(home);
                this.homes.set(id, home);
            }

            home.x = Math.round(spot.x);
            home.y = Math.round(spot.y);
            home.door = pt(home.x, home.y + 3);
            home.parent = rootSet.has(id) ? null : parentWorld(id);
            home.angle = spot.angle;
        }

        // Every home knows its way to the plaza: a linked one uses it only if its family's road breaks.
        for (const id of ids) {
            const home = this.homes.get(id);
            const angle = Math.atan2((home.y - 20) / 0.8, home.x);

            home.edge = pt(Math.cos(angle) * LANE, Math.sin(angle) * LANE * 0.8 + 4);
        }

        // A road that would run into the back of a building goes round its side to the door.
        const bend = (thing, next) => {
            if (!next || next.y > thing.door.y - 10) {
                return [];
            }

            const half = (BUILDINGS[thing.kind]?.w ?? 30) / 2 + 7;
            const side = next.x >= thing.door.x ? 1 : -1;

            return [pt(thing.door.x + side * half, thing.door.y + 4)];
        };

        this.bend = bend;

        const trailOf = (home, depth = 0) => {
            const parent = home.parent ? this.homes.get(home.parent) : null;

            if (!parent || depth > 40) {
                return [home.door, ...bend(home, home.edge), home.edge];
            }

            const rest = trailOf(parent, depth + 1);

            return [home.door, ...bend(home, rest[0]), ...rest];
        };

        for (const home of this.homes.values()) {
            home.trail = trailOf(home);
        }

        // Tents: one for each subagent, around its parent's home.
        const moonsOf = {};

        for (const id of visible) {
            const house = isMoon(id) ? houseOf(id) : null;

            if (house !== null) {
                (moonsOf[house] ??= []).push(id);
            }
        }

        for (const id of [...this.tents.keys()]) {
            if (!isMoon(id)) {
                this.tents.delete(id);
            }
        }

        for (const [parent, list] of Object.entries(moonsOf)) {
            const home = this.homes.get(parent);

            if (!home) {
                continue;
            }

            list.sort(byFirst).forEach((id, index) => {
                const ringIndex = Math.floor(index / 7);
                const slot = index % 7;
                const angle = 0.3 - (slot * (Math.PI + 0.6)) / 6;
                const r = 42 + ringIndex * 15;
                let tent = this.tents.get(id);

                if (!tent) {
                    tent = {
                        id,
                        kind: "tent",
                        built: first ? 1 : 0,
                        delay: 0,
                        shown: true,
                        color: lookOf(id, "subagent", convs[id]?.name).hatColor,
                    };
                    born(tent);
                    this.tents.set(id, tent);
                }

                tent.x = Math.round(home.x + Math.cos(angle) * r * 1.2);
                tent.y = Math.round(home.y + Math.sin(angle) * r * 0.62 + 4);
                tent.door = pt(tent.x, tent.y + 3);
                tent.home = home;
                // Round the side of the house, never through it.
                const side = pt(home.x + (tent.x >= home.x ? 1 : -1) * 25, home.y + 7);

                tent.trail =
                    tent.y < home.y + 4
                        ? [tent.door, side, ...home.trail]
                        : [tent.door, ...home.trail];
            });
        }

        // The castle of the people who write to the agents.
        const names = Object.keys(this.data.humans).filter((name) => {
            if (this.replay?.frozen && !this.replay.frozen.humans.has(name)) {
                return false;
            }

            if (this.scope === "universe" || !this.focus) {
                return true;
            }

            const targets = this.humanTargets.get(name);

            return targets !== undefined && [...targets].some((id) => visible.has(id));
        });

        let top = -ring * 0.8;

        for (const home of this.homes.values()) {
            if (Math.abs(home.x) < 90) {
                top = Math.min(top, home.y - 44);
            }
        }

        for (const place of this.places.values()) {
            if (Math.abs(place.x) < 90) {
                top = Math.min(top, place.y - (BUILDINGS[place.kind]?.h ?? 40) - 8);
            }
        }

        if (names.length > 0) {
            if (!this.castle) {
                this.castle = { kind: "castle", built: first ? 1 : 0, delay: 0, shown: true };
                born(this.castle);
            }

            if (shape !== "tall") {
                let left = -ring;

                for (const thing of [...this.places.values(), ...this.homes.values()]) {
                    if (Math.abs(thing.y - 10) < 70) {
                        left = Math.min(
                            left,
                            thing.x - (BUILDINGS[thing.kind ?? "home"]?.w ?? 34) / 2,
                        );
                    }
                }

                this.castle.x = Math.round(left - 80);
                this.castle.y = 40;
                this.castle.door = pt(this.castle.x, this.castle.y + 3);
                this.castle.edge = pt(-LANE, 4);
                this.castle.trail = [
                    this.castle.door,
                    pt(this.castle.x + 72, this.castle.y + 4),
                    this.castle.edge,
                ];
            } else {
                this.castle.x = 0;
                this.castle.y = Math.round(top - 6);
                this.castle.door = pt(0, this.castle.y + 3);
                this.castle.edge = pt(0, -LANE * 0.8 + 4);
                this.castle.trail = [this.castle.door, this.castle.edge];
            }
        } else {
            this.castle = null;
        }

        for (const name of [...this.royals.keys()]) {
            if (!names.includes(name)) {
                this.royals.delete(name);
            }
        }

        names.sort().forEach((name, index) => {
            let royal = this.royals.get(name);

            if (!royal) {
                royal = { name, look: lookOf(name, "human", name), pulse: 0, shown: true };
                this.royals.set(name, royal);
            }

            royal.x = Math.round((this.castle?.x ?? 0) + (index - (names.length - 1) / 2) * 15);
            royal.y = (this.castle?.y ?? 0) - 33;
        });

        // Lanterns round the plaza.
        this.lanterns = Array.from({ length: 6 }, (_, index) => {
            const angle = (index * TAU) / 6 + 0.5;

            return pt(Math.cos(angle) * (PLAZA + 4), Math.sin(angle) * (PLAZA + 4) * 0.8 + 6);
        });

        // Citizens.
        for (const [id, citizen] of [...this.citizens]) {
            if (!visible.has(id)) {
                this.citizens.delete(id);

                for (const place of this.places.values()) {
                    place.workers.delete(citizen);
                }
            }
        }

        for (const id of visible) {
            const home = this.tents.get(id) ?? this.homes.get(id);

            if (!home) {
                continue;
            }

            let citizen = this.citizens.get(id);
            const role = isMoon(id)
                ? "subagent"
                : convs[id]?.kind === "linked" && parentOf(id)
                  ? "linked"
                  : "session";

            if (!citizen) {
                citizen = this.newCitizen(id, home, role);
                this.citizens.set(id, citizen);
            }

            citizen.home = home;
            citizen.role = role;
            citizen.look = lookOf(id, role, convs[id]?.name);
        }

        // Chickens by the first homes.
        const wanted = [...this.homes.values()].slice(0, 6);

        if (this.critters.length !== wanted.length * 2) {
            this.critters = wanted.flatMap((home, index) =>
                [0, 1].map((n) => ({
                    home,
                    x: home.x - 24 + n * 8,
                    y: home.y + 18,
                    tx: home.x,
                    ty: home.y + 18,
                    dir: 1,
                    seed: index * 2 + n,
                    next: 0,
                })),
            );
        }

        if (!first) {
            this.resettle();
        }

        this.firstBuild = false;
        this.buildTerrain();
    }

    /** After the town moved: everyone on the way finds a new way, and everyone standing somewhere stands there again. */
    resettle() {
        for (const citizen of this.citizens.values()) {
            const task = citizen.task;
            const place = task?.kind === "visit" && task.key ? this.places.get(task.key) : null;

            if (citizen.inside) {
                citizen.x = citizen.home.door.x;
                citizen.y = citizen.home.door.y;
                continue;
            }

            if (place && task.phase === "work") {
                const spot = this.slot(place, citizen);

                citizen.x = spot.x;
                citizen.y = spot.y;
                citizen.at = place;
                continue;
            }

            if (citizen.path.length > 0 || task) {
                citizen.at = null;

                const goal = place ?? (task?.kind === "home" ? citizen.home : citizen.goal);

                if (goal?.trail) {
                    const end =
                        goal === citizen.home
                            ? goal.door
                            : place
                              ? this.slot(place, citizen)
                              : (citizen.path.at(-1) ?? goal.door);

                    citizen.path = this.route(citizen, goal, end);
                } else {
                    citizen.path = [];
                }

                continue;
            }

            citizen.x = citizen.home.door.x + (citizen.x - Math.round(citizen.x));
            citizen.y = citizen.home.door.y + 2;
            citizen.at = citizen.home;
        }
    }

    newCitizen(id, home, role) {
        return {
            id,
            x: home.door.x,
            y: home.door.y,
            home,
            role,
            look: lookOf(id, role, this.data.convs[id]?.name),
            queue: [],
            task: null,
            path: [],
            dir: 1,
            face: "down",
            walking: false,
            inside: role !== "subagent",
            at: home,
            idle: 0,
            thinking: false,
            thinkAt: 0,
            bubble: null,
            emote: null,
            active: new Map(),
            shown: true,
            appear: 0,
            next: 0,
            sit: role === "subagent",
            lastText: "",
            lastThought: "",
            hurt: 0,
            mana: 0,
        };
    }

    // ——— the land, drawn once for each layout ———

    buildTerrain() {
        const things = [
            ...this.places.values(),
            ...this.homes.values(),
            ...this.tents.values(),
            ...(this.castle ? [this.castle] : []),
        ];
        let minX = -PLAZA - 40;
        let minY = -PLAZA - 40;
        let maxX = PLAZA + 40;
        let maxY = PLAZA + 40;

        for (const thing of things) {
            const def = BUILDINGS[thing.kind] ?? { w: 16, h: 14 };

            minX = Math.min(minX, thing.x - def.w / 2 - 20);
            maxX = Math.max(maxX, thing.x + def.w / 2 + 20);
            minY = Math.min(minY, thing.y - def.h - 30);
            maxY = Math.max(maxY, thing.y + 24);
        }

        this.bounds = { minX, minY, maxX, maxY };

        // Never a canvas past what phones allow: a vast world keeps its middle, and the wood covers the rest.
        const pad = 200;
        const most = 3000;
        const wide = Math.min(most, Math.ceil(maxX - minX + pad * 2));
        const tall = Math.min(most, Math.ceil(maxY - minY + pad * 2));
        const box = {
            x: Math.floor((minX + maxX) / 2 - wide / 2),
            y: Math.floor((minY + maxY) / 2 - tall / 2),
            w: wide,
            h: tall,
        };
        const roads = [];

        const own = (trail, stop) => {
            for (let i = 0; i < trail.length - 1; i++) {
                roads.push([trail[i], trail[i + 1]]);

                if (trail[i + 1] === stop) {
                    break;
                }
            }
        };

        for (const place of this.places.values()) {
            own(place.trail);
        }

        for (const home of this.homes.values()) {
            own(home.trail, home.parent ? this.homes.get(home.parent)?.door : undefined);
        }

        if (this.castle) {
            own(this.castle.trail);
        }

        const paths = [...this.tents.values()].flatMap((tent) =>
            tent.trail
                .slice(0, tent.trail.indexOf(tent.home.door) + 1)
                .flatMap((point, index, list) => (index === 0 ? [] : [[list[index - 1], point]])),
        );
        const key = `${box.x},${box.y},${box.w},${box.h}|${roads.map(([a, b]) => `${a.x},${a.y},${b.x},${b.y}`).join(";")}|${paths.map(([a, b]) => `${a.x},${a.y},${b.x},${b.y}`).join(";")}`;

        if (key === this.terrainKey) {
            return;
        }

        this.terrainKey = key;
        this.box = box;

        const canvas = this.terrain ?? document.createElement("canvas");

        canvas.width = box.w;
        canvas.height = box.h;

        const g = canvas.getContext("2d");
        const random = rng(7);
        const ox = -box.x;
        const oy = -box.y;

        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = C.grass;
        g.fillRect(0, 0, box.w, box.h);

        for (let y = 0; y < box.h; y += 4) {
            for (let x = 0; x < box.w; x += 4) {
                const seed = hash(`${x + box.x},${y + box.y}`) % 100;

                if (seed < 18) {
                    g.fillStyle = seed < 9 ? C.grass2 : C.grass3;
                    g.fillRect(x, y, 4, 4);
                } else if (seed < 22) {
                    g.fillStyle = C.leaf3;
                    g.fillRect(x + 1, y + 2, 1, 2);
                    g.fillRect(x + 2, y + 1, 1, 2);
                } else if (seed === 23) {
                    g.fillStyle = [C.pink, C.white, C.gold, C.sky][hash(`${x}${y}`) % 4];
                    g.fillRect(x + 1, y + 1, 1, 1);
                }
            }
        }

        g.translate(ox, oy);

        const stamp = (a, b, size, color) => {
            const steps = Math.max(1, Math.ceil(dist(a, b)));

            g.fillStyle = color;

            for (let i = 0; i <= steps; i++) {
                const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
                const y = Math.round(a.y + ((b.y - a.y) * i) / steps);

                g.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size);
            }
        };

        for (const [a, b] of paths) {
            stamp(a, b, 3, C.dirt2);
        }

        for (const [a, b] of roads) {
            stamp(a, b, 9, C.dirt2);
        }

        for (const [a, b] of roads) {
            stamp(a, b, 7, C.dirt);
        }

        for (const [a, b] of roads) {
            const steps = Math.ceil(dist(a, b) / 5);

            for (let i = 0; i < steps; i++) {
                if (random() < 0.5) {
                    g.fillStyle = random() < 0.5 ? C.dirt2 : C.sand;
                    g.fillRect(
                        Math.round(a.x + ((b.x - a.x) * i) / steps + random() * 6 - 3),
                        Math.round(a.y + ((b.y - a.y) * i) / steps + random() * 6 - 3),
                        1,
                        1,
                    );
                }
            }
        }

        // The plaza: a ring of cobbles.
        const rx = PLAZA + 4;
        const ry = Math.round((PLAZA + 4) * 0.8);

        for (let dy = -ry - 1; dy <= ry + 1; dy++) {
            const half = Math.round((rx + 1) * Math.sqrt(Math.max(0, 1 - (dy / (ry + 1)) ** 2)));

            g.fillStyle = C.stone2;
            g.fillRect(-half, 6 + dy, half * 2, 1);
        }

        for (let dy = -ry; dy <= ry; dy++) {
            const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));

            g.fillStyle = C.stone;
            g.fillRect(-half, 6 + dy, half * 2, 1);

            if ((dy + ry) % 4 === 0) {
                g.fillStyle = shade(C.stone, -0.12);
                g.fillRect(-half, 6 + dy, half * 2, 1);
            } else {
                for (let x = -half + (((dy + ry) >> 2) % 2 ? 2 : 5); x < half; x += 6) {
                    g.fillStyle = shade(C.stone, -0.12);
                    g.fillRect(x, 6 + dy, 1, 1);
                }
            }
        }

        // Trees, bushes, and rocks wherever nothing is built and no road runs.
        // Where nothing grows: the plaza, each building and its yard, and 12 pixels each side of each road,
        // stamped once on a grid of 4-pixel cells, so each tree asks one cell, not every building and road.
        const CELL = 4;
        const cols = Math.ceil(box.w / CELL) + 1;
        const rows = Math.ceil(box.h / CELL) + 1;
        const taken = new Uint8Array(cols * rows);

        const mark = (x0, y0, x1, y1) => {
            const c0 = Math.max(0, Math.floor((x0 - box.x) / CELL));
            const c1 = Math.min(cols - 1, Math.floor((x1 - box.x) / CELL));
            const r0 = Math.max(0, Math.floor((y0 - box.y) / CELL));
            const r1 = Math.min(rows - 1, Math.floor((y1 - box.y) / CELL));

            for (let row = r0; row <= r1; row++) {
                taken.fill(1, row * cols + c0, row * cols + c1 + 1);
            }
        };

        for (const thing of things) {
            const def = BUILDINGS[thing.kind] ?? { w: 18, h: 14 };

            mark(
                thing.x - def.w / 2 - 12,
                thing.y - def.h - 6,
                thing.x + def.w / 2 + 12,
                thing.y + 20,
            );
        }

        for (const [a, b] of [...roads, ...paths]) {
            const steps = Math.max(1, Math.ceil(dist(a, b) / CELL));

            for (let step = 0; step <= steps; step++) {
                const x = a.x + ((b.x - a.x) * step) / steps;
                const y = a.y + ((b.y - a.y) * step) / steps;

                mark(x - 12, y - 12, x + 12, y + 12);
            }
        }

        const near = (x, y) => {
            if ((x / (PLAZA + 26)) ** 2 + ((y - 6) / ((PLAZA + 26) * 0.8)) ** 2 < 1) {
                return true;
            }

            const col = Math.floor((x - box.x) / CELL);
            const row = Math.floor((y - box.y) / CELL);

            return (
                col >= 0 && row >= 0 && col < cols && row < rows && taken[row * cols + col] === 1
            );
        };

        const props = [];

        for (let y = box.y + 10; y < box.y + box.h; y += 13) {
            for (let x = box.x + 6; x < box.x + box.w; x += 13) {
                const seed = hash(`t${x},${y}`);
                const jx = x + (seed % 9) - 4;
                const jy = y + ((seed >>> 8) % 9) - 4;
                const far = Math.hypot(jx, (jy - 10) * 1.2);
                const town = Math.max(
                    Math.abs(minX),
                    Math.abs(maxX),
                    Math.abs(minY),
                    Math.abs(maxY),
                );
                const chance = far > town + 10 ? 0.75 : far > town - 40 ? 0.3 : 0.07;

                if ((seed % 1000) / 1000 > chance || near(jx, jy)) {
                    continue;
                }

                const kind = (seed >>> 16) % 10;

                props.push({
                    x: jx,
                    y: jy,
                    kind: kind < 4 ? "round" : kind < 7 ? "pine" : kind < 9 ? "bush" : "rock",
                    seed,
                });
            }
        }

        props.sort((a, b) => a.y - b.y);

        for (const prop of props) {
            if (prop.kind === "bush") {
                drawBush(g, prop.x, prop.y, prop.seed);
            } else if (prop.kind === "rock") {
                drawRock(g, prop.x, prop.y);
            } else {
                drawTree(g, prop.x, prop.y, prop.kind, prop.seed);
            }
        }

        // The map's edge fades into the endless wood drawn under it, so the two meet with no seam.
        const BAND = 72;

        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = "destination-out";

        for (const [x0, y0, x1, y1, x, y, w, h] of [
            [0, 0, BAND, 0, 0, 0, BAND, box.h],
            [box.w, 0, box.w - BAND, 0, box.w - BAND, 0, BAND, box.h],
            [0, 0, 0, BAND, 0, 0, box.w, BAND],
            [0, box.h, 0, box.h - BAND, 0, box.h - BAND, box.w, BAND],
        ]) {
            const fade = g.createLinearGradient(x0, y0, x1, y1);

            fade.addColorStop(0, "rgba(0,0,0,1)");
            fade.addColorStop(1, "rgba(0,0,0,0)");
            g.fillStyle = fade;
            g.fillRect(x, y, w, h);
        }

        g.globalCompositeOperation = "source-over";
        this.terrain = canvas;
        this.trees = props.filter((prop) => prop.kind === "round" || prop.kind === "pine");
    }

    // ——— walking ———

    /** The way from where a citizen is to a place, by the roads and round the plaza. */
    route(citizen, place, end) {
        const base =
            citizen.at && dist(citizen, citizen.at.door) < 16
                ? citizen.at
                : !citizen.at && dist(citizen, citizen.home.door) < 40
                  ? citizen.home
                  : null;
        const from = base
            ? [pt(citizen.x, citizen.y), ...base.trail]
            : [pt(citizen.x, citizen.y), this.edgeToward(citizen)];
        const to = place.trail;

        for (let i = 0; i < from.length; i++) {
            const j = to.indexOf(from[i]);

            if (j >= 0) {
                return [...from.slice(1, i + 1), ...to.slice(0, j).reverse(), end];
            }
        }

        const a = from.at(-1);
        const b = to.at(-1);

        return [...from.slice(1), ...this.arc(a, b), ...to.slice(0, -1).reverse(), end];
    }

    edgeToward(point) {
        const angle = Math.atan2((point.y - 4) / 0.8, point.x);

        return pt(Math.cos(angle) * LANE, Math.sin(angle) * LANE * 0.8 + 4);
    }

    arc(a, b) {
        const from = Math.atan2((a.y - 4) / 0.8, a.x);
        let delta = Math.atan2((b.y - 4) / 0.8, b.x) - from;

        delta = ((delta + Math.PI * 3) % TAU) - Math.PI;

        const steps = Math.max(1, Math.ceil(Math.abs(delta) / 0.4));
        const out = [];

        for (let i = 1; i < steps; i++) {
            const angle = from + (delta * i) / steps;

            out.push(pt(Math.cos(angle) * LANE, Math.sin(angle) * LANE * 0.8 + 4));
        }

        return [...out, b];
    }

    goTo(citizen, place, end) {
        if (citizen.inside) {
            this.leave(citizen);
        }

        citizen.sit = false;
        citizen.path = this.route(citizen, place, end);
        citizen.at = null;
        citizen.goal = place;
    }

    leave(citizen) {
        citizen.inside = false;
        citizen.x = citizen.home.door.x;
        citizen.y = citizen.home.door.y + 2;
        citizen.home.open = 0.6;
        citizen.appear = 0;
        citizen.at = citizen.home;
    }

    slot(place, citizen) {
        const taken = [...place.workers].filter((each) => each !== citizen).length;

        return pt(
            place.door.x + SLOTS[taken % SLOTS.length],
            place.door.y + 3 + (taken > 8 ? 4 : 0),
        );
    }

    // ——— events ———

    touches(event) {
        if (event.k === "msg") {
            return this.visible.has(event.to) || this.visible.has(event.from);
        }

        if (event.k === "link") {
            return this.visible.has(event.c) || this.visible.has(event.p);
        }

        return this.visible.has(event.c);
    }

    ingest(events, live = true) {
        this.relayoutIfNeeded();

        // A hidden tab draws no frames: keep states, but start no pigeons or coins that would pile up.
        const show = live && !document.hidden;

        for (const event of events) {
            this.apply(event, show);
        }
    }

    chronicleAdd(event) {
        const line = this.describe(event);

        if (line) {
            this.chronicle.unshift(line);
            this.chronicle.length = Math.min(this.chronicle.length, 150);
            this.chronicleVersion++;
        }
    }

    /** One event in words, for the quest log, or null for small ones. */
    describe(event) {
        const who = (id) => this.nameOf(id);
        const base = { id: event.id, at: event.at, c: event.c };

        switch (event.k) {
            case "tool": {
                if (event.n === "subagent" || event.n === "team") {
                    return null;
                }

                const def = event.s ? placeOf(event.s) : null;

                return {
                    ...base,
                    icon: def?.icon ?? "gear",
                    who: who(event.c),
                    text: event.l || event.n,
                    color: def?.color ?? "#c8d0ff",
                };
            }

            case "done":
                return event.ok
                    ? null
                    : {
                          ...base,
                          icon: "skull",
                          who: who(event.c),
                          text: `${event.n} failed${event.e ? `: ${event.e}` : ""}`,
                          color: "#ff6b6b",
                      };
            case "reply":
                if (event.e) {
                    return {
                        ...base,
                        icon: "skull",
                        who: who(event.c),
                        text: event.e,
                        color: "#ff6b6b",
                    };
                }

                return event.text && !event.calls
                    ? {
                          ...base,
                          icon: "speech",
                          who: who(event.c),
                          text: `“${event.text}”`,
                          color: "#a7f070",
                      }
                    : null;

            case "msg": {
                const via = VIA[event.via] ?? VIA.team;

                return {
                    ...base,
                    c: event.to,
                    icon: via.icon,
                    who: event.from ? who(event.from) : "Someone",
                    text: `${via.word} ${who(event.to)}${event.text ? `: “${ellipsize(event.text, 140)}”` : ""}`,
                    color: via.color,
                };
            }

            case "link":
                return event.kind === "subagent"
                    ? {
                          ...base,
                          icon: "tent",
                          who: event.name || who(event.c),
                          text: `pitched a tent by ${who(event.p)}'s house`,
                          color: "#73eff7",
                      }
                    : {
                          ...base,
                          icon: "house",
                          who: who(event.c),
                          text: `built a house down the road from ${who(event.p)}`,
                          color: "#e070c0",
                      };
            default:
                return null;
        }
    }

    refOf(id) {
        if (typeof id !== "string" || id === "") {
            return { type: "edge" };
        }

        if (id.startsWith("human:")) {
            return { type: "royal", id: id.slice(6) };
        }

        if (id.startsWith("station:")) {
            return { type: "place", id: id.slice(8) };
        }

        return this.citizens.has(id) ? { type: "citizen", id } : { type: "edge" };
    }

    posOf(ref) {
        if (ref.type === "citizen") {
            const citizen = this.citizens.get(ref.id);

            if (citizen) {
                return citizen.inside
                    ? { x: citizen.home.x, y: citizen.home.y - 10 }
                    : { x: citizen.x, y: citizen.y - 8 };
            }
        } else if (ref.type === "place") {
            const place = this.places.get(ref.id);

            if (place) {
                return { x: place.x, y: place.y - 20 };
            }
        } else if (ref.type === "royal") {
            const royal = this.royals.get(ref.id);

            if (royal && this.castle) {
                return { x: royal.x, y: royal.y - 8 };
            }
        } else if (ref.type === "home") {
            const home = this.homes.get(ref.id) ?? this.tents.get(ref.id);

            if (home) {
                return { x: home.x, y: home.y - 10 };
            }
        }

        const b = this.bounds ?? { minX: -200, minY: -200, maxX: 200, maxY: 200 };
        const angle = ((ref.seed ?? 1) % 628) / 100;

        return { x: Math.cos(angle) * (b.maxX - b.minX), y: Math.sin(angle) * (b.maxY - b.minY) };
    }

    reveal(entity) {
        if (entity && !entity.shown) {
            entity.shown = true;
            entity.built = 0;
            entity.delay = 0;
        }
    }

    emote(citizen, kind, seconds = 1.6) {
        if (citizen) {
            citizen.emote = { kind, until: this.t + seconds, at: this.t };
        }
    }

    say(citizen, words, kind = "say", seconds = 6) {
        if (citizen && words) {
            citizen.bubble = { text: words, kind, at: this.t, until: this.t + seconds };
        }
    }

    puff(x, y, color = C.white, count = 10) {
        for (let index = 0; index < count; index++) {
            const angle = Math.random() * TAU;

            this.fx.push({
                kind: "puff",
                x,
                y,
                vx: Math.cos(angle) * 18,
                vy: Math.sin(angle) * 10 - 6,
                life: 0.6 + Math.random() * 0.4,
                max: 1,
                color,
                r: 2,
            });
        }
    }

    fly(from, to, color, onArrive) {
        const a = this.posOf(from);
        const b = this.posOf(to);

        this.flyers.push({
            from,
            to,
            a,
            b,
            p: 0,
            dur: 0.9 + Math.min(2.5, dist(a, b) / 140),
            color,
            onArrive,
        });
        this.sound?.play("chirp");
    }

    apply(event, live = true) {
        if (event.k === "msg" && event.via === "human" && typeof event.from === "string") {
            const name = event.from.slice(6);
            const targets = this.humanTargets.get(name) ?? new Set();

            if (!targets.has(event.to)) {
                targets.add(event.to);
                this.humanTargets.set(name, targets);
                this.dirty = true;
            }
        }

        if (event.k === "link") {
            this.dirty = true;
        }

        if (this.dirty) {
            this.relayout();
        }

        if (!this.touches(event)) {
            return;
        }

        if (event.k === "tool" && (live || !this.replay)) {
            this.callTimes.push(this.replay ? performance.now() : event.at);
            this.toolTimes.push(this.t);
        }

        this.chronicleAdd(event);

        const citizen = event.c ? this.citizens.get(event.c) : undefined;

        if (citizen && this.replay) {
            this.reveal(citizen);
            this.reveal(citizen.home);

            if (citizen.home?.home) {
                this.reveal(citizen.home.home);
            }
        }

        switch (event.k) {
            case "tool": {
                if (!citizen) {
                    return;
                }

                citizen.active.set(event.call, { s: event.s, l: event.l, n: event.n });

                if (citizen.inside && live) {
                    this.leave(citizen);
                }

                if (event.n === "subagent" || event.n === "team") {
                    if (live) {
                        const verb =
                            event.a === "spawn"
                                ? "Rise,"
                                : event.a === "start"
                                  ? "Found"
                                  : event.a === "stop"
                                    ? "Halt,"
                                    : event.a === "status"
                                      ? "Report,"
                                      : "To";

                        this.say(citizen, `${verb} ${event.tn ?? ""}!`, "shout", 1.8);
                    }

                    citizen.active.delete(event.call);

                    return;
                }

                const place = event.s ? this.places.get(event.s) : undefined;

                if (this.replay && place) {
                    this.reveal(place);
                }

                citizen.queue.push({
                    kind: "visit",
                    key: event.s,
                    label: event.l || event.n,
                    call: event.call,
                    done: false,
                    ok: true,
                    write: !!event.w,
                    n: event.n,
                });

                // A long line of errands: the oldest finished ones are only counted.
                if (citizen.queue.length > 8) {
                    const finished = citizen.queue.filter(
                        (task) => task.kind === "visit" && task.done,
                    );

                    finished.slice(0, citizen.queue.length - 8).forEach((task) => {
                        citizen.queue.splice(citizen.queue.indexOf(task), 1);
                    });
                }

                return;
            }

            case "done": {
                if (!citizen) {
                    return;
                }

                citizen.active.delete(event.call);

                const task = [citizen.task, ...citizen.queue].find(
                    (each) => each?.call === event.call,
                );

                if (task) {
                    task.done = true;
                    task.ok = !!event.ok;
                    task.error = event.e;
                }

                if (!event.ok) {
                    this.errorTimes.push(this.t);
                }

                return;
            }

            case "think": {
                if (!citizen) {
                    return;
                }

                citizen.thinking = true;
                citizen.thinkAt = this.t;

                const oracle = this.places.get(
                    `model:${event.pv ?? this.data.convs[event.c]?.provider ?? ""}`,
                );

                if (oracle) {
                    oracle.pulse = 1;

                    if (this.replay) {
                        this.reveal(oracle);
                    }
                }

                return;
            }

            case "reply": {
                if (!citizen) {
                    return;
                }

                citizen.thinking = false;

                if (event.th) {
                    citizen.lastThought = event.th;
                }

                if (event.text) {
                    citizen.lastText = event.text;
                }

                const oracle = this.places.get(`model:${event.pv}`);

                if (oracle && live && event.tout) {
                    const coins = Math.min(7, 1 + Math.floor(Math.log2(1 + event.tout / 150)));

                    for (let index = 0; index < coins; index++) {
                        this.fx.push({
                            kind: "coin",
                            from: { x: oracle.x, y: oracle.y - 40 },
                            to: { type: "citizen", id: event.c },
                            p: -index * 0.12,
                            dur: 1.1,
                        });
                    }

                    this.sound?.play("coin");
                }

                if (event.stop === "error" || event.e) {
                    citizen.hurt = 1;
                    this.emote(citizen, "skull", 2.5);
                    this.errorTimes.push(this.t);

                    return;
                }

                if (event.text && !event.calls && live) {
                    this.say(citizen, event.text, "say", 7);
                } else if (event.th && live && !citizen.bubble) {
                    this.say(citizen, event.th, "think", 3.5);
                }

                return;
            }

            case "idle": {
                if (!citizen) {
                    return;
                }

                citizen.thinking = false;
                citizen.active.clear();

                if (!citizen.queue.some((task) => task.kind === "home")) {
                    citizen.queue.push({ kind: "home" });
                }

                return;
            }

            case "msg": {
                const from = this.refOf(event.from);
                const to = this.refOf(event.to);
                const via = VIA[event.via] ?? VIA.team;
                const target = to.type === "citizen" ? this.citizens.get(to.id) : undefined;
                const sender = from.type === "citizen" ? this.citizens.get(from.id) : undefined;

                from.seed = hash(event.from ?? event.id);

                if (from.type === "royal") {
                    const royal = this.royals.get(from.id);

                    if (royal) {
                        royal.pulse = 1;
                    }
                }

                if (this.replay) {
                    this.reveal(sender);
                    this.reveal(target);
                }

                if (!live) {
                    return;
                }

                const arrive = () => {
                    if (target) {
                        this.emote(
                            target,
                            event.via === "stop"
                                ? "skull"
                                : event.via === "human"
                                  ? "letter"
                                  : "scroll",
                            2.2,
                        );

                        if (
                            event.via === "human" ||
                            event.via === "team" ||
                            event.via === "system"
                        ) {
                            this.say(target, event.text, "letter", 4);
                        }

                        if (target.inside) {
                            const home = target.home;

                            home.mail = 3;
                        }
                    }

                    this.sound?.play(event.via === "report" ? "report" : "msg");
                };

                if (
                    event.via === "report" &&
                    sender &&
                    !sender.task &&
                    sender.queue.length === 0 &&
                    target
                ) {
                    sender.queue.push({ kind: "deliver", to: to.id, text: event.text });
                    sender.queue.push({ kind: "home" });

                    return;
                }

                if (event.via === "subagent" && sender) {
                    this.say(sender, event.text, "shout", 2.2);
                }

                if (event.via === "stop" && sender) {
                    this.say(sender, "Halt!", "shout", 1.6);
                }

                if (event.via === "system" && from.type === "place") {
                    const place = this.places.get(from.id);

                    if (place) {
                        place.pulse = 1;
                    }

                    this.sound?.play("bell");
                }

                this.fly(from, to, via.color, arrive);

                return;
            }

            case "link": {
                const child = this.citizens.get(event.c);

                if (child && live) {
                    const parentHome = this.homes.get(event.p);
                    const own = child.home;

                    if (own) {
                        own.built = 0;
                        own.delay = 0;
                    }

                    if (event.kind === "subagent" && parentHome) {
                        child.inside = false;
                        child.x = parentHome.door.x;
                        child.y = parentHome.door.y + 2;
                        child.at = parentHome;
                        child.appear = 0;
                        this.puff(child.x, child.y - 6, C.white, 14);
                        this.emote(child, "star", 2);
                        child.queue.push({ kind: "home" });
                    } else {
                        this.confetti(own?.x ?? 0, (own?.y ?? 0) - 30);
                    }

                    this.sound?.play("link");
                }

                return;
            }

            default:
                return;
        }
    }

    confetti(x, y) {
        for (let index = 0; index < 40; index++) {
            this.fx.push({
                kind: "confetti",
                x: x + Math.random() * 30 - 15,
                y: y - Math.random() * 10,
                vx: Math.random() * 40 - 20,
                vy: -30 - Math.random() * 30,
                life: 1.6 + Math.random(),
                max: 2.6,
                color: SHIRTS[index % SHIRTS.length],
            });
        }
    }

    /** States and the log from past events, without playing each one. */
    derive(events) {
        for (const place of this.places.values()) {
            place.workers.clear();
        }

        for (const event of events) {
            if (event.k === "msg" && event.via === "human" && typeof event.from === "string") {
                const name = event.from.slice(6);

                if (!this.humanTargets.has(name)) {
                    this.humanTargets.set(name, new Set());
                }

                this.humanTargets.get(name).add(event.to);
            }
        }

        this.relayout();

        const now = Date.now();
        const last = new Map();
        const open = new Map();

        this.callTimes = [];

        for (const event of events) {
            if (!this.touches(event)) {
                continue;
            }

            if (event.k === "tool" && now - event.at < 60_000) {
                this.callTimes.push(event.at);
            }

            if (event.c && ["tool", "done", "think", "reply", "idle"].includes(event.k)) {
                last.set(event.c, event);
            }

            if (event.k === "tool" && event.s && event.n !== "subagent" && event.n !== "team") {
                (open.get(event.c) ?? open.set(event.c, new Map()).get(event.c)).set(
                    event.call,
                    event,
                );
            } else if (event.k === "done") {
                open.get(event.c)?.delete(event.call);
            } else if (event.k === "idle") {
                open.get(event.c)?.clear();
            }
        }

        for (const [id, citizen] of this.citizens) {
            const event = last.get(id);
            const fresh = event && now - event.at < 10 * 60_000;

            citizen.active.clear();
            citizen.queue = [];
            citizen.task = null;
            citizen.thinking = !!fresh && (event.k === "think" || event.k === "done");
            // A walk from before is over: from where it stands, it goes to its work or home.
            citizen.path = [];
            citizen.goal = null;
            citizen.at = dist(citizen, citizen.home.door) < 16 ? citizen.home : null;

            if (citizen.thinking) {
                citizen.thinkAt = this.t;
            }

            if (fresh && event.k !== "idle") {
                for (const call of open.get(id)?.values() ?? []) {
                    citizen.active.set(call.call, { s: call.s, l: call.l, n: call.n });
                    citizen.queue.push({
                        kind: "visit",
                        key: call.s,
                        label: call.l,
                        call: call.call,
                        done: false,
                        ok: true,
                        write: !!call.w,
                        n: call.n,
                    });
                }

                if (citizen.inside && (citizen.thinking || citizen.queue.length > 0)) {
                    this.leave(citizen);
                }
            }

            if (!citizen.inside && citizen.queue.length === 0 && citizen.at !== citizen.home) {
                citizen.queue.push({ kind: "home" });
            }
        }

        const lines = [];

        for (let index = events.length - 1; index >= 0 && lines.length < 150; index--) {
            if (this.touches(events[index])) {
                const line = this.describe(events[index]);

                if (line) {
                    lines.push(line);
                }
            }
        }

        this.chronicle = lines;
        this.chronicleVersion++;
    }

    // ——— time-lapse ———

    startReplay(events, seconds = 50) {
        const list = events.filter((event) => this.touches(event));

        if (list.length === 0) {
            return false;
        }

        const times = [0];

        for (let index = 1; index < list.length; index++) {
            times.push(
                times[index - 1] + Math.min(4000, Math.max(0, list[index].at - list[index - 1].at)),
            );
        }

        const scale = (seconds * 1000) / (times.at(-1) || 1);

        this.replay = {
            frozen: {
                visible: new Set(this.visible),
                res: new Set(this.places.keys()),
                humans: new Set(this.royals.keys()),
            },
            list,
            times: times.map((value) => value * scale),
            clock: 0,
            index: 0,
            total: seconds * 1000,
            at: list[0].at,
        };
        this.fx = [];
        this.flyers = [];
        this.chronicle = [];
        this.chronicleVersion++;
        // The replay's own clock: no live counts mixed in.
        this.callTimes = [];
        this.errorTimes = [];
        this.toolTimes = [];

        for (const place of this.places.values()) {
            place.workers.clear();
            place.busy = 0;
        }

        for (const each of [
            ...this.places.values(),
            ...this.homes.values(),
            ...this.tents.values(),
            ...this.citizens.values(),
        ]) {
            each.shown = false;
        }

        for (const citizen of this.citizens.values()) {
            citizen.queue = [];
            citizen.task = null;
            citizen.path = [];
            citizen.active.clear();
            citizen.thinking = false;
            citizen.bubble = null;
            citizen.x = citizen.home.door.x;
            citizen.y = citizen.home.door.y;
        }

        if (this.focus && this.homes.has(this.focus)) {
            this.homes.get(this.focus).shown = true;
            this.citizens.get(this.focus).shown = true;
        }

        this.follow = true;

        return true;
    }

    stopReplay(events) {
        if (!this.replay) {
            return;
        }

        this.replay = null;
        this.errorTimes = [];
        this.toolTimes = [];

        for (const each of [
            ...this.places.values(),
            ...this.homes.values(),
            ...this.tents.values(),
            ...this.citizens.values(),
        ]) {
            each.shown = true;
            each.built = 1;
        }

        this.derive(events);
    }

    // ——— the clock and the weather ———

    hour() {
        if (this.sky === "real") {
            const now = new Date();

            return now.getHours() + now.getMinutes() / 60;
        }

        // Each visit starts on a fresh morning; a day lasts 8 minutes.
        return 8 + (((Date.now() - this.born) / 1000 / 480) % 1) * 24;
    }

    nightness() {
        const hour = this.hour() % 24;

        if (hour >= 21 || hour < 4.5) {
            return 1;
        }

        if (hour >= 18) {
            return (hour - 18) / 3;
        }

        if (hour < 7) {
            return 1 - (hour - 4.5) / 2.5;
        }

        return 0;
    }

    dusk() {
        const hour = this.hour() % 24;

        return (
            Math.max(0, 1 - Math.abs(hour - 18.5) / 1.5) + Math.max(0, 1 - Math.abs(hour - 6) / 1.2)
        );
    }

    storminess() {
        const errors = this.errorTimes.filter((at) => this.t - at < 45).length;
        const calls = this.toolTimes.filter((at) => this.t - at < 45).length;
        const rate = errors / Math.max(6, calls);

        return errors < 3 ? 0 : Math.min(1, Math.max(0, (rate - 0.15) / 0.2));
    }

    // ——— the frame ———

    viewCenter() {
        const { top, right, bottom, left } = this.insets;

        return [
            (left + (this.w - left - right) / 2) * this.dpr,
            (top + (this.h - top - bottom) / 2) * this.dpr,
        ];
    }

    /** Where the world's origin is in the view, in world pixels: not whole, so the camera glides. */
    exact() {
        const [vx, vy] = this.viewCenter();

        return [vx / this.E - this.cam.x, vy / this.E - this.cam.y];
    }

    /** The whole-pixel origin the town is drawn at; the rest of `exact` shifts the finished frame. */
    offset() {
        const [x, y] = this.exact();

        return [Math.floor(x) + 1, Math.floor(y) + 1];
    }

    toWorld(sx, sy) {
        const [ox, oy] = this.exact();

        return { x: (sx * this.dpr) / this.E - ox, y: (sy * this.dpr) / this.E - oy };
    }

    /** Screen pixels for each world pixel, as shown now. */
    get E() {
        return this.S * this.k;
    }

    /**
     * Zoom to S (times k), gliding there in 150 ms. With an anchor (a point on the screen), the
     * world under that point stays under it all the way.
     */
    setScale(S, k = 1, anchor = null) {
        const from = this.E;

        if (S === this.S && k === this.kGoal && !this.glide) {
            return;
        }

        // Less motion: a zoom is a cut.
        if (this.calm) {
            this.S = S;
            this.kGoal = k;
            this.k = k;
            this.glide = null;

            return;
        }

        this.S = S;
        this.kGoal = k;
        this.k = from / S;
        this.glide = {
            from,
            p: 0,
            anchor: anchor && { ...anchor, world: this.toWorld(anchor.x, anchor.y) },
        };
    }

    scaleLimits() {
        return [Math.max(1, Math.round(this.dpr)), Math.max(2, Math.round(5 * this.dpr))];
    }

    fitTarget() {
        const b = this.bounds ?? { minX: -100, minY: -100, maxX: 100, maxY: 100 };
        const { top, right, bottom, left } = this.insets;
        const width = Math.max(80, this.w - left - right) * this.dpr;
        const height = Math.max(80, this.h - top - bottom) * this.dpr;
        const [least] = this.scaleLimits();
        const exact = Math.min(width / (b.maxX - b.minX + 8), height / (b.maxY - b.minY + 8));
        const fits = Math.floor(exact);
        const middle = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };

        // "See all": the whole town, filling the view exactly; drawn at the next whole scale and shrunk.
        if (this.follow === "overview") {
            const most = Math.round(3 * this.dpr);
            // Never so far out that the frame's canvas passes about 4 million pixels: phones run out of memory.
            const floor = Math.sqrt((this.w * this.h * this.dpr * this.dpr) / 4e6);

            if (exact >= floor) {
                const S = Math.max(least, Math.min(most, Math.ceil(exact)));

                return { ...middle, S, k: Math.min(1, exact / S), fits: true };
            }

            // A town too vast for that: as far out as is safe, over its busy part (below).
            const S = Math.max(least, Math.ceil(floor));

            return {
                ...this.busyView(b, width, height, S * Math.min(1, floor / S)),
                S,
                k: Math.min(1, floor / S),
                fits: false,
            };
        }

        // Following, a phone keeps a size that reads well and follows the busy part.
        const comfy = Math.round(2 * this.dpr);
        const S = Math.max(comfy, Math.min(Math.round(3 * this.dpr), fits));

        if (fits >= comfy) {
            return { ...middle, S, k: 1, fits: true };
        }

        // Nearly fits: all of it, a little smaller, beats a crop that hides a new tent or house.
        if (exact >= comfy * 0.75) {
            return { ...middle, S: comfy, k: exact / comfy, fits: true };
        }

        return { ...this.busyView(b, width, height, S), S, k: 1, fits: false };
    }

    /** Too big to fit: the busy part in view, but never a look past the town's edge. */
    busyView(b, width, height, scale) {
        const middle = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
        const busy = [...this.citizens.values()].filter(
            (citizen) => citizen.shown && (citizen.task || citizen.thinking),
        );
        // Busy agents, their homes, and whatever is being built now: where the story is.
        const building = [...this.homes.values(), ...this.tents.values()].filter(
            (thing) => thing.shown && thing.built < 1,
        );
        const around = [...busy, ...busy.map((citizen) => citizen.home), ...building];

        if (around.length === 0) {
            around.push(this.citizens.get(this.focus) ?? middle);
        }

        const xs = around.map((each) => each.x);
        const ys = around.map((each) => each.y - 10);
        const spanX = width / scale / 2;
        const spanY = height / scale / 2;
        const clamp = (value, low, high, span) =>
            high - low <= span * 2
                ? (low + high) / 2
                : Math.max(low + span, Math.min(high - span, value));

        return {
            x: clamp((Math.min(...xs) + Math.max(...xs)) / 2, b.minX - 8, b.maxX + 8, spanX),
            y: clamp((Math.min(...ys) + Math.max(...ys)) / 2, b.minY - 8, b.maxY + 8, spanY),
            spanX,
            spanY,
        };
    }

    update(dt) {
        this.t += dt;

        const t = this.t;

        if (this.replay) {
            const replay = this.replay;

            replay.clock += dt * 1000;

            while (
                replay.index < replay.list.length &&
                replay.times[replay.index] <= replay.clock
            ) {
                const event = replay.list[replay.index++];

                replay.at = event.at;
                this.apply(event, true);
            }

            if (replay.index >= replay.list.length && replay.clock > replay.total + 2500) {
                this.onReplayEnd?.();
            }
        }

        // The camera.
        // Following, the camera holds still: it looks again every 2 seconds, and moves only when
        // the busy part has left the middle of the view, so the town never swims under the eye.
        this.aimIn = (this.aimIn ?? 0) - dt;

        if (this.follow && (this.aimIn <= 0 || this.aimS !== this.S * 100 + this.kGoal)) {
            const target = this.fitTarget();
            const fresh = this.aimS !== target.S * 100 + target.k;
            // In its first moments the page is still measuring its panels: cut, do not glide.
            const first =
                this.aimS === undefined ||
                Date.now() - this.born < 1500 ||
                Date.now() < (this.cutUntil ?? 0);

            this.aimIn = 2;
            this.aimS = target.S * 100 + target.k;
            this.setScale(target.S, target.k);

            if (first) {
                this.k = target.k;
                this.glide = null;
                this.cam.x = this.camT.x = target.x;
                this.cam.y = this.camT.y = target.y;
            }

            if (
                fresh ||
                target.fits ||
                Math.abs(target.x - this.camT.x) > target.spanX * 0.45 ||
                Math.abs(target.y - this.camT.y) > target.spanY * 0.45
            ) {
                this.camT.x = target.x;
                this.camT.y = target.y;
            }
        } else if (this.tracking) {
            const where =
                this.tracking.type === "citizen"
                    ? this.citizens.get(this.tracking.id)
                    : (this.places.get(this.tracking.id) ?? this.homes.get(this.tracking.id));

            if (where) {
                this.camT.x = where.x;
                this.camT.y = where.y - 12;
            }
        }

        // A zoom glides: the scale eases to its goal, keeping the anchor's world point in place.
        if (this.glide) {
            const glide = this.glide;

            glide.p = Math.min(1, glide.p + dt / 0.18);

            const eased = glide.p * glide.p * (3 - 2 * glide.p);

            this.k = (glide.from + (this.S * this.kGoal - glide.from) * eased) / this.S;

            if (glide.anchor) {
                const [vx, vy] = this.viewCenter();
                const { x, y, world } = glide.anchor;

                this.cam.x = world.x - (x * this.dpr - vx) / this.E;
                this.cam.y = world.y - (y * this.dpr - vy) / this.E;
                this.camT.x = this.cam.x;
                this.camT.y = this.cam.y;
            }

            if (glide.p >= 1) {
                this.k = this.kGoal;
                this.glide = null;
            }
        }

        const ease = 1 - Math.exp(-dt * (this.follow ? 1.8 : 4));

        // Dragged or not, the middle of the view stays over the town, so it is never lost.
        if (this.bounds) {
            const b = this.bounds;

            this.camT.x = Math.max(b.minX, Math.min(b.maxX, this.camT.x));
            this.camT.y = Math.max(b.minY, Math.min(b.maxY, this.camT.y));
        }

        this.cam.x += (this.camT.x - this.cam.x) * ease;
        this.cam.y += (this.camT.y - this.cam.y) * ease;

        // Buildings.
        for (const thing of [
            ...this.places.values(),
            ...this.homes.values(),
            ...this.tents.values(),
            ...(this.castle ? [this.castle] : []),
        ]) {
            if (thing.shown && thing.built < 1) {
                if (thing.delay > 0) {
                    thing.delay -= dt;
                } else {
                    const was = thing.built;

                    thing.built = Math.min(
                        1,
                        thing.built + dt / (thing.kind === "tent" ? 0.8 : 1.6),
                    );

                    if (was === 0 || Math.random() < dt * 6) {
                        this.puff(thing.x + Math.random() * 20 - 10, thing.y - 2, C.sand, 2);
                    }
                }
            }

            thing.pulse = Math.max(0, (thing.pulse ?? 0) - dt * 0.8);
            thing.open = Math.max(0, (thing.open ?? 0) - dt);
            thing.mail = Math.max(0, (thing.mail ?? 0) - dt);

            if (thing.sail > 0) {
                thing.sail = thing.sail > 1.9 ? 0 : thing.sail + dt * 0.35;
            }
        }

        // Citizens.
        for (const citizen of this.citizens.values()) {
            this.think(citizen, dt);
        }

        for (const royal of this.royals.values()) {
            royal.pulse = Math.max(0, royal.pulse - dt);
        }

        // Chickens.
        for (const chicken of this.critters) {
            if (t > chicken.next) {
                chicken.next = t + 2 + Math.random() * 4;
                chicken.tx = chicken.home.x + Math.random() * 60 - 30;
                chicken.ty = chicken.home.y + 10 + Math.random() * 16;
            }

            const dx = chicken.tx - chicken.x;
            const dy = chicken.ty - chicken.y;
            const d = Math.hypot(dx, dy);

            if (d > 1) {
                chicken.x += (dx / d) * dt * 10;
                chicken.y += (dy / d) * dt * 10;
                chicken.dir = dx > 0 ? 1 : -1;
            }
        }

        // Smoke, sparks, and the life of the town.
        const night = this.nightness();

        for (const home of this.homes.values()) {
            const owner = this.citizens.get(home.id);

            if (
                home.built >= 1 &&
                (owner?.inside || owner?.thinking || night > 0.5) &&
                Math.random() < dt * 2.2
            ) {
                this.fx.push({
                    kind: "smoke",
                    x: home.x + 9,
                    y: home.y - 37,
                    vx: 3,
                    vy: -9,
                    life: 2.4,
                    max: 2.4,
                    r: 1,
                });
            }
        }

        for (const place of this.places.values()) {
            const busy = place.workers.size > 0;

            place.busy = busy;

            if (place.kind === "forge" && Math.random() < dt * (busy ? 5 : 1.2)) {
                this.fx.push({
                    kind: "smoke",
                    x: place.x + 13,
                    y: place.y - 40,
                    vx: 4,
                    vy: -10,
                    life: 2.6,
                    max: 2.6,
                    r: 1,
                    dark: true,
                });
            }

            if (busy && Math.random() < dt * 8) {
                this.ambience(place);
            }
        }

        if (night > 0.6 && this.fx.length < 500 && this.trees?.length && Math.random() < dt * 3) {
            const tree = this.trees[Math.floor(Math.random() * this.trees.length)];

            this.fx.push({
                kind: "firefly",
                x: tree.x + Math.random() * 20 - 10,
                y: tree.y - 6 - Math.random() * 10,
                vx: Math.random() * 6 - 3,
                vy: Math.random() * 4 - 2,
                life: 4,
                max: 4,
            });
        }

        if (night < 0.3 && this.fx.length < 500 && Math.random() < dt * 0.4) {
            const b = this.bounds;

            if (b) {
                this.fx.push({
                    kind: "butterfly",
                    x: b.minX + Math.random() * (b.maxX - b.minX),
                    y: b.minY + Math.random() * (b.maxY - b.minY),
                    vx: Math.random() * 16 - 8,
                    vy: Math.random() * 6 - 3,
                    life: 8,
                    max: 8,
                    color: [C.white, C.gold, C.pink, C.cyan][Math.floor(Math.random() * 4)],
                });
            }
        }

        if (t > this.nextFlock && this.bounds) {
            this.nextFlock = t + 25 + Math.random() * 30;

            const b = this.bounds;
            const y = b.minY + Math.random() * (b.maxY - b.minY);

            for (let index = 0; index < 5; index++) {
                this.fx.push({
                    kind: "bird",
                    x: b.minX - 60 - Math.abs(index - 2) * 8,
                    y: y + (index - 2) * 6,
                    vx: 36,
                    vy: -4,
                    life: 14,
                    max: 14,
                });
            }
        }

        // Weather.
        const storm = this.storminess();

        for (const cloud of this.clouds) {
            cloud.x += cloud.v * dt * (1 + storm * 2);

            const b = this.bounds ?? { minX: -300, maxX: 300, minY: -300, maxY: 300 };

            if (cloud.x - cloud.r > b.maxX + 100) {
                cloud.x = b.minX - 100 - cloud.r;
                cloud.y = b.minY + Math.random() * (b.maxY - b.minY);
            }
        }

        if (storm > 0 && !this.calm) {
            const [ox, oy] = this.offset();
            const count = dt * 220 * storm;

            for (let index = 0; index < count && this.fx.length < 700; index++) {
                const x = -ox + Math.random() * (this.canvas.width / this.E + 40);
                const y = -oy + Math.random() * (this.canvas.height / this.E) - 20;

                this.fx.push({
                    kind: "rain",
                    x,
                    y,
                    vx: -12,
                    vy: 140,
                    life: 0.35 + Math.random() * 0.25,
                    max: 0.6,
                });
            }

            if (t > this.nextBolt) {
                this.nextBolt = t + 5 + Math.random() * 9;
                // No flash of the whole screen for people who asked for less motion.
                this.flash = this.calm ? 0 : 1;
                this.sound?.play("thunder");
            }
        }

        this.flash = Math.max(0, this.flash - dt * 3);

        // Moving things.
        const alive = [];

        for (const f of this.fx) {
            f.life = (f.life ?? 1) - (f.kind === "coin" ? 0 : dt);

            switch (f.kind) {
                case "coin": {
                    f.p += dt / f.dur;

                    if (f.p >= 1) {
                        continue;
                    }

                    if (f.p > 0) {
                        const target = this.posOf(f.to);

                        f.x = f.from.x + (target.x - f.from.x) * f.p;
                        f.y = f.from.y + (target.y - f.from.y) * f.p - Math.sin(f.p * Math.PI) * 26;
                    }

                    alive.push(f);
                    continue;
                }

                case "mana": {
                    f.p += dt / f.dur;

                    if (f.p >= 1) {
                        continue;
                    }

                    f.x = f.a.x + (f.b.x - f.a.x) * f.p + Math.sin(f.p * 9 + f.seed) * 3;
                    f.y = f.a.y + (f.b.y - f.a.y) * f.p - Math.sin(f.p * Math.PI) * 18;
                    alive.push(f);
                    continue;
                }

                case "smoke":
                    f.r = 1 + (1 - f.life / f.max) * 3;
                    break;
                case "spark":
                case "confetti":
                    f.vy += 90 * dt;
                    break;
                case "firefly":
                case "butterfly":
                    f.vx += (Math.random() - 0.5) * 40 * dt;
                    f.vy += (Math.random() - 0.5) * 30 * dt;
                    break;
                default:
                    break;
            }

            f.x += (f.vx ?? 0) * dt;
            f.y += (f.vy ?? 0) * dt;

            if (f.kind === "rain" && f.life <= 0 && Math.random() < 0.3) {
                alive.push({ kind: "splash", x: f.x, y: f.y, life: 0.2, max: 0.2 });
            }

            if (f.life > 0) {
                alive.push(f);
            }
        }

        this.fx = alive;

        const flying = [];

        for (const flyer of this.flyers) {
            flyer.p += dt / flyer.dur;
            flyer.b = this.posOf(flyer.to);
            flyer.a = flyer.a ?? this.posOf(flyer.from);

            if (flyer.p >= 1) {
                flyer.onArrive?.();
                this.puff(flyer.b.x, flyer.b.y, C.white, 4);
                continue;
            }

            flying.push(flyer);
        }

        this.flyers = flying;

        const cutoff = (this.replay ? performance.now() : Date.now()) - 60_000;

        while (this.callTimes.length > 0 && this.callTimes[0] < cutoff) {
            this.callTimes.shift();
        }

        this.errorTimes = this.errorTimes.filter((at) => t - at < 120);
        this.toolTimes = this.toolTimes.filter((at) => t - at < 120);
    }

    ambience(place) {
        const x = place.door.x;
        const y = place.y - 14;

        switch (place.kind) {
            case "forge":
                for (let index = 0; index < 3; index++) {
                    this.fx.push({
                        kind: "spark",
                        x: place.x + 10,
                        y: place.y - 7,
                        vx: Math.random() * 50 - 25,
                        vy: -30 - Math.random() * 30,
                        life: 0.5,
                        max: 0.5,
                        color: Math.random() < 0.5 ? C.gold : C.orange,
                    });
                }

                break;
            case "library":
                this.fx.push({
                    kind: "glyph",
                    x: x + Math.random() * 30 - 15,
                    y: y - 8,
                    vx: 0,
                    vy: -10,
                    life: 1.2,
                    max: 1.2,
                    color: C.cyan,
                    char: "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)],
                });
                break;
            case "vault":
                this.fx.push({
                    kind: "glyph",
                    x: x + Math.random() * 20 - 10,
                    y: y - 4,
                    vx: 0,
                    vy: -8,
                    life: 1.4,
                    max: 1.4,
                    color: "#b48cff",
                    char: "*",
                });
                break;
            case "gallery":
                this.fx.push({
                    kind: "spark",
                    x: x + Math.random() * 30 - 15,
                    y: y,
                    vx: Math.random() * 20 - 10,
                    vy: -20,
                    life: 0.8,
                    max: 0.8,
                    color: SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
                });
                break;
            case "observatory":
                this.fx.push({
                    kind: "twinkle",
                    x: place.x + 10 + Math.random() * 20,
                    y: place.y - 50 - Math.random() * 16,
                    life: 0.6,
                    max: 0.6,
                });
                break;
            case "workshop":
            case "guild":
            case "embassy":
                if (Math.random() < 0.3) {
                    this.fx.push({
                        kind: "spark",
                        x,
                        y: y - 4,
                        vx: Math.random() * 30 - 15,
                        vy: -24,
                        life: 0.5,
                        max: 0.5,
                        color: C.silver,
                    });
                }

                break;
            default:
                break;
        }
    }

    /** One citizen's mind: what it does next, and its steps. */
    think(citizen, dt) {
        const t = this.t;

        citizen.appear = Math.min(1, citizen.appear + dt * 3);
        citizen.hurt = Math.max(0, citizen.hurt - dt * 0.6);

        if (citizen.bubble && t > citizen.bubble.until) {
            citizen.bubble = null;
        }

        if (citizen.emote && t > citizen.emote.until) {
            citizen.emote = null;
        }

        if (citizen.thinking && t - citizen.thinkAt > 600) {
            citizen.thinking = false;
        }

        // Thinking: a stream of mana to the oracle.
        if (citizen.thinking && !citizen.inside && this.fx.length < 600 && t > citizen.mana) {
            citizen.mana = t + 0.18;

            const oracle = this.places.get(`model:${this.data.convs[citizen.id]?.provider ?? ""}`);

            if (oracle && oracle.shown) {
                this.fx.push({
                    kind: "mana",
                    a: { x: citizen.x, y: citizen.y - 18 },
                    b: { x: oracle.x, y: oracle.y - 39 },
                    p: 0,
                    dur: 1.2,
                    seed: Math.random() * 6,
                    color: oracle.color,
                });
            }
        }

        // Next errand.
        if (!citizen.task && citizen.queue.length > 0) {
            citizen.task = citizen.queue.shift();
            citizen.task.phase = "start";
        }

        const task = citizen.task;
        const hurry = citizen.queue.length;

        citizen.run = hurry >= 2;

        if (task) {
            citizen.idle = 0;

            if (task.kind === "visit") {
                const place = task.key ? this.places.get(task.key) : undefined;

                if (task.phase === "start") {
                    if (!place) {
                        task.phase = "work";
                        task.started = t;
                    } else {
                        this.goTo(citizen, place, this.slot(place, citizen));
                        place.workers.add(citizen);
                        task.phase = "go";
                    }
                }

                if (task.phase === "go" && citizen.path.length === 0) {
                    task.phase = "work";
                    task.started = t;
                    citizen.at = place;
                    citizen.face = "up";

                    if (place) {
                        place.workers.add(citizen);
                        place.pulse = 1;
                        this.sound?.play("tool", place.def.order);

                        if (place.kind === "harbor" && /\bpush\b/.test(task.label ?? "")) {
                            place.sail = 0.01;
                        }
                    }
                }

                if (task.phase === "work") {
                    const least = hurry > 3 ? 0.25 : 0.9;

                    if ((task.done && t - task.started >= least) || t - task.started > 120) {
                        place?.workers.delete(citizen);
                        citizen.face = "down";
                        citizen.task = null;

                        if (task.done && !task.ok) {
                            citizen.hurt = 1;
                            this.emote(citizen, "skull", 2);

                            if (place) {
                                for (let index = 0; index < 6; index++) {
                                    this.fx.push({
                                        kind: "smoke",
                                        x: place.x + Math.random() * 20 - 10,
                                        y: place.y - 20,
                                        vx: Math.random() * 8 - 4,
                                        vy: -12,
                                        life: 1.6,
                                        max: 1.6,
                                        r: 2,
                                        dark: true,
                                    });
                                }
                            }

                            this.sound?.play("error");
                        } else if (hurry === 0) {
                            this.emote(citizen, "check", 0.9);
                        }
                    }
                }
            } else if (task.kind === "home") {
                if (task.phase === "start") {
                    this.goTo(citizen, citizen.home, citizen.home.door);
                    task.phase = "go";
                }

                if (task.phase === "go" && citizen.path.length === 0) {
                    citizen.at = citizen.home;
                    citizen.task = null;
                    citizen.rested = t;
                    citizen.face = "down";

                    if (citizen.role === "subagent") {
                        citizen.sit = true;
                    }
                }
            } else if (task.kind === "deliver") {
                const target = this.citizens.get(task.to);

                if (!target) {
                    citizen.task = null;
                } else {
                    const where = target.inside ? target.home.door : target;

                    if (task.phase === "start" || (task.phase === "go" && t > (task.repath ?? 0))) {
                        task.repath = t + 0.6;
                        this.goTo(
                            citizen,
                            target.inside ? target.home : (target.at ?? target.home),
                            pt(where.x + 7, where.y + 1),
                        );
                        task.phase = "go";
                    }

                    if (task.phase === "go" && citizen.path.length === 0) {
                        task.phase = "hand";
                        task.started = t;
                        citizen.dir = -1;
                        citizen.face = "side";
                        this.emote(citizen, "scroll", 1.4);
                        this.emote(target, "check", 1.4);
                        this.say(citizen, task.text || "Done!", "say", 3);
                        this.sound?.play("report");
                    }

                    if (task.phase === "hand" && t - task.started > 1.2) {
                        citizen.task = null;
                    }
                }
            } else if (task.kind === "wander") {
                if (task.phase === "start") {
                    citizen.path = [pt(task.x, task.y)];
                    citizen.at = null;
                    task.phase = "go";
                }

                if (citizen.path.length === 0) {
                    citizen.task = null;
                    citizen.at = dist(citizen, citizen.home.door) < 16 ? citizen.home : null;
                }
            }
        } else if (!citizen.inside) {
            citizen.idle += dt;

            const atHome = dist(citizen, citizen.home.door) < 30;

            if (!atHome && citizen.idle > 3 && !citizen.thinking) {
                citizen.queue.push({ kind: "home" });
            } else if (atHome && !citizen.thinking) {
                if (citizen.role !== "subagent" && citizen.idle > 18 && this.citizens.size > 0) {
                    // Home for the night, or for a rest.
                    citizen.inside = true;
                    citizen.home.open = 0.6;
                    citizen.path = [];
                } else if (t > citizen.next) {
                    citizen.next = t + 5 + Math.random() * 9;

                    if (Math.random() < 0.6) {
                        citizen.sit = false;
                        citizen.task = {
                            kind: "wander",
                            phase: "start",
                            x: citizen.home.door.x + Math.random() * 40 - 20,
                            y: citizen.home.door.y + 4 + Math.random() * 14,
                        };
                    } else if (citizen.role === "subagent") {
                        citizen.sit = true;
                    }
                }
            }
        }

        // Steps.
        if (citizen.path.length > 0) {
            const speed =
                (hurry >= 5 ? 95 : hurry >= 2 ? 58 : 32) * (task?.kind === "wander" ? 0.45 : 1);
            const next = citizen.path[0];
            const dx = next.x - citizen.x;
            const dy = next.y - citizen.y;
            const d = Math.hypot(dx, dy);
            const step = speed * dt;

            citizen.walking = true;

            if (d <= step) {
                citizen.x = next.x;
                citizen.y = next.y;
                citizen.path.shift();
            } else {
                citizen.x += (dx / d) * step;
                citizen.y += (dy / d) * step;
            }

            if (Math.abs(dx) > Math.abs(dy) * 0.6) {
                citizen.dir = dx > 0 ? 1 : -1;
                citizen.face = "side";
            } else {
                citizen.face = dy < 0 ? "up" : "down";
            }

            if (citizen.run && Math.random() < dt * 8) {
                this.fx.push({
                    kind: "dust",
                    x: citizen.x - citizen.dir * 3,
                    y: citizen.y,
                    vx: -citizen.dir * 6,
                    vy: -3,
                    life: 0.4,
                    max: 0.4,
                });
            }
        } else {
            citizen.walking = false;
        }
    }

    render() {
        const W = this.canvas.width;
        const H = this.canvas.height;
        const S = this.E;
        const bw = Math.ceil(W / S) + 2;
        const bh = Math.ceil(H / S) + 2;

        // Canvases keep their size while a zoom glides (a resize clears and reallocates them):
        // they grow with room to spare, and shrink only once the scale has settled.
        const small = this.buf.width < bw || this.buf.height < bh;
        const loose =
            !this.glide && (this.buf.width > bw * 1.5 + 16 || this.buf.height > bh * 1.5 + 16);

        if (small || loose) {
            const room = small && this.glide ? 1.25 : 1;

            this.buf.width = Math.ceil(bw * room);
            this.buf.height = Math.ceil(bh * room);
            this.dark.width = Math.ceil(bw * room);
            this.dark.height = Math.ceil(bh * room);
        }

        const b = this.b;
        const t = this.t;
        const [ox, oy] = this.offset();
        const view = { x: -ox - 80, y: -oy - 80, w: bw + 160, h: bh + 160 };
        const inView = (x, y) =>
            x > view.x && x < view.x + view.w && y > view.y && y < view.y + view.h;
        const night = this.nightness();

        b.setTransform(1, 0, 0, 1, 0, 0);
        b.imageSmoothingEnabled = false;
        b.globalCompositeOperation = "source-over";
        b.globalAlpha = 1;
        b.fillStyle = this.forest();
        b.setTransform(1, 0, 0, 1, ((ox % 96) + 96) % 96, ((oy % 96) + 96) % 96);
        b.fillRect(-96, -96, bw + 192, bh + 192);
        b.setTransform(1, 0, 0, 1, 0, 0);

        if (this.terrain) {
            b.drawImage(this.terrain, this.box.x + ox, this.box.y + oy);
        }

        b.translate(ox, oy);

        // Everything that stands, back to front.
        // Only what is in view, in a list kept from frame to frame.
        const drawables = (this.drawables ??= []);

        drawables.length = 0;

        for (const place of this.places.values()) {
            if (!inView(place.x, place.y)) {
                continue;
            }

            drawables.push({
                y: place.y,
                draw: () =>
                    this.drawBuilding(place, place.kind, {
                        flag: place.color,
                        rgb: place.color,
                        busy: place.busy,
                        sail: place.sail,
                    }),
            });
        }

        for (const home of this.homes.values()) {
            if (!inView(home.x, home.y)) {
                continue;
            }

            const owner = this.citizens.get(home.id);

            drawables.push({
                y: home.y,
                draw: () =>
                    this.drawBuilding(home, "home", {
                        roof: home.roof,
                        wall: home.wall,
                        lit: owner?.inside || night > 0.3,
                        mail: home.mail > 0,
                    }),
            });
        }

        for (const tent of this.tents.values()) {
            if (!inView(tent.x, tent.y)) {
                continue;
            }

            const owner = this.citizens.get(tent.id);

            drawables.push({
                y: tent.y,
                draw: () => {
                    if (tent.shown && tent.built > 0) {
                        this.withBuild(tent, 14, 13, () =>
                            drawTent(b, tent.x, tent.y, tent.color, night > 0.4),
                        );

                        if (night > 0.4 && owner && owner.sit && !owner.task) {
                            drawCampfire(b, tent.x + 9, tent.y + 6, t);
                        }
                    }
                },
            });
        }

        if (this.castle) {
            drawables.push({
                y: this.castle.y,
                draw: () => this.drawBuilding(this.castle, "castle", { lit: night > 0.3 }),
            });
        }

        drawables.push({
            y: this.fountain.y + 1,
            draw: () => BUILDINGS.fountain.draw(b, this.fountain.x, this.fountain.y + 1, { t }),
        });

        for (const lantern of this.lanterns) {
            if (!inView(lantern.x, lantern.y)) {
                continue;
            }

            drawables.push({
                y: lantern.y,
                draw: () => drawLantern(b, lantern.x, lantern.y, night > 0.3),
            });
        }

        for (const chicken of this.critters) {
            if (!inView(chicken.x, chicken.y)) {
                continue;
            }

            drawables.push({
                y: chicken.y,
                draw: () =>
                    drawChicken(
                        b,
                        Math.round(chicken.x),
                        Math.round(chicken.y),
                        t,
                        chicken.dir,
                        chicken.seed,
                    ),
            });
        }

        for (const citizen of this.citizens.values()) {
            if (
                inView(citizen.x, citizen.y) &&
                !citizen.inside &&
                citizen.shown &&
                (citizen.home.built >= 1 || citizen.path.length > 0 || citizen.task)
            ) {
                drawables.push({ y: citizen.y, draw: () => this.drawCitizen(citizen) });
            }
        }

        drawables.sort((a, c) => a.y - c.y);

        for (const each of drawables) {
            each.draw();
        }

        // Royals on the castle wall.
        if (this.castle && this.castle.built >= 1) {
            for (const royal of this.royals.values()) {
                drawPerson(
                    b,
                    royal.x,
                    royal.y + (royal.pulse > 0 ? -Math.round(Math.abs(Math.sin(t * 12)) * 2) : 0),
                    royal.look,
                    { t, face: "down" },
                );
            }
        }

        // Effects.
        for (const f of this.fx) {
            const alpha = Math.max(0, Math.min(1, (f.life ?? 1) / (f.max ?? 1)));
            const x = Math.round(f.x);
            const y = Math.round(f.y);

            if (f.x === undefined || !inView(x, y)) {
                continue;
            }

            switch (f.kind) {
                case "smoke":
                    b.globalAlpha = alpha * 0.7;
                    disc(b, x, y, Math.round(f.r), f.dark ? C.steel : C.silver);
                    break;
                case "puff":
                case "dust":
                    b.globalAlpha = alpha;
                    disc(
                        b,
                        x,
                        y,
                        f.kind === "dust" ? 1 : Math.round(1 + (1 - alpha) * 2),
                        f.color ?? C.sand,
                    );
                    break;
                case "spark":
                case "confetti":
                    b.globalAlpha = alpha;
                    px(b, x, y, f.color);
                    break;

                case "coin": {
                    if (f.p <= 0) {
                        break;
                    }

                    const wide = Math.floor(t * 12 + f.p * 10) % 2;

                    rect(b, x - (wide ? 1 : 0), y - 1, wide ? 3 : 1, 3, C.gold);
                    px(b, x, y - 1, C.white);
                    break;
                }

                case "mana":
                    px(b, x, y, Math.floor(t * 20 + f.seed * 3) % 2 ? f.color : C.white);
                    break;
                case "firefly":
                    if (Math.floor(t * 3 + f.max * 7) % 3 !== 0) {
                        b.globalAlpha = alpha;
                        px(b, x, y, "#e4ff7a");
                    }

                    break;

                case "butterfly": {
                    const flap = Math.floor(t * 10) % 2;

                    px(b, x, y, C.ink);
                    px(b, x - 1, y - flap, f.color);
                    px(b, x + 1, y - flap, f.color);
                    break;
                }

                case "bird": {
                    const flap = Math.floor(t * 6 + x) % 2;

                    b.globalAlpha = 0.25;
                    px(b, x, y + 40, C.ink);
                    b.globalAlpha = 1;
                    px(b, x, y, C.ink);
                    px(b, x - 1, y - flap, C.ink);
                    px(b, x + 1, y - flap, C.ink);
                    px(b, x - 2, y - 1 + flap, C.ink);
                    px(b, x + 2, y - 1 + flap, C.ink);
                    break;
                }

                case "glyph":
                    b.globalAlpha = alpha;
                    text(b, f.char, x, y, f.color, { outline: null });
                    break;
                case "twinkle":
                    b.globalAlpha = alpha;
                    px(b, x, y, C.white);
                    px(b, x - 1, y, C.gold);
                    px(b, x + 1, y, C.gold);
                    px(b, x, y - 1, C.gold);
                    px(b, x, y + 1, C.gold);
                    break;
                default:
                    break;
            }

            b.globalAlpha = 1;
        }

        // Pigeons: their shadow on the ground, and them in the air.
        for (const flyer of this.flyers) {
            const p = flyer.p;
            const x = Math.round(flyer.a.x + (flyer.b.x - flyer.a.x) * p);
            const ground = flyer.a.y + (flyer.b.y - flyer.a.y) * p;
            const lift = Math.sin(p * Math.PI) * Math.min(60, 16 + dist(flyer.a, flyer.b) * 0.25);

            b.globalAlpha = 0.25;
            rect(b, x - 2, Math.round(ground + 8), 5, 1, C.ink);
            b.globalAlpha = 1;
            drawPigeon(b, x, Math.round(ground - lift), t, flyer.color);
        }

        // Cloud shadows.
        const storm = this.storminess();

        for (const cloud of this.clouds) {
            if (!inView(cloud.x, cloud.y) && !inView(cloud.x + cloud.r, cloud.y)) {
                continue;
            }

            b.fillStyle = `rgba(16,14,40,${0.07 + storm * 0.1})`;

            for (let dy = -cloud.r * 0.45; dy <= cloud.r * 0.45; dy += 2) {
                const half = Math.round(
                    cloud.r * Math.sqrt(Math.max(0, 1 - (dy / (cloud.r * 0.45)) ** 2)),
                );

                b.fillRect(Math.round(cloud.x - half), Math.round(cloud.y + dy), half * 2, 2);
            }
        }

        for (const f of this.fx) {
            if (f.kind === "rain") {
                rect(b, Math.round(f.x), Math.round(f.y), 1, 3, "rgba(160,200,255,0.6)");
            } else if (f.kind === "splash") {
                px(b, Math.round(f.x) - 1, Math.round(f.y), "rgba(200,220,255,0.7)");
                px(b, Math.round(f.x) + 1, Math.round(f.y), "rgba(200,220,255,0.7)");
            }
        }

        // Night, and the lights that pierce it.
        const dusk = this.dusk();

        if (dusk > 0.02) {
            b.fillStyle = `rgba(239,125,87,${0.13 * Math.min(1, dusk)})`;
            b.fillRect(-ox, -oy, bw, bh);
        }

        const darkness = Math.min(1, night * 0.62 + storm * 0.3);

        if (darkness > 0.02) {
            const d = this.d;
            const lights = this.lights(night);

            d.setTransform(1, 0, 0, 1, 0, 0);
            d.globalCompositeOperation = "source-over";
            d.clearRect(0, 0, bw, bh);
            d.fillStyle = `rgba(10,12,44,${darkness})`;
            d.fillRect(0, 0, bw, bh);
            d.globalCompositeOperation = "destination-out";
            d.translate(ox, oy);

            for (const light of lights) {
                if (!inView(light.x, light.y)) {
                    continue;
                }

                for (const [factor, alpha] of [
                    [1, 0.3],
                    [0.7, 0.35],
                    [0.42, 0.5],
                ]) {
                    d.globalAlpha = alpha * night;
                    disc(d, light.x, light.y, Math.max(1, Math.round(light.r * factor)), "#000");
                }
            }

            d.globalAlpha = 1;
            b.setTransform(1, 0, 0, 1, 0, 0);
            b.drawImage(this.dark, 0, 0, bw, bh, 0, 0, bw, bh);
            b.translate(ox, oy);
            b.globalCompositeOperation = "lighter";

            for (const light of lights) {
                if (inView(light.x, light.y)) {
                    b.globalAlpha = 0.18 * night;
                    disc(b, light.x, light.y, Math.round(light.r * 0.4), light.color ?? C.orange);
                }
            }

            b.globalAlpha = 1;
            b.globalCompositeOperation = "source-over";
        }

        if (this.flash > 0) {
            b.setTransform(1, 0, 0, 1, 0, 0);
            b.fillStyle = `rgba(230,240,255,${this.flash * 0.55})`;
            b.fillRect(0, 0, bw, bh);
        }

        // The frame moves by whole screen pixels between the town's, so the camera glides.
        const [ex, ey] = this.exact();
        const shiftX = Math.round((ex - ox) * S);
        const shiftY = Math.round((ey - oy) * S);

        b.setTransform(1, 0, 0, 1, 0, 0);
        // Shrunk to fit, smooth: every pixel the same size. Whole or growing, sharp.
        this.out.imageSmoothingEnabled = S < this.S - 0.01;
        this.out.imageSmoothingQuality = "high";
        this.out.clearRect(0, 0, W, H);
        this.out.drawImage(this.buf, 0, 0, bw, bh, shiftX, shiftY, bw * S, bh * S);

        // Words and signs, in a layer of their own at a size that always reads well, whatever the zoom.
        const L = Math.max(1, Math.round(2 * this.dpr));
        const uw = Math.ceil(W / L);
        const uh = Math.ceil(H / L);

        if (!this.ui) {
            this.ui = document.createElement("canvas");
        }

        if (this.ui.width !== uw || this.ui.height !== uh) {
            this.ui.width = uw;
            this.ui.height = uh;
        }

        const u = this.ui.getContext("2d");

        u.setTransform(1, 0, 0, 1, 0, 0);
        u.clearRect(0, 0, uw, uh);
        u.imageSmoothingEnabled = false;
        this.drawLabels(
            u,
            (x, y) => [Math.round(((x + ox) * S) / L), Math.round(((y + oy) * S) / L)],
            uw,
            uh,
            L,
        );
        this.out.drawImage(this.ui, shiftX, shiftY, uw * L, uh * L);
    }

    /** An endless wood around the map, as a repeating tile. */
    forest() {
        if (!this.forestPattern) {
            const tile = document.createElement("canvas");

            tile.width = tile.height = 96;

            const g = tile.getContext("2d");

            g.fillStyle = C.grass3;
            g.fillRect(0, 0, 96, 96);

            const spots = [];

            // Spots inside the tile only, eight by eight: their wrapped copies fill the edges, so no
            // row of trees doubles up where tiles meet.
            for (let y = 4; y < 96; y += 12) {
                for (let x = 2; x < 96; x += 12) {
                    const seed = hash(`f${x},${y}`);

                    spots.push({
                        x: x + (seed % 7) - 3,
                        y: y + ((seed >>> 4) % 7) - 3,
                        pine: seed % 3 === 0,
                        seed,
                    });
                }
            }

            spots.sort((a, c) => a.y - c.y);

            for (const spot of spots) {
                for (const dx of [-96, 0, 96]) {
                    for (const dy of [-96, 0, 96]) {
                        drawTree(
                            g,
                            spot.x + dx,
                            spot.y + dy,
                            spot.pine ? "pine" : "round",
                            spot.seed,
                        );
                    }
                }
            }

            this.forestPattern = this.b.createPattern(tile, "repeat");
        }

        return this.forestPattern;
    }

    lights(night) {
        const out = [];

        if (night <= 0.02) {
            return out;
        }

        for (const lantern of this.lanterns) {
            out.push({ x: lantern.x, y: lantern.y - 14, r: 22, color: C.gold });
        }

        const add = (thing, kind) => {
            const def = BUILDINGS[kind];

            if (thing.built < 1 || !thing.shown) {
                return;
            }

            for (const [dx, dy, r] of def.lights ?? []) {
                out.push({
                    x: thing.x + dx,
                    y: thing.y + dy,
                    r: r * 1.6,
                    color: kind === "temple" ? thing.color : C.orange,
                });
            }
        };

        for (const place of this.places.values()) {
            add(place, place.kind);
        }

        for (const home of this.homes.values()) {
            add(home, "home");
        }

        if (this.castle) {
            add(this.castle, "castle");
        }

        for (const tent of this.tents.values()) {
            out.push({ x: tent.x + 9, y: tent.y + 3, r: 20, color: C.orange });
        }

        for (const citizen of this.citizens.values()) {
            if (!citizen.inside && citizen.shown) {
                out.push({
                    x: Math.round(citizen.x),
                    y: Math.round(citizen.y) - 8,
                    r: citizen.thinking ? 16 : 9,
                    color: citizen.thinking ? C.cyan : C.gold,
                });
            }
        }

        for (const f of this.fx) {
            if (f.kind === "firefly") {
                out.push({ x: Math.round(f.x), y: Math.round(f.y), r: 5, color: C.lime });
            }
        }

        return out.slice(0, 260);
    }

    withBuild(thing, w, h, draw) {
        const b = this.b;

        if (thing.built >= 1) {
            draw();

            return;
        }

        const rise = Math.round(h * thing.built) + 2;

        b.save();
        b.beginPath();
        b.rect(thing.x - w, thing.y - rise, w * 2, rise + 4);
        b.clip();
        draw();
        b.restore();

        // Scaffolding while it goes up.
        b.fillStyle = C.brown;

        for (
            let x = thing.x - Math.round(w / 2) - 2;
            x <= thing.x + Math.round(w / 2) + 2;
            x += 6
        ) {
            b.fillRect(x, thing.y - h - 2, 1, h + 2);
        }

        for (let y = thing.y - h; y < thing.y; y += 6) {
            b.fillRect(thing.x - Math.round(w / 2) - 2, y, w + 4, 1);
        }
    }

    drawBuilding(thing, kind, state) {
        const def = BUILDINGS[kind];

        if (!thing.shown || thing.built <= 0) {
            return;
        }

        this.withBuild(thing, def.w, def.h + 10, () =>
            def.draw(this.b, thing.x, thing.y, {
                t: this.t,
                pulse: thing.pulse,
                open: thing.open > 0,
                lit: this.nightness() > 0.3,
                ...state,
            }),
        );
    }

    drawCitizen(citizen) {
        const b = this.b;
        const t = this.t;
        const x = Math.round(citizen.x);
        const y = Math.round(citizen.y);
        const working = citizen.task?.kind === "visit" && citizen.task.phase === "work";
        const tool = working
            ? citizen.task.key === "files" && citizen.task.write
                ? "quill"
                : (TOOL_OF[(citizen.task.key ?? "").split(":")[0]] ?? "wrench")
            : citizen.thinking
              ? "staff"
              : null;
        const hop = citizen.appear < 1 ? -Math.round(Math.sin(citizen.appear * Math.PI) * 4) : 0;

        if (citizen.hurt > 0 && Math.floor(t * 12) % 2 === 0) {
            return;
        }

        drawPerson(b, x, y + hop, citizen.look, {
            t: t + (hash(citizen.id) % 10) / 10,
            walk: citizen.walking,
            run: citizen.run,
            dir: citizen.dir,
            face: citizen.face,
            work: tool,
            sit: citizen.sit && !citizen.walking,
        });
    }

    /** The blinking hand of an old game's menu, over what is chosen. (x, y): its tip, in the words' layer. */
    cursor(u, x, y, strong) {
        const bounce = Math.round(Math.abs(Math.sin(this.t * 5)) * 2);
        const color = strong ? C.gold : C.white;

        for (let row = 0; row < 4; row++) {
            rect(u, x - 3 + row, y - 4 + bounce + row, 7 - row * 2, 1, color);
            px(u, x - 4 + row, y - 4 + bounce + row, C.ink);
            px(u, x + 4 - row, y - 4 + bounce + row, C.ink);
        }
    }

    /**
     * Every word over the town, most important first: a label that would cover another is left out. `P` maps a point
     * of the town to the words' layer, whose pixels are always large enough to read.
     */
    drawLabels(u, P, uw, uh, L) {
        const t = this.t;
        const zoom = this.E / this.dpr;
        const taken = [];
        // Words stay in the open part of the view: never cut by its edge or under the HUD and log.
        const unit = this.dpr / L;
        const safe = {
            left: Math.ceil(this.insets.left * unit) + 2,
            top: Math.ceil(this.insets.top * unit) + 2,
            right: Math.floor((this.w - this.insets.right) * unit) - 2,
            bottom: Math.floor((this.h - this.insets.bottom) * unit) - 2,
        };
        const inside = (x, y, w, h) =>
            x >= safe.left && y >= safe.top && x + w <= safe.right && y + h <= safe.bottom;
        const onScreen = (x, y) => inside(x - 4, y - 4, 8, 8);

        const free = (x, y, w, h) => {
            for (const r of taken) {
                if (x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]) {
                    return false;
                }
            }

            taken.push([x, y, w, h]);

            return true;
        };

        // The art of buildings: a sign never sits on another building.
        const solids = [];

        for (const thing of [
            ...this.places.values(),
            ...this.homes.values(),
            ...(this.castle ? [this.castle] : []),
        ]) {
            if (thing.shown && thing.built > 0) {
                const def = BUILDINGS[thing.kind] ?? { w: 34, h: 34 };
                const [x0, y0] = P(thing.x - def.w / 2 + 2, thing.y - def.h + 4);
                const [x1, y1] = P(thing.x + def.w / 2 - 2, thing.y);

                // Only what is near the view can be under a sign.
                if (x1 > -40 && x0 < uw + 40 && y1 > -40 && y0 < uh + 40) {
                    solids.push([x0, y0, x1 - x0, y1 - y0]);
                }
            }
        }

        // A sign keeps 2 pixels clear of any building's art.
        const onArt = (x, y, w, h) =>
            solids.some(
                (r) =>
                    x - 2 < r[0] + r[2] &&
                    x + w + 2 > r[0] &&
                    y - 2 < r[1] + r[3] &&
                    y + h + 2 > r[1],
            );

        const label = (value, x, y, color, force = false, sign = false) => {
            if (!onScreen(x, y)) {
                return false;
            }

            const width = textWidth(value) + 2;
            const left = Math.round(x - width / 2);

            if (!force && !inside(left, y - 1, width, LINE)) {
                return false;
            }

            if (sign && onArt(left, y - 1, width, LINE)) {
                return false;
            }

            if (force) {
                taken.push([left, y - 1, width, LINE]);
            } else if (
                sign ? !free(left - 2, y - 2, width + 4, LINE + 2) : !free(left, y - 1, width, LINE)
            ) {
                return false;
            }

            text(u, value, x, y, color, { center: true });

            return true;
        };

        const visible = [...this.citizens.values()].filter(
            (citizen) => !citizen.inside && citizen.shown,
        );
        const head = (citizen) => P(citizen.x, citizen.y - 17);
        const feet = (citizen) => P(citizen.x, citizen.y);
        const lift = (citizen) => (citizen.emote ? 13 : 0);

        // What is chosen, and what the pointer is over: a hand, and its name.
        for (const [ref, strong] of [
            [this.selected, true],
            [this.hover, false],
        ]) {
            if (!ref || (!strong && this.selected?.id === ref.id)) {
                continue;
            }

            if (ref.type === "citizen") {
                const citizen = this.citizens.get(ref.id);

                if (!citizen) {
                    continue;
                }

                const [x, y] = citizen.inside
                    ? P(citizen.home.x, citizen.home.y - 36)
                    : head(citizen);

                this.cursor(u, x, y - 4 - lift(citizen), strong);
                taken.push([x - 5, y - 10 - lift(citizen), 10, 8]);

                if (!citizen.inside) {
                    const [fx, fy] = feet(citizen);
                    const doing =
                        citizen.task?.kind === "visit"
                            ? citizen.task.label
                            : citizen.thinking
                              ? "thinking..."
                              : null;

                    label(fit(this.nameOf(citizen.id), 140), fx, fy + 4, C.gold, true);

                    if (doing) {
                        label(fit(doing, 140), fx, fy + 13, C.white, true);
                    }
                }
            } else {
                const thing =
                    ref.type === "place"
                        ? this.places.get(ref.id)
                        : ref.type === "royal"
                          ? this.royals.get(ref.id)
                          : null;

                if (thing) {
                    const height = ref.type === "place" ? (BUILDINGS[thing.kind]?.h ?? 30) : 18;
                    const [x, y] = P(thing.x, thing.y - height);

                    this.cursor(u, x, y - 14, strong);
                }
            }
        }

        // A few words, in order of need: signs first, then what agents say. The rest waits for
        // a tap or a closer zoom, so the words never bury the town.
        const close = zoom >= 1.6;
        const near = zoom >= 3;

        for (const place of this.places.values()) {
            if (place.shown && place.built >= 1) {
                const def = BUILDINGS[place.kind];
                const [x, y] = P(place.x, place.y - def.h);
                const [, below] = P(place.x, place.y + 4);
                const sign = fit(place.def.sub ? place.def.sub : place.def.label, 90);

                // Over the roof, else under the door, else not at all.
                if (!label(sign, x, y - 11, place.color, false, true)) {
                    label(sign, x, below + 2, place.color, false, true);
                }
            }
        }

        for (const home of this.homes.values()) {
            if (home.shown && home.built >= 1) {
                const name = fit(this.nameOf(home.id), 110);
                const [x, y] = P(home.x, home.y - 36);

                if (!label(name, x, y - 11, C.white, false, true)) {
                    const [bx, by] = P(home.x, home.y + 4);

                    label(name, bx, by + 2, C.white, false, true);
                }
            }
        }

        if (this.castle && this.castle.built >= 1) {
            const [x, y] = P(this.castle.x, this.castle.y - 70);

            label("THE FOUNDERS' KEEP", x, y - 10, C.gold);

            for (const royal of near ? this.royals.values() : []) {
                const [rx, ry] = P(royal.x, royal.y - 16);

                label(fit(royal.name, 60), rx, ry - 10, "#ffe7a8");
            }
        }

        // What agents say: the two newest, where they fit.
        const speakers = (close ? visible : [])
            .filter((citizen) => citizen.bubble && citizen.bubble.kind !== "think")
            .sort((a, c) => c.bubble.at - a.bubble.at)
            .slice(0, 2);

        for (const citizen of speakers) {
            const [x, y] = head(citizen);

            if (onScreen(x, y)) {
                this.bubble(u, citizen, x, y - 3 - lift(citizen), (bx, by, bw, bh) =>
                    inside(bx, by, bw, bh) ? free(bx, by, bw, bh) : false,
                );
            }
        }

        // Feelings: done, failed, a letter, a scroll; small, and only where there is room.
        for (const citizen of close ? visible : []) {
            if (!citizen.emote) {
                continue;
            }

            const [cx, cy] = head(citizen);
            const x = cx;
            const y = cy - 14 - Math.round(Math.min(1, (t - citizen.emote.at) * 6) * 2);

            if (!onScreen(x, y) || !free(x - 6, y - 1, 12, 12)) {
                continue;
            }

            rect(u, x - 6, y - 1, 12, 11, C.ink);
            rect(u, x - 5, y, 10, 9, C.white);
            px(u, x, y + 10, C.ink);

            const kind = citizen.emote.kind;

            if (kind === "check") {
                text(u, "✓", x, y + 1, C.green, { center: true, outline: null });
            } else {
                drawIcon(u, kind, x - 4, y + 1);
            }
        }

        // Close up: apprentices' names by their tents, and everyone's name at their feet.
        for (const tent of near ? this.tents.values() : []) {
            if (tent.shown && tent.built >= 1) {
                const [x, y] = P(tent.x, tent.y);

                label(fit(this.nameOf(tent.id), 80), x, y + 3, C.silver);
            }
        }

        for (const citizen of near ? visible : []) {
            if (citizen.at !== citizen.home) {
                const [x, y] = feet(citizen);

                label(fit(this.nameOf(citizen.id), 80), x, y + 3, C.silver);
            }
        }
    }

    /** A speech, thought, shout, or letter, in the words' layer, its tail at (cx, bottom). */
    bubble(u, citizen, cx, bottom, free) {
        const t = this.t;
        const bubble = citizen.bubble;
        const kind = bubble.kind;
        const shown = kind === "say" && !this.calm ? Math.floor((t - bubble.at) * 45) : 999;
        // Wrapped and measured once per bubble; each frame only types more of it.
        const words = (bubble.lines ??= wrap(bubble.text, 110, kind === "think" ? 2 : 3));
        let budget = shown;
        const lines = words.map((line) => {
            const part = line.slice(0, Math.max(0, budget));

            budget -= line.length + 1;

            return part;
        });
        const width = (bubble.width ??= Math.max(...words.map((line) => textWidth(line))) + 8);
        const height = words.length * LINE + 5;
        const x = Math.round(cx - width / 2);
        const y = bottom - height - 3;

        if (!free(x - 1, y - 1, width + 2, height + 5)) {
            return;
        }

        const fill =
            kind === "shout"
                ? C.gold
                : kind === "letter"
                  ? C.sand
                  : kind === "think"
                    ? "#e8e0ff"
                    : C.white;
        const ink = kind === "think" ? C.plum : C.ink;
        const left = Math.max(0, Math.min(1, bubble.until - t));

        if (left < 0.25 && Math.floor(t * 20) % 2) {
            return;
        }

        rect(u, x - 1, y, width + 2, height, C.ink);
        rect(u, x, y - 1, width, height + 2, C.ink);
        rect(u, x, y, width, height, fill);

        if (kind === "think") {
            px(u, cx - 2, y + height + 2, C.ink);
            rect(u, cx - 1, y + height + 3, 2, 2, C.ink);
        } else {
            rect(u, cx - 2, y + height, 4, 1, fill);
            px(u, cx - 3, y + height, C.ink);
            px(u, cx + 2, y + height, C.ink);
            rect(u, cx - 1, y + height + 1, 2, 1, fill);
            px(u, cx - 2, y + height + 1, C.ink);
            px(u, cx + 1, y + height + 1, C.ink);
            px(u, cx, y + height + 2, C.ink);
        }

        lines.forEach((line, index) => {
            if (line) {
                text(u, line, x + 4, y + 3 + index * LINE, ink, { outline: null });
            }
        });

        if (kind === "say" && budget < 0 && Math.floor(t * 4) % 2) {
            rect(u, x + width - 5, y + height - 3, 2, 1, ink);
        }
    }

    // ——— input ———

    pick(sx, sy) {
        const p = this.toWorld(sx, sy);
        let best = null;
        let bestD = Infinity;
        // However far out the zoom, a target is at least 22 css pixels across.
        const reach = (11 * this.dpr) / this.E;

        for (const citizen of this.citizens.values()) {
            if (citizen.inside || !citizen.shown) {
                continue;
            }

            const d = Math.hypot(citizen.x - p.x, citizen.y - 7 - p.y);

            if (d < Math.max(11, reach) && d < bestD) {
                best = { type: "citizen", id: citizen.id };
                bestD = d;
            }
        }

        if (best) {
            return best;
        }

        const ready = (thing) => thing.shown && thing.built >= 1;

        // A house: its own art first; failing that, the nearest whose wider target holds the tap.
        let near = null;
        let nearD = Infinity;

        for (const citizen of this.citizens.values()) {
            const home = citizen.home;

            if (!citizen.inside || !citizen.shown || home?.kind !== "home" || !ready(home)) {
                continue;
            }

            const dx = Math.abs(p.x - home.x);

            if (dx < 18 && p.y > home.y - 32 && p.y < home.y + 2) {
                return { type: "citizen", id: citizen.id };
            }

            const d = Math.hypot(dx, p.y - (home.y - 16));

            if (dx < reach && p.y > home.y - reach * 2 && p.y < home.y + reach / 2 && d < nearD) {
                near = { type: "citizen", id: citizen.id };
                nearD = d;
            }
        }

        if (near) {
            return near;
        }

        for (const tent of this.tents.values()) {
            if (
                ready(tent) &&
                Math.abs(p.x - tent.x) < Math.max(8, reach) &&
                p.y > tent.y - Math.max(12, reach * 1.5) &&
                p.y < tent.y + Math.max(2, reach / 2)
            ) {
                return { type: "citizen", id: tent.id };
            }
        }

        // The one in front wins where buildings overlap: nearest the bottom first.
        for (const place of [...this.places.values()].sort((a, c) => c.y - a.y)) {
            const def = BUILDINGS[place.kind];
            const half = Math.max(def.w / 2, reach);

            if (
                ready(place) &&
                p.x > place.x - half &&
                p.x < place.x + half &&
                p.y > place.y - Math.max(def.h, reach * 2) &&
                p.y < place.y + 3
            ) {
                return { type: "place", id: place.key };
            }
        }

        if (this.castle && ready(this.castle)) {
            for (const royal of this.royals.values()) {
                if (Math.abs(p.x - royal.x) < 7 && Math.abs(p.y - (royal.y - 7)) < 9) {
                    return { type: "royal", id: royal.name };
                }
            }
        }

        return null;
    }

    focusOn(ref) {
        this.follow = false;
        this.tracking = ref.type === "royal" ? null : ref;

        const where =
            ref.type === "citizen"
                ? this.citizens.get(ref.id)
                : ref.type === "place"
                  ? this.places.get(ref.id)
                  : this.royals.get(ref.id);

        if (where) {
            this.camT = { x: where.x, y: where.y - 12 };
        }

        const [, most] = this.scaleLimits();

        this.setScale(Math.min(most, Math.max(Math.round(this.E), Math.round(3 * this.dpr))));
    }

    zoomAt(delta, sx, sy) {
        const [least, most] = this.scaleLimits();
        // From a shrunk "See all", one step in is the scale it was drawn at.
        const now = this.S * this.kGoal;
        const next = Math.max(
            least,
            Math.min(most, delta > 0 ? Math.floor(now + 0.01) + 1 : Math.ceil(now - 0.01) - 1),
        );

        if (next === this.S && this.kGoal === 1) {
            return;
        }

        this.follow = false;
        this.tracking = null;
        this.setScale(next, 1, { x: sx, y: sy });
    }

    bindInput() {
        const canvas = this.canvas;
        const pointers = new Map();
        let pinch = null;
        let down = null;
        let wheel = 0;

        const local = (event) => {
            const box = canvas.getBoundingClientRect();

            return [event.clientX - box.left, event.clientY - box.top];
        };

        const onDown = (event) => {
            canvas.setPointerCapture?.(event.pointerId);
            pointers.set(event.pointerId, local(event));

            if (pointers.size === 1) {
                const [x, y] = local(event);

                down = {
                    x,
                    y,
                    at: performance.now(),
                    cx: this.cam.x,
                    cy: this.cam.y,
                    moved: false,
                };
            } else if (pointers.size === 2) {
                const [a, c] = [...pointers.values()];

                pinch = { d: Math.hypot(a[0] - c[0], a[1] - c[1]) };
                down = null;
            }
        };

        const onMove = (event) => {
            const [x, y] = local(event);

            if (!pointers.has(event.pointerId)) {
                if (event.pointerType === "mouse") {
                    this.hover = this.pick(x, y);
                    canvas.style.cursor = this.hover ? "pointer" : "grab";
                }

                return;
            }

            pointers.set(event.pointerId, [x, y]);

            if (pinch && pointers.size === 2) {
                const [a, c] = [...pointers.values()];
                const d = Math.hypot(a[0] - c[0], a[1] - c[1]);
                const step = 46;

                if (Math.abs(d - pinch.d) > step) {
                    this.zoomAt(d > pinch.d ? 1 : -1, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
                    pinch.d = d;
                }

                return;
            }

            if (down) {
                const dx = x - down.x;
                const dy = y - down.y;

                if (Math.hypot(dx, dy) > 6) {
                    down.moved = true;
                    this.follow = false;
                    this.tracking = null;
                    canvas.style.cursor = "grabbing";
                }

                if (down.moved) {
                    // The hand moves the camera now: a zoom still gliding keeps its scale, not its anchor.
                    if (this.glide) {
                        this.glide.anchor = null;
                    }

                    this.cam.x = down.cx - (dx * this.dpr) / this.E;
                    this.cam.y = down.cy - (dy * this.dpr) / this.E;
                    this.camT.x = this.cam.x;
                    this.camT.y = this.cam.y;
                }
            }
        };

        // After a pinch, the finger still down drags from where it is, and never counts as a tap.
        const rebase = () => {
            const [left] = [...pointers.values()];

            down = left
                ? {
                      x: left[0],
                      y: left[1],
                      at: 0,
                      cx: this.cam.x,
                      cy: this.cam.y,
                      moved: false,
                      pinched: true,
                  }
                : null;
        };

        // A cancel, or a capture lost before the pointer came up: forget it, select nothing.
        const onCancel = (event) => {
            if (!pointers.has(event.pointerId)) {
                return;
            }

            pointers.delete(event.pointerId);
            pinch = null;
            down = null;
            canvas.style.cursor = "grab";
        };

        const onUp = (event) => {
            if (!pointers.has(event.pointerId)) {
                return;
            }

            pointers.delete(event.pointerId);

            if (pinch) {
                if (pointers.size < 2) {
                    pinch = null;
                    rebase();
                }

                return;
            }

            if (down && !down.moved && !down.pinched && performance.now() - down.at < 600) {
                const ref = this.pick(down.x, down.y);

                this.selected = ref;
                this.onSelect?.(ref);
                this.sound?.play("select");
            }

            down = null;
            canvas.style.cursor = "grab";
        };

        const onWheel = (event) => {
            event.preventDefault();
            wheel += event.deltaY * (event.ctrlKey ? 4 : 1);

            if (Math.abs(wheel) > 90) {
                const [x, y] = local(event);

                this.zoomAt(wheel < 0 ? 1 : -1, x, y);
                wheel = 0;
            }
        };

        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onCancel);
        canvas.addEventListener("lostpointercapture", onCancel);
        canvas.addEventListener("wheel", onWheel, { passive: false });

        this.unbind = () => {
            canvas.removeEventListener("pointerdown", onDown);
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerup", onUp);
            canvas.removeEventListener("pointercancel", onCancel);
            canvas.removeEventListener("lostpointercapture", onCancel);
            canvas.removeEventListener("wheel", onWheel);
        };
    }

    // ——— for the panels ———

    stateOf(citizen) {
        if (citizen.hurt > 0.3) {
            return "error";
        }

        if (citizen.task?.kind === "visit") {
            return citizen.task.phase === "work" ? "working" : "walking";
        }

        if (citizen.thinking) {
            return "thinking";
        }

        if (citizen.bubble?.kind === "say") {
            return "speaking";
        }

        return citizen.inside || citizen.sit ? "resting" : "idle";
    }

    stats() {
        let tokens = 0;
        let cost = 0;
        let homes = 0;
        let apprentices = 0;
        let active = 0;

        for (const citizen of this.citizens.values()) {
            const conv = this.data.convs[citizen.id];

            tokens += (conv?.tin ?? 0) + (conv?.tout ?? 0);
            cost += conv?.cost ?? 0;

            if (citizen.role === "subagent") {
                apprentices++;
            } else {
                homes++;
            }

            if (citizen.thinking || citizen.task?.kind === "visit" || citizen.queue.length > 0) {
                active++;
            }
        }

        const hour = this.hour() % 24;

        return {
            homes,
            apprentices,
            active,
            perMinute: this.callTimes.length,
            tokens,
            cost,
            places: this.places.size,
            hour,
            night: this.nightness() > 0.5,
            storm: this.storminess() > 0,
            zoom: this.E / this.dpr,
            replay: this.replay
                ? {
                      progress: Math.min(1, this.replay.clock / this.replay.total),
                      at: this.replay.at,
                  }
                : null,
        };
    }

    selection() {
        const ref = this.selected;

        if (!ref) {
            return null;
        }

        if (ref.type === "citizen") {
            const citizen = this.citizens.get(ref.id);
            const conv = this.data.convs[ref.id];

            if (!citizen || !conv) {
                return null;
            }

            const family = [...this.citizens.values()].filter(
                (each) => this.data.convs[each.id]?.parent === ref.id,
            );

            return {
                type: "citizen",
                id: ref.id,
                name: this.nameOf(ref.id),
                role: citizen.role,
                look: citizen.look,
                kind: conv.kind,
                parent: conv.parent ? { id: conv.parent, name: this.nameOf(conv.parent) } : null,
                model: conv.model,
                provider: conv.provider,
                thinking: conv.thinking,
                cwd: conv.cwd,
                state: this.stateOf(citizen),
                doing: citizen.task?.kind === "visit" ? citizen.task.label : null,
                errands: citizen.queue
                    .filter((task) => task.kind === "visit")
                    .map((task) => task.label),
                turns: conv.turns ?? 0,
                calls: conv.calls ?? 0,
                tin: conv.tin ?? 0,
                tout: conv.tout ?? 0,
                cost: conv.cost ?? 0,
                errors: conv.errors ?? 0,
                tools: Object.entries(conv.tools ?? {})
                    .sort((a, c) => c[1] - a[1])
                    .slice(0, 8),
                files: Object.entries(conv.files ?? {})
                    .sort((a, c) => c[1].last - a[1].last)
                    .slice(0, 12),
                party: family.map((each) => ({
                    id: each.id,
                    name: this.nameOf(each.id),
                    role: each.role,
                    look: each.look,
                    state: this.stateOf(each),
                })),
                lastText: citizen.lastText,
                lastThought: citizen.lastThought,
                first: conv.first,
                last: conv.last,
            };
        }

        if (ref.type === "place") {
            const place = this.places.get(ref.id);
            const resource = this.data.res[ref.id];
            const def = placeOf(ref.id);

            return {
                type: "place",
                id: ref.id,
                def,
                color: place?.color ?? def.color,
                kind: def.kind,
                count: resource?.count ?? 0,
                last: resource?.last,
                workers: [...(place?.workers ?? [])].map((citizen) => ({
                    id: citizen.id,
                    name: this.nameOf(citizen.id),
                    look: citizen.look,
                    doing: citizen.task?.label,
                })),
                items: Object.entries(resource?.items ?? {})
                    .sort((a, c) => c[1].last - a[1].last)
                    .slice(0, 14),
                users: Object.entries(resource?.by ?? {})
                    .sort((a, c) => c[1] - a[1])
                    .slice(0, 8)
                    .map(([id, count]) => ({
                        id,
                        name: this.nameOf(id),
                        count,
                        here: this.citizens.has(id),
                        look: this.citizens.get(id)?.look,
                    })),
            };
        }

        const person = this.data.humans[ref.id];
        const royal = this.royals.get(ref.id);

        return {
            type: "royal",
            id: ref.id,
            name: ref.id,
            look: royal?.look ?? lookOf(ref.id, "human", ref.id),
            count: person?.count ?? 0,
            last: person?.last,
            targets: [...(this.humanTargets.get(ref.id) ?? [])].map((id) => ({
                id,
                name: this.nameOf(id),
                here: this.citizens.has(id),
            })),
        };
    }
}

export { plain };
