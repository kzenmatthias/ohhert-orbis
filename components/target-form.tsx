"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScreenshotTarget, ScreenshotUrl } from "@/lib/db";
import { Plus, Trash2 } from "lucide-react";

interface TargetFormProps {
  target?: ScreenshotTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    target: Omit<ScreenshotTarget, "id" | "createdAt" | "updatedAt">
  ) => void;
}

export function TargetForm({
  target,
  open,
  onOpenChange,
  onSave,
}: TargetFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    requiresLogin: false,
    loginUrl: "",
    usernameSelector: "",
    passwordSelector: "",
    submitSelector: "",
    usernameEnvKey: "",
    passwordEnvKey: "",
    urls: [] as ScreenshotUrl[],
  });

  // Update form data when target changes
  useEffect(() => {
    if (target) {
      setFormData({
        name: target.name || "",
        requiresLogin: target.requiresLogin || false,
        loginUrl: target.loginUrl || "",
        usernameSelector: target.usernameSelector || "",
        passwordSelector: target.passwordSelector || "",
        submitSelector: target.submitSelector || "",
        usernameEnvKey: target.usernameEnvKey || "",
        passwordEnvKey: target.passwordEnvKey || "",
        urls: target.urls || [],
      });
    } else {
      // Reset form for new target
      setFormData({
        name: "",
        requiresLogin: false,
        loginUrl: "",
        usernameSelector: "",
        passwordSelector: "",
        submitSelector: "",
        usernameEnvKey: "",
        passwordEnvKey: "",
        urls: [],
      });
    }
  }, [target]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least one URL is provided
    if (formData.urls.length === 0) {
      alert("Please add at least one URL to screenshot.");
      return;
    }

    // Validate that all URLs have both name and url filled
    const incompleteUrls = formData.urls.some(
      (url) => !url.name.trim() || !url.url.trim()
    );
    if (incompleteUrls) {
      alert("Please fill in both name and URL for all entries.");
      return;
    }

    onSave(formData);
    onOpenChange(false);
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | ScreenshotUrl[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addUrl = () => {
    const newUrl: ScreenshotUrl = {
      targetId: 0, // Will be set when saving
      name: "",
      url: "",
    };
    setFormData((prev) => ({
      ...prev,
      urls: [...prev.urls, newUrl],
    }));
  };

  const removeUrl = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      urls: prev.urls.filter((_, i) => i !== index),
    }));
  };

  const updateUrl = (index: number, field: "name" | "url", value: string) => {
    setFormData((prev) => ({
      ...prev,
      urls: prev.urls.map((url, i) =>
        i === index ? { ...url, [field]: value } : url
      ),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {target ? "Edit Screenshot Target" : "Add Screenshot Target"}
          </DialogTitle>
          <DialogDescription>
            Configure a website to capture screenshots from. Fill in login
            details if the site requires authentication.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Target Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g., My Website"
              required
            />
          </div>

          {/* URLs Section */}
          <div className="space-y-4">
            <Label>URLs to Screenshot</Label>

            {formData.urls.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground border border-dashed rounded">
                No URLs added yet. Click &quot;Add URL&quot; to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {formData.urls.map((url, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-2 gap-2 p-3 border rounded"
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`url-name-${index}`}>Page Name</Label>
                      <Input
                        id={`url-name-${index}`}
                        value={url.name}
                        onChange={(e) =>
                          updateUrl(index, "name", e.target.value)
                        }
                        placeholder="e.g., Homepage"
                        required
                      />
                    </div>
                    <div className="space-y-2 flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`url-${index}`}>URL</Label>
                        <Input
                          id={`url-${index}`}
                          type="url"
                          value={url.url}
                          onChange={(e) =>
                            updateUrl(index, "url", e.target.value)
                          }
                          placeholder="https://example.com"
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-6"
                        onClick={() => removeUrl(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addUrl}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add URL
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="requiresLogin"
              checked={formData.requiresLogin}
              onCheckedChange={(checked) =>
                handleInputChange("requiresLogin", checked)
              }
            />
            <Label htmlFor="requiresLogin">Requires Login</Label>
          </div>

          {formData.requiresLogin && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium">Login Configuration</h4>

              <div className="space-y-2">
                <Label htmlFor="loginUrl">Login URL</Label>
                <Input
                  id="loginUrl"
                  type="url"
                  value={formData.loginUrl}
                  onChange={(e) =>
                    handleInputChange("loginUrl", e.target.value)
                  }
                  placeholder="https://example.com/login"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usernameSelector">Username Selector</Label>
                  <Input
                    id="usernameSelector"
                    value={formData.usernameSelector}
                    onChange={(e) =>
                      handleInputChange("usernameSelector", e.target.value)
                    }
                    placeholder="input[name='username']"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordSelector">Password Selector</Label>
                  <Input
                    id="passwordSelector"
                    value={formData.passwordSelector}
                    onChange={(e) =>
                      handleInputChange("passwordSelector", e.target.value)
                    }
                    placeholder="input[name='password']"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="submitSelector">Submit Button Selector</Label>
                <Input
                  id="submitSelector"
                  value={formData.submitSelector}
                  onChange={(e) =>
                    handleInputChange("submitSelector", e.target.value)
                  }
                  placeholder="button[type='submit']"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usernameEnvKey">Username Env Variable</Label>
                  <Input
                    id="usernameEnvKey"
                    value={formData.usernameEnvKey}
                    onChange={(e) =>
                      handleInputChange("usernameEnvKey", e.target.value)
                    }
                    placeholder="USERNAME_EXAMPLE"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordEnvKey">Password Env Variable</Label>
                  <Input
                    id="passwordEnvKey"
                    value={formData.passwordEnvKey}
                    onChange={(e) =>
                      handleInputChange("passwordEnvKey", e.target.value)
                    }
                    placeholder="PASSWORD_EXAMPLE"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{target ? "Update" : "Create"} Target</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
