import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { useAppDispatch, useAppSelector } from "../ducks";
import type { HTTPFlow, TCPFlow } from "../flow";
import { MessageUtils, RequestUtils } from "../flow/utils";
import Button from "./common/Button";
import CodeEditor from "./contentviews/CodeEditor";
import { removeEntry, selectEntry } from "../ducks/ui/repeater";
import { replay } from "../ducks/flows";
import { runCommand, fetchApi } from "../utils";
import { useContent } from "./contentviews/useContent";

// --- Hex utilities (binary-safe serialization for TCP payloads) ---

function base64ToHex(b64: string): string {
    const raw = atob(b64);
    return Array.from(raw)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
}

function hexToBase64(hex: string): string {
    const clean = hex.replace(/\s/g, "");
    if (clean.length % 2 !== 0) throw new Error("Odd-length hex string");
    if (clean.length > 0 && !/^[0-9a-fA-F]+$/.test(clean)) {
        throw new Error("Non-hex characters in input");
    }
    let binary = "";
    for (let i = 0; i < clean.length; i += 2) {
        binary += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    }
    return btoa(binary);
}

// --- HTTP raw request hook (unchanged) ---

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

// --- HTTP panel ---

function HttpRepeaterPanel({ flow }: { flow: HTTPFlow }) {
    const dispatch = useAppDispatch();
    const { raw, error } = useRawRequest(flow);
    const [edited, setEdited] = useState<string | undefined>(undefined);
    useEffect(() => {
        setEdited(undefined);
    }, [flow.id]);

    const respUrl = flow.response
        ? MessageUtils.getContentURL(flow, flow.response)
        : undefined;
    const respHash = flow.response?.contentHash;
    const respContent = useContent(respUrl, respHash);
    const respText = respContent ?? "No response yet.";

    const parseRawRequest = (rawText: string, fallback: HTTPFlow): any => {
        const [head, ...bodyParts] = rawText.split(/\r?\n\r?\n/);
        const body = bodyParts.join("\r\n\r\n");
        const lines = head.split(/\r?\n/).filter((l) => l.trim().length);
        const [
            method = fallback.request.method,
            target = fallback.request.path,
            httpVersion = fallback.request.http_version,
        ] = (lines.shift() || "").split(/\s+/, 3);

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
        let port =
            fallback.request.port || (scheme === "https" ? 443 : 80);
        let path = target;

        const hostHeader = headers.find(
            ([k]) => k.toLowerCase() === "host",
        )?.[1];

        if (/^https?:\/\//i.test(target)) {
            try {
                const url = new URL(target);
                scheme = url.protocol.replace(":", "") || scheme;
                host = url.hostname || hostHeader || host;
                port = url.port
                    ? parseInt(url.port, 10)
                    : url.protocol === "https:"
                      ? 443
                      : 80;
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
        try {
            if (edited !== undefined) {
                const parsed = parseRawRequest(edited, flow);
                await fetchApi.put(`/flows/${flow.id}`, {
                    request: parsed,
                });
            }
            await dispatch(replay([flow]) as any);
        } catch (err) {
            console.error(err);
            alert(err);
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (
                (e.ctrlKey && e.code === "Space") ||
                (e.ctrlKey && e.metaKey && e.code === "Space")
            ) {
                e.preventDefault();
                send();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [flow, edited]);

    return (
        <section className="repeater-detail">
            <div className="repeater-toolbar">
                <h4>Raw Request</h4>
                <Button
                    className="btn-xs"
                    icon="fa-repeat text-primary"
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
                    {flow.response && (
                        <span className="status">
                            {flow.response.status_code}{" "}
                            {flow.response.reason}
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
    );
}

// --- TCP panel ---

function TcpRepeaterPanel({ flow }: { flow: TCPFlow }) {
    const initialHex = useMemo(
        () => (flow.client_payload_b64 ? base64ToHex(flow.client_payload_b64) : ""),
        // Re-derive when the flow's stored payload changes (e.g., after a PUT).
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [flow.id, flow.client_payload_b64],
    );
    const [edited, setEdited] = useState<string | undefined>(undefined);
    const [response, setResponse] = useState<string>("No response yet.");

    useEffect(() => {
        setEdited(undefined);
        setResponse("No response yet.");
    }, [flow.id]);

    const send = async () => {
        const hexPayload = edited ?? initialHex;
        let b64: string;
        try {
            b64 = hexToBase64(hexPayload);
        } catch (e) {
            alert(`Invalid hex payload: ${e}`);
            return;
        }
        try {
            await fetchApi.put(`/flows/${flow.id}`, { tcp_payload: b64 });
            const resp = await fetchApi(`/flows/${flow.id}/tcp_replay`, {
                method: "POST",
            });
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`TCP replay failed (${resp.status}): ${text}`);
            }
            const data = await resp.json();
            setResponse(
                data.response_b64
                    ? base64ToHex(data.response_b64)
                    : "(empty response)",
            );
        } catch (err) {
            console.error(err);
            alert(err);
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (
                (e.ctrlKey && e.code === "Space") ||
                (e.ctrlKey && e.metaKey && e.code === "Space")
            ) {
                e.preventDefault();
                send();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [flow, edited]);

    return (
        <section className="repeater-detail">
            <div className="repeater-toolbar">
                <h4>TCP Payload (hex)</h4>
                <Button
                    className="btn-xs"
                    icon="fa-repeat text-primary"
                    onClick={send}
                >
                    Send
                </Button>
            </div>
            <CodeEditor
                initialContent={edited ?? initialHex}
                onChange={setEdited}
            />
            <div className="repeater-response">
                <div className="repeater-toolbar">
                    <h4>Response (hex)</h4>
                </div>
                <CodeEditor
                    initialContent={response}
                    onChange={() => 0}
                    readonly={true}
                />
            </div>
        </section>
    );
}

// --- Main RepeaterView ---

export default function RepeaterView() {
    const dispatch = useAppDispatch();
    const items = useAppSelector((state) => state.ui.repeater.items);
    const selectedId = useAppSelector((state) => state.ui.repeater.selectedId);
    const flowsById = useAppSelector((state) => state.flows.byId);

    const selectedFlow = useMemo(() => {
        if (!selectedId) return undefined;
        return flowsById.get(selectedId);
    }, [flowsById, selectedId]);

    const selectedHttpFlow = selectedFlow?.type === "http" ? selectedFlow : undefined;
    const selectedTcpFlow = selectedFlow?.type === "tcp" ? selectedFlow : undefined;

    return (
        <div className="repeater-view">
            <aside className="repeater-list">
                <header>Repeater</header>
                <ul>
                    {items.map((id) => {
                        const flow = flowsById.get(id);
                        let label: string;
                        if (flow?.type === "http") {
                            label = `${flow.request.method} ${RequestUtils.pretty_url(flow.request)}`;
                        } else if (flow?.type === "tcp") {
                            const addr = flow.server_conn?.address;
                            label = `TCP ${addr ? addr[0] + ":" + addr[1] : id.slice(0, 8)}`;
                        } else {
                            label = "Loading...";
                        }
                        return (
                            <li
                                key={id}
                                className={classnames({
                                    active: id === selectedId,
                                })}
                            >
                                <button
                                    onClick={() => dispatch(selectEntry(id))}
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
            {selectedHttpFlow ? (
                <HttpRepeaterPanel flow={selectedHttpFlow} />
            ) : selectedTcpFlow ? (
                <TcpRepeaterPanel flow={selectedTcpFlow} />
            ) : (
                <section className="repeater-detail repeater-empty">
                    <p>Select an entry to edit and replay.</p>
                </section>
            )}
        </div>
    );
}
