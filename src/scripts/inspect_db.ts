import "dotenv/config";
import mongoose from "mongoose";

// Load models
const SitePageSchema = new mongoose.Schema({
  siteId: String,
  pageId: String,
  language: String,
  sections: mongoose.Schema.Types.Mixed,
});
const SitePage = mongoose.models.SitePage || mongoose.model("SitePage", SitePageSchema);

const JobPostingSchema = new mongoose.Schema({
  title: String,
  language: String,
  company: String,
  description: String,
});
const JobPosting = mongoose.models.JobPosting || mongoose.model("JobPosting", JobPostingSchema);

const SalesAdSchema = new mongoose.Schema({
  title: String,
  language: String,
  body: String,
});
const SalesAd = mongoose.models.SalesAd || mongoose.model("SalesAd", SalesAdSchema);

async function inspect() {
  const uri = process.env.MONGODB_URI || "mongodb://admin:Br1stelback1@127.0.0.1:27017/zevtabs?authSource=admin";
  console.log("Connecting to:", uri);
  await mongoose.connect(uri);
  
  const sitePages = await SitePage.find({ language: "mn" });
  console.log(`Found ${sitePages.length} SitePages in MN:`);
  for (const page of sitePages) {
    console.log(`  - Page ID: ${page.pageId}, Site ID: ${page.siteId}`);
  }

  const jobPostings = await JobPosting.find({ language: "mn" });
  console.log(`Found ${jobPostings.length} JobPostings in MN:`);
  for (const job of jobPostings) {
    console.log(`  - Title: ${job.title}, Company: ${job.company}`);
  }

  const salesAds = await SalesAd.find({ language: "mn" });
  console.log(`Found ${salesAds.length} SalesAds in MN:`);
  for (const ad of salesAds) {
    console.log(`  - Title: ${ad.title}`);
  }

  await mongoose.disconnect();
}

inspect().catch(console.error);
