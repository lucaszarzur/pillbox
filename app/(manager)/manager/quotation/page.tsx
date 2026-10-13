import { getQuotationPageData } from "./actions"
import { getAutoQuoteData, getBestBuyData } from "./bestBuyActions"
import QuotationClient from "./QuotationClient"

export default async function QuotationPage() {
  const [data, bestBuy, autoQuote] = await Promise.all([getQuotationPageData(), getBestBuyData(), getAutoQuoteData()])
  return <QuotationClient data={data} bestBuy={bestBuy} autoQuote={autoQuote} />
}
