import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";

interface ProcessMinutesProps {
  file: string;
}

export const processMinutes = async ({ file }: ProcessMinutesProps) => {
  let markdown = await Bun.file(file).text();
  console.log({ markdown });
  let ast = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .parse(markdown);
  console.info(JSON.stringify(ast, null, 4));

  let tex = "";

  return tex;
};

interface SaveTexProps {
  file: string;
  tex: string;
}

export const saveTex = async ({ file, tex }: SaveTexProps) => {
  await Bun.write(`${file.slice(0, -3)}.tex`, tex);
};
