import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IncidentFilters, type FilterState } from '@/app/components/IncidentFilters'

jest.mock('@/context/UserContext', () => ({
  useUserDirectory: () => ({
    users: [
      { id: 'user-1', full_name: 'Ada Lovelace' },
      { id: 'user-2', full_name: 'Grace Hopper' },
    ],
  }),
}))

function Wrapper({ initial }: { initial: FilterState }) {
  const [filters, setFilters] = React.useState<FilterState>(initial)
  return (
    <div>
      <IncidentFilters filters={filters} setFilters={setFilters} />
      <div data-testid="filters-state">{JSON.stringify(filters)}</div>
    </div>
  )
}

const baseFilters: FilterState = {
  severities: [],
  statuses: [],
  assigneeId: null,
  search: '',
}

describe('IncidentFilters', () => {
  it('updates search input', () => {
    render(<Wrapper initial={baseFilters} />)

    const input = screen.getByPlaceholderText('Search by title or ID...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'db' } })

    expect(input.value).toBe('db')
  })

  it('toggles severity and clears filters', () => {
    render(<Wrapper initial={baseFilters} />)

    const sev1Button = screen.getByRole('button', { name: 'SEV1' })
    fireEvent.click(sev1Button)

    expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
    expect(screen.queryByRole('button', { name: 'Clear All' })).not.toBeInTheDocument()
  })

  it('updates assignee selection', () => {
    render(<Wrapper initial={baseFilters} />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'user-2' } })

    expect(select.value).toBe('user-2')
  })
})
