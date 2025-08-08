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
import { LoadingSpinner } from "@/components/ui/loading";
import { FormErrorBoundary } from "@/components/error-boundary";
import { ScreenshotTarget, ScreenshotUrl } from "@/lib/db";
import { 
  FormErrorState, 
  createFormErrorState, 
  addFormError, 
  removeFormError, 
  setGeneralError,
  clearFormErrors,
  getFieldError
} from "@/lib/error-handling";
import { Plus, Trash2, AlertCircle, X, Tag } from "lucide-react";

interface TargetFormProps {
  target?: ScreenshotTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    target: Omit<ScreenshotTarget, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
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
    category: "",
    tags: [] as string[],
    urls: [] as ScreenshotUrl[],
  });
  
  const [errors, setErrors] = useState<FormErrorState>(createFormErrorState());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTag, setNewTag] = useState("");

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
        category: target.category || "",
        tags: target.tags || [],
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
        category: "",
        tags: [],
        urls: [],
      });
    }
    
    // Clear errors when target changes
    setErrors(clearFormErrors());
    setIsSubmitting(false);
    setNewTag("");
  }, [target, open]);

  const validateForm = (): boolean => {
    let newErrors = clearFormErrors();

    // Validate name
    if (!formData.name.trim()) {
      newErrors = addFormError(newErrors, 'name', 'Target name is required');
    } else if (formData.name.length > 255) {
      newErrors = addFormError(newErrors, 'name', 'Target name must be less than 255 characters');
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(formData.name)) {
      newErrors = addFormError(newErrors, 'name', 'Target name can only contain letters, numbers, spaces, hyphens, and underscores');
    }

    // Validate URLs
    if (formData.urls.length === 0) {
      newErrors = addFormError(newErrors, 'urls', 'At least one URL is required');
    } else {
      const incompleteUrls = formData.urls.some(
        (url) => !url.name.trim() || !url.url.trim()
      );
      if (incompleteUrls) {
        newErrors = addFormError(newErrors, 'urls', 'Please fill in both name and URL for all entries');
      } else {
        // Validate individual URLs
        for (let i = 0; i < formData.urls.length; i++) {
          const url = formData.urls[i];
          try {
            new URL(url.url);
          } catch {
            newErrors = addFormError(newErrors, 'urls', `URL "${url.name}" is not a valid URL`);
            break;
          }
        }
      }
    }

    // Validate login configuration if required
    if (formData.requiresLogin) {
      if (!formData.loginUrl?.trim()) {
        newErrors = addFormError(newErrors, 'loginUrl', 'Login URL is required when login is enabled');
      } else {
        try {
          new URL(formData.loginUrl);
        } catch {
          newErrors = addFormError(newErrors, 'loginUrl', 'Login URL must be a valid URL');
        }
      }

      if (!formData.usernameSelector?.trim()) {
        newErrors = addFormError(newErrors, 'usernameSelector', 'Username selector is required when login is enabled');
      }

      if (!formData.passwordSelector?.trim()) {
        newErrors = addFormError(newErrors, 'passwordSelector', 'Password selector is required when login is enabled');
      }

      if (!formData.submitSelector?.trim()) {
        newErrors = addFormError(newErrors, 'submitSelector', 'Submit selector is required when login is enabled');
      }

      if (!formData.usernameEnvKey?.trim()) {
        newErrors = addFormError(newErrors, 'usernameEnvKey', 'Username environment variable is required when login is enabled');
      } else if (!/^[A-Z_][A-Z0-9_]*$/.test(formData.usernameEnvKey)) {
        newErrors = addFormError(newErrors, 'usernameEnvKey', 'Environment variable must be uppercase letters, numbers, and underscores only');
      }

      if (!formData.passwordEnvKey?.trim()) {
        newErrors = addFormError(newErrors, 'passwordEnvKey', 'Password environment variable is required when login is enabled');
      } else if (!/^[A-Z_][A-Z0-9_]*$/.test(formData.passwordEnvKey)) {
        newErrors = addFormError(newErrors, 'passwordEnvKey', 'Environment variable must be uppercase letters, numbers, and underscores only');
      }
    }

    setErrors(newErrors);
    return !newErrors.hasErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors(clearFormErrors());

    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors(setGeneralError(clearFormErrors(), 'Failed to save target. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | ScreenshotUrl[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (getFieldError(errors, field)) {
      setErrors(removeFormError(errors, field));
    }
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

  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setNewTag("");
    }
  };

  const removeTag = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
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

        <FormErrorBoundary>
          {errors.generalError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errors.generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Target Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="e.g., My Website"
              className={getFieldError(errors, 'name') ? 'border-destructive' : ''}
              required
            />
            {getFieldError(errors, 'name') && (
              <div className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {getFieldError(errors, 'name')}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
                placeholder="e.g., Production, Development"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1 min-h-[32px] p-2 border rounded-md">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(index)}
                        className="hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {formData.tags.length === 0 && (
                    <span className="text-muted-foreground text-sm">No tags added</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTag}
                    disabled={!newTag.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* URLs Section */}
          <div className="space-y-4">
            <Label>URLs to Screenshot</Label>
            {getFieldError(errors, 'urls') && (
              <div className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {getFieldError(errors, 'urls')}
              </div>
            )}

            {formData.urls.length === 0 ? (
              <div className={`text-center py-4 text-muted-foreground border border-dashed rounded ${
                getFieldError(errors, 'urls') ? 'border-destructive/50' : ''
              }`}>
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
                  className={getFieldError(errors, 'loginUrl') ? 'border-destructive' : ''}
                />
                {getFieldError(errors, 'loginUrl') && (
                  <div className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError(errors, 'loginUrl')}
                  </div>
                )}
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
                    className={getFieldError(errors, 'usernameSelector') ? 'border-destructive' : ''}
                  />
                  {getFieldError(errors, 'usernameSelector') && (
                    <div className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError(errors, 'usernameSelector')}
                    </div>
                  )}
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
                    className={getFieldError(errors, 'passwordSelector') ? 'border-destructive' : ''}
                  />
                  {getFieldError(errors, 'passwordSelector') && (
                    <div className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError(errors, 'passwordSelector')}
                    </div>
                  )}
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
                  className={getFieldError(errors, 'submitSelector') ? 'border-destructive' : ''}
                />
                {getFieldError(errors, 'submitSelector') && (
                  <div className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {getFieldError(errors, 'submitSelector')}
                  </div>
                )}
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
                    className={getFieldError(errors, 'usernameEnvKey') ? 'border-destructive' : ''}
                  />
                  {getFieldError(errors, 'usernameEnvKey') && (
                    <div className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError(errors, 'usernameEnvKey')}
                    </div>
                  )}
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
                    className={getFieldError(errors, 'passwordEnvKey') ? 'border-destructive' : ''}
                  />
                  {getFieldError(errors, 'passwordEnvKey') && (
                    <div className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {getFieldError(errors, 'passwordEnvKey')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoadingSpinner size="sm" className="mr-2" />}
              {target ? "Update" : "Create"} Target
            </Button>
          </DialogFooter>
        </form>
        </FormErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
