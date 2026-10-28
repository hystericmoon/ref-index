/** Alt text and card names for screenshots: app name plus screen types, e.g. "Revolut, paywall screen". */
export function screenAlt(appName: string, screenTypes: string[]) {
  return screenTypes.length ? `${appName}, ${screenTypes.join(" and ").toLowerCase()} screen` : `${appName} screen`;
}
