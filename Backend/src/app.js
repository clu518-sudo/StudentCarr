import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "./config/env.js";
import apiRoutes from "./routes/index.js";
import errorHandler from "./middleware/error.middleware.js";

const app = express();

const allowedOrigins = env.corsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean); // .filter((value)=>Boolean(value))

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        // !origin allow requests without origin. (e.g. postman, same-origin requests)
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin denied"));
    },
    credentials: true, // allow to revieve cookies
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

app.use("/api", apiRoutes);

app.use(errorHandler);

export default app;
