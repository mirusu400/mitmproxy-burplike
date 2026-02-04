import React, { useCallback, useState } from "react";
import classnames from "classnames";
import type { Flow } from "../../flow";
import { useAppDispatch, useAppSelector } from "../../ducks";
import { select, selectRange, selectToggle } from "../../ducks/flows";
import * as columns from "./FlowColumns";
import ContextMenu from "../common/ContextMenu";
import { copy } from "../../flow/export";
import { sendToRepeater } from "../../ducks/ui/repeater";

type FlowRowProps = {
    flow: Flow;
    selected: boolean;
    highlighted: boolean;
};

export default React.memo(function FlowRow({
    flow,
    selected,
    highlighted,
}: FlowRowProps) {
    const dispatch = useAppDispatch();
    const displayColumnNames = useAppSelector(
        (state) => state.options.web_columns,
    );
    const className = classnames({
        selected,
        highlighted,
        intercepted: flow.intercepted,
        "has-request": flow.type === "http" && flow.request,
        "has-response": flow.type === "http" && flow.response,
    });

    const onClick = useCallback(
        (e: React.MouseEvent<HTMLTableRowElement>) => {
            // a bit of a hack to disable row selection for quickactions.
            let node = e.target as HTMLElement;
            while (node.parentNode) {
                if (node.classList.contains("col-quickactions")) return;
                node = node.parentNode as HTMLElement;
            }
            if (e.metaKey || e.ctrlKey) {
                dispatch(selectToggle(flow));
            } else if (e.shiftKey) {
                window.getSelection()?.empty();
                dispatch(selectRange(flow));
            } else {
                dispatch(select([flow]));
            }
        },
        [flow],
    );

    const [menuPos, setMenuPos] = useState<{ x: number; y: number }>();
    const isHttp = flow.type === "http";
    const menuItems = [
        {
            label: "Copy raw request",
            onClick: () => copy(flow, "raw_request"),
            disabled: !isHttp,
        },
        {
            label: "Copy as Python requests",
            onClick: () => copy(flow, "python_requests"),
            disabled: !isHttp,
        },
        {
            label: "Send to Repeater",
            onClick: () => {
                console.log("[FlowRow] send to repeater", flow.id);
                return dispatch(sendToRepeater(flow));
            },
            disabled: !isHttp,
        },
    ];

    const displayColumns = displayColumnNames
        .map((x) => columns[x])
        .filter((x) => x)
        .concat(columns.quickactions);

    return (
        <>
            <tr
                className={className}
                onClick={onClick}
                onContextMenu={(e) => {
                    e.preventDefault();
                    console.log("[FlowRow] contextmenu", {
                        x: e.clientX,
                        y: e.clientY,
                        flow: flow.id,
                    });
                    setMenuPos({ x: e.clientX, y: e.clientY });
                    dispatch(select([flow]));
                }}
            >
                {displayColumns.map((Column) => (
                    <Column key={Column.name} flow={flow} />
                ))}
            </tr>
            {menuPos && (
                <ContextMenu
                    x={menuPos.x}
                    y={menuPos.y}
                    items={menuItems}
                    onClose={() => {
                        console.log("[FlowRow] contextmenu close", flow.id);
                        setMenuPos(undefined);
                    }}
                />
            )}
        </>
    );
});
