import { useTranslation } from "react-i18next"
import EraLogo from "@/assets/EraLogo"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface HomeHeaderProps {
	shouldShowQuickWins?: boolean
}

const HomeHeader = ({ shouldShowQuickWins: _shouldShowQuickWins = false }: HomeHeaderProps) => {
	const { environment } = useExtensionState()
	const { t } = useTranslation("common")

	const headingText = t("homeHeader.defaultHeading")

	return (
		<div className="flex flex-col items-center mb-5">
			<div className="my-7">
				<EraLogo className="size-20 text-foreground" environment={environment} />
			</div>
			<div className="text-center flex items-center justify-center px-4">
				<h1 className="m-0 font-bold">{headingText}</h1>
			</div>
		</div>
	)
}

export default HomeHeader
