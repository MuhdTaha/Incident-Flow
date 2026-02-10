import { getSevStyles, getStatusIcon } from '@/lib/incident-utils'

describe('getSevStyles', () => {
  it('returns red styling for SEV1', () => {
    const styles = getSevStyles('SEV1')
    expect(styles).toContain('bg-red-100')
    expect(styles).toContain('text-red-700')
  })

  it('returns orange styling for SEV2', () => {
    const styles = getSevStyles('SEV2')
    expect(styles).toContain('bg-orange-100')
    expect(styles).toContain('text-orange-700')
  })

  it('returns blue styling for SEV3', () => {
    const styles = getSevStyles('SEV3')
    expect(styles).toContain('bg-blue-100')
    expect(styles).toContain('text-blue-700')
  })
  
  it('returns slate styling for SEV4', () => {
    const styles = getSevStyles('SEV4')
    expect(styles).toContain('bg-slate-100')
    expect(styles).toContain('text-slate-700')
  })

  it('returns default styling for unknown severity', () => {
    const styles = getSevStyles('UNKNOWN')
    expect(styles).toContain('bg-slate-50')
    expect(styles).toContain('text-slate-500')
  })
})

describe('getStatusIcon', () => {
  it('returns AlertCircle for DETECTED status', () => {
    const icon = getStatusIcon('DETECTED')
    expect(icon.props.className).toContain('text-orange-500')
  })

  it('returns Activity for INVESTIGATING status', () => {
    const icon = getStatusIcon('INVESTIGATING')
    expect(icon.props.className).toContain('text-blue-500')
    expect(icon.props.className).toContain('animate-pulse')
  })

    it('returns ShieldAlert for MITIGATED status', () => {
    const icon = getStatusIcon('MITIGATED')
    expect(icon.props.className).toContain('text-green-500')
  })

  it('returns Clock for unknown status', () => {
    const icon = getStatusIcon('UNKNOWN')
    expect(icon.props.className).toContain('text-slate-400')
  })
})