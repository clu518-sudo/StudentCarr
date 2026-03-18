const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { loginRateLimit, signupRateLimit } = require("../middleware/rateLimit.middleware");

const router = Router();

router.post("/signup", signupRateLimit, authController.signup);
router.post("/login", loginRateLimit, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

module.exports = router;
