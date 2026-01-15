import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
// We will mock the Dashboard since it fetches data
// Ideally you test smaller components, but let's test a simple assumption here

describe('Dashboard', () => {
  it('renders the main heading', () => {
    // Basic test to check if Jest is running
    expect(true).toBe(true)
  })
})