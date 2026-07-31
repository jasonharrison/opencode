import { expect, test } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { RGBA, type TerminalColors } from "@opentui/core"
import {
  DEFAULT_THEMES,
  addTheme,
  allThemes,
  generateSubtleSyntax,
  hasTheme,
  resolveTheme,
  terminalMode,
} from "../src/theme"
import { discoverThemes } from "../src/context/theme"
import { tmpdir } from "./fixture/fixture"

test("addTheme writes into module theme store", () => {
  const name = `plugin-theme-${Date.now()}`
  expect(addTheme(name, DEFAULT_THEMES.opencode)).toBe(true)
  expect(allThemes()[name]).toBeDefined()
})

test("addTheme keeps first theme for duplicate names", () => {
  const name = `plugin-theme-keep-${Date.now()}`
  const one = structuredClone(DEFAULT_THEMES.opencode)
  const two = structuredClone(DEFAULT_THEMES.opencode)
  one.theme.primary = "#101010"
  two.theme.primary = "#fefefe"

  expect(addTheme(name, one)).toBe(true)
  expect(addTheme(name, two)).toBe(false)
  expect(allThemes()[name]!.theme.primary).toBe("#101010")
})

test("addTheme ignores entries without a theme object", () => {
  const name = `plugin-theme-invalid-${Date.now()}`
  expect(addTheme(name, { defs: { a: "#ffffff" } })).toBe(false)
  expect(allThemes()[name]).toBeUndefined()
})

test("hasTheme checks theme presence", () => {
  const name = `plugin-theme-has-${Date.now()}`
  expect(hasTheme(name)).toBe(false)
  expect(addTheme(name, DEFAULT_THEMES.opencode)).toBe(true)
  expect(hasTheme(name)).toBe(true)
})

test("resolveTheme rejects circular color refs", () => {
  const item = structuredClone(DEFAULT_THEMES.opencode)
  item.defs = { ...item.defs, one: "two", two: "one" }
  item.theme.primary = "one"
  expect(() => resolveTheme(item, "dark")).toThrow("Circular color reference")
})

test("resolveTheme defaults thinkingGutter to false and thinkingText to textMuted when omitted", () => {
  const resolved = resolveTheme(DEFAULT_THEMES.opencode, "dark")
  expect(resolved.thinkingGutter).toBe(false)
  expect(resolved.thinkingText).toEqual(resolved.textMuted)
  expect(resolved.thinkingGutterChar).toBe("┃")
  expect(resolved.thinkingGutterColor).toEqual(
    RGBA.fromValues(resolved.warning.r, resolved.warning.g, resolved.warning.b, 0.6),
  )
  expect(resolved.thinkingGutterColorDone).toEqual(
    RGBA.fromValues(resolved.warning.r, resolved.warning.g, resolved.warning.b, 0.6),
  )
})

test("resolveTheme honors an explicit thinkingText and thinkingGutter", () => {
  const item = structuredClone(DEFAULT_THEMES.opencode)
  item.theme.thinkingText = "#123456"
  item.theme.thinkingGutter = true
  item.theme.thinkingGutterChar = "█"
  item.theme.thinkingGutterColor = "#aabbcc"
  item.theme.thinkingGutterColorDone = "#112233"
  const resolved = resolveTheme(item, "dark")
  expect(resolved.thinkingText).toEqual(RGBA.fromHex("#123456"))
  expect(resolved.thinkingGutter).toBe(true)
  expect(resolved.thinkingGutterChar).toBe("█")
  expect(resolved.thinkingGutterColor).toEqual(RGBA.fromHex("#aabbcc"))
  expect(resolved.thinkingGutterColorDone).toEqual(RGBA.fromHex("#112233"))
})

test("high-contrast theme opts into the gutter and full-bright thinking", () => {
  const resolved = resolveTheme(DEFAULT_THEMES["high-contrast"]!, "dark")
  expect(resolved.thinkingGutter).toBe(true)
  expect(resolved.thinkingOpacity).toBe(1.0)
  expect(resolved.thinkingText).toEqual(resolved.text)
})

test("subtle syntax uses thinkingText for ordinary reasoning prose", () => {
  const item = structuredClone(DEFAULT_THEMES.opencode)
  item.theme.thinkingText = "#123456"
  const resolved = resolveTheme(item, "dark")
  const syntax = generateSubtleSyntax(resolved)

  try {
    expect(syntax.getStyle("default")?.fg).toEqual(resolved.thinkingText)
  } finally {
    syntax.destroy()
  }
})

function terminalColors(defaultBackground: string | null, palette: Array<string | null> = []): TerminalColors {
  return {
    palette,
    defaultForeground: null,
    defaultBackground,
    cursorColor: null,
    mouseForeground: null,
    mouseBackground: null,
    tekForeground: null,
    tekBackground: null,
    highlightBackground: null,
    highlightForeground: null,
  }
}

test("terminalMode derives mode from refreshed background", () => {
  expect(terminalMode(terminalColors("#fbf1c7"))).toBe("light")
  expect(terminalMode(terminalColors("#1a1b26"))).toBe("dark")
})

test("terminalMode does not derive mode from ANSI slot zero", () => {
  expect(terminalMode(terminalColors(null, ["#000000"]))).toBeUndefined()
})

test("custom theme precedence follows directory order", async () => {
  await using tmp = await tmpdir()
  const global = path.join(tmp.path, "global")
  const project = path.join(tmp.path, "project")
  await mkdir(path.join(global, "themes"), { recursive: true })
  await mkdir(path.join(project, "themes"), { recursive: true })
  await writeFile(path.join(global, "themes", "custom.json"), JSON.stringify({ source: "global" }))
  await writeFile(path.join(project, "themes", "custom.json"), JSON.stringify({ source: "project" }))

  await expect(discoverThemes([global, project])).resolves.toEqual({ custom: { source: "project" } })
})
