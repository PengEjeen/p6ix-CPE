import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import userGuideSource from "../assets/공기검토플랫폼_사용자_가이드.md?raw";
import { createProjects } from "../api/cpe/project";

const GUIDE_IMAGE_URLS = import.meta.glob("../assets/userguide_img/*", {
  eager: true,
  import: "default",
});

const GUIDE_FLOW_ARROW_SET = new Set(["->", "=>", "→", "➡", "➡️", "⟶", "⇢", "➜", "➔"]);
const GUIDE_IMAGE_CELL_RE = /^!\[[^\]]*]\(([^)]+)\)$/;

// ─── 유틸 ───────────────────────────────────────────────────────────────
const slugify = (v) =>
  String(v || "").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-");

const extractText = (node) => {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && node.props?.children !== undefined)
    return extractText(node.props.children);
  return "";
};

const resolveGuideImageSrc = (src) => {
  const rawSrc = String(src || "").trim();
  const normalized = rawSrc.replace(/^\.\/+/, "");
  const mappedKey = normalized.startsWith("userguide_img/") ? `../assets/${normalized}` : null;
  return mappedKey && GUIDE_IMAGE_URLS[mappedKey] ? GUIDE_IMAGE_URLS[mappedKey] : rawSrc;
};

const extractMarkdownImageSrc = (cell) => {
  const text = String(cell || "").trim();
  const match = GUIDE_IMAGE_CELL_RE.exec(text);
  return match?.[1] ? match[1].trim() : null;
};

const normalizeFlowArrow = (value) => {
  const text = String(value || "").trim();
  if (!text) return "→";
  return GUIDE_FLOW_ARROW_SET.has(text) ? (text === "->" || text === "=>" ? "→" : text) : null;
};

const toGuideFlowSpec = (tableBlock) => {
  const headers = Array.isArray(tableBlock?.headers) ? tableBlock.headers : [];
  const rows = Array.isArray(tableBlock?.rows) ? tableBlock.rows : [];
  if (!rows.length) return null;
  if (headers.some((h) => String(h || "").trim().length > 0)) return null;

  const cells = rows[0].map((c) => String(c || "").trim()).filter((c) => c.length > 0);
  if (cells.length !== 2 && cells.length !== 3) return null;

  const leftSrc = extractMarkdownImageSrc(cells[0]);
  const rightSrc = extractMarkdownImageSrc(cells[cells.length - 1]);
  if (!leftSrc || !rightSrc) return null;

  const arrowText = cells.length === 3 ? normalizeFlowArrow(cells[1]) : "→";
  if (!arrowText) return null;

  return {
    leftSrc: resolveGuideImageSrc(leftSrc),
    rightSrc: resolveGuideImageSrc(rightSrc),
    arrowText,
  };
};

const GUIDE_PROJECT_KEY = "guide_project_id";
const GUIDE_PROJECT_NAME = "guide_project_name";
const TOC_SKIP = new Set([
  "이 화면에서 하는 일", 
  "따라하기", 
  "자주 막히는 점", 
  "공통", 
  "상단 기능", 
  "공정표 작성 흐름", 
  "대공종 운영 기능", 
  "표 작업 기능", 
  "결과물", 
  "주요 기능"
]);

