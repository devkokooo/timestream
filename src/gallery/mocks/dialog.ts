import { getScenario, neverResolves, SPECIMEN_ERROR } from "../scenario";

export async function open(_options?: Record<string, unknown>): Promise<string | string[] | null> {
  const scenario = getScenario();
  if (scenario === "loading") return neverResolves();
  if (scenario === "error") throw new Error(SPECIMEN_ERROR);
  if (scenario === "empty") return null;
  return "/archives/timestream";
}
