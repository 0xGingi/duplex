import { useEffect, useMemo, useRef, useState } from "react";
import { useGitStore } from "../../stores/useGitStore.ts";
import { useTabStore } from "../../stores/useTabStore.ts";

type DiffRowKind = "meta" | "hunk" | "context" | "add" | "del";
type DiffViewMode = "unified" | "split";

interface DiffRow {
  kind: DiffRowKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

const OVERSCAN_ROWS = 20;
const UNIFIED_ROW_HEIGHT = 20;
const SPLIT_ROW_HEIGHT = 22;
const VIRTUALIZATION_THRESHOLD = 250;

function parseDiffRows(diffContent: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const lines = diffContent.split("\n");

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1] || "0", 10);
      newLine = parseInt(hunkMatch[2] || "0", 10);
      inHunk = true;
      rows.push({ kind: "hunk", text: line, oldLine: null, newLine: null });
      continue;
    }

    const isMeta =
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("new file mode ") ||
      line.startsWith("deleted file mode ") ||
      line.startsWith("similarity index ") ||
      line.startsWith("rename from ") ||
      line.startsWith("rename to ") ||
      line.startsWith("Binary files ") ||
      line.startsWith("\\ No newline at end of file");

    if (!inHunk || isMeta) {
      rows.push({ kind: "meta", text: line, oldLine: null, newLine: null });
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      rows.push({ kind: "add", text: line, oldLine: null, newLine });
      newLine += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      rows.push({ kind: "del", text: line, oldLine, newLine: null });
      oldLine += 1;
      continue;
    }

    rows.push({ kind: "context", text: line, oldLine, newLine });
    oldLine += 1;
    newLine += 1;
  }

  return rows;
}

function kindStyles(kind: DiffRowKind): { textClass: string; bgClass: string } {
  switch (kind) {
    case "add":
      return { textClass: "text-green", bgClass: "bg-green/5" };
    case "del":
      return { textClass: "text-red", bgClass: "bg-red/5" };
    case "hunk":
      return { textClass: "text-cyan", bgClass: "bg-cyan/5" };
    case "meta":
      return { textClass: "text-text-muted", bgClass: "" };
    default:
      return { textClass: "text-text-secondary", bgClass: "" };
  }
}

function stripDiffPrefix(text: string, kind: DiffRowKind): string {
  if (kind === "add" && text.startsWith("+")) return text.slice(1);
  if (kind === "del" && text.startsWith("-")) return text.slice(1);
  if (kind === "context" && text.startsWith(" ")) return text.slice(1);
  return text;
}

function renderUnifiedRow(
  row: DiffRow,
  key: number,
  showLineNumbers: boolean,
  rowHeight: number,
) {
  const styles = kindStyles(row.kind);

  if (showLineNumbers) {
    return (
      <div
        key={key}
        style={{ height: rowHeight }}
        className={`grid grid-cols-[3rem_3rem_minmax(0,1fr)] items-center px-2 font-mono text-xs leading-5 ${styles.bgClass}`}
      >
        <span className="text-[10px] text-text-muted tabular-nums">
          {row.oldLine ?? ""}
        </span>
        <span className="text-[10px] text-text-muted tabular-nums">
          {row.newLine ?? ""}
        </span>
        <span className={`${styles.textClass} whitespace-pre`}>{row.text}</span>
      </div>
    );
  }

  return (
    <div
      key={key}
      style={{ height: rowHeight }}
      className={`flex items-center px-2 font-mono text-xs leading-5 ${styles.bgClass}`}
    >
      <span className={`${styles.textClass} whitespace-pre`}>{row.text}</span>
    </div>
  );
}

