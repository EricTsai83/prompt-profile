/** An IANA time zone Intl accepts (any other value makes every date formatter throw). */
export const isTimeZone = (zone: string): boolean => {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone !== ""
  } catch {
    return false
  }
}
