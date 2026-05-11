import { useEffect, useRef } from "react";
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

interface Props {
  path: string;
  initialContent: string;
  mode: "raw" | "rendered";
  onChange: (next: string) => void;
}

export function DocEditor({ path, initialContent, mode, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create editor once per `path` (key change => fresh instance)
  useEffect(() => {
    if (!hostRef.current) return;
    const editor = new Editor({
      el: hostRef.current,
      initialValue: initialContent,
      previewStyle: "vertical",
      height: "100%",
      initialEditType: mode === "raw" ? "markdown" : "wysiwyg",
      hideModeSwitch: true,
      usageStatistics: false,
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task", "indent", "outdent"],
        ["table", "image", "link"],
        ["code", "codeblock"],
      ],
      events: {
        change: () => onChangeRef.current(editor.getMarkdown()),
      },
    });
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Mode changes flip editor type without rebuilding
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const desired = mode === "raw" ? "markdown" : "wysiwyg";
    if (ed.isMarkdownMode() && desired === "wysiwyg") ed.changeMode("wysiwyg");
    else if (ed.isWysiwygMode() && desired === "markdown") ed.changeMode("markdown");
  }, [mode]);

  // Pull in external content changes (e.g. file watcher reload) without resetting cursor
  // when the user is the one who typed the change.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (ed.getMarkdown() !== initialContent) {
      ed.setMarkdown(initialContent);
    }
  }, [initialContent]);

  return <div ref={hostRef} style={{ height: "100%" }} />;
}
