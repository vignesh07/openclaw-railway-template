"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
      } catch {
        details = text || response.statusText;
      }
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
  const [configDraft, setConfigDraft] = useState("");
  const [configExists, setConfigExists] = useState(false);
  const [configPath, setConfigPath] = useState("");
  const [configFeedback, setConfigFeedback] = useState(null);
  const [snapshotError, setSnapshotError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadSnapshot = useCallback(async () => {
    setBusyAction((current) => current || "refresh");
    setSnapshotError("");

    try {
      const [statusResponse, debugResponse] = await Promise.all([
        readJson("/setup/api/status"),
        readJson("/setup/api/debug"),
      ]);

      setStatus(statusResponse);
      setDebugInfo(debugResponse);
      setLastUpdated(new Date());
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction("");
    }
  }, []);

  const loadConfig = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setBusyAction((current) => current || "config-load");
      setConfigFeedback(null);
    }

    try {
      const response = await readJson("/setup/api/config/raw");
      setConfigPath(response.path || "");
      setConfigExists(Boolean(response.exists));
      setConfigDraft(response.content || "");

      if (!quiet) {
        setConfigFeedback({
          tone: response.exists ? "success" : "warning",
          message: response.exists ? "Loaded the active config file." : "No config file exists yet. Saving here will create it.",
        });
      }
    } catch (error) {
      setConfigFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (!quiet) {
        setBusyAction((current) => (current === "config-load" ? "" : current));
      }
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
    void loadConfig({ quiet: true });
  }, [loadConfig, loadSnapshot]);

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

  async function handleReset() {
    const confirmed = window.confirm("Reset setup and delete the current config file?");
    if (!confirmed) {
      return;
    }

    setBusyAction("reset");

    try {
      const response = await fetch("/setup/api/reset", {
        method: "POST",
        credentials: "same-origin",
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }

      await Promise.all([loadSnapshot(), loadConfig({ quiet: true })]);
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : String(error));
      setBusyAction("");
    }
  }

  async function handleSaveConfig() {
    setBusyAction("config-save");
    setConfigFeedback(null);

    try {
      const response = await fetch("/setup/api/config/raw", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ content: configDraft }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      setConfigExists(true);
      setConfigPath(payload?.path || configPath);
      setConfigFeedback({
        tone: "success",
        message: "Config saved. The managed gateway will reload with the updated file.",
      });
      await Promise.all([loadSnapshot(), loadConfig({ quiet: true })]);
    } catch (error) {
      setConfigFeedback({
        tone: "danger",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
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
              The setup view now delegates shell access to a full VibeTunnel remote terminal instead of the older
              custom command runner. Express still owns Basic auth, setup actions, and wrapper status endpoints.
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
                  <CardTitle className="text-lg">Raw config editor</CardTitle>
                  <CardDescription>
                    Edit the active OpenClaw config file used by the wrapper. Saving writes a backup and applies the
                    updated file through <code className="font-mono text-xs text-foreground">/setup/api/config/raw</code>.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={configExists ? "success" : "warning"}>{configExists ? "Config file found" : "Config file missing"}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadConfig()}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === "config-load" ? "Reloading..." : "Reload from disk"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleSaveConfig()}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === "config-save" ? "Saving..." : "Save config"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {configFeedback ? (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm text-foreground",
                    configFeedback.tone === "danger" && "border-danger/60 bg-danger/10",
                    configFeedback.tone === "success" && "border-emerald-500/40 bg-emerald-500/10",
                    configFeedback.tone === "warning" && "border-amber-500/40 bg-amber-500/10",
                  )}
                >
                  {configFeedback.message}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="rounded-lg border border-border/80 bg-background/60 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Config path</div>
                  <div className="mt-2 break-all font-mono text-xs text-foreground">{configPath || "Loading..."}</div>
                </div>
                <div className="rounded-lg border border-border/80 bg-background/60 px-4 py-3 text-xs text-muted-foreground">
                  JSON5 is supported.
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/80 bg-background/70 shadow-panel">
                <textarea
                  value={configDraft}
                  onChange={(event) => setConfigDraft(event.target.value)}
                  spellCheck={false}
                  className="min-h-[22rem] w-full resize-y bg-transparent px-4 py-4 font-mono text-xs text-foreground outline-none"
                  placeholder={`{
  gateway: {
    bind: "loopback"
  }
}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-panel/80">
            <CardHeader className="border-b border-border/80 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Remote terminal</CardTitle>
                  <CardDescription>
                    VibeTunnel runs behind the wrapper and provides the full browser terminal session here without the old
                    setup-only terminal plumbing.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadSnapshot()}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === "refresh" ? "Refreshing..." : "Refresh status"}
                  </Button>
                  <a className={buttonVariants({ variant: "secondary", size: "sm" })} href="/vibetunnel" target="_blank" rel="noreferrer">
                    Open full screen
                  </a>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {snapshotError ? (
                <div className="rounded-lg border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-foreground">
                  {snapshotError}
                </div>
              ) : null}
              <div className="overflow-hidden rounded-xl border border-border/80 bg-background/70 shadow-panel">
                <iframe
                  title="VibeTunnel remote terminal"
                  src="/vibetunnel"
                  className="h-[34rem] w-full bg-black"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Actions</CardTitle>
              <CardDescription>Keep recovery and operator shortcuts within the same setup surface.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <a className={buttonVariants({ className: "w-full" })} href="/dashboard" target="_blank" rel="noreferrer">
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