function renderSplitRow(
  row: DiffRow,
  key: number,
  showLineNumbers: boolean,
  rowHeight: number,
) {
  if (row.kind === "meta" || row.kind === "hunk") {
    const styles = kindStyles(row.kind);
    return (
      <div
        key={key}
        style={{ height: rowHeight }}
        className={`flex items-center px-2 font-mono text-xs leading-5 ${styles.bgClass}`}
      >
        <span className={`${styles.textClass} whitespace-pre`}>{row.text}</span>
      </div>
    );
  }

  const leftText =
    row.kind === "add" ? "" : stripDiffPrefix(row.text, row.kind);
  const rightText =
    row.kind === "del" ? "" : stripDiffPrefix(row.text, row.kind);

  const leftBg = row.kind === "del" ? "bg-red/5" : "";
  const rightBg = row.kind === "add" ? "bg-green/5" : "";

  const leftColor = row.kind === "del" ? "text-red" : "text-text-secondary";
  const rightColor = row.kind === "add" ? "text-green" : "text-text-secondary";

  return (
    <div
      key={key}
      style={{ height: rowHeight }}
      className="grid grid-cols-2 items-center font-mono text-xs leading-5"
    >
      <div className={`h-full border-r border-border/50 px-2 ${leftBg}`}>
        <div
          className={`h-full ${showLineNumbers ? "grid grid-cols-[3rem_minmax(0,1fr)] items-center" : "flex items-center"}`}
        >
          {showLineNumbers && (
            <span className="text-[10px] text-text-muted tabular-nums">
              {row.oldLine ?? ""}
            </span>
          )}
          <span className={`${leftColor} whitespace-pre`}>{leftText}</span>
        </div>
      </div>
      <div className={`h-full px-2 ${rightBg}`}>
        <div
          className={`h-full ${showLineNumbers ? "grid grid-cols-[3rem_minmax(0,1fr)] items-center" : "flex items-center"}`}
        >
          {showLineNumbers && (
            <span className="text-[10px] text-text-muted tabular-nums">
              {row.newLine ?? ""}
            </span>
          )}
          <span className={`${rightColor} whitespace-pre`}>{rightText}</span>
        </div>
      </div>
    </div>
  );
}

export default function DiffViewer() {
  const selectedFile = useGitStore((s) => s.selectedFile);
  const diffContent = useGitStore((s) => s.diffContent);
  const activeTabId = useTabStore((s) => s.activeTabId);

  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const syncViewport = () => setViewportHeight(scroller.clientHeight);
    syncViewport();

    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, [selectedFile?.file, viewMode]);

  useEffect(() => {
    setScrollTop(0);
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = 0;
    }
  }, [selectedFile?.file, diffContent, viewMode]);

  const rows = useMemo(
    () => (diffContent ? parseDiffRows(diffContent) : []),
    [diffContent],
  );

  if (!selectedFile) {
    return (
      <div className="px-3 py-4 text-center text-sm text-text-muted">
        Select a file to view diff
      </div>
    );
  }

  if (selectedFile.tabId !== activeTabId) {
    return (
      <div className="px-3 py-4 text-center text-sm text-text-muted">
        Select a file to view diff
      </div>
    );
  }

  if (!diffContent) {
    return (
      <div className="px-3 py-4 text-center text-sm text-text-muted">
        No diff output for{" "}
        <span className="font-mono">{selectedFile.file}</span>
      </div>
    );
  }

  const rowHeight =
    viewMode === "split" ? SPLIT_ROW_HEIGHT : UNIFIED_ROW_HEIGHT;
  const shouldVirtualize = rows.length > VIRTUALIZATION_THRESHOLD;
  const visibleRowCount = shouldVirtualize
    ? Math.ceil((viewportHeight || 1) / rowHeight) + OVERSCAN_ROWS * 2
    : rows.length;
  const startIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS)
    : 0;
  const endIndex = Math.min(rows.length, startIndex + visibleRowCount);
  const topPadding = startIndex * rowHeight;
  const bottomPadding = Math.max(0, (rows.length - endIndex) * rowHeight);
  const renderedRows = rows.slice(startIndex, endIndex);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-3 py-2 bg-bg-tertiary border-b border-border sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-mono text-text-secondary truncate">
              {selectedFile.file}
            </span>
            <span className="ml-2 text-[10px] text-text-muted">
              {selectedFile.staged ? "staged diff" : "unstaged diff"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("unified")}
              className={`text-[10px] px-2 py-0.5 rounded border ${
                viewMode === "unified"
                  ? "border-accent/60 text-accent bg-accent/10"
                  : "border-border text-text-muted hover:text-text-secondary"
              }`}
              title="Unified diff"
            >
              Unified
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`text-[10px] px-2 py-0.5 rounded border ${
                viewMode === "split"
                  ? "border-accent/60 text-accent bg-accent/10"
                  : "border-border text-text-muted hover:text-text-secondary"
              }`}
              title="Split diff"
            >
              Split
            </button>
            <button
              onClick={() => setShowLineNumbers((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded border ${
                showLineNumbers
                  ? "border-cyan/60 text-cyan bg-cyan/10"
                  : "border-border text-text-muted hover:text-text-secondary"
              }`}
              title="Toggle line numbers"
            >
              #
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={(e) =>
          setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)
        }
        className="flex-1 overflow-auto"
      >
        <div style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
          {renderedRows.map((row, i) => {
            const key = startIndex + i;
            return viewMode === "split"
              ? renderSplitRow(row, key, showLineNumbers, rowHeight)
              : renderUnifiedRow(row, key, showLineNumbers, rowHeight);
          })}
        </div>
      </div>
    </div>
  );
}
