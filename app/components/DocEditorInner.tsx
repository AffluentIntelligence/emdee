"use client";
import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

export interface Props {
  path: string;
  initialContent: string;
  mode: "raw" | "rendered";
  onChange: (next: string) => void;
  onWikiLinkClick?: (title: string) => void;
  readOnly?: boolean;
}

// SPRINT-036: interactive task-list checkboxes.
// Matches the same task-list shapes ToastMark renders as `<input type="checkbox">`:
// `- [ ] foo`, `* [x] bar`, `+ [X] baz`, `1. [ ] qux`. The leading prefix is
// captured so the replace preserves indentation + marker style exactly.
const TASK_RE = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/gm;

function toggleNthTask(src: string, n: number): string {
  let i = 0;
  return src.replace(TASK_RE, (full, prefix: string, char: string) => {
    if (i++ !== n) return full;
    const toggled = char === " " ? "x" : " ";
    return `${prefix}[${toggled}]`;
  });
}

export function DocEditorInner({ path, initialContent, mode, onChange, onWikiLinkClick, readOnly }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onWikiLinkClickRef = useRef(onWikiLinkClick);
  onWikiLinkClickRef.current = onWikiLinkClick;

  useEffect(() => {
    if (!hostRef.current) return;
    const host = hostRef.current;
    const editor = new Editor({
      el: host,
      initialValue: initialContent,
      previewStyle: "vertical",
      height: "100%",
      initialEditType: "markdown",
      hideModeSwitch: true,
      usageStatistics: false,
      // GFM extended autolink: bare URLs typed without [text](url) syntax
      // render as clickable <a>. ToastMark runs autolink before the text
      // node is emitted, so the customHTMLRenderer.text override below
      // never sees URL-shaped text (wiki-links unaffected — they don't
      // match URL patterns).
      extendedAutolinks: true,
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task", "indent", "outdent"],
        ["table", "image", "link"],
        ["code", "codeblock"],
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customHTMLRenderer: {
        text(node: any) {
          const literal: string = node.literal ?? "";
          const escaped = literal
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const html = escaped.replace(/\[\[([^\]]+)\]\]/g, (_: string, title: string) => {
            const safe = title.replace(/"/g, "&quot;");
            return `<span class="wiki-link" title="${safe}">${title}</span>`;
          });
          return [{ type: "html", content: html }];
        },
      },
      events: {
        change: () => {
          if (!readOnly) onChangeRef.current(editor.getMarkdown());
          // SPRINT-036: re-tag checkboxes after every render so the linear
          // index stays accurate when tasks are added / removed via typing.
          requestAnimationFrame(tagCheckboxes);
        },
      },
    });
    editorRef.current = editor;
    if (readOnly) host.classList.add("doc-editor-readonly");

    // SPRINT-036: enable preview-pane task-list checkboxes + tag them with a
    // stable linear index so the click handler can locate the matching
    // bracket in the markdown source.
    const tagCheckboxes = () => {
      const preview = host.querySelector(".toastui-editor-md-preview");
      if (!preview) return;
      const inputs = preview.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
      inputs.forEach((el, i) => {
        if (!readOnly) el.disabled = false;
        el.dataset.taskIdx = String(i);
      });
    };
    requestAnimationFrame(tagCheckboxes);

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Wiki-link click — navigate via parent (existing).
      const link = target.closest(".wiki-link") as HTMLElement | null;
      if (link && onWikiLinkClickRef.current) {
        onWikiLinkClickRef.current(link.getAttribute("title") ?? link.textContent ?? "");
        return;
      }

      // SPRINT-036: task-list checkbox click — toggle the Nth `[ ]`/`[x]` in
      // the markdown source and write back through onChange. preventDefault
      // suppresses the browser's own checkbox toggle so the visual state
      // comes from the source round-trip (no flash of the wrong state).
      if (
        target.tagName === "INPUT" &&
        (target as HTMLInputElement).type === "checkbox" &&
        target.closest(".toastui-editor-md-preview") &&
        target.dataset.taskIdx !== undefined
      ) {
        e.preventDefault();
        if (readOnly) return;
        const ed = editorRef.current;
        if (!ed) return;
        const idx = Number(target.dataset.taskIdx);
        if (!Number.isFinite(idx)) return;
        const md = ed.getMarkdown();
        const next = toggleNthTask(md, idx);
        if (next !== md) {
          // setMarkdown re-renders the preview (which fires `change` and
          // re-tags). Call onChange explicitly because Toast UI doesn't
          // guarantee `change` for programmatic setMarkdown across versions.
          ed.setMarkdown(next);
          onChangeRef.current(next);
        }
      }
    };
    host.addEventListener("click", handleClick);

    return () => {
      host.removeEventListener("click", handleClick);
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (ed.getMarkdown() !== initialContent) ed.setMarkdown(initialContent);
  }, [initialContent]);

  return <div ref={hostRef} data-mode={mode} data-readonly={readOnly ? "true" : undefined} style={{ height: "100%" }} />;
}
