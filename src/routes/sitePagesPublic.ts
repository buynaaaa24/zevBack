import { Router } from "express";
import { SitePage } from "../models/SitePage.js";
import { serializeLean } from "../util/serialize.js";

export const sitePagesPublicRouter = Router();

sitePagesPublicRouter.get("/:pageId", async (req, res, next) => {
  try {
    const { pageId } = req.params;
    const lang = (req.query.lang as string) || "mn";
    const siteId = (req.query.siteId as string) || "zevtabs";
    if (!pageId || pageId.length > 64) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "pageId" } });
      return;
    }
    const doc = await SitePage.findOne({ siteId, pageId, language: lang }).lean();
    if (!doc) {
      res.json({
        data: { siteId, pageId, language: lang, sections: {}, updatedAt: null },
      });
      return;
    }
    res.json({
      data: serializeLean(doc as Record<string, unknown>),
    });
  } catch (e) {
    next(e);
  }
});
