import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import LockNftRoutes from "./routes/LockNft.routes.js"
import LockTimeNFTRoutes from "./routes/LockTimeNFTRoutes.js"

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())



app.use("/market",LockNftRoutes)
app.use("/lockTimeNFT",LockTimeNFTRoutes)


// Read from contract (GET)
app.get("/",async (req,res) => {
    res.status(200).json({
        "message":"hello world"
    })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})