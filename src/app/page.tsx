// src/app/page.tsx
import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
  return (
    <main style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <ChatWindow />
    </main>
  );
}
