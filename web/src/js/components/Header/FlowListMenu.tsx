import * as React from "react";
import FilterInput, { FilterIcon } from "./FilterInput";
import * as flowsActions from "../../ducks/flows";
import Button from "../common/Button";
import { update as updateOptions } from "../../ducks/options";
import { useAppDispatch, useAppSelector } from "../../ducks";
import {
    FilterName,
    setFilter,
    setHighlight,
    setHostname,
} from "../../ducks/ui/filter";
import Filt from "../../filt/filt";

FlowListMenu.title = "Flow List";

export default function FlowListMenu() {
    return (
        <div className="main-menu">
            <div className="menu-group">
                <div className="menu-content">
                    <FlowFilterInput />
                    <HostnameFilterInput />
                    <HighlightInput />
                </div>
                <div className="menu-legend">Find</div>
            </div>

            <div className="menu-group">
                <div className="menu-content">
                    <InterceptInput />
                    <ResumeAll />
                </div>
                <div className="menu-legend">Intercept</div>
            </div>
        </div>
    );
}

function InterceptInput() {
    const dispatch = useAppDispatch();
    const value = useAppSelector((state) => state.options.intercept);
    return (
        <FilterInput
            value={value || ""}
            placeholder="Intercept"
            icon={FilterIcon.INTERCEPT}
            color="hsl(208, 56%, 53%)"
            onChange={(val) => dispatch(updateOptions("intercept", val))}
        />
    );
}

function FlowFilterInput() {
    const dispatch = useAppDispatch();
    const value = useAppSelector((state) => state.ui.filter[FilterName.Search]);
    return (
        <FilterInput
            value={value}
            placeholder="Search"
            icon={FilterIcon.SEARCH}
            color="black"
            onChange={(expr) => dispatch(setFilter(expr))}
        />
    );
}

function HostnameFilterInput() {
    const dispatch = useAppDispatch();
    const expr = useAppSelector(
        (state) => state.ui.filter[FilterName.Hostname],
    );
    const storedValue = expr.startsWith("~d ") ? expr.slice(3) : expr;
    const [value, setValue] = React.useState(storedValue);
    React.useEffect(() => {
        setValue(storedValue);
    }, [storedValue]);

    const isValid = (input: string) => {
        if (!input) return true;
        try {
            Filt.parse(`~d ${input}`);
            return true;
        } catch {
            return false;
        }
    };
    return (
        <div
            className={`filter-input input-group${
                isValid(value) ? "" : " has-error"
            }`}
        >
            <span className="input-group-addon">
                <i className="fa fa-fw fa-globe" style={{ color: "black" }} />
            </span>
            <input
                type="text"
                placeholder="Scope (hostname)"
                className="form-control"
                value={value}
                onChange={(e) => {
                    const next = e.target.value;
                    setValue(next);
                    if (isValid(next)) {
                        const expr = next ? `~d ${next}` : "";
                        dispatch(setHostname(expr));
                    }
                }}
            />
        </div>
    );
}

function HighlightInput() {
    const dispatch = useAppDispatch();
    const value = useAppSelector(
        (state) => state.ui.filter[FilterName.Highlight],
    );
    return (
        <FilterInput
            value={value}
            placeholder="Highlight"
            icon={FilterIcon.HIGHLIGHT}
            color="hsl(48, 100%, 50%)"
            onChange={(expr) => dispatch(setHighlight(expr))}
        />
    );
}

export function ResumeAll() {
    const dispatch = useAppDispatch();
    return (
        <Button
            className="btn-sm"
            title="[a]ccept all"
            icon="fa-forward text-success"
            onClick={() => dispatch(flowsActions.resumeAll())}
        >
            Resume All
        </Button>
    );
}
