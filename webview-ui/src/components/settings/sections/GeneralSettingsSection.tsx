import PreferredLanguageSetting from "../PreferredLanguageSetting"
import Section from "../Section"

interface GeneralSettingsSectionProps {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

/**
 * 通用设置。
 *
 * era harness 是纯本地插件：没有账号、没有遥测上报，所以这里只留界面语言。
 */
const GeneralSettingsSection = ({ renderSectionHeader }: GeneralSettingsSectionProps) => {
	return (
		<div>
			{renderSectionHeader("general")}
			<Section>
				<PreferredLanguageSetting />
			</Section>
		</div>
	)
}

export default GeneralSettingsSection
