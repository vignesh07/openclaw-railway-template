# ConnectOS Morning Briefing Skill

## Purpose

Deliver the daily morning briefing to Nicholas via Telegram. This skill is invoked by the 06:00 cron turn.

## Steps

### 1. Greet and fetch data

Open with a brief greeting that includes the current date. Then call `briefing_daily` to fetch the pre-formatted briefing from ConnectOS:

```
Tool: briefing_daily
```

The tool returns:

- `ok` — whether the fetch succeeded
- `telegramText` — Telegram HTML-formatted briefing text, ready to send
- `fallback` — true if ConnectOS returned partial/cached data

### 2. Deliver via Telegram

Send `telegramText` directly to Nicholas. Do not reformat or summarize — ConnectOS has already structured the message for Telegram HTML.

If `fallback` is true, prepend a brief note:

```
⚠️ Some data sources were unavailable — this may be partial.
```

### 3. ConnectOS unavailable

If `briefing_daily` fails (network error or non-OK response):

1. Do NOT attempt a retry in the same turn.
2. Send Nicholas this fallback message:

```
Good morning Nicholas. The morning briefing is temporarily unavailable — ConnectOS could not be reached. I'll be available for your questions. Have a great day.
```

## Constraints

- Keep the total message under Telegram's 4096-character limit. If `telegramText` exceeds this, split at a logical section boundary.
- No hardcoded URLs, tokens, or credentials — use tools only.
- Do not spawn subagents for this skill. The briefing is a single sequential fetch-and-send.
