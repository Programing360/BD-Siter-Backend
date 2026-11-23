import path from "path";
import { IUser } from "../models/User.model";

// Initialize pdfmake with bundled Roboto fonts
const pdfmake = require("pdfmake");

let fontsInitialized = false;

const initFonts = () => {
  if (fontsInitialized) return;
  try {
    const fontsDir = path.join(
      process.cwd(),
      "node_modules",
      "pdfmake",
      "fonts",
      "Roboto"
    );
    pdfmake.addFonts({
      Roboto: {
        normal: path.join(fontsDir, "Roboto-Regular.ttf"),
        bold: path.join(fontsDir, "Roboto-Medium.ttf"),
        italics: path.join(fontsDir, "Roboto-Italic.ttf"),
        bolditalics: path.join(fontsDir, "Roboto-MediumItalic.ttf"),
      },
    });
    fontsInitialized = true;
  } catch (err) {
    console.error("Failed to initialize fonts for pdfmake:", err);
  }
};

export const generateProfilePdfBuffer = async (
  user: IUser
): Promise<Buffer> => {
  initFonts();

  const wingsList =
    user.wings && user.wings.length > 0
      ? user.wings.join(", ")
      : "Not specified";

  const webProfilesList =
    user.webProfiles && user.webProfiles.length > 0
      ? user.webProfiles.map((p) => `${p.label}: ${p.url}`).join("\n")
      : "None listed";

  const softwareSkillsList =
    user.softwareSkills && user.softwareSkills.length > 0
      ? user.softwareSkills.map((s) => `${s.name} (Level: ${s.level}/5)`).join(", ")
      : "None listed";

  const vocationalSkillsList =
    user.vocationalSkills && user.vocationalSkills.length > 0
      ? user.vocationalSkills
          .map((v) => `${v.skill} [${v.genre}] (Level: ${v.level}/5)`)
          .join(", ")
      : "None listed";

  const subjectsList =
    user.subjectsOfInterest && user.subjectsOfInterest.length > 0
      ? user.subjectsOfInterest.map((s) => `${s.subject} (${s.genre})`).join(", ")
      : "None listed";

  const contactEmail = user.contactInfo?.isPrivate
    ? "Private (Hidden by Member)"
    : user.email || "Not specified";

  const contactPhone = user.contactInfo?.isPrivate
    ? "Private (Hidden by Member)"
    : user.contactInfo?.phone || "Not specified";

  const docDefinition = {
    content: [
      {
        text: "BDSisters.org",
        style: "mainHeader",
      },
      {
        text: "Verified Sisterhood Member Profile",
        style: "subHeader",
      },
      { text: " ", margin: [0, 5] },
      {
        table: {
          widths: ["30%", "70%"],
          body: [
            [{ text: "Full Name", bold: true }, user.fullName || "N/A"],
            [{ text: "Member Role", bold: true }, user.role || "Member"],
            [{ text: "Status", bold: true }, user.status || "Active"],
            [
              { text: "Member Since", bold: true },
              user.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "N/A",
            ],
            [{ text: "Bio / Summary", bold: true }, user.bio || "No bio provided"],
            [{ text: "Affiliated Wings", bold: true }, wingsList],
            [{ text: "Contact Email", bold: true }, contactEmail],
            [{ text: "Contact Phone", bold: true }, contactPhone],
            [{ text: "Software Skills", bold: true }, softwareSkillsList],
            [{ text: "Vocational Skills", bold: true }, vocationalSkillsList],
            [{ text: "Subjects of Interest", bold: true }, subjectsList],
            [{ text: "Web & Social Profiles", bold: true }, webProfilesList],
          ],
        },
        layout: "lightHorizontalLines",
      },
      { text: " ", margin: [0, 15] },
      {
        text: `Exported from BDSisters.org on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} (UTC)`,
        style: "footerText",
      },
    ],
    styles: {
      mainHeader: {
        fontSize: 22,
        bold: true,
        color: "#0f766e",
        alignment: "center",
      },
      subHeader: {
        fontSize: 13,
        italics: true,
        color: "#555555",
        alignment: "center",
        margin: [0, 4, 0, 12],
      },
      footerText: {
        fontSize: 9,
        color: "#888888",
        alignment: "center",
      },
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      lineHeight: 1.3,
    },
  };

  const pdfDoc = pdfmake.createPdf(docDefinition);
  return await pdfDoc.getBuffer();
};
