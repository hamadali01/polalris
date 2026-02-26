import { Extension } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";

export const getLanguageExtension = (fileName: string):Extension => {
    const extensions = {
        js: javascript(),
        jsx: javascript({ jsx: true }),
        ts: javascript({ typescript: true }),
        tsx: javascript({ typescript: true, jsx: true }),
        html: html(),
        css: css(),
        json: json(),
        md: markdown(),
        mdx: markdown(),
        py: python(),
    }
    const ext = fileName.split(".").pop()?.toLocaleLowerCase()

    return extensions[ext as keyof typeof extensions] || javascript()
}