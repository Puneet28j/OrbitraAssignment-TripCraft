import { Router } from "express";
import * as itineraryController from "./itinerary.controller.js";
import authMiddleware from "../../shared/middleware/authMiddleware.js";
import validateRequest from "../../shared/middleware/validateRequest.js";
import {
  generateItinerarySchema,
  listItineraryQuerySchema,
} from "./itinerary.schema.js";

const router = Router();

router.get("/shared/:token", itineraryController.getSharedItinerary);

router.use(authMiddleware);

router.post(
  "/generate",
  validateRequest(generateItinerarySchema),
  itineraryController.generateItinerary
);

router.get(
  "/",
  validateRequest(listItineraryQuerySchema, "query"),
  itineraryController.getItineraries
);

router.get("/:id", itineraryController.getItineraryById);
router.delete("/:id", itineraryController.deleteItinerary);
router.post("/:id/share", itineraryController.shareItinerary);
router.delete("/:id/share", itineraryController.revokeItineraryShare);

export default router;
