import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InviteUsersDialog from '@/app/components/InviteUsersDialog'
import { authFetch } from '@/lib/api'

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/select', () => {
  const React = require('react')
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string
      onValueChange: (value: string) => void
      children: ReactNode
    }) => (
      <select
        aria-label="Role"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  }
})

jest.mock('@/lib/api', () => ({
  authFetch: jest.fn(),
}))

const mockAuthFetch = authFetch as jest.Mock

describe('InviteUsersDialog', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset()
  })

  it('submits an invite and shows a success state so another email can be added', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Invitation sent to alex@company.com', user_id: 'user-2' }),
    })
    const onInvited = jest.fn()
    const onClose = jest.fn()

    render(<InviteUsersDialog isOpen onClose={onClose} onInvited={onInvited} />)

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'alex@company.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }))

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith('/orgs/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'alex@company.com', role: 'ENGINEER' }),
      })
    })

    expect(onInvited).toHaveBeenCalled()
    expect(screen.getByText(/Invite sent to alex@company.com/)).toBeInTheDocument()
    expect(screen.getByLabelText('Work email')).toHaveValue('')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows an API error without closing the dialog', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'A user with this email already exists' }),
    })

    render(<InviteUsersDialog isOpen onClose={jest.fn()} />)

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'dup@company.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }))

    expect(await screen.findByText('A user with this email already exists')).toBeInTheDocument()
  })
})
