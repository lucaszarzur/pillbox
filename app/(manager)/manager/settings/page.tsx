import { getSettingsData } from "./actions"
import SettingsClient from "./SettingsClient"

export default async function SettingsPage() {
  const data = await getSettingsData()
  return <SettingsClient data={data} />
}
