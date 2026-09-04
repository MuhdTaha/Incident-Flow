import type { ReactNode } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import DeleteOrgDialog from "@/app/components/DeleteOrgDialog"
import { authFetch } from "@/lib/api"

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/lib/api", () => ({
  authFetch: jest.fn(),
}))

const mockAuthFetch = authFetch as jest.Mock

describe("DeleteOrgDialog", () => {
  beforeEach(() => {
    mockAuthFetch.mockReset()
  })

  it("keeps delete disabled until the workspace name matches", () => {
    render(
      <DeleteOrgDialog
        isOpen
        onClose={jest.fn()}
        orgName="Acme"
        onDeleted={jest.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "Delete workspace" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Acme" },
    })
    expect(screen.getByRole("button", { name: "Delete workspace" })).toBeEnabled()
  })

  it("deletes the workspace and signs the admin out", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Workspace deleted" }),
    })
    const onDeleted = jest.fn()

    render(
      <DeleteOrgDialog
        isOpen
        onClose={jest.fn()}
        orgName="Acme"
        onDeleted={onDeleted}
      />,
    )

    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Acme" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }))

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith("/orgs/current", {
        method: "DELETE",
        body: JSON.stringify({ name: "Acme" }),
      })
    })
    expect(onDeleted).toHaveBeenCalled()
  })

  it("shows an API error without leaving the dialog", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "The demo workspace cannot be deleted." }),
    })
    const onDeleted = jest.fn()
    const onClose = jest.fn()

    render(
      <DeleteOrgDialog
        isOpen
        onClose={onClose}
        orgName="Acme"
        onDeleted={onDeleted}
      />,
    )

    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Acme" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }))

    expect(
      await screen.findByText("The demo workspace cannot be deleted."),
    ).toBeInTheDocument()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
