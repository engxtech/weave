# Video Editing Platform

## Overview
This project is a modern video editing platform featuring a React frontend, Express backend, AI-powered chat assistant, and a visual workflow editor. It enables users to create video editing workflows using drag-and-drop tiles for various processing operations such as voice translation, caption generation, audio enhancement, cutting, and B-roll generation. The platform aims to provide professional-grade video editing capabilities with intuitive AI assistance, streamlining the creation of engaging video content, especially for short-form social media formats.

## User Preferences
- Preferred communication style: Simple, everyday language
- Prefers Google Material Design aesthetics with proper Material Design icons
- Wants cost transparency with token usage tracking
- Design System: Google Sans/Roboto/Roboto Mono fonts, Google Material Design colors
- Color Scheme: Primary #4285F4 (Google blue), Secondary #34A853 (Gemini green), Background #F8F9FA, Canvas #FFFFFF, Tiles #E8F0FE, Text #202124, Accent #EA4335, Success #34A853
- Layout: Node-based canvas with connecting lines, floating tile library, chat sidebar, clean toolbar, 16px spacing grid, rounded corners and subtle shadows

## System Architecture
The platform is built with a React 18 (TypeScript) frontend utilizing Wouter for routing, TanStack Query for state management, and shadcn/ui (Radix UI) for components styled with Tailwind CSS following Google Material Design. ReactFlow is used for the visual workflow editor. The backend runs on Node.js (TypeScript with ES modules) with Express.js, using PostgreSQL (Neon Database) for data persistence via Drizzle ORM. AI integration is primarily handled by the Google Gemini API.

Key architectural decisions and features include:
- **Server-Side Video Processing**: All video operations are handled server-side using FFmpeg to avoid blob URL limitations. Video input propagation between connected workflow nodes is automatic.
- **Visual Workflow Editor**: A ReactFlow-based canvas allows drag-and-drop creation of video editing workflows using predefined tiles for operations like voice processing, captions, audio enhancement, and AI agents. The execution engine supports both sequential and parallel processing based on node dependencies.
- **AI Chat System**: Integrated with Google Gemini, the AI assistant provides context-aware help, workflow analysis, tile recommendations, and troubleshooting guidance.
- **Modular Node System**: A comprehensive library of AI-powered nodes (e.g., Shorts, Voice, Audio Enhance, Eye Contact, Reframe, Cut, Background, B-Roll, Captions, Music) is implemented with inline configuration UIs.
- **Intelligent Video Analysis**: Utilizes Gemini's multimodal capabilities for tasks like:
    - **Smart Reframing (AutoFlip-inspired)**: Content-aware cropping that tracks subjects (people, objects, faces) and camera motion using saliency detection and signal fusion, ensuring important content stays in frame across various aspect ratios, including dynamic zoom in/out.
    - **B-Roll Generation**: AI-generated contextual B-roll based on transcript analysis.
    - **Audio Enhancement**: Integration with professional services like Auphonic and ElevenLabs for noise reduction, loudness normalization, and voice clarity.
    - **Voice Cloning & Translation**: ElevenLabs integration for authentic voice preservation during language dubbing, supporting multiple languages and safewords.
    - **Captioning**: Deepgram for accurate word-level transcription with customizable styling (font, color, position, animations) optimized for platforms like YouTube Shorts.
    - **Video Search**: Multimodal AI search (audio + visual) for intelligent content discovery within videos, with sentence completion and proximity merging.
    - **AI Shorts Generation**: Comprehensive system for creating vertical shorts with AI-driven content selection, script generation, and focus-preserving reframing.
- **Timeline Editor**: A professional multi-track timeline interface inspired by Adobe Premiere Pro and CapCut, supporting drag-and-drop media, segment management (cut, delete, extend), text overlays with comprehensive styling and animation, and real-time visual previews without server-side processing delays during editing.
- **Scalability**: Designed with serverless PostgreSQL and stateless Express API for horizontal scaling, with external AI services handling intensive computations.
- **UI/UX**: Emphasis on a modern, professional dark theme with glassmorphic elements, gradient accents, and responsive design, providing an enterprise-grade user experience.

