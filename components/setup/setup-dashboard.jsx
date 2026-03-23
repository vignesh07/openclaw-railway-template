"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const COMMANDS = [
  {
    template: "openclaw status",
    label: "Status",
    description: "Current wrapper and gateway state",
  },
  {
    template: "openclaw health",
    label: "Health",
    description: "Quick health probe",
  },
  {
    template: "openclaw logs --tail 200",
    label: "Logs",
    description: "Fetch recent gateway logs",
  },
  {
    template: "openclaw config get gateway.port",
    label: "Config",
    description: "Read a single config path",
  },
  {
    template: "openclaw devices list",
    label: "Devices",
    description: "Inspect pending device requests",
  },
  {
    template: "gateway.restart",
    label: "Restart",
    description: "Restart the managed gateway process",
  },
];

const INITIAL_TERMINAL_TEXT = blockLines("Wrapper link established.", "Waiting for the first status snapshot...").join("\n");

function trimTerminalText(text) {
  return String(text || "").slice(-160_000);
}

function appendTerminalBlock(current, title, body) {
  const nextBlock = blockLines(title, body).join("\n");
  return trimTerminalText(current ? `${current}\n${nextBlock}` : nextBlock);
}

function timestamp() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function blockLines(title, body) {
  const lines = [`[${timestamp()}] ${title}`];
  const bodyLines = String(body || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line, index, array) => line || index !== array.length - 1);

  if (bodyLines.length) {
    bodyLines.forEach((line) => {
      lines.push(line ? `           ${line}` : "");
    });
  }

  return lines;
}

function historyToLines(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return blockLines("Wrapper link established.", "Waiting for the first status snapshot...");
  }

  return events.flatMap((event) => {
    const stamp = event?.createdAt
      ? new Date(event.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      : timestamp();
    const lines = [`[${stamp}] ${event?.title || "Event"}`];
    const bodyLines = String(event?.body || "")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line, index, array) => line || index !== array.length - 1);

    bodyLines.forEach((line) => {
      lines.push(line ? `           ${line}` : "");
    });

    return lines;
  });
}

async function readJson(url, options) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    let details = text || response.statusText;

    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) {
          details = parsed.error;
        }
      } catch {}
    }

    throw new Error(`HTTP ${response.status}: ${details || response.statusText}`);
  }

  return response.json();
}

function MetricRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/70 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm text-foreground", mono && "font-mono text-xs sm:text-sm")}>{value}</span>
    </div>
  );
}

