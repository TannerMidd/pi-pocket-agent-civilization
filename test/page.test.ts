import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error: the browser module is plain JavaScript, without types.
import { mergeInto } from "../agent-civilization/index.js";

const store = () => ({
    convs: Object.create(null),
    res: Object.create(null),
    humans: Object.create(null),
    events: [] as { id: number }[],
    maxId: 0,
    unknown: new Map(),
});

test("late events and new ones merge once each, in order, and none is lost", () => {
    const page = store();

    mergeInto(page, { events: [{ id: 1 }, { id: 3 }, { id: 4 }] });
    // A session shown just now: its event 2 comes late, beside new events, and one it already has.
    const fresh = mergeInto(page, { late: [{ id: 2 }, { id: 3 }], events: [{ id: 5 }, { id: 6 }] });

    assert.deepEqual(
        page.events.map((event: { id: number }) => event.id),
        [1, 2, 3, 4, 5, 6],
    );
    assert.deepEqual(
        fresh.map((event: { id: number }) => event.id),
        [2, 5, 6],
    );
    assert.equal(page.maxId, 6);
});

test("late events that come before every new one keep the new ones", () => {
    const page = store();

    const fresh = mergeInto(page, { late: [{ id: 2 }], events: [{ id: 1 }, { id: 3 }] });

    assert.deepEqual(
        fresh.map((event: { id: number }) => event.id),
        [1, 2, 3],
    );
});

test("a name from the server never reaches a prototype", () => {
    const page = store();

    mergeInto(page, JSON.parse('{"humans":{"__proto__":{"name":"x","count":1,"last":1}}}'));
    assert.equal(({} as Record<string, unknown>).count, undefined);
});
