import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import IncidentActionModal from '@/app/components/IncidentActionModal'
import { authFetch } from '@/lib/api'

let mockUserRole = 'ENGINEER'

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', app_metadata: { role: mockUserRole } } }),
}))

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/lib/api', () => ({
  authFetch: jest.fn(),
}))

const mockAuthFetch = authFetch as jest.Mock

const incident = {
  id: 'inc-1',
  title: 'DB outage',
  status: 'DETECTED',
  allowed_transitions: ['INVESTIGATING', 'MITIGATED'],
  owner_id: 'user-1',
}

describe('IncidentActionModal', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset()
    jest.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(window.alert as jest.Mock).mockRestore()
  })

  it('submits a transition action with default next state', async () => {
    mockUserRole = 'ENGINEER'
    mockAuthFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true })

    render(
      <IncidentActionModal
        incident={incident}
        isOpen={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    )

    const confirmButton = screen.getByRole('button', { name: 'Confirm Update' })
    await waitFor(() => expect(confirmButton).not.toBeDisabled())
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        `/incidents/${incident.id}/transition`,
        expect.objectContaining({ method: 'POST' })
      )
    })

    const transitionCall = mockAuthFetch.mock.calls.find((call) =>
      call[0].includes('/transition')
    )
    const payload = JSON.parse(transitionCall[1].body)
    expect(payload.new_state).toBe('INVESTIGATING')
  })

  it('submits a comment action', async () => {
    mockUserRole = 'ENGINEER'
    mockAuthFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true })

    render(
      <IncidentActionModal
        incident={incident}
        isOpen={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Comment' }))
    fireEvent.change(screen.getByPlaceholderText('Context for this action...'), {
      target: { value: 'Investigating now' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Update' }))

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        `/incidents/${incident.id}/comment`,
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('disables edit action for non-engineers', async () => {
    mockUserRole = 'ENGINEER'
    mockAuthFetch.mockResolvedValueOnce({ ok: true, json: async () => [] })

    render(
      <IncidentActionModal
        incident={incident}
        isOpen={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    })
  })

  it('enables edit action for managers', async () => {
    mockUserRole = 'MANAGER'
    mockAuthFetch.mockResolvedValueOnce({ ok: true, json: async () => [] })

    render(
      <IncidentActionModal
        incident={incident}
        isOpen={true}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).not.toBeDisabled()
    })
  })
})
