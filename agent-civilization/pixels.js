// The pixel toolkit: a palette, a 5×7 bitmap font, 8×8 icons, and every sprite of the town, drawn with rectangles
// at game resolution. All coordinates are whole game pixels; the town is drawn small and scaled up without smoothing.

export const C = {
    ink: "#1a1c2c",
    plum: "#5d275d",
    red: "#b13e53",
    orange: "#ef7d57",
    gold: "#ffcd75",
    lime: "#a7f070",
    green: "#38b764",
    teal: "#257179",
    navy: "#29366f",
    blue: "#3b5dc9",
    sky: "#41a6f6",
    cyan: "#73eff7",
    white: "#f4f4f4",
    silver: "#94b0c2",
    steel: "#566c86",
    slate: "#333c57",
    brown: "#8f5a36",
    dark: "#5c3a22",
    tan: "#d8a878",
    sand: "#e9cf9a",
    pink: "#e070c0",
    grass: "#4a8f3f",
    grass2: "#559a44",
    grass3: "#41823a",
    leaf: "#2b6332",
    leaf2: "#3b8a3e",
    leaf3: "#6cbf4f",
    dirt: "#c2915e",
    dirt2: "#a07048",
    stone: "#b4bfcc",
    stone2: "#7f8ea3",
    water: "#2c50b4",
    water2: "#3d6fdc",
};

/** Shirt colors, picked by a hash: every citizen keeps one. */
export const SHIRTS = [
    "#b13e53",
    "#ef7d57",
    "#ffcd75",
    "#a7f070",
    "#38b764",
    "#257179",
    "#41a6f6",
    "#3b5dc9",
    "#7b3fa0",
    "#e070c0",
    "#73eff7",
    "#f4f4f4",
];
const HAIRS = ["#1a1c2c", "#5c3a22", "#8f5a36", "#e9cf9a", "#b13e53", "#94b0c2", "#ef7d57"];
const SKINS = ["#f2c7a5", "#e0a982", "#c68a5e", "#8d5a3b", "#ffd9c0"];

export function hash(text) {
    let value = 2166136261;
    const string = String(text);

    for (let index = 0; index < string.length; index++) {
        value ^= string.charCodeAt(index);
        value = Math.imul(value, 16777619);
    }

    return value >>> 0;
}

/** A small seeded random number source, for things that must look the same each time. */
export function rng(seed) {
    let state = seed >>> 0 || 1;

    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;

        return ((state >>> 0) % 100000) / 100000;
    };
}

export function rgbOf(hex) {
    const value = parseInt(hex.slice(1), 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Lighter (amount > 0) or darker (< 0). */
export function shade(hex, amount) {
    const [r, g, b] = rgbOf(hex);
    const mix = (value) =>
        Math.round(amount >= 0 ? value + (255 - value) * amount : value * (1 + amount));
    const out = (value) =>
        Math.max(0, Math.min(255, mix(value)))
            .toString(16)
            .padStart(2, "0");

    return `#${out(r)}${out(g)}${out(b)}`;
}

export const rgba = (hex, alpha) => {
    const [r, g, b] = rgbOf(hex);

    return `rgba(${r},${g},${b},${alpha})`;
};

export function rect(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
}

export function px(c, x, y, color) {
    c.fillStyle = color;
    c.fillRect(x, y, 1, 1);
}

/** A filled disc of whole pixels. */
export function disc(c, cx, cy, r, color) {
    c.fillStyle = color;

    for (let dy = -r; dy <= r; dy++) {
        const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));

        c.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
}

// ——— the font ———

const GLYPHS = {
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
    X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    1: [".#.", "##.", ".#.", ".#.", ".#.", ".#.", "###"],
    2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
    7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
    " ": ["...", "...", "...", "...", "...", "...", "..."],
    ".": [".", ".", ".", ".", ".", ".", "#"],
    ",": ["..", "..", "..", "..", "..", ".#", "#."],
    ":": [".", ".", "#", ".", ".", "#", "."],
    ";": ["..", "..", ".#", "..", "..", ".#", "#."],
    "!": ["#", "#", "#", "#", "#", ".", "#"],
    "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
    "'": ["#", "#", ".", ".", ".", ".", "."],
    '"': ["#.#", "#.#", "...", "...", "...", "...", "..."],
    "-": ["....", "....", "....", "####", "....", "....", "...."],
    "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
    "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
    "\\": ["#....", "#....", ".#...", "..#..", "...#.", "....#", "....#"],
    "(": [".#", "#.", "#.", "#.", "#.", "#.", ".#"],
    ")": ["#.", ".#", ".#", ".#", ".#", ".#", "#."],
    "[": ["##", "#.", "#.", "#.", "#.", "#.", "##"],
    "]": ["##", ".#", ".#", ".#", ".#", ".#", "##"],
    "<": ["...#", "..#.", ".#..", "#...", ".#..", "..#.", "...#"],
    ">": ["#...", ".#..", "..#.", "...#", "..#.", ".#..", "#..."],
    "=": ["....", "....", "####", "....", "####", "....", "...."],
    _: ["....", "....", "....", "....", "....", "....", "####"],
    "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
    $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
    "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
    "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
    "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
    "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
    "~": [".....", ".....", ".#...", "#.#.#", "...#.", ".....", "....."],
    "|": ["#", "#", "#", "#", "#", "#", "#"],
    "^": ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
    "`": ["#.", ".#", "..", "..", "..", "..", ".."],
    "·": [".", ".", ".", "#", ".", ".", "."],
    "✓": [".....", "....#", "...#.", "#.#..", ".#...", ".....", "....."],
    "♪": ["..##", "..#.", "..#.", "..#.", "###.", "###.", "...."],
    "♥": [".....", ".#.#.", "#####", "#####", ".###.", "..#..", "....."],
};
const SWAP = {
    "{": "(",
    "}": ")",
    "…": "...",
    "→": ">",
    "←": "<",
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    "×": "X",
    "–": "-",
    "—": "-",
    "•": "·",
};

export const LINE = 9;

/** Text in the font's characters: capitals, digits, and common signs; anything else as "?". */
export function plain(text) {
    let out = "";

    for (const char of String(text ?? "").normalize("NFD")) {
        if (/[\u0300-\u036f]/.test(char)) {
            continue;
        }

        const upper = SWAP[char] ?? char.toUpperCase();

        for (const each of upper) {
            out += GLYPHS[each]
                ? each
                : /\s/.test(each)
                  ? " "
                  : /\p{Extended_Pictographic}/u.test(each)
                    ? ""
                    : "?";
        }
    }

    return out;
}

export function textWidth(text) {
    let width = 0;

    for (const char of plain(text)) {
        width += GLYPHS[char][0].length + 1;
    }

    return Math.max(0, width - 1);
}

const fitCache = new Map();

/** The text, cut with "..." to fit `width` pixels. Cached: labels ask for the same ones each frame. */
export function fit(text, width) {
    const key = `${width}|${text}`;
    let value = fitCache.get(key);

    if (value !== undefined) {
        return value;
    }

    value = plain(text);

    if (textWidth(value) > width) {
        const widths = [...value].map((char) => GLYPHS[char][0].length + 1);
        let used = textWidth("...") + 1;
        let keep = 0;

        while (keep < value.length && used + widths[keep] <= width + 1) {
            used += widths[keep];
            keep++;
        }

        value = `${value.slice(0, Math.max(1, keep)).trimEnd()}...`;
    }

    fitCache.set(key, value);

    if (fitCache.size > 1000) {
        fitCache.delete(fitCache.keys().next().value);
    }

    return value;
}

const textCache = new Map();

/** A canvas with the text drawn in the font, with a dark outline when `outline` is set. Cached. */
export function textSprite(text, color = C.white, outline = C.ink) {
    const value = plain(text);
    const key = `${value}|${color}|${outline}`;
    let sprite = textCache.get(key);

    if (sprite !== undefined) {
        textCache.delete(key);
        textCache.set(key, sprite);

        return sprite;
    }

    const pad = outline ? 1 : 0;
    const width = Math.max(1, textWidth(value)) + pad * 2;

    sprite = document.createElement("canvas");
    sprite.width = width;
    sprite.height = 7 + pad * 2;

    const g = sprite.getContext("2d");

    const paint = (dx, dy, fill) => {
        g.fillStyle = fill;

        let x = pad;

        for (const char of value) {
            const rows = GLYPHS[char];

            rows.forEach((row, y) => {
                for (let column = 0; column < row.length; column++) {
                    if (row[column] === "#") {
                        g.fillRect(x + column + dx, pad + y + dy, 1, 1);
                    }
                }
            });
            x += rows[0].length + 1;
        }
    };

    if (outline) {
        for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
        ]) {
            paint(dx, dy, outline);
        }
    }

    paint(0, 0, color);
    textCache.set(key, sprite);

    if (textCache.size > 500) {
        textCache.delete(textCache.keys().next().value);
    }

    return sprite;
}

