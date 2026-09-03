import {
  consumeOpenInviteFlag,
  decodeJwtEmail,
  markOpenInviteDialog,
  OPEN_INVITE_FLAG,
  peekAuthCode,
  peekAuthTokens,
  stripAuthParamsFromUrl,
} from "@/lib/auth-redirect"

function jwtWithEmail(email: string): string {
  const payload = btoa(JSON.stringify({ email }))
  return `header.${payload}.sig`
}

describe("auth-redirect", () => {
  const originalLocation = window.location

  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState({}, "", "/invite")
  })

  afterAll(() => {
    window.history.replaceState({}, "", originalLocation.pathname)
  })

  it("decodes an email from a JWT payload", () => {
    expect(decodeJwtEmail(jwtWithEmail("invitee@company.com"))).toBe("invitee@company.com")
    expect(decodeJwtEmail("not-a-jwt")).toBeNull()
  })

  it("reads access tokens from the URL hash", () => {
    window.history.replaceState({}, "", "/invite#access_token=aaa&refresh_token=bbb&type=invite")
    expect(peekAuthTokens()).toEqual({ access_token: "aaa", refresh_token: "bbb" })
  })

  it("reads a PKCE code from the query string", () => {
    window.history.replaceState({}, "", "/invite?code=xyz")
    expect(peekAuthCode()).toBe("xyz")
  })

  it("strips auth params from the URL", () => {
    window.history.replaceState({}, "", "/invite?code=xyz#access_token=aaa")
    stripAuthParamsFromUrl()
    expect(window.location.search).toBe("")
    expect(window.location.hash).toBe("")
    expect(window.location.pathname).toBe("/invite")
  })

  it("stores and consumes the post-org invite flag", () => {
    markOpenInviteDialog()
    expect(sessionStorage.getItem(OPEN_INVITE_FLAG)).toBe("1")
    expect(consumeOpenInviteFlag()).toBe(true)
    expect(consumeOpenInviteFlag()).toBe(false)
  })

  it("treats ?invite=1 as an invite flag", () => {
    window.history.replaceState({}, "", "/?invite=1")
    expect(consumeOpenInviteFlag()).toBe(true)
    expect(sessionStorage.getItem(OPEN_INVITE_FLAG)).toBeNull()
  })
})
