import { getPurchasePageData } from "./actions"
import PurchasesClient from "./PurchasesClient"

export default async function PurchasesPage() {
  const data = await getPurchasePageData()
  return <PurchasesClient data={data} />
}