/** Draws text with its top left, or its top middle when `center`. */
export function text(c, value, x, y, color = C.white, { center = false, outline = C.ink } = {}) {
    const sprite = textSprite(value, color, outline);
    const left = center ? Math.round(x - sprite.width / 2) : Math.round(x) - (outline ? 1 : 0);

    c.drawImage(sprite, left, Math.round(y) - (outline ? 1 : 0));

    return sprite.width;
}

/** Words broken into lines no wider than `width`, at most `max` lines. */
export function wrap(value, width, max = 3) {
    const words = plain(value).split(" ").filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
        const next = line ? `${line} ${word}` : word;

        if (textWidth(next) > width && line) {
            // A word too long for any line is cut, wherever it falls.
            lines.push(fit(line, width));
            line = word;

            if (lines.length === max) {
                break;
            }
        } else {
            line = next;
        }
    }

    if (lines.length < max && line) {
        lines.push(textWidth(line) > width ? fit(line, width) : line);
    } else if (lines.length === max) {
        lines[max - 1] = fit(`${lines[max - 1]} ...`, width);
    }

    return lines;
}

// ——— icons: 8×8, for the map's signs, the log, and the panels ———

const ICON_COLORS = {
    k: C.ink,
    w: C.white,
    l: C.silver,
    g: C.steel,
    r: C.red,
    o: C.orange,
    y: C.gold,
    G: C.green,
    L: C.lime,
    t: C.teal,
    b: C.blue,
    s: C.sky,
    c: C.cyan,
    p: "#7b3fa0",
    m: C.pink,
    n: C.brown,
    N: C.dark,
    v: "#b48cff",
};