// ─── 데모 → iframe 경로 ─────────────────────────────────────────────────
const DEMO_CONFIG = {
  create_project: {
    path: null,          // 직접 생성 UI 표시
    needsProject: false,
    hint: "💡 아래에서 가이드 실습 프로젝트를 만드세요. 이후 모든 데모에서 공유됩니다.",
    height: 0,
  },
  operating_rate: {
    path: "/projects/{id}/operating_rate",
    needsProject: true,
    hint: "💡 지역·데이터기간을 선택하고 조건을 조정한 뒤 [저장]을 눌러보세요.",
    height: 580,
  },
  total_calc: {
    path: "/projects/{id}/total-calc",
    needsProject: true,
    hint: "💡 표준품셈을 검색·수정하고 저장해보세요.",
    height: 620,
  },
  cip_basis: {
    path: "/projects/{id}/cip-basis",
    needsProject: true,
    hint: "💡 CIP 생산성 데이터를 수정한 뒤 저장해보세요.",
    height: 620,
  },
  pile_basis: {
    path: "/projects/{id}/pile-basis",
    needsProject: true,
    hint: "💡 기성말뚝 생산성 데이터를 수정한 뒤 저장해보세요.",
    height: 620,
  },
  bored_pile_basis: {
    path: "/projects/{id}/bored-pile-basis",
    needsProject: true,
    hint: "💡 현장타설말뚝 생산성 데이터를 수정한 뒤 저장해보세요.",
    height: 620,
  },
  schedule: {
    path: "/projects/{id}/schedule-master",
    needsProject: true,
    hint: "💡 수량·생산성·인원을 입력하면 기간이 자동 계산됩니다. 간트차트도 눌러보세요.",
    height: 620,
  },
  ai_adjust: {
    path: "/projects/{id}/schedule-master",
    needsProject: true,
    hint: "💡 [기간 조정] 버튼을 눌러 AI 자동 조정 결과를 확인해보세요.",
    height: 620,
  },
  export: {
    path: "/projects/{id}/schedule-master",
    needsProject: true,
    hint: "💡 상단 [엑셀 내보내기] 또는 [보고서 내보내기]를 눌러보세요.",
    height: 620,
  },
  calc_input: {
    path: "/projects/{id}/calc",
    needsProject: true,
    hint: "💡 공사개요·근무조건 값을 입력하면 공기가 자동 계산됩니다.",
    height: 580,
  },
};

function guideUrl(path, projectId) {
  const resolved = projectId ? path.replace("{id}", projectId) : path;
  return `${resolved}${resolved.includes("?") ? "&" : "?"}guide=true`;
}

