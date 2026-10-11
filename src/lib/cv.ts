export type ExtractedCvData = {
  full_name?: string;
  professional_email?: string;
  phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  skills?: string[];
};

export type CvDocument = {
  id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  extracted_text: string;
  extracted_data: ExtractedCvData;
  created_at: string;
};

const sectionNames = /^(perfil|resumen|experiencia|experience|educaci[oó]n|education|formaci[oó]n|habilidades|skills|idiomas|languages|contacto|contact)$/i;

function cleanUrl(value: string) {
  return value.replace(/[),.;]+$/, "");
}

function extractSkills(lines: string[]) {
  const heading = lines.findIndex((line) => /^(habilidades|skills|competencias|herramientas)(\s+t[eé]cnicas)?\s*:? ?$/i.test(line));
  if (heading < 0) return [];
  const candidates: string[] = [];
  for (const line of lines.slice(heading + 1, heading + 6)) {
    if (sectionNames.test(line)) break;
    candidates.push(...line.split(/[•·|,;]+/));
  }
  return [...new Set(candidates.map((value) => value.trim()).filter((value) => value.length >= 2 && value.length <= 50))].slice(0, 20);
}

export function detectCvData(text: string): ExtractedCvData {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, " ").trim();
  const urls = [...text.matchAll(/(?:https?:\/\/|www\.)[^\s<>]+/gi)].map((match) => cleanUrl(match[0]));
  const linkedin = urls.find((url) => /linkedin\.com\/in\//i.test(url));
  const portfolio = urls.find((url) => !/linkedin\.com|mailto:|github\.com/i.test(url));
  const fullName = lines.slice(0, 12).find((line) => {
    const words = line.split(/\s+/);
    return words.length >= 2 && words.length <= 5 && line.length <= 70 && /^[\p{L}'’-]+(?:\s+[\p{L}'’-]+)+$/u.test(line) && !sectionNames.test(line);
  });
  const skills = extractSkills(lines);

  return {
    ...(fullName ? { full_name: fullName } : {}),
    ...(email ? { professional_email: email } : {}),
    ...(phone ? { phone } : {}),
    ...(linkedin ? { linkedin_url: linkedin.startsWith("http") ? linkedin : `https://${linkedin}` } : {}),
    ...(portfolio ? { portfolio_url: portfolio.startsWith("http") ? portfolio : `https://${portfolio}` } : {}),
    ...(skills.length ? { skills } : {}),
  };
}
