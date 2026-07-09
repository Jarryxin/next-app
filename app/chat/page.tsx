import { modelGroups } from "@/lib/models";
import ChatContent from "./ChatContent";

export default function ChatPage() {
  return <ChatContent modelGroups={modelGroups} />;
}
