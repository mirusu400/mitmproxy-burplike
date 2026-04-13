import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppThunk } from "../store";
import type { Flow } from "../../flow";
import { fetchApi } from "../../utils";
import { Tab, setCurrent } from "./tabs";

type RepeaterState = {
    items: string[];
    selectedId: string | null;
};

const initialState: RepeaterState = {
    items: [],
    selectedId: null,
};

const repeaterSlice = createSlice({
    name: "ui/repeater",
    initialState,
    reducers: {
        addEntry(state, action: PayloadAction<string>) {
            const id = action.payload;
            if (!state.items.includes(id)) {
                state.items.push(id);
            }
            state.selectedId = id;
        },
        removeEntry(state, action: PayloadAction<string>) {
            const id = action.payload;
            state.items = state.items.filter((entry) => entry !== id);
            if (state.selectedId === id) {
                state.selectedId = state.items[0] ?? null;
            }
        },
        selectEntry(state, action: PayloadAction<string | null>) {
            state.selectedId = action.payload;
        },
        clearEntries(state) {
            state.items = [];
            state.selectedId = null;
        },
    },
});

const { actions, reducer } = repeaterSlice;
export const { addEntry, removeEntry, selectEntry, clearEntries } = actions;

export function sendToRepeater(flow: Flow): AppThunk {
    return async (dispatch) => {
        if (flow.type !== "http" && flow.type !== "tcp") {
            alert("Repeater는 HTTP/TCP 요청만 지원합니다.");
            return;
        }
        try {
            const resp = await fetchApi(`/flows/${flow.id}/duplicate`, {
                method: "POST",
            });
            if (!resp.ok) {
                throw new Error(`${resp.status} ${resp.statusText}`.trim());
            }
            const newId = (await resp.text()).trim();
            if (!newId) {
                throw new Error("Failed to duplicate flow for repeater.");
            }
            dispatch(addEntry(newId));
        } catch (err) {
            console.error(err);
            alert(err);
        }
    };
}

export default reducer;
