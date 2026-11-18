import { describe, expect, it } from 'vitest'

import { describeDevice, isMobileUserAgent } from '../user-agent'

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/126.0.0.0`
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'

describe('describeDevice', () => {
  it('names the browser and system', () => {
    expect(describeDevice(CHROME_WINDOWS)).toBe('Chrome on Windows')
    expect(describeDevice(SAFARI_IPHONE)).toBe('Safari on iOS')
    expect(describeDevice(FIREFOX_LINUX)).toBe('Firefox on Linux')
  })

  it('prefers the specific browser over the engines it also claims to be', () => {
    expect(describeDevice(EDGE_WINDOWS)).toBe('Edge on Windows')
  })

  it('reads Android before Linux', () => {
    expect(describeDevice(CHROME_ANDROID)).toBe('Chrome on Android')
  })

  it('falls back when nothing is recognised', () => {
    expect(describeDevice('curl/8.0')).toBe('Unknown device')
    expect(describeDevice('')).toBe('Unknown device')
    expect(describeDevice(null)).toBe('Unknown device')
    expect(describeDevice(undefined)).toBe('Unknown device')
  })
})

describe('isMobileUserAgent', () => {
  it('detects phones', () => {
    expect(isMobileUserAgent(SAFARI_IPHONE)).toBe(true)
    expect(isMobileUserAgent(CHROME_ANDROID)).toBe(true)
  })

  it('treats desktops and missing values as not mobile', () => {
    expect(isMobileUserAgent(CHROME_WINDOWS)).toBe(false)
    expect(isMobileUserAgent(null)).toBe(false)
  })
})