export const ICONS = {
    book: [
        "........",
        ".kk..kk.",
        "kwwkkwwk",
        "kwlwwlwk",
        "kwwwwwwk",
        "kwlwwlwk",
        "kkkkkkkk",
        "...kk...",
    ],
    quill: [
        ".......w",
        "......wl",
        ".....wlk",
        "....wlk.",
        "...wlk..",
        "..kwk...",
        ".kkk....",
        "kk......",
    ],
    hammer: [
        ".kkkkk..",
        "kllllgk.",
        "kggggkk.",
        ".kknkk..",
        "...knk..",
        "...knk..",
        "...knk..",
        "...kk...",
    ],
    anchor: [
        "...kk...",
        "..kwwk..",
        "...kk...",
        ".kkwwkk.",
        "...kk...",
        "k..kk..k",
        "kk.kk.kk",
        ".kkkkkk.",
    ],
    scope: [
        "......kk",
        "....kkck",
        "..kksskk",
        "kkssskk.",
        "kbsskk..",
        ".kkk.k..",
        "....k.k.",
        "...k...k",
    ],
    gear: [
        "...kk...",
        ".kkllkk.",
        ".kllllk.",
        "kllkkllk",
        "kllkkllk",
        ".kllllk.",
        ".kkllkk.",
        "...kk...",
    ],
    key: [
        ".kkk....",
        "kyyyk...",
        "kykyk...",
        "kyyykkkk",
        ".kkkyyyk",
        ".....kyk",
        ".....kyk",
        "......k.",
    ],
    frame: [
        "kkkkkkkk",
        "knnnnnnk",
        "knsscsnk",
        "knsLLsnk",
        "knGGLGnk",
        "knnnnnnk",
        "kkkkkkkk",
        "........",
    ],
    clock: [
        "..kkkk..",
        ".kwwwwk.",
        "kwwkwwwk",
        "kwwkwwwk",
        "kwwkkkwk",
        "kwwwwwwk",
        ".kwwwwk.",
        "..kkkk..",
    ],
    flag: [
        "kk......",
        "kkmmmmk.",
        "kkmmmmmk",
        "kkmmmmk.",
        "kkkkkk..",
        "kk......",
        "kk......",
        "kk......",
    ],
    orb: [
        "..kkkk..",
        ".kvvvvk.",
        "kvwvvvvk",
        "kvwvvvvk",
        "kvvvvvvk",
        ".kvvvvk.",
        "..kyyk..",
        ".kyyyyk.",
    ],
    shield: [
        "kkkkkkkk",
        "kbbyybbk",
        "kbbyybbk",
        "kyyyyyyk",
        "kbbyybbk",
        ".kbyybk.",
        "..kbbk..",
        "...kk...",
    ],
    letter: [
        "........",
        "kkkkkkkk",
        "kwwwwwwk",
        "kkwwwwkk",
        "kwkkkkwk",
        "kwwwwwwk",
        "kkkkkkkk",
        "........",
    ],
    scroll: [
        ".kkkkkk.",
        "kyyyyyyk",
        ".kwwwwk.",
        ".kwkkwk.",
        ".kwwwwk.",
        ".kwkkwk.",
        "kyyyyyyk",
        ".kkkkkk.",
    ],
    tent: [
        "...kk...",
        "..krrk..",
        "..krrk..",
        ".krrkrk.",
        ".krkkrk.",
        "krrkkrrk",
        "krkkkkrk",
        "kkkkkkkk",
    ],
    house: [
        "...kk...",
        "..krrk..",
        ".krrrrk.",
        "krrrrrrk",
        ".kwwwwk.",
        ".kwnnwk.",
        ".kwnnwk.",
        ".kkkkkk.",
    ],
    skull: [
        ".kkkkkk.",
        "kwwwwwwk",
        "kwkwwkwk",
        "kwkwwkwk",
        "kwwkkwwk",
        ".kwwwwk.",
        ".kwkwkk.",
        "..kkkk..",
    ],
    speech: [
        ".kkkkkk.",
        "kwwwwwwk",
        "kwgwgwgk",
        "kwwwwwwk",
        ".kkwkkk.",
        "..kwk...",
        "..kk....",
        "........",
    ],
    coin: [
        "..kkkk..",
        ".kyyyyk.",
        "kyywyyok",
        "kywyyyok",
        "kyyyyyok",
        "kyyyyook",
        ".kooook.",
        "..kkkk..",
    ],
    person: [
        "..kkkk..",
        ".knnnnk.",
        ".kykkyk.",
        ".kyyyyk.",
        "..kkkk..",
        ".kssssk.",
        "kssssssk",
        "kssssssk",
    ],
    bolt: [
        "....kkk.",
        "...kyyk.",
        "..kyyk..",
        ".kyyyyk.",
        ".kkyyk..",
        "..kyk...",
        ".kyk....",
        ".kk.....",
    ],
    crown: [
        "........",
        "k.k..k.k",
        "kykkkkyk",
        "kyykkyyk",
        "kyyyyyyk",
        "kryyyyrk",
        "kkkkkkkk",
        "........",
    ],
    storm: [
        "..kkkk..",
        ".kllllk.",
        "kllllllk",
        "kggggggk",
        ".kkykkk.",
        "..ky.s..",
        ".ky.s.s.",
        ".y......",
    ],
    sun: [
        "...y....",
        ".y.yy.y.",
        "..yyyy..",
        "yyyyyyyy",
        "..yyyy..",
        ".y.yy.y.",
        "...y....",
        "........",
    ],
    moon: [
        "..kkk...",
        ".kyyk...",
        "kyyk....",
        "kyyk....",
        "kyyk....",
        ".kyyk...",
        "..kkkk..",
        "........",
    ],
    pigeon: [
        "........",
        "...kk...",
        "..kwwk..",
        ".kwwwwkk",
        "kwwwwwwo",
        ".kwwwwk.",
        "..kllk..",
        "...kk...",
    ],
    globe: [
        "..kkkk..",
        ".kbGGbk.",
        "kbGGbbbk",
        "kbbGGGbk",
        "kGbbGGbk",
        "kbbbbGbk",
        ".kbGbbk.",
        "..kkkk..",
    ],
    star: [
        "...k....",
        "...yk...",
        "..kyyk..",
        "kkyyyykk",
        ".kyyyyk.",
        "..kyyk..",
        ".kyk.yk.",
        ".k....k.",
    ],
    eye: [
        "........",
        "..kkkk..",
        ".kwwwwk.",
        "kwwbbwwk",
        "kwwbkwwk",
        ".kwwwwk.",
        "..kkkk..",
        "........",
    ],
    potion: [
        "...kk...",
        "..kllk..",
        "...kk...",
        "..kmmk..",
        ".kmmmmk.",
        "kmmwmmmk",
        "kmmmmmmk",
        ".kkkkkk.",
    ],
};

const iconCache = new Map();

export function drawIcon(c, name, x, y, scale = 1) {
    const art = ICONS[name] ?? ICONS.star;

    art.forEach((row, dy) => {
        for (let dx = 0; dx < row.length; dx++) {
            const color = ICON_COLORS[row[dx]];

            if (color) {
                c.fillStyle = color;
                c.fillRect(x + dx * scale, y + dy * scale, scale, scale);
            }
        }
    });
}

/** An icon as an image address, for the panels around the map. */
export function iconURL(name) {
    let url = iconCache.get(name);

    if (url === undefined) {
        const canvas = document.createElement("canvas");

        canvas.width = canvas.height = 8;
        drawIcon(canvas.getContext("2d"), name, 0, 0);
        url = canvas.toDataURL();
        iconCache.set(name, url);
    }

    return url;
}

// ——— citizens ———

/** How a citizen looks, from who they are. */
export function lookOf(id, role, name) {
    const seed = hash(`${name ?? ""}:${id}`);

    return {
        shirt: SHIRTS[seed % SHIRTS.length],
        hair: HAIRS[(seed >>> 4) % HAIRS.length],
        skin: SKINS[(seed >>> 8) % SKINS.length],
        pants: [C.navy, C.dark, C.slate, C.teal][(seed >>> 12) % 4],
        hat:
            role === "human"
                ? "crown"
                : role === "subagent"
                  ? (seed >>> 16) % 3 === 0
                      ? "helm"
                      : "cap"
                  : role === "linked"
                    ? "feather"
                    : "wizard",
        hatColor: SHIRTS[(seed >>> 20) % SHIRTS.length],
        cape: role === "human" || role === "session",
    };
}

/**
 * A citizen with feet at (x, y). `o`: t (seconds), walk, dir (1 right, -1 left), face ("side", "down", "up"),
 * work (a tool in hand), sit.
 */
