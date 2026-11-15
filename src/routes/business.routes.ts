import { Router } from "express";
import { createOrUpdateBusiness } from "../controllers/business.controller";

const router = Router();

router.post("/create", createOrUpdateBusiness);

const businessRoutes = router

export default businessRoutes;
