// SkillWeave public API — the surface SigMap (and other hosts) import to embed
// the runtime in-process. v0.8.0: SkillWeave as SigMap's execution architecture.

export { runSigMapVerify, sigmapVerifyPipeline } from "./sigmap-verify.js";
export type { VerifyOptions, VerifyResult } from "./sigmap-verify.js";
export { runPipeline } from "./orchestrator.js";
export type { RunOutcome } from "./orchestrator.js";
export { getSkill, listSkills, SKILLS } from "./registry.js";
export { loadPipeline, validatePipelineFile, PipelineError } from "./pipeline-loader.js";
export * from "./types.js";
export * from "./security/index.js";
export * from "./adapters/index.js";
export * from "./catalog/index.js";
export * from "./dx/index.js";
export { VERSION } from "./version.js";
