import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  MdSave, 
  MdVisibility, 
  MdVisibilityOff,
  MdInfo,
  MdCheck,
  MdError,
  MdVideoLibrary
} from 'react-icons/md';
import { 
  FaInstagram, 
  FaTwitter, 
  FaReddit, 
  FaTiktok,
  FaYoutube
} from 'react-icons/fa';

interface SocialMediaCredentials {
  youtube?: {
    apiKey: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  instagram?: {
    accessToken: string;
    businessAccountId: string;
  };
  twitter?: {
    apiKey: string;
    apiSecretKey: string;
    accessToken: string;
    accessTokenSecret: string;
    bearerToken: string;
  };
  reddit?: {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
    userAgent: string;
  };
  tiktok?: {
    clientKey: string;
    clientSecret: string;
    accessToken: string;
  };
}

interface SocialMediaSettingsProps {
  onSave?: (credentials: SocialMediaCredentials) => void;
}

const platformConfigs = {
  youtube: {
    name: 'YouTube',
    icon: FaYoutube,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'refreshToken', label: 'Refresh Token', type: 'password' }
    ],
    setupGuide: `
**YouTube Data API Setup:**

1. **Google Cloud Console**
   - Go to https://console.cloud.google.com/
   - Create new project or select existing one
   - Enable "YouTube Data API v3"

2. **Create Credentials**
   - Go to "Credentials" → "Create Credentials" → "API Key"
   - Copy the API Key

3. **OAuth 2.0 Setup**
   - Create "OAuth 2.0 Client ID"
   - Add your domain to authorized origins
   - Download client configuration

4. **Get Refresh Token**
   - Use OAuth playground or implement OAuth flow
   - Get authorization code and exchange for refresh token

**Required Scopes:** https://www.googleapis.com/auth/youtube.upload
    `
  },
  instagram: {
    name: 'Instagram',
    icon: FaInstagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 border-pink-200',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password' },
      { key: 'businessAccountId', label: 'Business Account ID', type: 'text' }
    ],
    setupGuide: `
**Instagram Basic Display API Setup:**

1. **Facebook Developer Account**
   - Go to https://developers.facebook.com/
   - Create new app → "Consumer" type
   - Add "Instagram Basic Display" product

2. **Business Account**
   - Convert your Instagram to Business account
   - Connect to Facebook Page

3. **Get Access Token**
   - Generate long-lived access token (60 days)
   - Use Graph API Explorer for testing

4. **Find Business Account ID**
   - Use: https://graph.facebook.com/me/accounts?access_token=YOUR_TOKEN
   - Find your page and get Instagram Business Account ID

**Note:** Videos must be under 60 seconds for Instagram
    `
  },
  twitter: {
    name: 'Twitter',
    icon: FaTwitter,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 border-blue-200',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'apiSecretKey', label: 'API Secret Key', type: 'password' },
      { key: 'accessToken', label: 'Access Token', type: 'password' },
      { key: 'accessTokenSecret', label: 'Access Token Secret', type: 'password' },
      { key: 'bearerToken', label: 'Bearer Token', type: 'password' }
    ],
    setupGuide: `
**Twitter API v2 Setup:**

1. **Developer Account**
   - Apply at https://developer.twitter.com/
   - Create new app in Developer Portal

2. **App Configuration**
   - Set app permissions to "Read and Write"
   - Enable OAuth 1.0a and OAuth 2.0
   - Add callback URLs

3. **Generate Keys**
   - API Key and Secret (Consumer Keys)
   - Access Token and Secret
   - Bearer Token for API v2

4. **Verify Permissions**
   - Ensure app can upload media
   - Test with Twitter API endpoints

**Video Requirements:** Max 512MB, MP4 format recommended
    `
  },
  reddit: {
    name: 'Reddit',
    icon: FaReddit,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'username', label: 'Reddit Username', type: 'text' },
      { key: 'password', label: 'Reddit Password', type: 'password' },
      { key: 'userAgent', label: 'User Agent', type: 'text' }
    ],
    setupGuide: `
**Reddit API Setup:**

1. **Create App**
   - Go to https://www.reddit.com/prefs/apps
   - Click "Create App" → Select "script"
   - Note Client ID (under app name)

2. **Get Credentials**
   - Client Secret from app settings
   - Your Reddit username and password
   - Create unique User-Agent: "YourApp/1.0 by YourUsername"

3. **Subreddit Rules**
   - Join relevant subreddits
   - Read posting rules and guidelines
   - Some subreddits require account age/karma

4. **Best Practices**
   - Follow 90% rule (90% non-promotional content)
   - Engage with community before posting
   - Respect subreddit-specific rules

**Note:** Reddit has strict spam policies - use responsibly
    `
  },
  tiktok: {
    name: 'TikTok',
    icon: FaTiktok,
    color: 'text-black',
    bgColor: 'bg-gray-50 border-gray-200',
    fields: [
      { key: 'clientKey', label: 'Client Key', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
      { key: 'accessToken', label: 'Access Token', type: 'password' }
    ],
    setupGuide: `
**TikTok for Developers Setup:**

1. **Developer Account**
   - Apply at https://developers.tiktok.com/
   - Create new app and wait for approval

2. **App Configuration**
   - Add "Video Management" permission
   - Configure redirect URIs
   - Get Client Key and Secret

3. **User Authorization**
   - Implement TikTok Login for users
   - Get user access tokens through OAuth
   - Handle token refresh

4. **Content Guidelines**
   - Videos: 15 seconds to 3 minutes
   - Max file size: 500MB
   - Supported formats: MP4, MOV, MPEG, AVI, WEBM

**Note:** Requires app review and approval from TikTok
    `
  }
};

