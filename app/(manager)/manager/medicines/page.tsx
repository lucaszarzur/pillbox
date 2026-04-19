import { getMedicines } from "./actions"
import MedicinesClient from "./MedicinesClient"

export default async function MedicinesPage() {
  const medicines = await getMedicines()
  return <MedicinesClient medicines={medicines} />
}
