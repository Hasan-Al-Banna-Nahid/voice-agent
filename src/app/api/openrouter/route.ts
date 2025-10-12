import { NextRequest, NextResponse } from "next/server";

// Make sure you have OPENROUTER_API_KEY in your .env
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message)
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 }
      );

    // Call OpenRouter GPT-5 endpoint
    const response = await fetch(
      "https://api.openrouter.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini", // choose the GPT-5 model
          messages: [
            {
              role: "system",
              content:
                "You are an AI assistant. Detect the mood of the user and respond accordingly.",
            },
            { role: "user", content: message },
          ],
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();

    // Extract AI reply
    const aiText =
      data.choices?.[0]?.message?.content ||
      "Sorry, I could not generate a response.";

    // Simple mood detection: ask GPT to provide mood tag
    const moodPrompt = await fetch(
      "https://api.openrouter.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content:
                "Detect the mood of the following text in one word (happy, sad, angry, neutral, excited):",
            },
            { role: "user", content: message },
          ],
          temperature: 0,
        }),
      }
    );

    const moodData = await moodPrompt.json();
    const mood = moodData.choices?.[0]?.message?.content?.trim() || "neutral";

    return NextResponse.json({ response: aiText, mood });
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch from OpenRouter" },
      { status: 500 }
    );
  }
}
