import { getConfirmations } from "./actions"
import ConfirmationsClient from "./ConfirmationsClient"

export default async function ConfirmationsPage() {
  const confirmations = await getConfirmations()
  return <ConfirmationsClient initial={confirmations} />
}
