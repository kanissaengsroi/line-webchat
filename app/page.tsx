import { redirect } from "next/navigation";
import { Inbox } from "@/components/Inbox";
import { getSession } from "@/lib/auth";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Inbox username={session.username} />;
}
