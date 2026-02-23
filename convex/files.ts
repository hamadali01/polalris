import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./auth";
import { Id } from "./_generated/dataModel";
import { cp } from "fs";
import { th } from "date-fns/locale";


export const getFiles = query({
    args: { projectId: v.id("projects") },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)

        const project = await ctx.db.get("projects", args.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");
        return await ctx.db
            .query("files")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect()
    }
})

export const getFile = query({
    args: { id: v.id("files") },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)
        
        const file = await ctx.db.get("files", args.id)
        if (!file) throw new Error("File not found");
        
        const project = await ctx.db.get("projects", file.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");
        return file
    }
})

export const getFolderContents = query({
    args: {
        projectId: v.id("projects"),
        parentId: v.optional(v.id("files"))
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)

        const project = await ctx.db.get("projects", args.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");
        const files = await ctx.db
        .query("files")
        .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId)
        .eq("parentId", args.parentId)
        )
        .collect();

        // Sort: folders first, then files, alphabetically within each group

        return files.sort((a, b) => {
            // If one is a folder and the other isn't, put the folder first
            if (a.type === "folder" && b.type === "file") return -1;
            if (a.type === "file" && b.type === "folder") return 1;

            // If both are folders or both are files, sort alphabetically
            return a.name.localeCompare(b.name);
        })
    }
})

export const createFile = mutation({
    args: {
        projectId: v.id("projects"),
        parentId: v.optional(v.id("files")),
        name: v.string(),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)

        const project = await ctx.db.get("projects", args.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");

        // Check if file with same name already exists in this parent folder
        const files = await ctx.db
        .query("files")
        .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId)
        .eq("parentId", args.parentId)
        )
        .collect();

        const exists = files.find((file) => file.name === args.name && file.type === "file");

        if (exists) throw new Error("File with this name already exists in this folder");

        const now = Date.now();

        await ctx.db.insert("files", {
            projectId: args.projectId,
            parentId: args.parentId,
            name: args.name,
            type: "file",
            content: args.content,
            updatedAt: now,
        })
        await ctx.db.patch("projects", args.projectId, { updatedAt: now })
    }
})

export const createFolder = mutation({
    args: {
        projectId: v.id("projects"),
        parentId: v.optional(v.id("files")),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)

        const project = await ctx.db.get("projects", args.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");

        // Check if folder with same name already exists in this parent folder
        const files = await ctx.db
        .query("files")
        .withIndex("by_project_parent", (q) =>
        q.eq("projectId", args.projectId)
        .eq("parentId", args.parentId)
        )
        .collect();

        const exists = files.find((file) => file.name === args.name && file.type === "folder");

        if (exists) throw new Error("Folder with this name already exists in this folder");

        const now = Date.now()

        await ctx.db.insert("files", {
            projectId: args.projectId,
            parentId: args.parentId,
            name: args.name,
            type: "folder",
            updatedAt: now,
        })
        await ctx.db.patch("projects", args.projectId, { updatedAt: now })
    }
})

export const renameFile = mutation({
    args: {
        id: v.id("files"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)

        const file = await ctx.db.get("files", args.id)
        if (!file) throw new Error("File not found");

        const project = await ctx.db.get("projects", file.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");

        // Check if file with same name already exists in this parent folder
        const files = await ctx.db
        .query("files")
        .withIndex("by_project_parent", (q) =>
        q.eq("projectId", file.projectId)
        .eq("parentId", file.parentId)
        )
        .collect();

        const exists = files.find((f) => f.name === args.name && f.type === file.type && f._id !== args.id);

        if (exists) throw new Error(`${file.type === "file" ? "File" : "Folder"} with this name already exists in this folder`);

        const now = Date.now();

        await ctx.db.patch("files", args.id, {
            name: args.name,
            updatedAt: now,
        })
        await ctx.db.patch("projects", file.projectId, { updatedAt: now })
    }
})

export const deleteFile = mutation({
    args: {
        id: v.id("files"),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)

        const file = await ctx.db.get("files", args.id)
        if (!file) throw new Error("File not found");

        const project = await ctx.db.get("projects", file.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");

    //    Recursively delete file/folder and all decendants
    const deleteFileRecursive = async (fileId: Id<"files">) => {
            const file = await ctx.db.get("files", fileId);
            if (!file) return;

            if (file.type === "folder") {
                const children = await ctx.db
                    .query("files")
                    .withIndex("by_project_parent", (q) => q.eq("projectId", file.projectId).eq("parentId", fileId))
                    .collect();
                for (const child of children) {
                    await deleteFileRecursive(child._id);
                }
            }

            // Delete storage file if exists

            if (file.storageId) {
                await ctx.storage.delete(file.storageId);
            }

            await ctx.db.delete("files", fileId);
        };

        await deleteFileRecursive(args.id)
        await ctx.db.patch("projects", file.projectId, { updatedAt: Date.now() })
    }
})

export const updateFile = mutation({
    args: {
        id: v.id("files"),
        content: v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await verifyAuth(ctx)

        const file = await ctx.db.get("files", args.id)
        if (!file) throw new Error("File not found");

        const project = await ctx.db.get("projects", file.projectId)
        if (!project) throw new Error("Project not found");
        if (project.ownerId !== identity.subject) throw new Error("Not authorized to access this project");

        if (file.type !== "file") throw new Error("Folders cannot have content");

        const now = Date.now();

        await ctx.db.patch("files", args.id, {
            content: args.content,
            updatedAt: now,
        })
        await ctx.db.patch("projects", file.projectId, { updatedAt: now })
    }
})