import { Router } from "express";
import * as authController from "./auth.controller.js";
import authMiddleware from "../../shared/middleware/authMiddleware.js";
import validateRequest from "../../shared/middleware/validateRequest.js";
import { registerSchema, loginSchema } from "./auth.schema.js";

const router = Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  authController.register
);

router.post("/login", validateRequest(loginSchema), authController.login);

router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);
router.get("/me", authMiddleware, authController.getMe);

export default router;
