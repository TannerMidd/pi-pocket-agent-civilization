// Agent Civilization: the page, in the style of an old game. A status bar, a quest log, character sheets, and the
// town itself (town.js) on a canvas.

import { Demo } from "./demo.js";
import { iconURL } from "./pixels.js";
import { Sound } from "./sound.js";
import {
    PLACES,
    STATE_WORD,
    Town,
    VIA,
    buildingURL,
    ellipsize,
    fmt,
    money,
    portraitURL,
} from "./town.js";

export const pocketApi = 2;

const RAIL_ICON = "M3 21V10l3-2V4h3v2l3-2 3 2V4h3v4l3 2v11z M10 21v-5h4v5 M7 13h2 M15 13h2";
const KEY = "x.agent-civilization.";
const MAX_EVENTS = 3000;
const CLASS = { session: "Wizard", subagent: "Apprentice", linked: "Envoy" };
const STATUS = [
    ["house", "homes", "sessions", "Sessions: a wizard's house each"],
    ["tent", "apprentices", "subagents", "Subagents: an apprentice's tent each"],
    ["bolt", "active", "busy", "Agents working or thinking now"],
    ["hammer", "perMinute", "calls/min", "Tool calls in the last minute"],
    ["scroll", "tokens", "tokens", "Tokens in and out"],
    ["coin", "cost", "spent", "Money spent on models"],
];

const read = (name, fallback) => {
    try {
        return localStorage.getItem(KEY + name) ?? fallback;
    } catch {
        return fallback;
    }
};

const write = (name, value) => {
    try {
        localStorage.setItem(KEY + name, value);
    } catch {
        // Private mode: the choice lasts for this page only.
    }
};

const time = (at) =>
    new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const day = (at) =>
    new Date(at).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

/** A record of what the server sent, keyed by its names: with no prototype, no name can reach one. */
const table = (from) => Object.assign(Object.create(null), from ?? {});

