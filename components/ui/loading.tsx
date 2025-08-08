"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8",
  };

  return (
    <Loader2 
      className={cn("animate-spin", sizeClasses[size], className)} 
    />
  );
}

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingState({ 
  message = "Loading...", 
  size = "md",
  className 
}: LoadingStateProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <LoadingSpinner size={size} />
      <span className="text-muted-foreground">{message}</span>
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export function LoadingOverlay({ 
  isLoading, 
  message = "Loading...", 
  children 
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
          <LoadingState message={message} />
        </div>
      )}
    </div>
  );
}

interface ProgressIndicatorProps {
  progress: number; // 0-100
  message?: string;
  className?: string;
}

export function ProgressIndicator({ 
  progress, 
  message,
  className 
}: ProgressIndicatorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {message && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{message}</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}