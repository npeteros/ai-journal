import { handleChatStream } from "@mastra/ai-sdk";
import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { createUIMessageStreamResponse } from "ai";
import { NextResponse } from "next/server";
import { mastra } from "@/src/mastra";

// Dev-only demo endpoint for the S1-05 AI layer. Disabled in production builds
// until real auth exists; the Mastra agent and API keys stay server-side.
const isDisabled = process.env.NODE_ENV === "production";

const AGENT_ID = "weather-agent";
const THREAD_ID = "dev-chat-thread";
const RESOURCE_ID = "dev-chat-user";

function notFound() {
  return new NextResponse(null, { status: 404 });
}

export async function POST(req: Request) {
  if (isDisabled) return notFound();

  const params = await req.json();
  const stream = await handleChatStream({
    mastra,
    agentId: AGENT_ID,
    version: "v7",
    params: {
      ...params,
      memory: {
        ...params.memory,
        thread: THREAD_ID,
        resource: RESOURCE_ID,
      },
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function GET() {
  if (isDisabled) return notFound();

  const memory = await mastra.getAgentById(AGENT_ID).getMemory();
  let response = null;

  try {
    response = await memory?.recall({
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
    });
  } catch {
    // No thread yet: start with an empty history.
  }

  return NextResponse.json(
    toAISdkMessages(response?.messages || [], { version: "v7" }),
  );
}
