import type { ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateIncidentModal from '@/app/components/CreateIncidentModal'
import { authFetch } from '@/lib/api'

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', app_metadata: { role: 'ENGINEER' } } }),
}))

jest.mock('@/context/UserContext', () => ({
  useUserDirectory: () => ({
    users: [
      { id: 'user-1', full_name: 'Ada Lovelace' },
      { id: 'user-2', full_name: 'Grace Hopper' },
    ],
  }),
}))

jest.mock('@/lib/api', () => ({
  authFetch: jest.fn(),
}))

const mockAuthFetch = authFetch as jest.Mock

describe('CreateIncidentModal', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset()
    jest.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    ;(window.alert as jest.Mock).mockRestore()
  })

  it('submits incident without owner_id when assignee is self', async () => {
    mockAuthFetch.mockResolvedValue({ ok: true })
    const onIncidentCreated = jest.fn()

    render(<CreateIncidentModal onIncidentCreated={onIncidentCreated} />)

    fireEvent.change(screen.getByLabelText('Incident Title'), { target: { value: 'CPU spike' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'High CPU usage' } })
    fireEvent.change(screen.getByLabelText('Severity Level'), { target: { value: 'SEV2' } })
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'user-1' } })

    const submitButtons = screen.getAllByRole('button', { name: 'Declare Incident' })
    fireEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalled()
    })

    const [, options] = mockAuthFetch.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(payload).toEqual({
      title: 'CPU spike',
      description: 'High CPU usage',
      severity: 'SEV2',
    })

    expect(onIncidentCreated).toHaveBeenCalled()
  })

  it('shows a permission alert on 403', async () => {
    mockAuthFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })

    render(<CreateIncidentModal onIncidentCreated={jest.fn()} />)

    fireEvent.change(screen.getByLabelText('Incident Title'), { target: { value: 'DB outage' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Primary DB down' } })
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'user-2' } })

    const submitButtons = screen.getAllByRole('button', { name: 'Declare Incident' })
    fireEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'You do not have permission to create an incident assigned to another user.'
      )
    })
  })
})
