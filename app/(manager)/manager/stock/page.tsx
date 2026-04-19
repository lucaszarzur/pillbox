import { getStockOverview } from "./actions"
import StockClient from "./StockClient"

export default async function StockPage() {
  const medications = await getStockOverview()
  return <StockClient medications={medications} />
}