// ─── 인라인 데모 카드 ────────────────────────────────────────────────────
function InlineDemo({ name }) {
  const config = DEMO_CONFIG[name];
  const [projectId, setProjectId] = useState(() => localStorage.getItem(GUIDE_PROJECT_KEY));
  const [projectName, setProjectName] = useState(() => localStorage.getItem(GUIDE_PROJECT_NAME));
  const [customName, setCustomName] = useState("");
  const [projType, setProjType] = useState("TOTAL");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // 다른 데모에서 프로젝트가 생성됐을 때 자동 동기화
  useEffect(() => {
    if (projectId) return;
    const t = setInterval(() => {
      const id = localStorage.getItem(GUIDE_PROJECT_KEY);
      if (id) { setProjectId(id); setProjectName(localStorage.getItem(GUIDE_PROJECT_NAME)); clearInterval(t); }
    }, 500);
    return () => clearInterval(t);
  }, [projectId]);

  if (!config) return (
    <div className="my-4 rounded-lg border border-yellow-700 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
      ⚠ 알 수 없는 데모: <code>{name}</code>
    </div>
  );

  const needsProject = config.needsProject;
  const hasProject = !!projectId;
  const showCreate = name === "create_project" || (needsProject && !hasProject);
  const isWideDemo = ["schedule", "ai_adjust", "export"].includes(name);
  const src = !showCreate && config.path
    ? guideUrl(config.path, projectId)
    : null;

  async function handleCreate() {
    const title = customName.trim() || "가이드 실습 프로젝트";
    setCreating(true); setError(null);
    try {
      const result = await createProjects({ title, calc_type: projType });
      const id = result?.id || result?.data?.id;
      if (!id) throw new Error("ID 없음");
      localStorage.setItem(GUIDE_PROJECT_KEY, id);
      localStorage.setItem(GUIDE_PROJECT_NAME, title);
      setProjectId(id); setProjectName(title);
    } catch {
      setError("프로젝트 생성에 실패했습니다. 다시 시도해보세요.");
    } finally { setCreating(false); }
  }

  return (
    <div className={`${isWideDemo ? "md:-mx-6 xl:-mx-8" : ""} my-6 rounded-2xl border border-gray-700 overflow-hidden shadow-xl`}>
      {/* 상단 힌트 바 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-[#26263a]">
        <span className="text-[13px] text-gray-300">{config.hint}</span>
        <div className="flex items-center gap-2">
          {projectName && (
            <span className="text-[11px] text-gray-400 border border-gray-700 rounded-full px-2 py-0.5">
              📁 {projectName}
            </span>
          )}
          {src && (
            <a href={src} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-gray-400 hover:text-gray-200 border border-gray-600 rounded px-2 py-0.5 transition">
              ↗ 새 탭
            </a>
          )}
        </div>
      </div>

      {/* 프로젝트 생성 UI */}
      {showCreate && (
        <div className="px-8 py-8 bg-[#1e1e2f]" style={{ minHeight: 220 }}>
          {!hasProject ? (
            <div className="max-w-lg space-y-4">
              <div>
                <p className="text-lg font-bold text-white mb-1">가이드용 프로젝트 만들기</p>
                <p className="text-sm text-gray-400">
                  프로젝트를 만들면 이후 모든 실습에서 공유됩니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 shrink-0">유형</span>
                <div className="flex rounded-lg border border-gray-600 overflow-hidden bg-[#1a1a20]">
                  {[["TOTAL", "전체 공기산정"], ["APARTMENT", "아파트 공기계산"]].map(([k, l], i) => (
                    <button key={k} onClick={() => setProjType(k)}
                      className={`px-3 py-1.5 text-xs font-semibold transition ${i > 0 ? "border-l border-gray-600" : ""} ${projType === k ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-[#2f2f3a]"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
                  placeholder="가이드 실습 프로젝트"
                  className="flex-1 rounded-lg border border-gray-600 bg-[#2c2c3a] px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 transition" />
                <button onClick={handleCreate} disabled={creating}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2 text-sm font-bold text-white transition disabled:opacity-50">
                  {creating ? "생성 중..." : "만들기"}
                </button>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          ) : (
            <div className="space-y-3 max-w-lg">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-700 bg-emerald-900/20 px-4 py-3">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="text-sm font-bold text-white">{projectName}</div>
                  <div className="text-xs text-gray-400">가이드 프로젝트 준비 완료 — 아래로 스크롤해 다음 실습을 해보세요.</div>
                </div>
                <button onClick={() => { localStorage.removeItem(GUIDE_PROJECT_KEY); localStorage.removeItem(GUIDE_PROJECT_NAME); setProjectId(null); setProjectName(null); }}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-1 transition">
                  교체
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* iframe */}
      {src && (
        <iframe key={src} src={src} title={name}
          width="100%" height={config.height}
          style={{ border: "none", display: "block", background: "#1e1e2f" }}
          allow="clipboard-read; clipboard-write" />
      )}
    </div>
  );
}

// ─── TOC 파싱 ────────────────────────────────────────────────────────────
function buildToc(md) {
  return String(md || "").split(/\r?\n/).reduce((acc, line) => {
    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!m || !m[2].trim() || TOC_SKIP.has(m[2].trim())) return acc;
    acc.push({ level: m[1].length, title: m[2].trim(), id: slugify(m[2].trim()) });
    return acc;
  }, []);
}

const isTableRow = (line) => {
  const t = String(line || "").trim();
  return t.includes("|") && t.length > 0;
};

const isTableSeparator = (line) => {
  const t = String(line || "").trim();
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(t);
};

const splitTableCells = (line) => {
  let t = String(line || "").trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((cell) => cell.trim());
};

function parseGuideBlocks(md) {
  const lines = String(md || "").split(/\r?\n/);
  const blocks = [];
  let buffer = [];
  let i = 0;

  const flushMarkdown = () => {
    if (!buffer.length) return;
    blocks.push({ type: "markdown", content: buffer.join("\n") });
    buffer = [];
  };

  while (i < lines.length) {
    const headerLine = lines[i];
    const separatorLine = lines[i + 1];

    if (isTableRow(headerLine) && isTableSeparator(separatorLine)) {
      const headerCells = splitTableCells(headerLine);
      const rows = [];
      i += 2;

      while (i < lines.length && isTableRow(lines[i]) && lines[i].trim() !== "") {
        rows.push(splitTableCells(lines[i]));
        i += 1;
      }

      flushMarkdown();
      blocks.push({ type: "table", headers: headerCells, rows });
      continue;
    }

    buffer.push(lines[i]);
    i += 1;
  }

  flushMarkdown();
  return blocks;
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────
export default function UserGuide() {
  const toc = useMemo(() => buildToc(userGuideSource), []);
  const contentBlocks = useMemo(() => parseGuideBlocks(userGuideSource), []);
  const [activeId, setActiveId] = useState(toc[0]?.id);
  const contentRef = useRef(null);
  const sectionRefs = useRef({});

  const registerSectionRef = useCallback((id, el) => {
    sectionRefs.current[id] = el;
  }, []);

  // TOC 하이라이트
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id); });
      },
      { root: el, rootMargin: "-15% 0% -70% 0%" }
    );
    setTimeout(() => {
      Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    }, 100);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 마크다운 컴포넌트 ────────────────────────────────────────────────
  const components = useMemo(() => ({
    h1: ({ children }) => (
      <h1 className="text-4xl font-black text-white mb-3 tracking-tight">{children}</h1>
    ),
    h2: ({ children }) => {
      const title = extractText(children);
      const id = slugify(title);
      return (
        <div id={id} ref={TOC_SKIP.has(title.trim()) ? undefined : (el) => registerSectionRef(id, el)} className="mt-14 mb-5 scroll-mt-6">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{children}</h2>
          <div className="mt-2 h-0.5 w-full bg-gradient-to-r from-blue-500 via-gray-600 to-transparent" />
        </div>
      );
    },
    h3: ({ children }) => {
      const title = extractText(children);
      const id = slugify(title);
      return (
        <h3 id={id} ref={TOC_SKIP.has(title.trim()) ? undefined : (el) => registerSectionRef(id, el)}
          className="text-lg font-bold text-white mt-10 mb-3 scroll-mt-6 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />{children}
        </h3>
      );
    },
    h4: ({ children }) => {
      const s = extractText(children);
      if (TOC_SKIP.has(s.trim())) {
        return (
          <div className="mt-5 mb-2 rounded-lg border border-gray-700 bg-[#26263a] px-3 py-2 text-[13px] font-semibold text-gray-300">
            {children}
          </div>
        );
      }
      return <h4 className="mt-5 mb-1 text-[15px] font-semibold text-gray-300">{children}</h4>;
    },
    p: ({ children }) => <p className="text-gray-300 leading-7 mb-3">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 text-gray-300 space-y-1.5 mb-3">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 text-gray-300 space-y-1.5 mb-3">{children}</ol>,
    li: ({ children }) => <li className="text-gray-300 leading-6">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-4 rounded-lg border border-blue-700/50 bg-blue-900/20 px-4 py-3 text-gray-300 text-sm leading-6">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-gray-700 my-10" />,
    a: ({ children, href }) => (
      <a href={href} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition">{children}</a>
    ),
    code: ({ inline, className, children }) => {
      const lang = (className || "").replace("language-", "");
      const demoName = String(children).trim();
      const codeText = String(children ?? "");
      const hasLineBreak = codeText.includes("\n");
      const isInlineCode = inline ?? (!className && !hasLineBreak);
      // demo 블록 → 인라인 iframe 카드
      if (!isInlineCode && lang === "demo") {
        return <InlineDemo name={demoName} />;
      }
      if (isInlineCode) {
        return (
          <span className="font-semibold text-gray-100">{children}</span>
        );
      }
      return (
        <pre className="my-4 overflow-auto rounded-lg border border-gray-700 bg-[#1a1a20] p-4 text-[13px] leading-6 text-gray-300">
          <code>{children}</code>
        </pre>
      );
    },
    table: ({ children }) => (
      <div className="my-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-gray-700 bg-[#2c2c3a] px-3 py-2 text-left font-semibold text-gray-200">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-700 px-3 py-2 align-top text-gray-300">{children}</td>
    ),
    img: ({ src, alt }) => {
      const resolvedSrc = resolveGuideImageSrc(src);

      return (
        <img
          src={resolvedSrc}
          alt={alt || ""}
          loading="lazy"
          className="my-4 max-w-full rounded-lg border border-gray-700"
        />
      );
    },
  }), [registerSectionRef]);

  const tableCellComponents = useMemo(() => ({
    ...components,
    p: ({ children }) => <span className="text-gray-300 leading-6">{children}</span>,
    ul: ({ children }) => <ul className="list-disc pl-4 text-gray-300 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-4 text-gray-300 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="text-gray-300 leading-6">{children}</li>,
  }), [components]);

  // ── 렌더 ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "#131320", color: "#e2e8f0" }}>
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-50 flex items-center gap-4 px-6 py-3 border-b border-gray-800"
        style={{ background: "#1a1a2e" }}>
        <a href="/" className="text-sm text-gray-400 hover:text-gray-200 transition">← 앱으로 돌아가기</a>
        <span className="text-gray-700">|</span>
        <span className="font-bold text-white">공기검토플랫폼 사용자 가이드</span>
      </div>

      {/* 본문: TOC + 콘텐츠 */}
      <div className="flex flex-1">
        {/* sticky TOC */}
        <aside className="hidden lg:block w-56 xl:w-64 shrink-0 sticky top-[49px] h-[calc(100vh-49px)] overflow-y-auto py-6 px-4 border-r border-gray-800"
          style={{ background: "#1a1a2e" }}>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">목차</div>
          {toc.map((item) => (
            <a key={`${item.level}-${item.id}`}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={[
                "group flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] transition mb-0.5",
                item.level === 2 ? "font-semibold" : "ml-3 font-normal",
                activeId === item.id
                  ? "bg-blue-600/20 text-blue-300"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200",
              ].join(" ")}>
              <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${activeId === item.id ? "bg-blue-400" : "bg-gray-700 group-hover:bg-gray-400"}`} />
              <span className="leading-5">{item.title}</span>
            </a>
          ))}
        </aside>

        {/* 스크롤 콘텐츠 */}
        <main ref={contentRef} className="flex-1 overflow-y-auto py-10 px-6 md:px-12 xl:px-16">
          <div>
            {contentBlocks.map((block, idx) => {
              if (block.type === "table") {
                const flowSpec = toGuideFlowSpec(block);
                if (flowSpec) {
                  return (
                    <div key={`flow-${idx}`} className="my-5 overflow-x-auto">
                      <div className="mx-auto flex min-w-[520px] items-center justify-center gap-4">
                        <img
                          src={flowSpec.leftSrc}
                          alt=""
                          loading="lazy"
                          className="h-auto w-auto max-w-[46%] rounded-lg object-contain"
                        />
                        <span className="shrink-0 text-3xl font-semibold text-gray-300">{flowSpec.arrowText}</span>
                        <img
                          src={flowSpec.rightSrc}
                          alt=""
                          loading="lazy"
                          className="h-auto w-auto max-w-[46%] rounded-lg object-contain"
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={`table-${idx}`} className="my-5 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          {block.headers.map((header, cIdx) => (
                            <th key={`th-${idx}-${cIdx}`} className="border border-gray-700 bg-[#2c2c3a] px-3 py-2 text-left font-semibold text-gray-200">
                              <ReactMarkdown components={tableCellComponents}>{header}</ReactMarkdown>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rIdx) => (
                          <tr key={`tr-${idx}-${rIdx}`}>
                            {block.headers.map((_, cIdx) => (
                              <td key={`td-${idx}-${rIdx}-${cIdx}`} className="border border-gray-700 px-3 py-2 align-top text-gray-300">
                                <ReactMarkdown components={tableCellComponents}>{row[cIdx] || ""}</ReactMarkdown>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              return (
                <ReactMarkdown key={`md-${idx}`} components={components}>
                  {block.content}
                </ReactMarkdown>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
