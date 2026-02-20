"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button";

const Page = () => {
  const projects = useQuery(api.projects.get)
  const createProject = useMutation(api.projects.create)
  return (
    <div className="flex flex-col gap-2 p-4">
      <Button onClick={() => createProject({
        name: "Project"
      })}>
        Add New
      </Button>
      {projects?.map((project) => (
        <div className="flex flex-col border rounded p-2" key={project._id}>
          <h3>{project.name}</h3>
          <p>Owner ID: {project.ownerId}</p>
        </div>
      ))}
    </div>
  )
}

export default Page;