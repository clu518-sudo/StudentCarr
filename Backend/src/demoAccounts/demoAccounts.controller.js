import { createDemoAccount } from "./demoAccounts.service.js";

// POST /api/demo-account
const createDemoAccountHandler = async (req, res, next) => {
  try {
    const { email, password, expiresAt } = await createDemoAccount();
    return res.status(201).json({
      success: true,
      data: { email, password, expiresAt },
    });
  } catch (error) {
    return next(error);
  }
};

export { createDemoAccountHandler };
