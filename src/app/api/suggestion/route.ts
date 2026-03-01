import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";

const suggestionSchema = z.object({
  suggestion: z
    .string()
    .describe("The code to insert at cursor, or empty string if no compleetion needed"),
});

const SUGGESTION_PROMPT = `You are a code suggestion assistant.

<context>
<file_name>{fileName}</file_name>
<previous_lines>
{previousLines}
</previous_lines>
<current_line number="{lineNumber}">{currentLine}</current_line>
<before_cursor>{textBeforeCursor}</before_cursor>
<after_cursor>{textAfterCursor}</after_cursor>
<next_lines>
{nextLines}
</next_lines>
<full_code>
{code}
</full_code>
</context>

<instructions>
Follow these steps IN ORDER:

1. First, look at next_lines. If next_lines contains ANY code, check if it continues from where the cursor is. If it does, return empty string immediately - the code is already written.

2. Check if before_cursor ends with a complete statement (;, }, )). If yes, return empty string.

3. Only if steps 1 and 2 don't apply: suggest what should be typed at the cursor position, using context from full_code.

Your suggestion is inserted immediately after the cursor, so never suggest code that's already in the file.
</instructions>`;

// const SUGGESTION_PROMPT = `
// You are a deterministic code completion engine.

// CRITICAL OUTPUT RULES:
// - Output ONLY the text to insert at the cursor.
// - Do NOT explain anything.
// - Do NOT wrap in markdown.
// - If no suggestion is needed, output EXACTLY: __EMPTY__
// - Do not output anything else.

// CONTEXT:
// File: {fileName}

// Previous lines:
// {previousLines}

// Current line ({lineNumber}):
// {textBeforeCursor}|CURSOR|{textAfterCursor}

// Next lines:
// {nextLines}

// Full file:
// {code}

// DECISION LOGIC (FOLLOW EXACTLY IN ORDER):

// STEP 1:
// If nextLines contains code that continues naturally from the cursor position,
// output: __EMPTY__

// STEP 2:
// If textBeforeCursor ends with one of:
// ;  }  )
// output: __EMPTY__

// STEP 3:
// Otherwise:
// Output ONLY the minimal code that should be inserted at |CURSOR|.
// Do not repeat existing code.
// Do not include code already present in nextLines.
// `;

export async function POST(request: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      const { fileName, code, currentLine, previousLines, textBeforeCursor, textAfterCursor, lineNumber, nextLines } = await request.json();
      if (!code) {
        return NextResponse.json(
            { error: "Code is required." },
            { status: 400 }
        )
      }

      const prompt = SUGGESTION_PROMPT.replace("{fileName}", fileName)
        .replace("{previousLines}", previousLines || "")
        .replace("{currentLine}", currentLine)
        .replace("{textBeforeCursor}", textBeforeCursor)
        .replace("{textAfterCursor}", textAfterCursor)
        .replace("{lineNumber}", lineNumber.toString())
        .replace("{nextLines}", nextLines || "")
        .replace("{code}", code)

    const { output } = await generateText({
        model: google('gemini-2.5-flash'),
        output: Output.object({ schema: suggestionSchema }),
        prompt,
    })

    return NextResponse.json({ suggestion: output.suggestion  })
  } catch (error) {
    console.error("Error generating suggestion:", error);
    return NextResponse.json(
        { error: "Failed to generate suggestion" },
        { status: 500 }
    );
  }
}