export function drawPerson(c, x, y, look, o = {}) {
    const t = o.t ?? 0;
    const dir = o.dir ?? 1;
    const face = o.face ?? "down";
    const step = o.walk ? Math.floor(t * (o.run ? 14 : 9)) % 4 : 0;
    const bob = o.walk && step % 2 === 1 ? -1 : 0;
    const dark = shade(look.shirt, -0.3);

    c.fillStyle = "rgba(16,14,40,0.3)";
    c.fillRect(x - 4, y - 1, 8, 2);
    c.fillRect(x - 3, y + 1, 6, 1);

    if (look.cape && face !== "down") {
        rect(c, x - 3, y - 8 + bob, 6, 6, shade(look.hatColor, -0.35));
    }

    // Legs.
    if (o.sit) {
        rect(c, x - 3, y - 3, 6, 2, look.pants);
        rect(c, x - 4, y - 2, 2, 2, C.ink);
        rect(c, x + 2, y - 2, 2, 2, C.ink);
    } else {
        const left = step === 1 ? -1 : 0;
        const right = step === 3 ? -1 : 0;

        rect(c, x - 3, y - 4 + left, 2, 3, look.pants);
        rect(c, x + 1, y - 4 + right, 2, 3, look.pants);
        rect(c, x - 3, y - 1 + left, 2, 1, C.ink);
        rect(c, x + 1, y - 1 + right, 2, 1, C.ink);
    }

    const top = (o.sit ? y - 6 : y - 8) + bob;

    // Body and arms.
    rect(c, x - 3, top, 6, 5, look.shirt);
    rect(c, x - 3, top + 4, 6, 1, dark);
    px(c, x - 1, top + 1, shade(look.shirt, 0.25));

    const swing = o.walk ? (step === 1 ? 1 : step === 3 ? -1 : 0) : 0;
    let lift = 0;

    if (o.work) {
        lift = Math.floor(t * 6) % 2 === 0 ? -2 : 0;
    }

    rect(c, x - 4, top + 1 + swing, 1, 3, dark);
    px(c, x - 4, top + 4 + swing, look.skin);
    rect(c, x + 3, top + 1 - swing + lift, 1, 3, dark);
    px(c, x + 3, top + 4 - swing + lift, look.skin);

    // Head.
    const head = top - 5;

    rect(c, x - 3, head, 6, 5, look.skin);
    rect(c, x - 3, head - 1, 6, 2, look.hair);

    if (face === "up") {
        rect(c, x - 3, head, 6, 4, look.hair);
    } else if (face === "side") {
        rect(c, dir > 0 ? x - 3 : x + 2, head + 1, 1, 2, look.hair);
        px(c, dir > 0 ? x : x - 3, head + 2, C.ink);
        px(c, dir > 0 ? x + 2 : x - 1, head + 2, C.ink);
    } else {
        px(c, x - 2, head + 2, C.ink);
        px(c, x + 1, head + 2, C.ink);
        px(c, x - 3, head + 1, look.hair);
        px(c, x + 2, head + 1, look.hair);
    }

    // Hats.
    const hat = look.hatColor;

    switch (look.hat) {
        case "wizard":
            rect(c, x - 5, head - 1, 10, 1, shade(hat, -0.3));
            rect(c, x - 3, head - 2, 6, 1, C.gold);
            rect(c, x - 3, head - 3, 6, 1, hat);
            rect(c, x - 2, head - 4, 5, 1, hat);
            rect(c, x - 2, head - 5, 4, 1, hat);
            rect(c, x - 1, head - 6, 3, 1, hat);
            rect(c, x, head - 7, 2, 1, hat);
            px(c, x + 2 * (dir > 0 ? 1 : -1) + (dir > 0 ? 0 : 1), head - 8, hat);
            px(c, x, head - 4, C.gold);
            break;
        case "cap":
            rect(c, x - 3, head - 2, 6, 2, hat);
            rect(c, dir > 0 ? x + 1 : x - 5, head - 1, 4, 1, shade(hat, -0.35));
            px(c, x - 1, head - 2, shade(hat, 0.3));
            break;
        case "helm":
            rect(c, x - 3, head - 3, 6, 3, C.silver);
            rect(c, x - 4, head - 1, 8, 1, C.steel);
            px(c, x, head - 4, hat);
            px(c, x - 2, head - 2, C.white);
            break;
        case "feather":
            rect(c, x - 4, head - 2, 8, 2, hat);
            rect(c, x - 3, head - 3, 6, 1, hat);
            px(c, x + 2, head - 4, C.white);
            px(c, x + 3, head - 5, C.white);
            px(c, x + 3, head - 6, C.red);
            break;
        case "crown":
            rect(c, x - 3, head - 2, 6, 1, C.gold);
            px(c, x - 3, head - 3, C.gold);
            px(c, x, head - 3, C.gold);
            px(c, x + 2, head - 3, C.gold);
            px(c, x - 1, head - 2, C.red);
            break;
        default:
            break;
    }

    // What is in their hand.
    if (o.work) {
        const hx = x + 3 + (dir > 0 ? 1 : -1);
        const hy = top + 2 + lift;

        switch (o.work) {
            case "hammer":
                rect(c, hx, hy - 3, 1, 4, C.brown);
                rect(c, hx - 1, hy - 4, 3, 2, C.silver);
                break;
            case "book":
                rect(c, x - 2, top + 1, 5, 3, C.white);
                rect(c, x - 2, top + 4, 5, 1, C.blue);
                px(c, x, top + 1, C.silver);
                break;
            case "quill":
                rect(c, x - 2, top + 2, 5, 3, C.white);
                px(c, hx, hy - 3, C.white);
                px(c, hx, hy - 2, C.white);
                px(c, hx, hy - 1, C.ink);
                break;
            case "staff":
                rect(c, hx, top - 6, 1, 11, C.brown);
                px(c, hx, top - 7, Math.floor(t * 8) % 2 ? C.cyan : C.white);
                break;
            case "scope":
                rect(c, hx - 2, head + 1, 4, 2, C.gold);
                px(c, hx + 2, head + 1, C.cyan);
                break;
            case "wrench":
                rect(c, hx, hy - 3, 1, 4, C.steel);
                rect(c, hx - 1, hy - 4, 3, 1, C.silver);
                break;
            case "brush":
                rect(c, hx, hy - 3, 1, 4, C.brown);
                px(c, hx, hy - 4, [C.red, C.sky, C.gold, C.lime][Math.floor(t * 3) % 4]);
                break;
            case "scroll":
                rect(c, x - 2, top + 1, 5, 4, C.sand);
                rect(c, x - 2, top + 1, 5, 1, C.gold);
                break;
            default:
                if (Math.floor(t * 6) % 2) {
                    px(c, hx, hy - 4, C.white);
                }

                break;
        }
    }
}

// ——— the land ———

export function drawTree(c, x, y, kind, seed) {
    c.fillStyle = "rgba(16,14,40,0.25)";
    c.fillRect(x - 6, y - 1, 13, 3);

    if (kind === "pine") {
        rect(c, x - 1, y - 4, 2, 4, C.dark);

        for (let row = 0; row < 14; row++) {
            const half = Math.floor((row % 5) * 1.2 + row / 3) + 1;
            const color = row % 5 === 0 ? C.leaf2 : row % 5 === 4 ? shade(C.leaf, -0.25) : C.leaf;

            rect(c, x - half, y - 18 + row, half * 2, 1, color);
        }

        px(c, x - 1, y - 16, C.leaf3);

        return;
    }

    rect(c, x - 1, y - 5, 3, 5, C.dark);
    px(c, x, y - 5, C.brown);
    disc(c, x, y - 11, 6, shade(C.leaf, -0.2));
    disc(c, x - 1, y - 12, 5, C.leaf);
    disc(c, x - 2, y - 13, 3, C.leaf2);
    px(c, x - 3, y - 14, C.leaf3);
    px(c, x - 2, y - 15, C.leaf3);

    if (seed % 4 === 0) {
        px(c, x + 2, y - 10, C.red);
        px(c, x - 3, y - 9, C.red);
    }
}

