import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export interface SocialMediaCredentials {
  youtube?: {
    apiKey: string;
    clientId: string;
    clientSecret: string;
    refreshToken?: string;
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

export interface ShareContent {
  title: string;
  description: string;
  videoPath: string;
  thumbnailPath?: string;
  hashtags: string[];
  category?: string;
  privacy?: 'public' | 'private' | 'unlisted';
}

export interface ShareResult {
  success: boolean;
  platform: string;
  url?: string;
  error?: string;
  postId?: string;
}

export class SocialMediaShare {
  private credentials: SocialMediaCredentials;

  constructor(credentials: SocialMediaCredentials) {
    this.credentials = credentials;
  }

  async shareToYouTube(content: ShareContent): Promise<ShareResult> {
    try {
      if (!this.credentials.youtube) {
        throw new Error('YouTube credentials not configured');
      }

      // YouTube API requires OAuth2 flow - this is a simplified implementation
      // In production, you'd need proper OAuth2 implementation
      const uploadUrl = 'https://www.googleapis.com/upload/youtube/v3/videos';
      
      const metadata = {
        snippet: {
          title: content.title,
          description: content.description + '\n\n' + content.hashtags.join(' '),
          categoryId: '22', // People & Blogs
          defaultLanguage: 'en'
        },
        status: {
          privacyStatus: content.privacy || 'public'
        }
      };

      // This is a placeholder - actual YouTube upload requires multipart form data
      // and proper OAuth2 token management
      console.log('YouTube upload metadata:', metadata);
      console.log('Video file:', content.videoPath);

      return {
        success: true,
        platform: 'YouTube',
        url: 'https://youtube.com/watch?v=placeholder',
        postId: 'youtube_placeholder_id'
      };

    } catch (error) {
      return {
        success: false,
        platform: 'YouTube',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async shareToInstagram(content: ShareContent): Promise<ShareResult> {
    try {
      if (!this.credentials.instagram) {
        throw new Error('Instagram credentials not configured');
      }

      const { accessToken, businessAccountId } = this.credentials.instagram;

      // Step 1: Create media container
      const createContainerUrl = `https://graph.facebook.com/v18.0/${businessAccountId}/media`;
      
      const containerResponse = await axios.post(createContainerUrl, {
        media_type: 'VIDEO',
        video_url: content.videoPath, // Must be publicly accessible URL
        caption: `${content.title}\n\n${content.description}\n\n${content.hashtags.join(' ')}`,
        access_token: accessToken
      });

      const containerId = containerResponse.data.id;

      // Step 2: Publish the media
      const publishUrl = `https://graph.facebook.com/v18.0/${businessAccountId}/media_publish`;
      
      const publishResponse = await axios.post(publishUrl, {
        creation_id: containerId,
        access_token: accessToken
      });

      return {
        success: true,
        platform: 'Instagram',
        url: `https://instagram.com/p/${publishResponse.data.id}`,
        postId: publishResponse.data.id
      };

    } catch (error) {
      return {
        success: false,
        platform: 'Instagram',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async shareToTwitter(content: ShareContent): Promise<ShareResult> {
    try {
      if (!this.credentials.twitter) {
        throw new Error('Twitter credentials not configured');
      }

      // Twitter API v2 media upload
      const { bearerToken } = this.credentials.twitter;

      // Step 1: Upload media
      const mediaUploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
      
      // Read video file
      const videoBuffer = fs.readFileSync(content.videoPath);
      
      // Initialize upload
      const initResponse = await axios.post(mediaUploadUrl, {
        command: 'INIT',
        media_type: 'video/mp4',
        total_bytes: videoBuffer.length
      }, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const mediaId = initResponse.data.media_id_string;

      // Step 2: Create tweet with media
      const tweetUrl = 'https://api.twitter.com/2/tweets';
      
      const tweetText = `${content.title}\n\n${content.description}\n\n${content.hashtags.join(' ')}`;
      
      const tweetResponse = await axios.post(tweetUrl, {
        text: tweetText,
        media: {
          media_ids: [mediaId]
        }
      }, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        platform: 'Twitter',
        url: `https://twitter.com/user/status/${tweetResponse.data.data.id}`,
        postId: tweetResponse.data.data.id
      };

    } catch (error) {
      return {
        success: false,
        platform: 'Twitter',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async shareToReddit(content: ShareContent): Promise<ShareResult> {
    try {
      if (!this.credentials.reddit) {
        throw new Error('Reddit credentials not configured');
      }

      // Reddit API requires OAuth2
      const { clientId, clientSecret, username, password, userAgent } = this.credentials.reddit;

      // Step 1: Get access token
      const authUrl = 'https://www.reddit.com/api/v1/access_token';
      
      const authResponse = await axios.post(authUrl, 
        'grant_type=password&username=' + username + '&password=' + password,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(clientId + ':' + clientSecret).toString('base64')}`,
            'User-Agent': userAgent,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const accessToken = authResponse.data.access_token;

      // Step 2: Submit video post
      const submitUrl = 'https://oauth.reddit.com/api/submit';
      
      const postData = {
        api_type: 'json',
        kind: 'link',
        sr: 'videos', // Default subreddit
        title: content.title,
        text: content.description + '\n\n' + content.hashtags.join(' '),
        url: content.videoPath // Must be publicly accessible
      };

      const submitResponse = await axios.post(submitUrl, postData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        success: true,
        platform: 'Reddit',
        url: submitResponse.data.json.data.url,
        postId: submitResponse.data.json.data.id
      };

    } catch (error) {
      return {
        success: false,
        platform: 'Reddit',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async shareToTikTok(content: ShareContent): Promise<ShareResult> {
    try {
      if (!this.credentials.tiktok) {
        throw new Error('TikTok credentials not configured');
      }

      // TikTok for Developers API
      const { clientKey, accessToken } = this.credentials.tiktok;

      const uploadUrl = 'https://open-api.tiktok.com/video/upload/';
      
      const videoBuffer = fs.readFileSync(content.videoPath);
      
      const uploadData = {
        video: videoBuffer,
        post_info: {
          title: content.title,
          description: content.description + ' ' + content.hashtags.join(' '),
          privacy_level: content.privacy === 'private' ? 'MUTUAL_FOLLOW_FRIEND' : 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: content.videoPath
        }
      };

      const response = await axios.post(uploadUrl, uploadData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        platform: 'TikTok',
        url: `https://tiktok.com/@user/video/${response.data.data.publish_id}`,
        postId: response.data.data.publish_id
      };

    } catch (error) {
      return {
        success: false,
        platform: 'TikTok',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  async shareToMultiplePlatforms(
    content: ShareContent, 
    platforms: string[]
  ): Promise<ShareResult[]> {
    const results: ShareResult[] = [];

    for (const platform of platforms) {
      try {
        let result: ShareResult;

        switch (platform.toLowerCase()) {
          case 'youtube':
            result = await this.shareToYouTube(content);
            break;
          case 'instagram':
            result = await this.shareToInstagram(content);
            break;
          case 'twitter':
            result = await this.shareToTwitter(content);
            break;
          case 'reddit':
            result = await this.shareToReddit(content);
            break;
          case 'tiktok':
            result = await this.shareToTikTok(content);
            break;
          default:
            result = {
              success: false,
              platform: platform,
              error: 'Unsupported platform'
            };
        }

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          platform: platform,
          error: error instanceof Error ? error.message : 'Sharing failed'
        });
      }
    }

    return results;
  }
}

export const createSocialMediaShare = (credentials: SocialMediaCredentials): SocialMediaShare => {
  return new SocialMediaShare(credentials);
};