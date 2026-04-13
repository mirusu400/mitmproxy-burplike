import type { TCPFlow } from "../../flow";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import Messages from "./Messages";
import CodeEditor from "../contentviews/CodeEditor";
import Button from "../common/Button";
import { fetchApi, formatTimeStamp } from "../../utils";

// ---------------------------------------------------------------------------
// Encoding types and byte-conversion helpers
// ---------------------------------------------------------------------------

type Encoding = "hex" | "ascii" | "utf-8" | "euc-kr";

const ENCODING_LABELS: Record<Encoding, string> = {
    "hex": "Hex",
    "ascii": "ASCII",
    "utf-8": "UTF-8",
    "euc-kr": "EUC-KR",
};

function base64ToBytes(b64: string): Uint8Array {
    const raw = atob(b64);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/\s/g, "");
    if (clean.length % 2 !== 0) throw new Error("Odd-length hex string");
    if (clean.length > 0 && !/^[0-9a-fA-F]+$/.test(clean))
        throw new Error("Non-hex characters in input");
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2)
        bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
    return bytes;
}

/**
 * bytes → display string (for history rendering).
 * Falls back to hex for non-decodable bytes.
 */
function bytesToDisplay(bytes: Uint8Array, enc: Encoding): string {
    if (enc === "hex") return bytesToHex(bytes);
    if (enc === "ascii") {
        // Latin-1: every byte 0-255 has a 1:1 Unicode mapping — never fails
        return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    }
    try {
        return new TextDecoder(enc, { fatal: true }).decode(bytes);
    } catch {
        return bytesToHex(bytes); // fallback for history only
    }
}

/**
 * bytes → display string for an encoding switch.
 * Throws instead of falling back so the caller can show an error and
 * abort the switch.
 */
function bytesToDisplayStrict(bytes: Uint8Array, enc: Encoding): string {
    if (enc === "hex") return bytesToHex(bytes);
    if (enc === "ascii") {
        return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    }
    // Throws DOMException on invalid sequence
    return new TextDecoder(enc, { fatal: true }).decode(bytes);
}

/**
 * editor content → raw bytes as base64.
 * Hex and UTF-8 are handled client-side.
 * ASCII (Latin-1) is handled client-side (1 char = 1 byte, 0-255).
 * EUC-KR goes through the backend because TextEncoder only supports UTF-8.
 */
async function displayToBase64(content: string, enc: Encoding): Promise<string> {
    if (enc === "hex") {
        return bytesToBase64(hexToBytes(content));
    }
    if (enc === "utf-8") {
        return bytesToBase64(new TextEncoder().encode(content));
    }
    if (enc === "ascii") {
        const bytes = new Uint8Array(content.length);
        for (let i = 0; i < content.length; i++) {
            const code = content.charCodeAt(i);
            if (code > 255)
                throw new Error(`Character '${content[i]}' is outside Latin-1 range`);
            bytes[i] = code;
        }
        return bytesToBase64(bytes);
    }
    // EUC-KR: ask the backend
    const resp = await fetchApi("/charset_encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, charset: enc }),
    });
    if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`Encoding failed (${resp.status}): ${msg}`);
    }
    const { bytes_b64 } = await resp.json();
    return bytes_b64 as string;
}

// ---------------------------------------------------------------------------
// Types for sent-message history
// ---------------------------------------------------------------------------

type SentEntry = {
    bytesB64: string;    // raw bytes, encoding-agnostic
    fromClient: boolean;
    timestamp: number;
};

// ---------------------------------------------------------------------------
// Send panel
// ---------------------------------------------------------------------------

type TcpSendPanelProps = {
    flow: TCPFlow;
    encoding: Encoding;
    onEncodingChange: (enc: Encoding) => void;
    onEntry: (entry: SentEntry) => void;
};

