/** Hand-declared §30.2 inputs. Exported answers always contain full semantic IDs. */
export const GOLDEN_GENERATED_AT = "2026-10-06T00:00:00.000Z";
export const GOLDEN_SCAN_VERSION = "advantage-scan-v1.1";
export type FixtureAnswer = { questionId: string; optionId: string };
type Vector = readonly string[];
const defaults = ["investigative", "investigative", "realistic", "artistic", "social", "social", "investigate", "structure", "create", "execute", "independence", "independence", "achievement", "none"];
const uncertain = [...Array<string>(13).fill("uncertain"), "none"];
const repeatedResearch = ["investigative", "investigative", "uncertain", "investigative", "investigative", "uncertain"];
const dualInterests = ["investigative", "artistic", "realistic", "artistic", "investigative", "social"];
const dualBehavior = ["investigate", "structure", "investigate", "structure"];
const strongBehavior = ["investigate", "investigate", "investigate", "structure"];
const handsInterests = ["realistic", "investigative", "realistic", "realistic", "conventional", "realistic"];
const creativeInterests = ["artistic", "artistic", "realistic", "artistic", "investigative", "artistic"];
const pairedInterests = ["investigative", "conventional", "realistic", "investigative", "conventional", "social"];
export type BaziCase = "unavailable" | "influence" | "caution" | "not_established" | "other_task" | "overseas" | "time_sensitive_creative" | "structure" | "hands" | "creative" | "influence_research";
export type GoldenAnswers = { id: string; status: "completed" | "skipped"; scanVersion: typeof GOLDEN_SCAN_VERSION; answers: FixtureAnswer[]; followupAnswers: FixtureAnswer[]; endedByUser: boolean; baziCase: BaziCase; generatedAt: string };
function fullAnswers(vector: Vector): FixtureAnswer[] {
  return vector.map((suffix, i) => ({ questionId: `Q${i + 1}`, optionId: `Q${i + 1}.${suffix}` }));
}
export function replaceAnswers(answers: readonly FixtureAnswer[], replacements: Record<string, string>): FixtureAnswer[] {
  return answers.map(a => ({ questionId: a.questionId, optionId: replacements[a.questionId] ?? a.optionId }));
}
function vector(base: Vector, interests?: Vector, behavior?: Vector, values?: Vector, recent?: string): string[] {
  return [...(interests ?? base.slice(0, 6)), ...(behavior ?? base.slice(6, 10)), ...(values ?? base.slice(10, 13)), recent ?? base[13]];
}
function fixture(id: string, input: Vector, followups: string[] = [], baziCase: BaziCase = "unavailable", endedByUser = false): GoldenAnswers {
  return { id, status: "completed", scanVersion: GOLDEN_SCAN_VERSION, answers: fullAnswers(input), followupAnswers: followups.map(optionId => ({ questionId: optionId.split(".")[0], optionId })), endedByUser, baziCase, generatedAt: GOLDEN_GENERATED_AT };
}
const g01 = vector(defaults, repeatedResearch, strongBehavior, undefined, "investigate");
const g03 = vector(defaults, dualInterests, dualBehavior);
const g06 = vector(defaults, handsInterests, Array<string>(4).fill("uncertain"), undefined, "hands_on");
const g09 = vector(defaults, undefined, strongBehavior);
const g21 = vector(defaults, pairedInterests, dualBehavior);
const g27 = vector(defaults, ["investigative", "enterprising", "realistic", "artistic", "social", "social"], strongBehavior);
export const GOLDEN_ANSWERS: GoldenAnswers[] = [
  fixture("G01", g01),
  fixture("G02", vector(defaults, undefined, dualBehavior), ["FB-IS.investigate"]),
  fixture("G03", g03, ["FB-IS.uncertain", "FI-IA.artistic"]),
  fixture("G04", uncertain),
  fixture("G05", vector(defaults, undefined, undefined, undefined, "structure")),
  fixture("G06", g06),
  fixture("G07", vector(defaults, Array<string>(6).fill("uncertain"), Array<string>(4).fill("investigate"), undefined, "investigate")),
  fixture("G08", vector(defaults, repeatedResearch, dualBehavior), ["FB-IS.uncertain"], "influence"),
  fixture("G09", g09, [], "caution"),
  fixture("G10", g09, [], "not_established"),
  fixture("G11", g09, [], "other_task"),
  fixture("G12", g09, [], "overseas"),
  fixture("G13", uncertain, [], "time_sensitive_creative"),
  fixture("G14", vector(defaults, undefined, undefined, undefined, "structure"), [], "structure"),
  fixture("G15", g06, [], "hands"),
  fixture("G16", vector(g03, undefined, undefined, Array<string>(3).fill("uncertain")), ["FB-IS.structure", "FI-IA.investigative"]),
  fixture("G17", vector(defaults, Array<string>(6).fill("uncertain"), dualBehavior), ["FB-IS.structure"]),
  fixture("G18", vector(defaults, creativeInterests, strongBehavior)),
  fixture("G19", vector(g09, undefined, undefined, undefined, "create")),
  fixture("G20", vector(uncertain, undefined, undefined, undefined, "execute_influence")),
  fixture("G21", g21, ["FB-IS.investigate", "FI-IC.conventional"]),
  fixture("G22", g21, ["FB-IS.investigate", "FI-IC.investigative"]),
  fixture("G23", g21, ["FB-IS.uncertain", "FI-IC.conventional"]),
  fixture("G24", vector(defaults, undefined, undefined, ["independence", "relationships", "recognition"])),
  fixture("G25", vector(uncertain, undefined, ["investigate", "investigate", "investigate", "uncertain"])),
  fixture("G26", g03, ["FB-IS.uncertain"], "unavailable", true),
  fixture("G27", g27, [], "influence"),
  fixture("G28", vector(uncertain, undefined, strongBehavior, undefined, "create"), [], "creative"),
  fixture("G29", g27, [], "influence_research"),
  fixture("G30", vector(uncertain, undefined, ["investigate", "uncertain", "uncertain", "uncertain"])),
  fixture("G31", vector(uncertain, ["investigative", "investigative", "uncertain", "uncertain", "uncertain", "uncertain"])),
  fixture("G32", vector(uncertain, undefined, undefined, undefined, "hands_on")),
  fixture("G33", vector(uncertain, ["investigative", "uncertain", "uncertain", "uncertain", "uncertain", "uncertain"], ["investigate", "uncertain", "uncertain", "uncertain"])),
  fixture("G34", vector(uncertain, ["artistic", "uncertain", "uncertain", "uncertain", "uncertain", "uncertain"]), [], "creative"),
  fixture("G35", vector(defaults, ["investigative", "conventional", "social", "artistic", "investigative", "realistic"], ["investigate", "structure", "create", "collaborate"], undefined, "hands_on")),
  fixture("G36", uncertain),
  { ...fixture("G37", []), status: "skipped" },
  fixture("G38", vector(uncertain, undefined, undefined, defaults.slice(10, 13))),
  fixture("G39", vector(uncertain, undefined, ["execute", "uncertain", "uncertain", "uncertain"], undefined, "execute_influence")),
  fixture("G40", vector(uncertain, ["realistic", "uncertain", "uncertain", "uncertain", "uncertain", "uncertain"], undefined, undefined, "hands_on")),
];
export function goldenAnswers(id: string): GoldenAnswers {
  const value = GOLDEN_ANSWERS.find(f => f.id === id);
  if (!value) throw new Error(`Unknown golden ${id}`);
  return structuredClone(value);
}
