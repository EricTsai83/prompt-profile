import { chromium } from "playwright"

/** Use the lockfile's Chromium in local checks and CI, independent of installed Chrome. */
export const launchReportBrowser = () => chromium.launch()
