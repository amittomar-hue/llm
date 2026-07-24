"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/chat-store";
import Message from "./Message";

export default function MessageThread() {
  const conv = useChatStore((s) => s.activeConversation());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length, conv?.messages[conv.messages.length - 1]?.content]);

  if (!conv) return null;

  return (
    <div className="flex-1 overflow-y-auto reverb-scroll relative z-10">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8 flex flex-col gap-5 sm:gap-7">
        {conv.messages.map((m) => (
          <div key={m.id} className="group">
            <Message message={m} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
