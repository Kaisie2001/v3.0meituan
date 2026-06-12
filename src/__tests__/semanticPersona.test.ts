import { describe, expect, it } from "vitest";
import { parseInput } from "@/lib/parseIntent";
import { buildSemanticProfile } from "@/lib/semanticHash";
import { getPersonaConfig, inferPersona, type PersonaType } from "@/lib/persona";

function expectPersona(goal: string, expected: PersonaType) {
  const parseResult = parseInput(goal);
  expect(inferPersona(parseResult)).toBe(expected);
}

describe("semanticPersona", () => {
  it('recognizes friends/social tendency for "朋友吃饭聊天"', () => {
    expectPersona("晚上和朋友吃饭，吃完想找地方聊天", "friends");
    const config = getPersonaConfig(parseInput("朋友聚会吃饭聊天"));
    expect(config.tags.join(" ")).toMatch(/聊天|晚饭|朋友|聚会/);
  });

  it('recognizes family/parent-child tendency for "带孩子出去玩"', () => {
    expectPersona("周末下午带孩子出去玩3小时，别太累", "family");
    const config = getPersonaConfig(parseInput("带孩子出去玩"));
    expect(config.tags.join(" ")).toMatch(/亲子|孩子|家庭|少转场/);
  });

  it('recognizes work/quiet tendency for "准备面试，找安静地方"', () => {
    expectPersona("我下午要准备面试，想找个安静能坐两小时的地方", "work");
    const config = getPersonaConfig(parseInput("准备面试，找安静地方"));
    expect(config.tags.join(" ")).toMatch(/安静|插座|久坐|学习/);
  });

  it("builds semantic profile without throwing for arbitrary text", () => {
    const profile = buildSemanticProfile("朋友吃饭聊天");
    expect(profile.seed).toBeTypeOf("number");
    expect(profile.dims.quietPreference).toBeGreaterThanOrEqual(0);
    expect(profile.dims.quietPreference).toBeLessThanOrEqual(1);
  });

  it("returns fallback persona for empty input without throwing", () => {
    expect(() => parseInput("")).not.toThrow();
    expect(() => buildSemanticProfile("")).not.toThrow();

    const parseResult = parseInput("");
    const persona = inferPersona(parseResult);
    expect(["friends", "family", "date", "work", "errand", "casual"]).toContain(persona);

    const config = getPersonaConfig(parseResult);
    expect(config.label.trim().length).toBeGreaterThan(0);
    expect(config.planTitle.trim().length).toBeGreaterThan(0);
    expect(config.tags.length).toBeGreaterThan(0);
  });
});
