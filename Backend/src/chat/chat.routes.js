import { Router } from "express";
import { sendChatMessage } from "./chat.controller.js";

const router = Router();

router.post("/", sendChatMessage);

export default router;