export type LanguageKey =
	| "en"
	| "ar"
	| "pt-BR"
	| "cs"
	| "fr"
	| "de"
	| "hi"
	| "hu"
	| "it"
	| "ja"
	| "ko"
	| "pl"
	| "pt-PT"
	| "ru"
	| "zh-CN"
	| "es"
	| "zh-TW"
	| "tr"

export type LanguageDisplay =
	| "English"
	| "Arabic - العربية"
	| "Portuguese - Português (Brasil)"
	| "Czech - Čeština"
	| "French - Français"
	| "German - Deutsch"
	| "Hindi - हिन्दी"
	| "Hungarian - Magyar"
	| "Italian - Italiano"
	| "Japanese - 日本語"
	| "Korean - 한국어"
	| "Polish - Polski"
	| "Portuguese - Português (Portugal)"
	| "Russian - Русский"
	| "Simplified Chinese - 简体中文"
	| "Spanish - Español"
	| "Traditional Chinese - 繁體中文"
	| "Turkish - Türkçe"

export const DEFAULT_LANGUAGE_SETTINGS: LanguageKey = "zh-CN"

export const languageOptions: { key: LanguageKey; display: LanguageDisplay }[] = [
	{ key: "en", display: "English" },
	{ key: "ar", display: "Arabic - العربية" },
	{ key: "pt-BR", display: "Portuguese - Português (Brasil)" },
	{ key: "cs", display: "Czech - Čeština" },
	{ key: "fr", display: "French - Français" },
	{ key: "de", display: "German - Deutsch" },
	{ key: "hi", display: "Hindi - हिन्दी" },
	{ key: "hu", display: "Hungarian - Magyar" },
	{ key: "it", display: "Italian - Italiano" },
	{ key: "ja", display: "Japanese - 日本語" },
	{ key: "ko", display: "Korean - 한국어" },
	{ key: "pl", display: "Polish - Polski" },
	{ key: "pt-PT", display: "Portuguese - Português (Portugal)" },
	{ key: "ru", display: "Russian - Русский" },
	{ key: "zh-CN", display: "Simplified Chinese - 简体中文" },
	{ key: "es", display: "Spanish - Español" },
	{ key: "zh-TW", display: "Traditional Chinese - 繁體中文" },
	{ key: "tr", display: "Turkish - Türkçe" },
]

export function getLanguageKey(display: LanguageDisplay | undefined): LanguageKey {
	if (!display) {
		return DEFAULT_LANGUAGE_SETTINGS
	}
	const languageOption = languageOptions.find((option) => option.display === display)
	if (languageOption) {
		return languageOption.key
	}
	return DEFAULT_LANGUAGE_SETTINGS
}

/**
 * 把语言 key 转成可读名（`zh-CN` → `简体中文`），用于全局记忆种子。
 * 直接存 locale code 会让用户和模型都看不懂。
 */
export function getLanguageDisplayName(key: LanguageKey): string {
	const option = languageOptions.find((item) => item.key === key)
	if (!option) {
		return key
	}

	const separator = option.display.lastIndexOf(" - ")
	return separator === -1 ? option.display : option.display.slice(separator + 3)
}