export function drawBush(c, x, y, seed) {
    disc(c, x, y - 2, 3, shade(C.leaf2, -0.15));
    disc(c, x - 1, y - 3, 2, C.leaf2);
    px(c, x - 1, y - 4, C.leaf3);

    if (seed % 3 === 0) {
        px(c, x + 1, y - 3, [C.pink, C.gold, C.white][seed % 3]);
    }
}

export function drawRock(c, x, y) {
    rect(c, x - 3, y - 3, 6, 3, C.stone2);
    rect(c, x - 2, y - 4, 4, 1, C.stone);
    px(c, x - 2, y - 3, C.stone);
    rect(c, x - 3, y - 1, 6, 1, C.steel);
}

export function drawTent(c, x, y, color, open) {
    c.fillStyle = "rgba(16,14,40,0.28)";
    c.fillRect(x - 7, y - 1, 15, 2);

    for (let row = 0; row < 11; row++) {
        const half = Math.round(1 + (row * 6.5) / 10);

        rect(c, x - half, y - 11 + row, half * 2, 1, row % 3 === 2 ? shade(color, -0.2) : color);
        px(c, x - half, y - 11 + row, shade(color, -0.4));
        px(c, x + half - 1, y - 11 + row, shade(color, -0.4));
    }

    for (let row = 4; row < 11; row++) {
        const half = Math.floor((row - 4) / 2);

        rect(c, x - half - 1, y - 11 + row, half * 2 + 2, 1, open ? C.gold : C.ink);
    }

    px(c, x, y - 12, C.brown);
    px(c, x - 1, y - 12, C.brown);
}

export function drawCampfire(c, x, y, t) {
    rect(c, x - 3, y - 1, 6, 1, C.dark);
    rect(c, x - 2, y - 2, 4, 1, C.brown);
    const flick = Math.floor(t * 10) % 3;

    rect(c, x - 1, y - 4 - (flick === 1 ? 1 : 0), 2, 2, C.orange);
    px(c, x, y - 5 - flick, C.gold);
    px(c, x - 1, y - 3, C.gold);
}

export function drawLantern(c, x, y, lit) {
    rect(c, x, y - 12, 1, 12, C.slate);
    rect(c, x - 1, y - 15, 3, 3, lit ? C.gold : C.steel);
    rect(c, x - 1, y - 16, 3, 1, C.slate);
    px(c, x, y - 14, lit ? C.white : C.silver);
}

export function drawChicken(c, x, y, t, dir, seed) {
    const peck = Math.floor(t * 2 + seed) % 5 === 0;

    rect(c, x - 2, y - 4, 4, 3, C.white);
    rect(c, dir > 0 ? x + 1 : x - 3, y - (peck ? 3 : 6), 2, 2, C.white);
    px(c, dir > 0 ? x + 3 : x - 4, y - (peck ? 2 : 5), C.orange);
    px(c, dir > 0 ? x + 2 : x - 3, y - (peck ? 4 : 7), C.red);
    px(c, x - 1, y - 1, C.orange);
    px(c, x + 1, y - 1, C.orange);
}

export function drawPigeon(c, x, y, t, color) {
    const up = Math.floor(t * 12) % 2 === 0;

    rect(c, x - 2, y - 2, 5, 3, C.white);
    px(c, x + 3, y - 2, C.white);
    px(c, x + 4, y - 2, C.orange);
    px(c, x + 3, y - 3, C.ink);

    if (up) {
        rect(c, x - 2, y - 5, 2, 3, C.silver);
        rect(c, x + 1, y - 5, 2, 3, C.silver);
    } else {
        rect(c, x - 3, y, 2, 2, C.silver);
        rect(c, x + 2, y, 2, 2, C.silver);
    }

    rect(c, x - 1, y + 1, 3, 2, color);
    px(c, x, y + 1, C.white);
}

// ——— buildings: (c, x, y, s) with (x, y) the middle of the base, s the building's state ———

function roof(c, cx, base, half, height, color) {
    const dark = shade(color, -0.3);
    const light = shade(color, 0.25);

    for (let row = 0; row < height; row++) {
        const w = Math.round(2 + ((half - 2) * row) / Math.max(1, height - 1));
        const fill = row === height - 1 ? dark : row % 3 === 2 ? shade(color, -0.12) : color;

        rect(c, cx - w, base - height + row, w * 2, 1, fill);
        px(c, cx - w, base - height + row, dark);
        px(c, cx + w - 1, base - height + row, dark);

        if (row < height - 2 && row % 2 === 0) {
            px(c, cx - Math.floor(w / 2), base - height + row, light);
        }
    }
}

function slab(c, x, y, w, h, color) {
    rect(c, x, y, w, h, color);
    rect(c, x, y, w, 1, shade(color, 0.25));
    rect(c, x, y + h - 1, w, 1, shade(color, -0.35));

    for (let row = 2; row < h - 1; row += 2) {
        rect(c, x + 1, y + row, w - 2, 1, shade(color, -0.1));
    }
}

function bricks(c, x, y, w, h, color) {
    rect(c, x, y, w, h, color);

    const mortar = shade(color, -0.18);

    for (let row = 0; row < h; row += 3) {
        rect(c, x, y + row, w, 1, mortar);

        for (let column = (row / 3) % 2 ? 2 : 5; column < w; column += 6) {
            rect(c, x + column, y + row, 1, 3, mortar);
        }
    }

    rect(c, x, y + h - 1, w, 1, shade(color, -0.35));
}

function planks(c, x, y, w, h, color) {
    rect(c, x, y, w, h, color);

    for (let row = 2; row < h; row += 3) {
        rect(c, x, y + row, w, 1, shade(color, -0.12));
    }

    rect(c, x, y + h - 1, w, 1, shade(color, -0.35));
}

function windowAt(c, x, y, lit, w = 4, h = 4) {
    rect(c, x - 1, y - 1, w + 2, h + 2, C.dark);
    rect(c, x, y, w, h, lit ? C.gold : C.navy);
    px(c, x, y, lit ? C.white : C.sky);
    rect(c, x + Math.floor(w / 2), y, 1, h, lit ? C.orange : C.dark);
}

