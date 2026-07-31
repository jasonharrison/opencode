import { describe, expect, test } from "bun:test"
import type { Part } from "@opencode-ai/sdk/v2"
import { reasoningSummary } from "../../../src/context/thinking"
import { isAnswerBoundary } from "../../../src/routes/session"

describe("reasoningSummary", () => {
  test("extracts a leading summary title and leaves markdown body", () => {
    expect(reasoningSummary("**Continuing Quality Review**\n\nDetails.\n\n**Next section**\n\nMore.")).toEqual({
      title: "Continuing Quality Review",
      body: "Details.\n\n**Next section**\n\nMore.",
    })
  })

  test("extracts a completed title before its streamed body arrives", () => {
    expect(reasoningSummary("**Continuing Quality Review**")).toEqual({
      title: "Continuing Quality Review",
      body: "",
    })
  })

  test("preserves markdown-significant indentation in the extracted body", () => {
    expect(reasoningSummary("**Continuing Quality Review**\n\n    const value = true\n")).toEqual({
      title: "Continuing Quality Review",
      body: "    const value = true",
    })
  })

  test("does not consume ordinary leading bold content", () => {
    expect(reasoningSummary("**Important:** keep this in the body.")).toEqual({
      title: null,
      body: "**Important:** keep this in the body.",
    })
  })

  test("leaves content without a leading title in its body", () => {
    expect(reasoningSummary("Details only.")).toEqual({ title: null, body: "Details only." })
  })
})

describe("isAnswerBoundary", () => {
  test("marks the first visible answer after visible reasoning", () => {
    const parts = [reasoning("Thinking"), text(""), text("Answer")] satisfies Part[]

    expect(isAnswerBoundary(parts, 0)).toBe(false)
    expect(isAnswerBoundary(parts, 1)).toBe(false)
    expect(isAnswerBoundary(parts, 2)).toBe(true)
  })

  test("ignores empty and redacted reasoning", () => {
    const parts = [reasoning("[REDACTED]"), text("Answer")] satisfies Part[]

    expect(isAnswerBoundary(parts, 1)).toBe(false)
  })

  test("ignores reasoning made entirely of multiple redacted markers", () => {
    const parts = [reasoning("[REDACTED] [REDACTED]"), text("Answer")] satisfies Part[]

    expect(isAnswerBoundary(parts, 1)).toBe(false)
  })
})

function text(value: string): Extract<Part, { type: "text" }> {
  return {
    id: "text",
    sessionID: "session",
    messageID: "message",
    type: "text",
    text: value,
  }
}

function reasoning(value: string): Extract<Part, { type: "reasoning" }> {
  return {
    id: "reasoning",
    sessionID: "session",
    messageID: "message",
    type: "reasoning",
    text: value,
    time: { start: 0 },
  }
}
