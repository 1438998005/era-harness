import type { UserOrganization } from "@shared/proto/cline/account"
import type React from "react"
import { createContext, useContext, useMemo } from "react"

/**
 * era harness 本地版：无账号体系、无登录。
 *
 * 保留同名 Context 与 hooks（大量组件引用），但恒为"未登录"状态，
 * 且不发起任何 auth 订阅 / RPC 请求。
 */
export interface ClineUser {
	uid: string
	email?: string
	displayName?: string
	photoUrl?: string
	appBaseUrl?: string
}

export interface ClineAuthContextType {
	clineUser: ClineUser | null
	organizations: UserOrganization[] | null
	activeOrganization: UserOrganization | null
}

export const ClineAuthContext = createContext<ClineAuthContextType | undefined>(undefined)

export const ClineAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const value = useMemo<ClineAuthContextType>(
		() => ({
			clineUser: null,
			organizations: null,
			activeOrganization: null,
		}),
		[],
	)

	return <ClineAuthContext.Provider value={value}>{children}</ClineAuthContext.Provider>
}

export const useClineAuth = () => {
	const context = useContext(ClineAuthContext)
	if (context === undefined) {
		throw new Error("useClineAuth must be used within a ClineAuthProvider")
	}
	return context
}

/** 本地版不支持登录：保留 hook 形态，调用为空操作。 */
export const useClineSignIn = () => {
	return {
		isLoginLoading: false,
		handleSignIn: () => {
			console.warn("era harness 本地版不提供账号登录")
		},
	}
}

export const handleSignOut = async () => {
	// 本地版无账号可登出
}
