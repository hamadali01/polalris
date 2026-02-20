"use client";

import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

export default function DemoPage() {
  const {userId} = useAuth()
  const [loading, setLoading] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const handleBlocking = async () => {
    setLoading(true)
    await fetch('/api/demo/blocking', { method: "POST" })
    setLoading(false)
  }
  const handleBackground = async () => {
    setLoading2(true)
    await fetch('/api/demo/background', { method: "POST" })
    setLoading2(false)
  }

  // 1) Client error - throws in the browser
  const handleClientError = () => {
    Sentry.logger.info("User trying to hit client function", {userId})
    throw new Error("Client Error: Something went wrong in the browser!")
  };

  // 2) API error - triggers server side error
  const handleAPIError = async () => {
    const response = await fetch('/api/demo/error', { method: "POST" })
    // const data = await response.json()
    // console.log(data)
  };

  // 3) Inngest error - triggers error in background jobs
  const handleInngestError = async () => {
    const response = await fetch('/api/demo/inngest-error', { method: "POST" })
    // const data = await response.json()
    // console.log(data)
  };

  return (
    <div className="p-8 space-x-4">
      <Button disabled={loading} onClick={handleBlocking}>
        {loading ? "Loading..." : "Generate Text"}
      </Button>
      <Button disabled={loading2} onClick={handleBackground}>
        {loading2 ? "Loading..." : "Background Text"}
      </Button>
      <Button variant="destructive" onClick={handleClientError}>
        Client Error
      </Button>
      <Button variant="destructive" onClick={handleAPIError}>
        API Error
      </Button>
      <Button variant="destructive" onClick={handleInngestError}>
        Inngest Error
      </Button>
    </div>
  );
}