import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../db.js";
import { SitePage } from "../models/SitePage.js";
import { JobPosting } from "../models/JobPosting.js";
import { SalesAd } from "../models/SalesAd.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateText(text: string): Promise<string> {
  if (!text || typeof text !== "string") return text;
  
  const trimmed = text.trim();
  if (!trimmed) return text;
  
  // Skip translation for structural elements, URLs, emails, phone numbers, color tags, routes, etc.
  if (
    trimmed.startsWith("http://") || 
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") || 
    trimmed.startsWith("#") || 
    trimmed.startsWith("bg-") || 
    trimmed.startsWith("text-") || 
    trimmed.includes("@") || 
    /^\+?[0-9\- \(\)]+$/.test(trimmed) || 
    /^[0-9]+(\.[0-9]+)?$/.test(trimmed) || 
    /^[A-Za-z0-9_\-]+$/.test(trimmed)
  ) {
    return text;
  }

  // To prevent getting blocked by the free API, we sleep slightly
  await sleep(100);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=mn&tl=en&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Warn] Translation failed (status ${res.status}) for text: "${trimmed}". Using original text.`);
      return text;
    }
    const data = await res.json() as any;
    if (data && data[0] && Array.isArray(data[0])) {
      const translated = data[0].map((item: any) => item[0]).join("");
      console.log(`[Translate] "${trimmed}" -> "${translated}"`);
      return translated;
    }
    return text;
  } catch (err) {
    console.error(`[Error] Failed to translate: "${trimmed}". Using original text.`, err);
    return text;
  }
}

async function translateValue(value: any): Promise<any> {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date || value instanceof RegExp) {
    return value;
  }
  if (value.constructor && value.constructor.name === "ObjectId") {
    return value;
  }
  if (typeof value === "string") {
    return await translateText(value);
  }
  if (Array.isArray(value)) {
    const newArr = [];
    for (const item of value) {
      newArr.push(await translateValue(item));
    }
    return newArr;
  }
  if (typeof value === "object") {
    const rawObj = (value.toObject && typeof value.toObject === "function") ? value.toObject() : value;
    const newObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawObj)) {
      // Do not translate object keys, only translate values
      newObj[key] = await translateValue(val);
    }
    return newObj;
  }
  return value;
}

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://admin:Br1stelback1@127.0.0.1:27017/zevtabs?authSource=admin";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("Connected to MongoDB database.");

  // 1. Translate SitePages
  console.log("\n--- Processing SitePage documents ---");
  const sitePages = await SitePage.find({ language: "mn" });
  console.log(`Found ${sitePages.length} Mongolian SitePage documents.`);
  for (const doc of sitePages) {
    console.log(`Translating SitePage: ${doc.pageId} (siteId: ${doc.siteId})`);
    const translatedSections = await translateValue(doc.sections);
    
    await SitePage.findOneAndUpdate(
      { siteId: doc.siteId, pageId: doc.pageId, language: "en" },
      {
        siteId: doc.siteId,
        pageId: doc.pageId,
        language: "en",
        sections: translatedSections,
        lastEditedByUsername: "system_translator",
        lastEditedByDisplayName: "System Translator",
      },
      { upsert: true, new: true }
    );
    console.log(`Saved English SitePage: ${doc.pageId}`);
  }

  // 2. Translate JobPostings
  console.log("\n--- Processing JobPosting documents ---");
  const jobPostings = await JobPosting.find({ language: "mn" });
  console.log(`Found ${jobPostings.length} Mongolian JobPosting documents.`);
  for (const doc of jobPostings) {
    console.log(`Translating JobPosting: "${doc.title}" (company: ${doc.company})`);
    const translatedTitle = await translateText(doc.title);
    const translatedCompany = await translateText(doc.company);
    const translatedLocation = await translateText(doc.location);
    const translatedDescription = await translateText(doc.description);
    const translatedSalary = doc.salary ? await translateText(doc.salary) : undefined;

    await JobPosting.findOneAndUpdate(
      {
        siteId: doc.siteId,
        title: translatedTitle,
        company: translatedCompany,
        language: "en",
      },
      {
        siteId: doc.siteId,
        title: translatedTitle,
        company: translatedCompany,
        location: translatedLocation,
        description: translatedDescription,
        salary: translatedSalary,
        imageUrl: doc.imageUrl,
        active: doc.active,
        postedByUsername: "system_translator",
        postedByDisplayName: "System Translator",
      },
      { upsert: true, new: true }
    );
    console.log(`Saved English JobPosting: "${translatedTitle}"`);
  }

  // 3. Translate SalesAds
  console.log("\n--- Processing SalesAd documents ---");
  const salesAds = await SalesAd.find({ language: "mn" });
  console.log(`Found ${salesAds.length} Mongolian SalesAd documents.`);
  for (const doc of salesAds) {
    console.log(`Translating SalesAd: "${doc.title}"`);
    const translatedTitle = await translateText(doc.title);
    const translatedSummary = doc.summary ? await translateText(doc.summary) : undefined;
    const translatedBody = await translateText(doc.body);

    await SalesAd.findOneAndUpdate(
      {
        siteId: doc.siteId,
        title: translatedTitle,
        language: "en",
      },
      {
        siteId: doc.siteId,
        title: translatedTitle,
        summary: translatedSummary,
        body: translatedBody,
        imageUrl: doc.imageUrl,
        externalUrl: doc.externalUrl,
        active: doc.active,
        validFrom: doc.validFrom,
        validTo: doc.validTo,
        postedByUsername: "system_translator",
        postedByDisplayName: "System Translator",
      },
      { upsert: true, new: true }
    );
    console.log(`Saved English SalesAd: "${translatedTitle}"`);
  }

  console.log("\nDatabase translation and seeding process completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Translation script failed:", err);
    process.exit(1);
  });
