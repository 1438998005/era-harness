import type { BannerCardData } from "@shared/cline/banner"
import type { Controller } from "@/core/controller"

/**
 * era harness 减法：远端横幅（从 cline.bot 拉取的公告 / 推广 / 新版本提示）已移除。
 *
 * 保留同类静态 API（Controller 与 AuthService 仍在调用），但恒返回空列表、
 * 不产生任何网络请求。webview 侧对应组件在批次 4 一并清理。
 */
export class BannerService {
	private static instance: BannerService | null = null

	public static initialize(_controller: Controller): void {
		BannerService.get()
	}

	public static get(): BannerService {
		if (!BannerService.instance) {
			BannerService.instance = new BannerService()
		}
		return BannerService.instance
	}

	/** 当前生效的横幅（本地版恒为空） */
	public getActiveBanners(): BannerCardData[] {
		return []
	}

	/** 欢迎页横幅（本地版恒为空） */
	public getWelcomeBanners(): BannerCardData[] {
		return []
	}

	/** 用户关闭横幅（本地版无横幅可关，no-op） */
	public async dismissBanner(_bannerId: string): Promise<void> {
		// no-op
	}

	/** 横幅事件上报（本地版不上报，no-op） */
	public async sendBannerEvent(_bannerId: string, _eventType: string): Promise<void> {
		// no-op
	}

	/** 账号状态变化时的刷新钩子（本地版无账号体系，no-op） */
	public static async onAuthUpdate(_userId: string | null): Promise<void> {
		// no-op
	}

	public dispose(): void {
		BannerService.instance = null
	}
}
