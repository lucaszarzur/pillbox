import { getQuotationPageData } from "./actions"
import QuotationClient from "./QuotationClient"

export default async function QuotationPage() {
  const data = await getQuotationPageData()
  return <QuotationClient data={data} />
}