function doorAt(c, x, y, open, w = 6, h = 9, color = C.brown) {
    rect(c, x - w / 2, y - h, w, h, C.dark);
    rect(c, x - w / 2 + 1, y - h + 1, w - 2, h - 1, open ? "#120c08" : color);

    if (!open) {
        px(c, x + w / 2 - 2, y - Math.floor(h / 2), C.gold);
    }
}

function shadowUnder(c, x, y, w) {
    c.fillStyle = "rgba(16,14,40,0.25)";
    c.fillRect(x - w / 2 + 2, y - 1, w + 2, 3);
}

/** Each kind of building: its size, and how it draws. `lights` lists where it glows at night. */
export const BUILDINGS = {
    home: {
        w: 34,
        h: 32,
        draw(c, x, y, s) {
            shadowUnder(c, x, y, 34);
            planks(c, x - 17, y - 14, 34, 14, s.wall ?? C.tan);
            doorAt(c, x, y, s.open);
            windowAt(c, x - 12, y - 11, s.lit);
            windowAt(c, x + 8, y - 11, s.lit);
            rect(c, x + 7, y - 36, 4, 8, C.stone2);
            rect(c, x + 7, y - 36, 4, 1, C.stone);
            roof(c, x, y - 14, 20, 17, s.roof ?? C.red);
            rect(c, x - 3, y - 24, 6, 5, C.dark);
            rect(c, x - 2, y - 23, 4, 3, s.lit ? C.gold : C.navy);
            // A mailbox for the letters it gets.
            rect(c, x + 19, y - 6, 1, 6, C.dark);
            rect(c, x + 18, y - 9, 4, 3, s.mail ? C.red : C.steel);
        },
        lights: [
            [-10, -9, 10],
            [10, -9, 10],
        ],
        chimney: [9, -37],
    },
    library: {
        w: 50,
        h: 36,
        draw(c, x, y, s) {
            shadowUnder(c, x, y, 50);
            bricks(c, x - 25, y - 20, 50, 20, C.stone);
            rect(c, x - 27, y - 22, 54, 3, C.stone2);
            slab(c, x - 26, y - 33, 52, 11, C.navy);
            rect(c, x - 10, y - 37, 20, 4, C.navy);
            rect(c, x - 10, y - 37, 20, 1, C.blue);

            for (const dx of [-19, -12, 9, 16]) {
                rect(c, x + dx - 1, y - 18, 5, 12, C.dark);
                rect(c, x + dx, y - 17, 3, 11, s.lit ? C.gold : C.navy);
                px(c, x + dx, y - 17, s.lit ? C.white : C.sky);
            }

            rect(c, x - 6, y - 3, 12, 3, C.stone2);
            doorAt(c, x, y - 2, s.open, 8, 11, C.navy);
            drawIcon(c, "book", x - 4, y - 31);
        },
        lights: [
            [-17, -12, 12],
            [17, -12, 12],
        ],
    },
    temple: {
        w: 48,
        h: 44,
        draw(c, x, y, s) {
            shadowUnder(c, x, y, 48);
            rect(c, x - 24, y - 3, 48, 3, C.stone2);
            rect(c, x - 22, y - 5, 44, 2, C.stone);
            rect(c, x - 20, y - 22, 40, 17, C.slate);

            const flame = s.rgb ?? "#b48cff";
            const glow = 0.5 + 0.5 * Math.sin((s.t ?? 0) * 4);

            rect(c, x - 3, y - 9, 6, 4, C.stone2);
            rect(c, x - 1, y - 12 - Math.round(glow * 2), 2, 3 + Math.round(glow * 2), flame);
            px(c, x, y - 13, C.white);

            for (const dx of [-19, -9, 5, 15]) {
                rect(c, x + dx, y - 22, 4, 17, C.white);
                rect(c, x + dx + 3, y - 22, 1, 17, C.silver);
                rect(c, x + dx - 1, y - 23, 6, 1, C.silver);
            }

            rect(c, x - 24, y - 26, 48, 3, C.white);
            rect(c, x - 24, y - 24, 48, 1, C.silver);

            for (let row = 0; row < 8; row++) {
                const half = Math.round(24 - row * 3);

                rect(c, x - half, y - 27 - row, half * 2, 1, row === 0 ? C.silver : C.white);
                px(c, x - half, y - 27 - row, C.silver);
            }

            const orb = Math.round(1 + (s.pulse ?? 0) * 2);

            disc(c, x, y - 39, 4 + orb - 1, shade(flame, -0.3));
            disc(c, x, y - 39, 3 + orb - 1, flame);
            px(c, x - 1, y - 41, C.white);
            px(c, x - 2, y - 40, C.white);
        },
        lights: [
            [0, -39, 18],
            [0, -10, 10],
        ],
    },
    forge: {
        w: 44,
        h: 38,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            shadowUnder(c, x, y, 44);
            bricks(c, x - 22, y - 16, 44, 16, C.steel);
            slab(c, x - 24, y - 26, 48, 10, "#6b3a2a");
            rect(c, x + 10, y - 38, 6, 14, C.slate);
            rect(c, x + 9, y - 39, 8, 2, C.steel);
            rect(c, x - 19, y - 13, 18, 13, C.ink);

            const hot = s.busy ? 1 : 0.4;
            const colors = [C.red, C.orange, C.gold];

            for (let i = 0; i < 6; i++) {
                const h = Math.round((3 + ((t * 13 + i * 7) % 5)) * hot) + 1;

                rect(c, x - 17 + i * 3, y - h - 1, 2, h, colors[(i + Math.floor(t * 8)) % 3]);
            }

            // The anvil.
            rect(c, x + 6, y - 6, 9, 2, C.slate);
            rect(c, x + 8, y - 4, 5, 2, C.ink);
            rect(c, x + 7, y - 2, 7, 2, C.slate);
            rect(c, x + 2, y - 10, 4, 2, C.brown);
            drawIcon(c, "hammer", x + 2, y - 24);
        },
        lights: [[-10, -6, 16]],
        chimney: [13, -40],
    },
    observatory: {
        w: 30,
        h: 50,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            shadowUnder(c, x, y, 30);
            rect(c, x - 11, y - 30, 22, 30, C.stone);
            rect(c, x - 11, y - 30, 4, 30, C.white);
            rect(c, x + 7, y - 30, 4, 30, C.stone2);

            for (let row = 4; row < 30; row += 6) {
                rect(c, x - 11, y - row, 22, 1, C.stone2);
            }

            for (let dy = 0; dy <= 12; dy++) {
                const half = Math.round(Math.sqrt(144 - dy * dy));

                rect(c, x - half, y - 31 - dy, half * 2, 1, dy % 4 === 0 ? C.steel : C.silver);
            }

            rect(c, x - 1, y - 43, 3, 12, C.ink);

            const turn = Math.sin(t * (s.busy ? 1.4 : 0.25)) * 0.5;

            for (let i = 0; i < 9; i++) {
                rect(
                    c,
                    x + Math.round(Math.cos(-0.8 + turn) * i),
                    y - 38 + Math.round(Math.sin(-0.8 + turn) * i),
                    2,
                    2,
                    i > 6 ? C.gold : C.slate,
                );
            }

            windowAt(c, x - 3, y - 22, s.lit, 6, 5);
            doorAt(c, x, y, s.open, 6, 9, C.blue);
        },
        lights: [[0, -20, 12]],
    },
    harbor: {
        w: 64,
        h: 30,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            // Its bay.
            for (let dy = -10; dy <= 10; dy++) {
                const half = Math.round(30 * Math.sqrt(1 - (dy / 11) ** 2));

                rect(c, x - 4 - half, y - 6 + dy, half * 2, 1, dy < -8 ? C.sand : C.water);
            }

            for (let i = 0; i < 14; i++) {
                const wx = x - 30 + ((i * 37 + Math.floor(t * 6)) % 52);
                const wy = y - 13 + ((i * 11) % 17);

                rect(c, wx, wy, 3, 1, C.water2);

                if (i % 4 === 0) {
                    px(c, wx + 1, wy, C.cyan);
                }
            }

            // The dock.
            rect(c, x - 6, y - 12, 26, 5, C.brown);

            for (let dx = -6; dx < 20; dx += 3) {
                rect(c, x + dx, y - 12, 1, 5, C.dark);
            }

            rect(c, x - 6, y - 7, 1, 3, C.dark);
            rect(c, x + 18, y - 7, 1, 3, C.dark);

            // A boat that rocks, and sails out on a push.
            const out = s.sail ?? 0;
            const bx = x + 8 - Math.round(out * 40);
            const by = y - 1 + Math.round(Math.sin(t * 2.2));

            rect(c, bx - 7, by - 3, 14, 3, C.dark);
            rect(c, bx - 6, by, 12, 1, C.brown);
            rect(c, bx, by - 14, 1, 11, C.dark);

            for (let row = 0; row < 9; row++) {
                rect(
                    c,
                    bx + 1,
                    by - 14 + row,
                    Math.round(row * 0.8) + 1,
                    1,
                    row % 3 ? C.white : C.silver,
                );
            }

            px(c, bx, by - 15, C.red);

            // The harbor master's hut.
            planks(c, x - 30, y - 22, 16, 11, C.tan);
            roof(c, x - 22, y - 22, 10, 7, C.teal);
            doorAt(c, x - 22, y - 11, s.open, 4, 6);
            drawIcon(c, "anchor", x - 26, y - 38);
        },
        lights: [[-22, -16, 10]],
    },
    embassy: {
        w: 40,
        h: 46,
        draw(c, x, y, s) {
            const t = s.t ?? 0;
            const flag = s.flag ?? C.pink;

            shadowUnder(c, x, y, 40);
            rect(c, x - 18, y - 16, 36, 16, C.white);
            rect(c, x - 18, y - 1, 36, 1, C.silver);

            for (const dx of [-14, -6, 4, 12]) {
                rect(c, x + dx, y - 15, 2, 14, C.silver);
            }

            slab(c, x - 20, y - 23, 40, 7, C.blue);
            doorAt(c, x, y, s.open, 6, 9, C.navy);
            rect(c, x + 16, y - 44, 1, 21, C.slate);

            for (let row = 0; row < 6; row++) {
                const wave = Math.round(Math.sin(t * (s.busy ? 9 : 4) + row * 0.8));

                rect(
                    c,
                    x + 17,
                    y - 44 + row + wave * 0,
                    9 + wave,
                    1,
                    row === 0 ? shade(flag, 0.3) : flag,
                );
            }

            px(c, x + 16, y - 45, C.gold);
        },
        lights: [[0, -8, 12]],
    },
    workshop: {
        w: 40,
        h: 36,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            shadowUnder(c, x, y, 40);
            planks(c, x - 19, y - 16, 38, 16, C.brown);
            roof(c, x, y - 16, 22, 14, C.green);
            doorAt(c, x - 8, y, s.open, 8, 10, C.dark);
            windowAt(c, x + 8, y - 12, s.lit, 6, 4);

            const turn = t * (s.busy ? 4 : 0.6);

            disc(c, x, y - 22, 4, C.silver);

            for (let i = 0; i < 6; i++) {
                const angle = turn + (i * Math.PI) / 3;

                rect(
                    c,
                    x + Math.round(Math.cos(angle) * 5) - 1,
                    y - 22 + Math.round(Math.sin(angle) * 5) - 1,
                    2,
                    2,
                    C.silver,
                );
            }

            disc(c, x, y - 22, 1, C.steel);
        },
        lights: [[8, -10, 10]],
    },
    vault: {
        w: 32,
        h: 34,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            shadowUnder(c, x, y, 32);
            bricks(c, x - 15, y - 18, 30, 18, C.stone2);

            for (let dy = 0; dy <= 10; dy++) {
                const half = Math.round(Math.sqrt(100 - dy * dy) * 1.5);

                rect(c, x - half, y - 18 - dy, half * 2, 1, dy % 3 ? C.steel : C.slate);
            }

            rect(c, x - 5, y - 12, 10, 12, C.ink);
            disc(c, x, y - 12, 5, C.ink);

            const glow = 0.5 + 0.5 * Math.sin(t * (s.busy ? 6 : 1.5));
            const rune = glow > 0.5 ? "#b48cff" : "#7b3fa0";

            for (const [dx, dy] of [
                [-10, -14],
                [9, -14],
                [-10, -7],
                [9, -7],
            ]) {
                rect(c, x + dx, y + dy, 2, 3, rune);
            }

            drawIcon(c, "key", x - 4, y - 11);
        },
        lights: [[0, -8, 12]],
    },
    gallery: {
        w: 44,
        h: 32,
        draw(c, x, y, s) {
            shadowUnder(c, x, y, 44);
            rect(c, x - 21, y - 20, 42, 20, "#c96f9f");
            rect(c, x - 21, y - 1, 42, 1, C.plum);
            rect(c, x - 23, y - 24, 46, 4, C.plum);
            rect(c, x - 23, y - 25, 46, 1, C.pink);

            [
                [-18, C.sky, C.lime],
                [8, C.gold, C.red],
            ].forEach(([dx, a, b]) => {
                rect(c, x + dx - 1, y - 18, 12, 10, C.gold);
                rect(c, x + dx, y - 17, 10, 8, a);
                rect(c, x + dx, y - 12, 10, 3, b);
                px(c, x + dx + 7, y - 16, C.white);
            });

            doorAt(c, x, y, s.open, 6, 9, C.plum);
            drawIcon(c, "frame", x - 4, y - 33);
        },
        lights: [[0, -10, 12]],
    },
    clock: {
        w: 20,
        h: 62,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            shadowUnder(c, x, y, 20);
            bricks(c, x - 9, y - 44, 18, 44, "#c4a484");
            rect(c, x - 10, y - 46, 20, 3, C.stone2);

            for (let row = 0; row < 14; row++) {
                const half = Math.round(10 - row * 0.7);

                rect(c, x - half, y - 47 - row, half * 2, 1, row % 3 ? C.navy : C.blue);
            }

            px(c, x, y - 62, C.gold);
            disc(c, x, y - 34, 6, C.dark);
            disc(c, x, y - 34, 5, C.white);

            const now = new Date();
            const minute =
                ((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2 - Math.PI / 2;
            const hour =
                (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;

            for (let i = 1; i <= 4; i++) {
                px(
                    c,
                    x + Math.round(Math.cos(minute) * i),
                    y - 34 + Math.round(Math.sin(minute) * i),
                    C.ink,
                );
            }

            for (let i = 1; i <= 2; i++) {
                px(
                    c,
                    x + Math.round(Math.cos(hour) * i),
                    y - 34 + Math.round(Math.sin(hour) * i),
                    C.red,
                );
            }

            // The bell, swinging when it rings.
            const swing = s.pulse > 0.05 ? Math.round(Math.sin(t * 14) * 2) : 0;

            rect(c, x - 4, y - 24, 8, 6, C.ink);
            rect(c, x - 2 + swing, y - 23, 4, 4, C.gold);
            doorAt(c, x, y, s.open, 6, 9, C.dark);
        },
        lights: [[0, -34, 10]],
    },
    guild: {
        w: 50,
        h: 36,
        draw(c, x, y, s) {
            shadowUnder(c, x, y, 50);
            rect(c, x - 24, y - 18, 48, 18, C.sand);

            for (const dx of [-24, -12, 0, 11, 23]) {
                rect(c, x + dx, y - 18, 1, 18, C.dark);
            }

            rect(c, x - 24, y - 10, 48, 1, C.dark);
            roof(c, x, y - 18, 28, 16, C.red);
            doorAt(c, x, y, s.open, 8, 10, C.dark);
            windowAt(c, x - 18, y - 15, s.lit, 4, 3);
            windowAt(c, x + 14, y - 15, s.lit, 4, 3);

            for (const [dx, color] of [
                [-7, C.blue],
                [5, C.gold],
            ]) {
                rect(c, x + dx, y - 9, 3, 6, color);
                px(c, x + dx + 1, y - 3, color);
            }

            drawIcon(c, "shield", x - 4, y - 30);
        },
        lights: [
            [-16, -13, 10],
            [16, -13, 10],
        ],
    },
    castle: {
        w: 132,
        h: 62,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            shadowUnder(c, x, y, 132);
            bricks(c, x - 52, y - 30, 104, 30, C.stone2);

            for (let dx = -52; dx < 52; dx += 6) {
                rect(c, x + dx, y - 34, 4, 4, C.stone2);
                rect(c, x + dx, y - 34, 4, 1, C.stone);
            }

            for (const side of [-1, 1]) {
                const tx = x + side * 56;

                bricks(c, tx - 10, y - 46, 20, 46, C.stone);

                for (let row = 0; row < 14; row++) {
                    const half = Math.round(1 + row * 0.85);

                    rect(
                        c,
                        tx - half,
                        y - 60 + row,
                        half * 2,
                        1,
                        row % 3 ? C.red : shade(C.red, -0.2),
                    );
                }

                rect(c, tx, y - 70, 1, 10, C.ink);

                for (let row = 0; row < 4; row++) {
                    rect(c, tx + 1, y - 70 + row, 6 + Math.round(Math.sin(t * 5 + row)), 1, C.gold);
                }

                windowAt(c, tx - 2, y - 36, s.lit, 4, 5);
            }

            rect(c, x - 10, y - 18, 20, 18, C.ink);
            disc(c, x, y - 18, 10, C.ink);

            for (let dx = -8; dx <= 8; dx += 4) {
                rect(c, x + dx, y - 26, 1, 26, C.steel);
            }

            rect(c, x - 9, y - 12, 18, 1, C.steel);
            rect(c, x - 26, y - 22, 6, 10, C.red);
            rect(c, x + 20, y - 22, 6, 10, C.red);
            drawIcon(c, "crown", x - 27, y - 21);
            drawIcon(c, "crown", x + 19, y - 21);
        },
        lights: [
            [-56, -34, 12],
            [56, -34, 12],
            [0, -10, 16],
        ],
    },
    fountain: {
        w: 24,
        h: 20,
        draw(c, x, y, s) {
            const t = s.t ?? 0;

            for (let dy = -6; dy <= 6; dy++) {
                const half = Math.round(12 * Math.sqrt(1 - (dy / 7) ** 2));

                rect(c, x - half, y - 6 + dy, half * 2, 1, Math.abs(dy) >= 5 ? C.stone2 : C.water);
            }

            for (let dy = -4; dy <= 4; dy++) {
                const half = Math.round(10 * Math.sqrt(1 - (dy / 5) ** 2));

                px(c, x - half, y - 6 + dy, C.stone);
                px(c, x + half - 1, y - 6 + dy, C.stone2);
            }

            for (let i = 0; i < 6; i++) {
                const wx = x - 8 + ((i * 5 + Math.floor(t * 5)) % 16);

                px(c, wx, y - 8 + (i % 4) * 2, C.water2);
            }

            rect(c, x - 1, y - 14, 3, 8, C.stone);
            rect(c, x - 3, y - 15, 7, 2, C.stone2);

            for (let i = 0; i < 8; i++) {
                const phase = (t * 1.4 + i / 8) % 1;
                const side = i % 2 ? 1 : -1;
                const dx = Math.round(side * phase * 7);
                const dy = Math.round(-4 * Math.sin(phase * Math.PI) * 2 + phase * 8);

                px(c, x + dx, y - 16 + dy, phase < 0.5 ? C.white : C.cyan);
            }
        },
        lights: [],
    },
};

/** Which building each kind of place gets. */
export const KIND_OF = {
    model: "temple",
    files: "library",
    shell: "forge",
    github: "harbor",
    web: "observatory",
    codemode: "workshop",
    memory: "vault",
    artifact: "gallery",
    schedule: "clock",
    mcp: "embassy",
    ext: "guild",
};

/** What a citizen holds while they work in each place. */
export const TOOL_OF = {
    files: "book",
    shell: "hammer",
    github: "hammer",
    web: "scope",
    codemode: "wrench",
    memory: "book",
    artifact: "brush",
    schedule: "scroll",
    mcp: "scroll",
    ext: "wrench",
    model: "staff",
};
