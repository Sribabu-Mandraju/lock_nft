import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import LockNftRoutes from "./routes/LockNft.routes.js"
import LockTimeNFTRoutes from "./routes/LockTimeNFTRoutes.js"
import userDepositRoutes from "./routes/userDepositRoutes.js"

const app = express()
const PORT = 3000

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to MongoDB
connectDB();

app.use(cors())
app.use(express.json())

app.use("/market",LockNftRoutes)
app.use("/lockTimeNFT",LockTimeNFTRoutes)
app.use("/deposits", userDepositRoutes)


// Read from contract (GET)
app.get("/",async (req,res) => {
    res.status(200).json({
        "message":"hello world"
    })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})