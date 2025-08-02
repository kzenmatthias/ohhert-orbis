'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScreenshotTarget } from '@/lib/db';

interface TargetFormProps {
  target?: ScreenshotTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (target: Omit<ScreenshotTarget, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export function TargetForm({ target, open, onOpenChange, onSave }: TargetFormProps) {
  const [formData, setFormData] = useState({
    name: target?.name || '',
    url: target?.url || '',
    requiresLogin: target?.requiresLogin || false,
    loginUrl: target?.loginUrl || '',
    usernameSelector: target?.usernameSelector || '',
    passwordSelector: target?.passwordSelector || '',
    submitSelector: target?.submitSelector || '',
    usernameEnvKey: target?.usernameEnvKey || '',
    passwordEnvKey: target?.passwordEnvKey || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {target ? 'Edit Screenshot Target' : 'Add Screenshot Target'}
          </DialogTitle>
          <DialogDescription>
            Configure a website to capture screenshots from. Fill in login details if the site requires authentication.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Google Homepage"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                placeholder="https://example.com"
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="requiresLogin"
              checked={formData.requiresLogin}
              onCheckedChange={(checked) => handleInputChange('requiresLogin', checked)}
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
                  onChange={(e) => handleInputChange('loginUrl', e.target.value)}
                  placeholder="https://example.com/login"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usernameSelector">Username Selector</Label>
                  <Input
                    id="usernameSelector"
                    value={formData.usernameSelector}
                    onChange={(e) => handleInputChange('usernameSelector', e.target.value)}
                    placeholder="input[name='username']"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordSelector">Password Selector</Label>
                  <Input
                    id="passwordSelector"
                    value={formData.passwordSelector}
                    onChange={(e) => handleInputChange('passwordSelector', e.target.value)}
                    placeholder="input[name='password']"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="submitSelector">Submit Button Selector</Label>
                <Input
                  id="submitSelector"
                  value={formData.submitSelector}
                  onChange={(e) => handleInputChange('submitSelector', e.target.value)}
                  placeholder="button[type='submit']"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usernameEnvKey">Username Env Variable</Label>
                  <Input
                    id="usernameEnvKey"
                    value={formData.usernameEnvKey}
                    onChange={(e) => handleInputChange('usernameEnvKey', e.target.value)}
                    placeholder="USERNAME_EXAMPLE"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordEnvKey">Password Env Variable</Label>
                  <Input
                    id="passwordEnvKey"
                    value={formData.passwordEnvKey}
                    onChange={(e) => handleInputChange('passwordEnvKey', e.target.value)}
                    placeholder="PASSWORD_EXAMPLE"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {target ? 'Update' : 'Create'} Target
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}