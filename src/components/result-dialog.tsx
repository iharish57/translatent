"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EXTRACTION_LABELS, type HistoryEntry } from "@/lib/client-types";

export function ResultDialog({
  entry,
  onOpenChange,
  onDelete,
}: {
  entry: HistoryEntry | null;
  onOpenChange: (open: boolean) => void;
  onDelete?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const open = entry !== null && entry.status === "done" && entry.data !== null;
  const data = entry?.data ?? null;
  const m = data?.metrics;

  function requestClose() {
    const ok = window.confirm(
      "Close this translation? You can reopen it anytime from the list."
    );
    if (ok) onOpenChange(false);
    return ok;
  }

  async function handleCopy() {
    if (!data?.translation) return;
    try {
      await navigator.clipboard.writeText(data.translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
      {open && data && m && (
        <DialogContent onCloseAttempt={requestClose} className="p-0">
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <DialogTitle>{entry?.title || "Translation result"}</DialogTitle>
            <div className="mr-8 flex shrink-0 items-center gap-2">
              {onDelete && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Delete this translation from your history? This can't be undone.")) {
                      onDelete();
                    }
                  }}
                  className="text-destructive hover:border-destructive"
                >
                  Delete
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy translation"}
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(88vh-88px)] overflow-y-auto px-6 pb-6">
            <div className="mb-4 flex items-center gap-5 rounded-lg border border-border bg-card p-5">
              <div
                className={cn(
                  "flex h-[90px] w-[90px] shrink-0 flex-col items-center justify-center rounded-full border-4",
                  m.accuracyLabel === "High" && "border-success",
                  m.accuracyLabel === "Medium" && "border-warning",
                  m.accuracyLabel === "Low" && "border-destructive"
                )}
              >
                <span className="text-xl font-bold">{m.accuracyScore}</span>
                <span className="text-[0.7rem] text-muted-foreground">/100</span>
              </div>
              <div className="flex-1">
                <div className="mb-2 text-lg font-bold">{m.accuracyLabel} confidence</div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground sm:grid-cols-3">
                  <MetricRow k="Extraction method" v={EXTRACTION_LABELS[m.extractionSource] || m.extractionSource} />
                  <MetricRow k="OCR confidence" v={m.ocrConfidence !== null ? `${m.ocrConfidence}%` : "n/a"} />
                  <MetricRow k="Model confidence" v={m.modelConfidence !== null ? `${m.modelConfidence}%` : "n/a"} />
                  <MetricRow k="Word count" v={m.wordCount} />
                  <MetricRow k="Character count" v={m.charCount} />
                  <MetricRow k="Arabic char ratio" v={m.arabicCharRatio} />
                  <MetricRow k="Backend" v={data.backend} />
                  <MetricRow k="Processing time" v={`${data.processingTimeSec}s`} />
                </div>
              </div>
            </div>

            {data.documentTypeGuess && (
              <div className="mb-3 text-[0.85rem] text-muted-foreground">
                Detected document type: {data.documentTypeGuess}
              </div>
            )}

            {data.ambiguousTerms.length > 0 && (
              <div className="mb-3 rounded-lg border border-border bg-secondary p-3 text-[0.85rem]">
                <div className="mb-1.5 font-bold">Ambiguous / uncertain terms</div>
                {data.ambiguousTerms.map((t, i) => (
                  <div key={i}>&bull; {t}</div>
                ))}
              </div>
            )}

            {data.notes && (
              <div className="mb-3 rounded-lg border border-border bg-secondary p-3 text-[0.85rem]">
                <div className="mb-1.5 font-bold">Reviewer notes</div>
                {data.notes}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-[0.85rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Original (Arabic)
                </h3>
                <pre
                  dir="rtl"
                  className="max-h-[480px] min-h-[160px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-sans text-[0.95rem] leading-relaxed"
                >
                  {data.sourceText}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-[0.85rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Translation (English)
                </h3>
                <pre
                  dir="ltr"
                  className="max-h-[480px] min-h-[160px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-4 font-sans text-[0.95rem] leading-relaxed"
                >
                  {data.translation}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

function MetricRow({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <span className="font-semibold text-foreground">{k}:</span> {v}
    </div>
  );
}
