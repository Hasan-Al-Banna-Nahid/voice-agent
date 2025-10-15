import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("🚀 WEBHOOK RECEIVED:", {
      eventType: body.eventType,
      timestamp: body.timestamp,
      userId: body.userProfile?.id,
      userName: body.userProfile?.name,
      action: body.action,
      conversationCount: body.totalConversations,
      mood: body.conversation?.mood,
    });

    // Log full data for debugging
    console.log("📊 Full webhook data:", JSON.stringify(body, null, 2));

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    return NextResponse.json(
      {
        success: true,
        message: "Webhook processed successfully",
        eventType: body.eventType,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}

// Add GET method for testing
export async function GET() {
  return NextResponse.json(
    {
      message: "Webhook endpoint is working!",
      timestamp: new Date().toISOString(),
      instructions: "Send POST requests with webhook data to this endpoint",
    },
    { status: 200 }
  );
}
