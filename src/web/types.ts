export type RelationKind = "hierarchy" | "assoc";

export interface Link {
  title: string;
  note: string;
  inline: string[];
}

export interface DocNode {
  path: string;
  title: string;
  content: string;
  summary: string;
  parents: Link[];
  children: Link[];
  associates: Link[];
  mentions: string[];
}

export interface Edge {
  from: string;
  to: string;
  kind: RelationKind;
}

export interface DocIndex {
  docs: DocNode[];
  edges: Edge[];
  entry: string | null;
}
