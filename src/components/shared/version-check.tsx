"use client"

import { useEffect } from 'react'

/**
 * This component monitors for Server Action failures that indicate
 * a version mismatch between the client and server.
 * When detected, it forces a hard reload to get the latest code.
 */
export function VersionCheck() {
  useEffect(() => {
    // Store the build timestamp when the page loads
    const loadTime = Date.now()
    
    // Listen for unhandled promise rejections (where Server Action errors often appear)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason?.message || event.reason?.toString() || ''
      
      // Check for Server Action not found error
      if (
        message.includes('Failed to find Server Action') ||
        message.includes('older or newer deployment')
      ) {
        console.warn('[VersionCheck] Detected version mismatch, forcing reload...')
        
        // Prevent the error from showing in console
        event.preventDefault()
        
        // Force a hard reload
        window.location.reload()
      }
    }
    
    // Also patch fetch to catch Server Action errors
    const originalFetch = window.fetch
    window.fetch = async function(input, init) {
      try {
        const response = await originalFetch.apply(this, [input, init] as any)
        
        // Check if this is a Server Action response with an error
        if (
          init?.method === 'POST' &&
          (response.status === 500 || response.status === 502)
        ) {
          // Try to clone and read the response to check for version mismatch
          try {
            const cloned = response.clone()
            const text = await cloned.text()
            
            if (
              text.includes('Failed to find Server Action') ||
              text.includes('older or newer deployment')
            ) {
              console.warn('[VersionCheck] Server Action mismatch detected in response')
              window.location.reload()
              // Return a response that won't break the calling code
              return new Response(JSON.stringify({ error: 'reloading' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              })
            }
          } catch {
            // Ignore clone/read errors
          }
        }
        
        return response
      } catch (error: any) {
        // Check if the error message indicates a version mismatch
        const message = error?.message || ''
        if (
          message.includes('Failed to find Server Action') ||
          message.includes('older or newer deployment')
        ) {
          console.warn('[VersionCheck] Server Action mismatch in fetch error')
          window.location.reload()
        }
        throw error
      }
    }
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.fetch = originalFetch
    }
  }, [])
  
  return null
}

