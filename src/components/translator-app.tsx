"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, SendHorizontal, X, FileText, AlertTriangle, Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupPillItem } from "@/components/ui/radio-group";
import { ResultDialog } from "@/components/result-dialog";
import { UserMenu, type SessionUser } from "@/components/user-menu";
import { cn } from "@/lib/utils";
import type { Backend, TranslateApiResponse } from "@/lib/types";
import { BACKEND_HINTS, ENGINE_LABELS, type HistoryEntry } from "@/lib/client-types";

const BACKENDS: Backend[] = ["claude", "google_free", "mymemory"];

function groupLabelFor(date: Date): string {
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function entryFromApiResponse(data: TranslateApiResponse): HistoryEntry {
  return {
    id: data.historyId ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: "done",
    title: data.fileName || data.sourceText.slice(0, 80) || "Untitled",
    backend: data.backend,
    timestamp: new Date(data.createdAt),
    data,
    error: null,
  };
}

let idCounter = 0;

export function TranslatorApp({ user }: { user: SessionUser }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [backend, setBackend] = useState<Backend>("claude");
  const [apiKey, setApiKey] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openEntry = useMemo(() => entries.find((e) => e.id === openEntryId) ?? null, [entries, openEntryId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/history");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load history.");
        if (!cancelled) {
          const items: TranslateApiResponse[] = data.items;
          setEntries(items.map(entryFromApiResponse));
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load history.");
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setText("");
    }
  }

  function removeAttachment() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const typedText = text.trim();
    if (!file && !typedText) return;
    if (backend === "claude" && !apiKey.trim()) {
      toast.error("An Anthropic API key is required for the Claude backend.");
      return;
    }

    const localId = `pending-${++idCounter}`;
    const title = file ? file.name : typedText;
    const entry: HistoryEntry = {
      id: localId,
      status: "loading",
      title,
      backend,
      timestamp: new Date(),
      data: null,
      error: null,
    };
    setEntries((prev) => [entry, ...prev]);

    const formData = new FormData();
    if (file) formData.append("file", file);
    if (typedText) formData.append("text", typedText);
    formData.append("backend", backend);
    formData.append("api_key", apiKey.trim());

    setFile(null);
    setText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);

    try {
      const res = await fetch("/api/translate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      const apiData = data as TranslateApiResponse;
      setEntries((prev) =>
        prev.map((it) =>
          it.id === localId
            ? { ...entryFromApiResponse(apiData), id: apiData.historyId ?? localId }
            : it
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setEntries((prev) => prev.map((it) => (it.id === localId ? { ...it, status: "error", error: message } : it)));
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(entry: HistoryEntry) {
    if (!entry.data?.historyId) {
      setEntries((prev) => prev.filter((it) => it.id !== entry.id));
      return;
    }
    try {
      const res = await fetch(`/api/history?id=${encodeURIComponent(entry.data.historyId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete.");
      setEntries((prev) => prev.filter((it) => it.id !== entry.id));
      setOpenEntryId(null);
      toast.success("Deleted from history.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
    }
  }

  // Group entries by date label, preserving newest-first order within groups.
  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
      const label = groupLabelFor(entry.timestamp);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(entry);
    }
    return Array.from(map.entries());
  }, [entries]);

  return (
    <div className="mx-auto flex h-screen max-w-[880px] flex-col px-4">
      <header className="flex items-center justify-between border-b border-border py-5">
        <div>
          <h1 className="text-[1.3rem] font-semibold">Arabic → English Translator</h1>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            Type Arabic text or attach a document to translate.
          </p>
        </div>
        <UserMenu user={user} />
      </header>

      <main className="flex-1 overflow-y-auto py-3">
        {historyLoading ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Globe2 className="mb-3 size-8" />
            <p className="max-w-[420px] text-[0.9rem]">
              Type Arabic text below, or attach a PDF/image/scanned government document.
            </p>
            <p className="mt-1 max-w-[420px] text-[0.8rem] opacity-80">
              Pick a translation engine at the bottom of the composer first.
            </p>
          </div>
        ) : (
          groups.map(([label, groupEntries]) => (
            <div key={label}>
              <div className="px-1.5 pt-3.5 pb-2 text-sm font-semibold text-muted-foreground">{label}</div>
              {groupEntries.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} onClick={() => setOpenEntryId(entry.id)} />
              ))}
            </div>
          ))
        )}
      </main>

      <form
        onSubmit={handleSubmit}
        className="mb-4 mt-2 shrink-0 rounded-2xl border border-border bg-card p-3 pb-3.5"
      >
        {file && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary py-1 pl-3 pr-1.5 text-[0.82rem]">
            <Paperclip className="size-3.5 opacity-80" />
            <span>{file.name}</span>
            <button
              type="button"
              onClick={removeAttachment}
              className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              aria-label="Remove attachment"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            title="Attach a document"
            aria-label="Attach a document"
          >
            <Paperclip className="size-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"
            hidden
            onChange={handleFileChange}
          />
          <Textarea
            ref={textareaRef}
            value={text}
            disabled={!!file}
            onChange={(e) => {
              setText(e.target.value);
              autoGrow();
            }}
            onKeyDown={handleKeyDown}
            dir="auto"
            rows={1}
            placeholder={file ? "Attached — press send to translate this document" : "Type Arabic text to translate..."}
            className="max-h-40"
          />
          <Button type="submit" size="icon" disabled={sending || (!file && !text.trim())} title="Translate">
            <SendHorizontal className="size-4" />
          </Button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 border-t border-border pt-2.5">
          <RadioGroup value={backend} onValueChange={(v) => setBackend(v as Backend)}>
            {BACKENDS.map((b) => (
              <RadioGroupPillItem key={b} value={b} id={`backend-${b}`}>
                {ENGINE_LABELS[b]}
              </RadioGroupPillItem>
            ))}
          </RadioGroup>

          {backend === "claude" && (
            <Input
              type="password"
              placeholder="Anthropic API key (sk-ant-...)"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-8 min-w-[180px] flex-1 basis-[220px] text-[0.8rem]"
            />
          )}
        </div>
        <p className="mt-2 px-0.5 text-[0.76rem] text-muted-foreground">{BACKEND_HINTS[backend]}</p>
      </form>

      <ResultDialog
        entry={openEntry}
        onOpenChange={(open) => !open && setOpenEntryId(null)}
        onDelete={openEntry ? () => handleDelete(openEntry) : undefined}
      />
    </div>
  );
}

function HistoryRow({ entry, onClick }: { entry: HistoryEntry; onClick: () => void }) {
  const clickable = entry.status === "done";

  return (
    <button
      type="button"
      onClick={clickable ? onClick : () => entry.error && toast.error(entry.error)}
      className="flex w-full items-center gap-3.5 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-accent"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
        {entry.status === "error" ? (
          <AlertTriangle className="size-4 text-destructive" />
        ) : entry.status === "loading" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileText className="size-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div
          dir="auto"
          className={cn("truncate text-[0.98rem]", entry.status === "error" && "text-destructive")}
        >
          {entry.title || "Untitled"}
        </div>
        <div className="mt-0.5 text-[0.85rem] text-muted-foreground">
          {entry.status === "loading" ? "Translating..." : entry.status === "error" ? "Failed" : "Me"}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 text-[0.85rem] text-muted-foreground">
        {entry.status === "done" && entry.data && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[0.72rem] font-bold",
              entry.data.metrics.accuracyLabel === "High" && "border-success text-success",
              entry.data.metrics.accuracyLabel === "Medium" && "border-warning text-warning",
              entry.data.metrics.accuracyLabel === "Low" && "border-destructive text-destructive"
            )}
          >
            {entry.data.metrics.accuracyScore}
          </span>
        )}
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-secondary px-2.5 py-1 text-[0.76rem]">
          {ENGINE_LABELS[entry.backend]}
        </span>
        <span className="min-w-16 text-right">{formatTime(entry.timestamp)}</span>
      </div>
    </button>
  );
}
