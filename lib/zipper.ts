import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { GenerationResponse } from './ai';

export const generateCampaignZip = async (
  url: string,
  results: { blog_post: string; social_thread: string | string[]; email_teaser: string; qc_verified?: boolean; qc_feedback?: string }
) => {
  const zip = new JSZip();

  // Extract domain for filename
  let domain = "campaign";
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    domain = parsedUrl.hostname.replace(/^www\./, '').split('.')[0];
  } catch (e) {
    // fallback if URL is malformed
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `campaign-${domain}-${timestamp}.zip`;

  // Format social thread properly
  const socialContent = Array.isArray(results.social_thread) 
    ? results.social_thread.join('\n\n---\n\n') 
    : results.social_thread;

  zip.file("blog-post.md", results.blog_post || "");
  zip.file("social-thread.txt", socialContent || "");
  zip.file("email-teaser.txt", results.email_teaser || "");
  zip.file("source-url.txt", `Source URL: ${url}\nCampaign Generated at: ${new Date().toLocaleString()}`);

  if (results.qc_verified === false) {
    zip.file(
      "quality-warnings.txt", 
      `EDITOR-IN-CHIEF WARNINGS\n\n${results.qc_feedback || "Potential discrepancy detected. Manual check advised."}\n\nPlease review the generated content carefully against your source material.`
    );
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, filename);
};
