import { Router } from "express";
import * as uploadController from "./upload.controller.js";
import authMiddleware from "../../shared/middleware/authMiddleware.js";
import validateRequest from "../../shared/middleware/validateRequest.js";
import upload from "../../shared/middleware/upload.js";
import {
  signUploadSchema,
  uploadBatchMetadataSchema,
} from "./upload.schema.js";

const router = Router();

router.use(authMiddleware);

router.post(
  "/sign",
  validateRequest(signUploadSchema),
  uploadController.getUploadSignature
);

router.post(
  "/batch",
  validateRequest(uploadBatchMetadataSchema),
  uploadController.saveDocumentsBatch
);
router.post("/", upload.any(), uploadController.uploadDocuments);
router.get("/", uploadController.getDocuments);
router.get("/unassigned", uploadController.getUnassignedDocuments);
router.get("/:id/view-url", uploadController.getDocumentViewUrl);
router.get("/:id/content", uploadController.streamDocumentContent);
router.get("/:id/status", uploadController.getDocumentStatus);
router.delete("/:id", uploadController.deleteDocument);

export default router;