/** A span of time in words: "45 s", "3 min", "1 h 20 min". */
const span = (ms) => {
    const seconds = Math.max(0, Math.round(ms / 1000));

    if (seconds < 60) {
        return `${seconds} s`;
    }

    const minutes = Math.round(seconds / 60);

    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/** The icon of each part of a building site. */
const PART_ICON = {
    read: "book",
    write: "quill",
    shell: "hammer",
    git: "anchor",
    web: "globe",
    mcp: "flag",
    artifact: "frame",
    memory: "key",
    delegate: "tent",
    other: "gear",
    fail: "skull",
};

export function mergeInto(store, batch) {
    for (const field of ["convs", "res", "humans"]) {
        for (const [key, value] of Object.entries(batch[field] ?? {})) {
            if (value === null) {
                delete store[field][key];
            } else {
                store[field][key] = value;
                store.unknown.delete(key);
            }
        }
    }

    for (const id of batch.unknown ?? []) {
        if (!store.convs[id] && !store.unknown.has(id)) {
            store.unknown.set(id, Date.now());
        }
    }

    // New events and late ones (from a session shown just now, older than some the page has) in one pass:
    // each once, all in id order.
    const incoming = [...(batch.late ?? []), ...(batch.events ?? [])];

    if (incoming.length === 0) {
        return [];
    }

    const known = new Set(store.events.map((event) => event.id));
    const fresh = [];

    for (const event of incoming) {
        if (!known.has(event.id)) {
            known.add(event.id);
            fresh.push(event);
        }
    }

    fresh.sort((a, b) => a.id - b.id);

    if (fresh.length > 0) {
        const inOrder = fresh[0].id > store.maxId;

        store.events.push(...fresh);

        if (!inOrder) {
            store.events.sort((a, b) => a.id - b.id);
        }

        store.maxId = Math.max(store.maxId, fresh.at(-1).id);

        if (store.events.length > MAX_EVENTS) {
            store.events.splice(0, store.events.length - MAX_EVENTS);
        }
    }

    return fresh;
}

/** Events shown late (a session the owner was just shown they may see), put in their place. */
function insertEvents(store, events) {
    const known = new Set(store.events.map((event) => event.id));
    const fresh = events.filter((event) => !known.has(event.id));

    if (fresh.length > 0) {
        store.events.push(...fresh);
        store.events.sort((a, b) => a.id - b.id);
        store.maxId = Math.max(store.maxId, store.events.at(-1).id);
    }

    return fresh;
}

const portraits = new Map();

function portrait(look, scale = 3) {
    const key = `${JSON.stringify(look)}:${scale}`;

    if (!portraits.has(key)) {
        portraits.set(key, portraitURL(look, scale));
    }

    return portraits.get(key);
}

const pictures = new Map();

function picture(kind, color) {
    const key = `${kind}:${color}`;

    if (!pictures.has(key)) {
        pictures.set(key, buildingURL(kind, { rgb: color, flag: color, lit: true }));
    }

    return pictures.get(key);
}

export default function setup(pocket) {
    const { html, useEffect, useRef, useState } = pocket;

    pocket.style("style.css");

    // One store for the tab, kept live by the server's batches while the page is closed too.
    const store = {
        convs: table(),
        res: table(),
        humans: table(),
        batch: 0,
        events: [],
        maxId: 0,
        loaded: false,
        boot: null,
        unknown: new Map(),
    };
    const listeners = new Set();
    const activity = new Map();
    let loading = null;
    let buffered = null;
    let badge = 0;

    const rail = pocket.rail({
        id: "civ",
        title: "Civilization",
        iconPath: RAIL_ICON,
        page: "civ",
    });

    pocket.launcher({
        id: "civ",
        label: "Open Agent Civilization",
        detail: "Your agents as a living pixel town",
        iconPath: RAIL_ICON,
        keywords: [
            "agents",
            "subagents",
            "linked sessions",
            "team",
            "visualize",
            "town",
            "game",
            "civilization",
            "pixel",
        ],
        page: "civ",
    });

    function countActive() {
        const now = Date.now();
        let count = 0;

        for (const event of activity.values()) {
            if (
                now - event.at < 10 * 60_000 &&
                event.k !== "idle" &&
                !(event.k === "reply" && !event.calls)
            ) {
                count++;
            }
        }

        if (count !== badge) {
            badge = count;
            rail.update({ badge: count || null });
        }
    }

    function track(events) {
        for (const event of events) {
            if (event.c && ["tool", "done", "think", "reply", "idle"].includes(event.k)) {
                activity.set(event.c, event);
            }
        }

        countActive();
    }

    const sweep = setInterval(countActive, 30_000);
    let retry;
    let disposed = false;

    pocket.onDispose(() => {
        disposed = true;
        clearInterval(sweep);
        clearTimeout(retry);
    });

    function load() {
        if (store.loaded) {
            return Promise.resolve();
        }

        if (loading) {
            return loading;
        }

        buffered = [];
        loading = pocket
            .api("world")
            .then((world) => {
                store.convs = table(world.convs);
                store.res = table(world.res);
                store.humans = table(world.humans);
                store.batch = world.batch ?? 0;
                store.events = world.events ?? [];
                store.maxId = store.events.at(-1)?.id ?? 0;
                store.boot = world.boot ?? null;
                store.unknown = new Map((world.unknown ?? []).map((id) => [id, 0]));

                // Batches that came while it loaded, and are newer than what it holds, in order. One
                // missing among them: load once more.
                let gap = false;

                for (const batch of buffered ?? []) {
                    if ((!batch.boot || batch.boot === store.boot) && !(batch.n <= store.batch)) {
                        if (typeof batch.n === "number" && batch.n !== store.batch + 1) {
                            gap = true;
                            break;
                        }

                        mergeInto(store, batch);
                        store.batch = batch.n ?? store.batch;
                    }
                }

                if (gap) {
                    store.loaded = false;
                    buffered = null;
                    loading = null;

                    return load();
                }

                store.loaded = true;
                track(store.events);
            })
            .finally(() => {
                buffered = null;
                loading = null;
            });

        return loading;
    }

    /** The server started over (a restart or a reset): take its world again. */
    function reload(wait = 2000) {
        if (disposed) {
            return;
        }

        store.loaded = false;
        load()
            .then(() => listeners.forEach((listener) => listener(null)))
            .catch(() => {
                // Try again a little later, more slowly each time, while nothing else has.
                clearTimeout(retry);
                retry = setTimeout(() => {
                    if (!disposed && !store.loaded && !loading) {
                        reload(Math.min(30_000, wait * 2));
                    }
                }, wait);
            });
    }

    pocket.on("batch", (batch) => {
        if (batch.boot && store.boot && batch.boot !== store.boot && (store.loaded || !loading)) {
            reload();

            return;
        }

        if (buffered) {
            buffered.push(batch);

            return;
        }

        // A batch went missing (too big, or sent while this tab slept): take the whole world again.
        if (
            store.loaded &&
            typeof batch.n === "number" &&
            typeof store.batch === "number" &&
            batch.n !== store.batch + 1
        ) {
            if (batch.n > store.batch) {
                reload();
            }

            return;
        }

        store.batch = batch.n ?? store.batch;

        const fresh = mergeInto(store, batch);

        track(fresh);
        listeners.forEach((listener) => listener(fresh));
    });

    pocket.on("reset", () => {
        Object.assign(store, {
            convs: table(),
            res: table(),
            humans: table(),
            events: [],
            unknown: new Map(),
        });
        activity.clear();
        countActive();
        listeners.forEach((listener) => listener(null));
    });

    // ——— pieces ———

    function Px({ name, size = 16 }) {
        return html`<img
            class="civ-px"
            src=${iconURL(name)}
            width=${size}
            height=${size}
            alt=""
        />`;
    }

    function Bar({ value, max = 1, color = "#a7f070" }) {
        const fill = Math.max(0, Math.min(1, max > 0 ? value / max : 0));

        return html`<div class="civ-bar">
            <i style=${`width:${Math.round(fill * 100)}%;background:${color}`}></i>
        </div>`;
    }

    function Typewriter({ text, speed = 40 }) {
        const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const [shown, setShown] = useState(calm ? text.length : 0);

        useEffect(() => {
            if (calm) {
                setShown(text.length);

                return undefined;
            }

            setShown(0);

            const timer = setInterval(() => {
                setShown((value) => {
                    if (value >= text.length) {
                        clearInterval(timer);
                    }

                    return Math.min(text.length, value + 2);
                });
            }, 1000 / speed);

            return () => clearInterval(timer);
        }, [text]);

        return html`<span
            >${text.slice(0, shown)}${shown < text.length ? html`<b class="civ-caret">▌</b>` : ""}</span
        >`;
    }

    function Window({ title, icon, onClose, className = "", children }) {
        const sheet = className.includes("civ-sheet");

        return html`<section
            class=${`civ-win ${className}`}
            role=${sheet ? "dialog" : undefined}
            aria-label=${sheet ? title : undefined}
        >
            <header class="civ-win-head">
                ${icon && html`<${Px} name=${icon} size=${16} />`}
                <h3>${title}</h3>
                ${onClose && html`<button class="civ-x" aria-label="Close" onClick=${onClose}>✕</button>`}
            </header>
            <div class="civ-win-body">${children}</div>
        </section>`;
    }

    function Sheet({ info, onClose, onPick, onOpen, demo }) {
        if (!info) {
            return null;
        }

        if (info.type === "place") {
            return html`<${Window}
                title=${info.def.label}
                icon=${info.def.icon}
                onClose=${onClose}
                className="civ-sheet"
            >
                <div class="civ-hero">
                    <img class="civ-picture" src=${picture(info.kind, info.color)} alt="" />
                    <div>
                        <p class="civ-flavor">${info.def.about}</p>
                        <dl class="civ-stats">
                            <dt>Visits</dt>
                            <dd>${fmt(info.count)}</dd>
                            <dt>Last</dt>
                            <dd>${info.last ? time(info.last) : "—"}</dd>
                        </dl>
                    </div>
                </div>
                ${
                    info.workers.length > 0 &&
                    html`<h4>Working here now</h4>
                        <ul class="civ-party">
                            ${info.workers.map(
                                (worker) =>
                                    html`<li>
                                        <button
                                            onClick=${() => onPick({ type: "citizen", id: worker.id })}
                                        >
                                            <img src=${portrait(worker.look, 2)} alt="" />
                                            <span
                                                ><b>${ellipsize(worker.name, 22)}</b>${" "}
                                                ${worker.doing ? ellipsize(worker.doing, 40) : ""}</span
                                            >
                                        </button>
                                    </li>`,
                            )}
                        </ul>`
                }
                ${
                    info.items.length > 0 &&
                    html`<h4>Recently used here</h4>
                        <ul class="civ-ledger">
                            ${info.items.map(
                                ([name, item]) =>
                                    html`<li>
                                        <${Px}
                                            name=${item.w ? "quill" : info.def.icon}
                                            size=${16}
                                        />
                                        <span class="civ-mono">${ellipsize(name, 44)}</span>
                                        <b>×${item.n}</b>
                                    </li>`,
                            )}
                        </ul>`
                }
                ${
                    info.users.length > 0 &&
                    html`<h4>Visitors</h4>
                        <ul class="civ-party">
                            ${info.users.map(
                                (user) =>
                                    html`<li>
                                        <button
                                            disabled=${!user.here}
                                            onClick=${() => onPick({ type: "citizen", id: user.id })}
                                        >
                                            ${user.look ? html`<img src=${portrait(user.look, 2)} alt="" />` : html`<${Px} name="person" size=${24} />`}
                                            <span
                                                ><b>${ellipsize(user.name, 26)}</b>
                                                ${` ${user.count} ${user.count === 1 ? "visit" : "visits"}`}</span
                                            >
                                        </button>
                                    </li>`,
                            )}
                        </ul>`
                }
            <//>`;
        }

        if (info.type === "site") {
            const building = info.state === "building";
            const ruin = info.state === "ruin";

            return html`<${Window}
                title=${info.title}
                icon=${ruin ? "skull" : "house"}
                onClose=${onClose}
                className="civ-sheet"
            >
                <div class="civ-hero">
                    <img class="civ-picture civ-site-picture" src=${info.picture} alt="" />
                    <div class="civ-hero-text">
                        <div class="civ-class">
                            ${building ? "Under construction" : ruin ? `A ruined ${info.style.name.toLowerCase()}` : info.style.name}
                        </div>
                        <p class="civ-flavor">
                            ${building ? "Each tool call that finishes adds a part. When the work ends, the building takes the style of what it mostly was." : ruin ? "Too many of its tool calls failed." : info.style.about}
                        </p>
                        <button
                            class="civ-link"
                            disabled=${!info.owner.here}
                            onClick=${() => onPick({ type: "citizen", id: info.owner.id })}
                        >
                            ${`Built by ${ellipsize(info.owner.name, 28)}`}
                        </button>
                    </div>
                </div>
                ${
                    building &&
                    info.now &&
                    html`<div class="civ-quest">
                        <h4>Just now</h4>
                        <p>▶ ${info.now}</p>
                    </div>`
                }
                <dl class="civ-stats civ-stats-grid">
                    <dt>Asked by</dt>
                    <dd>${info.askers.length > 0 ? ellipsize(info.askers.join(", "), 30) : "—"}</dd>
                    <dt>Started</dt>
                    <dd>${day(info.start)}</dd>
                    <dt>${building ? "Working for" : "Took"}</dt>
                    <dd>${span((info.end ?? Date.now()) - info.start)}</dd>
                    <dt>Tool calls</dt>
                    <dd>${fmt(info.calls)}</dd>
                    <dt>Failed</dt>
                    <dd class=${info.fails ? "civ-bad" : ""}>${fmt(info.fails)}</dd>
                    <dt>Spent</dt>
                    <dd class="civ-gold">${money(info.cost)}</dd>
                </dl>
                ${
                    info.helpers.length > 0 &&
                    html`<h4>Helpers</h4>
                        <ul class="civ-party">
                            ${info.helpers.map(
                                (helper) =>
                                    html`<li>
                                        <button
                                            disabled=${!helper.here}
                                            onClick=${() => onPick({ type: "citizen", id: helper.id })}
                                        >
                                            ${helper.look ? html`<img src=${portrait(helper.look, 2)} alt="" />` : html`<${Px} name="tent" size=${24} />`}
                                            <span><b>${ellipsize(helper.name, 30)}</b></span>
                                        </button>
                                    </li>`,
                            )}
                        </ul>`
                }
                ${info.groups.map(
                    (group) =>
                        html`<h4>
                                ${group.title}${" "}<small class="civ-dim"
                                    >${`· ${group.about}`}</small
                                >
                            </h4>
                            <ul class="civ-ledger">
                                ${group.items.map(
                                    ([name, count]) =>
                                        html`<li>
                                            <${Px} name=${PART_ICON[group.kind]} size=${16} />
                                            <span class="civ-mono">${ellipsize(name, 44)}</span>
                                            <b>${count > 1 ? `×${count}` : ""}</b>
                                        </li>`,
                                )}
                                ${
                                    group.more > 0 &&
                                    html`<li class="civ-dim">
                                        <span></span>
                                        <span>${`and ${group.more} more`}</span>
                                        <b></b>
                                    </li>`
                                }
                            </ul>`,
                )}
            <//>`;
        }

        if (info.type === "royal") {
            return html`<${Window}
                title=${info.name}
                icon="crown"
                onClose=${onClose}
                className="civ-sheet"
            >
                <div class="civ-hero">
                    <img class="civ-portrait" src=${portrait(info.look, 4)} alt="" />
                    <div>
                        <div class="civ-class">Founder · a person</div>
                        <p class="civ-flavor">
                            They rule from the keep. Their letters set the town to work.
                        </p>
                        <dl class="civ-stats">
                            <dt>Messages</dt>
                            <dd>${fmt(info.count)}</dd>
                            <dt>Last</dt>
                            <dd>${info.last ? time(info.last) : "—"}</dd>
                        </dl>
                    </div>
                </div>
                ${
                    info.targets.length > 0 &&
                    html`<h4>Wrote to</h4>
                        <ul class="civ-party">
                            ${info.targets.map(
                                (target) =>
                                    html`<li>
                                        <button
                                            disabled=${!target.here}
                                            onClick=${() => onPick({ type: "citizen", id: target.id })}
                                        >
                                            <${Px} name="letter" size=${24} />
                                            <span><b>${ellipsize(target.name, 30)}</b></span>
                                        </button>
                                    </li>`,
                            )}
                        </ul>`
                }
            <//>`;
        }

        const level = 1 + Math.floor(Math.sqrt(info.turns));
        const floor = (level - 1) ** 2;
        const next = level ** 2;
        const most = info.tools[0]?.[1] ?? 1;
        const canOpen = !demo && /^\d+$/.test(info.id);
        const role =
            info.kind === "subagent" ? "subagent" : info.kind === "linked" ? "linked" : "session";

        return html`<${Window}
            title=${info.name}
            icon=${role === "subagent" ? "tent" : "house"}
            onClose=${onClose}
            className="civ-sheet"
        >
            <div class="civ-hero">
                <img class="civ-portrait" src=${portrait(info.look, 4)} alt="" />
                <div class="civ-hero-text">
                    <div class="civ-class">
                        ${CLASS[role]} · LV ${level}
                        ${role === "subagent" ? " · subagent" : role === "linked" ? " · linked session" : " · session"}
                    </div>
                    ${
                        info.parent &&
                        html`<button
                            class="civ-link"
                            onClick=${() => onPick({ type: "citizen", id: info.parent.id })}
                        >
                            ${`${role === "subagent" ? "Apprentice of" : "Sent by"} ${ellipsize(info.parent.name, 28)}`}
                        </button>`
                    }
                    <div class="civ-xp">
                        <span>XP</span>
                        <${Bar} value=${info.turns - floor} max=${next - floor} color="#41a6f6" />
                        <small>${info.turns}/${next} turns</small>
                    </div>
                    <div class="civ-state civ-state-${info.state}">
                        ● ${STATE_WORD[info.state] ?? info.state}
                    </div>
                </div>
            </div>
            ${
                (info.doing || info.errands.length > 0) &&
                html`<div class="civ-quest">
                    <h4>Doing now</h4>
                    ${info.doing && html`<p>▶ ${info.doing}</p>`}
                    ${info.errands.slice(0, 4).map((errand) => html`<p class="civ-dim">· ${errand}</p>`)}
                </div>`
            }
            <dl class="civ-stats civ-stats-grid">
                <dt>Model</dt>
                <dd
                    class="civ-mono civ-model"
                    title=${info.model ? `${info.provider}/${info.model}` : ""}
                >
                    ${info.model ? html`<span>${info.model}</span><small>${info.provider}</small>` : "—"}
                </dd>
                <dt>Thinking level</dt>
                <dd>${info.thinking ?? "—"}</dd>
                <dt>Tool calls</dt>
                <dd>${fmt(info.calls)}</dd>
                <dt>Tokens in</dt>
                <dd>${fmt(info.tin)}</dd>
                <dt>Tokens out</dt>
                <dd>${fmt(info.tout)}</dd>
                <dt>Spent</dt>
                <dd class="civ-gold">${money(info.cost)}</dd>
                <dt>Errors</dt>
                <dd class=${info.errors ? "civ-bad" : ""}>${fmt(info.errors)}</dd>
            </dl>
            ${
                info.tools.length > 0 &&
                html`<h4>Tools used</h4>
                    <ul class="civ-skills">
                        ${info.tools.map(
                            ([name, count]) =>
                                html`<li>
                                    <span class="civ-mono">${name}</span>
                                    <${Bar} value=${count} max=${most} color="#ffcd75" />
                                    <b>${count}</b>
                                </li>`,
                        )}
                    </ul>`
            }
            ${
                info.files.length > 0 &&
                html`<h4>Files touched</h4>
                    <ul class="civ-ledger">
                        ${info.files.map(
                            ([path, file]) =>
                                html`<li>
                                    <${Px} name=${file.w ? "quill" : "book"} size=${16} />
                                    <span class="civ-mono">${ellipsize(path, 40)}</span>
                                    <b
                                        >${[file.r ? `read ${file.r}` : "", file.w ? `wrote ${file.w}` : ""].filter(Boolean).join(" · ")}</b
                                    >
                                </li>`,
                        )}
                    </ul>`
            }
            ${
                info.party.length > 0 &&
                html`<h4>Its team</h4>
                    <ul class="civ-party">
                        ${info.party.map(
                            (member) =>
                                html`<li>
                                    <button
                                        onClick=${() => onPick({ type: "citizen", id: member.id })}
                                    >
                                        <img src=${portrait(member.look, 2)} alt="" />
                                        <span
                                            ><b>${ellipsize(member.name, 24)}</b
                                            >${` ${CLASS[member.role]} · ${STATE_WORD[member.state]}`}</span
                                        >
                                    </button>
                                </li>`,
                        )}
                    </ul>`
            }
            ${
                info.lastThought &&
                html`<h4>Last thought</h4>
                    <p class="civ-dialog civ-dialog-think">${info.lastThought}</p>`
            }
            ${
                info.lastText &&
                html`<h4>Last words</h4>
                    <p class="civ-dialog"><${Typewriter} text=${info.lastText} /></p>`
            }
            ${info.cwd && html`<p class="civ-dim civ-mono">⌂ ${info.cwd}</p>`}
            ${canOpen && html`<button class="civ-btn civ-go" onClick=${() => onOpen(info.id)}>▶ Open this session</button>`}
        <//>`;
    }

    function Manual({ onClose, onForget, sky, setSky, demo }) {
        const citizens = [
            [
                "session",
                "Wizard",
                "A session's main agent. Lives in a house; the sign over it names the session.",
            ],
            [
                "subagent",
                "Apprentice",
                "A subagent. Lives in a tent by its wizard's house, and carries its report back on foot.",
            ],
            [
                "linked",
                "Envoy",
                "A linked session. Lives in a house down the road from the session that started it.",
            ],
            [
                "human",
                "Founder",
                "A person. Founders stand on the keep and send letters by pigeon.",
            ],
        ];

        return html`<${Window}
            title="How to play"
            icon="scroll"
            onClose=${onClose}
            className="civ-sheet civ-manual"
        >
            <p class="civ-flavor">
                Every agent at work is a citizen of this town. When one calls a tool, it walks to
                that tool's building and works there. When it thinks, mana streams to its oracle,
                and gold comes back as tokens.
            </p>
            <h4>What you see</h4>
            <ul class="civ-key">
                <li>
                    <span
                        >${'Point at or tap an agent to see its name and what it is doing now. "> Archive" means it is on its way there; "thinking..." means it waits for its model.'}</span
                    >
                </li>
                <li>
                    <span>Zoom in to see every name. Zoomed out, only the signs show.</span>
                </li>
                <li>
                    <span
                        >Sparks fly to a model's temple while an agent thinks, and coins (tokens)
                        come back.</span
                    >
                </li>
                <li>
                    <span
                        >Every task becomes a building beside its agent's house. Each tool call that
                        finishes adds a part: a stone for a file read, a storey for a file written,
                        a chimney for a program, a mast for a website, a crate for git, a flag for
                        an MCP server, a banner for a helper, a crack for a failure. Bricks fly from
                        the tool's building to the site.</span
                    >
                </li>
                <li>
                    <span
                        >When the task ends, the scaffolding comes down and the building takes the
                        style of what the work mostly was: a study, workshop, foundry, lookout,
                        warehouse, council hall, trading post, atelier, archive, or manor. Each
                        house keeps its last 6. Tap one for its story.</span
                    >
                </li>
                <li><span>A skull: a tool call failed. Many failures bring a storm.</span></li>
                <li>
                    <span
                        >The bar at the top: sessions, subagents, agents busy now, tool calls a
                        minute, tokens, money spent, and the time in town.</span
                    >
                </li>
            </ul>
            <h4>Controls</h4>
            <p>
                Drag to look around. Scroll or pinch to zoom. Tap anyone or anything for its sheet.
                Tap twice to follow it.
            </p>
            <h4>Citizens</h4>
            <ul class="civ-key">
                ${citizens.map(
                    ([role, name, about]) =>
                        html`<li>
                            <img src=${portrait({ ...lookFor(role) }, 2)} alt="" />
                            <span><b>${name}</b> ${about}</span>
                        </li>`,
                )}
            </ul>
            <h4>Buildings</h4>
            <ul class="civ-key">
                ${Object.values(PLACES).map(
                    (place) =>
                        html`<li>
                            <${Px} name=${place.icon} size=${24} />
                            <span
                                ><b style=${`color:${place.color}`}>${place.label}</b>${" "}
                                ${place.about}</span
                            >
                        </li>`,
                )}
            </ul>
            <h4>Pigeons</h4>
            <ul class="civ-key civ-key-row">
                ${Object.entries(VIA).map(
                    ([name, via]) =>
                        html`<li>
                            <i class="civ-swatch" style=${`background:${via.color}`}></i>
                            ${name === "human" ? "a person's letter" : name === "subagent" ? "work for an apprentice" : name === "report" ? "a report" : name === "team" ? "between sessions" : name === "system" ? "a schedule or PR watch" : "a stop order"}
                        </li>`,
                )}
            </ul>
            <h4>Sky</h4>
            <div class="civ-seg">
                <button aria-pressed=${sky === "cycle"} onClick=${() => setSky("cycle")}>
                    8-minute days
                </button>
                <button aria-pressed=${sky === "real"} onClick=${() => setSky("real")}>
                    Your clock
                </button>
            </div>
            <p class="civ-dim">Storms come when tools fail again and again.</p>
            <p class="civ-dim">
                The town sees each model request and tool call in every session you can see, while
                this extension is on. It keeps them for you alone.
            </p>
            ${!demo && html`<button class="civ-btn civ-danger" onClick=${onForget}>Forget all history</button>`}
        <//>`;
    }

    function lookFor(role) {
        const looks = {
            session: {
                shirt: "#3b5dc9",
                hair: "#5c3a22",
                skin: "#f2c7a5",
                pants: "#29366f",
                hat: "wizard",
                hatColor: "#7b3fa0",
                cape: true,
            },
            subagent: {
                shirt: "#38b764",
                hair: "#1a1c2c",
                skin: "#e0a982",
                pants: "#5c3a22",
                hat: "cap",
                hatColor: "#ef7d57",
                cape: false,
            },
            linked: {
                shirt: "#e070c0",
                hair: "#e9cf9a",
                skin: "#ffd9c0",
                pants: "#257179",
                hat: "feather",
                hatColor: "#41a6f6",
                cape: false,
            },
            human: {
                shirt: "#b13e53",
                hair: "#8f5a36",
                skin: "#f2c7a5",
                pants: "#333c57",
                hat: "crown",
                hatColor: "#ffcd75",
                cape: true,
            },
        };

        return looks[role];
    }

    function Page({ close }) {
        const wrapRef = useRef(null);
        const hudRef = useRef(null);
        const rootRef = useRef(null);
        const [hud, setHud] = useState(60);
        const canvasRef = useRef(null);
        const townRef = useRef(null);
        const demoRef = useRef(null);
        const soundRef = useRef(null);
        const focusRef = useRef(null);
        const [ready, setReady] = useState(store.loaded);
        const [error, setError] = useState(null);
        const [stats, setStats] = useState(null);
        const [log, setLog] = useState([]);
        const [selection, setSelection] = useState(null);
        const [scope, setScope] = useState("family");
        const [demo, setDemo] = useState(false);
        const [sound, setSound] = useState(false);
        const [sky, setSkyState] = useState(() => read("sky", "cycle"));
        const [panel, setPanel] = useState(
            () => matchMedia("(min-width: 900px)").matches && read("panel", "1") === "1",
        );
        const [manual, setManual] = useState(false);
        const manualRef = useRef(false);

        manualRef.current = manual;
        const [narrow, setNarrow] = useState(() => !matchMedia("(min-width: 900px)").matches);
        const [expanded, setExpanded] = useState(false);
        const [splash, setSplash] = useState(true);

        if (focusRef.current === null) {
            const id = pocket.conversationId();

            focusRef.current = { id: id === null ? null : String(id) };
        }

        const focus = focusRef.current.id;

        useEffect(() => {
            const town = new Town(canvasRef.current, store);
            const sounder = new Sound();
            const asked = new Set();
            const retryAt = new Map();
            const askedAt = new Map();
            const askedTries = new Map();
            const failures = new Map();
            let asking = false;
            let lastLog = -1;
            let stopped = false;
            const firstScope = focus ? read("scope", "family") : "universe";

            townRef.current = town;
            soundRef.current = sounder;
            town.sound = sounder;
            town.sky = read("sky", "cycle");
            town.setScope(firstScope, focus);
            setScope(firstScope);

            const size = () => {
                if (stopped || !wrapRef.current) {
                    return;
                }

                if (hudRef.current) {
                    setHud(Math.round(hudRef.current.getBoundingClientRect().height) + 16);
                }

                const box = wrapRef.current.getBoundingClientRect();

                town.resize(box.width, box.height);
            };

            const observer = new ResizeObserver(size);

            observer.observe(wrapRef.current);

            if (hudRef.current) {
                observer.observe(hudRef.current);
            }

            size();
            town.start();

            // A tap on the map frames what it chose, as a pick from the log does.
            town.onSelect = (ref) => {
                if (ref) {
                    town.focusOn(ref);
                }

                setSelection(town.selection());
            };

            town.onReplayEnd = () => {
                town.stopReplay(town.data.events);
                setStats(town.stats());
            };

            const splashTimer = setTimeout(() => setSplash(false), 2200);

            // Titles, and the sessions the server holds back until the owner's own request shows they may see them.
            const askMeta = () => {
                if (asking || demoRef.current || !store.loaded) {
                    return;
                }

                const now = Date.now();
                const waiting = (id) => (retryAt.get(id) ?? 0) > now;
                const held = [...store.unknown].find(
                    ([id, since]) => !asked.has(id) && !waiting(id) && now - since > 1200,
                )?.[0];
                const want =
                    held ??
                    [...town.visible].find((id) => {
                        const conv = store.convs[id];
                        // Titles change (Pi names a new session after its first answer): a session is
                        // asked again now and then, sooner while it still has a placeholder title.
                        // Untitled: after 20 s, then 40 s, 80 s, … up to 5 minutes; 5 tries at most.
                        const untitled = !conv?.title || /^new session$/i.test(conv.title);
                        const tries = askedTries.get(id) ?? 0;
                        const stale =
                            asked.has(id) &&
                            (!untitled || tries < 5) &&
                            now - (askedAt.get(id) ?? 0) >
                                (untitled ? Math.min(300_000, 20_000 * 2 ** tries) : 300_000);

                        return (
                            /^\d+$/.test(id) &&
                            (!asked.has(id) || stale) &&
                            !waiting(id) &&
                            conv?.kind !== "subagent" &&
                            (stale || id === focus || !conv || !conv.title || conv.placeholder)
                        );
                    });

                if (want === undefined || !/^\d+$/.test(want)) {
                    if (want !== undefined) {
                        asked.add(want);
                    }

                    return;
                }

                if (asked.has(want)) {
                    askedTries.set(want, (askedTries.get(want) ?? 0) + 1);
                }

                asked.add(want);
                askedAt.set(want, now);
                asking = true;
                pocket
                    .api(`meta/${want}`)
                    .then((answer) => {
                        if (stopped || !answer?.conv) {
                            return;
                        }

                        store.unknown.delete(want);
                        retryAt.delete(want);
                        failures.delete(want);
                        store.convs[want] = answer.conv;
                        Object.assign(store.convs, table(answer.convs));
                        store.res = answer.res ? table(answer.res) : store.res;
                        store.humans = answer.humans ? table(answer.humans) : store.humans;

                        const added = insertEvents(store, answer.events ?? []).length;

                        // The demo town has data of its own: the real one waits in the store until it is
                        // back. A replay shows the past: it takes the new events when it ends.
                        if (town.data !== store || town.replay) {
                            return;
                        }

                        if (added > 0) {
                            town.derive(store.events);
                        } else {
                            town.dirty = true;
                        }
                    })
                    .catch((failure) => {
                        // Not the owner's to see: never ask again. A network failure: ask again later.
                        if (failure?.status === 403 || failure?.status === 404) {
                            store.unknown.delete(want);

                            return;
                        }

                        const count = (failures.get(want) ?? 0) + 1;

                        failures.set(want, count);
                        retryAt.set(want, Date.now() + Math.min(120_000, 2000 * 2 ** count));
                        asked.delete(want);
                    })
                    .finally(() => {
                        asking = false;
                    });
            };

            const onFresh = (fresh) => {
                if (fresh === null) {
                    asked.clear();
                    retryAt.clear();
                    failures.clear();
                    setSelection(null);

                    if (!demoRef.current) {
                        town.reset(store);
                        town.setScope(town.scope, focus);
                        town.derive(store.events);
                    }

                    return;
                }

                for (const event of fresh) {
                    if (event.k === "done" && event.n === "team") {
                        asked.delete(event.c);
                    }
                }

                if (!demoRef.current && !town.replay && store.loaded) {
                    town.ingest(fresh, true);
                }
            };

            listeners.add(onFresh);

            load()
                .then(() => {
                    if (!stopped) {
                        town.derive(store.events);
                        setReady(true);
                    }
                })
                .catch((failure) => setError(failure?.message ?? String(failure)));

            // The panels follow the town; they draw again only when what they show changed.
            let lastStats = "";
            let lastSheet = "";
            const tick = setInterval(() => {
                const now = town.stats();
                const statsKey = JSON.stringify(now);

                if (statsKey !== lastStats) {
                    lastStats = statsKey;
                    setStats(now);
                }

                const sheet = town.selected ? town.selection() : null;
                const sheetKey = JSON.stringify(sheet);

                if (sheetKey !== lastSheet) {
                    lastSheet = sheetKey;
                    setSelection(sheet);
                }

                if (town.chronicleVersion !== lastLog) {
                    lastLog = town.chronicleVersion;
                    setLog(town.chronicle.slice(0, 80));
                }

                askMeta();
            }, 400);

            const media = matchMedia("(min-width: 900px)");
            const onMedia = () => setNarrow(!media.matches);

            media.addEventListener("change", onMedia);

            return () => {
                stopped = true;
                clearInterval(tick);
                clearTimeout(splashTimer);
                listeners.delete(onFresh);
                observer.disconnect();
                media.removeEventListener("change", onMedia);
                town.stop();
                demoRef.current?.stop();
                sounder.close();
            };
        }, []);

        const quiet = !!(
            ready &&
            !demo &&
            stats &&
            stats.active === 0 &&
            log.length === 0 &&
            !stats.replay
        );
        const card = !!selection || manual;

        // Esc closes an open sheet or the manual first, and the page only when nothing is open. The page is added
        // with `escape: false`, so the app leaves Esc to it; what another part of the app handled stays handled.
        const closeRef = useRef(close);

        closeRef.current = close;
        useEffect(() => {
            const onKey = (event) => {
                const active = document.activeElement;
                const elsewhere = active && !rootRef.current?.contains(active);

                // Not while typing, or in a menu or dialog of the app; a button (the rail's) is fine.
                if (
                    event.key !== "Escape" ||
                    event.defaultPrevented ||
                    (elsewhere &&
                        (active.isContentEditable ||
                            ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) ||
                            active.closest?.('[role="dialog"], [role="menu"], dialog')))
                ) {
                    return;
                }

                event.preventDefault();

                if (townRef.current?.selected || manualRef.current) {
                    if (townRef.current) {
                        townRef.current.selected = null;
                        townRef.current.tracking = null;
                    }

                    setSelection(null);
                    setManual(false);
                } else {
                    closeRef.current?.();
                }
            };

            addEventListener("keydown", onKey);

            return () => removeEventListener("keydown", onKey);
        }, []);

        // The town keeps what matters in the part of the view no panel covers: measured, not guessed.
        useEffect(() => {
            const root = rootRef.current;
            const town = townRef.current;

            if (!root || !town) {
                return undefined;
            }

            const measure = () => {
                const box = root.getBoundingClientRect();
                const rect = (selector) => root.querySelector(selector)?.getBoundingClientRect();
                const sheet = rect(".civ-sheet");
                const log = rect(".civ-log");
                const middle = rect(".civ-center .civ-win");
                const gap = 8;

                if (narrow) {
                    const tops = [sheet, log, middle].filter(Boolean).map((r) => r.top);

                    town.setInsets({
                        top: hud,
                        right: 0,
                        bottom: tops.length > 0 ? box.bottom - Math.min(...tops) + gap : 0,
                        left: 0,
                    });
                } else {
                    town.setInsets({
                        top: hud,
                        right: log ? box.right - log.left + gap : 0,
                        bottom: middle ? box.bottom - middle.top + gap : 0,
                        left: sheet ? sheet.right - box.left + gap : 0,
                    });
                }
            };

            measure();

            const watch = new ResizeObserver(measure);

            root.querySelectorAll(".civ-sheet, .civ-log, .civ-center .civ-win").forEach((each) =>
                watch.observe(each),
            );

            return () => watch.disconnect();
        }, [
            panel,
            narrow,
            quiet,
            manual,
            // Another sheet is another element to watch, even when one simply replaces the other.
            selection ? `${selection.type}:${selection.id ?? selection.name ?? ""}` : "",
            hud,
            expanded,
            ready,
            splash,
            stats?.replay ? 1 : 0,
        ]);

        useEffect(() => {
            soundRef.current?.setNight(!!stats?.night);
        }, [stats?.night]);

        const town = townRef.current;

        const changeScope = (next) => {
            if (!town || next === scope) {
                return;
            }

            setScope(next);
            write("scope", next);

            if (town.replay) {
                town.stopReplay(town.data.events);
            }

            town.setScope(next, focus);
            town.derive(town.data.events);
            setSelection(null);
        };

        const pick = (ref) => {
            if (town) {
                town.selected = ref;
                town.focusOn(ref);
                setSelection(town.selection());
            }
        };

        const toggleDemo = () => {
            if (!town) {
                return;
            }

            if (town.replay) {
                town.stopReplay(town.data.events);
            }

            if (demoRef.current) {
                demoRef.current.stop();
                demoRef.current = null;
                town.reset(store);
                town.setScope(focus ? scope : "universe", focus);
                town.derive(store.events);
                setDemo(false);
            } else {
                // During a replay the demo's events wait in its data; the replay's end takes them in.
                const made = new Demo((batch) => {
                    if (!town.replay) {
                        town.ingest(batch.events, true);
                    }
                });

                demoRef.current = made;
                town.reset(made.data);
                town.setScope("universe", null);
                town.derive([]);
                made.start();
                setDemo(true);
            }

            setSelection(null);
            soundRef.current?.play("start");
        };

        const toggleReplay = () => {
            if (!town) {
                return;
            }

            if (town.replay) {
                town.stopReplay(town.data.events);
            } else if (!town.startReplay(town.data.events)) {
                pocket.notify(
                    "info",
                    "Nothing to replay yet: no agent here has done anything since the town was founded.",
                );
            }

            setStats(town.stats());
        };

        const toggleSound = () => {
            const sounder = soundRef.current;

            if (!sounder) {
                return;
            }

            if (sound) {
                sounder.disable();
                setSound(false);
            } else if (sounder.enable()) {
                setSound(true);
            }
        };

        const togglePanel = () => {
            if (narrow) {
                setExpanded(!expanded);

                return;
            }

            write("panel", panel ? "0" : "1");
            setPanel(!panel);
        };

        const setSky = (value) => {
            setSkyState(value);
            write("sky", value);

            if (town) {
                town.sky = value;
            }
        };

        const forget = async () => {
            if (
                !confirm(
                    "Forget every event and count the town has kept? Agents keep working; the town starts over.",
                )
            ) {
                return;
            }

            try {
                await pocket.api("reset", {});
                setManual(false);
            } catch (failure) {
                pocket.notify("error", `Could not forget: ${failure.message}`);
            }
        };

        // The world could not load (the server was down, say): try once more, by hand.
        const retry = () => {
            setError(null);
            load()
                .then(() => {
                    townRef.current?.derive(store.events);
                    setReady(true);
                })
                .catch((failure) => setError(failure?.message ?? String(failure)));
        };

        const fitAll = () => {
            if (town) {
                town.follow = "overview";
                town.tracking = null;
            }
        };

        const hour = stats ? Math.floor(stats.hour) : 12;
        const clock = `${String(hour).padStart(2, "0")}:${String(Math.floor(((stats?.hour ?? 12) % 1) * 60)).padStart(2, "0")}`;

        return html`<div
            ref=${rootRef}
            class=${`civ-root${narrow ? " civ-narrow" : ""}${card ? " civ-carded" : ""}`}
            style=${`--civ-hud:${hud}px`}
            data-no-swipe=""
        >
            <div class="civ-stage" ref=${wrapRef}>
                <canvas
                    ref=${canvasRef}
                    class="civ-canvas"
                    role="img"
                    aria-label="A pixel town of the agents at work. The quest log lists the same events."
                ></canvas>
            </div>

            <div class="civ-hud" ref=${hudRef}>
                <div class="civ-status">
                    <span
                        title=${stats?.storm ? "A storm: tools keep failing" : "The time of day in town"}
                        onClick=${() =>
                            narrow &&
                            pocket.notify(
                                "info",
                                stats?.storm
                                    ? "A storm: tools keep failing"
                                    : "The time of day in town",
                            )}
                    >
                        <${Px}
                            name=${stats?.storm ? "storm" : stats?.night ? "moon" : "sun"}
                            size=${16}
                        />
                        <b>${clock}</b>
                        <small>${stats?.storm ? "storm" : stats?.night ? "night" : "day"}</small>
                    </span>
                    ${STATUS.map(
                        ([icon, key, word, hint]) =>
                            html`<span
                                title=${hint}
                                class=${key === "cost" ? "civ-gold" : ""}
                                onClick=${() => narrow && pocket.notify("info", hint)}
                            >
                                <${Px} name=${icon} size=${16} />
                                <b
                                    >${key === "tokens" ? fmt(stats?.tokens ?? 0) : key === "cost" ? money(stats?.cost ?? 0) : (stats?.[key] ?? 0)}</b
                                >
                                <small>${word}</small>
                            </span>`,
                    )}
                </div>
                <div class="civ-menu">
                    ${
                        focus &&
                        !demo &&
                        html`<div class="civ-seg" role="group" aria-label="What to show">
                            <button
                                aria-pressed=${scope === "family"}
                                onClick=${() => changeScope("family")}
                                title="This session, its subagents, and its linked sessions"
                            >
                                This session
                            </button>
                            <button
                                aria-pressed=${scope === "universe"}
                                onClick=${() => changeScope("universe")}
                                title="Every session of the last three days"
                            >
                                All
                            </button>
                        </div>`
                    }
                    <button class="civ-btn" onClick=${fitAll} title="See the whole town">
                        See all
                    </button>
                    <button
                        class="civ-btn"
                        aria-pressed=${!!stats?.replay}
                        onClick=${toggleReplay}
                        title="Time-lapse: watch it all happen again, fast"
                    >
                        Replay
                    </button>
                    <button
                        class="civ-btn"
                        aria-pressed=${sound}
                        onClick=${toggleSound}
                        title="Chiptune music and sounds"
                    >
                        ${sound ? "♪ Sound on" : "♪ Sound off"}
                    </button>
                    <button
                        class="civ-btn civ-demo"
                        aria-pressed=${demo}
                        onClick=${toggleDemo}
                        title="A made-up town, to see what it does"
                    >
                        ${demo ? "Back to live" : "Demo"}
                    </button>
                    ${!narrow && html`<button class="civ-btn" aria-pressed=${panel} onClick=${togglePanel} title="Quest log">Log</button>`}
                    <button
                        class="civ-btn"
                        aria-pressed=${manual}
                        onClick=${() => setManual(!manual)}
                        title="How to play"
                    >
                        Help
                    </button>
                </div>
            </div>

            ${
                splash &&
                html`<div class="civ-splash" aria-hidden="true">
                    <h1>Agent<br />Civilization</h1>
                    <p>A living town of your agents</p>
                </div>`
            }
            ${
                !ready &&
                !error &&
                html`<div class="civ-center">
                    <div class="civ-win civ-small"><p class="civ-blink">Loading the town…</p></div>
                </div>`
            }
            ${
                error &&
                html`<div class="civ-center">
                    <div class="civ-win civ-small" role="alert">
                        <p>${`The town could not load: ${error}`}</p>
                        <button class="civ-btn civ-go" onClick=${retry}>Try again</button>
                    </div>
                </div>`
            }
            ${
                quiet &&
                !splash &&
                html`<div class="civ-center civ-low" style=${!narrow && panel ? "right:316px" : ""}>
                    <${Window} title="A quiet land" icon="sun" className="civ-small">
                        <p>
                            No agent has worked here since the town was founded. When Pi works,
                            sends apprentices, or starts linked sessions, the town comes to life.
                        </p>
                        <button class="civ-btn civ-go civ-blink" onClick=${toggleDemo}>
                            ▶ Press start for a demo
                        </button>
                    <//>
                </div>`
            }
            ${
                stats?.replay &&
                html`<div class="civ-win civ-replay">
                    <span>◀◀ ${narrow ? time(stats.replay.at) : day(stats.replay.at)}</span>
                    <${Bar} value=${stats.replay.progress} color="#73eff7" />
                    <button class="civ-btn" onClick=${toggleReplay}>Stop</button>
                </div>`
            }
            ${
                (narrow || panel) &&
                !quiet &&
                html`<section
                    class=${`civ-win civ-log${narrow ? (expanded ? " civ-drawer-open" : " civ-drawer") : ""}`}
                    aria-label="Quest log"
                    onClick=${narrow && !expanded ? togglePanel : undefined}
                >
                    <header class="civ-win-head" onClick=${narrow ? togglePanel : undefined}>
                        <${Px} name="scroll" />
                        <h3>Quest log</h3>
                        ${demo && html`<span class="civ-tag">demo</span>`}
                        ${narrow && html`<span class="civ-dim">${expanded ? "▼" : "▲"}</span>`}
                    </header>
                    <ol>
                        ${log.length === 0 && html`<li class="civ-dim civ-empty">Nothing yet.</li>`}
                        ${log.map(
                            (line) =>
                                html`<li
                                    key=${line.id}
                                    tabindex=${line.c && (!narrow || expanded) ? 0 : undefined}
                                    role=${line.c && (!narrow || expanded) ? "button" : undefined}
                                    onClick=${narrow && !expanded ? undefined : () => line.c && pick(line.site ? { type: "site", id: line.site } : { type: "citizen", id: line.c })}
                                    onKeyDown=${(event) => {
                                        if (
                                            (event.key === "Enter" || event.key === " ") &&
                                            line.c &&
                                            (!narrow || expanded)
                                        ) {
                                            event.preventDefault();
                                            pick(
                                                line.site
                                                    ? { type: "site", id: line.site }
                                                    : { type: "citizen", id: line.c },
                                            );
                                        }
                                    }}
                                >
                                    <${Px} name=${line.icon} />
                                    <span class="civ-line">
                                        <b style=${`color:${line.color}`}
                                            >${ellipsize(line.who, 24)}</b
                                        >${` ${line.text}`}
                                    </span>
                                    <time>${time(line.at)}</time>
                                </li>`,
                        )}
                    </ol>
                </section>`
            }
            ${
                manual
                    ? html`<${Manual}
                          onClose=${() => setManual(false)}
                          onForget=${forget}
                          sky=${sky}
                          setSky=${setSky}
                          demo=${demo}
                      />`
                    : html`<${Sheet}
                          info=${selection}
                          demo=${demo}
                          onClose=${() => {
                              town.selected = null;
                              town.tracking = null;
                              setSelection(null);
                          }}
                          onPick=${pick}
                          onOpen=${(id) => pocket.openConversation(Number(id))}
                      />`
            }
        </div>`;
    }

    pocket.page({
        id: "civ",
        title: "Agent Civilization",
        component: Page,
        swipe: false,
        escape: false,
    });
}
