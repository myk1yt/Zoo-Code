/**
 * Minimal shell types for B06 terminal lifecycle scope.
 * These are inlined stubs replacing the reference to ./shell/types
 * that does not exist in the current codebase.
 */

export type ShellFamily = "bash" | "zsh" | "fish" | "pwsh" | "powershell" | "cmd" | "unknown"

export interface ShellInvocationPlan {
	shellPath: string
	shellArgs?: string[]
}

export interface ResolvedCommandEnvironment {
	fallbackPlan?: ShellInvocationPlan
	timeoutMs?: number
}
