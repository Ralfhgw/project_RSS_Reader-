const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" })

function getRelativeUnit(seconds: number) {
  const absSeconds = Math.abs(seconds)

  if (absSeconds < 60) {
    return { value: seconds, unit: "second" as const }
  }

  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) {
    return { value: minutes, unit: "minute" as const }
  }

  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) {
    return { value: hours, unit: "hour" as const }
  }

  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) {
    return { value: days, unit: "day" as const }
  }

  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) {
    return { value: months, unit: "month" as const }
  }

  const years = Math.round(days / 365)
  return { value: years, unit: "year" as const }
}

export function formatDistanceFromNow(value: string) {
  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return "vor kurzem"
  }

  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const relative = getRelativeUnit(seconds)
  return rtf.format(relative.value, relative.unit)
}
