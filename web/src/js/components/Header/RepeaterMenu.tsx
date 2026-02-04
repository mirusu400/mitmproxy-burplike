import * as React from "react";
import Button from "../common/Button";
import { useAppDispatch, useAppSelector } from "../../ducks";
import { clearEntries } from "../../ducks/ui/repeater";

RepeaterMenu.title = "Repeater";

export default function RepeaterMenu() {
    const dispatch = useAppDispatch();
    const hasEntries = useAppSelector((state) => state.ui.repeater.items.length);

    return (
        <div className="main-menu">
            <div className="menu-group">
                <div className="menu-content">
                    <Button
                        className="btn-sm"
                        title="clear repeater entries"
                        icon="fa-trash text-danger"
                        disabled={!hasEntries}
                        onClick={() => dispatch(clearEntries())}
                    >
                        Clear
                    </Button>
                </div>
                <div className="menu-legend">Repeater</div>
            </div>
        </div>
    );
}
