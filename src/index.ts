require("dotenv").config()
import { ExtendedClient } from "./client"

export const client = new ExtendedClient()

client.start()