export default function SocialMediaSettings({ onSave }: SocialMediaSettingsProps) {
  const [credentials, setCredentials] = useState<SocialMediaCredentials>({});
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({});
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Load existing credentials
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const response = await fetch('/api/user-settings');
      if (response.ok) {
        const settings = await response.json();
        if (settings.socialMediaCredentials) {
          setCredentials(settings.socialMediaCredentials);
        }
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
  };

  const handleCredentialChange = (platform: string, field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform as keyof SocialMediaCredentials],
        [field]: value
      }
    }));
  };

  const togglePasswordVisibility = (platformField: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [platformField]: !prev[platformField]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          socialMediaCredentials: credentials
        })
      });

      if (response.ok) {
        setSaveStatus('success');
        onSave?.(credentials);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const isPlatformConfigured = (platform: string) => {
    const platformCreds = credentials[platform as keyof SocialMediaCredentials];
    if (!platformCreds) return false;
    
    const config = platformConfigs[platform as keyof typeof platformConfigs];
    return config.fields.every(field => {
      const value = (platformCreds as any)[field.key];
      return value && value.trim().length > 0;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Social Media Integration</h2>
          <p className="text-gray-600">Configure API credentials for one-click sharing</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
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
            {isSaving ? 'Saving...' : 
             saveStatus === 'success' ? 'Saved!' :
             saveStatus === 'error' ? 'Error' : 'Save Settings'}
          </span>
        </Button>
      </div>

      <div className="grid gap-6">
        {Object.entries(platformConfigs).map(([platform, config]) => {
          const Icon = config.icon;
          const isConfigured = isPlatformConfigured(platform);
          const isExpanded = expandedPlatform === platform;
          
          return (
            <Card key={platform} className={isConfigured ? config.bgColor : 'border-gray-200'}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => setExpandedPlatform(isExpanded ? null : platform)}
              >
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-6 h-6 ${config.color}`} />
                    <span>{config.name}</span>
                    {isConfigured && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Configured
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                  >
                    <MdInfo className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Credentials Form */}
                    <div className="space-y-4">
                      <h4 className="font-semibold">API Credentials</h4>
                      {config.fields.map(field => {
                        const fieldKey = `${platform}.${field.key}`;
                        const isPassword = field.type === 'password';
                        const showPassword = showPasswords[fieldKey];
                        const value = (credentials[platform as keyof SocialMediaCredentials] as any)?.[field.key] || '';
                        
                        return (
                          <div key={field.key} className="space-y-2">
                            <label className="text-sm font-medium">{field.label}</label>
                            <div className="relative">
                              <Input
                                type={isPassword && !showPassword ? 'password' : 'text'}
                                value={value}
                                onChange={(e) => handleCredentialChange(platform, field.key, e.target.value)}
                                placeholder={`Enter ${field.label.toLowerCase()}...`}
                                className="pr-10"
                              />
                              {isPassword && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => togglePasswordVisibility(fieldKey)}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-auto p-1"
                                >
                                  {showPassword ? (
                                    <MdVisibilityOff className="w-4 h-4" />
                                  ) : (
                                    <MdVisibility className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Setup Guide */}
                    <div className="space-y-4">
                      <h4 className="font-semibold">Setup Instructions</h4>
                      <div className="bg-gray-50 p-4 rounded border text-sm">
                        <pre className="whitespace-pre-wrap text-gray-700">
                          {config.setupGuide}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <MdInfo className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <h4 className="font-semibold text-yellow-800 mb-2">Important Security Notes:</h4>
              <ul className="space-y-1 text-yellow-700">
                <li>• API credentials are stored securely and encrypted</li>
                <li>• Never share your API keys publicly</li>
                <li>• Revoke access if you suspect compromise</li>
                <li>• Each platform has rate limits and usage policies</li>
                <li>• Some platforms require app review for production use</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}