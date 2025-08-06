import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  MdClose, 
  MdShare, 
  MdCheck,
  MdError,
  MdSettings,
  MdInfo
} from 'react-icons/md';
import { 
  FaInstagram, 
  FaTwitter, 
  FaReddit, 
  FaTiktok,
  FaYoutube
} from 'react-icons/fa';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoData: {
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl?: string;
    hashtags: string[];
  };
}

interface ShareResult {
  success: boolean;
  platform: string;
  url?: string;
  error?: string;
}

const platformConfigs = {
  youtube: {
    name: 'YouTube',
    icon: FaYoutube,
    color: 'text-red-600',
    setup: `
1. Go to Google Cloud Console (https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Add your domain to authorized origins
6. Copy Client ID, Client Secret, and API Key
7. Generate refresh token through OAuth flow
    `
  },
  instagram: {
    name: 'Instagram',
    icon: FaInstagram,
    color: 'text-pink-600',
    setup: `
1. Create a Facebook Developer account (https://developers.facebook.com/)
2. Create a new app and add Instagram Basic Display product
3. Convert to Instagram Business account
4. Get long-lived access token
5. Find your Business Account ID in Meta Business Suite
6. Ensure your video meets Instagram requirements (max 60 seconds)
    `
  },
  twitter: {
    name: 'Twitter',
    icon: FaTwitter,
    color: 'text-blue-500',
    setup: `
1. Apply for Twitter Developer account (https://developer.twitter.com/)
2. Create a new app in Developer Portal
3. Generate API keys and tokens
4. Enable OAuth 1.0a and OAuth 2.0
5. Set app permissions to "Read and Write"
6. Copy API Key, Secret, Access Token, and Bearer Token
    `
  },
  reddit: {
    name: 'Reddit',
    icon: FaReddit,
    color: 'text-orange-600',
    setup: `
1. Go to Reddit App Preferences (https://www.reddit.com/prefs/apps)
2. Click "Create App" and select "script"
3. Note your Client ID (under app name) and Client Secret
4. Use your Reddit username and password
5. Create a unique User-Agent string
6. Join relevant subreddits for your content
    `
  },
  tiktok: {
    name: 'TikTok',
    icon: FaTiktok,
    color: 'text-black',
    setup: `
1. Apply for TikTok for Developers (https://developers.tiktok.com/)
2. Create a new app and get approved
3. Implement TikTok Login for users
4. Get Client Key and Client Secret
5. Obtain user access tokens through OAuth
6. Ensure videos meet TikTok guidelines (15s-3min)
    `
  }
};

export default function SocialShareModal({ isOpen, onClose, videoData }: SocialShareModalProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [shareContent, setShareContent] = useState({
    title: videoData.title || '',
    description: videoData.description || '',
    hashtags: videoData.hashtags?.join(' ') || '',
    privacy: 'public' as 'public' | 'private' | 'unlisted'
  });
  const [isSharing, setIsSharing] = useState(false);
  const [shareResults, setShareResults] = useState<ShareResult[]>([]);
  const [showSetupInfo, setShowSetupInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleShare = async () => {
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform');
      return;
    }

    setIsSharing(true);
    setShareResults([]);

    try {
      const response = await fetch('/api/social-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          content: {
            ...shareContent,
            videoPath: videoData.videoUrl,
            hashtags: shareContent.hashtags.split(' ').filter(h => h.trim())
          }
        })
      });

      if (!response.ok) {
        throw new Error('Sharing failed');
      }

      const results = await response.json();
      setShareResults(results.results || []);

    } catch (error) {
      console.error('Share error:', error);
      setShareResults([{
        success: false,
        platform: 'All',
        error: 'Failed to share content'
      }]);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MdShare className="w-5 h-5" />
              <span>Share to Social Media</span>
            </div>
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
            >
              <MdClose className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Platform Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Select Platforms</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(platformConfigs).map(([key, config]) => {
                const Icon = config.icon;
                const isSelected = selectedPlatforms.includes(key);
                
                return (
                  <div key={key} className="relative">
                    <Button
                      onClick={() => handlePlatformToggle(key)}
                      variant={isSelected ? "default" : "outline"}
                      className="w-full h-16 flex flex-col items-center justify-center space-y-1"
                    >
                      <Icon className={`w-6 h-6 ${config.color}`} />
                      <span className="text-sm">{config.name}</span>
                    </Button>
                    
                    <Button
                      onClick={() => setShowSetupInfo(showSetupInfo === key ? null : key)}
                      size="sm"
                      variant="ghost"
                      className="absolute -top-2 -right-2 w-6 h-6 p-0"
                    >
                      <MdInfo className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Setup Information */}
          {showSetupInfo && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <MdSettings className="w-5 h-5" />
                  <span>Setup Guide for {platformConfigs[showSetupInfo as keyof typeof platformConfigs].name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm whitespace-pre-wrap text-gray-700">
                  {platformConfigs[showSetupInfo as keyof typeof platformConfigs].setup}
                </pre>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> You need to configure API credentials in Settings before using this platform.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Content Customization */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Customize Content</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={shareContent.title}
                onChange={(e) => setShareContent({
                  ...shareContent,
                  title: e.target.value
                })}
                placeholder="Enter post title..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={shareContent.description}
                onChange={(e) => setShareContent({
                  ...shareContent,
                  description: e.target.value
                })}
                placeholder="Enter post description..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Hashtags</label>
              <Input
                value={shareContent.hashtags}
                onChange={(e) => setShareContent({
                  ...shareContent,
                  hashtags: e.target.value
                })}
                placeholder="#viral #video #content"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Privacy</label>
              <Select
                value={shareContent.privacy}
                onValueChange={(value: any) => setShareContent({
                  ...shareContent,
                  privacy: value
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Share Results */}
          {shareResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Share Results</h3>
              {shareResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${
                    result.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {result.success ? (
                        <MdCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <MdError className="w-5 h-5 text-red-600" />
                      )}
                      <span className="font-medium">{result.platform}</span>
                    </div>
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View Post
                      </a>
                    )}
                  </div>
                  {result.error && (
                    <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <Button
              onClick={handleShare}
              disabled={isSharing || selectedPlatforms.length === 0}
              className="flex-1"
            >
              <MdShare className="w-4 h-4 mr-2" />
              {isSharing ? 'Sharing...' : `Share to ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}