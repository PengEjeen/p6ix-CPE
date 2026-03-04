const COMPANY_LOGO_RGB_SRC = encodeURI("/피식스에스씨_RGB_04.상하영문.png");
const COMPANY_LOGO_WHITE_SRC = encodeURI("/피식스에스씨_화이트로고.png");

const getCompanyLogoSrc = (theme) => {
  const normalized = String(theme || "").toLowerCase();
  if (normalized === "navy" || normalized === "dark") return COMPANY_LOGO_WHITE_SRC;
  return COMPANY_LOGO_RGB_SRC;
};

export { COMPANY_LOGO_RGB_SRC, COMPANY_LOGO_WHITE_SRC, getCompanyLogoSrc };