export function SetupDashboard() {
  const [status, setStatus] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [snapshotError, setSnapshotError] = useState("");
  const [historyText, setHistoryText] = useState(INITIAL_TERMINAL_TEXT);
  const [terminalText, setTerminalText] = useState(INITIAL_TERMINAL_TEXT);
  const [commandLine, setCommandLine] = useState(COMMANDS[0].template);
  const [stdinValue, setStdinValue] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [terminalCursor, setTerminalCursor] = useState(0);
  const [busyAction, setBusyAction] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const hasLoggedInitialSnapshot = useRef(false);
  const terminalViewportRef = useRef(null);
  const terminalCursorRef = useRef(0);
  const sessionRequestInFlightRef = useRef(false);

  const appendTerminal = useCallback((title, body) => {
    setTerminalText((current) => appendTerminalBlock(current, title, body));
  }, []);

  const loadSnapshot = useCallback(
    async ({ announce = false } = {}) => {
      setBusyAction((current) => current || "refresh");
      setSnapshotError("");

      try {
        const [statusResponse, debugResponse, terminalResponse] = await Promise.all([
          readJson("/setup/api/status"),
          readJson("/setup/api/debug"),
          readJson("/setup/api/terminal"),
        ]);

        const nextHistoryText = historyToLines(terminalResponse.events).join("\n");
        setStatus(statusResponse);
        setDebugInfo(debugResponse);
        setHistoryText(nextHistoryText);
        setTerminalText((current) => (activeSessionId ? current : nextHistoryText));
        setLastUpdated(new Date());

        if ((announce || !hasLoggedInitialSnapshot.current) && !activeSessionId) {
          setTerminalText((current) =>
            appendTerminalBlock(
              current,
              "Status snapshot loaded.",
              [
                `configured: ${statusResponse.configured ? "yes" : "no"}`,
                `gateway target: ${statusResponse.gatewayTarget || "unknown"}`,
                `version: ${statusResponse.openclawVersion || "unknown"}`,
              ].join("\n"),
            ),
          );
          hasLoggedInitialSnapshot.current = true;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSnapshotError(message);
        appendTerminal("Snapshot request failed.", message);
      } finally {
        setBusyAction("");
      }
    },
    [activeSessionId, appendTerminal],
  );

  useEffect(() => {
    void loadSnapshot({ announce: true });
  }, [loadSnapshot]);

  useEffect(() => {
    if (!activeSessionId || activeSession?.status !== "running") {
      return undefined;
    }

    let cancelled = false;

    const pollSession = async () => {
      if (sessionRequestInFlightRef.current) {
        return;
      }

      sessionRequestInFlightRef.current = true;

      try {
        const response = await readJson(`/setup/api/terminal/session/${activeSessionId}?cursor=${terminalCursorRef.current}`);
        if (cancelled) {
          return;
        }

        setActiveSession(response.session);
        terminalCursorRef.current = response.nextCursor || terminalCursorRef.current;
        setTerminalCursor(terminalCursorRef.current);
        if (response.output) {
          setTerminalText((current) => trimTerminalText(`${current}${response.output}`));
        }

        if (response.session.status !== "running") {
          setBusyAction("");
          setStdinValue("");
          void loadSnapshot();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        appendTerminal("Terminal session lost.", message);
        setBusyAction("");
        setActiveSession((current) => (current ? { ...current, status: "failed", canAcceptInput: false } : current));
      } finally {
        sessionRequestInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void pollSession();
    }, 900);

    void pollSession();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeSessionId, activeSession?.status, appendTerminal, loadSnapshot]);

  useEffect(() => {
    const viewport = terminalViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [terminalText]);

  const providerLabels = useMemo(
    () => (status?.authGroups || []).slice(0, 4).map((group) => group.label),
    [status],
  );

  const setupBadge = status?.configured ? "success" : snapshotError ? "danger" : "warning";
  const gatewayRunning = Boolean(debugInfo?.wrapper?.gatewayRunning);
  const gatewayBadge = gatewayRunning ? "success" : "warning";
  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(lastUpdated)
    : "Pending";
  const terminalReadyForInput = Boolean(activeSession?.canAcceptInput);
  const sessionBadge = activeSession?.status === "running"
    ? "success"
    : activeSession?.status === "failed"
      ? "danger"
      : "secondary";

  async function handleCommandSubmit(event) {
    event.preventDefault();
    if (!commandLine.trim()) {
      appendTerminal("Terminal command missing.", "Type a setup-safe `openclaw ...` command or `gateway.*` first.");
      return;
    }

    setBusyAction("command");

    try {
      const response = await readJson("/setup/api/terminal/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          commandLine: commandLine.trim(),
        }),
      });

      setActiveSessionId(response.session.id);
      setActiveSession(response.session);
      terminalCursorRef.current = response.nextCursor || 0;
      setTerminalCursor(terminalCursorRef.current);
      setTerminalText(response.output || `$ ${commandLine.trim()}\n`);
      setStdinValue("");

      if (response.session.status !== "running") {
        setBusyAction("");
        await loadSnapshot();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTerminal("Command failed.", message);
      setBusyAction("");
    }
  }

  async function handleTerminalInputSubmit(event) {
    event.preventDefault();
    if (!activeSessionId || !terminalReadyForInput) {
      return;
    }
    if (sessionRequestInFlightRef.current) {
      return;
    }

    setBusyAction("input");
    sessionRequestInFlightRef.current = true;

    try {
      const response = await readJson(`/setup/api/terminal/session/${activeSessionId}/input`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          input: stdinValue,
          cursor: terminalCursorRef.current,
        }),
      });

      if (response.output) {
        setTerminalText((current) => trimTerminalText(`${current}${response.output}`));
      }
      terminalCursorRef.current = response.nextCursor || terminalCursorRef.current;
      setTerminalCursor(terminalCursorRef.current);
      setActiveSession(response.session);
      setStdinValue("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTerminal("Input failed.", message);
    } finally {
      sessionRequestInFlightRef.current = false;
      setBusyAction("");
    }
  }

  async function handleInputEof() {
    if (!activeSessionId || !terminalReadyForInput) {
      return;
    }
    if (sessionRequestInFlightRef.current) {
      return;
    }

    setBusyAction("input");
    sessionRequestInFlightRef.current = true;

    try {
      const response = await readJson(`/setup/api/terminal/session/${activeSessionId}/input`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          endInput: true,
          cursor: terminalCursorRef.current,
        }),
      });

      if (response.output) {
        setTerminalText((current) => trimTerminalText(`${current}${response.output}`));
      }
      terminalCursorRef.current = response.nextCursor || terminalCursorRef.current;
      setTerminalCursor(terminalCursorRef.current);
      setActiveSession(response.session);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTerminal("EOF failed.", message);
    } finally {
      sessionRequestInFlightRef.current = false;
      setBusyAction("");
    }
  }

  async function handleTerminateSession() {
    if (!activeSessionId || activeSession?.status !== "running") {
      return;
    }

    setBusyAction("terminate");

    try {
      await readJson(`/setup/api/terminal/session/${activeSessionId}/terminate`, {
        method: "POST",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTerminal("Stop failed.", message);
      setBusyAction("");
    }
  }

  async function handleReset() {
    const confirmed = window.confirm("Reset setup and delete the current config file?");
    if (!confirmed) {
      return;
    }

    setBusyAction("reset");
    appendTerminal("POST /setup/api/reset", "Requesting a clean setup state...");

    try {
      const response = await fetch("/setup/api/reset", {
        method: "POST",
        credentials: "same-origin",
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }

      appendTerminal("Reset completed.", text);
      await loadSnapshot({ announce: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTerminal("Reset failed.", message);
      setBusyAction("");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-border/80 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <Badge variant="outline" className="w-fit text-[10px] text-muted-foreground">
            Internal setup surface
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              OpenClaw setup control surface
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              The page stays intentionally small: one terminal pane, one compact command runner, and a few wrapper
              status cards. Express still owns Basic auth and every existing <code className="font-mono text-xs text-foreground">/setup/api/*</code> endpoint.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={setupBadge}>{status?.configured ? "Configured" : snapshotError ? "Unavailable" : "Pending"}</Badge>
          <Badge variant={gatewayBadge}>{gatewayRunning ? "Gateway running" : "Gateway idle"}</Badge>
          <Badge variant="secondary">Updated {lastUpdatedLabel}</Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_22rem]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Wrapper status</CardTitle>
                <CardDescription>Live values from <code className="font-mono text-xs text-foreground">/setup/api/status</code> and <code className="font-mono text-xs text-foreground">/setup/api/debug</code>.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow label="OpenClaw" value={status?.openclawVersion || "Loading"} mono />
                <MetricRow label="Gateway target" value={status?.gatewayTarget || "Pending"} mono />
                <MetricRow label="State dir" value={debugInfo?.wrapper?.stateDir || "Pending"} mono />
                <MetricRow label="Workspace dir" value={debugInfo?.wrapper?.workspaceDir || "Pending"} mono />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>App info</CardTitle>
                <CardDescription>Compact runtime context for the Railway wrapper and setup surface.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {providerLabels.length ? (
                    providerLabels.map((label) => (
                      <Badge key={label} variant="secondary" className="normal-case tracking-[0.08em]">
                        {label}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary" className="normal-case tracking-[0.08em]">
                      Loading providers
                    </Badge>
                  )}
                </div>
                <MetricRow label="Provider groups" value={String(status?.authGroups?.length || 0)} />
                <MetricRow label="Gateway process" value={gatewayRunning ? "Managed and running" : "Managed but idle"} />
                <MetricRow label="SQLite" value={debugInfo?.wrapper?.setupDbPath || status?.setupDbPath || "Pending"} mono />
                <MetricRow label="Railway commit" value={debugInfo?.wrapper?.railwayCommit || "Unavailable"} mono />
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden bg-panel/80">
            <CardHeader className="border-b border-border/80 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Activity terminal</CardTitle>
                  <CardDescription>Live OpenClaw output, session prompts, and wrapper snapshots for the authenticated setup console.</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeSession ? <Badge variant={sessionBadge}>{activeSession.status}</Badge> : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadSnapshot({ announce: true })}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === "refresh" ? "Refreshing..." : activeSessionId ? "Refresh status" : "Refresh snapshot"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={terminalViewportRef} className="border-t border-border/40 bg-terminal px-5 py-4">
                <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                  <span className="ml-2">setup terminal</span>
                  {activeSession?.commandLine ? <span className="truncate normal-case tracking-normal">{activeSession.commandLine}</span> : null}
                </div>
                <pre className="min-h-[var(--terminal-height-mobile)] overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-foreground sm:min-h-[var(--terminal-height)]">
                  {terminalText || historyText}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Interactive command runner</CardTitle>
              <CardDescription>Starts a live session through <code className="font-mono text-xs text-foreground">/setup/api/terminal/session</code>. You can run custom <code className="font-mono text-xs text-foreground">openclaw ...</code> commands here, while wrapper-owned onboarding, gateway control, and config writes stay blocked.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={handleCommandSubmit}>
                <Input
                  value={commandLine}
                  onChange={(event) => setCommandLine(event.target.value)}
                  placeholder="openclaw status"
                  spellCheck="false"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-muted-foreground">Use a preset to seed the prompt, then edit it like a normal terminal command.</p>
                  <Button type="submit" disabled={Boolean(busyAction) || activeSession?.status === "running"}>
                    {busyAction === "command" ? "Running..." : "Run"}
                  </Button>
                </div>
              </form>

              <div className="grid gap-2 sm:grid-cols-2">
                {COMMANDS.map((command) => (
                  <button
                    key={command.template}
                    type="button"
                    className="rounded-md border border-border/80 bg-panel px-3 py-2 text-left transition hover:border-accent hover:bg-panel/80"
                    onClick={() => setCommandLine(command.template)}
                  >
                    <span className="block text-sm font-medium text-foreground">{command.label}</span>
                    <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{command.template}</span>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">{command.description}</span>
                  </button>
                ))}
              </div>

              <form className="space-y-3 border-t border-border/70 pt-4" onSubmit={handleTerminalInputSubmit}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {terminalReadyForInput
                      ? "Send stdin to the active command. Use EOF when a prompt expects the stream to close."
                      : activeSessionId
                        ? "The latest command is no longer accepting input. Start a new session to run another command."
                        : "Start a command first, then send stdin here if that command prompts for more input."}
                  </p>
                  {activeSession?.status === "running" ? <Badge variant="outline">stdin open</Badge> : null}
                </div>
                <Input
                  value={stdinValue}
                  onChange={(event) => setStdinValue(event.target.value)}
                  placeholder="Type response for the running command"
                  spellCheck="false"
                  disabled={!terminalReadyForInput || busyAction === "terminate"}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={!terminalReadyForInput || Boolean(busyAction && busyAction !== "input")}>
                    {busyAction === "input" ? "Sending..." : "Send input"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void handleInputEof()} disabled={!terminalReadyForInput || Boolean(busyAction && busyAction !== "input")}>
                    Send EOF
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => void handleTerminateSession()} disabled={activeSession?.status !== "running" || busyAction === "input"}>
                    {busyAction === "terminate" ? "Stopping..." : "Stop command"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Actions</CardTitle>
              <CardDescription>Keep recovery and operator shortcuts within the same setup surface.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <a className={buttonVariants({ className: "w-full" })} href="/openclaw" target="_blank" rel="noreferrer">
                Open UI
              </a>
              <a
                className={buttonVariants({ variant: "secondary", className: "w-full" })}
                href="/setup/export"
                target="_blank"
                rel="noreferrer"
              >
                Export backup
              </a>
              <Button variant="destructive" className="w-full sm:col-span-2 xl:col-span-1" onClick={handleReset} disabled={Boolean(busyAction)}>
                {busyAction === "reset" ? "Resetting..." : "Reset setup"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
