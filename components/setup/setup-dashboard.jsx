"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const COMMANDS = [
  {
    value: "openclaw.status",
    label: "openclaw status",
    description: "Current wrapper and gateway state",
    placeholder: "Optional arg",
  },
  {
    value: "openclaw.health",
    label: "openclaw health",
    description: "Quick health probe",
    placeholder: "Optional arg",
  },
  {
    value: "openclaw.logs.tail",
    label: "openclaw logs --tail",
    description: "Fetch recent gateway logs",
    placeholder: "200",
  },
  {
    value: "openclaw.config.get",
    label: "openclaw config get",
    description: "Read a single config path",
    placeholder: "gateway.port",
  },
  {
    value: "openclaw.devices.list",
    label: "openclaw devices list",
    description: "Inspect pending device requests",
    placeholder: "Optional arg",
  },
  {
    value: "gateway.restart",
    label: "gateway.restart",
    description: "Restart the managed gateway process",
    placeholder: "Optional arg",
  },
];

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
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
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
  const [terminalLines, setTerminalLines] = useState(() => blockLines("Wrapper link established.", "Waiting for the first status snapshot..."));
  const [selectedCommand, setSelectedCommand] = useState(COMMANDS[0].value);
  const [commandArg, setCommandArg] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const hasLoggedInitialSnapshot = useRef(false);

  const appendTerminal = useCallback((title, body) => {
    setTerminalLines((current) => [...current, ...blockLines(title, body)].slice(-320));
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

        setStatus(statusResponse);
        setDebugInfo(debugResponse);
        setTerminalLines(historyToLines(terminalResponse.events));
        setLastUpdated(new Date());

        if (announce || !hasLoggedInitialSnapshot.current) {
          appendTerminal(
            "Status snapshot loaded.",
            [
              `configured: ${statusResponse.configured ? "yes" : "no"}`,
              `gateway target: ${statusResponse.gatewayTarget || "unknown"}`,
              `version: ${statusResponse.openclawVersion || "unknown"}`,
            ].join("\n"),
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
    [appendTerminal],
  );

  useEffect(() => {
    void loadSnapshot({ announce: true });
  }, [loadSnapshot]);

  const commandMeta = useMemo(
    () => COMMANDS.find((command) => command.value === selectedCommand) || COMMANDS[0],
    [selectedCommand],
  );

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

  async function handleCommandSubmit(event) {
    event.preventDefault();
    setBusyAction("command");
    appendTerminal(`$ ${selectedCommand}${commandArg ? ` ${commandArg}` : ""}`, commandMeta.description);

    try {
      const response = await readJson("/setup/api/console/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cmd: selectedCommand,
          arg: commandArg.trim(),
        }),
      });

      appendTerminal("Command completed.", response.output || JSON.stringify(response, null, 2));
      await loadSnapshot();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendTerminal("Command failed.", message);
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
        <Card className="overflow-hidden bg-panel/80">
          <CardHeader className="border-b border-border/80 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Activity terminal</CardTitle>
                <CardDescription>Command output, setup snapshots, and wrapper responses from the existing setup APIs.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadSnapshot({ announce: true })}
                disabled={Boolean(busyAction)}
              >
                {busyAction === "refresh" ? "Refreshing..." : "Refresh snapshot"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t border-border/40 bg-terminal px-5 py-4">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
                <span className="ml-2">wrapper terminal</span>
              </div>
              <pre className="min-h-[var(--terminal-height-mobile)] overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-foreground sm:min-h-[var(--terminal-height)]">
                {terminalLines.join("\n")}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Command runner</CardTitle>
              <CardDescription>Uses the wrapper allowlist behind <code className="font-mono text-xs text-foreground">/setup/api/console/run</code>.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleCommandSubmit}>
                <Select value={selectedCommand} onChange={(event) => setSelectedCommand(event.target.value)}>
                  {COMMANDS.map((command) => (
                    <option key={command.value} value={command.value}>
                      {command.label}
                    </option>
                  ))}
                </Select>
                <Input
                  value={commandArg}
                  onChange={(event) => setCommandArg(event.target.value)}
                  placeholder={commandMeta.placeholder}
                  spellCheck="false"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-muted-foreground">{commandMeta.description}</p>
                  <Button type="submit" disabled={Boolean(busyAction)}>
                    {busyAction === "command" ? "Running..." : "Run"}
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