function TcpSendPanel({ flow, encoding, onEncodingChange, onEntry }: TcpSendPanelProps) {
    const initialBytes = flow.client_payload_b64
        ? base64ToBytes(flow.client_payload_b64)
        : new Uint8Array(0);

    const [content, setContent] = useState<string>(() =>
        bytesToDisplay(initialBytes, encoding),
    );
    const [editorKey, setEditorKey] = useState(0);
    const [sending, setSending] = useState(false);

    // Reset when flow changes
    useEffect(() => {
        setContent(bytesToDisplay(initialBytes, encoding));
        setEditorKey((k) => k + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flow.id]);

    /**
     * Convert current editor content to the new encoding.
     * Uses the strict decoder so that if the bytes can't be represented
     * in the target encoding, we show an error and leave everything unchanged.
     */
    const handleEncodingChange = async (newEnc: Encoding) => {
        if (newEnc === encoding) return;
        try {
            const b64 = await displayToBase64(content, encoding);
            const bytes = base64ToBytes(b64);
            const newContent = bytesToDisplayStrict(bytes, newEnc);
            setContent(newContent);
            setEditorKey((k) => k + 1);
            onEncodingChange(newEnc);
        } catch (e) {
            alert(
                `현재 내용을 ${ENCODING_LABELS[newEnc]}으로 변환할 수 없습니다.\n` +
                `(${e})\n\n` +
                `내용을 수동으로 수정하거나 다른 인코딩을 선택하세요.`,
            );
            // Encoding selector will snap back because the state hasn't changed
        }
    };

    const address = flow.server_conn?.address;

    const send = async () => {
        if (!address) {
            alert("No server address on this flow.");
            return;
        }
        let payloadB64: string;
        try {
            payloadB64 = await displayToBase64(content, encoding);
        } catch (e) {
            alert(`Invalid payload: ${e}`);
            return;
        }
        setSending(true);
        const sentAt = Date.now() / 1000;
        try {
            const resp = await fetchApi(`/flows/${flow.id}/tcp_inject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload_b64: payloadB64 }),
            });
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Send failed (${resp.status}): ${text}`);
            }
            const data = await resp.json();
            // Always record the sent packet
            onEntry({ bytesB64: payloadB64, fromClient: true, timestamp: sentAt });
            if (data.mode === "new_connection" && data.response_b64 != null) {
                // Dead flow: response comes back synchronously, show it in history
                onEntry({
                    bytesB64: data.response_b64,
                    fromClient: false,
                    timestamp: Date.now() / 1000,
                });
            }
            // Live flow (mode === "injected"): response arrives through the proxy
            // and will appear automatically in the Messages section above
        } catch (err) {
            console.error(err);
            alert(err);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="tcp-send-panel">
            <div className="tcp-send-toolbar">
                <span className="tcp-send-label">
                    Send to{" "}
                    <code>
                        {address ? `${address[0]}:${address[1]}` : "unknown"}
                    </code>
                </span>
                <select
                    className="tcp-send-encoding-select"
                    value={encoding}
                    onChange={(e) =>
                        handleEncodingChange(e.target.value as Encoding)
                    }
                >
                    {(Object.keys(ENCODING_LABELS) as Encoding[]).map((enc) => (
                        <option key={enc} value={enc}>
                            {ENCODING_LABELS[enc]}
                        </option>
                    ))}
                </select>
                <Button
                    className="btn-xs"
                    icon={
                        sending
                            ? "fa-spinner fa-spin"
                            : "fa-paper-plane text-primary"
                    }
                    disabled={sending || !address}
                    onClick={send}
                >
                    Send
                </Button>
            </div>
            <CodeEditor
                key={editorKey}
                initialContent={content}
                onChange={setContent}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

export default function TcpMessages({ flow }: { flow: TCPFlow }) {
    const [encoding, setEncoding] = useState<Encoding>("hex");
    const [sentHistory, setSentHistory] = useState<SentEntry[]>([]);

    useEffect(() => {
        setSentHistory([]);
        setEncoding("hex");
    }, [flow.id]);

    // Keep only the most recent exchange (last sent + its response).
    // A fromClient entry starts a fresh exchange; a server entry appends to it.
    const addEntry = useCallback((entry: SentEntry) => {
        if (entry.fromClient) {
            setSentHistory([entry]);
        } else {
            setSentHistory((prev) => [...prev, entry]);
        }
    }, []);

    return (
        <section className="tcp">
            <Messages flow={flow} messages_meta={flow.messages_meta} />
            {sentHistory.length > 0 && (
                <div className="contentview tcp-sent-history">
                    {sentHistory.map((entry, i) => {
                        const bytes = base64ToBytes(entry.bytesB64);
                        const display =
                            bytes.length === 0
                                ? "(empty)"
                                : bytesToHex(bytes);
                        const arrowClass = `fa fa-fw fa-arrow-${
                            entry.fromClient
                                ? "right text-primary"
                                : "left text-danger"
                        }`;
                        return (
                            <div key={i}>
                                <small>
                                    <i className={arrowClass} />
                                    <span className="pull-right">
                                        {formatTimeStamp(entry.timestamp)}
                                    </span>
                                </small>
                                <pre>{display}</pre>
                            </div>
                        );
                    })}
                </div>
            )}
            <TcpSendPanel
                flow={flow}
                encoding={encoding}
                onEncodingChange={setEncoding}
                onEntry={addEntry}
            />
        </section>
    );
}
TcpMessages.displayName = "Stream Data";
