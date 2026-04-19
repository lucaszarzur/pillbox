import { getReportData } from "./actions"
import ReportClient from "./ReportClient"

export default async function ReportPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const data = await getReportData(year, month)

  return <ReportClient initialData={data} initialYear={year} initialMonth={month} />
}
