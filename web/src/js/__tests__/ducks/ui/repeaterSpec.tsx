import repeaterReducer, {
    addEntry,
    removeEntry,
    selectEntry,
    clearEntries,
} from "../../../ducks/ui/repeater";

describe("repeater reducer", () => {
    it("should return initial state", () => {
        const state = repeaterReducer(undefined, { type: "other" });
        expect(state.items).toEqual([]);
        expect(state.selectedId).toBeNull();
    });

    it("should add an entry and select it", () => {
        const state = repeaterReducer(undefined, addEntry("abc"));
        expect(state.items).toContain("abc");
        expect(state.selectedId).toBe("abc");
    });

    it("should not add duplicate entries", () => {
        let state = repeaterReducer(undefined, addEntry("abc"));
        state = repeaterReducer(state, addEntry("abc"));
        expect(state.items.filter((id) => id === "abc")).toHaveLength(1);
    });

    it("should remove an entry and fall back selection", () => {
        let state = repeaterReducer(undefined, addEntry("a"));
        state = repeaterReducer(state, addEntry("b"));
        state = repeaterReducer(state, removeEntry("b"));
        expect(state.items).not.toContain("b");
        expect(state.selectedId).toBe("a");
    });

    it("should select null when all entries removed", () => {
        let state = repeaterReducer(undefined, addEntry("a"));
        state = repeaterReducer(state, removeEntry("a"));
        expect(state.selectedId).toBeNull();
    });

    it("should select entry", () => {
        let state = repeaterReducer(undefined, addEntry("a"));
        state = repeaterReducer(state, addEntry("b"));
        state = repeaterReducer(state, selectEntry("a"));
        expect(state.selectedId).toBe("a");
    });

    it("should clear all entries", () => {
        let state = repeaterReducer(undefined, addEntry("a"));
        state = repeaterReducer(state, addEntry("b"));
        state = repeaterReducer(state, clearEntries());
        expect(state.items).toHaveLength(0);
        expect(state.selectedId).toBeNull();
    });
});
