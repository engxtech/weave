import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-workflow";
import { useToast } from "@/hooks/use-toast";
import { Settings, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState({
    geminiApiKey: "",
    geminiModel: "gemini-1.5-flash",
    multimodalAnalysis: true,
    autoSave: true,
    sendAnalytics: false,
  });

  const { toast } = useToast();
  const { data: settings, isLoading } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  useEffect(() => {
    if (settings) {
      setFormData({
        geminiApiKey: settings.geminiApiKey || "",
        geminiModel: settings.geminiModel || "gemini-1.5-flash",
        multimodalAnalysis: settings.preferences?.multimodalAnalysis ?? true,
        autoSave: settings.preferences?.autoSave ?? true,
        sendAnalytics: settings.preferences?.sendAnalytics ?? false,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        geminiApiKey: formData.geminiApiKey,
        geminiModel: formData.geminiModel,
        preferences: {
          multimodalAnalysis: formData.multimodalAnalysis,
          autoSave: formData.autoSave,
          sendAnalytics: formData.sendAnalytics,
        },
      });

      toast({
        title: "Settings saved successfully",
        description: "Your preferences have been updated.",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const isConnected = formData.geminiApiKey && formData.geminiApiKey.length > 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </DialogTitle>
          <DialogDescription>
            Configure your API keys, model preferences, and application settings.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-google-blue border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading settings...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Gemini API Configuration */}
            <div>
              <h3 className="font-medium text-google-text mb-4">Gemini AI Configuration</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="apiKey" className="text-sm font-medium text-google-text">
                    API Key
                  </Label>
                  <div className="relative mt-2">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="Enter your Gemini API key..."
                      value={formData.geminiApiKey}
                      onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your API key is stored securely and never shared
                  </p>
                </div>

                <div>
                  <Label htmlFor="model" className="text-sm font-medium text-google-text">
                    Model Version
                  </Label>
                  <Select
                    value={formData.geminiModel}
                    onValueChange={(value) => setFormData({ ...formData, geminiModel: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Default)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-tile-blue rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isConnected ? 'bg-gemini-green' : 'bg-gray-400'
                    }`}>
                      {isConnected ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-google-text">Connection Status</p>
                      <p className="text-xs text-gray-600">
                        {isConnected 
                          ? "API key configured and ready to use" 
                          : "Please enter a valid API key"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Usage Statistics */}
            <div>
              <h3 className="font-medium text-google-text mb-4">Usage Statistics</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Tokens Used:</span>
                  <Badge variant="secondary" className="font-mono">
                    {settings?.tokensUsed?.toLocaleString() || '0'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Estimated Cost:</span>
                  <Badge variant="outline" className="font-mono text-google-blue">
                    {settings?.estimatedCost || '$0.00'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  <p>• Gemini 1.5 Flash: $0.075 per 1M input tokens, $0.30 per 1M output tokens</p>
                  <p>• Gemini 1.5 Pro: $1.25 per 1M input tokens, $5.00 per 1M output tokens</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Processing Preferences */}
            <div>
              <h3 className="font-medium text-google-text mb-4">Processing Preferences</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multimodal"
                    checked={formData.multimodalAnalysis}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, multimodalAnalysis: checked as boolean })
                    }
                  />
                  <Label htmlFor="multimodal" className="text-sm text-google-text">
                    Enable multimodal analysis
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autosave"
                    checked={formData.autoSave}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, autoSave: checked as boolean })
                    }
                  />
                  <Label htmlFor="autosave" className="text-sm text-google-text">
                    Auto-save workflow progress
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="analytics"
                    checked={formData.sendAnalytics}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, sendAnalytics: checked as boolean })
                    }
                  />
                  <Label htmlFor="analytics" className="text-sm text-google-text">
                    Send usage analytics
                  </Label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="bg-google-blue hover:bg-blue-600 text-white"
              >
                {updateSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
