import { redirect } from "next/navigation";
import { CustomerChat } from "@/components/CustomerChat";
import { getSession } from "@/lib/auth";
import { getBotInfo } from "@/lib/line";

export default async function ChatPage() {
  const session = await getSession();
  if (!session?.convId) redirect("/login");
  const bot = await getBotInfo();
  return (
    <CustomerChat
      convId={session.convId}
      username={session.username}
      picture={session.picture}
      oa={{
        name: bot?.displayName ?? "LINE OA",
        pictureUrl: bot?.pictureUrl,
        id: bot?.basicId ?? "oa",
      }}
    />
  );
}
