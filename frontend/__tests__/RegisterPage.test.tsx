import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import RegisterPage from "@/app/register/page"
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
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}))

jest.mock("@/lib/api", () => ({
  getApiUrl: () => "http://localhost:8000/api/v1",
}))

jest.mock("@/lib/auth-redirect", () => ({
  hasWorkspace: jest.fn().mockResolvedValue(false),
  markOpenInviteDialog: jest.fn(),
  peekAuthCode: jest.fn().mockReturnValue(null),
  peekAuthTokens: jest.fn().mockReturnValue(null),
  stripAuthParamsFromUrl: jest.fn(),
}))

jest.mock("@/app/components/auth/AuthShell", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/app/components/auth/OnboardingStepper", () => ({
  OnboardingStepper: () => null,
}))

jest.mock("@/app/components/auth/PasswordField", () => ({
  PasswordField: () => <input aria-label="Password" />,
}))

const mockGetSession = supabase.auth.getSession as jest.Mock

describe("RegisterPage", () => {
  it("tells an unverified user to continue from the email link", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: "tok",
          user: { email: "alex@company.com", email_confirmed_at: null },
        },
      },
    })

    render(<RegisterPage />)

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument()
    expect(screen.getByText(/alex@company.com/)).toBeInTheDocument()
    expect(
      screen.getByText(/Open that link to continue setting up your workspace/),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /I've confirmed my email/i })).not.toBeInTheDocument()
  })
})
