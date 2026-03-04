import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import PageHeader from "../components/cpe/PageHeader";

import userGuideSource from "../assets/공기검토플랫폼_사용자_가이드.md?raw";

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const extractText = (node) => {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && node.props && node.props.children !== undefined) {
    return extractText(node.props.children);
  }
  return "";
};

const TOC_EXCLUDE_TITLES = new Set([
  "이 페이지에서 하는 일",
  "따라하기",
  "자주 막히는 점/주의",
]);

const buildToc = (markdown) => {
  const toc = [];
  const lines = String(markdown || "").split(/\r?\n/);
  lines.forEach((line) => {
    const match = /^(#{2,3})\s+(.*)$/.exec(line);
    if (!match) return;
    const level = match[1].length; // 2 or 3
    const title = match[2].trim();
    if (!title) return;
    if (TOC_EXCLUDE_TITLES.has(title)) return;
    toc.push({ level, title, id: slugify(title) });
  });
  return toc;
};

export default function UserGuide() {
  const toc = useMemo(() => buildToc(userGuideSource), []);

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader title="사용자 가이드" description="공기검토플랫폼 전체 페이지 안내" />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <aside className="lg:sticky lg:top-6 h-fit rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] p-4">
          <div className="text-sm font-semibold text-[var(--navy-text)] mb-3">목차</div>
          <div className="space-y-1">
            {toc.map((item) => (
              <a
                key={`${item.level}-${item.id}-${item.title}`}
                href={`#${item.id}`}
                className={[
                  "group block rounded px-2 py-1 text-sm transition hover:bg-[#3b3b4f]",
                  "hover:bg-[var(--navy-surface-3)]",
                  item.level === 2 ? "text-[var(--navy-text)] font-semibold" : "",
                  item.level === 3 ? "ml-3 text-[var(--navy-text)]" : "",
                  item.level === 4 ? "ml-6 text-[var(--navy-text-muted)] text-[13px]" : "",
                ].join(" ")}
              >
                <span className="flex items-start gap-2">
                  <span
                    className={[
                      "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                      item.level === 2 ? "bg-[var(--navy-accent)]" : "bg-[var(--navy-border)]",
                      "group-hover:bg-[var(--navy-accent-hover)]",
                    ].join(" ")}
                  />
                  <span className="leading-5">{item.title}</span>
                </span>
              </a>
            ))}
          </div>
        </aside>

        <section className="rounded-xl border border-[var(--navy-border-soft)] bg-[var(--navy-surface)] p-6 overflow-hidden">
          <ReactMarkdown
            components={{
              h1: ({ children, ...props }) => (
                <h1 className="text-3xl font-black text-[var(--navy-text)] mb-4 tracking-tight" {...props}>
                  {children}
                </h1>
              ),
              h2: ({ children, ...props }) => {
                const title = extractText(children);
                const id = slugify(title);
                return (
                  <div className="mt-10 mb-4 scroll-mt-6" id={id}>
                    <h2 className="text-2xl font-extrabold text-[var(--navy-text)] tracking-tight" {...props}>
                      {children}
                    </h2>
                    <div className="mt-2 h-px w-full bg-gradient-to-r from-[var(--navy-accent)] via-[var(--navy-border-soft)] to-transparent" />
                  </div>
                );
              },
              h3: ({ children, ...props }) => {
                const title = extractText(children);
                const id = slugify(title);
                return (
                  <h3
                    id={id}
                    className="text-xl font-bold text-[var(--navy-text)] mt-8 mb-3 scroll-mt-6 flex items-center gap-2"
                    {...props}
                  >
                    <span className="h-2 w-2 rounded-full bg-[var(--navy-accent)]" />
                    <span>{children}</span>
                  </h3>
                );
              },
              h4: ({ children, ...props }) => {
                return (
                  <h4
                    className="mt-6 mb-2 scroll-mt-6 rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] px-3 py-2 text-[15px] font-semibold text-[var(--navy-text)]"
                    {...props}
                  >
                    {children}
                  </h4>
                );
              },
              p: ({ children, ...props }) => (
                <p className="text-[var(--navy-text)] leading-7 mb-3" {...props}>
                  {children}
                </p>
              ),
              ul: ({ children, ...props }) => (
                <ul className="list-disc pl-6 text-[var(--navy-text)] space-y-1 mb-3" {...props}>
                  {children}
                </ul>
              ),
              ol: ({ children, ...props }) => (
                <ol className="list-decimal pl-6 text-[var(--navy-text)] space-y-1 mb-3" {...props}>
                  {children}
                </ol>
              ),
              li: ({ children, ...props }) => (
                <li className="text-[var(--navy-text)]" {...props}>
                  {children}
                </li>
              ),
              blockquote: ({ children, ...props }) => (
                <blockquote
                  className="my-4 rounded-lg border border-[var(--navy-accent)] bg-[var(--navy-bg)] px-4 py-3 text-[var(--navy-text)]"
                  {...props}
                >
                  <div className="text-[13px] leading-6 text-[var(--navy-text)]">{children}</div>
                </blockquote>
              ),
              pre: ({ children, ...props }) => (
                <pre
                  className="my-4 overflow-auto rounded-lg border border-[var(--navy-border-soft)] bg-[var(--navy-bg)] p-4 text-[13px] leading-6 text-[var(--navy-text)]"
                  {...props}
                >
                  {children}
                </pre>
              ),
              code: ({ inline, children, ...props }) =>
                inline ? (
                  <code
                    className="px-1.5 py-0.5 rounded bg-[var(--navy-surface-2)] text-[var(--navy-text)] text-[13px]"
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <code className="block whitespace-pre" {...props}>
                    {children}
                  </code>
                ),
              a: ({ children, ...props }) => (
                <a className="text-[var(--navy-accent)] hover:text-[var(--navy-accent-hover)] underline underline-offset-2" {...props}>
                  {children}
                </a>
              ),
              table: ({ children, ...props }) => (
                <div className="my-5 overflow-x-auto">
                  <table className="w-full border-collapse text-sm" {...props}>
                    {children}
                  </table>
                </div>
              ),
              th: ({ children, ...props }) => (
                <th className="border border-[var(--navy-border-soft)] bg-[var(--navy-surface-2)] px-3 py-2 text-left font-semibold text-[var(--navy-text)]" {...props}>
                  {children}
                </th>
              ),
              td: ({ children, ...props }) => (
                <td className="border border-[var(--navy-border-soft)] px-3 py-2 align-top text-[var(--navy-text)]" {...props}>
                  {children}
                </td>
              ),
              hr: (props) => <hr className="border-[var(--navy-border-soft)] my-6" {...props} />,
            }}
          >
            {userGuideSource}
          </ReactMarkdown>
        </section>
      </div>
    </div>
  );
}
