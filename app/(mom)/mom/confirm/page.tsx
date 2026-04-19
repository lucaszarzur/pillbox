import { getMedsForConfirmation } from "./actions"
import ConfirmClient from "./ConfirmClient"

export default async function ConfirmPage() {
  const medications = await getMedsForConfirmation()
  return <ConfirmClient medications={medications} />
}
