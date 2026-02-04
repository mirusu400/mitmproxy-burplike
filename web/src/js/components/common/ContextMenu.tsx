import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

type ContextMenuItem = {
    label: string;
    onClick: () => Promise<void> | void;
    disabled?: boolean;
};

type ContextMenuProps = {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
};

export default function ContextMenu({
    x,
    y,
    items,
    onClose,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLUListElement | null>(null);
    const [pos, setPos] = useState({ x, y });

    useEffect(() => {
        console.log("[ContextMenu] mount", { x, y, items: items.length });
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (menuRef.current && target && menuRef.current.contains(target)) {
                return; // click inside menu - let item handler run
            }
            onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("click", onClick, { capture: true });
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("click", onClick, { capture: true });
            console.log("[ContextMenu] unmount");
        };
    }, [onClose]);

    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;
        const rect = menu.getBoundingClientRect();
        let nextX = x;
        let nextY = y;
        if (rect.right > window.innerWidth) {
            nextX = Math.max(0, window.innerWidth - rect.width - 8);
        }
        if (rect.bottom > window.innerHeight) {
            nextY = Math.max(0, window.innerHeight - rect.height - 8);
        }
        if (nextX !== x || nextY !== y) {
            console.log("[ContextMenu] adjust position", { nextX, nextY });
            setPos({ x: nextX, y: nextY });
        }
    }, [x, y]);

    return ReactDOM.createPortal(
        <ul
            className="dropdown-menu show context-menu"
            ref={menuRef}
            style={{ top: pos.y, left: pos.x }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item) => (
                <li key={item.label}>
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            if (!item.disabled) {
                                console.log("[ContextMenu] click", item.label);
                                Promise.resolve(item.onClick()).catch((err) => {
                                    console.error("[ContextMenu] error", err);
                                    alert(err);
                                });
                                onClose();
                            }
                        }}
                        className={item.disabled ? "disabled" : undefined}
                    >
                        {item.label}
                    </a>
                </li>
            ))}
        </ul>,
        document.body,
    );
}
