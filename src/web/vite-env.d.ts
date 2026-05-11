/// <reference types="vite/client" />

declare module "@toast-ui/editor" {
  // Minimal surface we use; the package ships untyped under exports.
  type Mode = "markdown" | "wysiwyg";
  type PreviewStyle = "tab" | "vertical";

  interface EditorOptions {
    el: HTMLElement;
    initialValue?: string;
    height?: string;
    previewStyle?: PreviewStyle;
    initialEditType?: Mode;
    hideModeSwitch?: boolean;
    usageStatistics?: boolean;
    toolbarItems?: (string | object)[][];
    events?: { [event: string]: (...args: unknown[]) => void };
  }

  export default class Editor {
    constructor(options: EditorOptions);
    getMarkdown(): string;
    setMarkdown(value: string): void;
    isMarkdownMode(): boolean;
    isWysiwygMode(): boolean;
    changeMode(mode: Mode): void;
    destroy(): void;
  }
}
