import {
    Decoration,
    DecorationSet,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
    keymap,
} from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

import { fetcher } from "./fetcher";

// StateEffect: A way to send "messages" to update states.
// We define one effect type for setting the suggestion text.
const setSuggestionEffect = StateEffect.define<string | null>();

// StateField: Holds our suggestion state in the editor.
// -create(): Returns the initial value when the editor loads.
// -update(): Called on every transaction (Keystroke, etc.) to potentially update the value.
const suggestionState = StateField.define<string | null>({
    create() {
        return null;
    },
    update(value, transaction) {
        // Check each effect in this transaction
        // If we find our setSuggestionEffect, return it's new value
        // Otherwise, keep the current value unchanged
        for (const effect of transaction.effects) {
            if(effect.is(setSuggestionEffect)) {
                return effect.value
            }
        }
        return value;
    },
});

// WidgetType: Creates custom DOM elements to display in the editor.
// -toDOM() is called by CodeMirror to create the actual HTML element.
class SuggestionWidget extends WidgetType {
    constructor(readonly suggestion: string) {
        super()
    }

    toDOM() {
        // Create a span element with the ghost text
        const span = document.createElement("span")
        span.textContent = this.suggestion
        span.style.opacity = "0.4" // Ghost text appearance
        span.style.pointerEvents = "none"
        return span
    }
}

let debounceTimer: number | null = null;
let isWaitingForSuggestion = false;
const DEBOUNCE_DELAY = 300;

let currentAbortController: AbortController | null = null;

const generatePayload = (view: EditorView, fileName: string) => {
    const code = view.state.doc.toString();

    if (!code || code.trim().length === 0) return null;

    const cursorPosition = view.state.selection.main.head;
    const currentLine = view.state.doc.lineAt(cursorPosition);
    const currentInLine = cursorPosition - currentLine.from;

    const previousLines: string[] = [];

    const previousLinesToFetch = Math.min(5, currentLine.number - 1);

    for (let i = previousLinesToFetch; i >= 1; i--) {
        previousLines.push(view.state.doc.line(currentLine.number - i).text);
    };

    const nextLines: string[] = [];
    const totalLines = view.state.doc.lines;
    const linesToFetch = Math.min(5, totalLines - currentLine.number);

    for(let i = 1; i <= linesToFetch; i++) {
        nextLines.push(view.state.doc.line(currentLine.number + i).text);
    }
    return {
        fileName,
        code,
        currentLine: currentLine.text,
        previousLines: previousLines.join("\n"),
        textBeforeCursor: currentLine.text.substring(0, currentInLine),
        textAfterCursor: currentLine.text.substring(currentInLine),
        lineNumber: currentLine.number,
        nextLines: nextLines.join("\n"),
    }
}

const createDebouncePlugin = (fileName: string) => {
    return ViewPlugin.fromClass(
        class {
            constructor(view: EditorView) {
                // Called once when plugin is created
               this.triggerSuggestion(view)
            }

            update(update: ViewUpdate) {
               if (update.docChanged || update.selectionSet) {
                this.triggerSuggestion(update.view)
               }
            }

            triggerSuggestion(view: EditorView) {
                if (debounceTimer !== null) {
                    clearTimeout(debounceTimer);
                }

                if (currentAbortController !== null) {
                    currentAbortController.abort()
                }

                isWaitingForSuggestion = true;

                debounceTimer = window.setTimeout(async () => {
                    const payload = generatePayload(view, fileName);
                    if(!payload) {
                        isWaitingForSuggestion = false;
                        view.dispatch({
                            effects: setSuggestionEffect.of(null)
                        })
                        return;
                    }
                    currentAbortController = new AbortController();
                    const suggestion = await fetcher(payload, currentAbortController.signal);

                    isWaitingForSuggestion = false;
                    view.dispatch({
                        effects: setSuggestionEffect.of(suggestion)
                    })
                }, DEBOUNCE_DELAY)
            }
            destroy() {
                if (debounceTimer !== null) {
                    clearTimeout(debounceTimer)
                }
                if(currentAbortController !== null) {
                    currentAbortController.abort()
                }
            }
        }
    )
}

const renderPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            // Initial decorations (ghost text)
            this.decorations = this.build(view)
        }

        update(update: ViewUpdate) {
            // Rebuild decorations if the document or selections change or cursor moved
            const suggestionChanged = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(setSuggestionEffect)))
            const shouldRebuild = update.docChanged || update.selectionSet || suggestionChanged
            if(shouldRebuild) {
                this.decorations = this.build(update.view)
            }
        }

        build(view: EditorView) {
            if (isWaitingForSuggestion) {
                return Decoration.none;
            }
            // Get current suggestion from state
            const suggestion = view.state.field(suggestionState)
            if(!suggestion) return Decoration.none // No suggestion, no decorations

            // Create a widget for the suggestion at the cursor position
            const cursor = view.state.selection.main.head;
            return Decoration.set([
                Decoration.widget({
                    widget: new SuggestionWidget(suggestion),
                    side: 1, // Place it after the cursor (side: 1) not before (side: -1)
                }).range(cursor)
            ])
        }
    },
    {
        decorations: (value) => value.decorations, // Expose decorations to the editor
    }
);

const acceptSuggestionKeyMap = keymap.of([{
    key: "Tab",
    run(view: EditorView) {
        // Get current suggestion from state
        const suggestion = view.state.field(suggestionState)
        if(!suggestion) return false // Nothing to accept

        // Insert the suggestion at the cursor position
        const cursor = view.state.selection.main.head;
        view.dispatch({
            changes: {
                from: cursor,
                insert: suggestion,
            },
            // Also update the state to clear the suggestion
            selection: { anchor: cursor + suggestion.length }, // Move cursor after inserted text
            effects: setSuggestionEffect.of(null)
        })
        return true; // Handled
    }
}])

export const suggestion = (fileName: string) => [
    suggestionState, // Our state storage
    createDebouncePlugin(fileName), // Triggers suggestions on typing
    renderPlugin, // Renders the ghost text
    acceptSuggestionKeyMap, // Tab to accept
]