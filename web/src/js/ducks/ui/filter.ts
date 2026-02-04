import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

export enum FilterName {
    Search = "search",
    Highlight = "highlight",
    Hostname = "hostname",
}

export const initialState: Record<FilterName, string> = {
    [FilterName.Search]: "",
    [FilterName.Highlight]: "",
    [FilterName.Hostname]: "",
};

const filtersSlice = createSlice({
    name: "ui/filters",
    initialState,
    reducers: {
        setFilter(state, action: PayloadAction<string>) {
            state[FilterName.Search] = action.payload;
        },
        setHighlight(state, action: PayloadAction<string>) {
            state[FilterName.Highlight] = action.payload;
        },
        setHostname(state, action: PayloadAction<string>) {
            state[FilterName.Hostname] = action.payload;
        },
    },
});

const { actions, reducer } = filtersSlice;
export const { setFilter, setHighlight, setHostname } = actions;
export default reducer;
