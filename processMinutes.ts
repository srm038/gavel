import { SHA512_256, YAML } from "bun";
import { format } from "date-fns";
import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import remarkParseYAML from "remark-parse-yaml";
import { unified } from "unified";
import * as z from "zod";

interface LoadMarkdownProps {
  file: string;
}

export const loadMarkdown = async ({ file }: LoadMarkdownProps) => {
  let markdown = await Bun.file(file).text();
  let ast = unified().use(remarkParse).use(remarkFrontmatter).parse(markdown);
  return ast;
};

const FrontMatter = z.object({
  title: z.string(),
  date: z.string().transform((val) => new Date(val)),
  present: z.array(z.string()),
  absent: z.array(z.string().regex(/(\w*?) (\w*?)/)).optional(),
  version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
});

interface ProcessMinutesProps {
  markdown: any;
}

export const getMetadata = ({
  markdown,
}: ProcessMinutesProps): z.infer<typeof FrontMatter> => {
  const yaml = YAML.parse(markdown.value);
  const data = FrontMatter.parse(yaml);
  return data;
};

export const processMinutes = async ({
  markdown,
}: ProcessMinutesProps): Promise<string> => {
  let tex = "";

  if (!markdown) return tex;

  switch (markdown.type) {
    case "yaml": {
      const data = getMetadata({ markdown });
      console.log(data);
      tex = `${tex}\\begin{multicols}{3}`;
      for (const attendee of [...data.present, ...(data?.absent || [])].sort(
        (a, b) => a.split(" ")[1]!.localeCompare(b.split(" ")[1]!),
      )) {
        tex = `${tex}${attendee} (${data.present.includes(attendee) ? "present" : "absent"})\\\\`;
      }
      return `${tex}\\end{multicols}`;
    }
    case "text": {
      let match = new RegExp(/^([\w ]+?): (.*)$/).exec(markdown.value);
      if (match) {
        switch (match[1]) {
          case "Motion": {
            return `${tex}\\\\\\motion{${match[2]}}`;
          }
          case "Vote": {
            return `${tex}\\vote{${match[2]?.split(" ")[0]}}{${match[2]?.split(" ")[1]}}`;
          }
          default:
            tex = `${tex}\\item\\textbf{${match[1]}:} ${match[2]}`;
            return tex;
        }
      } else {
        return `${tex}\\item ${markdown.value}`;
      }
    }
    case "list": {
      tex = `${tex}\\begin{enumerate}`;
      for (const child of markdown.children) {
        tex = `${tex}${await processMinutes({ markdown: child })}`;
      }
      return `${tex}\\end{enumerate}`;
    }
    default:
      for (const child of markdown.children) {
        tex = `${tex}${await processMinutes({ markdown: child })}`;
      }
      return tex;
  }
};

interface SaveTexProps {
  file: string;
  tex: string;
}

export const saveTex = async ({ file, tex }: SaveTexProps) => {
  const markdown = await loadMarkdown({ file });
  const metadata = getMetadata({ markdown: markdown.children[0] });
  let template = await Bun.file("template.tex").text();
  tex = template
    .replace(/%DATE%/, format(metadata.date, "PPP"))
    .replace(/%TIME%/, format(metadata.date, "p"))
    .replace(/%CONTENT%/, tex)
    .replaceAll(/\$/g, "\\$")
    .replace(/%VERSION%/, metadata.version)
    .replace(/%TITLE%/, metadata.title)
    .replace(/%SUBTITLE%/, metadata.subtitle);
  await Bun.write(`${file.slice(0, -3)}.tex`, tex);
};
