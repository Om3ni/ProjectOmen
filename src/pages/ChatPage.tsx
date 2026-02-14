import { ChatPanel } from '@/components/chat';

/**
 * Standalone chat page for popout window
 */
export default function ChatPage() {
  return (
    <div className="h-screen w-screen theme-bg-base">
      <ChatPanel className="h-full border-l-0" />
    </div>
  );
}
