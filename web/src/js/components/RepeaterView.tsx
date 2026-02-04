import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { useAppDispatch, useAppSelector } from "../ducks";
import type { HTTPFlow } from "../flow";
import { MessageUtils, RequestUtils } from "../flow/utils";
import Button from "./common/Button";
import CodeEditor from "./contentviews/CodeEditor";
import { removeEntry, selectEntry } from "../ducks/ui/repeater";
import { replay } from "../ducks/flows";
import { runCommand, fetchApi } from "../utils";
import { useContent } from "./contentviews/useContent";

function useRawRequest(flow: HTTPFlow | undefined) {
    const [raw, setRaw] = useState<string>("Loading...");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!flow) {
            setRaw("No flow selected.");
            setError(null);
            return;
        }
        setRaw("Loading...");
        setError(null);
        runCommand("export", "raw_request", `@${flow.id}`)
            .then((ret) => {
                if (cancelled) return;
                if (ret.value) {
                    setRaw(ret.value);
                } else if (ret.error) {
                    setError(String(ret.error));
                } else {
                    setError("Failed to export raw request.");
                }
            })
            .catch((err) => {
                if (!cancelled) setError(String(err));
            });
        return () => {
            cancelled = true;
        };
    }, [flow?.id]);

    return { raw, error };
}

export default function RepeaterView() {
    const dispatch = useAppDispatch();
    const items = useAppSelector((state) => state.ui.repeater.items);
    const selectedId = useAppSelector((state) => state.ui.repeater.selectedId);
    const flowsById = useAppSelector((state) => state.flows.byId);

    const selectedFlow = useMemo(() => {
        if (!selectedId) return undefined;
        const flow = flowsById.get(selectedId);
        return flow?.type === "http" ? flow : undefined;
    }, [flowsById, selectedId]);

    const { raw, error } = useRawRequest(selectedFlow);
    const [edited, setEdited] = useState<string | undefined>(undefined);
    useEffect(() => {
        setEdited(undefined);
    }, [selectedFlow?.id]);

    const respUrl = selectedFlow?.response
        ? MessageUtils.getContentURL(selectedFlow, selectedFlow.response)
        : undefined;
    const respHash = selectedFlow?.response?.contentHash;
    const respContent = useContent(respUrl, respHash);
    const respText = respContent ?? "No response yet.";

    const parseRawRequest = (rawText: string, fallback: HTTPFlow): any => {
        const [head, ...bodyParts] = rawText.split(/\r?\n\r?\n/);
        const body = bodyParts.join("\r\n\r\n");
        const lines = head.split(/\r?\n/).filter((l) => l.trim().length);
        const [method = fallback.request.method, target = fallback.request.path, httpVersion = fallback.request.http_version] =
            (lines.shift() || "").split(/\s+/, 3);

        const headers: Array<[string, string]> = [];
        for (const line of lines) {
            const idx = line.indexOf(":");
            if (idx <= 0) continue;
            const name = line.slice(0, idx).trim();
            const value = line.slice(idx + 1).trim();
            headers.push([name, value]);
        }

        let scheme = fallback.request.scheme || "http";
        let host = fallback.request.host || "";
        let port = fallback.request.port || (scheme === "https" ? 443 : 80);
        let path = target;

        const hostHeader = headers.find(([k]) => k.toLowerCase() === "host")?.[1];

        if (/^https?:\/\//i.test(target)) {
            try {
                const url = new URL(target);
                scheme = url.protocol.replace(":", "") || scheme;
                host = url.hostname || hostHeader || host;
                port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
                path = (url.pathname || "/") + (url.search || "");
            } catch {
                /* fall back to defaults */
            }
        } else {
            if (hostHeader) {
                host = hostHeader.split(":")[0] || host;
                const hp = hostHeader.split(":")[1];
                if (hp) port = parseInt(hp, 10);
            }
        }

        return {
            method,
            scheme,
            host,
            port,
            path,
            http_version: httpVersion,
            headers,
            content: body,
        };
    };

    const send = async () => {
        if (!selectedFlow) return;
        try {
            if (edited !== undefined) {
                const parsed = parseRawRequest(edited, selectedFlow);
                await fetchApi.put(`/flows/${selectedFlow.id}`, {
                    request: parsed,
                });
            }
            await dispatch(replay([selectedFlow]) as any);
        } catch (err) {
            console.error(err);
            alert(err);
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Ctrl+Space (Win) or Ctrl+Meta+Space (Mac as requested)
            if ((e.ctrlKey && e.code === "Space") || (e.ctrlKey && e.metaKey && e.code === "Space")) {
                e.preventDefault();
                send();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedFlow, edited]);

    return (
        <div className="repeater-view">
            <aside className="repeater-list">
                <header>Repeater</header>
                <ul>
                    {items.map((id) => {
                        const flow = flowsById.get(id);
                        const label =
                            flow && flow.type === "http"
                                ? `${flow.request.method} ${RequestUtils.pretty_url(flow.request)}`
                                : "Loading...";
                        return (
                            <li
                                key={id}
                                className={classnames({
                                    active: id === selectedId,
                                })}
                            >
                                <button
                                    onClick={() =>
                                        dispatch(selectEntry(id))
                                    }
                                >
                                    {label}
                                </button>
                                <Button
                                    className="btn-xs"
                                    icon="fa-trash"
                                    onClick={() => dispatch(removeEntry(id))}
                                />
                            </li>
                        );
                    })}
                    {items.length === 0 && (
                        <li className="empty">No entries yet.</li>
                    )}
                </ul>
            </aside>
            <section className="repeater-detail">
                <div className="repeater-toolbar">
                    <h4>Raw Request</h4>
                    <Button
                        className="btn-xs"
                        icon="fa-repeat text-primary"
                        disabled={!selectedFlow}
                        onClick={send}
                    >
                        Send
                    </Button>
                </div>
                {error ? (
                    <div className="repeater-error">{error}</div>
                ) : (
                    <CodeEditor
                        initialContent={edited ?? raw}
                        onChange={setEdited}
                    />
                )}
                <div className="repeater-response">
                    <div className="repeater-toolbar">
                        <h4>Response</h4>
                        {selectedFlow?.response && (
                            <span className="status">
                                {selectedFlow.response.status_code}{" "}
                                {selectedFlow.response.reason}
                            </span>
                        )}
                    </div>
                    <CodeEditor
                        initialContent={respText}
                        onChange={() => 0}
                        readonly={true}
                    />
                </div>
            </section>
        </div>
    );
}
