"use client";
import dynamic from "next/dynamic";
import type { Props } from "./DocEditorInner";

const DocEditorInner = dynamic(
  () => import("./DocEditorInner").then(m => ({ default: m.DocEditorInner })),
  { ssr: false, loading: () => null }
);

export function DocEditor(props: Props) {
  return <DocEditorInner {...props} />;
}

export type { Props };
