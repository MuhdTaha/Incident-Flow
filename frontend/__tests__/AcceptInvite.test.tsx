import type { ReactNode } from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import AcceptInvitePage from "@/app/invite/page"
import { supabase } from "@/lib/supabase"

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      signOut: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}))

jest.mock("@/lib/api", () => ({
  authFetch: jest.fn(),
  getApiUrl: () => "http://localhost:8000/api/v1",
}))

jest.mock("@/lib/auth-redirect", () => {
  const actual = jest.requireActual("@/lib/auth-redirect")
  return {
    ...actual,
    fetchCurrentProfile: jest.fn().mockResolvedValue({ invite_pending: true }),
  }
})

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "invitee@company.com", user_metadata: {} },
    loading: false,
  }),
}))

jest.mock("@/app/components/auth/AuthShell", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/app/components/auth/PasswordField", () => ({
  PasswordField: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="Password" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

const mockAuth = supabase.auth as unknown as {
  getSession: jest.Mock
  setSession: jest.Mock
  signOut: jest.Mock
}

function jwtWithEmail(email: string): string {
  const payload = btoa(JSON.stringify({ email }))
  return `header.${payload}.sig`
}

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.setSession.mockResolvedValue({ error: null })
    mockAuth.signOut.mockResolvedValue({})
  })

  it("asks to switch accounts when an invite is for a different email", async () => {
    const access = jwtWithEmail("invitee@company.com")
    window.history.replaceState({}, "", `/invite#access_token=${access}&refresh_token=refresh`)
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { email: "admin@company.com" }, access_token: "old" } },
    })

    render(<AcceptInvitePage />)

    expect(
      await screen.findByText("This invite is for a different account"),
    ).toBeInTheDocument()
    expect(screen.getByText("admin@company.com")).toBeInTheDocument()
    expect(screen.getByText("invitee@company.com")).toBeInTheDocument()
    expect(mockAuth.setSession).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: /Continue as invitee@company.com/ }))

    await waitFor(() => {
      expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" })
      expect(mockAuth.setSession).toHaveBeenCalled()
    })
  })
})
