"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { ArrowUpIcon, LoaderCircleIcon, WrenchIcon } from "lucide-react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

type ToolPart = Extract<
  UIMessage["parts"][number],
  { type: `tool-${string}` } | { type: "dynamic-tool" }
>;

const API = "/api/dev/chat";

function getText(message: UIMessage) {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join("");
}

// Dev-only demo of the AI layer (Mastra agent -> AI SDK UI). Not a product feature.
export default function DevChatPage() {
  const [input, setInput] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const { messages, setMessages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: API }),
  });

  useEffect(() => {
    fetch(API)
      .then((res) => res.json())
      .then((history: UIMessage[]) => setMessages(history))
      .catch(() => {});
  }, [setMessages]);

  const busy = status === "submitted" || status === "streaming";
  const canSend = input.trim().length > 0 && !busy;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    void sendMessage({ text: input.trim() });
    setInput("");
  }

  return (
    <MessageScrollerProvider autoScroll>
      <div className="mx-auto flex h-screen w-full max-w-3xl flex-col gap-4 p-6">
        <h1 className="text-sm font-medium text-muted-foreground">
          Dev chat · weather-agent
        </h1>
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent aria-busy={busy} className="gap-6">
              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor
                    >
                      <Message align="end">
                        <MessageContent>
                          <Bubble align="end" variant="muted">
                            <BubbleContent>{getText(message)}</BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  );
                }

                const tools = message.parts.filter(isToolUIPart);
                const reply = getText(message);

                return (
                  <MessageScrollerItem key={message.id} messageId={message.id}>
                    <Message>
                      <MessageContent className="gap-3">
                        {tools.length > 0 && (
                          <Trace>
                            {tools.map((part) => (
                              <ToolRow key={part.toolCallId} part={part} />
                            ))}
                          </Trace>
                        )}
                        {reply && (
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {reply}
                          </p>
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>

        <form ref={formRef} onSubmit={onSubmit}>
          <InputGroup>
            <InputGroupTextarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the weather..."
              aria-label="Message"
              className="min-h-14"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
            />
            <InputGroupAddon align="block-end" className="pt-1">
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-sm"
                disabled={!canSend}
                className="ml-auto"
              >
                {busy ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <ArrowUpIcon />
                )}
                <span className="sr-only">Send</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </MessageScrollerProvider>
  );
}

function ToolRow({ part }: { part: ToolPart }) {
  const name = getToolName(part);
  const done = part.state === "output-available";
  const failed = part.state === "output-error";

  if (!done && !failed) {
    return (
      <TraceLine status="running">
        <TraceIcon>
          <LoaderCircleIcon className="animate-spin" />
        </TraceIcon>
        <TraceTitle>Calling {name}</TraceTitle>
      </TraceLine>
    );
  }

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={failed ? "error" : undefined}>
          <TraceIcon>
            <WrenchIcon />
          </TraceIcon>
          <TraceTitle>
            {failed ? "Failed" : "Called"} {name}
          </TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
          {failed
            ? part.errorText
            : JSON.stringify({ input: part.input, output: part.output }, null, 2)}
        </pre>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
