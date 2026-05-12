import { AppShell } from "@/app/components/AppShell";

interface Props {
  params: Promise<{ userId: string }>;
}

// User workspace — reads docs from blob under the {userId}/ namespace prefix.
// Shows PAT Token in sidebar if the visitor is the namespace owner.
export default async function UserWorkspace({ params }: Props) {
  const { userId } = await params;
  return <AppShell namespace={userId} />;
}
