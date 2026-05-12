import { AppShell } from "./components/AppShell";

// Public workspace — reads from the "public" namespace in blob (or local EMDEE_DOCS in dev).
// Shows Sign In button in the sidebar instead of PAT Token.
export default function PublicWorkspace() {
  return <AppShell namespace="public" />;
}
