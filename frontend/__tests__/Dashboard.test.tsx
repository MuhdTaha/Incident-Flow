import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import IncidentDashboard from '@/app/page'
import { authFetch } from '@/lib/api'
import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    pathname: '/',
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// 1. Mock the API module
jest.mock('@/lib/api', () => ({
  authFetch: jest.fn(),
}))

// 2. Mock Child Components (Optional but recommended for complex pages)
// Sometimes UserNav or Stats cards are too complex for a page test. 
// You can mock them to simplify the test.
jest.mock('@/app/components/UserNav', () => () => <div data-testid="user-nav">UserNav</div>)
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', app_metadata: { role: 'ENGINEER' } } }),
}))
jest.mock('@/context/UserContext', () => ({
  useUserDirectory: () => ({ users: [], userMap: {}, loading: false, refreshUsers: jest.fn() }),
}))
jest.mock('@/app/components/IncidentFilters', () => ({
  IncidentFilters: ({ setFilters }: { setFilters: (next: any) => void }) => (
    <input
      placeholder="Search..."
      onChange={(e) =>
        setFilters({
          severities: [],
          statuses: [],
          assigneeId: null,
          search: e.target.value,
        })
      }
    />
  ),
}))

const mockIncidents = [
  {
    id: '123',
    title: 'Database Latency Spike',
    severity: 'SEV1',
    status: 'INVESTIGATING',
    owner_id: 'user-1',
    updated_at: new Date().toISOString()
  },
  {
    id: '456',
    title: 'Minor UI Glitch',
    severity: 'SEV3',
    status: 'RESOLVED',
    owner_id: 'user-2',
    updated_at: new Date().toISOString()
  }
]

describe('IncidentDashboard', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (authFetch as jest.Mock).mockClear()
  })

  it('renders the loading state initially', () => {
    // Mock a promise that never resolves immediately to test loading state
    (authFetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    
    render(<IncidentDashboard />)
    
    // Check for static elements
    expect(screen.getByText('IncidentFlow')).toBeInTheDocument()
  })

  it('fetches and displays incidents', async () => {
    // Setup the mock response
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockIncidents,
    })

    render(<IncidentDashboard />)

    // USE "findBy" for async elements (it waits for them to appear)
    const incidentTitle = await screen.findByText('Database Latency Spike')
    expect(incidentTitle).toBeInTheDocument()

    // Check if SEV1 badge is rendered
    expect(screen.getByText('SEV1')).toBeInTheDocument()
    
    // Check if the mock API was actually called
    expect(authFetch).toHaveBeenCalledWith('/incidents')
  })

  it('filters incidents when searching', async () => {
    (authFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockIncidents,
    })

    render(<IncidentDashboard />)

    // Wait for data to load
    await screen.findByText('Database Latency Spike')

    // Find search input (assuming you have an input with placeholder "Search...")
    const searchInput = screen.getByPlaceholderText(/search/i)
    
    // Type into the search box
    fireEvent.change(searchInput, { target: { value: 'Glitch' } })

    // "Database Latency Spike" should disappear
    expect(screen.queryByText('Database Latency Spike')).not.toBeInTheDocument()
    
    // "Minor UI Glitch" should remain
    expect(screen.getByText('Minor UI Glitch')).toBeInTheDocument()
  })
})