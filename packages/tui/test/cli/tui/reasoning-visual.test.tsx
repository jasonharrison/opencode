/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { Part } from "@opencode-ai/sdk/v2"
import { ReasoningPartView, reasoningGutterColor } from "../../../src/routes/session"
import { DEFAULT_THEMES, resolveTheme } from "../../../src/theme"

describe("ReasoningPartView", () => {
  test("renders the configured gutter for completed reasoning", async () => {
    const frame = await renderFrame(reasoning("Details only.", true))
    const spans = frame.lines.flatMap((line) => line.spans)

    expect(spans.find((span) => span.text.includes("█"))?.fg).toEqual(RGBA.fromHex("#6ee7a0"))
  })

  test("selects distinct active and done gutter colors", () => {
    const theme = resolveTheme(DEFAULT_THEMES["high-contrast"], "dark")

    expect(reasoningGutterColor(theme, false)).toEqual(RGBA.fromHex("#c792ea"))
    expect(reasoningGutterColor(theme, true)).toEqual(RGBA.fromHex("#6ee7a0"))
  })
})

async function renderFrame(part: Extract<Part, { type: "reasoning" }>) {
  const app = await testRender(
    () => (
      <ReasoningPartView
        part={part}
        theme={resolveTheme(DEFAULT_THEMES["high-contrast"], "dark")}
        thinkingMode={() => "show"}
        conceal={() => false}
      />
    ),
    { width: 60, height: 8 },
  )

  try {
    await app.renderOnce()
    await app.waitFor(() => app.captureCharFrame().includes("Thought"), { maxPasses: 20 })
    return app.captureSpans()
  } finally {
    app.renderer.destroy()
  }
}

function reasoning(text: string, done = false): Extract<Part, { type: "reasoning" }> {
  return {
    id: "reasoning",
    sessionID: "session",
    messageID: "message",
    type: "reasoning",
    text,
    time: done ? { start: 0, end: 5 } : { start: 0 },
  }
}
