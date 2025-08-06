import React, { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MdArrowBack, 
  MdKey, 
  MdShare, 
  MdSettings, 
  MdSave, 
  MdCheck, 
  MdError,
  MdInfo,
  MdVisibility,
  MdVisibilityOff
} from 'react-icons/md';
import SocialMediaSettings from '@/components/social-media-settings';

interface UserSettings {
  geminiApiKey?: string;
  geminiModel?: string;
  preferences?: Record<string, any>;
  tokensUsed?: number;
  estimatedCost?: string;
  socialMediaCredentials?: Record<string, any>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('api-keys');
  const [settings, setSettings] = useState<UserSettings>({
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    preferences: {},
    tokensUsed: 0,
    estimatedCost: '$0.00',
    socialMediaCredentials: {}
  });
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showApiKey, setShowApiKey] = useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/user-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveApiSettings = async () => {
    setIsLoading(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          geminiApiKey: settings.geminiApiKey,
          geminiModel: settings.geminiModel,
          preferences: settings.preferences
        })
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialCredentialsUpdate = (credentials: any) => {
    setSettings(prev => ({
      ...prev,
      socialMediaCredentials: credentials
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <MdArrowBack className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <MdSettings className="w-5 h-5 text-gray-500" />
                <h1 className="text-xl font-semibold">Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="api-keys" className="flex items-center space-x-2">
              <MdKey className="w-4 h-4" />
              <span>API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="social-media" className="flex items-center space-x-2">
              <MdShare className="w-4 h-4" />
              <span>Social Media</span>
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gemini AI Configuration</CardTitle>
                <p className="text-sm text-gray-600">
                  Configure your Google Gemini API key and model preferences for AI-powered features.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gemini API Key</label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.geminiApiKey || ''}
                        onChange={(e) => setSettings({
                          ...settings,
                          geminiApiKey: e.target.value
                        })}
                        placeholder="Enter your Gemini API key..."
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                      >
                        {showApiKey ? (
                          <MdVisibilityOff className="w-4 h-4" />
                        ) : (
                          <MdVisibility className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gemini Model</label>
                    <Select
                      value={settings.geminiModel || 'gemini-1.5-flash'}
                      onValueChange={(value) => setSettings({
                        ...settings,
                        geminiModel: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Recommended)</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Advanced)</SelectItem>
                        <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-start space-x-3">
                      <MdInfo className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <h4 className="font-semibold text-blue-800 mb-2">How to get your Gemini API Key:</h4>
                        <ol className="space-y-1 text-blue-700 list-decimal list-inside">
                          <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                          <li>Sign in with your Google account</li>
                          <li>Click "Create API Key"</li>
                          <li>Copy the generated key and paste it above</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Usage Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {settings.tokensUsed?.toLocaleString() || '0'}
                          </div>
                          <div className="text-sm text-gray-600">Tokens Used</div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {settings.estimatedCost || '$0.00'}
                          </div>
                          <div className="text-sm text-gray-600">Estimated Cost</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={saveApiSettings}
                    disabled={isLoading || !settings.geminiApiKey}
                    className="flex items-center space-x-2"
                  >
                    {saveStatus === 'success' ? (
                      <MdCheck className="w-4 h-4" />
                    ) : saveStatus === 'error' ? (
                      <MdError className="w-4 h-4" />
                    ) : (
                      <MdSave className="w-4 h-4" />
                    )}
                    <span>
                      {isLoading ? 'Saving...' : 
                       saveStatus === 'success' ? 'Saved!' :
                       saveStatus === 'error' ? 'Error' : 'Save API Settings'}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Media Tab */}
          <TabsContent value="social-media">
            <SocialMediaSettings onSave={handleSocialCredentialsUpdate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}