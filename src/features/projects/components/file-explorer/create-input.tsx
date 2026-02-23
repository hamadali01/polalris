import { ChevronRightIcon } from "lucide-react";
import { FileIcon, FolderIcon } from "@react-symbols/icons/utils"
import { useState } from "react";
import { getItemPadding } from "./constants";

export const CreateInput = ({
    type,
    level,
    onSubmit,
    onCancel
}: {
    type: "file" | "folder",
    level: number,
    onSubmit: (name: string) => void,
    onCancel: () => void,
}) => {
    const [value, setValue] = useState("");

    const handleSubmit = () => {
        const trimmedValue = value.trim()
        if (!trimmedValue) {
            onCancel()
        } else {
            onSubmit(trimmedValue)
        }
    }
    return (
        <div className="flex items-center gap-1 w-full h-5.5 bg-accent/30"
        style={{ paddingLeft: getItemPadding(level, type === "file") }}
        >
            <div className="flex items-center gap-0.5">
                {type === "folder" && (
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                {type === "file" && (
                    <FileIcon fileName={value} autoAssign className="size-4" />
                )}
                {type === "folder" && (
                    <FolderIcon className="size-4" folderName={value} />
                )}
                    </div>
                <input
                    autoFocus
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === "file" ? "File name" : "Folder name"}
                    className="bg-transparent text-sm outline-none flex-1 focus:ring-1 focus:ring-inset focus:ring-ring"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            onSubmit(e.currentTarget.value)
                        } else if (e.key === "Escape") {
                            onCancel()
                        }
                    }}
                    onBlur={handleSubmit}
                />
        </div>
    )
}