import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import IncidentHistory from '@/app/components/IncidentHistory'
import { authFetch } from '@/lib/api'

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

jest.mock('../app/components/AttachmentManager', () => () => (
  <div data-testid="attachment-manager" />
))

jest.mock('@/lib/api', () => ({
  authFetch: jest.fn(),
}))

const mockAuthFetch = authFetch as jest.Mock

const baseProps = {
  incidentId: 'inc-1',
  incidentTitle: 'DB outage',
  incidentDescription: 'Primary DB down',
  incidentSeverity: 'SEV1',
  isOpen: true,
  onClose: jest.fn(),
}

describe('IncidentHistory', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset()
  })

  it('renders events from the API', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'event-1',
          event_type: 'STATUS_CHANGE',
          old_value: 'DETECTED',
          new_value: 'INVESTIGATING',
          comment: 'Investigating',
          created_at: new Date().toISOString(),
          actor_id: 'user-1',
        },
      ],
    })

    render(<IncidentHistory {...baseProps} />)

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(`/incidents/${baseProps.incidentId}/events`)
    })

    expect(await screen.findByText('Investigating')).toBeInTheDocument()
    expect(screen.getByText('Status Update')).toBeInTheDocument()
  })

  it('renders empty state when no events', async () => {
    mockAuthFetch.mockResolvedValue({ ok: true, json: async () => [] })

    render(<IncidentHistory {...baseProps} />)

    expect(await screen.findByText('No history events found.')).toBeInTheDocument()
  })
})