## External Dependencies
- **Database**: Neon Database (serverless PostgreSQL)
- **AI Services**: Google Gemini API (for chat, multimodal video analysis, image generation, TTS, transcription), Deepgram (for accurate speech-to-text transcription), ElevenLabs (for voice cloning and advanced audio enhancement), Auphonic (for professional audio post-production).
- **UI Frameworks**: React, Radix UI, shadcn/ui, Tailwind CSS, ReactFlow.
- **Runtime & Build Tools**: Node.js, Express.js, TypeScript, Vite, esbuild.
- **ORM**: Drizzle ORM, Drizzle Kit (for schema migrations).
- **Video Processing**: FFmpeg (for all server-side video manipulation).
- **Payment Gateway**: Razorpay (for subscription management).
- **Image Generation**: Gemini model (for AI image generation).
- **Object Detection**: TensorFlow.js COCO-SSD (for YOLO-like object detection in AutoFlip).

## Recent Updates

### August 1, 2025: Comprehensive Visual Remix UX Redesign
- **Added Weave header component**: Consistent application header with navigation and gallery access
- **Implemented tab-based interface**: Organized workflow into Subject Upload, YouTube Analysis, Scene Editing, and Image Generation tabs
- **Session persistence system**: Added database tables for saving/loading editing sessions
  - visual_remix_sessions table stores complete session state
  - visual_remix_gallery table stores AI-generated assets
- **Gallery functionality**: Personal gallery for storing and retrieving AI-generated images, videos, scenes, and stories
- **Enhanced scene editor**: Individual scene cards with AI enhancement buttons
- **Auto-save functionality**: Tracks unsaved changes and prompts users to save
- **Session management API**: Complete CRUD operations for sessions and gallery items

### August 1, 2025: Enhanced Video Analysis with Comprehensive Story Creation
- **Added comprehensive story creation from uploaded videos**: System now acts as expert video editor analyzing both audio and visual content
- **Audio transcription integration**: Extracts and transcribes audio using Deepgram for dialog analysis
- **Scene-based story breakdown**: Creates detailed scene-by-scene narrative with:
  - Character identification and development arcs
  - Scene descriptions with visual and audio elements
  - Dialog extraction with speaker identification and emotion
  - Scene transitions ensuring narrative continuity
- **Customizable story parameters**:
  - Story length options (Short 3-5 scenes, Standard 5-10, Long 10-15, Extended 15+)
  - Optional dialog script generation from audio
- **Dynamic frame extraction**: Optimizes frame count (10-25) based on video duration for efficient API usage
- **Enhanced UI display**: Shows story overview, characters, scenes breakdown, and narrative flow

### August 1, 2025: AI-Powered Scene Generation from YouTube Analysis
- **Scene-based video creation workflow**: Added intermediate step for creating and editing scenes before generating visuals
- **Dual creation modes**:
  - Copy Mode: Recreates exact story structure from analyzed YouTube videos
  - Creative Mode: Uses YouTube analysis as inspiration while adding AI imagination
- **8-second scene structure**: All scenes are exactly 8 seconds for optimal pacing
- **Duration-based scene calculation**: Scenes are calculated from total video duration (multiples of 8 seconds) rather than fixed scene counts
  - User selects total duration: 16s (2 scenes), 24s (3 scenes), up to 64s (8 scenes)
  - Each scene is always exactly 8 seconds
- **Editable scene properties**:
  - Title and description
  - Visual prompts for AI generation
  - Camera movements and transitions
  - Audio/music cues
- **AI scene enhancement**: One-click AI improvement for individual scenes
- **Story coherence**: Scenes are automatically tied together with smooth transitions and narrative flow
- **Visual feedback**: Shows which scenes are from YouTube copy vs creative interpretation
- **Dialog/voiceover support**: Optional dialog generation for each scene with checkbox control
  - Toggle "Include dialog/voiceover in each scene" when selecting duration
  - Edit dialog text inline with other scene properties
  - AI generates natural conversational dialog for storytelling

### August 1, 2025: Simplified Visual Remix Interface
- Created ultra-simple interface where users just type what they want to create in natural language
- AI automatically enhances prompts with professional cinematography details
- Generates 3 image variations (wide shot, close-up, cinematic) to choose from
- One-click video generation from selected image with smart motion effects
- Optional YouTube analysis for learning storytelling techniques (hidden in advanced options)
- Removed complex Subject/Scene/Style slots in favor of single text input
- System now accessible to anyone regardless of technical knowledge
- Maintains exact product/brand consistency across all variations