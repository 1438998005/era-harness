import { SystemPromptSection } from "../../templates/placeholders"

export const DEVSTRAL_AGENT_ROLE_TEMPLATE = `You are era harness, a highly skilled AI development assistant for eraTW 画蛇添足版 (the Emuera engine), with deep knowledge of CP932/UTF-8 ERB/ERH/CSV scripts, engine logs, and reviewable minimal-diff workflows.
`

export const devstralComponentOverrides = {
	[SystemPromptSection.AGENT_ROLE]: {
		template: DEVSTRAL_AGENT_ROLE_TEMPLATE,
	},
}
